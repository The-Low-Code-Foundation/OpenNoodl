const { app, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
//const {autoUpdateBaseUrl} = require('../../shared/config/config');

// How long to wait before asking GitHub again.
//
// Every outcome used to re-arm a 60-second timer, so an editor left open all
// day made ~1,440 requests to the releases API and kept doing so forever (F66).
// Nothing about a desktop app needs update news that fresh, and the releases
// API is rate-limited per IP — several editors behind one office NAT could
// exhaust the anonymous quota between them, at which point every check fails.
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // after "you are up to date"
const RETRY_MIN_MS = 5 * 60 * 1000; // first retry after a failure
const RETRY_MAX_MS = 4 * 60 * 60 * 1000; // ceiling for the backoff

function setupAutoUpdate(window) {
  if (process.env.autoUpdate === 'no') return;

  // Linux has no in-app update path at all: electron-updater cannot replace an
  // AppImage it did not launch, and a .deb is the package manager's business.
  // The check is skipped rather than attempted-and-failed, which is why the
  // release workflow produces no `latest-linux.yml` — nothing would read it.
  // RELEASE-PROCESS.md says so out loud, because an absent feed and a broken
  // one look identical from the outside.
  if (process.platform === 'linux') {
    return;
  }

  // Backoff state, shared by both failure channels below.
  let retryDelay = RETRY_MIN_MS;
  let timer = null;

  function _scheduleCheck(delay) {
    // One pending check at a time. Without this, an `error` arriving while an
    // `update-not-available` timer was already armed would leave two chains
    // running, and each further failure would double the request rate instead
    // of backing off.
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      _checkForUpdates();
    }, delay);
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
      // Synchronous throw — the `error` listener never fires for this one, so
      // it is the only channel that can schedule the retry.
      _scheduleCheck(retryDelay);
      retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS);
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
    // A successful check, so the backoff resets — a machine that was offline
    // for an hour goes straight back to the normal cadence once it reconnects
    // rather than staying at its escalated retry delay.
    retryDelay = RETRY_MIN_MS;
    _scheduleCheck(CHECK_INTERVAL_MS);
  });

  autoUpdater.addListener('error', (event) => {
    // There was an error while trying to update, try again — with a growing
    // delay, so a permanently unreachable feed (no `latest-mac.yml` on the
    // release, a firewall, an offline laptop) costs a handful of requests an
    // hour rather than one a minute for as long as the editor stays open.
    console.log('Error while auto updating, trying again in a while...');
    _scheduleCheck(retryDelay);
    retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS);
  });

  // The timer holds the event loop open and would keep the process alive after
  // the last window closes. Nothing else cancels it, because until now nothing
  // held a handle to it.
  app.on('before-quit', () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  });
}

module.exports = {
  setupAutoUpdate
};
