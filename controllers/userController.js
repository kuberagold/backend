const mongoose = require('mongoose');
const User = require('../models/User');
const memoryStore = require('../utils/memoryStore');
const { ROLES } = require('../config/roles');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const isDb = () => mongoose.connection.readyState === 1;
const VALID_ROLES = Object.values(ROLES);

const safeUser = (u) => {
  if (!u) return u;
  const obj = typeof u.toObject === 'function' ? u.toObject() : { ...u };
  delete obj.password;
  delete obj.passwordHash;
  return obj;
};

const isSelf = (req) => String(req.user._id) === String(req.params.id);

const findUser = async (id) => {
  if (isDb()) return mongoose.isValidObjectId(id) ? User.findById(id) : null;
  return memoryStore.users.find((u) => u._id === id) || null;
};

const getAllUsers = async (req, res, next) => {
  try {
    const role = VALID_ROLES.includes(req.query.role) ? req.query.role : '';
    let users;
    if (isDb()) {
      users = await User.find(role ? { role } : {}).select('-password').sort({ createdAt: -1 });
    } else {
      users = memoryStore.users.filter((u) => !role || u.role === role);
    }
    return successResponse(res, { message: 'Users retrieved', data: users.map(safeUser) });
  } catch (error) {
    next(error);
  }
};

const updateUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!VALID_ROLES.includes(role)) {
      return errorResponse(res, { statusCode: 400, message: `Role must be one of: ${VALID_ROLES.join(', ')}` });
    }
    // A superadmin demoting themselves could leave nobody able to manage users
    if (isSelf(req) && role !== ROLES.SUPERADMIN) {
      return errorResponse(res, { statusCode: 400, message: 'You cannot change your own role.' });
    }
    const user = await findUser(req.params.id);
    if (!user) return errorResponse(res, { statusCode: 404, message: 'User not found' });
    user.role = role;
    if (isDb()) await user.save();
    return successResponse(res, { message: `User role updated to ${role}`, data: safeUser(user) });
  } catch (error) {
    next(error);
  }
};

const toggleUserStatus = async (req, res, next) => {
  try {
    if (isSelf(req)) {
      return errorResponse(res, { statusCode: 400, message: 'You cannot deactivate your own account.' });
    }
    const user = await findUser(req.params.id);
    if (!user) return errorResponse(res, { statusCode: 404, message: 'User not found' });
    user.isActive = !user.isActive;
    if (isDb()) await user.save();
    return successResponse(res, { message: 'Status updated', data: safeUser(user) });
  } catch (error) {
    next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    if (isSelf(req)) {
      return errorResponse(res, { statusCode: 400, message: 'You cannot delete your own account.' });
    }
    const user = await findUser(req.params.id);
    if (!user) return errorResponse(res, { statusCode: 404, message: 'User not found' });
    if (isDb()) {
      await User.findByIdAndDelete(req.params.id);
    } else {
      memoryStore.users = memoryStore.users.filter((u) => u._id !== req.params.id);
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
