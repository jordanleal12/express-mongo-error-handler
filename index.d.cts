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
declare function createErrorHandler(options?: {
  logErrors?: boolean;
  exposeStack?: boolean;
  logger?: Function;
  customHandlers?: Array<Function>;
}): (err: any, req: any, res: any, next: any) => any;

export = createErrorHandler;
