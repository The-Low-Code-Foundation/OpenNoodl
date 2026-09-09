// LEG-004 — `diff=noodl`, and it has to be the first statement in the file.
//
// Git invokes textconv once per blob per revision, so `installMergeDriver`
// configures it as `ELECTRON_RUN_AS_NODE=1 <exe> <this bundle> --textconv`:
// plain Node, no Chromium, tens of milliseconds instead of a full app boot.
// Two consequences, both of which put the dispatch here rather than beside the
// `--merge` check at the bottom of this file:
//
//  1. Under ELECTRON_RUN_AS_NODE the guard immediately below would exit 1, and
//     git reports a non-zero textconv as an error on an ordinary `git log`.
//  2. Every require after this line assumes a real Electron main process.
//
// `handleTextconv` always exits, so nothing below runs on this path.
if (process.argv.indexOf('--textconv') !== -1) {
  require('./src/textconv-driver').handleTextconv(process.argv);
}

const electron = require('electron');
const { app, dialog } = electron;
const fs = require('fs');
const path = require('path');

// If Electron was booted as a plain Node process (ELECTRON_RUN_AS_NODE=1, which
// VS Code sets in integrated terminals and the extension host), `require('electron')`
// hands back the CLI shim instead of the API object. Every main-process API is then
// undefined and the app exits 0 without opening a window or printing anything —
// indistinguishable from a successful launch. The test harness already guards this
// (test.js, REV-002); the app itself did not, so a packaged build launched from an
// editor terminal silently did nothing.
if (!app || typeof app.on !== 'function') {
  console.error('');
  console.error('  OpenNoodl must run as the Electron main process, not under Node.');
  console.error('');
  console.error(`  ELECTRON_RUN_AS_NODE=${JSON.stringify(process.env.ELECTRON_RUN_AS_NODE)} is set,`);
  console.error('  so `require("electron").app` is undefined and no window can be opened.');
  console.error('');
  console.error('  Launch via `npm run dev` / `npm run dev:debug`, which strip it, or clear it:');
  console.error('      env -u ELECTRON_RUN_AS_NODE <command>');
  console.error('');
  process.exit(1);
}

const AutoUpdater = require('./src/autoupdater');
const FloatingWindow = require('./src/floating-window');
const startServer = require('./src/web-server');
const { setupBackendIPC, backendManager } = require('./src/local-backend');
const { setupExecutionHistoryIPC } = require('./src/execution-history');
const DesignToolImportServer = require('./src/design-tool-import-server');
const jsonstorage = require('../shared/utils/jsonstorage');
const StorageApi = require('./src/StorageApi');
const { initializeGitHubOAuthHandlers } = require('./github-oauth-handler');

const { handleProjectMerge } = require('./src/merge-driver');
const { openLegalWindow } = require('./src/legal-window');
const { setupReportIPC } = require('./src/report-window');
const {
  initialiseDebugDirectory,
  installMainProcessErrorLog,
  pruneCrashDirectory,
  setupDebugLogActions
} = require('./src/debug-log');

// ALPHA-003 criterion 2 — a main-process exception must leave a record.
//
// Installed here, at module scope, rather than at `ready`: the interesting
// failures are the early ones, and by `ready` we have already required a dozen
// modules that can throw. Node's default (print to stderr, exit 1) leaves
// nothing behind in a packaged build, where there is no terminal to print to;
// this writes the stack to `<userData>/debug/main-errors.txt` first and then
// reproduces that default exactly.
installMainProcessErrorLog({ app });

// ALPHA-003 §3 — native crashes, captured locally and sent nowhere.
//
// A renderer that dies takes the JS error handler with it, so `window.onerror`,
// `errorTail` and the on-disk log all record exactly nothing about the worst
// class of failure. A minidump is the only record that survives it.
//
// `uploadToServer: false` is not a default we are accepting, it is the whole
// design. **We have no server.** Electron's crashReporter exists to POST to a
// Crashpad endpoint, and building one would need a transmission policy that
// ALPHA-005 does not currently grant — so the dumps land in
// `app.getPath('crashDumps')`, the Help menu reveals that folder, and a user
// who wants us to see one attaches it to their own report. That keeps
// PRIVACY.md §5's "nothing about a crash is transmitted" true as written.
//
// Must run before `app.ready`, and before any renderer exists, or the child
// processes never inherit it. `compress: false` because a gzipped `.dmp` is a
// worse thing to ask a tester to attach than a plain one, and there is no
// upload to save bandwidth on.
try {
  electron.crashReporter.start({
    productName: 'NodeGX',
    companyName: 'NodeGX',
    submitURL: '',
    uploadToServer: false,
    compress: false
  });
} catch (e) {
  // Not fatal, and not worth a dialog: the app runs, it simply will not have
  // minidumps. Linux without a working Crashpad is the realistic case.
  console.warn('[crash] Local crash capture is unavailable:', e && e.message);
}

//fixes problem with reloading the viewer when it's
//running in a separate browser window (file:// cross origin warning)
app.commandLine.appendSwitch('disable-site-isolation-trials');

var args = process.argv || [];

const isDev = args.includes('--dev');

// src/editor/index.html loads the renderer bundle from the webpack dev server
// only when devMode === 'yes'; otherwise it falls back to ./index.bundle.js on
// disk. Nothing ever set this, so `npm run dev` silently ran whatever stale
// bundle happened to be lying in src/editor — code changes never took effect,
// and a leftover production bundle mixed production react-dom with the external
// development react, which crashes on startup with
// "dispatcher.getOwner is not a function" and leaves a blank window.
if (isDev) {
  process.env.devMode = 'yes';
}

// React and react-dom are webpack externals, so the packaged app `require()`s them
// at runtime — and react/index.js picks its development or production build from
// process.env.NODE_ENV, which is undefined in a packaged Electron app. That paired
// *development* react with the *production* react-dom the build produced, and
// React 19's shared internals differ between the two:
//
//   TypeError: dispatcher.getOwner is not a function
//     at getOwner (node_modules/react/cjs/react.development.js:416)
//     at createDialogLayer (router.tsx:59)
//
// It throws before first paint, so the packaged app opened a black window. The
// renderer inherits this env, which is how index.html reads devMode above.
// REV-008 — verified with `npm run cdp -- health` against a packaged build.
// The bracket access is load-bearing. In a production build webpack's
// DefinePlugin substitutes the literal expression `process.env.NODE_ENV` with
// "production" at compile time, so the dotted form compiles to `"production" =
// "production"` and the whole branch is dropped as dead code — the fix silently
// does not ship. DefinePlugin does not touch computed member access.
const NODE_ENV = 'NODE_ENV';
if (!isDev && !process.env[NODE_ENV]) {
  process.env[NODE_ENV] = 'production';
}

