const mongoose = require('mongoose');
const { Readable } = require('stream');

// Uploaded popup files (images, PDFs). Stored in MongoDB GridFS so they survive serverless
// deploys (Vercel has no persistent disk). Without a database (local demo mode) they live in memory.
const BUCKET = 'noticeFiles';
const MAX_BYTES = 4 * 1024 * 1024; // Vercel's request limit is 4.5 MB
const memoryFiles = new Map();

const dbReady = () => mongoose.connection.readyState === 1;
const bucket = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: BUCKET });

// Identify the file from its first bytes, never from the name or the browser's claimed type.
const sniff = (buf) => {
  const b = (i) => buf[i];
  const ascii = (start, len) => buf.slice(start, start + len).toString('latin1');
  if (buf.length < 12) return null;
  if (ascii(0, 5) === '%PDF-') return { kind: 'pdf', mime: 'application/pdf', ext: 'pdf' };
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return { kind: 'image', mime: 'image/jpeg', ext: 'jpg' };
  if (b(0) === 0x89 && ascii(1, 3) === 'PNG') return { kind: 'image', mime: 'image/png', ext: 'png' };
  if (ascii(0, 4) === 'GIF8') return { kind: 'image', mime: 'image/gif', ext: 'gif' };
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return { kind: 'image', mime: 'image/webp', ext: 'webp' };
  if (ascii(0, 2) === 'BM') return { kind: 'image', mime: 'image/bmp', ext: 'bmp' };
  if (b(0) === 0 && b(1) === 0 && b(2) === 1 && b(3) === 0) return { kind: 'image', mime: 'image/x-icon', ext: 'ico' };
  if (ascii(0, 4) === 'II*\0' || ascii(0, 4) === 'MM\0*') return { kind: 'image', mime: 'image/tiff', ext: 'tiff', limited: true };
  if (ascii(4, 4) === 'ftyp') {
    const brand = ascii(8, 4);
    if (brand === 'avif' || brand === 'avis') return { kind: 'image', mime: 'image/avif', ext: 'avif' };
    if (['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand)) return { kind: 'image', mime: 'image/heic', ext: 'heic', limited: true };
  }
  // SVG is text: allow an optional BOM, XML declaration, comments or doctype before <svg
  const head = buf.slice(0, 2048).toString('utf8').replace(/^﻿/, '').trimStart();
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE svg[^>]*>\s*)?<svg[\s>]/i.test(head)) {
    return { kind: 'image', mime: 'image/svg+xml', ext: 'svg' };
  }
  return null;
};

const cleanName = (name, ext) => {
  const base = String(name || 'file').replace(/[^\w.\- ]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) || 'file';
  return base.toLowerCase().endsWith(`.${ext}`) ? base : `${base.replace(/\.[^.]*$/, '')}.${ext}`;
};

const saveFile = async (buffer, originalName) => {
  const type = sniff(buffer);
  if (!type) return { error: 'Unsupported file. Upload an image (JPG, PNG, GIF, WebP, AVIF, SVG, BMP, ICO, HEIC, TIFF) or a PDF.' };
  const fileName = cleanName(originalName, type.ext);
  const meta = { kind: type.kind, mimeType: type.mime, fileName, size: buffer.length, limited: !!type.limited };

  if (dbReady()) {
    const id = await new Promise((resolve, reject) => {
      const up = bucket().openUploadStream(fileName, { contentType: type.mime, metadata: { kind: type.kind } });
      Readable.from(buffer).pipe(up).on('error', reject).on('finish', () => resolve(up.id));
    });
    return { ...meta, fileId: String(id) };
  }
  const id = new mongoose.Types.ObjectId().toString();
  memoryFiles.set(id, { buffer, ...meta, uploadDate: new Date() });
  return { ...meta, fileId: id };
};

// Returns { info: { mimeType, fileName, size }, stream } or null
const openFile = async (id) => {
  if (!mongoose.isValidObjectId(id)) return null;
  if (dbReady()) {
    const [f] = await bucket().find({ _id: new mongoose.Types.ObjectId(id) }).toArray();
    if (!f) return null;
    return { info: { mimeType: f.contentType, fileName: f.filename, size: f.length }, stream: bucket().openDownloadStream(f._id) };
  }
  const f = memoryFiles.get(id);
  if (!f) return null;
  return { info: f, stream: Readable.from(f.buffer) };
};

const deleteFile = async (id) => {
  if (!id || !mongoose.isValidObjectId(String(id))) return;
  if (dbReady()) {
    await bucket().delete(new mongoose.Types.ObjectId(String(id))).catch(() => {});
  } else {
    memoryFiles.delete(String(id));
  }
};

// Uploads that were never attached to a notice (form abandoned) are removed after a day
const deleteOrphans = async (usedIds) => {
  if (!dbReady()) return;
  const used = new Set(usedIds.map(String));
  const cutoff = new Date(Date.now() - 24 * 3600 * 1000);
  const old = await bucket().find({ uploadDate: { $lt: cutoff } }).project({ _id: 1 }).toArray();
  await Promise.all(old.filter((f) => !used.has(String(f._id))).map((f) => deleteFile(f._id)));
};

module.exports = { MAX_BYTES, saveFile, openFile, deleteFile, deleteOrphans, sniff };
