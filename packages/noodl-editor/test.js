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

// If the renderer never reports back (bundle failed to load, hard crash, hung spec)
// we must not sit forever holding a CI runner.
const OVERALL_TIMEOUT_MS = 15 * 60 * 1000;

let win = null;
let didReportResults = false;

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
  const { failedCount = 0, totalCount = 0, overallStatus, failures = [] } = results || {};

  report('');
  report(`Jasmine: ${totalCount} specs, ${failedCount} failures (${overallStatus}).`);

  for (const failure of failures) {
    report('');
    report(`  FAILED: ${failure.fullName}`);
    for (const message of failure.messages || []) {
      report(`    ${message}`);
    }
  }
  report('');

  // A machine-readable copy, so a CI run that loses its log tail (or a reviewer
  // reading an artifact) can still see what happened. Gitignored.
  try {
    fs.writeFileSync(path.join(__dirname, 'tests', 'test-results.json'), JSON.stringify(results, null, 2));
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
  win.webContents.on('console-message', (_event, level, message) => {
    if (isCI || level >= 2) {
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
  createWindow();
});

// Quit when all windows are closed. If the window was closed before results came
// in (someone hit ⌘W mid-run), that is a failed run, not a pass.
app.on('window-all-closed', () => {
  finish(1, 'Test window closed before results were reported.');
});
