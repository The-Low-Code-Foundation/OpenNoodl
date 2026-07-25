#!/usr/bin/env node
/**
 * nodegx-backend CLI shim.
 *
 * Runs the compiled CLI from dist/. Build first with `npm run build` (tsc).
 * Kept as a tiny JS launcher so the bin has zero runtime toolchain dependency
 * (no ts-node) — a deploy target runs plain compiled JS.
 */
'use strict';

const path = require('path');

const distCli = path.join(__dirname, '..', 'dist', 'cli.js');

let cli;
try {
  cli = require(distCli);
} catch (e) {
  process.stderr.write(
    '[nodegx-backend] Could not load dist/cli.js. Build the package first:\n' +
      '  npm run build   (from packages/nodegx-backend)\n' +
      `  underlying error: ${e && e.message ? e.message : e}\n`
  );
  process.exit(1);
}

cli
  .main(process.argv.slice(2))
  .catch((err) => {
    process.stderr.write(`[nodegx-backend] FATAL: ${err && err.message ? err.message : err}\n`);
    process.exit(1);
  });
