// Success Response Helper
exports.sendSuccess = (res, statusCode = 200, message = 'Success', data = null, meta = null) => {
  const response = {
    success: true,
    message,
  };

  if (data !== null) response.data = data;
  if (meta !== null) response.meta = meta;

  return res.status(statusCode).json(response);
};

// Error Response Helper
exports.sendError = (res, statusCode = 500, message = 'Server Error', errors = null) => {
  const response = {
    success: false,
    error: message,
  };

  if (errors !== null) response.details = errors;

  return res.status(statusCode).json(response);
};