// Opt-in Chrome DevTools Protocol endpoint. With this set, the renderer can be
// inspected headlessly — evaluate JS, stream console output, capture
// screenshots — via scripts/devtools/cdp.js. See dev-docs/reference/DEBUG-INFRASTRUCTURE.md.
if (process.env.NOODL_REMOTE_DEBUG_PORT) {
  app.commandLine.appendSwitch('remote-debugging-port', process.env.NOODL_REMOTE_DEBUG_PORT);
  // Chromium (from ~M132, i.e. Electron 34+) refuses every DevTools Protocol
  // connection — HTTP /json discovery and the WebSocket upgrade alike — unless
  // the allowed origins are declared. Without this the endpoint accepts the TCP
  // connection and then silently drops it, so scripts/devtools/cdp.js hangs.
  // This is a localhost-only debug port that only exists when the env var is set.
  app.commandLine.appendSwitch('remote-allow-origins', '*');
}

// Editor-chrome window background per theme (UIX-008). Matches the resolved
// theme's ground colour (bg-0) so there is no flash of the wrong theme before
// the renderer stylesheet paints. These two literals are the only place the
// main process needs a token value; keep them in sync with colors.css bg-0.
const THEME_WINDOW_BG = { dark: '#0b0e12', light: '#eef1f5' };

/**
 * Read the persisted editor theme mode and resolve it to a concrete
 * light/dark for the window background + native theme, synchronously, at window
 * creation. Mirrors ThemeManager's logic on the renderer side. Never throws.
 */
function resolveStartupTheme() {
  const { nativeTheme } = electron;
  let mode = 'system';
  try {
    // Same file EditorSettings persists to: <userData>/editorSettings.json.
    const file = path.join(app.getPath('userData'), 'editorSettings.json');
    const raw = fs.readFileSync(file, { encoding: 'utf8' });
    const saved = JSON.parse(raw)?.settings?.['editor.theme'];
    if (saved === 'light' || saved === 'dark' || saved === 'system') mode = saved;
  } catch (_e) {
    // No settings yet / unreadable — fall back to system.
  }
  const resolved = mode === 'system' ? (nativeTheme && nativeTheme.shouldUseDarkColors ? 'dark' : 'light') : mode;
  return { mode, resolved, backgroundColor: THEME_WINDOW_BG[resolved] };
}

