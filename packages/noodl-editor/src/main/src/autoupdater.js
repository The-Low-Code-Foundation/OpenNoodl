const { app, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
//const {autoUpdateBaseUrl} = require('../../shared/config/config');

function setupAutoUpdate(window) {
  if (process.env.autoUpdate === 'no') return;

  if (process.platform === 'linux') {
    return;
  }

  function _checkForUpdates() {
    // `checkForUpdates()` returns a PROMISE, so a `try/catch` around it catches
    // only a synchronous throw — which this call does not do. Every failure
    // (offline, 404, malformed feed) rejected past the catch instead, and the
    // packaged app printed an UnhandledPromiseRejectionWarning on every launch:
    // the v0.1.0 release has no `latest-mac.yml`, so the very first check 404s.
    // Node's default for an unhandled rejection has been `throw` since v15 —
    // Electron currently downgrades it to a warning, which is the only reason
    // this was noise rather than a crash on startup.
    //
    // The handler deliberately does NOT retry. The `error` listener below
    // already schedules one for the same failure, and it is the channel that
    // actually fires here — retrying from both would spawn two checks per
    // failure, each of which fails and spawns two more. This only has to stop
    // the rejection from being unhandled.
    try {
      const pending = autoUpdater.checkForUpdates();
      if (pending && typeof pending.catch === 'function') {
        pending.catch(() => {
          /* reported by the `error` listener, which also owns the retry */
        });
      }
    } catch (e) {
      // Failed to check for updates, try again later
      setTimeout(() => {
        _checkForUpdates();
      }, 60 * 1000);
    }
  }
  _checkForUpdates();

  autoUpdater.addListener('update-available', (event) => {
    console.log('A new update is available, downloading...');
  });

  autoUpdater.addListener('update-downloaded', (event) => {
    window.webContents.send('showAutoUpdatePopup');

    return true;
  });

  ipcMain.on('autoUpdatePopupClosed', (event, restartNow) => {
    if (restartNow) {
      autoUpdater.quitAndInstall();
    }
  });

  /* autoUpdater.addListener("error", (error) => {
    console.log('Auto update error', error);
  });*/

  autoUpdater.addListener('update-not-available', () => {
    setTimeout(() => {
      _checkForUpdates();
    }, 60 * 1000);
  });

  autoUpdater.addListener('error', (event) => {
    // There was an error while trying to update, try again
    console.log('Error while auto updating, trying again in a while...');
    setTimeout(() => {
      _checkForUpdates();
    }, 60 * 1000);
  });
}

module.exports = {
  setupAutoUpdate
};
