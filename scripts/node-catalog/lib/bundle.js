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
 * Bundle an extractor entry point into `workDir`.
 *
 * @param {string} entryPoint absolute path to the entry module
 * @param {string} workDir    a temporary directory to write the bundle into
 * @param {string} [name]     bundle basename, for callers that build more than one
 * @returns {Promise<string>} absolute path to the bundle
 */
async function bundleEntry(entryPoint, workDir, name = 'extractor') {
  const outfile = path.join(workDir, `${name}.bundle.js`);
  await esbuild.build({
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
  });
  return outfile;
}

module.exports = { bundleEntry, REPO_ROOT };