function launchApp() {
  const { Menu, BrowserWindow, ipcMain, shell, nativeTheme } = electron;
  const Config = require('../shared/config/config');

  // Align Electron's native theme (scrollbars, menus, native dialogs) with the
  // saved editor theme, and keep it in sync when the renderer changes it.
  try {
    nativeTheme.themeSource = resolveStartupTheme().mode;
  } catch (_e) {
    /* nativeTheme unavailable — ignore */
  }
  ipcMain.on('set-native-theme', (_event, mode) => {
    if (mode === 'light' || mode === 'dark' || mode === 'system') {
      try {
        nativeTheme.themeSource = mode;
      } catch (_e) {
        /* ignore */
      }
    }
  });

  require('@electron/remote/main').initialize();

  const appPath = app.getAppPath();

  // macOS takes the dock icon from the running .app bundle, which in development is
  // Electron's own Electron.app — so the dock shows the Electron logo no matter what
  // the project ships. BrowserWindow's `icon` option cannot fix it either: that is
  // Windows/Linux only and has no effect on the macOS dock. The dock has to be set
  // explicitly, and only the main process can do it.
  //
  // Packaged builds are already correct — electron-builder generates the .icns from
  // build/icon.png — so this is dev-only, and deliberately so: an .icns carries
  // hand-tuned variants per size, and overwriting it with one flat PNG would be a
  // downgrade in the one place the icon actually matters.
  function setDevDockIcon() {
    if (process.platform !== 'darwin' || app.isPackaged || !app.dock) return;

    // build/ is deliberately absent from electron-builder's `files` list, so this
    // path resolves only in a dev checkout — which is the only place it is needed.
    const iconPath = path.join(appPath, 'build', 'icon.png');
    if (!fs.existsSync(iconPath)) return;

    const image = electron.nativeImage.createFromPath(iconPath);
    // createFromPath returns an empty image rather than throwing on a bad file.
    if (!image.isEmpty()) app.dock.setIcon(image);
  }

  // App deep-link scheme (rebranded to NodeGX in REV-007). `noodl://` is still
  // registered too — not for OAuth any more (F63's device flow has no redirect),
  // but because `noodl:import/…` deep links from the design-tool import server
  // depend on it (editor/index.ts:30). That registration lives in
  // github-oauth-handler.js for historical reasons and is load-bearing there:
  // deleting it as OAuth cleanup would silently kill design-tool import.
  app.setAsDefaultProtocolClient('nodegx');

  let win;

  const gotTheLock = app.requestSingleInstanceLock();

  if (!gotTheLock) {
    console.log(`
-------------------------------
   Noodl is already running.   
-------------------------------

`);
    app.quit();
    return;
  } else {
    // Someone tried to run a second instance, we should focus our window.
    app.on('second-instance', (event, argv, workingDirectory) => {
      if (win) {
        if (win.isMinimized()) win.restore();
        win.focus();

        console.log('second-instance', event, argv);

        var args = argv || [];
        for (var i = 0; i < args.length; i++) {
          if (args[i].indexOf('noodl:') === 0) {
            process.env.noodlURI = args[i];
            win.webContents.send('open-noodl-uri', args[i]);
          }
        }
      }
    });
  }

  //chech if local docs are running
  //If they are running, use those instead of noodl docs domain
  const version = app.getVersion().split('.').slice(0, 2).join('.');
  require('http')
    .get(`http://127.0.0.1:3000/${version}/version.json`, (res) => {
      if (res.statusCode !== 200) {
        global.useLocalDocs = false;
        return;
      }

      let rawData = '';
      res.on('data', (chunk) => {
        rawData += chunk;
      });
      res.on('end', () => {
        try {
          // Check if the JSON have:
          // > "kind": "noodl-docs"
          const json = JSON.parse(rawData);
          global.useLocalDocs = json.kind === 'noodl-docs';

          if (global.useLocalDocs) {
            console.log('> Using local docs');
          }
        } catch (e) {
          console.error(e.message);
          global.useLocalDocs = false;
        }
      });
    })
    .on('error', () => {
      global.useLocalDocs = false;
    });

  const viewerWindow = new FloatingWindow();
  //const messageTrackerWindow = new FloatingWindow();

  function guid() {
    function s4() {
      return Math.floor((1 + Math.random()) * 0x10000)
        .toString(16)
        .substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
  }

  const _editorAPICallbacks = {};

  function makeEditorAPIRequest(api, args, callback) {
    const t = guid();
    _editorAPICallbacks[t] = (r) => {
      callback(r.response);
    };
    if (win && win.webContents && !win.webContents.isDestroyed()) {
      win.webContents.send('editor-api-request', { api: api, token: t, args: args });
    }
  }

  // OBS-004 — the editor renderer's copy of the relay token.
  //
  // ⚠️ Not `process.env`. `createWindow()` runs before `startServer()`, so a token minted by
  // the server would already have missed the renderer's process spawn; and the renderer would
  // have no way to tell an unset variable from one it was too early to see.
  //
  // `handle` rather than `on`+`returnValue`: a synchronous IPC blocks the renderer, and
  // `ViewerConnection` already defers its first connect by a second, so it can await.
  ipcMain.handle('relay-token', () => require('./src/relay-token').getRelayToken(app));

  ipcMain.on('editor-api-response', function (event, args) {
    const token = args.token;

    if (!_editorAPICallbacks[token]) return;
    _editorAPICallbacks[token](args);
    delete _editorAPICallbacks[token];
  });

  function projectGetSettings(callback) {
    makeEditorAPIRequest('projectGetSettings', undefined, callback);
  }

  function projectGetInfo(callback) {
    makeEditorAPIRequest('projectGetInfo', undefined, callback);
  }

  function projectGetComponentBundleExport(name, callback) {
    makeEditorAPIRequest('projectGetComponentBundleExport', { name }, callback);
  }

  function projectGetDesignTokenCss(callback) {
    makeEditorAPIRequest('projectGetDesignTokenCss', undefined, callback);
  }

  process.env.exePath = app.getPath('exe');
  // LEG-004 — the merge driver only needs the binary, but the textconv driver
  // has to name a script for it to run (`ELECTRON_RUN_AS_NODE` makes the binary
  // a plain `node`, which has no app to boot). Set here, beside exePath, so the
  // renderer inherits it in its environment and `installMergeDriver` can build
  // the command without reaching for an Electron API from @noodl/git.
  process.env.appPath = app.getAppPath();
  let reopenWindow = false;

  // Windows and Linux draw the window and taskbar icon from BrowserWindow; with no
  // `icon` they fall back to Electron's default, in packaged builds as well as dev.
  // macOS ignores this option entirely — its icon comes from the .app bundle, which
  // is what setDevDockIcon() handles. `src/assets/images/` ships in packaged builds
  // (electron-builder's `files` list includes `src`), so this resolves there too.
  const WINDOW_ICON =
    process.platform === 'darwin' ? undefined : path.join(appPath, 'src', 'assets', 'images', 'icon.png');

  function createWindow() {
    win = new BrowserWindow({
      width: 1368,
      height: 900,
      icon: WINDOW_ICON,
      acceptFirstMouse: true,
      // Per-theme ground so there is no flash-of-dark when the saved/OS theme is
      // light (UIX-008). The frameless custom titlebar is DOM chrome and follows
      // the tokens automatically.
      backgroundColor: resolveStartupTheme().backgroundColor,
      center: true,
      frame: false,
      minWidth: 600,
      minHeight: 300,
      titleBarStyle: 'hidden',
      // PAR-001: inset the macOS traffic lights so they sit vertically centered
      // inside the unified 52px DOM titlebar (launcher AND editor mocks both use
      // a 52px bar). The launcher header reserves a 120px lights region so the
      // wordmark never renders under the lights. Ignored on Windows/Linux.
      trafficLightPosition: { x: 20, y: 20 },
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        webviewTag: true
      },
      show: false
    });

    require('@electron/remote/main').enable(win.webContents);

    // Renderer output is invisible from the terminal by default, so a renderer
    // that dies on startup looks identical to one that booted fine. Mirror it
    // into the main process stdout so `npm run dev` logs tell the whole story.
    if (isDev || process.env.NOODL_DEV_LOGS === '1') {
      // Electron 35 deprecated the positional (level, message, line, sourceId)
      // arguments in favour of details on the event object, and `level` is now a
      // string ('debug' | 'info' | 'warning' | 'error') rather than an index.
      win.webContents.on('console-message', ({ level, message, lineNumber, sourceId }) => {
        const where = sourceId ? ` (${sourceId.split('/').pop()}:${lineNumber})` : '';
        console.log(`[renderer:${level || 'log'}]${where} ${message}`);
      });

      win.webContents.on('render-process-gone', (_event, details) => {
        console.error(`[renderer] process gone: ${details.reason} (exitCode ${details.exitCode})`);
      });

      win.webContents.on('did-fail-load', (_event, code, description, url) => {
        console.error(`[renderer] failed to load ${url}: ${description} (${code})`);
      });

      win.webContents.on('preload-error', (_event, preloadPath, error) => {
        console.error(`[renderer] preload error in ${preloadPath}: ${error}`);
      });
    }

    if (!Config.devMode) {
      AutoUpdater.setupAutoUpdate(win);
    }

    win.loadURL('file:///' + appPath + '/src/editor/index.html');

    // Make sure <a href target="_blank"> and window.open opens in external browser
    win.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' }; //deny a new electron window
    });

    // A plain <a href> — no target — is a SAME-WINDOW navigation, which the
    // handler above never sees. Nothing stopped one from replacing the running
    // editor with a web page, taking the renderer and any unsaved state with it,
    // with no way back but relaunching. Found when the update dialog started
    // rendering release notes as markdown, which is exactly that kind of anchor.
    //
    // The editor's own file:// document is the only thing allowed to load here.
    win.webContents.on('will-navigate', (event, url) => {
      if (url.startsWith('file://')) return;
      event.preventDefault();
      if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    });

    win.once('ready-to-show', () => {
      win.show();
    });

    // Closing the window destroys the renderer, and with it any project save
    // still sitting on the 1s debounce. On Windows and Linux this is also the
    // ordinary route to a quit. Hold the close open for the same flush
    // handshake `before-quit` uses — and stand down when that handler is
    // already draining, so ⌘Q costs one round trip rather than two.
    let closeFlushStarted = false;
    win.on('close', (event) => {
      if (closeFlushStarted || quitFlushStarted) return;

      event.preventDefault();
      closeFlushStarted = true;

      flushRendererProjectSave().then((reason) => {
        if (reason === 'timeout') {
          console.log('Timed out waiting for the renderer to flush its pending project save; closing anyway');
        }
        if (win && !win.isDestroyed()) win.destroy();
      });
    });

    win.on('closed', () => {
      win = null;
      clearTimeout(saveWindowSettingsTimeout);
      if (reopenWindow) {
        reopenWindow = false;
        createWindow();
      }
    });

    win.webContents.on('render-process-gone', (event, details) => {
      if (details.reason === 'crashed') {
        console.log('Editor window process crashed');
        closeViewer();

        dialog.showMessageBoxSync({
          message: 'Oh No! Noodl has crashed :( Click OK to restart',
          type: 'error'
        });

        win.close();
        win = null;
        reopenWindow = true;
      }
    });

    process.env.noodlURI && win.webContents.send('open-noodl-uri', process.env.noodlURI);

    DesignToolImportServer.setWindow(win);
    StorageApi.setup(win);
  }

  function closeViewer() {
    if (!viewerWindow.isOpen()) {
      return;
    }

    viewerWindow.close();
    win && win.webContents.send('viewer-closed');
  }

  function openViewer(sender, eventArgs) {
    if (viewerWindow.isOpen()) {
      return;
    }

    const parentBounds = win.getBounds();

    // TODO: There seems to be an issue with Electron that it doesn't respect
    //       the minWidth,minHeight on multi monitor screens.
    const minWidth = 320;
    const minHeight = 568;

    const height = Math.max(minHeight, parentBounds.height - 200);
    const width = Math.max(minWidth, Math.floor(((height - 37) * 9) / 16));

    viewerWindow.open({
      x: parentBounds.width - width - 50,
      y: 80,
      parent: win,
      width,
      height,
      minWidth,
      minHeight,
      url: 'file:///' + appPath + '/src/frames/viewer-frame/index.html',
      alwaysShadow: true
    });

    viewerWindow.window.webContents.once('did-finish-load', () => {
      viewerWindow.send('viewer-cookies', eventArgs.cookies);

      if (eventArgs.zoomFactor) {
        viewerWindow.send('viewer-set-zoom-factor', eventArgs.zoomFactor);
      }

      if (eventArgs.route) {
        viewerWindow.send('viewer-set-route', eventArgs.route);
      }

      if (eventArgs.viewportSize) {
        viewerWindow.send('viewer-set-viewport-size', eventArgs.viewportSize);
      }

      viewerWindow.send('viewer-set-inspect-mode', eventArgs.inspectMode);
      viewerWindow.send('viewer-select-node', eventArgs.selectedNodeId);
    });

    // viewerWindow.openDevTools();
  }

  var floatingWindows = {};
  function closeFloatingWindow(options) {
    if (!floatingWindows[options.id]) return;

    floatingWindows[options.id].close();
    if (options.sendCloseEvent) {
      win && win.webContents.send('floating-window-closed', { id: options.id });
    }
  }

  function openFloatingWindow(options) {
    if (!floatingWindows[options.id]) floatingWindows[options.id] = new FloatingWindow();
    const floatingWindow = floatingWindows[options.id];

    const parentBounds = win.getBounds();

    const width = options.width || 800;
    const height = options.height || 600;

    floatingWindow.open({
      x: parentBounds.width - width - 50,
      y: 80,
      width,
      height,
      parent: win,
      minWidth: options.minWidth || 120,
      minHeight: options.minHeight || 175,
      url: options.url.replace('{{appPath}}', appPath)
    });

    // floatingWindow.openDevTools();

    floatingWindow.window.webContents.once('did-finish-load', () => {
      floatingWindow.send('floating-window-options', options.id, options.options);
    });

    floatingWindow.forwardIpcEvents(['editor-api-response']);

    return floatingWindow;
  }

  let saveWindowSettingsTimeout;
  function onMainWindowBoundsChanged() {
    clearTimeout(saveWindowSettingsTimeout);
    saveWindowSettingsTimeout = setTimeout(() => {
      win && jsonstorage.set('windowBounds', win.getBounds());
    }, 1000);
  }

  function resizeMainWindow(options) {
    win.off('resize', onMainWindowBoundsChanged);
    win.off('move', onMainWindowBoundsChanged);

    if (options.size === 'editor') {
      jsonstorage.get('windowBounds', (bounds) => {
        win.setResizable(true);
        win.setMaximizable(true);
        win.setMinimizable(true);

        // We cannot require the screen module until the app is ready.
        const { screen } = require('electron');
        const primaryDisplay = screen.getPrimaryDisplay();

        if (
          bounds &&
          bounds.width &&
          bounds.height &&
          bounds.x + bounds.width < primaryDisplay.workAreaSize.width &&
          bounds.y + bounds.height < primaryDisplay.workAreaSize.height
        ) {
          win.setPosition(bounds.x, bounds.y);
          win.setSize(bounds.width, bounds.height);
        } else {
          win.setSize(1368, 900);
          if (options.center) win.center();
        }

        win.on('move', onMainWindowBoundsChanged);
        win.on('resize', onMainWindowBoundsChanged);
      });
    }
  }

  const buildNumber = JSON.parse(fs.readFileSync(appPath + '/package.json')).buildNumber;

  /**
   * ALPHA-007 §1. Assigned by `setupReportIpc()` before the menu is built.
   *
   * A function rather than a direct call because the *capture must happen in
   * the click handler* — before the composer renders, or the dialog is all the
   * screenshot shows.
   */
  let openReportComposer = () => {};

  /**
   * ALPHA-003 §2 — assigned at `ready`, used by the Help menu.
   *
   * The `debug/` directory has a second writer in a different process (the Git
   * merge driver), so both the sweep and the reveal live in `debug-log.js`
   * where they cannot disagree about where things are.
   */
  let debugLogActions = { openLogFolder: () => {}, openCrashFolder: () => {}, hasCrashFolder: () => false };

  function setupDebugLog() {
    debugLogActions = setupDebugLogActions({ app, shell });

    // Creating the directory here is not incidental: `merge-driver.js` writes
    // into it without `mkdir` and swallows the failure, so before this a first
    // failed project merge produced no dump at all.
    const debugSweep = initialiseDebugDirectory(app);
    const crashSweep = pruneCrashDirectory(app);
    if (debugSweep.deleted || crashSweep.deleted) {
      console.log(
        `[debug] Retention swept ${debugSweep.deleted} log file(s) and ${crashSweep.deleted} crash dump(s).`
      );
    }
  }

  function setupReportIpc() {
    openReportComposer = setupReportIPC({
      ipcMain,
      clipboard: electron.clipboard,
      nativeImage: electron.nativeImage,
      shell,
      app,
      // Looked up on each call: the editor window is recreated when a project
      // opens and closes, so a captured reference goes stale.
      getWindow: () => win
    });
  }

  let submenu = [
    {
      label: 'About NodeGX',
      click: () => {
        require('about-window').default({
          icon_path: appPath + '/src/assets/images/icon.png',
          copyright: 'GPL-3.0. Forked from Noodl, © Future Platforms AB.',
          description: buildNumber ? 'Build ' + buildNumber : undefined
        });
      }
    },
    // ALPHA-005: a policy nobody can find is not a policy. These sit beside
    // About because that is where people look for "what is this thing".
    {
      label: 'Privacy Policy',
      click: () => openLegalWindow('privacy', resolveStartupTheme().resolved)
    },
    {
      label: 'Alpha Terms',
      click: () => openLegalWindow('terms', resolveStartupTheme().resolved)
    },
    { type: 'separator' }
  ];

  if (process.platform === 'darwin') {
    submenu = submenu.concat([{ role: 'hide' }, { role: 'hideothers' }, { role: 'unhide' }, { type: 'separator' }]);
  }

  submenu.push({
    label: 'Quit',
    accelerator: 'Command+Q',
    click: function () {
      closeViewer();
      app.quit();
    }
  });

  function setupMenu() {
    var template = [
      {
        label: 'Application',
        submenu: submenu
      },
      {
        label: 'Edit',
        submenu: [
          { label: 'Undo', accelerator: 'CmdOrCtrl+Z', selector: 'undo:' },
          { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', selector: 'redo:' },
          { type: 'separator' },
          { label: 'Cut', accelerator: 'CmdOrCtrl+X', selector: 'cut:' },
          { label: 'Copy', accelerator: 'CmdOrCtrl+C', selector: 'copy:' },
          { label: 'Paste', accelerator: 'CmdOrCtrl+V', selector: 'paste:' },
          { label: 'Select All', accelerator: 'CmdOrCtrl+A', selector: 'selectAll:' }
        ]
      }
    ];

    // if(Config.devMode) {
    template.push({
      label: 'Dev',
      submenu: [
        {
          label: 'Open Editor Devtools',
          accelerator: 'CmdOrCtrl+E',
          click: () => {
            if (!win) {
              return;
            }

            if (win.isDevToolsOpened()) {
              win.closeDevTools();
            }

            win.openDevTools();
          }
        }
      ]
    });
    // }

    // ALPHA-005: on Windows and Linux the Application menu is not where anyone
    // looks, so the legal documents get a Help menu of their own too.
    //
    // ALPHA-007 §1 puts "Report a problem…" at the top of it. No accelerator in
    // v1: every convenient key is taken in an editor, and picking a bad one is
    // worse than a menu item.
    //
    // ALPHA-003 criterion 1 puts the two diagnostic folders directly under it,
    // in that order, because that is the order they are needed in: the reporter
    // is already here, and the next question is "what do I attach". Two clicks,
    // and the reveal selects the newest file so nobody has to read timestamps.
    // The wording says "folder" rather than naming a path — `getPath('logs')`
    // resolves to three different places and none of them is memorable.
    const helpSubmenu = [
      { label: 'Report a problem…', click: () => openReportComposer() },
      { type: 'separator' },
      { label: 'Open log folder', click: () => debugLogActions.openLogFolder() }
    ];

    if (debugLogActions.hasCrashFolder()) {
      helpSubmenu.push({ label: 'Open crash report folder', click: () => debugLogActions.openCrashFolder() });
    }

    helpSubmenu.push(
      { type: 'separator' },
      { label: 'Privacy Policy', click: () => openLegalWindow('privacy', resolveStartupTheme().resolved) },
      { label: 'Alpha Terms', click: () => openLegalWindow('terms', resolveStartupTheme().resolved) }
    );

    // HLS-006: the share action. In the Application menu rather than behind a canvas control
    // because it is a decision about the machine, not about the project — and because it has to
    // be reachable to *turn off* even when the project that prompted it has been closed.
    template.push({
      label: 'Preview',
      submenu: [{ label: 'Share preview on this network\u2026', click: () => showPreviewSharing() }]
    });

    template.push({ label: 'Help', submenu: helpSubmenu });

    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  }

  /**
   * HLS-006 — the share action, and the screen that #31 says never existed.
   *
   * 🔴 **The sentence this exists to make true:** opening a project does not put the app you are
   * building on the office network, and when someone does want it there, they choose it and get a
   * URL and a token to hand over.
   *
   * Two things about the wording are deliberate:
   *
   *  - It says what a *reader of the link* can do, not what the feature is called. "Anyone on this
   *    network who opens the link can see and interact with the app you are building" is the fact
   *    somebody needs before deciding, and it is not recoverable from the phrase "share preview".
   *  - It says the link **is** the credential. A token in a URL is only as private as the URL, and
   *    a person who does not know that will paste it into a channel with three hundred people in
   *    it. That is not a caveat in a tooltip; it is the second line of the dialog.
   */
  function showPreviewSharing() {
    const status = startServer.getAccessStatus();
    if (!status) {
      dialog.showMessageBox(win, {
        type: 'info',
        title: 'Preview sharing',
        message: 'The preview server has not started yet.',
        detail: 'Try again in a moment.'
      });
      return;
    }

    if (!status.shared) {
      dialog
        .showMessageBox(win, {
          type: 'question',
          title: 'Share preview on this network',
          message: 'Put the preview of this project on your local network?',
          detail:
            'Right now the preview is only reachable from this computer.\n\n' +
            'Sharing makes it reachable from other devices on the same network \u2014 a phone, a ' +
            'tablet, a colleague\u2019s laptop. Anyone on this network who opens the link can see ' +
            'and interact with the app you are building, and can see changes as you make them.\n\n' +
            'The link contains a token, so the link is the credential: anyone you send it to can ' +
            'open it, and anyone they forward it to can too. It stops working when you stop ' +
            'sharing or quit NodeGX.\n\n' +
            'The preview will reload once while it switches over.',
          buttons: ['Share on this network', 'Cancel'],
          defaultId: 1,
          cancelId: 1,
          noLink: true
        })
        .then(({ response }) => {
          if (response !== 0) return;
          return startServer.setSharing(true).then((shared) => showPreviewShareLink(shared));
        })
        .catch((error) => {
          dialog.showMessageBox(win, {
            type: 'error',
            title: 'Share preview on this network',
            message: 'The preview could not be shared.',
            detail: String(error && error.message ? error.message : error)
          });
        });
      return;
    }

    showPreviewShareLink(status);
  }

  /** The link, the token, and the way to stop. Shown after sharing starts and whenever asked. */
  function showPreviewShareLink(status) {
    if (!status.lanAddress) {
      // Bound to every interface and there is no non-internal IPv4 to name. Saying so is better
      // than printing `0.0.0.0`, which is not an address anybody can type.
      dialog.showMessageBox(win, {
        type: 'warning',
        title: 'Preview sharing',
        message: 'The preview is shared, but this computer has no network address to hand out.',
        detail: 'It looks like there is no network connection. Connect to a network and open this again.',
        buttons: ['Stop sharing', 'Close'],
        defaultId: 1,
        cancelId: 1,
        noLink: true
      }).then(({ response }) => {
        if (response === 0) startServer.setSharing(false);
      });
      return;
    }

    dialog
      .showMessageBox(win, {
        type: 'info',
        title: 'Preview sharing',
        message: 'The preview is shared on this network.',
        detail:
          `${status.url}\n\n` +
          'Send the whole link \u2014 the part after `?t=` is the token, and without it the ' +
          'address answers nothing.\n\n' +
          'Anyone on this network who has the link can open the app. Sharing stops when you ' +
          'choose Stop sharing below, or when you quit NodeGX.',
        buttons: ['Copy link', 'Stop sharing', 'Close'],
        defaultId: 0,
        cancelId: 2,
        noLink: true
      })
      .then(({ response }) => {
        if (response === 0) electron.clipboard.writeText(status.url);
        if (response === 1) {
          startServer.setSharing(false).then(() => {
            dialog.showMessageBox(win, {
              type: 'info',
              title: 'Preview sharing',
              message: 'Sharing stopped.',
              detail: 'The preview is reachable from this computer only. The link no longer works.'
            });
          });
        }
      });
  }

  /**
   * ALPHA-005: the first-run disclosure.
   *
   * Shown once, keyed off a flag in `<userData>/firstRunLegal.json`. It states
   * the one fact a new user most needs — that nothing about their project
   * leaves the machine unless they turn AI on — and offers both documents
   * rather than burying them behind an "I agree" nobody reads.
   *
   * Deliberately not a blocking gate: this is an alpha of a GPL tool, not a
   * signup flow, and a modal that must be dismissed before the app is usable
   * would be the wrong trade for the amount of consent actually at stake.
   */
  function showFirstRunLegalNotice() {
    jsonstorage.get('firstRunLegal', (stored) => {
      if (stored && stored.shown) return;

      jsonstorage.set('firstRunLegal', { shown: true, version: app.getVersion() });

      dialog
        .showMessageBox(win, {
          type: 'info',
          title: 'Welcome to NodeGX',
          message: 'NodeGX is alpha software.',
          detail:
            'Expect bugs, and keep your work backed up — the project format will change ' +
            'between alpha versions.\n\n' +
            'Nothing about your projects leaves this machine unless you turn on the AI ' +
            'features and supply your own API key. NodeGX has no account and no analytics ' +
            'server.\n\n' +
            'Both documents are always available under the Help menu.',
          buttons: ['Get started', 'Read the privacy policy', 'Read the alpha terms'],
          defaultId: 0,
          cancelId: 0,
          noLink: true
        })
        .then(({ response }) => {
          const theme = resolveStartupTheme().resolved;
          if (response === 1) openLegalWindow('privacy', theme);
          if (response === 2) openLegalWindow('terms', theme);
        })
        .catch((error) => {
          // A disclosure that fails to render must not stop the app launching.
          console.warn('[legal] Could not show the first-run notice.', error);
        });
    });
  }

  function forwardIpcEventsToEditorWindow(events) {
    for (const eventName of events) {
      ipcMain.on(eventName, (e, ...args) => {
        win && win.webContents.send(eventName, ...args);
      });
    }
  }

  function setupAskForMediaAccessIpc() {
    const { systemPreferences } = require('electron');

    ipcMain.on('request-media-access', function (event, mediaTypes) {
      console.log('Requesting media access ' + mediaTypes);

      //MacOS is the only platform with this API. For Windows we can just return true.
      if (systemPreferences.askForMediaAccess) {
        let promises = [];
        if (mediaTypes.indexOf('video') !== -1) promises.push(systemPreferences.askForMediaAccess('camera'));
        if (mediaTypes.indexOf('audio') !== -1) promises.push(systemPreferences.askForMediaAccess('microphone'));

        Promise.all(promises)
          .then((results) => {
            let isAllowed = true;
            results.forEach(function (r) {
              isAllowed = isAllowed && r;
            });
            event.reply('request-media-access-reply', isAllowed);
          })
          .catch((error) => {
            event.reply('request-media-access-reply', false);
          });
      } else {
        event.reply('request-media-access-reply', true);
      }
    });
  }

  function setupViewerIpc() {
    // Using a timer to hackily prevent
    // the viewer from flashing when subjected
    // to consecutive hide+show after another
    let showTimer;

    ipcMain.on('viewer-attach', () => {
      closeViewer();
    });

    ipcMain.on('viewer-show', () => {
      showTimer = setTimeout(() => {
        viewerWindow.show();
        win && win.focus();
      }, 10);
    });

    ipcMain.on('viewer-hide', () => {
      if (viewerWindow.dockedInParent) {
        clearTimeout(showTimer);
        viewerWindow.hide();
        win && win.focus();
      }
    });

    ipcMain.on('viewer-detach', openViewer);
    ipcMain.on('project-closed', closeViewer);

    forwardIpcEventsToEditorWindow([
      'viewer-refreshed',
      'viewer-attach',
      'viewer-detach',
      'viewer-navigation-state',
      'viewer-capture-thumb-reply',
      'viewer-inspect-node',
      // DES-001: "Preview" on the detached preview's design-mode banner. The
      // editor window owns the mode, so the request has to travel back to it.
      'viewer-request-preview-mode'
    ]);

    //events to forward from main window to viewer
    viewerWindow.forwardIpcEvents([
      'viewer-open-devtools',
      'viewer-refresh',
      'viewer-focus',
      'viewer-inspect',
      'viewer-inspect-selected',
      'viewer-set-zoom-factor',
      'viewer-navigate-forward',
      'viewer-navigate-back',
      'viewer-set-route',
      'viewer-set-viewport-size',
      'viewer-set-inspect-mode',
      'viewer-select-node',
      'viewer-transform-origin-focus',
      'viewer-design-selection',
      'viewer-capture-thumb',
      'viewer-show-inspect-menu',
      'editor-api-response'
    ]);
  }

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  app.on('ready', function () {
    setDevDockIcon();

    createWindow();

    setupViewerIpc();

    setupAskForMediaAccessIpc();

    forwardIpcEventsToEditorWindow(['editor-api-request', 'editor-api-response']);

    setupFloatingWindowIpc();

    setupGitHubOAuthIpc();

    // Initialize Web OAuth handlers for GitHub (with protocol handler)
    initializeGitHubOAuthHandlers(app);

    setupMainWindowControlIpc();

    // Both before setupMenu: they are what give the Help menu items something
    // to call, and `setupDebugLog` also decides whether the crash-folder item
    // exists at all.
    setupDebugLog();

    setupReportIpc();

    setupMenu();

    showFirstRunLegalNotice();

    startServer(
      app,
      projectGetSettings,
      projectGetInfo,
      projectGetComponentBundleExport,
      projectGetDesignTokenCss
    );

    // Initialize local backend IPC handlers
    setupBackendIPC();

    // AAQ-011/F10 — claim ownership of the backends this session spawns, and
    // reap the ones a previous session left behind.
    //
    // This must run before anything can start a backend, and it does: the
    // renderer cannot ask for one until its window has loaded, and
    // `startBackend` awaits this sweep regardless. Deliberately not awaited
    // here — `app.on('ready')` is not an async context, and holding the window
    // back on a process sweep would trade a rare orphan for a slow launch on
    // every launch.
    backendManager.claimAndSweep();

    // WF-006: open the execution-history store and register the IPC handlers
    // the Execution History Panel's hooks call.
    setupExecutionHistoryIPC();

    // MCP-001: where the two MCP server bundles are, and whether the open
    // project is one the authoring server will accept. Both answers need the
    // filesystem and `app.getAppPath()`, so they cannot be worked out in the
    // renderer that renders them.
    require('./src/mcp/mcpFrontDoor').setupMcpIPC(electron.ipcMain);

    // BLD-014: the CDP half of "look at it". A hidden BrowserWindow driven
    // through `webContents.debugger` — only the main process can open one, and
    // only the main process can attach a debugger to it.
    require('./src/render-capture').setupRenderCaptureIPC(electron.ipcMain);

    // WF-004: executions now happen inside nodegx-backend child processes,
    // each with its own store — the panel's IPC merges them with the local one.
    const { executionHistoryManager } = require('./src/execution-history/ExecutionHistoryManager');
    executionHistoryManager.setRemoteSources(() => backendManager.getRunningEndpoints());

    DesignToolImportServer.start(projectGetInfo);

    try {
      startUDPMulticast();
    } catch (e) {
      console.log('Failed to start UDP Multicast');
    }
  });

  app.on('will-finish-launching', function () {
    app.on('open-url', function (event, uri) {
      console.log('open-url', uri);
      event.preventDefault();

      // This used to skip `noodl://github-callback`, which the OAuth
      // authorization-code flow produced. F63 replaced that flow with the device
      // flow, which has no redirect and so no callback URL — nothing produces
      // that scheme any more, and the guard silently swallowed nothing.
      win && win.webContents.send('open-noodl-uri', uri);
      process.env.noodlURI = uri;
    });
  });

  // Quit when all windows are closed.
  app.on('window-all-closed', () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  // ── Quitting without dropping the user's last edit ────────────────────────
  //
  // The renderer debounces project saves by a second (`scheduleProjectSave` in
  // projectmodel.ts), so an edit followed immediately by a quit used to be lost
  // silently — nothing here asked it to flush.
  //
  // Note this handler was already `async` and already `await`ed `stopAll()`:
  // that await never did anything, because **Electron does not wait for an
  // async `before-quit` handler**. The only way to hold a quit open is
  // `preventDefault()` and quit again later, which is what the handshake below
  // does — so the backend teardown becomes correct as a side effect.
  //
  // The timeouts are not optional, and they cover *both* awaited steps. Holding
  // the quit open is what makes the flush possible, but it is also what makes a
  // hang fatal: while `stopAll()` was fire-and-forget, a backend that never
  // finished stopping could not block anything, and now it could. Nothing here
  // may cost the user more than a few seconds of their ability to close the app.
  const PROJECT_FLUSH_TIMEOUT_MS = 5000;
  const BACKEND_STOP_TIMEOUT_MS = 5000;

  /** Resolve with `onTimeout` if `promise` has not settled in `ms`. */
  function withTimeout(promise, ms, onTimeout) {
    return Promise.race([
      Promise.resolve(promise).catch((e) => {
        console.log('Error during quit teardown:', e);
      }),
      new Promise((resolve) => setTimeout(() => resolve(onTimeout), ms))
    ]);
  }

  function flushRendererProjectSave() {
    return new Promise((resolve) => {
      // A crashed renderer is checked explicitly, not just a destroyed one: the
      // crash handler calls `win.close()`, and a dead renderer will never reply,
      // so without this every crash-restart would sit out the full timeout.
      if (!win || win.isDestroyed() || win.webContents.isDestroyed() || win.webContents.isCrashed()) {
        return resolve('no-window');
      }

      let settled = false;
      const finish = (reason) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        ipcMain.removeListener('flush-project-save-done', onDone);
        resolve(reason);
      };

      const onDone = () => finish('flushed');
      const timer = setTimeout(() => finish('timeout'), PROJECT_FLUSH_TIMEOUT_MS);

      ipcMain.on('flush-project-save-done', onDone);
      win.webContents.send('flush-project-save');
    });
  }

  let quitFlushStarted = false;
  let readyToQuit = false;

  app.on('before-quit', (event) => {
    if (readyToQuit) return;

    event.preventDefault();
    if (quitFlushStarted) return; // a second ⌘Q while the first is still draining
    quitFlushStarted = true;

    flushRendererProjectSave()
      .then((reason) => {
        if (reason === 'timeout') {
          console.log('Timed out waiting for the renderer to flush its pending project save; quitting anyway');
        }
      })
      .then(() => withTimeout(backendManager.stopAll(), BACKEND_STOP_TIMEOUT_MS, 'timeout'))
      .then((reason) => {
        if (reason === 'timeout') {
          console.log('Timed out stopping local backends; quitting anyway');
        }
      })
      .catch((e) => console.log('Error stopping backends:', e))
      .then(() => {
        // AAQ-011/F10 — drop this session's ownership claim last, after the
        // stops. Order matters: while the claim stands, every record it owns is
        // protected from the next launch's reaper, so releasing it before the
        // backends are actually down would open a window in which a crash here
        // leaves live children that the next sweep can see but this one can no
        // longer stop. Releasing after means a `stopAll` timeout leaves the
        // records unowned, which is exactly what makes the next launch reap
        // them.
        backendManager.releaseOwnership();
        readyToQuit = true;
        app.quit();
      });
  });

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (win === null) {
      createWindow();
    }
  });

  function isAppFocused() {
    return BrowserWindow.getAllWindows().some((x) => x.isFocused());
  }

  // Lets make sure we only trigger it when the app have been unfocused.
  let appHaveFocus = true;

  app.on('browser-window-focus', (event, win) => {
    win && win.webContents.send('window-focused');

    if (isAppFocused() && !appHaveFocus) {
      appHaveFocus = true;
      win && win.webContents.send('app-focused');
    }
  });

  app.on('browser-window-blur', (event, win) => {
    win && win.webContents.send('window-blurred');

    if (!isAppFocused()) {
      appHaveFocus = false;
      win && win.webContents.send('app-blurred');
    }
  });

  // --------------------------------------------------------------------------------------------------------------------
  // Floating windows
  // --------------------------------------------------------------------------------------------------------------------
  function setupFloatingWindowIpc() {
    ipcMain.on('floating-window-close', function (event, options) {
      closeFloatingWindow(options);
    });
    ipcMain.on('floating-window-open', function (event, options) {
      openFloatingWindow(options);
    });
  }

  // --------------------------------------------------------------------------------------------------------------------
  // GitHub OAuth
  // --------------------------------------------------------------------------------------------------------------------
  function setupGitHubOAuthIpc() {
    const { safeStorage } = require('electron');

    // Save GitHub token securely
    ipcMain.handle('github-save-token', async (event, token) => {
      try {
        if (safeStorage.isEncryptionAvailable()) {
          const encrypted = safeStorage.encryptString(token);
          jsonstorage.set('github.token', encrypted.toString('base64'));
          console.log('✅ GitHub token saved securely');
        } else {
          console.warn('⚠️ Encryption not available, storing token in plain text');
          jsonstorage.set('github.token', token);
        }
      } catch (error) {
        console.error('Failed to save GitHub token:', error);
        throw error;
      }
    });

    // Load GitHub token
    ipcMain.handle('github-load-token', async (event) => {
      try {
        // Use Promise wrapper for callback-based jsonstorage.get
        const stored = await new Promise((resolve) => {
          jsonstorage.get('github.token', (data) => {
            resolve(data);
          });
        });

        if (!stored) return null;

        if (safeStorage.isEncryptionAvailable()) {
          try {
            const buffer = Buffer.from(stored, 'base64');
            const decrypted = safeStorage.decryptString(buffer);
            console.log('✅ GitHub token loaded');
            return decrypted;
          } catch (error) {
            console.error('Failed to decrypt token, may be corrupted:', error);
            return null;
          }
        } else {
          // Fallback: token was stored in plain text
          return stored;
        }
      } catch (error) {
        console.error('Failed to load GitHub token:', error);
        return null;
      }
    });

    // Clear GitHub token
    ipcMain.handle('github-clear-token', async (event) => {
      try {
        jsonstorage.set('github.token', null);
        console.log('✅ GitHub token cleared');
      } catch (error) {
        console.error('Failed to clear GitHub token:', error);
        throw error;
      }
    });
  }

  // --------------------------------------------------------------------------------------------------------------------
  // Main window control
  // --------------------------------------------------------------------------------------------------------------------
  function setupMainWindowControlIpc() {
    ipcMain.on('main-window-resize', function (event, options) {
      resizeMainWindow(options);
    });

    // HLS-009 — an agent opened a project; put the window where the person can see it.
    //
    // ⚠️ `focus()` alone is not enough on any of the three platforms: a minimised window stays
    // minimised and a hidden one stays hidden, and in both cases the renderer has already routed
    // to the project, so the tool would report success against a window nobody can see. That is
    // the same class of lie as HLS-013's `res.ok` — a true statement about the wrong thing.
    ipcMain.on('main-window-focus', function () {
      if (!win) return;
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    });
  }
}

