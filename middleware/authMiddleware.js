const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const memoryStore = require('../utils/memoryStore');
const { errorResponse } = require('../utils/apiResponse');

const authenticateToken = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return errorResponse(res, {
      statusCode: 401,
      message: 'Access denied. Authentication token missing.'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'kuberagold_super_secret_jwt_key_2026_change_in_production');
    
    let user;
    if (mongoose.connection.readyState === 1) {
      user = await User.findById(decoded.id).select('-password');
    } else {
      user = memoryStore.users.find(u => u._id.toString() === decoded.id.toString());
    }

    if (!user) {
      return errorResponse(res, {
        statusCode: 401,
        message: 'Invalid session. User not found.'
      });
    }

    if (!user.isActive) {
      return errorResponse(res, {
        statusCode: 403,
        message: 'Account has been deactivated. Please contact administrator.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return errorResponse(res, {
      statusCode: 401,
      message: 'Invalid or expired authentication token.',
      errors: error.message
    });
  }
};

module.exports = {
  authenticateToken
};
