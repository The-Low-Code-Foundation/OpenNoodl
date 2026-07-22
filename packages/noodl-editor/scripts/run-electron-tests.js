/**
 * Launches `electron test.js` in *main-process* mode and propagates the exit code.
 *
 * Why this exists: if `ELECTRON_RUN_AS_NODE` is present in the environment,
 * the Electron binary boots as a plain Node process. `require('electron')` then
 * resolves to the CLI shim (a path string) instead of the API object, so
 * `electron.app` is `undefined` and test.js dies before a single spec runs.
 *
 * VS Code sets `ELECTRON_RUN_AS_NODE=1` in integrated terminals and in the
 * extension host, so anyone running the suite from inside an editor terminal
 * inherits it silently. Strip it here rather than relying on the caller's shell.
 */
const path = require('path');
const child_process = require('child_process');

const EDITOR_ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);

const env = { ...process.env };
// The whole point of this launcher — see header.
delete env.ELECTRON_RUN_AS_NODE;

// `electron` from Node returns the path to the binary; resolve it directly so we
// never re-enter Node through the .bin shim.
const electronBinary = require('electron');
if (typeof electronBinary !== 'string') {
  console.error('[test-runner] Expected the electron module to resolve to a binary path.');
  process.exit(1);
}

const child = child_process.spawn(electronBinary, ['test.js', ...args], {
  cwd: EDITOR_ROOT,
  env,
  stdio: 'inherit'
});

child.on('error', (err) => {
  console.error('[test-runner] Failed to launch Electron:', err);
  process.exit(1);
});

child.on('close', (code, signal) => {
  if (signal) {
    console.error(`[test-runner] Electron terminated with signal ${signal}`);
    process.exit(1);
  }
  process.exit(code === null ? 1 : code);
});
