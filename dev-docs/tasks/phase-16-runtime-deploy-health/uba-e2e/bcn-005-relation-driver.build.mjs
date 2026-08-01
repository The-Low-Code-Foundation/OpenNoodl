// Bundles BCN-005's live driver against the REAL `RestDataAdapter` and the real
// relation parsers, for the same reason BCN-004's build script exists: a driver
// that built its own URLs would prove something about the driver.
//
// Run from this directory:
//   node bcn-005-relation-driver.build.mjs && node bcn-005-relation-driver.cjs
import * as esbuild from '../../../../node_modules/esbuild/lib/main.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

await esbuild.build({
  entryPoints: [path.join(here, 'bcn-005-relation-driver.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  outfile: path.join(here, 'bcn-005-relation-driver.cjs'),
  logLevel: 'warning'
});
console.log('bundle OK → bcn-005-relation-driver.cjs');
