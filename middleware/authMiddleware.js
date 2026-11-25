const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const memoryStore = require('../utils/memoryStore');
const { errorResponse } = require('../utils/apiResponse');
const { getJwtSecret } = require('./security');

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
    const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
    if (!decoded || typeof decoded.id !== 'string') throw new Error('Malformed token');

    let user;
    if (mongoose.connection.readyState === 1) {
      if (!mongoose.isValidObjectId(decoded.id)) throw new Error('Malformed token');
      user = await User.findById(decoded.id).select('-password');
    } else {
      const found = memoryStore.users.find(u => u._id.toString() === decoded.id);
      // Never expose the password hash further down the request
      if (found) {
        const { passwordHash, ...safe } = found;
        user = safe;
      }
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
      message: 'Invalid or expired authentication token.'
    });
  }
};

module.exports = {
  authenticateToken
};
