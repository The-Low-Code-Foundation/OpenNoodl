import * as remote from '@electron/remote';
import { ipcRenderer } from 'electron';
import React from 'react';
import { createRoot } from 'react-dom/client';

import './process-setup';

import { EventDispatcher } from '../shared/utils/EventDispatcher';
import { NodeLibrary } from './src/models/nodelibrary';
import { ProjectModel } from './src/models/projectmodel';

// Design tokens — canonical source lives in noodl-core-ui (UIX-001)
import '@noodl-core-ui/styles/custom-properties/animations.css';
import '@noodl-core-ui/styles/custom-properties/fonts.css';
import '@noodl-core-ui/styles/custom-properties/colors.css';
import '@noodl-core-ui/styles/custom-properties/spacing.css';

import Router from './src/router';

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

function setupViewerIpc() {
  ipcRenderer.on('viewer-refreshed', () => {
    EventDispatcher.instance.emit('viewer-refreshed');
  });

  ipcRenderer.on('viewer-closed', () => {
    EventDispatcher.instance.emit('viewer-closed');
  });
}

window.addEventListener('DOMContentLoaded', () => {
  // Register node adapters
  require('./src/models/NodeTypeAdapters/registeradapters');

  // Disable context menu. `return false` from the jQuery handler this replaces
  // meant preventDefault + stopPropagation; PopupLayer's own body-level
  // contextmenu listener is on the same element, so it still runs.
  document.body.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  ipcRenderer.on('showAutoUpdatePopup', () => {
    //@ts-expect-error
    window._hasNewAutoUpdateAvailable = true;
  });

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
