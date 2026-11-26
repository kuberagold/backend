const mongoose = require('mongoose');
const Branch = require('../models/Branch');
const memoryStore = require('../utils/memoryStore');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const isDb = () => mongoose.connection.readyState === 1;

const EDITABLE = ['name', 'city', 'address', 'phone', 'mobile', 'whatsapp', 'email', 'hours', 'services', 'mapUrl', 'image', 'isHeadOffice', 'isActive', 'displayOrder'];

// Keep only known fields and normalise types
const pickBranch = (body = {}) => {
  const out = {};
  EDITABLE.forEach((k) => {
    if (body[k] === undefined) return;
    if (k === 'services') {
      out.services = (Array.isArray(body.services) ? body.services : String(body.services).split(','))
        .map((s) => String(s).trim())
        .filter(Boolean);
    } else if (k === 'isHeadOffice' || k === 'isActive') {
      out[k] = Boolean(body[k]);
    } else if (k === 'displayOrder') {
      out[k] = Number(body[k]) || 0;
    } else if (k === 'mapUrl' || k === 'image') {
      // Only http(s) links or site paths; blocks javascript: and data: links
      const u = String(body[k]).trim();
      out[k] = u === '' || /^https?:\/\//i.test(u) || /^\/(?!\/)/.test(u) ? u.slice(0, 1000) : '';
    } else {
      out[k] = String(body[k]).trim().slice(0, k === 'address' || k === 'hours' ? 300 : 150);
    }
  });
  return out;
};

const sortBranches = (list) =>
  [...list].sort((a, b) => (b.isHeadOffice ? 1 : 0) - (a.isHeadOffice ? 1 : 0) || (a.displayOrder || 0) - (b.displayOrder || 0));

const memoryId = (name) =>
  `${String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now().toString(36)}`;

// First run with a database: copy the starter branches in so the site is never empty
const seedIfEmpty = async () => {
  if ((await Branch.estimatedDocumentCount()) > 0) return;
  await Branch.insertMany(memoryStore.branches.map(({ id, ...rest }) => rest));
};

// Only one branch can be the head office
const clearOtherHeadOffices = async (keepId) => {
  if (isDb()) {
    // trusted(): the operator is built here, not taken from user input (see sanitizeFilter in server.js)
    await Branch.updateMany({ _id: mongoose.trusted({ $ne: keepId }), isHeadOffice: true }, { isHeadOffice: false });
  } else {
    memoryStore.branches.forEach((b) => { if (b.id !== keepId) b.isHeadOffice = false; });
  }
};

// Public: active branches, head office first
const getBranches = async (req, res, next) => {
  try {
    let list;
    if (isDb()) {
      await seedIfEmpty();
      list = await Branch.find({ isActive: true });
    } else {
      list = memoryStore.branches.filter((b) => b.isActive !== false);
    }
    return successResponse(res, { message: 'Branches retrieved successfully', data: sortBranches(list) });
  } catch (error) {
    next(error);
  }
};

// Admin: every branch, including hidden ones
const getAllBranchesAdmin = async (req, res, next) => {
  try {
    let list;
    if (isDb()) {
      await seedIfEmpty();
      list = await Branch.find();
    } else {
      list = memoryStore.branches;
    }
    return successResponse(res, { message: 'All branches retrieved', data: sortBranches(list) });
  } catch (error) {
    next(error);
  }
};

const createBranch = async (req, res, next) => {
  try {
    const data = pickBranch(req.body);
    if (!data.name || !data.city || !data.address) {
      return errorResponse(res, { statusCode: 400, message: 'Branch name, city and address are required' });
    }
    let branch;
    if (isDb()) {
      branch = await Branch.create(data);
    } else {
      branch = { id: memoryId(data.name), services: [], isActive: true, isHeadOffice: false, displayOrder: 0, ...data };
      memoryStore.branches.push(branch);
    }
    if (branch.isHeadOffice) await clearOtherHeadOffices(branch.id);
    return successResponse(res, { statusCode: 201, message: 'Branch created', data: branch });
  } catch (error) {
    next(error);
  }
};

const updateBranch = async (req, res, next) => {
  try {
    const data = pickBranch(req.body);
    let branch;
    if (isDb()) {
      if (!mongoose.isValidObjectId(req.params.id)) return errorResponse(res, { statusCode: 404, message: 'Branch not found' });
      branch = await Branch.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    } else {
      branch = memoryStore.branches.find((b) => b.id === req.params.id);
      if (branch) Object.assign(branch, data);
    }
    if (!branch) return errorResponse(res, { statusCode: 404, message: 'Branch not found' });
    if (branch.isHeadOffice) await clearOtherHeadOffices(branch.id);
    return successResponse(res, { message: 'Branch updated', data: branch });
  } catch (error) {
    next(error);
  }
};

const deleteBranch = async (req, res, next) => {
  try {
    let removed;
    if (isDb()) {
      if (!mongoose.isValidObjectId(req.params.id)) return errorResponse(res, { statusCode: 404, message: 'Branch not found' });
      removed = await Branch.findByIdAndDelete(req.params.id);
    } else {
      const i = memoryStore.branches.findIndex((b) => b.id === req.params.id);
      if (i >= 0) removed = memoryStore.branches.splice(i, 1)[0];
    }
    if (!removed) return errorResponse(res, { statusCode: 404, message: 'Branch not found' });
    return successResponse(res, { message: 'Branch deleted', data: { id: req.params.id } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getBranches,
  getAllBranchesAdmin,
  createBranch,
  updateBranch,
  deleteBranch
};
