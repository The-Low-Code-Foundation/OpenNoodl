import * as remote from '@electron/remote';
import { ipcRenderer } from 'electron';
import React from 'react';
import { createRoot } from 'react-dom/client';

import './process-setup';

import { EventDispatcher } from '../shared/utils/EventDispatcher';
import { flushAiSidecars } from './src/models/AiAssistant/thread/installThreadPersistence';
import { NodeLibrary } from './src/models/nodelibrary';
import { flushPendingProjectSave, ProjectModel } from './src/models/projectmodel';

// Design tokens — canonical source lives in noodl-core-ui (UIX-001)
import '@noodl-core-ui/styles/custom-properties/animations.css';
import '@noodl-core-ui/styles/custom-properties/fonts.css';
import '@noodl-core-ui/styles/custom-properties/colors.css';
import '@noodl-core-ui/styles/custom-properties/spacing.css';

import { ThemeManager } from './src/models/ThemeManager';
import Router from './src/router';

// Apply a theme (data-theme on <html>) before first paint to avoid a flash of
// the wrong theme. This uses the OS preference; ThemeManager.init() below then
// reconciles to the user's saved choice once the settings store has loaded.
// (UIX-008 — launcher + editor share this one window, so this covers both.)
ThemeManager.applyProvisional();

// Build canary: Verify fresh code is loading
console.log('🔥🔥 BUILD TIMESTAMP:', new Date().toISOString());

ipcRenderer.on('open-noodl-uri', async (event, uri) => {
  if (uri.startsWith('noodl:import/http')) {
    console.log('import: ', uri);
    EventDispatcher.instance.emit('importFromUrl', uri.substring('noodl:import/'.length));
  }
});

ipcRenderer.on('import-projectmetadata', (event, data) => {
  ProjectModel.instance.mergeMetadata(data);
});

// ── Draining the autosave debounce on the way out ───────────────────────────
//
// `scheduleProjectSave()` waits a second before writing, and nothing used to
// drain that timer when the app went away: an edit followed by ⌘Q inside the
// debounce was lost silently, on every edit path — metadata and every node,
// connection and component change alike.
//
// Two triggers, deliberately overlapping, because neither covers the other's
// cases:
//
//   * the main process holds the quit open and asks for a flush (⌘Q, the app
//     menu, the dock, and the window close button — see main.js). This is the
//     only one that can guarantee the *last* keystroke is written;
//   * `blur` writes whenever the editor stops being the focused window, which
//     reaches what no quit handler can — a crash, a force-kill, an OS-initiated
//     shutdown. It bounds the loss to "since you last switched away" rather
//     than "since you last saved".
//
// Registered at module scope rather than inside `DOMContentLoaded` so a quit
// during startup is handled too. Both are free when nothing is pending:
// `flushPendingProjectSave()` returns immediately unless an edit is queued.
// BLD-006: the AI sidecars ride the same handshake, and one of them has been
// waiting for it. `PlanSessionSidecar.flush()` was written for the quit path in
// AIB-003 slice 4 and never had a caller, so an unapplied build staged inside
// its 750ms debounce was lost to ⌘Q — the same defect this handler exists to
// fix, one directory over. `flushAiSidecars` drains both and never rejects.
ipcRenderer.on('flush-project-save', () => {
  const reply = () => ipcRenderer.send('flush-project-save-done');
  Promise.all([flushPendingProjectSave(), flushAiSidecars()]).then(reply, reply);
});

window.addEventListener('blur', () => {
  flushPendingProjectSave();
  void flushAiSidecars();
});

function setupViewerIpc() {
  ipcRenderer.on('viewer-refreshed', () => {
    EventDispatcher.instance.emit('viewer-refreshed');
  });

  ipcRenderer.on('viewer-closed', () => {
    EventDispatcher.instance.emit('viewer-closed');
  });
}

window.addEventListener('DOMContentLoaded', () => {
  // Reconcile the theme to the persisted choice + start following the OS in
  // system mode (UIX-008). applyProvisional() above already prevented a flash.
  ThemeManager.init();

  // Register node adapters
  require('./src/models/NodeTypeAdapters/registeradapters');

  // Disable context menu. `return false` from the jQuery handler this replaces
  // meant preventDefault + stopPropagation; PopupLayer's own body-level
  // contextmenu listener is on the same element, so it still runs.
  document.body.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  // `showAutoUpdatePopup` set a `window._hasNewAutoUpdateAvailable` global that
  // nothing ever read. Update state now lives in the main process and reaches
  // the renderer as `update:state`; see `views/UpdateManager`.

  setupViewerIpc();

  ipcRenderer.on('window-focused', () => {
    EventDispatcher.instance.notifyListeners('window-focused');
  });

  document.addEventListener('mousedown', () => {
    remote.getCurrentWindow().focus();
  });

  // Activity detector
  let lastActiveTime = +new Date();
  document.addEventListener('mousedown', function (evt) {
    const now = +new Date();
    if (now > lastActiveTime + 10 * 60 * 1000) {
      // Wake up after 10 minutes of inactivity
      EventDispatcher.instance.notifyListeners('wakeup');
    }
    lastActiveTime = now;
  });

  EventDispatcher.instance.on('ProjectModel.instanceWillChange', () => {
    //@ts-expect-error
    window.NodeLibraryData = undefined;
    NodeLibrary.instance.reload();
  }, null);

  // Create the main element
  const rootElement = document.getElementById('root');
  createRoot(rootElement).render(React.createElement(Router, { uri: remote.process.env.noodlURI }));
});