function startUDPMulticast() {
  var dgram = require('dgram');
  var server = dgram.createSocket('udp4');
  var os = require('os');
  const { ipcMain } = electron;

  server.bind();

  server.on('listening', function () {
    server.setBroadcast(true);
    server.setMulticastTTL(128);
    try {
      server.addMembership('225.0.0.100');
    } catch (e) {
      //this can happen when running without a connection to a router, just ignore for now
    }
    setInterval(broadcastNew, 2000);
  });

  let projectName = 'No Project Open';
  ipcMain.on('project-opened', (e, newProjectName) => {
    projectName = newProjectName;
    broadcastNew();
    DesignToolImportServer.setProjectName(newProjectName);
  });
  ipcMain.on('project-closed', () => {
    projectName = 'No Project Open';
    DesignToolImportServer.setProjectName(null);
  });

  //converts an object to a UTF16 ArrayBuffer
  function jsToArrayBuffer(obj) {
    const str = JSON.stringify(obj);
    const buf = new ArrayBuffer(str.length * 2);
    const bufView = new Uint16Array(buf);
    for (let i = 0, strLen = str.length; i < strLen; i++) {
      bufView[i] = str.charCodeAt(i);
    }
    return buf;
  }

  app.on('quit', () => {
    //broadcast a message when shutting down so clients can
    //remove the editor as fast as possible, without having to wait
    //for a timeout
    const hostname = os.hostname();

    if (hostname) {
      const message = Buffer.from(
        jsToArrayBuffer({ https: process.env.ssl ? true : false, hostname, status: 'closed' })
      );
      server.send(message, 0, message.length, 8575, '225.0.0.100');
    }
  });

  function broadcastNew() {
    const hostname = os.hostname();
    const httpPort = process.env.NOODLPORT || 8574;

    if (hostname) {
      const message = Buffer.from(
        jsToArrayBuffer({ https: process.env.ssl ? true : false, hostname, httpPort, projectName, status: 'active' })
      );
      server.send(message, 0, message.length, 8575, '225.0.0.100');
    }
  }
}

