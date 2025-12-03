# Express Mongo Error Handler &middot; [![npm version](https://img.shields.io/npm/v/express-mongo-error-handler.svg)](https://www.npmjs.com/package/express-mongo-error-handler) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A lightweight, configurable error handling middleware, designed specifically for MERN backends. Simple and easy to use, catch and format all expected errors into consistent and client friendly responses!

Preventing accidental exposure of stack traces right out of the box, this middleware package catches and formats errors from Express, Mongoose/MongoDB, JWT, ZOD and custom app errors. Customizable configurations allow extremely easy to set options for console logging, using external logging packages (e.g Winston, Pino etc.) and logging stack traces.

## Contents

### In This Document

1. [Features](#features)
2. [Installation](#installation)
3. [Configuration Options](#configuration-options)
4. [Usage](#usage)
5. [Response Format](#response-format)
6. [Handled Error Types](#handled-error-types)
7. [Custom Error Usage](#custom-error-usage)
8. [Unhandled Errors](#unhandled-errors)
9. [Testing](#testing)
10. [Links](#links)

### Other Documents

1. [SECURITY](/SECURITY.md)
2. [LICENSE](/LICENSE)
3. [CONTRIBUTING](/CONTRIBUTING.md)

---

## Features

- 🛡️ **Prevents stack trace leaks** - Errors are formatted into client friendly stack free messages, with optional logging of stack traces.
- 📦 **Zero configuration** - Sensible default configurations with logging based on current environment
- 🔧 **Easy Configuration** - Set logging, stack trace exposure, and custom logger options
- 🎯 **Consistent responses** - Uses the popular response format (success, message, errors), allowing for easy client integration
- 🌐 **Environment-aware** - Automatically adjusts behavior based on `NODE_ENV` environment variables
- ✅ **Comprehensive coverage** - Handles Express, Mongoose, JWT, and Zod errors

---

## Installation

```bash
npm install express-mongo-error-handler
```

---

## Configuration Options

| Option        | Type       | Default                                      | Description                                                |
| ------------- | ---------- | -------------------------------------------- | ---------------------------------------------------------- |
| `logErrors`   | `Boolean`  | `True` in development, `False` in production | `True` enables error logging                               |
| `exposeStack` | `Boolean`  | `false`                                      | `True` includes stack traces in logs                       |
| `logger`      | `Function` | `console.error`                              | Enables use of custom logging packages (examples in usage) |

---

## Usage

### Default Usage

```js
import express from "express";
import createErrorHandler from "express-mongo-error-handler";

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

#### Always log errors with stack traces exposed

```javascript
const errorHandler = createErrorHandler({
  logErrors: true, // Default True in 'test' and 'development' environments, False in 'production'
  exposeStack: true, // Default value is False
});
app.use(errorHandler);
```

#### Usage with logging packages

**Winston:**

```javascript
import winston from "winston";

const logger = winston.createLogger({
  /* config */
});

const errorHandler = createErrorHandler({ logger: logger.error.bind(logger) });
app.use(errorHandler);
```

**Pino:**

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

```js
import bunyan from "bunyan";

const logger = bunyan.createLogger({
  /* config */
});

// Swap order for message and data
const errorHandler = createErrorHandler({ logger: (msg, data) => logger.error(data, msg) });
app.use(errorHandler);
```

#### Disable all logging

```javascript
const errorHandler = createErrorHandler({ logErrors: false });
app.use(errorHandler);
```

---

## Response Format

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

## Handled Error Types

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

```javascript
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

## Custom Error Usage

Any errors thrown with a `statusCode` property will be caught and handled. Example:

```javascript
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

## Unhandled Errors

Some errors are not runtime issues and are deliberately ignored. Catching these could mask issues
that should be caught and fixed in development, such as:

- `MissingSchemaError` - Schema hasn't been properly configured
- `OverwriteModelError` - Naming conflict between models
- `StrictPopulateError` - Schema field being populated isn't defined or allowed
- `DivergentArrayError` - Caused by conflicting array modifications. Indicates bad update logic

---

## Testing

```bash
npm run test
```

---

## Links

- [GitHub Repository](https://github.com/jordanleal12/express-mongo-error-handler)
- [NPM Package](https://www.npmjs.com/package/express-mongo-error-handler)
- [Issue Tracker](https://github.com/jordanleal12/express-mongo-error-handler/issues)
