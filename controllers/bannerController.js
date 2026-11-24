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
    const { title, subtitle, badgeText, imageUrl, ctaText, ctaLink, order, isActive } = req.body;

    if (!title || !imageUrl) {
      return errorResponse(res, { statusCode: 400, message: 'Title and image URL are required' });
    }

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

const updateBanner = async (req, res, next) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const updated = await Banner.findByIdAndUpdate(req.params.id, req.body, { new: true });
      return successResponse(res, { message: 'Banner updated', data: updated });
    } else {
      const banner = memoryStore.banners.find(b => b._id === req.params.id);
      if (banner) Object.assign(banner, req.body);
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
