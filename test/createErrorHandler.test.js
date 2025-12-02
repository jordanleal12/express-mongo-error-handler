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
});
