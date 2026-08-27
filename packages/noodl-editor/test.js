const fs = require('fs');
const path = require('path');

const electron = require('electron');
const StorageApi = require('./src/main/src/StorageApi');
// Module to control application life.
const { app } = electron;

// If Electron was booted as a plain Node process (ELECTRON_RUN_AS_NODE=1, which
// VS Code sets in integrated terminals), `require('electron')` hands back the CLI
// shim instead of the API object and every main-process API is undefined.
// Fail loudly here rather than with an opaque "Cannot read properties of undefined".
if (!app || typeof app.on !== 'function') {
  console.error('');
  console.error('  test.js must run as the Electron main process, not under Node.');
  console.error('');
  console.error('  `require("electron").app` is undefined, which means this process was');
  console.error('  started with ELECTRON_RUN_AS_NODE set (VS Code sets it in integrated');
  console.error('  terminals and the extension host).');
  console.error('');
  console.error(`  ELECTRON_RUN_AS_NODE=${JSON.stringify(process.env.ELECTRON_RUN_AS_NODE)}`);
  console.error('');
  console.error('  Launch the suite via `npm run test:editor` / `npm run test:ci`, which go');
  console.error('  through scripts/run-electron-tests.js and strip that variable.');
  console.error('');
  process.exit(1);
}

// Module to create native browser window.
const { BrowserWindow, ipcMain } = electron;

process.env.devMode = 'test';

const isCI = process.argv.includes('--ci') || process.env.NOODL_TEST_CI === '1';
// Belt and braces: the renderer reads this to decide where to load the bundle from.
process.env.NOODL_TEST_CI = isCI ? '1' : '';

/**
 * If the renderer never reports back (bundle failed to load, hard crash, hung
 * spec) we must not sit forever holding a CI runner.
 *
 * ⚠️ **A run that trips this grades NOTHING.** It prints no `Jasmine:` line and
 * writes no `tests/test-results.json`, so there is no spec count and no failure
 * list — the result is not "zero failures" and not "one failure", it is *no
 * measurement*. The readout is `tests/test-results.json` (deleted before each
 * run by run-electron-tests.js, so absent = ungraded); the `Jasmine:` line is
 * the human echo of the same message.
 *
 * 🔴 **The 15-minute default is no longer comfortably above the suite.** On
 * 2026-08-12 a healthy machine reached **2476 of ~2700 specs — 92% — and was cut
 * off**, the third consecutive run across two sessions to grade nothing. The
 * usual cause is a thrashing machine and the usual fix is to free memory rather
 * than raise this; that advice did not fit here, because swap was fine and the
 * suite was simply close to the wall. The suite has grown 2596 → ~2700.
 *
 * So the ceiling is overridable — for a slow or loaded machine that still
 * deserves a real measurement — while the default stays put so CI keeps its
 * guard. Raise it only after checking the machine is not swapping; a timeout is
 * far more often a symptom than a limit.
 */
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;
const overrideMinutes = Number(process.env.NOODL_TEST_TIMEOUT_MINUTES);
const OVERALL_TIMEOUT_MS =
  Number.isFinite(overrideMinutes) && overrideMinutes > 0 ? Math.round(overrideMinutes * 60 * 1000) : DEFAULT_TIMEOUT_MS;

let win = null;
let didReportResults = false;
const startedAt = new Date();

// GAT-001: the run exited 0 once having graded 2,620 specs and written nothing —
// some path that never goes through finish(). If the process reaches 'exit'
// without finish() having run, this prints WHICH kind of nothing happened.
// ⚠️ The exitCode rewrite below works in plain Node but is IGNORED under
// Electron's app.exit() (measured 2026-08-27 via NOODL_TEST_PROVE_GUARD): the
// child still exits 0. The code-level enforcement therefore lives in
// run-electron-tests.js, which refuses a zero exit without a fresh
// tests/test-results.json. This handler is the diagnosis; the runner is the law.
process.on('exit', (code) => {
  if (!didReportResults) {
    fs.writeSync(2, `Test run exited (code ${code}) without reporting results — cause unknown to the harness. `);
    fs.writeSync(2, 'This is NOT a timeout and NOT a renderer crash (those print their own messages); investigate, do not re-run and hope.\n');
    if (code === 0) {
      process.exitCode = 1;
    }
  }
});

// `app.exit()` is process.exit() underneath: it does not flush pending writes.
// When stdout is a pipe (CI, `npm run test:ci > log`, lerna) those writes are
// asynchronous, so everything console.log'd just before the exit — including the
// whole results summary — is discarded. Write the report synchronously instead.
function report(text) {
  fs.writeSync(1, text + '\n');
}

function finish(exitCode, reason) {
  if (didReportResults) return;
  didReportResults = true;

  if (reason) {
    fs.writeSync(2, reason + '\n');
  }

  // app.exit skips the "window-all-closed" dance and preserves our code.
  app.exit(exitCode);
}

