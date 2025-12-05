# :pushpin: Express Mongo Error Handler

[![npm version](https://img.shields.io/npm/v/express-mongo-error-handler.svg)](https://www.npmjs.com/package/express-mongo-error-handler) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) ![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue) ![ESM](https://img.shields.io/badge/ESM-Supported-green) ![CommonJS](https://img.shields.io/badge/CommonJS-Supported-green)

A lightweight, configurable error handling middleware, designed specifically for MERN backends. Simple and easy to use, catch and format all expected errors into consistent and client friendly responses!

Preventing accidental exposure of stack traces right out of the box, this middleware package catches and formats errors from Express, Mongoose/MongoDB, JWT, ZOD and custom app errors. Customizable configurations allow extremely easy to set options for console logging, using external logging packages (e.g Winston, Pino etc.), logging stack traces, and incorporating your own custom error handlers.

## :clipboard: Contents

### In This Document

1. [:jigsaw: Features](#jigsaw-features)
2. [:package: Installation](#package-installation)
3. [:gear: Configuration Options](#gear-configuration-options)
4. [:computer: Usage](#computer-usage)
5. [:outbox_tray: Response Format](#outbox_tray-response-format)
6. [:warning: Handled Error Types](#warning-handled-error-types)
7. [:writing_hand: Custom Error Usage](#writing_hand-custom-error-usage)
8. [:rotating_light: Unhandled Errors](#rotating_light-unhandled-errors)
9. [:test_tube: Testing](#test_tube-testing)
10. [:link: Links](#link-links)

### Other Documents

1. [:shield: SECURITY](/SECURITY.md)
2. [:scroll: LICENSE](/LICENSE)
3. [:busts_in_silhouette: CONTRIBUTING](/CONTRIBUTING.md)

---

## :jigsaw: Features

- :lock: **Prevents stack trace leaks** - Errors are formatted into client friendly stack free messages, with optional logging of stack traces.
- :package: **Zero configuration** - Sensible default configurations with logging based on current environment
- :toolbox: **Easy Configuration** - Set logging, stack trace exposure, and custom logger options
- :dart: **Consistent responses** - Uses the popular response format (success, message, errors), allowing for easy client integration
- :globe_with_meridians: **Environment-aware** - Automatically adjusts behavior based on `NODE_ENV` environment variables
- :white_check_mark: **Comprehensive coverage** - Handles Express, Mongoose, JWT, and Zod errors
- :handshake: **Accepts custom error-handlers** - Provide your own error handlers in an array for seamless integration
- :mechanical_arm: **ESM, CommonJS and TypeScript support** - Supports ESM and CJS imports, with TS type support

---

## :package: Installation

```bash
npm install express-mongo-error-handler
```

---

## :gear: Configuration Options

| Option           | Type              | Default                                       | Description                                                      |
| ---------------- | ----------------- | --------------------------------------------- | ---------------------------------------------------------------- |
| `logErrors`      | `Boolean`         | `true` in test/development, `false` otherwise | `true` enables error logging                                     |
| `exposeStack`    | `Boolean`         | `false`                                       | `true` includes stack traces in logs                             |
| `logger`         | `Function`        | `console.error`                               | Enables use of custom logging packages (examples in usage)       |
| `customHandlers` | `Array<Function>` | `[]`                                          | Enables integration of custom error handlers (examples in usage) |

---

## :computer: Usage

### Default Usage

```js
import express from "express";
import createErrorHandler from "express-mongo-error-handler"; // ESM
// OR
const createErrorHandler = require("express-mongo-error-handler"); // CJS

const app = express();

// Your routes here
app.get("/api/example", (req, res) => {
  /* Route logic */
});

/* ADD LAST! After all existing middleware and routes. 
Default configuration logs errors only in test or development environments. Stack traces are not
logged by default, and the default logger used is console.error() */
const errorHandler = createErrorHandler();
app.use(errorHandler);
```

### Custom Usage

#### Always Log Errors With Stack Traces Exposed

```js
const errorHandler = createErrorHandler({
  logErrors: true, // Default true in 'test' and 'development' environments, false in 'production'
  exposeStack: true, // Default value is false
});
app.use(errorHandler);
```

#### Usage With Logging Packages

**Winston:**

```js
import winston from "winston";

const logger = winston.createLogger({
  /* config */
});

const errorHandler = createErrorHandler({ logger: logger.error.bind(logger) });
app.use(errorHandler);
```

**Pino:**

Pino expects reversed order of message and data

```js
import pino from "pino";

const logger = pino({
  /* config */
});

// Swap order for message and data
const errorHandler = createErrorHandler({ logger: (msg, data) => logger.error(data, msg) });
app.use(errorHandler);
```

**Bunyan:**

Bunyan expects reversed order of message and data

```js
import bunyan from "bunyan";

const logger = bunyan.createLogger({
  /* config */
});

// Swap order for message and data
const errorHandler = createErrorHandler({ logger: (msg, data) => logger.error(data, msg) });
app.use(errorHandler);
```

#### Disable All Logging

```js
const errorHandler = createErrorHandler({ logErrors: false });
app.use(errorHandler);
```

#### Integrate Custom Error Handlers

Custom handlers passed to middleware will run before built-in error handling

```js
// Array of custom error handler functions for adding additional package compatibility
const customHandlers = [
  (err, req, res) => {
    // Example 'stripe' package error handler
    if (err.type === "StripeCardError") {
      return res.status(402).json({
        success: false,
        message: "Payment failed",
        errors: [err.message],
      });
    }
  },
  // Each 'if' block can be a separate function or wrapped in a single function as desired
  (err, req, res) => {
    // Example 'multer' package error handler
    if (err.name === "MulterError") {
      return res.status(400).json({
        success: false,
        message: "File upload error",
        errors: [err.message],
      });
    }
  },
  /* Additional error handlers as required */
];
let errorHandler = createErrorHandler({ customHandlers }); // Pass handlers to config
app.use(errorHandler);
```

---

## :outbox_tray: Response Format

All errors are formatted into a consistent, client-friendly structure. Errors are always in an array:

```json
{
  "success": false,
  "message": "Basic error message",
  "errors": ["More detailed error message in array"]
}
```

Many mongoose error messages are objects with a `field` and `message` property:

```json
{
  "success": false,
  "message": "Duplicate key violation",
  "errors": [
    { "field": "email", "message": "Record with field 'email' already exists" },
    { "field": "username", "message": "Record with field 'username' already exists" }
  ]
}
```

---

## :warning: Handled Error Types

### Express Errors

| Error                | Status | When it occurs                           |
| -------------------- | ------ | ---------------------------------------- |
| `SyntaxError` (JSON) | 400    | Malformed/invalid JSON in request body   |
| `entity.too.large`   | 413    | Request body data exceeds max size limit |
| `URIError`           | 400    | Malformed/invalid URI component encoding |

### Mongoose/MongoDB Errors

| Error                          | Status | When it occurs                                   |
| ------------------------------ | ------ | ------------------------------------------------ |
| `ValidationError`              | 400    | Mongoose schema validation violation             |
| Duplicate key (`11000`)        | 409    | Unique constraint violation                      |
| `CastError`                    | 400    | Invalid ObjectId or type cast                    |
| `DocumentNotFoundError`        | 404    | Document not found (e.g. when using `.orFail()`) |
| `StrictModeError`              | 400    | Unknown schema field when using strict mode      |
| `VersionError`                 | 409    | Concurrent modification conflict                 |
| `ParallelSaveError`            | 409    | Parallel save on same document                   |
| `MongooseServerSelectionError` | 503    | Database connection failure                      |
| `MongoNetworkError`            | 503    | Database network error                           |

### JWT Errors

| Error               | Status | When it occurs          |
| ------------------- | ------ | ----------------------- |
| `JsonWebTokenError` | 401    | Invalid/malformed token |
| `TokenExpiredError` | 401    | Token has expired       |
| `NotBeforeError`    | 401    | Token not yet active    |

### Zod Errors

| Error      | Status | When it occurs              |
| ---------- | ------ | --------------------------- |
| `ZodError` | 400    | Zod schema validation fails |

### Custom Application Errors

Errors with a `statusCode` property are handled automatically. Example:

```js
// Creating custom error in route
const error = new Error("Resource not found");
error.statusCode = 404;
// errors array is optional, automatically attaches error message if missing
error.errors = ["The requested user does not exist"];
throw error;
```

### Catch-All

Any missed or unhandled errors are still caught with generic catch all, returning 500 status.

---

## :writing_hand: Custom Error Usage

Any errors thrown with a `statusCode` property will be caught and handled. Example:

```js
// Creation of custom error class. Must contain statusCode property to be handled appropriately
class CustomError extends Error {
  constructor(message, statusCode, errors = []) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors.length ? errors : [message];
  }
}

// Example usage in routes
app.get("/api/users/:id", async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      throw new CustomError("User not found", 404);
    }
    res.json(user);
  } catch (error) {
    next(error);
  }
});
```

---

## :rotating_light: Unhandled Errors

Some errors are not runtime issues and are deliberately ignored. Catching these could mask issues
that should be caught and fixed in development, such as:

- `MissingSchemaError` - Schema hasn't been properly configured
- `OverwriteModelError` - Naming conflict between models
- `StrictPopulateError` - Schema field being populated isn't defined or allowed
- `DivergentArrayError` - Caused by conflicting array modifications. Indicates bad update logic

---

## :test_tube: Testing

```bash
npm run test
```

---

## :link: Links

- [GitHub Repository](https://github.com/jordanleal12/express-mongo-error-handler)
- [NPM Package](https://www.npmjs.com/package/express-mongo-error-handler)
- [Issue Tracker](https://github.com/jordanleal12/express-mongo-error-handler/issues)
