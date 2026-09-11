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

const fs = require('fs');

const EDITOR_ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);

// GAT-001: tests/test-results.json is the readout, and a stale copy from an
// earlier run reads exactly like a fresh one (a session has already been fooled
// by that once). Delete it before the run so absent is unambiguous, and record
// when we started so "fresh" is checkable afterwards.
const RESULTS_PATH = path.join(EDITOR_ROOT, 'tests', 'test-results.json');
const RUN_STARTED_AT = Date.now();
try {
  fs.rmSync(RESULTS_PATH, { force: true });
} catch (err) {
  console.error(`[test-runner] Could not delete stale ${RESULTS_PATH}: ${err.message}`);
  process.exit(1);
}

/**
 * The trust boundary (GAT-001). On 2026-08-12 an Electron test run graded 2,620
 * of 2,702 specs, wrote no summary and no JSON, and exited 0 — through a path
 * nobody has identified. test.js now carries an in-process guard, but only this
 * side can cover mechanisms that kill or skip the guard itself: exit 0 is
 * believed if and only if a results file written AFTER this run started exists.
 */
function verifyAndExit(code) {
  let stat = null;
  try {
    stat = fs.statSync(RESULTS_PATH);
  } catch (_absent) {
    // stat stays null.
  }
  const fresh = stat && stat.mtimeMs >= RUN_STARTED_AT;

  if (fresh) {
    try {
      const results = JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf-8'));
      console.log(
        `[test-runner] ${results.totalCount} specs, ${results.failedCount} failures` +
          (results.seed != null ? `, seed ${results.seed}` : '') +
          (results.gitHead ? `, HEAD ${String(results.gitHead).slice(0, 8)}` : '')
      );
      console.log(`[test-runner] Readout: ${RESULTS_PATH}`);
    } catch (err) {
      console.error(`[test-runner] Results file exists but is unreadable: ${err.message}`);
      process.exit(1);
    }
    process.exit(code);
  }

  // No fresh results: whatever the exit code claims, nothing was measured.
  if (stat) {
    console.error('[test-runner] BUG: a stale test-results.json survived the pre-run delete.');
  }
  if (code === 0) {
    console.error('[test-runner] Electron exited 0 but wrote no fresh test-results.json.');
    console.error('[test-runner] A run that grades nothing must not pass. This is the silent-zero-exit');
    console.error('[test-runner] defect (GAT-001) — investigate the log tail, do not re-run and hope.');
    process.exit(1);
  }
  console.error('[test-runner] No results were reported (see the harness message above for which kind');
  console.error('[test-runner] of nothing happened: timeout, renderer crash, closed window, or unknown).');
  process.exit(code);
}

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

// GitHub-hosted Ubuntu runners don't have Electron's setuid `chrome-sandbox`
// helper configured (root-owned, mode 4755), so the sandboxed renderer aborts
// at startup with SIGTRAP before any spec runs. The Git specs also spawn their
// *own* nested Electron process for the merge driver (core/init.ts's
// `electron <editor-root> --merge`, invoked by `git` itself, not by us) — a
// `--no-sandbox` CLI flag on this process wouldn't reach that one, but the
// ELECTRON_DISABLE_SANDBOX env var does, since git subprocesses inherit it.
// Neither ships: this process is the test harness, and the merge driver here
// only runs against throwaway fixture repos under /tmp.
const isCi = args.includes('--ci');
if (isCi) {
  env.ELECTRON_DISABLE_SANDBOX = '1';
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
  verifyAndExit(code === null ? 1 : code);
});
