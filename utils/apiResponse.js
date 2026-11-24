/**
 * Standardized API Response Helper
 */
const successResponse = (res, { statusCode = 200, message = 'Success', data = null, pagination = null }) => {
  const payload = {
    success: true,
    message,
    data
  };
  if (pagination) {
    payload.pagination = pagination;
  }
  return res.status(statusCode).json(payload);
};

const errorResponse = (res, { statusCode = 500, message = 'Internal Server Error', errors = null }) => {
  const payload = {
    success: false,
    message
  };
  if (errors) {
    payload.errors = errors;
  }
  return res.status(statusCode).json(payload);
};

module.exports = {
  successResponse,
  errorResponse
};