const overallTimeout = setTimeout(() => {
  finish(1, `Test run timed out after ${OVERALL_TIMEOUT_MS / 1000}s without reporting results.`);
}, OVERALL_TIMEOUT_MS);
overallTimeout.unref?.();

ipcMain.on('noodl-test-results', (_event, results) => {
  const { failedCount = 0, totalCount = 0, overallStatus, failures = [], seed } = results || {};

  report('');
  report(`Jasmine: ${totalCount} specs, ${failedCount} failures (${overallStatus}).`);
  // Order is randomized (DEBT-005); the seed reproduces an order-dependent
  // failure via `jasmine.getEnv().configure({ random: true, seed })`.
  if (seed !== undefined && seed !== null) report(`Randomized with seed ${seed}.`);

  for (const failure of failures) {
    report('');
    report(`  FAILED: ${failure.fullName}`);
    for (const message of failure.messages || []) {
      report(`    ${message}`);
    }
  }
  report('');

  // A machine-readable copy, so a CI run that loses its log tail (or a reviewer
  // reading an artifact) can still see what happened. Gitignored. This file is
  // the primary readout (GAT-001) — the runner script deletes it before the run
  // and refuses a zero exit unless a fresh one exists, so absent = ungraded.
  // The stamp is for COMPARING, not displaying: `gitHead` against the reader's
  // current HEAD, `startedAt` against the invocation they think they are reading.
  const resultsPath = path.join(__dirname, 'tests', 'test-results.json');
  try {
    let gitHead = 'unknown';
    try {
      gitHead = require('child_process').execSync('git rev-parse HEAD', { cwd: __dirname }).toString().trim();
    } catch (_ignored) {
      // Not fatal: a tarball checkout still deserves a readout.
    }
    fs.writeFileSync(
      resultsPath,
      JSON.stringify(
        {
          ...results,
          gitHead,
          startedAt: startedAt.toISOString(),
          finishedAt: new Date().toISOString(),
          elapsedSeconds: Math.round((Date.now() - startedAt.getTime()) / 1000)
        },
        null,
        2
      )
    );
    report(`Results written to ${resultsPath}`);
  } catch (err) {
    fs.writeSync(2, `Failed to write tests/test-results.json: ${err.message}\n`);
  }

  clearTimeout(overallTimeout);

  const passed = overallStatus === 'passed' && failedCount === 0 && totalCount > 0;
  if (!passed && totalCount === 0) {
    fs.writeSync(2, 'No specs ran — treating as a failure.\n');
  }

  finish(passed ? 0 : 1);
});

ipcMain.on('noodl-test-fatal', (_event, message) => {
  finish(1, `Renderer reported a fatal error: ${message}`);
});

function createWindow() {
  // Create the browser window.
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: !isCI,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      // Keep specs running when the window is backgrounded/hidden.
      backgroundThrottling: false
    }
  });

  const remote = require('@electron/remote/main');
  remote.initialize();
  remote.enable(win.webContents);

  // and load the index.html of the app.
  win.loadURL('file:///' + process.cwd() + '/tests/SpecRunner.html');

  if (!isCI) {
    // Open the DevTools.
    win.webContents.openDevTools();
  }

  // Surface renderer console output in the terminal — otherwise a headless run is silent.
  // Electron 35+ passes the details on the event object; `level` is a string
  // ('debug' | 'info' | 'warning' | 'error'), not the old numeric index.
  win.webContents.on('console-message', ({ level, message }) => {
    if (isCI || level === 'warning' || level === 'error') {
      console.log(`[renderer] ${message}`);
    }
  });

  win.webContents.on('render-process-gone', (_event, details) => {
    finish(1, `Renderer process gone: ${details.reason}`);
  });

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    finish(1, `Failed to load SpecRunner.html: ${errorDescription} (${errorCode})`);
  });

  // Make sure target="_blank" opens in external browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    electron.shell.openExternal(url);
    return { action: 'deny' };
  });

  // Emitted when the window is closed.
  win.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null;
  });

  StorageApi.setup(win);
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', function () {
  // GAT-001 acceptance: "prove the guard red". This reproduces the 2026-08-12
  // 23:40 shape — the app exits 0 without finish() ever running — without
  // needing the suite. It deliberately does NOT touch the results handler or
  // the guard itself: a stub that answers for the thing under test proves
  // nothing. `npm run test:_start_electron` with this set must exit non-zero.
  if (process.env.NOODL_TEST_PROVE_GUARD === '1') {
    setTimeout(() => app.exit(0), 1000);
    return;
  }
  createWindow();
});

// Quit when all windows are closed. If the window was closed before results came
// in (someone hit ⌘W mid-run), that is a failed run, not a pass.
app.on('window-all-closed', () => {
  finish(1, 'Test window closed before results were reported.');
});
