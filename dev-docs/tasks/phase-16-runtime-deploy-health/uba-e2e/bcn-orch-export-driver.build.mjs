import path from 'path';
import { fileURLToPath } from 'url';
import esbuild from '/Users/richardosborne/vscode_projects/OpenNoodl/node_modules/esbuild/lib/main.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = '/Users/richardosborne/vscode_projects/OpenNoodl';
const EDITOR_SRC = path.join(REPO_ROOT, 'packages/noodl-editor/src/editor/src');
const PREVIEW_SRC = path.join(REPO_ROOT, 'packages/noodl-preview/src');

const stubs = { bugtracker: 'exports.bugtracker = { identify() {}, track() {}, debug() {} };' };
const shimPlugin = {
  name: 'orch-shims',
  setup(build) {
    build.onResolve({ filter: /(^|\/)bugtracker$/ }, () => ({ path: 'bugtracker', namespace: 'orch-stub' }));
    const typeModule = path.join(REPO_ROOT, 'packages/noodl-viewer-react/src/types.ts');
    build.onResolve({ filter: /^\.\.?\/.*types$/ }, (args) =>
      path.resolve(args.resolveDir, args.path) + '.ts' === typeModule
        ? { path: 'viewer-types', namespace: 'orch-stub' } : null);
    build.onLoad({ filter: /.*/, namespace: 'orch-stub' }, (args) => ({
      contents: stubs[args.path] ??
        'const noop = new Proxy(function () {}, { get: () => noop, apply: () => noop });\n' +
        'module.exports = new Proxy({}, { get: () => noop });',
      loader: 'js'
    }));
  }
};

await esbuild.build({
  entryPoints: [path.join(HERE, 'bcn-orch-export-driver.ts')],
  bundle: true, platform: 'node', target: 'node18', format: 'cjs',
  outfile: path.join(HERE, 'bcn-orch-export-driver.cjs'),
  external: ['chokidar'],
  alias: {
    '@noodl/runtime': path.join(REPO_ROOT, 'packages/noodl-runtime'),
    '@noodl-models': path.join(EDITOR_SRC, 'models'),
    '@noodl-utils': path.join(EDITOR_SRC, 'utils'),
    '@noodl-constants': path.join(EDITOR_SRC, 'constants'),
    '@noodl-store': path.join(EDITOR_SRC, 'store'),
    '@noodl-core-ui': path.join(REPO_ROOT, 'packages/noodl-core-ui/src'),
    '@preview': PREVIEW_SRC
  },
  loader: { '.css':'empty','.svg':'empty','.png':'empty','.jpg':'empty','.gif':'empty','.woff':'empty','.woff2':'empty' },
  plugins: [shimPlugin], logLevel: 'warning'
});
console.log('orch driver bundle OK');
