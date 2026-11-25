const { errorResponse } = require('../utils/apiResponse');

// Centralized error handling middleware
const errorHandler = (err, req, res, next) => {
  console.error('[Error Details]:', err);

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let errors = null;

  // Mongoose duplicate key error
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue)[0];
    message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists.`;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
    errors = Object.values(err.errors).map(val => val.message);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token.';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token has expired. Please login again.';
  }

  // Malformed JSON body or oversize request: client error, not a crash
  if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Malformed JSON in request body.';
  } else if (err.type === 'entity.too.large') {
    statusCode = 413;
    message = 'Request body is too large.';
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid identifier or value.';
  }

  // Never reveal internal error details (stack traces, driver messages) for server errors
  if (statusCode >= 500) {
    message = 'Something went wrong on our side. Please try again.';
    errors = null;
  }

  return errorResponse(res, {
    statusCode,
    message,
    errors
  });
};

module.exports = errorHandler;
