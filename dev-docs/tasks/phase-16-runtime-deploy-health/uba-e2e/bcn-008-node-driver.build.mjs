// Bundles BCN-008 node driver against the REAL Query Records node.
//
// Same argument as `build-bcn-003.mjs`: a driver that built its own URLs would
// prove something about the driver. This bundles the shipped class, so every
// request the run makes is one the adapter constructed — including the parts
// (the `Prefer` headers, the offset→page conversion, the `filter_count` read)
// that are the entire point of the exercise.
//
// Run from this directory:
//   node bcn-008-node-driver.build.mjs && node bcn-008-node-driver.cjs
import * as esbuild from '../../../../node_modules/esbuild/lib/main.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

await esbuild.build({
  entryPoints: [path.join(here, 'bcn-008-node-driver.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  outfile: path.join(here, 'bcn-008-node-driver.cjs'),
  logLevel: 'warning'
});
console.log('bundle OK → bcn-008-node-driver.cjs');
