/**
 * ALPHA-002 / F66 — the update check's request cadence.
 *
 * The finding: every outcome re-armed a 60-second timer, so an editor left open
 * all day made ~1,440 requests to the GitHub releases API and kept doing so for
 * as long as it stayed open. The retry-on-error path did the same, which is the
 * worse half — a build whose feed genuinely 404s (exactly what v0.1.0 was, with
 * no `latest-mac.yml` on the release) retried once a minute, forever.
 *
 * These tests pin the cadence rather than the implementation: they assert how
 * many requests reach `checkForUpdates` over a stretch of time, which is the
 * thing the finding was actually about.
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

// Listeners registered by the module under test, keyed by event name.
let updaterListeners;
let appListeners;
let checkForUpdates;
let ipcHandlers;

function loadModule({ platform = 'darwin' } = {}) {
  jest.resetModules();
  updaterListeners = {};
  appListeners = {};
  ipcHandlers = {};

  // `checkForUpdates()` returns a promise in the real electron-updater. It
  // resolves here; failure is delivered through the 'error' listener, which is
  // how the real one behaves too.
  checkForUpdates = jest.fn(() => Promise.resolve(null));

  jest.doMock(
    'electron',
    () => ({
      app: {
        on: (event, fn) => {
          appListeners[event] = fn;
        }
      },
      ipcMain: {
        on: (event, fn) => {
          ipcHandlers[event] = fn;
        }
      }
    }),
    { virtual: true }
  );

  jest.doMock(
    'electron-updater',
    () => ({
      autoUpdater: {
        checkForUpdates,
        quitAndInstall: jest.fn(),
        addListener: (event, fn) => {
          updaterListeners[event] = fn;
        }
      }
    }),
    { virtual: true }
  );

  // `process.platform` is read inside setupAutoUpdate, not at require time, so
  // the override has to outlive this function. afterEach puts it back.
  Object.defineProperty(process, 'platform', { value: platform, configurable: true });

  // eslint-disable-next-line global-require
  return require('../src/main/src/autoupdater');
}

const REAL_PLATFORM = Object.getOwnPropertyDescriptor(process, 'platform');

const fakeWindow = { webContents: { send: jest.fn() } };

beforeEach(() => {
  jest.useFakeTimers();
  delete process.env.autoUpdate;
});

afterEach(() => {
  jest.useRealTimers();
  Object.defineProperty(process, 'platform', REAL_PLATFORM);
});

describe('setupAutoUpdate — request cadence (F66)', () => {
  it('checks once immediately', () => {
    const { setupAutoUpdate } = loadModule();
    setupAutoUpdate(fakeWindow);

    expect(checkForUpdates).toHaveBeenCalledTimes(1);
  });

  it('does not re-check every minute after "up to date" — the whole finding', () => {
    const { setupAutoUpdate } = loadModule();
    setupAutoUpdate(fakeWindow);

    updaterListeners['update-not-available']();

    // The old code checked 60 times in this window. It must now be silent.
    jest.advanceTimersByTime(60 * MINUTE);
    expect(checkForUpdates).toHaveBeenCalledTimes(1);

    // ...and check again once the real interval elapses.
    jest.advanceTimersByTime(3 * HOUR);
    expect(checkForUpdates).toHaveBeenCalledTimes(2);
  });

  it('backs off exponentially while the feed keeps failing', () => {
    const { setupAutoUpdate } = loadModule();
    setupAutoUpdate(fakeWindow);

    // First failure: retry after 5 minutes, not 1.
    updaterListeners.error(new Error('404'));
    jest.advanceTimersByTime(4 * MINUTE);
    expect(checkForUpdates).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1 * MINUTE);
    expect(checkForUpdates).toHaveBeenCalledTimes(2);

    // Second failure: 10 minutes.
    updaterListeners.error(new Error('404'));
    jest.advanceTimersByTime(9 * MINUTE);
    expect(checkForUpdates).toHaveBeenCalledTimes(2);
    jest.advanceTimersByTime(1 * MINUTE);
    expect(checkForUpdates).toHaveBeenCalledTimes(3);

    // Third failure: 20 minutes.
    updaterListeners.error(new Error('404'));
    jest.advanceTimersByTime(19 * MINUTE);
    expect(checkForUpdates).toHaveBeenCalledTimes(3);
    jest.advanceTimersByTime(1 * MINUTE);
    expect(checkForUpdates).toHaveBeenCalledTimes(4);
  });

  it('caps the backoff at four hours rather than growing without bound', () => {
    const { setupAutoUpdate } = loadModule();
    setupAutoUpdate(fakeWindow);

    // Drive the delay past the ceiling: 5m→10m→20m→40m→80m→160m→(320m capped).
    for (let i = 0; i < 12; i++) {
      updaterListeners.error(new Error('offline'));
      jest.advanceTimersByTime(4 * HOUR);
    }
    const callsSoFar = checkForUpdates.mock.calls.length;

    // At the cap, four hours must produce exactly one more check.
    updaterListeners.error(new Error('offline'));
    jest.advanceTimersByTime(4 * HOUR - 1);
    expect(checkForUpdates).toHaveBeenCalledTimes(callsSoFar);
    jest.advanceTimersByTime(1);
    expect(checkForUpdates).toHaveBeenCalledTimes(callsSoFar + 1);
  });

  it('resets the backoff once a check succeeds', () => {
    const { setupAutoUpdate } = loadModule();
    setupAutoUpdate(fakeWindow);

    // Escalate to a 20-minute delay.
    updaterListeners.error(new Error('offline'));
    jest.advanceTimersByTime(5 * MINUTE);
    updaterListeners.error(new Error('offline'));
    jest.advanceTimersByTime(10 * MINUTE);

    // Reconnect. A laptop back online should return to the normal cadence,
    // not stay at its escalated delay.
    updaterListeners['update-not-available']();
    const afterSuccess = checkForUpdates.mock.calls.length;
    jest.advanceTimersByTime(4 * HOUR);
    expect(checkForUpdates).toHaveBeenCalledTimes(afterSuccess + 1);

    // The next failure starts again from five minutes.
    updaterListeners.error(new Error('offline'));
    jest.advanceTimersByTime(5 * MINUTE);
    expect(checkForUpdates).toHaveBeenCalledTimes(afterSuccess + 2);
  });

  it('keeps exactly one pending check when both channels fire', () => {
    const { setupAutoUpdate } = loadModule();
    setupAutoUpdate(fakeWindow);

    // An 'error' arriving while an 'update-not-available' timer is armed used
    // to leave two chains running, doubling the request rate per failure.
    updaterListeners['update-not-available']();
    updaterListeners.error(new Error('flapping'));

    jest.advanceTimersByTime(4 * HOUR);
    // One scheduled check, not two.
    expect(checkForUpdates).toHaveBeenCalledTimes(2);
  });

  it('cancels the pending check on quit, so the timer cannot hold the app open', () => {
    const { setupAutoUpdate } = loadModule();
    setupAutoUpdate(fakeWindow);

    updaterListeners['update-not-available']();
    expect(typeof appListeners['before-quit']).toBe('function');

    appListeners['before-quit']();
    jest.advanceTimersByTime(8 * HOUR);
    expect(checkForUpdates).toHaveBeenCalledTimes(1);
  });
});

describe('setupAutoUpdate — platforms that opt out', () => {
  it('never checks on Linux (F74 — there is no feed to read)', () => {
    const { setupAutoUpdate } = loadModule({ platform: 'linux' });
    setupAutoUpdate(fakeWindow);

    jest.advanceTimersByTime(24 * HOUR);
    expect(checkForUpdates).not.toHaveBeenCalled();
  });

  it('never checks when autoUpdate is switched off', () => {
    process.env.autoUpdate = 'no';
    const { setupAutoUpdate } = loadModule();
    setupAutoUpdate(fakeWindow);

    jest.advanceTimersByTime(24 * HOUR);
    expect(checkForUpdates).not.toHaveBeenCalled();
  });
});
