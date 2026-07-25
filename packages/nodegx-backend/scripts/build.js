/**
 * Build the runnable service: one self-contained CommonJS bundle at
 * dist/cli.js (plus dist/index.js for programmatic use), embedding:
 *
 *   - this package's TypeScript sources
 *   - the adapter stack from @noodl/runtime (plain CommonJS)
 *   - the cloud runtime + execution history from noodl-viewer-cloud/src
 *     (TypeScript, via the `@cloud-runtime` alias)
 *
 * Why a bundle and not tsc output: the service must run under plain system
 * Node on a deploy target and under `ELECTRON_RUN_AS_NODE` when the editor
 * spawns it — with NO node_modules resolution at runtime. A single artifact is
 * also what makes WF-003 "copy this file and run it".
 *
 * The banner defines `_noodl_cloud_runtime_version`, which flips the runtime
 * clients (cloudstore/configservice) into their fetch-based cloud code path —
 * same trick as viewer-cloud's own webpack BannerPlugin.
 */
'use strict';

const path = require('path');
const esbuild = require('esbuild');

const pkgRoot = path.resolve(__dirname, '..');
const packagesRoot = path.resolve(pkgRoot, '..');

const shared = {
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: true,
  logLevel: 'info',
  banner: {
    js: `const _noodl_cloud_runtime_version = "nodegx-backend-${require(path.join(pkgRoot, 'package.json')).version}";`
  },
  alias: {
    '@cloud-runtime': path.join(packagesRoot, 'noodl-viewer-cloud', 'src'),
    '@noodl/runtime': path.join(packagesRoot, 'noodl-runtime')
  },
  // node:sqlite must stay a runtime require — esbuild cannot resolve node: URIs
  // it doesn't know, and bundling it makes no sense.
  external: ['node:sqlite']
};

async function main() {
  await esbuild.build({
    ...shared,
    entryPoints: [path.join(pkgRoot, 'src', 'cli.ts')],
    outfile: path.join(pkgRoot, 'dist', 'cli.js')
  });
  await esbuild.build({
    ...shared,
    entryPoints: [path.join(pkgRoot, 'src', 'index.ts')],
    outfile: path.join(pkgRoot, 'dist', 'index.js')
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
