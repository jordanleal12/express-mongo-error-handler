// Centralized error-handling middleware to catch and respond to errors in all routes

/**
 * express-mongo-error-handler
 * ==============================
 * Create a configurable error-handling middleware for use with Express.js, designed for the
 * backend of MERN applications.
 *
 * Why use this middleware:
 * - Provides default error handling for common express API setups (Express, Mongoose, JWT, Zod)
 * - Prevents leaking of stack traces and sensitive data to clients in production
 * - Consistent response format structure ensures easy front end integration
 * - Works with custom errors, http-errors package, Zod, etc.
 * - Configurable logging and stack trace exposure with environment based defaults
 * - Uses console.error by default but allows custom logger function
 * - Accepts array of custom error handlers for additional flexibility
 *
 * Installation: npm install express-mongo-error-handler
 *
 * @param {Object} options - Configuration options object
 * @param {boolean} [options.logErrors=notProduction] - Option to log error details to logger
 * @param {boolean} [options.exposeStack=false] - Option to expose stack traces in error logging
 * @param {Function} [options.logger=console.error] - Accepts custom logger function for error logging
 * @param {Array<Function>} [options.customHandlers=[]] - Array of custom error handler functions
 * @returns {Function} Express error-handling middleware (err, req, res, next)
 */
const createErrorHandler = (options = {}) => {
  // Check for development or test environment (false without environment variables for safety)
  const notProduction = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";

  // Set default options with destructuring for configuration
  const {
    logErrors = notProduction,
    exposeStack = false,
    logger = console.error,
    customHandlers = [],
  } = options;

  // Return configured middleware function
  return (err, req, res, next) => {
    // Log full error on server for debugging, don't expose potentially sensitive info to client
    if (logErrors) {
      logger("The following error occurred:", {
        name: err.name,
        code: err.code,
        message: err.message,
        // Add stack trace to log if available and exposeStack set to true
        ...(exposeStack && err.stack ? { stack: err.stack } : {}),
      });
    }

    // Run error through any custom error handlers first
    for (const handler of customHandlers) {
      const result = handler(err, req, res);
      if (result) return result; // Will return response and exit if custom handler catches error
    }

    // --------------------------------------------------------------------------------------------
    // EXPRESS ERRORS
    //---------------------------------------------------------------------------------------------

    /* Catch SyntaxError from invalid JSON caught by JSON parsing middleware. Check for 400 and 'body'
    in error so we don't catch other SyntaxErrors by mistake */
    if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
      return res.status(400).json({
        success: false,
        message: "Invalid JSON payload in request",
        errors: ["The request body JSON is invalid and could not be parsed"],
      });
    }

    // Request body data is too large (default limit is 100kb)
    if (err.type === "entity.too.large") {
      return res.status(413).json({
        success: false,
        message: "JSON payload too large",
        errors: ["The request body data exceeds the maximum size limit"],
      });
    }

    // Catch error thrown when decoding invalid/malformed URI components (e.g. in query params)
    if (err instanceof URIError) {
      return res.status(400).json({
        success: false,
        message: "Malformed URI",
        errors: ["The request URL contains invalid or malformed URI components"],
      });
    }

    // --------------------------------------------------------------------------------------------
    // MONGODB/MONGOOSE ERRORS
    //---------------------------------------------------------------------------------------------

    // Catch MongoDB validation errors
    if (err.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Schema validation failed",
        // Map over each error to return array of error objects with field and message
        errors: Object.values(err.errors).map((e) => ({
          field: e.path,
          message: e.message,
        })),
      });
    }

    // Catch MongoDB duplicate key errors (i.e email already exists)
    if (err.code === 11000) {
      // Extract fields causing duplicate key error
      const fields = Object.keys(err.keyPattern);
      return res.status(409).json({
        success: false,
        message: "Duplicate key violation",
        errors: fields.map((field) => ({
          field,
          message: `Record with field '${field}' already exists`,
        })),
      });
    }

    // Catch MongoDB cast errors (when invalid ObjectId is used)
    if (err.name === "CastError") {
      return res.status(400).json({
        success: false,
        // err.value returns invalid value, err.path returns object path
        message: "Invalid object ID",
        errors: [
          {
            field: err.path,
            message: `Value (${err.value}) is not valid for ${err.path}`,
          },
        ],
      });
    }

    // Catch error thrown by Mongoose when trying to access a record that doesn't exist
    if (err.name === "DocumentNotFoundError") {
      return res.status(404).json({
        success: false,
        message: "Requested resource not found",
        errors: ["The record being accessed does not exist in the database"],
      });
    }

    // Catch errors thrown when trying to add an undefined field with strict option enabled
    if (err.name === "StrictModeError") {
      return res.status(400).json({
        success: false,
        message: "Field not defined in schema",
        errors: [
          {
            field: err.path,
            message: `The field '${err.path}' does not exist in the schema`,
          },
        ],
      });
    }

    // Catch error thrown when trying to modify a record that was modified concurrently
    if (err.name === "VersionError") {
      return res.status(409).json({
        success: false,
        message: "Concurrent modification error",
        errors: [
          {
            field: "_v",
            message:
              "The record being modified has been concurrently modified. Refresh and try again.",
          },
        ],
      });
    }

    // Catch error thrown when trying to save the same document multiple times in parallel
    if (err.name === "ParallelSaveError") {
      return res.status(409).json({
        success: false,
        message: "Parallel save error",
        errors: ["The same document cannot be saved multiple times in parallel"],
      });
    }

    // Catch error thrown when Mongoose cannot connect to MongoDB server
    if (err.name === "MongooseServerSelectionError" || err.name === "MongoNetworkError") {
      return res.status(503).json({
        success: false,
        message: "Database connection error",
        errors: ["Unable to connect to MongoDB database server. Please try again later."],
      });
    }

    // --------------------------------------------------------------------------------------------
    // JWT ERRORS
    //---------------------------------------------------------------------------------------------

    // JWT Invalid Token Error
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
        errors: ["Provided token is invalid. Please log in again."],
      });
    }

    // JWT Token Expired Error
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Expired token",
        errors: ["Your session has expired. Please log in again to refresh."],
      });
    }

    // Catch error thrown when JWT token is valid but not active yet (nbf claim)
    if (err.name === "NotBeforeError") {
      return res.status(401).json({
        success: false,
        message: "Token not active",
        errors: ["The token has yet to be activated. Please try again later."],
      });
    }

    // --------------------------------------------------------------------------------------------
    // ZOD ERRORS
    //---------------------------------------------------------------------------------------------

    // Zod validation errors
    if (err.name === "ZodError") {
      return res.status(400).json({
        success: false,
        message: "Data validation failed",
        errors: err.issues.map((issue) => ({
          field: issue.path.join("."), // Path is an array by default
          message: issue.message,
        })),
      });
    }

    // --------------------------------------------------------------------------------------------
    // CUSTOM APP ERRORS
    //---------------------------------------------------------------------------------------------

    /* Custom application errors for raising new errors or reusable custom errors
    normal error objects don't have statusCode property, that's attached before calling next */
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
        errors: err.errors || [err.message],
      });
    }

    // --------------------------------------------------------------------------------------------
    // CATCH-ALL FOR UNCAUGHT ERRORS
    //---------------------------------------------------------------------------------------------

    return res.status(500).json({
      success: false,
      message: "Unexpected error.",
      errors: ["An unexpected error occurred. Please try again later."],
    });
  };
};

export default createErrorHandler;
