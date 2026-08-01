import * as esbuild from '../../../../node_modules/esbuild/lib/main.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const here = path.dirname(fileURLToPath(import.meta.url));
await esbuild.build({
  entryPoints: [path.join(here, 'bcn-007-file-driver.ts')],
  bundle: true, platform: 'node', format: 'cjs', target: 'node22',
  outfile: path.join(here, 'bcn-007-file-driver.cjs'), logLevel: 'warning'
});
console.log('bundle OK');
