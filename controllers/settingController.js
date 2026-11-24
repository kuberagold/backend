const mongoose = require('mongoose');
const Setting = require('../models/Setting');
const memoryStore = require('../utils/memoryStore');
const { successResponse } = require('../utils/apiResponse');

const getPublicSettings = async (req, res, next) => {
  try {
    if (mongoose.connection.readyState === 1) {
      let settings = await Setting.findOne();
      if (!settings) settings = await Setting.create({});
      return successResponse(res, { message: 'Site configuration retrieved', data: settings });
    } else {
      return successResponse(res, { message: 'Site configuration retrieved', data: memoryStore.settings });
    }
  } catch (error) {
    next(error);
  }
};

const updateSettings = async (req, res, next) => {
  try {
    if (mongoose.connection.readyState === 1) {
      let settings = await Setting.findOne();
      if (!settings) {
        settings = await Setting.create(req.body);
      } else {
        settings = await Setting.findByIdAndUpdate(settings._id, req.body, { new: true });
      }
      return successResponse(res, { message: 'Site settings updated', data: settings });
    } else {
      Object.assign(memoryStore.settings, req.body);
      return successResponse(res, { message: 'Site settings updated', data: memoryStore.settings });
    }
  } catch (error) {
    next(error);
  }
};

const getBranches = async (req, res, next) => {
  try {
    return successResponse(res, {
      message: 'Branches retrieved successfully',
      data: memoryStore.branches
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPublicSettings,
  updateSettings,
  getBranches
};
