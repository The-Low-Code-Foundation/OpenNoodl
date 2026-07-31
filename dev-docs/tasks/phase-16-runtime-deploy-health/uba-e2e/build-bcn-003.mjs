// Bundles BCN-003's live equivalence driver against the REAL translators.
//
// The point of bundling rather than reimplementing: a driver that translated
// the filters itself would prove something about the driver. These are the
// functions the editor and the runtime call.
//
// Run from this directory:
//   node build-bcn-003.mjs && node bcn-003-equivalence-driver.cjs
import * as esbuild from '../../../../node_modules/esbuild/lib/main.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

await esbuild.build({
  entryPoints: [path.join(here, 'bcn-003-equivalence-driver.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  outfile: path.join(here, 'bcn-003-equivalence-driver.cjs'),
  logLevel: 'warning'
});
console.log('bundle OK → bcn-003-equivalence-driver.cjs');
