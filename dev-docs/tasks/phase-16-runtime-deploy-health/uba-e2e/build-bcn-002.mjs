// Bundles BCN-002's live driver against the REAL ParseWireAdapter.
//
// The point of bundling rather than reimplementing: the live pass has to
// exercise the code that shipped, or it proves something about the probe.
//
// Run from this directory:
//   node build-bcn-002.mjs && node bcn-002-parse-driver.cjs
import * as esbuild from '../../../../node_modules/esbuild/lib/main.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

await esbuild.build({
  entryPoints: [path.join(here, 'bcn-002-parse-driver.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  outfile: path.join(here, 'bcn-002-parse-driver.cjs'),
  logLevel: 'warning',
  // The adapter's only non-relative import is `@noodl/backend-contract`, and it
  // is `import type` — erased before bundling, so nothing resolves it. Recorded
  // here because that erasure is also what keeps the contract package out of
  // the shipped viewer bundle.
  plugins: [
    {
      name: 'stub-noodl-runtime-singleton',
      setup(build) {
        // The adapter does not require the runtime singleton — that is the
        // seam BCN-002 introduced. If this ever fires, the adapter has grown a
        // dependency it is not supposed to have, which is worth knowing loudly.
        build.onResolve({ filter: /^(\.\.\/)+noodl-runtime$/ }, (args) => {
          throw new Error(`ParseWireAdapter reached for the runtime singleton via ${args.path} — it must not.`);
        });
      }
    }
  ]
});
console.log('bundle OK → bcn-002-parse-driver.cjs');
