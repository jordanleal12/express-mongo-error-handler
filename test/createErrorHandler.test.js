import { jest, describe, test, expect, beforeEach } from "@jest/globals";
import createErrorHandler from "../index.js";

// Factory function to mock Express response object
function createMockRes() {
  const res = {
    statusCode: null,
    jsonData: null,
    // Lets us set status and chain json like real res (e.g. mockRes.status(400).json({...}))
    status: function (code) {
      this.statusCode = code;
      return this;
    },
    json: function (data) {
      this.jsonData = data;
      return this;
    },
  };
  return res;
}

// Mock Express request object
const createMockReq = () => ({ method: "GET", originalUrl: "/test" });

// Mock next function
const mockNext = jest.fn();

describe("createErrorHandler error handling middleware tests", () => {
  let errorHandler;
  let mockReq;
  let mockRes;
  let mockLogger;

  // Setup fresh request, response, and logger mocks before each test
  beforeEach(() => {
    mockReq = createMockReq();
    mockRes = createMockRes();
    mockLogger = jest.fn();
    mockNext.mockClear();
  });

  // ----------------------------------------------------------------------------------------------
  // CONFIGURATION TESTS
  //-----------------------------------------------------------------------------------------------

  describe("Configuration Options Customize Middleware Behavior", () => {
    test("should create an express middleware function", () => {
      errorHandler = createErrorHandler();
      expect(typeof errorHandler).toBe("function");
      expect(errorHandler.length).toBe(4); // Check for 4 params (err, req, res, next)
    });

    test("should log errors to console when logErrors is true and no logger provided", () => {
      // Mock console.error to silence and capture output for testing
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      errorHandler = createErrorHandler({ logErrors: true });
      const error = new Error("Test error");

      errorHandler(error, mockReq, mockRes, mockNext);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore(); // Restore console.error
    });

    test("should log errors to provided logger when logErrors is true and logger provided", () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      // Assign value to logger of mockLogger function
      errorHandler = createErrorHandler({
        logErrors: true,
        logger: mockLogger,
      });
      const error = new Error("Test error");

      errorHandler(error, mockReq, mockRes, mockNext);
      expect(mockLogger).toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      consoleErrorSpy.mockRestore(); // Restore console.error
    });

    test("should not log errors when logErrors is set to false", () => {
      errorHandler = createErrorHandler({
        logErrors: false,
        logger: mockLogger,
      });
      const error = new Error("Test error");

      errorHandler(error, mockReq, mockRes, mockNext);
      expect(mockLogger).not.toHaveBeenCalled();
    });

    test("should log stack trace when exposeStack is true and logErrors is true", () => {
      errorHandler = createErrorHandler({
        logErrors: true,
        exposeStack: true,
        logger: mockLogger,
      });
      const error = new Error("Test error"); // Automatically adds stack trace by default

      errorHandler(error, mockReq, mockRes, mockNext);
      expect(mockLogger).toHaveBeenCalledWith(
        "The following error occurred:",
        expect.objectContaining({ stack: expect.any(String) }) // Only need to check stack here
      );
    });

    test("should not log stack trace by default", () => {
      errorHandler = createErrorHandler({
        logErrors: true,
        logger: mockLogger,
      });
      const error = new Error("Test error");

      errorHandler(error, mockReq, mockRes, mockNext);
      expect(mockLogger).toHaveBeenCalledWith(
        "The following error occurred:",
        expect.not.objectContaining({ stack: expect.any(String) })
      );
    });

    test("should default log errors and not stack by default outside production", () => {
      const originalEnv = process.env.NODE_ENV; // Save original NODE_ENV to restore later
      process.env.NODE_ENV = "development"; // Set environment to development

      errorHandler = createErrorHandler({ logger: mockLogger });
      errorHandler(new Error("Test"), mockReq, mockRes, mockNext);
      expect(mockLogger).toHaveBeenCalled();
      process.env.NODE_ENV = originalEnv;
    });

    test("should default not log errors in production environment", () => {
      const originalEnv = process.env.NODE_ENV; // Save original NODE_ENV to restore later
      process.env.NODE_ENV = "production"; // Set environment to production

      errorHandler = createErrorHandler({ logger: mockLogger });
      errorHandler(new Error("Test"), mockReq, mockRes, mockNext);
      expect(mockLogger).not.toHaveBeenCalled();
      process.env.NODE_ENV = originalEnv;
    });
  });

  // ----------------------------------------------------------------------------------------------
  // EXPRESS ERROR HANDLING TESTS
  //-----------------------------------------------------------------------------------------------

  describe("Express Errors Are Handled Correctly", () => {
    beforeEach(() => {
      // Disable logging so we don't have to mock console every time
      errorHandler = createErrorHandler({ logErrors: false });
    });

    test("should catch SyntaxError caused by malformed JSON", () => {
      const err = new SyntaxError("Unexpected token"); // Simulate SyntaxError with 400 & json body
      err.status = 400;
      err.body = "{ invalid json }";

      errorHandler(err, mockReq, mockRes, mockNext);
      expect(mockRes.statusCode).toBe(400);
      expect(mockRes.jsonData).toEqual({
        success: false,
        message: "Invalid JSON payload in request",
        errors: ["The request body JSON is invalid and could not be parsed"],
      });
    });

    test("should not catch SyntaxError without 400 status or json body", () => {
      const err = new SyntaxError("Some other syntax error");
      err.status = 400; // Test with status but no json body

      errorHandler(err, mockReq, mockRes, mockNext);
      expect(mockRes.statusCode).toBe(500); // Should be caught by catch-all

      mockRes = createMockRes(); // Create fresh response mock
      err.status = null; // Set status to null and add body
      err.body = "{ invalid json }";

      errorHandler(err, mockReq, mockRes, mockNext);
      expect(mockRes.statusCode).toBe(500); // Should be caught by catch-all
    });

    test("should catch 'entity.too.large' error", () => {
      const err = new Error("Request entity too large");
      err.type = "entity.too.large";

      errorHandler(err, mockReq, mockRes, mockNext);
      expect(mockRes.statusCode).toBe(413);
      expect(mockRes.jsonData).toEqual({
        success: false,
        message: "JSON payload too large",
        errors: ["The request body data exceeds the maximum size limit"],
      });
    });

    test("should catch URIError", () => {
      const err = new URIError("URI malformed");

      errorHandler(err, mockReq, mockRes, mockNext);
      expect(mockRes.statusCode).toBe(400);
      expect(mockRes.jsonData).toEqual({
        success: false,
        message: "Malformed URI",
        errors: ["The request URL contains invalid or malformed URI components"],
      });
    });
  });

  // ----------------------------------------------------------------------------------------------
  // MONGOOSE/MONGODB ERROR HANDLING TESTS
  //-----------------------------------------------------------------------------------------------

  describe("Mongoose/MongoDB Errors Are Handled Correctly", () => {
    beforeEach(() => {
      errorHandler = createErrorHandler({ logErrors: false });
    });

    test("should catch mongoose ValidationError", () => {
      // Mock Mongoose ValidationError so we don't have to import Mongoose
      const err = {
        name: "ValidationError",
        errors: {
          email: { path: "email", message: "Email is required" },
          name: { path: "name", message: "Name must be at least 2 characters" },
        },
      };

      errorHandler(err, mockReq, mockRes, mockNext);
      expect(mockRes.statusCode).toBe(400);
      expect(mockRes.jsonData).toEqual({
        success: false,
        message: "Schema validation failed",
        errors: [
          { field: "email", message: "Email is required" },
          { field: "name", message: "Name must be at least 2 characters" },
        ],
      });
    });

    test("should catch mongoose duplicate key error", () => {
      const err = { code: 11000, keyPattern: { email: 1 } };

      errorHandler(err, mockReq, mockRes, mockNext);
      expect(mockRes.statusCode).toBe(409);
      expect(mockRes.jsonData).toEqual({
        success: false,
        message: "Duplicate key violation",
        errors: [{ field: "email", message: "Record with field 'email' already exists" }],
      });
    });

    test("should catch mongoose duplicate key error with multiple fields", () => {
      const err = { code: 11000, keyPattern: { email: 1, username: 1 } };

      errorHandler(err, mockReq, mockRes, mockNext);
      expect(mockRes.statusCode).toBe(409);
      expect(mockRes.jsonData.errors).toHaveLength(2);
    });

    test("should catch mongoose CastError", () => {
      const err = { name: "CastError", path: "_id", value: "invalid-id" };

      errorHandler(err, mockReq, mockRes, mockNext);
      expect(mockRes.statusCode).toBe(400);
      expect(mockRes.jsonData).toEqual({
        success: false,
        message: "Invalid object ID",
        errors: [{ field: "_id", message: "Value (invalid-id) is not valid for _id" }],
      });
    });

    test("should catch mongoose DocumentNotFoundError", () => {
      const err = { name: "DocumentNotFoundError" };

      errorHandler(err, mockReq, mockRes, mockNext);
      expect(mockRes.statusCode).toBe(404);
      expect(mockRes.jsonData).toEqual({
        success: false,
        message: "Requested resource not found",
        errors: ["The record being accessed does not exist in the database"],
      });
    });

    test("should catch mongoose StrictModeError", () => {
      const err = { name: "StrictModeError", path: "unknownField" };

      errorHandler(err, mockReq, mockRes, mockNext);
      expect(mockRes.statusCode).toBe(400);
      expect(mockRes.jsonData).toEqual({
        success: false,
        message: "Field not defined in schema",
        errors: [
          {
            field: "unknownField",
            message: "The field 'unknownField' does not exist in the schema",
          },
        ],
      });
    });

    test("should catch mongoose VersionError", () => {
      const err = { name: "VersionError" };

      errorHandler(err, mockReq, mockRes, mockNext);
      expect(mockRes.statusCode).toBe(409);
      expect(mockRes.jsonData).toEqual({
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
    });

    test("should catch mongoose ParallelSaveError", () => {
      const err = { name: "ParallelSaveError" };

      errorHandler(err, mockReq, mockRes, mockNext);
      expect(mockRes.statusCode).toBe(409);
      expect(mockRes.jsonData).toEqual({
        success: false,
        message: "Parallel save error",
        errors: ["The same document cannot be saved multiple times in parallel"],
      });
    });

    test("should catch mongoose MongooseServerSelectionError", () => {
      const err = { name: "MongooseServerSelectionError" };

      errorHandler(err, mockReq, mockRes, mockNext);
      expect(mockRes.statusCode).toBe(503);
      expect(mockRes.jsonData).toEqual({
        success: false,
        message: "Database connection error",
        errors: ["Unable to connect to MongoDB database server. Please try again later."],
      });
    });

    test("should catch mongoose MongoNetworkError", () => {
      const err = { name: "MongoNetworkError" };

      errorHandler(err, mockReq, mockRes, mockNext);
      expect(mockRes.statusCode).toBe(503);
      expect(mockRes.jsonData).toEqual({
        success: false,
        message: "Database connection error",
        errors: ["Unable to connect to MongoDB database server. Please try again later."],
      });
    });
  });

  // ----------------------------------------------------------------------------------------------
  // JWT ERROR HANDLING TESTS
  //-----------------------------------------------------------------------------------------------

  describe("JWT Errors Are Handled Correctly", () => {
    beforeEach(() => {
      errorHandler = createErrorHandler({ logErrors: false });
    });

    test("should catch JsonWebTokenError", () => {
      // Mock JsonWebTokenError so we don't have to import jsonwebtoken
      const err = { name: "JsonWebTokenError", message: "jwt malformed" };

      errorHandler(err, mockReq, mockRes, mockNext);
      expect(mockRes.statusCode).toBe(401);
      expect(mockRes.jsonData).toEqual({
        success: false,
        message: "Invalid token",
        errors: ["Provided token is invalid. Please log in again."],
      });
    });

    test("should catch TokenExpiredError", () => {
      const err = { name: "TokenExpiredError", message: "jwt expired" };

      errorHandler(err, mockReq, mockRes, mockNext);
      expect(mockRes.statusCode).toBe(401);
      expect(mockRes.jsonData).toEqual({
        success: false,
        message: "Expired token",
        errors: ["Your session has expired. Please log in again to refresh."],
      });
    });

    test("should catch NotBeforeError", () => {
      const err = { name: "NotBeforeError", message: "jwt not active" };

      errorHandler(err, mockReq, mockRes, mockNext);
      expect(mockRes.statusCode).toBe(401);
      expect(mockRes.jsonData).toEqual({
        success: false,
        message: "Token not active",
        errors: ["The token has yet to be activated. Please try again later."],
      });
    });
  });

  // ----------------------------------------------------------------------------------------------
  // ZOD ERROR HANDLING TESTS
  //-----------------------------------------------------------------------------------------------

  describe("Zod Errors Are Handled Correctly", () => {
    beforeEach(() => {
      errorHandler = createErrorHandler({ logErrors: false });
    });

    test("should catch basic ZodError with single issue", () => {
      const err = {
        name: "ZodError",
        issues: [{ path: ["email"], message: "Invalid email format" }],
      };

      errorHandler(err, mockReq, mockRes, mockNext);
      expect(mockRes.statusCode).toBe(400);
      expect(mockRes.jsonData).toEqual({
        success: false,
        message: "Data validation failed",
        errors: [{ field: "email", message: "Invalid email format" }],
      });
    });

    test("should catch ZodError with multiple issues", () => {
      const err = {
        name: "ZodError",
        issues: [
          { path: ["email"], message: "Invalid email format" },
          {
            path: ["password"],
            message: "Password must be at least 8 characters",
          },
          { path: ["age"], message: "Age must be a positive number" },
        ],
      };

      errorHandler(err, mockReq, mockRes, mockNext);
      expect(mockRes.statusCode).toBe(400);
      expect(mockRes.jsonData.errors).toHaveLength(3);
    });

    test("should catch ZodError with nested path", () => {
      const err = {
        name: "ZodError",
        issues: [{ path: ["user", "profile", "email"], message: "Invalid email" }],
      };

      errorHandler(err, mockReq, mockRes, mockNext);
      // Check multiple paths are concatted with dots
      expect(mockRes.jsonData.errors[0].field).toBe("user.profile.email");
    });

    test("should catch ZodError with empty path", () => {
      const err = {
        name: "ZodError",
        issues: [{ path: [], message: "Invalid input" }],
      };

      errorHandler(err, mockReq, mockRes, mockNext);
      expect(mockRes.jsonData.errors[0].field).toBe("");
    });
  });

  // ----------------------------------------------------------------------------------------------
  // CUSTOM APPLICATION ERROR HANDLING TESTS
  //-----------------------------------------------------------------------------------------------

  describe("Custom Application Errors Should Be Handled Correctly", () => {
    beforeEach(() => {
      errorHandler = createErrorHandler({ logErrors: false });
    });

    test("should handle basic custom error with statusCode and message", () => {
      const err = { statusCode: 403, message: "Access denied" };

      errorHandler(err, mockReq, mockRes, mockNext);
      expect(mockRes.statusCode).toBe(403);
      expect(mockRes.jsonData).toEqual({
        success: false,
        message: "Access denied",
        errors: ["Access denied"],
      });
    });

    test("should handle custom error with statusCode, message and errors array", () => {
      const err = {
        statusCode: 422,
        message: "Validation failed",
        errors: ["Field A is invalid", "Field B is required"],
      };

      errorHandler(err, mockReq, mockRes, mockNext);
      expect(mockRes.statusCode).toBe(422);
      expect(mockRes.jsonData).toEqual({
        success: false,
        message: "Validation failed",
        errors: ["Field A is invalid", "Field B is required"],
      });
    });
  });

  // ----------------------------------------------------------------------------------------------
  // CATCH-ALL ERROR HANDLING TESTS
  //-----------------------------------------------------------------------------------------------

  describe("Catch-All Error Handler Catches Unexpected Errors", () => {
    beforeEach(() => {
      errorHandler = createErrorHandler({ logErrors: false });
    });

    test("should catch generic Error with no name, code or specific type", () => {
      const err = new Error("Something went wrong");

      errorHandler(err, mockReq, mockRes, mockNext);
      expect(mockRes.statusCode).toBe(500);
      expect(mockRes.jsonData).toEqual({
        success: false,
        message: "Unexpected error.",
        errors: ["An unexpected error occurred. Please try again later."],
      });
    });

    test("should catch errors with unknown error types", () => {
      const err = { unknownProperty: "value" };

      errorHandler(err, mockReq, mockRes, mockNext);
      expect(mockRes.statusCode).toBe(500);
      expect(mockRes.jsonData.success).toBe(false);
    });

    test("should catch null/undefined errors", () => {
      const err = { name: null, message: undefined };

      errorHandler(err, mockReq, mockRes, mockNext);
      expect(mockRes.statusCode).toBe(500);
      expect(mockRes.jsonData.success).toBe(false);
    });
  });

  // ----------------------------------------------------------------------------------------------
  // CUSTOM HANDLER TESTS
  //-----------------------------------------------------------------------------------------------

  describe("Custom Handlers Are Executed Correctly", () => {
    // Create customHandler array to be passed to createErrorHandler
    const customHandlers = [
      (err, req, res) => {
        if (err.type === "StripeCardError") {
          return res.status(402).json({
            success: false,
            message: "Payment failed",
            errors: [err.message],
          });
        }

        if (err.name === "MulterError") {
          return res.status(400).json({
            success: false,
            message: "File upload error",
            errors: [err.message],
          });
        }
      },
    ];
    // Create error handler with custom handlers to be used in tests
    let errorHandler = createErrorHandler({ logErrors: false, customHandlers });

    test("should catch and respond to errors in customHandlers array", () => {
      // Simulate StripeCardError (not in built-in handlers, only in customHandlers)
      const err = { type: "StripeCardError", message: "Your card's expiration year is invalid." };
      errorHandler(err, mockReq, mockRes, mockNext); // Call error handler with stripe error
      expect(mockRes.statusCode).toBe(402);
      expect(mockRes.jsonData).toEqual({
        success: false,
        message: "Payment failed",
        errors: ["Your card's expiration year is invalid."],
      });
    });

    test("should catch error with default handlers when not caught by custom handlers", () => {
      const err = {
        name: "ValidationError",
        errors: { email: { path: "email", message: "Required" } },
      };
      errorHandler(err, mockReq, mockRes, mockNext);
      expect(mockRes.statusCode).toBe(400); // Caught by built-in ValidationError handler
      expect(mockRes.jsonData.message).toBe("Schema validation failed");
    });

    test("should pass error to subsequent custom handlers when not caught by previous", () => {
      // Should be caught by second custom handler in array (MulterError)
      const err = { name: "MulterError", message: "File too large" };
      errorHandler(err, mockReq, mockRes, mockNext);
      expect(mockRes.jsonData.message).toBe("File upload error");
    });

    test("should be caught by catch-all when no custom or built-in handlers match", () => {
      const err = { name: "UnknownError" };
      errorHandler(err, mockReq, mockRes, mockNext);
      expect(mockRes.statusCode).toBe(500); // Caught by catch-all
      expect(mockRes.jsonData.message).toBe("Unexpected error.");
    });

    test("should work with empty customHandlers array", () => {
      // Create fresh error handler with no custom handlers
      errorHandler = createErrorHandler({ logErrors: false, customHandlers: [] });
      const err = new Error("Test error");
      errorHandler(err, mockReq, mockRes, mockNext);
      expect(mockRes.statusCode).toBe(500); // Caught by catch-all
    });
  });
});
