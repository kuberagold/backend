const mongoose = require('mongoose');
const User = require('../models/User');
const memoryStore = require('../utils/memoryStore');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const getAllUsers = async (req, res, next) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const filter = {};
      if (req.query.role) filter.role = req.query.role;
      const users = await User.find(filter).select('-password').sort({ createdAt: -1 });
      return successResponse(res, { message: 'Users retrieved', data: users });
    } else {
      let users = [...memoryStore.users];
      if (req.query.role) users = users.filter(u => u.role === req.query.role);
      const safeUsers = users.map(({ passwordHash, ...rest }) => rest);
      return successResponse(res, { message: 'Users retrieved', data: safeUsers });
    }
  } catch (error) {
    next(error);
  }
};

const updateUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    if (mongoose.connection.readyState === 1) {
      const user = await User.findById(req.params.id);
      if (!user) return errorResponse(res, { statusCode: 404, message: 'User not found' });
      user.role = role;
      await user.save();
      return successResponse(res, { message: `User role updated to ${role}`, data: user });
    } else {
      const user = memoryStore.users.find(u => u._id === req.params.id);
      if (!user) return errorResponse(res, { statusCode: 404, message: 'User not found' });
      user.role = role;
      return successResponse(res, { message: `User role updated to ${role}`, data: user });
    }
  } catch (error) {
    next(error);
  }
};

const toggleUserStatus = async (req, res, next) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const user = await User.findById(req.params.id);
      if (!user) return errorResponse(res, { statusCode: 404, message: 'User not found' });
      user.isActive = !user.isActive;
      await user.save();
      return successResponse(res, { message: `Status updated`, data: user });
    } else {
      const user = memoryStore.users.find(u => u._id === req.params.id);
      if (!user) return errorResponse(res, { statusCode: 404, message: 'User not found' });
      user.isActive = !user.isActive;
      return successResponse(res, { message: `Status updated`, data: user });
    }
  } catch (error) {
    next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    if (mongoose.connection.readyState === 1) {
      await User.findByIdAndDelete(req.params.id);
    } else {
      memoryStore.users = memoryStore.users.filter(u => u._id !== req.params.id);
    }
    return successResponse(res, { message: 'User deleted' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllUsers,
  updateUserRole,
  toggleUserStatus,
  deleteUser
};
