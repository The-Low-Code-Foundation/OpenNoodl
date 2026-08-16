/**
 * Shared esbuild configuration for the headless extractor entries.
 *
 * The viewer packages ship TS/JSX written for a browser, so anything that
 * loads the real registries has to be bundled before Node can run it. Both
 * `generate.js` and the parameter-encoding probe need the identical bundle —
 * identical aliases, identical asset loaders, identical type-only stub — or
 * they would be observing two different node libraries.
 */
const path = require('path');
const esbuild = require('esbuild');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

/**
 * The esbuild options every headless-extractor bundle needs.
 *
 * Split out from {@link bundleEntry} for CN-003: `packages/noodl-mcp/build.mjs`
 * builds a kit extractor into the MCP server's `dist/` and needs these exact
 * options — the same aliases, the same asset loaders, the same type-only stub.
 * It cannot call `bundleEntry`, because that writes a `*.bundle.js` into a work
 * directory and the shipped artifact needs its own name and destination.
 *
 * ⚠️ Shared rather than copied on purpose. Two extractors bundled two different
 * ways would be observing two different node libraries, which is the failure
 * this file's header already warns about — CN-003 just adds a third caller to
 * the set that must not drift.
 *
 * @param {string} entryPoint absolute path to the entry module
 * @param {string} outfile    absolute path to write the bundle to
 * @returns {import('esbuild').BuildOptions}
 */
function extractorBuildOptions(entryPoint, outfile) {
  return {
    entryPoints: [entryPoint],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile,
    alias: { '@noodl/runtime': path.join(REPO_ROOT, 'packages/noodl-runtime') },
    loader: {
      '.css': 'empty',
      '.svg': 'empty',
      '.png': 'empty',
      '.jpg': 'empty',
      '.gif': 'empty',
      '.woff': 'empty',
      '.woff2': 'empty'
    },
    plugins: [
      {
        // noodl-viewer-react/src/types.ts exports only TS types, but a few
        // modules import identifiers from it that also exist as runtime
        // globals (`Noodl.*`), which esbuild cannot elide cross-file. Replace
        // the module with recursive noop proxies; none of it runs during
        // registration.
        name: 'stub-type-only-modules',
        setup(build) {
          const typeModule = path.join(REPO_ROOT, 'packages/noodl-viewer-react/src/types.ts');
          build.onResolve({ filter: /^\.\.?\/.*types$/ }, (args) => {
            if (path.resolve(args.resolveDir, args.path) + '.ts' === typeModule) {
              return { path: typeModule, namespace: 'type-stub' };
            }
            return null;
          });
          build.onLoad({ filter: /.*/, namespace: 'type-stub' }, () => ({
            contents: `
              const noop = new Proxy(function () {}, { get: () => noop, apply: () => noop });
              module.exports = new Proxy({}, { get: () => noop });
            `,
            loader: 'js'
          }));
        }
      }
    ],
    logLevel: 'warning'
  };
}

/**
 * Bundle an extractor entry point into `workDir`.
 *
 * @param {string} entryPoint absolute path to the entry module
 * @param {string} workDir    a temporary directory to write the bundle into
 * @param {string} [name]     bundle basename, for callers that build more than one
 * @returns {Promise<string>} absolute path to the bundle
 */
async function bundleEntry(entryPoint, workDir, name = 'extractor') {
  const outfile = path.join(workDir, `${name}.bundle.js`);
  await esbuild.build(extractorBuildOptions(entryPoint, outfile));
  return outfile;
}

module.exports = { bundleEntry, extractorBuildOptions, REPO_ROOT };
