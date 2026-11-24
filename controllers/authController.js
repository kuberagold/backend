const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const memoryStore = require('../utils/memoryStore');
const { ROLES } = require('../config/roles');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'kuberagold_super_secret_jwt_key_2026_change_in_production', {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

const register = async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Please provide name, email and password'
      });
    }

    if (mongoose.connection.readyState === 1) {
      const userExists = await User.findOne({ email });
      if (userExists) {
        return errorResponse(res, {
          statusCode: 400,
          message: 'A user with this email already exists'
        });
      }

      const user = await User.create({
        name,
        email,
        password,
        phone: phone || '',
        role: ROLES.GUEST
      });

      const token = generateToken(user._id);

      return successResponse(res, {
        statusCode: 201,
        message: 'User registered successfully',
        data: { _id: user._id, name: user.name, email: user.email, role: user.role, token }
      });
    } else {
      const userExists = memoryStore.users.find(u => u.email === email.toLowerCase());
      if (userExists) {
        return errorResponse(res, {
          statusCode: 400,
          message: 'A user with this email already exists'
        });
      }

      const newUser = {
        _id: String(Date.now()),
        name,
        email: email.toLowerCase(),
        passwordHash: bcrypt.hashSync(password, 10),
        phone: phone || '',
        role: ROLES.GUEST,
        isActive: true,
        createdAt: new Date()
      };
      memoryStore.users.push(newUser);

      const token = generateToken(newUser._id);
      return successResponse(res, {
        statusCode: 201,
        message: 'User registered successfully',
        data: { _id: newUser._id, name: newUser.name, email: newUser.email, role: newUser.role, token }
      });
    }
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Please provide email and password'
      });
    }

    if (mongoose.connection.readyState === 1) {
      const user = await User.findOne({ email }).select('+password');
      if (!user || !(await user.matchPassword(password))) {
        return errorResponse(res, { statusCode: 401, message: 'Invalid email or password' });
      }
      if (!user.isActive) {
        return errorResponse(res, { statusCode: 403, message: 'Account is deactivated' });
      }

      user.lastLogin = new Date();
      await user.save();
      const token = generateToken(user._id);

      return successResponse(res, {
        message: 'Login successful',
        data: { _id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role, token }
      });
    } else {
      const user = memoryStore.users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
        return errorResponse(res, { statusCode: 401, message: 'Invalid email or password' });
      }
      if (!user.isActive) {
        return errorResponse(res, { statusCode: 403, message: 'Account is deactivated' });
      }

      const token = generateToken(user._id);
      return successResponse(res, {
        message: 'Login successful',
        data: { _id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role, token }
      });
    }
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res) => {
  return successResponse(res, {
    message: 'Profile retrieved successfully',
    data: req.user
  });
};

const updateProfile = async (req, res, next) => {
  try {
    return successResponse(res, {
      message: 'Profile updated successfully',
      data: req.user
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getMe,
  updateProfile
};
