const mongoose = require('mongoose');
const Notice = require('../models/Notice');
const memoryStore = require('../utils/memoryStore');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { MAX_BYTES, saveFile, openFile, deleteFile, deleteOrphans } = require('../utils/noticeFiles');

const dbReady = () => mongoose.connection.readyState === 1;
const mem = () => (memoryStore.notices = memoryStore.notices || []);
const trusted = (o) => mongoose.trusted(o);

// Links must be site paths ("/...") or http(s) URLs: blocks javascript: and data: links
const safeUrl = (u) => typeof u === 'string' && u.length <= 1000 && (/^https?:\/\//i.test(u) || /^\/(?!\/)/.test(u));
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const FREQUENCIES = ['once', 'session', 'always'];

const toDate = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

// Whitelist + validate the admin form. Returns { value } or { error }.
const pickNotice = (body = {}, existing = null) => {
  const out = {};
  if (body.title !== undefined) out.title = str(body.title, 150);
  if (body.message !== undefined) out.message = str(body.message, 3000);
  if (body.ctaText !== undefined) out.ctaText = str(body.ctaText, 40);
  if (body.ctaLink !== undefined) {
    const l = str(body.ctaLink, 500);
    if (l && !safeUrl(l)) return { error: 'Button link must start with / or http(s)://' };
    out.ctaLink = l;
  }
  if (body.frequency !== undefined) {
    if (!FREQUENCIES.includes(body.frequency)) return { error: 'Unknown display frequency' };
    out.frequency = body.frequency;
  }
  if (body.priority !== undefined) out.priority = Math.max(-100, Math.min(100, Math.round(Number(body.priority) || 0)));
  if (body.isActive !== undefined) out.isActive = body.isActive === true || body.isActive === 'true';

  for (const k of ['startsAt', 'expiresAt']) {
    if (body[k] === undefined) continue;
    const d = toDate(body[k]);
    if (d === undefined) return { error: `${k === 'startsAt' ? 'Start' : 'Expiry'} time is not a valid date` };
    if (k === 'startsAt') out.startsAt = d || new Date();
    else out.expiresAt = d;
  }

  if (body.attachment !== undefined) {
    const a = body.attachment || {};
    if (!a || a.kind === 'none' || (!a.fileId && !a.url)) {
      out.attachment = { kind: 'none', fileId: null, url: '', fileName: '', mimeType: '', size: 0 };
    } else if (a.fileId) {
      if (!mongoose.isValidObjectId(String(a.fileId))) return { error: 'Invalid uploaded file' };
      if (!['image', 'pdf'].includes(a.kind)) return { error: 'Attachment must be an image or a PDF' };
      out.attachment = {
        kind: a.kind,
        fileId: String(a.fileId),
        url: '',
        fileName: str(a.fileName, 100),
        mimeType: str(a.mimeType, 60),
        size: Math.max(0, Number(a.size) || 0),
      };
    } else {
      const u = str(a.url, 1000);
      if (!/^https?:\/\//i.test(u)) return { error: 'Attachment link must be a full http(s):// address' };
      const kind = a.kind === 'pdf' || /\.pdf(\?|#|$)/i.test(u) ? 'pdf' : 'image';
      out.attachment = { kind, fileId: null, url: u, fileName: '', mimeType: '', size: 0 };
    }
  }

  const merged = { ...(existing || {}), ...out };
  if (!existing && !merged.title) return { error: 'Please add a title' };
  if (existing && out.title === '') return { error: 'Please add a title' };
  if (!merged.expiresAt) return { error: 'Please set an expiry time' };
  const start = merged.startsAt ? new Date(merged.startsAt) : new Date();
  if (new Date(merged.expiresAt) <= start) return { error: 'Expiry time must be after the start time' };
  return { value: out };
};

// Relative path the frontend prefixes with its API base URL
const withFileUrl = (n) => {
  const doc = typeof n.toObject === 'function' ? n.toObject() : { ...n };
  if (doc.attachment?.fileId) doc.attachment.fileUrl = `/notices/file/${doc.attachment.fileId}`;
  else if (doc.attachment?.url) doc.attachment.fileUrl = doc.attachment.url;
  return doc;
};

// ---------- Public ----------
const getActiveNotices = async (req, res, next) => {
  try {
    const now = new Date();
    let list;
    if (dbReady()) {
      list = await Notice.find({ isActive: true, startsAt: trusted({ $lte: now }), expiresAt: trusted({ $gt: now }) })
        .select('title message attachment ctaText ctaLink frequency priority expiresAt updatedAt')
        .sort({ priority: -1, startsAt: -1 })
        .limit(5)
        .lean();
    } else {
      list = mem()
        .filter((n) => n.isActive && new Date(n.startsAt) <= now && new Date(n.expiresAt) > now)
        .sort((a, b) => b.priority - a.priority || new Date(b.startsAt) - new Date(a.startsAt))
        .slice(0, 5);
    }
    res.set('Cache-Control', 'no-store');
    return successResponse(res, { message: 'Active notices', data: list.map(withFileUrl) });
  } catch (error) {
    next(error);
  }
};

// Streams an uploaded image / PDF. Locked-down headers so a file can never run script on this origin.
const getNoticeFile = async (req, res, next) => {
  try {
    const file = await openFile(req.params.fileId);
    if (!file) return errorResponse(res, { statusCode: 404, message: 'File not found' });
    const { mimeType, fileName, size } = file.info;
    const isPdf = mimeType === 'application/pdf';

    res.removeHeader('Content-Security-Policy');
    res.removeHeader('X-Frame-Options');
    res.set({
      'Content-Type': mimeType,
      'Content-Length': String(size),
      'Content-Disposition': `inline; filename="${String(fileName).replace(/["\\\r\n]/g, '')}"`,
      'X-Content-Type-Options': 'nosniff',
      // The website (another origin on Vercel) shows these files in <img> / <iframe>
      'Cross-Origin-Resource-Policy': 'cross-origin',
      // Files never change for a given id
      'Cache-Control': 'public, max-age=31536000, immutable',
      // SVG may contain script: sandbox it. PDFs need the browser's viewer, so no sandbox there.
      'Content-Security-Policy': isPdf
        ? "default-src 'none'; object-src 'none'"
        : "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
    });
    file.stream.on('error', next).pipe(res);
  } catch (error) {
    next(error);
  }
};

// ---------- Admin ----------
const getAllNotices = async (req, res, next) => {
  try {
    const list = dbReady()
      ? await Notice.find().sort({ createdAt: -1 }).populate('updatedBy', 'name').lean()
      : [...mem()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return successResponse(res, { message: 'Notices', data: list.map(withFileUrl) });
  } catch (error) {
    next(error);
  }
};

// Body: the raw file bytes (any Content-Type); file name in the X-File-Name header
const uploadNoticeFile = async (req, res, next) => {
  try {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return errorResponse(res, { statusCode: 400, message: 'No file received.' });
    }
    const name = decodeURIComponent(String(req.get('X-File-Name') || 'file')).slice(0, 200);
    const saved = await saveFile(req.body, name);
    if (saved.error) return errorResponse(res, { statusCode: 415, message: saved.error });

    // Housekeeping: drop day-old uploads that never got attached to a notice
    const used = dbReady() ? await Notice.distinct('attachment.fileId') : [];
    deleteOrphans(used.filter(Boolean)).catch(() => {});

    return successResponse(res, {
      statusCode: 201,
      message: saved.limited
        ? 'Uploaded. Note: HEIC and TIFF images only display in Safari; JPG, PNG or WebP work everywhere.'
        : 'File uploaded',
      data: { ...saved, fileUrl: `/notices/file/${saved.fileId}` },
    });
  } catch (error) {
    next(error);
  }
};

const createNotice = async (req, res, next) => {
  try {
    const checked = pickNotice(req.body);
    if (checked.error) return errorResponse(res, { statusCode: 400, message: checked.error });
    const data = { startsAt: new Date(), ...checked.value, createdBy: req.user?._id, updatedBy: req.user?._id };
    let notice;
    if (dbReady()) {
      notice = await Notice.create(data);
    } else {
      notice = {
        _id: new mongoose.Types.ObjectId().toString(),
        message: '', ctaText: '', ctaLink: '', frequency: 'session', priority: 0, isActive: true,
        attachment: { kind: 'none' }, createdAt: new Date(), updatedAt: new Date(), ...data,
      };
      mem().unshift(notice);
    }
    return successResponse(res, { statusCode: 201, message: 'Notice created', data: withFileUrl(notice) });
  } catch (error) {
    next(error);
  }
};

const updateNotice = async (req, res, next) => {
  try {
    const id = req.params.id;
    let current;
    if (dbReady()) {
      if (!mongoose.isValidObjectId(id)) return errorResponse(res, { statusCode: 404, message: 'Notice not found' });
      current = await Notice.findById(id).lean();
    } else {
      current = mem().find((n) => n._id === id);
    }
    if (!current) return errorResponse(res, { statusCode: 404, message: 'Notice not found' });

    const checked = pickNotice(req.body, current);
    if (checked.error) return errorResponse(res, { statusCode: 400, message: checked.error });
    const changes = { ...checked.value, updatedBy: req.user?._id };

    // Replaced or removed upload: delete the old file
    const oldFile = current.attachment?.fileId && String(current.attachment.fileId);
    const newFile = changes.attachment ? changes.attachment.fileId && String(changes.attachment.fileId) : oldFile;
    if (oldFile && oldFile !== newFile) await deleteFile(oldFile);

    let notice;
    if (dbReady()) {
      notice = await Notice.findByIdAndUpdate(id, changes, { new: true, runValidators: true }).populate('updatedBy', 'name');
    } else {
      Object.assign(current, changes, { updatedAt: new Date() });
      notice = current;
    }
    return successResponse(res, { message: 'Notice updated', data: withFileUrl(notice) });
  } catch (error) {
    next(error);
  }
};

const deleteNotice = async (req, res, next) => {
  try {
    const id = req.params.id;
    let gone;
    if (dbReady()) {
      if (!mongoose.isValidObjectId(id)) return errorResponse(res, { statusCode: 404, message: 'Notice not found' });
      gone = await Notice.findByIdAndDelete(id).lean();
    } else {
      gone = mem().find((n) => n._id === id);
      memoryStore.notices = mem().filter((n) => n._id !== id);
    }
    if (!gone) return errorResponse(res, { statusCode: 404, message: 'Notice not found' });
    if (gone.attachment?.fileId) await deleteFile(gone.attachment.fileId);
    return successResponse(res, { message: 'Notice deleted' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  MAX_BYTES,
  getActiveNotices,
  getNoticeFile,
  getAllNotices,
  uploadNoticeFile,
  createNotice,
  updateNotice,
  deleteNotice,
};
