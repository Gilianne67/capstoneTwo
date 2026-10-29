const ErrorResponse = require('../utils/errorResponse');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error for development
  console.error(err);

  // Mongoose Bad ObjectId (CastError)
  if (err.name === 'CastError') {
    const message = `Resource not found with id of ${err.value}`;
    error = new ErrorResponse(message, 404);
  }

  // Mongoose Duplicate Key Error
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = new ErrorResponse(message, 400);
  }

  // Mongoose Validation Error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map((val) => val.message);
    error = new ErrorResponse(message, 400);
  }

  const body = {
    success: false,
    error: error.message || 'Server Error',
  };
  if (err.code === 'ACCOUNT_SUSPENDED' || err.code === 'SESSION_REVOKED') {
    body.code = err.code;
  }
  if (Array.isArray(err.warnings) && err.warnings.length > 0) {
    body.warnings = err.warnings;
  }

  res.status(error.statusCode || 500).json(body);
};

// CRITICAL: Ensure errorHandler is directly exported
module.exports = errorHandler;