// Find domain name argument if existing
process.env.noodlArgs = JSON.stringify(args);
for (var i = 0; i < args.length; i++) {
  if (args[i].indexOf('--autoupdate=') === 0) {
    process.env.autoUpdate = args[i].split('=')[1];
  } else if (args[i].indexOf('--lessons=') === 0) {
    process.env.lessons = path.resolve(args[i].split('=')[1]);
  } else if (args[i].indexOf('--feed=') === 0) {
    process.env.feed = path.resolve(args[i].split('=')[1]);
  } else if (args[i].indexOf('--library=') === 0) {
    process.env.library = path.resolve(args[i].split('=')[1]);
  } else if (args[i].indexOf('--previews=') === 0) {
    process.env.previews = path.resolve(args[i].split('=')[1]);
  } else if (args[i].indexOf('--projectTemplates=') === 0) {
    process.env.projectTemplates = path.resolve(args[i].split('=')[1]);
  } else if (args[i].indexOf('--ssl-cert=') === 0) {
    process.env.sslCert = path.resolve(args[i].split('=')[1]);
  } else if (args[i].indexOf('--ssl-key=') === 0) {
    process.env.sslKey = path.resolve(args[i].split('=')[1]);
  } else if (args[i].indexOf('noodl:') === 0) {
    process.env.noodlURI = args[i];
  }
}

let flagsOk = true;

if (process.env.sslCert && !process.env.sslKey) {
  console.log('missing --sslKey');
  flagsOk = false;
}

if (!process.env.sslCert && process.env.sslKey) {
  console.log('missing --sslCert');
  flagsOk = false;
}

if (process.env.sslCert && process.env.sslKey) {
  process.env.ssl = 'true';
}

if (args.indexOf('--merge') !== -1) {
  // The noodl app can be started in merge mode, then it will merge two project files and then
  // exit the app
  handleProjectMerge(args);
} else if (flagsOk) {
  launchApp();
} else {
  app.quit();
}
