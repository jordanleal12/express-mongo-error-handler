// Centralized error-handling middleware to catch and respond to errors in all routes

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // Log full error on server for debugging, don't expose potentially sensitive info to client
  // eslint-disable-next-line no-console
  console.error('The following error occurred:', {
    name: err.name,
    code: err.code,
    message: err.message,
    stack: err.stack,
  });

  // Catch MongoDB validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Schema validation failed',
      // Map over each error to return array of error messages
      errors: Object.values(err.errors).map((e) => e.message),
    });
  }

  // Catch MongoDB duplicate key errors (i.e email already exists)
  if (err.code === 11000) {
    // Extract fields causing duplicate key error
    const fields = Object.keys(err.keyPattern);
    return res.status(409).json({
      success: false,
      message: 'Duplicate key violation',
      errors: fields.map((field) => `User with field: ${field} already exists`),
    });
  }

  // Catch MongoDB cast errors (when invalid ObjectId is used)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      // err.value returns invalid value, err.path returns object path
      message: `Cast error: value (${err.value}) is not valid for ${err.path}`,
      errors: [err.message],
    });
  }

  // JWT Invalid Token Error
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Token is invalid. Please log in again.',
    });
  }

  // JWT Token Expired Error
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Your session has expired. Please log in again to refresh.',
    });
  }

  // Custom Errors for Friendship model validations
  if (err.name === 'InvalidUserIdError') {
    return res.status(400).json({
      success: false,
      message: 'One or both user IDs are provided are invalid.',
    });
  }

  if (err.name === 'SelfFriendError') {
    return res.status(400).json({
      success: false,
      message: 'A user cannot send a friend request to themselves.',
    });
  }

  /* Custom application errors for raising new errors or reusable custom errors
  normal error objects don't have statusCode property, that's attached before calling next */
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  // Catch-all for any other errors
  return res.status(500).json({
    success: false,
    message: 'An unexpected error occurred. Please try again later.',
  });
};

export default errorHandler;
