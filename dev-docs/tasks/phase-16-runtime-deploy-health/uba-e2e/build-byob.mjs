// Bundles a driver against the REAL editor/runtime sources.
// Run from this directory:
//   node build-byob.mjs && node byob-driver.cjs                 (Directus/BYOB)
//   node build-byob.mjs supabase && node supabase-driver.cjs    (PostgREST/Supabase)
import * as esbuild from '../../../../node_modules/esbuild/lib/main.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const driver = process.argv[2] === 'supabase' ? 'supabase-driver' : 'byob-driver';

await esbuild.build({
  entryPoints: [path.join(here, `${driver}.ts`)],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  outfile: path.join(here, `${driver}.cjs`),
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
