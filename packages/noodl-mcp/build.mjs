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
import { copyFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import esbuild from 'esbuild';

const common = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  sourcemap: false,
  logLevel: 'info',
  /**
   * HLS-008 — the third of the three resolvers that have to agree, after
   * `tsconfig.json`'s `paths` and `jest.config.js`'s `moduleNameMapper`.
   *
   * 🔴 Without it esbuild follows `@nodegx/export`'s `main` into
   * `../nodegx-export/dist/index.cjs`, and the server would ship whatever the
   * exporter looked like the last time somebody ran `npm run build` in a
   * sibling package. The editor already carries this alias in its own three
   * resolvers for the same reason; this package is now the second consumer.
   */
  alias: { '@nodegx/export': path.resolve('../nodegx-export/src/index.ts') }
};

await esbuild.build({
  ...common,
  entryPoints: ['src/cli.ts'],
  target: 'node18',
  outfile: 'dist/noodl-mcp.cjs'
});

/**
 * HLS-008 — the node catalog travels with the server, because `export_react` reads it.
 *
 * 🔴 **This is not bookkeeping; without it the tool is dead in the shipped app.**
 * `@nodegx/export`'s `loadCatalog()` reads `node-catalog.json` from disk, trying
 * `__dirname/node-catalog.json` (the packaged copy) then
 * `__dirname/../../noodl-types/src/node-catalog.json` (the in-repo source). Bundled into
 * `dist/noodl-mcp.cjs`, `__dirname` is this package's `dist/` — and the in-repo fallback happens
 * to resolve, because `packages/noodl-mcp/dist` sits at the same depth as
 * `packages/nodegx-export/src`. **In a checkout it therefore works by coincidence.**
 *
 * In the packaged app it does not. `noodl-editor`'s `extraResources` copies exactly one file —
 * `dist/noodl-mcp.cjs` → `Resources/noodl-mcp/noodl-mcp.cjs` — so `__dirname` is a directory
 * holding one `.cjs` and there is no `packages/` above it. Both candidates miss and `loadCatalog()`
 * throws, naming two paths that mean nothing to the person reading it.
 *
 * So the copy is made here, into the one directory that is both `__dirname` in a checkout and the
 * thing `extraResources` ships. **`extraResources` needs a second entry for it** — the two are
 * asserted to agree by `tests/hls008ExportReact.test.ts`, because a build step and a packaging
 * manifest that disagree fail only in a signed build nobody runs in CI.
 */
copyFileSync('../noodl-types/src/node-catalog.json', 'dist/node-catalog.json');

/**
 * HLS-013 — the headless cloud-function bundler, bundled as its own artifact.
 *
 * A second bundle rather than part of the server for the reason its own header
 * gives: it reaches `ProjectModel`, whose import chain does not belong in a
 * server bundle (it drags renderer view modules in) and whose singletons must
 * not outlive one build. `dist/` is where it has to land — `files: ["bin","dist"]`
 * is what ships.
 */
await esbuild.build({
  ...common,
  entryPoints: ['src/cloud/bundleEntry.js'],
  target: 'node18',
  outfile: 'dist/cloud-bundle.cjs',
  // The editor sources it reaches import CSS-module and asset paths through
  // modules that are never executed on this path; keep esbuild from trying to
  // resolve them into a Node bundle.
  loader: { '.css': 'empty', '.scss': 'empty', '.svg': 'empty', '.png': 'empty' }
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
