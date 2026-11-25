const mongoose = require('mongoose');
const Banner = require('../models/Banner');
const memoryStore = require('../utils/memoryStore');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const getPublicBanners = async (req, res, next) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const banners = await Banner.find({ isActive: true }).sort({ order: 1, createdAt: -1 });
      return successResponse(res, { message: 'Active banners retrieved', data: banners });
    } else {
      const banners = memoryStore.banners.filter(b => b.isActive);
      return successResponse(res, { message: 'Active banners retrieved', data: banners });
    }
  } catch (error) {
    next(error);
  }
};

const getAllBannersAdmin = async (req, res, next) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const banners = await Banner.find().sort({ order: 1, createdAt: -1 });
      return successResponse(res, { message: 'All banners retrieved', data: banners });
    } else {
      return successResponse(res, { message: 'All banners retrieved', data: memoryStore.banners });
    }
  } catch (error) {
    next(error);
  }
};

const createBanner = async (req, res, next) => {
  try {
    if (typeof req.body.title !== 'string' || !req.body.title.trim() || !safeUrl(req.body.imageUrl)) {
      return errorResponse(res, { statusCode: 400, message: 'Title and a valid image URL (starting with / or http(s)://) are required' });
    }
    if (req.body.ctaLink && !safeUrl(req.body.ctaLink)) {
      return errorResponse(res, { statusCode: 400, message: 'Button link must start with / or http(s)://' });
    }
    const { title, subtitle, badgeText, imageUrl, ctaText, ctaLink } = pickBannerChanges(req.body);
    const order = Number(req.body.order) || 0;
    const isActive = req.body.isActive !== undefined ? Boolean(req.body.isActive) : undefined;

    if (mongoose.connection.readyState === 1) {
      const banner = await Banner.create({
        title, subtitle, badgeText, imageUrl,
        ctaText: ctaText || 'Check Live Rates',
        ctaLink: ctaLink || '/live-rates',
        order: order || 0,
        isActive: isActive !== undefined ? isActive : true,
        createdBy: req.user?._id
      });
      return successResponse(res, { statusCode: 201, message: 'Banner created successfully', data: banner });
    } else {
      const banner = {
        _id: String(Date.now()),
        title, subtitle, badgeText, imageUrl,
        ctaText: ctaText || 'Check Live Rates',
        ctaLink: ctaLink || '/live-rates',
        order: order || 0,
        isActive: isActive !== undefined ? isActive : true
      };
      memoryStore.banners.push(banner);
      return successResponse(res, { statusCode: 201, message: 'Banner created successfully', data: banner });
    }
  } catch (error) {
    next(error);
  }
};

const BANNER_TEXT_FIELDS = { title: 200, subtitle: 500, badgeText: 80, ctaText: 80 };

// Links and images must be site paths ("/...") or http(s) URLs: blocks javascript: and data: links
const safeUrl = (u) => typeof u === 'string' && u.length <= 1000 && (/^https?:\/\//i.test(u) || /^\/(?!\/)/.test(u));

const pickBannerChanges = (body = {}) => {
  const out = {};
  Object.entries(BANNER_TEXT_FIELDS).forEach(([k, max]) => {
    if (typeof body[k] === 'string') out[k] = body[k].trim().slice(0, max);
  });
  ['imageUrl', 'ctaLink'].forEach((k) => {
    if (body[k] === undefined) return;
    if (!safeUrl(body[k])) throw Object.assign(new Error(`${k} must start with / or http(s)://`), { statusCode: 400 });
    out[k] = body[k];
  });
  if (body.order !== undefined) out.order = Number(body.order) || 0;
  if (body.isActive !== undefined) out.isActive = Boolean(body.isActive);
  return out;
};

const updateBanner = async (req, res, next) => {
  try {
    const changes = pickBannerChanges(req.body);
    if (mongoose.connection.readyState === 1) {
      if (!mongoose.isValidObjectId(req.params.id)) return errorResponse(res, { statusCode: 404, message: 'Banner not found' });
      const updated = await Banner.findByIdAndUpdate(req.params.id, changes, { new: true, runValidators: true });
      if (!updated) return errorResponse(res, { statusCode: 404, message: 'Banner not found' });
      return successResponse(res, { message: 'Banner updated', data: updated });
    } else {
      const banner = memoryStore.banners.find(b => b._id === req.params.id);
      if (!banner) return errorResponse(res, { statusCode: 404, message: 'Banner not found' });
      Object.assign(banner, changes);
      return successResponse(res, { message: 'Banner updated', data: banner });
    }
  } catch (error) {
    next(error);
  }
};

const deleteBanner = async (req, res, next) => {
  try {
    if (mongoose.connection.readyState === 1) {
      await Banner.findByIdAndDelete(req.params.id);
    } else {
      memoryStore.banners = memoryStore.banners.filter(b => b._id !== req.params.id);
    }
    return successResponse(res, { message: 'Banner deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPublicBanners,
  getAllBannersAdmin,
  createBanner,
  updateBanner,
  deleteBanner
};
