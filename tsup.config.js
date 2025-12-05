import { defineConfig } from "tsup";

// Configuration options for tsup bundler
export default defineConfig({
  entry: ["index.js"], // Entry point (main source file)

  format: ["esm", "cjs"], // Output ESM and CJS for compatibility of both

  outDir: "dist", // Sets output directory to 'dist' (this is default anyway)

  clean: true, // Delete existing 'dist' folder before each build

  external: [], // No dependencies are bundled (users install separately)

  target: "node16", // Targets compatibility with Node.js 16 and above

  dts: false, // Custom ts files exist so don't generate new ones

  footer: {
    // This allows default import with CJS
    js: "if (typeof module !== 'undefined' && module.exports.default) { module.exports = module.exports.default; }",
  },
});
