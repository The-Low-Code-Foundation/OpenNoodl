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

// The Git specs install a merge driver that shells out to
// `electron <editor-root> --merge ...` (noodl-git/src/core/init.ts). That boots
// this package as an Electron app, so it needs `src/main/main.bundle.js` — the
// `main` entry. REV-008 correctly untracked that bundle as generated output, but
// nothing in the test path built it, so on a clean checkout the driver's Electron
// died with "Cannot find module .../main.bundle.js", never wrote the merge, and
// three specs timed out after 60s each. It only passed on machines that happened
// to have run `build:editor` recently — the same stale-artefact trap REV-008 was
// written to close, one level up. REV-010.
//
// Build it every run rather than only when missing: a *stale* main bundle is the
// same class of bug, and this takes ~200ms.
buildMainBundle();

function buildMainBundle() {
  let webpackCli;
  try {
    webpackCli = require.resolve('webpack-cli/bin/cli.js', { paths: [EDITOR_ROOT] });
  } catch (err) {
    console.error('[test-runner] Could not resolve webpack-cli to build main.bundle.js:', err.message);
    process.exit(1);
  }

  const result = child_process.spawnSync(
    process.execPath,
    [webpackCli, '--config=webpackconfigs/webpack.main.dev.js'],
    { cwd: EDITOR_ROOT, env, stdio: 'inherit' }
  );

  if (result.error) {
    console.error('[test-runner] Failed to build main.bundle.js:', result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`[test-runner] Building main.bundle.js failed with exit code ${result.status}.`);
    process.exit(result.status === null ? 1 : result.status);
  }
}

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
