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
const { startCloudFunctionServer, closeRuntimeWhenWindowCloses } = require('./src/cloud-function-server');
const { setupBackendIPC, backendManager } = require('./src/local-backend');
const { setupExecutionHistoryIPC } = require('./src/execution-history');
const DesignToolImportServer = require('./src/design-tool-import-server');
const jsonstorage = require('../shared/utils/jsonstorage');
const StorageApi = require('./src/StorageApi');
const { initializeGitHubOAuthHandlers } = require('./github-oauth-handler');

const { handleProjectMerge } = require('./src/merge-driver');

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

function launchApp() {
  const { Menu, BrowserWindow, ipcMain, shell } = electron;
  const Config = require('../shared/config/config');

  require('@electron/remote/main').initialize();

  const appPath = app.getAppPath();

  // App deep-link scheme (rebranded to NodeGX in REV-007). The GitHub OAuth
  // callback scheme stays `noodl://` (see github-oauth-handler.js) because it is
  // bound to the externally-registered OAuth app redirect URI.
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

  function cloudServicesGetActive(callback) {
    makeEditorAPIRequest('cloudServicesGetActive', undefined, callback);
  }

  process.env.exePath = app.getPath('exe');
  let reopenWindow = false;

  function createWindow() {
    win = new BrowserWindow({
      width: 1368,
      height: 900,
      acceptFirstMouse: true,
      backgroundColor: '#131313',
      center: true,
      frame: false,
      minWidth: 600,
      minHeight: 300,
      titleBarStyle: 'hidden',
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

    win.once('ready-to-show', () => {
      win.show();
    });

    win.on('closed', () => {
      win = null;
      clearTimeout(saveWindowSettingsTimeout);
      if (reopenWindow) {
        reopenWindow = false;
        createWindow();
        closeRuntimeWhenWindowCloses(win);
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

  let submenu = [
    {
      label: 'About Application',
      click: () => {
        require('about-window').default({
          icon_path: appPath + '/src/assets/images/icon.png',
          copyright: 'Copyright (c) 2023 Future Platforms AB',
          description: buildNumber ? 'Build ' + buildNumber : undefined
        });
      }
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

    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
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
      'viewer-inspect-node'
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
      'viewer-capture-thumb',
      'viewer-show-inspect-menu',
      'editor-api-response'
    ]);
  }

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  app.on('ready', function () {
    createWindow();

    setupViewerIpc();

    setupAskForMediaAccessIpc();

    forwardIpcEventsToEditorWindow(['editor-api-request', 'editor-api-response']);

    setupFloatingWindowIpc();

    setupGitHubOAuthIpc();

    // Initialize Web OAuth handlers for GitHub (with protocol handler)
    initializeGitHubOAuthHandlers(app);

    setupMainWindowControlIpc();

    setupMenu();

    startServer(app, projectGetSettings, projectGetInfo, projectGetComponentBundleExport);

    startCloudFunctionServer(app, cloudServicesGetActive);
    closeRuntimeWhenWindowCloses(win);

    // Initialize local backend IPC handlers
    setupBackendIPC();

    // WF-006: open the execution-history store and register the IPC handlers
    // the Execution History Panel's hooks call.
    setupExecutionHistoryIPC();

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

      // GitHub OAuth callbacks are handled by github-oauth-handler.js
      // Only handle other noodl:// URIs here
      if (!uri.startsWith('noodl://github-callback')) {
        win && win.webContents.send('open-noodl-uri', uri);
        process.env.noodlURI = uri;
      }
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

  // Stop all local backends on quit
  app.on('before-quit', async () => {
    try {
      await backendManager.stopAll();
    } catch (e) {
      console.log('Error stopping backends:', e);
    }
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
  if (args[i].indexOf('--api=') === 0) {
    process.env.apiEndpoint = args[i].split('=')[1];
  } else if (args[i].indexOf('--autoupdate=') === 0) {
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
