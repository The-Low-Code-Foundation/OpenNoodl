// Bundles BCN-008's live driver against the REAL transports.
//
// Same argument as `bcn-004-rest-driver.build.mjs`: a driver that parsed its own frames or
// owned its own backoff would prove something about the driver. This bundles the shipped
// classes, so every URL, every subscription POST, every reconnect and every `RealtimeChange`
// in the run is one `api/backends/realtime/` produced — including the parts that are the
// whole point (the pong, the connect deadline, reading `accepted[]` rather than the status).
//
// Run from this directory:
//   node bcn-008-realtime-driver.build.mjs && node bcn-008-realtime-driver.cjs
import * as esbuild from '../../../../node_modules/esbuild/lib/main.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

await esbuild.build({
  entryPoints: [path.join(here, 'bcn-008-realtime-driver.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  outfile: path.join(here, 'bcn-008-realtime-driver.cjs'),
  logLevel: 'warning'
});
console.log('bundle OK → bcn-008-realtime-driver.cjs');
