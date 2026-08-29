/**
 * Bundles scripts/devtools/deploy-from-disk.entry.ts into a runnable CJS file.
 * Mirrors packages/noodl-preview/build.mjs — same shims, same alias map. If the
 * editor's tsconfig paths move, both must move together.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import esbuild from 'esbuild';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const EDITOR_SRC = path.join(REPO_ROOT, 'packages/noodl-editor/src/editor/src');
const OUT = process.argv[2] || path.join(HERE, 'deploy-from-disk.cjs');

const stubs = { bugtracker: 'exports.bugtracker = { identify() {}, track() {}, debug() {} };' };

const shimPlugin = {
  name: 'noodl-preview-shims',
  setup(build) {
    build.onResolve({ filter: /(^|\/)bugtracker$/ }, () => ({ path: 'bugtracker', namespace: 'preview-stub' }));
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
  entryPoints: [path.join(HERE, 'deploy-from-disk.entry.ts')],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile: OUT,
  sourcemap: false,
  external: ['chokidar'],
  alias: {
    '@noodl/runtime': path.join(REPO_ROOT, 'packages/noodl-runtime'),
    '@noodl-models': path.join(EDITOR_SRC, 'models'),
    '@noodl-utils': path.join(EDITOR_SRC, 'utils'),
    '@noodl-constants': path.join(EDITOR_SRC, 'constants'),
    '@noodl-store': path.join(EDITOR_SRC, 'store'),
    '@noodl-core-ui': path.join(REPO_ROOT, 'packages/noodl-core-ui/src')
  },
  loader: { '.css': 'empty', '.svg': 'empty', '.png': 'empty', '.jpg': 'empty', '.gif': 'empty', '.woff': 'empty', '.woff2': 'empty' },
  plugins: [shimPlugin],
  logLevel: 'warning'
});
process.stdout.write(`built ${OUT}\n`);
