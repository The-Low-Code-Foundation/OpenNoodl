// Bundles byob-driver.ts against the REAL editor/runtime sources.
// Run from this directory: node build-byob.mjs && node byob-driver.cjs
import * as esbuild from '../../../../node_modules/esbuild/lib/main.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

await esbuild.build({
  entryPoints: [path.join(here, 'byob-driver.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  outfile: path.join(here, 'byob-driver.cjs'),
  logLevel: 'warning',
  alias: {
    // BackendServices' editor-only deps, unused by the schema parsers under test
    '@noodl-models/projectmodel': path.join(here, 'stub-projectmodel.js'),
    '@noodl-utils/model': path.join(here, 'stub-model.js')
  },
  plugins: [
    {
      name: 'stub-noodl-runtime-singleton',
      setup(build) {
        // byob-utils.js does require('../../../../noodl-runtime') — redirect ONLY
        // that to an injectable stub so the driver can seed backendServices metadata.
        build.onResolve({ filter: /^(\.\.\/)+noodl-runtime$/ }, () => ({
          path: path.join(here, 'stub-noodl-runtime.js')
        }));
      }
    }
  ]
});
console.log('bundle OK → byob-driver.cjs');
