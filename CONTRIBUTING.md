# Contributing

Thank you for considering contributing to my project! This is my first NPM package, so contributions are more than welcome.

## How to Contribute

1. Create a fork of the repository
2. Create a feature or bugfix branch (e.g. `git checkout -b feature/example-feature`)
3. Create changes and tests for said changes, running tests with `npm run test`
4. Commit and push changes to branch
5. Open a pull request, with the markdown including details on:
   - What: A brief description of the feature
   - Why: An explanation of why the feature should be added
   - How: Explain how you have implemented the feature
   - Dependencies: List any new dependencies and why you used them

Example:

```md
## WHAT

Added feature that allows for integration of custom error handlers with the createErrorHandler middleware function, and updated tests and readme documentation to reflect new feature

## WHY

To allow users to have easy integration of their own custom error handlers (e.g. to catch errors thrown by third party libraries such as stripe or multer), while still applying our secure by default configuration options to the newly integrated error handlers.

## HOW

- Added `customHandlers` parameter to `createErrorHandler` that accepts an array of custom error handler functions and updated jsdoc description
- Added `for` loop to `createErrorHandler` to iterate over each error handler function in `customHandlers` array, exiting early if error is caught by any
- Updated readme documentation to include example usage
- Updated `createErrorHandler.test.js` with new unit tests to test functionality works as expected
- Additional small changes to readme

## NEW DEPENDENCIES

- N/A
```

## Questions?

Email <16386@coderacademy.edu.au> for any questions on contributions
