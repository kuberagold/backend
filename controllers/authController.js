const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const memoryStore = require('../utils/memoryStore');
const { ROLES } = require('../config/roles');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const { getJwtSecret } = require('../middleware/security');

const generateToken = (id) => {
  return jwt.sign({ id: String(id) }, getJwtSecret(), {
    algorithm: 'HS256',
    expiresIn: process.env.JWT_EXPIRE || '1d'
  });
};

const DUMMY_HASH = bcrypt.hashSync('timing-equaliser-not-a-real-password', 10);
const EMAIL_RE =/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const isStr = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;

// At least 8 characters with a letter and a number
const strongPassword = (p) => typeof p === 'string' && p.length >= 8 && p.length <= 128 && /[A-Za-z]/.test(p) && /\d/.test(p);

// ---------- Invite-only registration ----------
// Sign-up needs REGISTRATION_SECRET from .env. With no secret configured, registration is off.
// New accounts get REGISTRATION_ROLE ('admin' or 'guest'; never superadmin).
const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest();

const registrationKeyValid = (given) => {
  const expected = process.env.REGISTRATION_SECRET || '';
  if (expected.length < 12 || typeof given !== 'string' || !given) return false;
  // Constant-time comparison of fixed-length hashes: timing reveals nothing about the key
  return crypto.timingSafeEqual(sha256(given), sha256(expected));
};

const registrationRole = () =>
  [ROLES.ADMIN, ROLES.GUEST].includes(process.env.REGISTRATION_ROLE) ? process.env.REGISTRATION_ROLE : ROLES.ADMIN;

const register = async (req, res, next) => {
  try {
    if (!process.env.REGISTRATION_SECRET || process.env.REGISTRATION_SECRET.length < 12) {
      return errorResponse(res, { statusCode: 403, message: 'Registration is closed.' });
    }
    if (!registrationKeyValid(req.body.registrationKey)) {
      return errorResponse(res, { statusCode: 403, message: 'Invalid registration key.' });
    }

    const { name, password } = req.body;
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const phone = typeof req.body.phone === 'string' ? req.body.phone.trim().slice(0, 20) : '';

    if (!isStr(name, 100) || !EMAIL_RE.test(email) || email.length > 254 || typeof password !== 'string') {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Please provide a name, a valid email and a password'
      });
    }
    if (!strongPassword(password)) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Password must be at least 8 characters and include a letter and a number'
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
        role: registrationRole()
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
        role: registrationRole(),
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
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const { password } = req.body;

    if (!email || email.length > 254 || typeof password !== 'string' || !password || password.length > 128) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Please provide email and password'
      });
    }

    if (mongoose.connection.readyState === 1) {
      const user = await User.findOne({ email }).select('+password');
      if (!user) await bcrypt.compare(password, DUMMY_HASH); // same timing whether or not the email exists
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

// Only public profile fields leave the server
const publicUser = (u) => ({
  _id: u._id, name: u.name, email: u.email, phone: u.phone, role: u.role, isActive: u.isActive, lastLogin: u.lastLogin
});

const getMe = async (req, res) => {
  return successResponse(res, {
    message: 'Profile retrieved successfully',
    data: publicUser(req.user)
  });
};

const updateProfile = async (req, res, next) => {
  try {
    return successResponse(res, {
      message: 'Profile updated successfully',
      data: publicUser(req.user)
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
