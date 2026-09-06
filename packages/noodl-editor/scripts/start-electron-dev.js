/**
 * Launches the editor in dev mode, with an opt-in main-process inspector.
 *
 * `electron . --dev` used to be inlined in the `start:_dev` npm script. It grew
 * a launcher for the same reason the test suite has one (run-electron-tests.js):
 * the main process was the one part of the app with no debugger attached — only
 * its stdout was visible — and `--inspect` has to be passed to the Electron
 * binary, so it cannot be switched on from inside main.js.
 *
 * Env:
 *   NOODL_MAIN_INSPECT_PORT   start the Node inspector for the main process on
 *                             this port. Attach with `node inspect 127.0.0.1:<port>`,
 *                             or chrome://inspect. Renderer debugging is separate
 *                             — that is NOODL_REMOTE_DEBUG_PORT + scripts/devtools/cdp.js.
 *   NOODL_MAIN_INSPECT_BRK    if '1', break before main.js runs, so startup can
 *                             be stepped through. Nothing loads until you attach.
 *   NOODL_USER_DATA_DIR       run against this userData directory instead of the
 *                             real one (~/Library/Application Support/NodeGX on
 *                             macOS). This is how a *first-run* drive is done:
 *                             every electron-store file — editorSettings, the
 *                             Learning register, recently-opened — lives under
 *                             userData, so the only honest way to see what a new
 *                             install sees is to point the app somewhere empty.
 *                             Mutating the developer's own profile to fake it is
 *                             both destructive and easy to get wrong on restore.
 */
const path = require('path');
const child_process = require('child_process');

const EDITOR_ROOT = path.join(__dirname, '..');

const env = { ...process.env };
// Electron boots as plain Node with this set, so `electron.app` is undefined and
// no window ever opens. VS Code sets it in integrated terminals. Same guard as
// scripts/start.ts and run-electron-tests.js.
delete env.ELECTRON_RUN_AS_NODE;

const electronBinary = require('electron');
if (typeof electronBinary !== 'string') {
  console.error('[dev-launcher] Expected the electron module to resolve to a binary path.');
  process.exit(1);
}

const electronArgs = [];
const inspectPort = process.env.NOODL_MAIN_INSPECT_PORT;
if (inspectPort) {
  const flag = process.env.NOODL_MAIN_INSPECT_BRK === '1' ? '--inspect-brk' : '--inspect';
  electronArgs.push(`${flag}=${inspectPort}`);
  console.log(`[dev-launcher] main process inspector on ${flag.slice(2)} port ${inspectPort}`);
  if (process.env.NOODL_MAIN_INSPECT_BRK === '1') {
    console.log('[dev-launcher] paused before main.js — the app will not start until a debugger attaches');
  }
}
// Chromium's own switch, honoured by Electron: it moves `app.getPath('userData')`
// wholesale, so every electron-store file follows it without any app-side change.
const userDataDir = process.env.NOODL_USER_DATA_DIR;
if (userDataDir) {
  electronArgs.push(`--user-data-dir=${path.resolve(userDataDir)}`);
  console.log(`[dev-launcher] userData redirected to ${path.resolve(userDataDir)}`);
}

// `.` is the app path; `--dev` is read by main.js and sets devMode=yes, which is
// what makes index.html load the renderer from the dev server instead of a bundle.
electronArgs.push('.', '--dev');

const child = child_process.spawn(electronBinary, electronArgs, {
  cwd: EDITOR_ROOT,
  env,
  stdio: 'inherit'
});

child.on('error', (err) => {
  console.error('[dev-launcher] Failed to launch Electron:', err);
  process.exit(1);
});

child.on('close', (code, signal) => {
  if (signal) {
    console.error(`[dev-launcher] Electron terminated with signal ${signal}`);
    process.exit(1);
  }
  process.exit(code === null ? 1 : code);
});
