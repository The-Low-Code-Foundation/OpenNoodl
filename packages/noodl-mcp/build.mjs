/**
 * Bundles the `noodl-mcp` server into a self-contained CJS executable.
 *
 * The pure format engines (io/, schemas/, validation/) are bundled from
 * noodl-editor sources, and the enriched node catalog JSON is inlined — so the
 * artifact runs standalone with only Node ≥ 18 present, and there is a single
 * source of truth for the format logic (no duplication).
 *
 * ⚠️ **`nodegx-observe` is not built here any more.** It lives in
 * `packages/nodegx-observe` (moved 2026-08-02, Richard's call). The two never
 * shared a code path; they shared this package for packaging convenience, and
 * the spec's standing warning is that the two must not be *confused* — which one
 * `npm install` producing both worked directly against.
 */
import { createRequire } from 'node:module';
import path from 'node:path';

import esbuild from 'esbuild';

const common = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  sourcemap: false,
  logLevel: 'info'
};

await esbuild.build({
  ...common,
  entryPoints: ['src/cli.ts'],
  target: 'node18',
  outfile: 'dist/noodl-mcp.cjs'
});

/**
 * CN-003 — the headless kit extractor, bundled as its own artifact.
 *
 * It is a second bundle rather than part of the server because it is *spawned*:
 * a kit's `index.js` is project code that runs at import time, and a child
 * process is what keeps a throwing or register-mutating kit away from the
 * server. See `src/kitExtract/entry.js`.
 *
 * 🔴 It must land in `dist/`. `scripts/node-catalog/` is where its sibling (the
 * built-in catalog generator) lives, and that directory is outside every shipped
 * package's `files`/`build.files` — an extractor there works in a checkout and
 * is missing from the packaged app.
 *
 * The build options come from the catalog generator's own bundler so the two
 * extractors cannot drift into observing different node libraries. Importing
 * from `scripts/` is fine *here*: this runs at build time in the checkout, and
 * esbuild inlines what it reaches.
 */
const require = createRequire(import.meta.url);
const { extractorBuildOptions } = require('../../scripts/node-catalog/lib/bundle.js');

await esbuild.build({
  ...extractorBuildOptions(
    path.resolve('src/kitExtract/entry.js'),
    path.resolve('dist/kit-extract.cjs')
  ),
  target: 'node18',
  logLevel: 'info'
});
