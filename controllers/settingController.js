const mongoose = require('mongoose');
const Setting = require('../models/Setting');
const memoryStore = require('../utils/memoryStore');
const { successResponse } = require('../utils/apiResponse');
const { getBranches } = require('./branchController');

// Fields the SuperAdmin settings form may change (anything else in the body is ignored)
const EDITABLE = [
  'siteName', 'officialSlogan', 'tagLine', 'aboutShort',
  'contactEmail', 'contactPhone', 'contactMobile', 'whatsapp', 'address', 'businessHours',
  'logoUrl', 'defaultCurrency', 'paymentMethods',
  'marqueeNotice', 'disclaimer'
];
const SOCIAL = ['facebook', 'instagram', 'tiktok', 'youtube'];

const pickSettings = (body = {}) => {
  const out = {};
  EDITABLE.forEach((k) => {
    if (body[k] === undefined) return;
    out[k] = String(body[k]).trim();
  });
  if (body.socialLinks && typeof body.socialLinks === 'object') {
    SOCIAL.forEach((k) => {
      if (body.socialLinks[k] === undefined) return;
      const u = String(body.socialLinks[k]).trim();
      // Rendered as clickable links: allow only http(s) (or empty to hide)
      out[`socialLinks.${k}`] = u === '' || /^https?:\/\//i.test(u) ? u.slice(0, 500) : '';
    });
  }
  if (out.logoUrl !== undefined && out.logoUrl !== '' && !/^https?:\/\//i.test(out.logoUrl) && !/^\/(?!\/)/.test(out.logoUrl)) {
    delete out.logoUrl;
  }
  Object.keys(out).forEach((k) => {
    if (typeof out[k] === 'string') out[k] = out[k].slice(0, 2000);
  });
  return out;
};

const loadSettings = async () => {
  if (mongoose.connection.readyState === 1) {
    let settings = await Setting.findOne();
    if (!settings) settings = await Setting.create({});
    return settings;
  }
  return memoryStore.settings;
};

const getPublicSettings = async (req, res, next) => {
  try {
    return successResponse(res, { message: 'Site configuration retrieved', data: await loadSettings() });
  } catch (error) {
    next(error);
  }
};

const updateSettings = async (req, res, next) => {
  try {
    const changes = pickSettings(req.body);
    if (mongoose.connection.readyState === 1) {
      const current = await loadSettings();
      const settings = await Setting.findByIdAndUpdate(current._id, { $set: changes }, { new: true, runValidators: true });
      return successResponse(res, { message: 'Site settings updated', data: settings });
    }
    Object.entries(changes).forEach(([k, v]) => {
      if (k.startsWith('socialLinks.')) {
        memoryStore.settings.socialLinks = { ...(memoryStore.settings.socialLinks || {}), [k.split('.')[1]]: v };
      } else {
        memoryStore.settings[k] = v;
      }
    });
    return successResponse(res, { message: 'Site settings updated', data: memoryStore.settings });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPublicSettings,
  updateSettings,
  getBranches, // kept so the older /api/settings/branches URL still works
  loadSettings
};
