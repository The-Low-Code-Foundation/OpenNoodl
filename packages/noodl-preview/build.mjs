/**
 * Bundles the live-preview harness into a single self-contained CJS executable.
 *
 * Unlike the MCP server (which only needs the pure format engines), this harness
 * runs the editor's *real* export pipeline headlessly — `ProjectModel`,
 * `NodeLibrary`, `utils/exporter` and the deploy `HtmlProcessor` — plus the
 * browser runtime's node register, which is what supplies `NodeLibrary` with
 * node types. All of that is Electron-free once four things are shimmed, and
 * every shim below exists for a reason that bites immediately if removed:
 *
 *   1. `@noodl/platform` must be bound to the Node implementation. Handled at
 *      runtime by importing `@noodl/platform-node` first (see src/headless.ts) —
 *      several editor modules read `platform.getUserDataPath()` at module scope.
 *   2. `bugtracker` hijacks `console.log` and appends to a log file under the
 *      user data dir at import time. Stubbed here: a CLI must not do that.
 *   3. `noodl-viewer-react/src/types.ts` exports TS types only, but a few node
 *      modules import identifiers from it that exist as runtime globals
 *      (`Noodl.*`), which esbuild cannot elide cross-file. Replaced with noop
 *      proxies — none of it runs during node registration. (Same plugin the
 *      node-catalog generator uses; see scripts/node-catalog/generate.js.)
 *   4. Asset imports (css/svg/png/fonts) from the viewer's node modules are
 *      loaded as `empty` — registration is metadata-only and never renders.
 *
 * Note the `alias` map mirrors noodl-editor/tsconfig.json's `paths`. Anything
 * added there that the export path touches must be added here too, otherwise
 * the bundle fails loudly at build time (which is the good failure mode).
 */
import path from 'path';
import { fileURLToPath } from 'url';

import esbuild from 'esbuild';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const EDITOR_SRC = path.join(REPO_ROOT, 'packages/noodl-editor/src/editor/src');

/** Modules replaced wholesale, by the tail of their import specifier. */
const stubs = {
  bugtracker: 'exports.bugtracker = { identify() {}, track() {}, debug() {} };'
};

const shimPlugin = {
  name: 'noodl-preview-shims',
  setup(build) {
    // (2) bugtracker — see header.
    build.onResolve({ filter: /(^|\/)bugtracker$/ }, () => ({ path: 'bugtracker', namespace: 'preview-stub' }));

    // (3) viewer-react type-only module imported for runtime identifiers.
    const typeModule = path.join(REPO_ROOT, 'packages/noodl-viewer-react/src/types.ts');
    build.onResolve({ filter: /^\.\.?\/.*types$/ }, (args) =>
      path.resolve(args.resolveDir, args.path) + '.ts' === typeModule
        ? { path: 'viewer-types', namespace: 'preview-stub' }
        : null
    );

    build.onLoad({ filter: /.*/, namespace: 'preview-stub' }, (args) => ({
      contents:
        stubs[args.path] ??
        'const noop = new Proxy(function () {}, { get: () => noop, apply: () => noop });\n' +
          'module.exports = new Proxy({}, { get: () => noop });',
      loader: 'js'
    }));
  }
};

await esbuild.build({
  entryPoints: [path.join(HERE, 'src/cli.ts')],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile: path.join(HERE, 'dist/noodl-preview.cjs'),
  sourcemap: false,
  // chokidar loads the optional native `fsevents` binding on macOS, which
  // cannot be bundled. It is a declared dependency, so leaving it external is
  // both correct and the only thing that works.
  external: ['chokidar'],
  alias: {
    '@noodl/runtime': path.join(REPO_ROOT, 'packages/noodl-runtime'),
    '@noodl-models': path.join(EDITOR_SRC, 'models'),
    '@noodl-utils': path.join(EDITOR_SRC, 'utils'),
    '@noodl-constants': path.join(EDITOR_SRC, 'constants'),
    '@noodl-store': path.join(EDITOR_SRC, 'store'),
    '@noodl-core-ui': path.join(REPO_ROOT, 'packages/noodl-core-ui/src')
  },
  // (4) asset imports from viewer node modules.
  loader: {
    '.css': 'empty',
    '.svg': 'empty',
    '.png': 'empty',
    '.jpg': 'empty',
    '.gif': 'empty',
    '.woff': 'empty',
    '.woff2': 'empty'
  },
  plugins: [shimPlugin],
  logLevel: 'warning'
});
