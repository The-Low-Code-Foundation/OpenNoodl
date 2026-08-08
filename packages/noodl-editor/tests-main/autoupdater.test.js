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
let mockUpdater;

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
        getVersion: () => '0.1.4',
        on: (event, fn) => {
          appListeners[event] = fn;
        }
      },
      ipcMain: {
        on: (event, fn) => {
          ipcHandlers[event] = fn;
        },
        handle: (event, fn) => {
          ipcHandlers[event] = fn;
        }
      },
      // No windows, so `broadcast()` is a no-op and no state reaches a
      // renderer. These tests are about the main process's own behaviour.
      BrowserWindow: { getAllWindows: () => [] },
      net: { request: () => ({ on: () => {}, end: () => {} }) }
    }),
    { virtual: true }
  );

  mockUpdater = {
    checkForUpdates,
    downloadUpdate: jest.fn(() => Promise.resolve(null)),
    quitAndInstall: jest.fn(),
    setFeedURL: jest.fn(),
    on: (event, fn) => {
      updaterListeners[event] = fn;
    },
    addListener: (event, fn) => {
      updaterListeners[event] = fn;
    }
  };

  jest.doMock('electron-updater', () => ({ autoUpdater: mockUpdater }), { virtual: true });

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

describe('nothing happens without the user asking', () => {
  it('neither downloads nor installs on its own — the consent finding', () => {
    // Both defaulted to true, and together they meant a 169MB download began on
    // launch and the app was replaced on quit, with no prompt and no progress.
    // The first real upgrade was reported as "it doesn't show anything about
    // updating" by someone who was being silently updated as they said it.
    const { setupAutoUpdate } = loadModule();
    setupAutoUpdate(fakeWindow);

    expect(mockUpdater.autoDownload).toBe(false);
    expect(mockUpdater.autoInstallOnAppQuit).toBe(false);
  });

  it('does not start a download when a new version is found', () => {
    const { setupAutoUpdate } = loadModule();
    setupAutoUpdate(fakeWindow);

    updaterListeners['update-available']({ version: '0.1.5' });

    expect(mockUpdater.downloadUpdate).not.toHaveBeenCalled();
  });

  it('allows a downgrade, or the version picker could only ever go forwards', () => {
    const { setupAutoUpdate } = loadModule();
    setupAutoUpdate(fakeWindow);

    expect(mockUpdater.allowDowngrade).toBe(true);
  });

  it('downloads only when the renderer asks, and installs only when it asks again', async () => {
    const { setupAutoUpdate } = loadModule();
    setupAutoUpdate(fakeWindow);

    await ipcHandlers['update:download'](null, undefined);
    expect(mockUpdater.downloadUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdater.quitAndInstall).not.toHaveBeenCalled();

    ipcHandlers['update:install']();
    jest.advanceTimersByTime(1);
    expect(mockUpdater.quitAndInstall).toHaveBeenCalledTimes(1);
  });
});

describe('ordering the versions offered', () => {
  it('sorts newest first and ranks a release above its own pre-releases', () => {
    const { __internal } = loadModule();
    const sorted = ['0.1.3', '0.2.0', '0.1.10', '0.2.0-beta.1', '0.1.4'].sort(__internal.compareVersions);

    // 0.1.10 above 0.1.4 is the point: string ordering puts it below.
    expect(sorted).toEqual(['0.2.0', '0.2.0-beta.1', '0.1.10', '0.1.4', '0.1.3']);
  });

  it('reads the feed file this platform can actually install', () => {
    expect(loadModule({ platform: 'darwin' }).__internal.FEED_FILE).toBe('latest-mac.yml');
    expect(loadModule({ platform: 'win32' }).__internal.FEED_FILE).toBe('latest.yml');
  });
});

describe('which releases the picker may offer', () => {
  // Shaped as the GitHub releases API really returns them. `v0.1.2` is the case
  // that matters: a real, published, newer-than-some release with no macOS feed,
  // because it predates signing. Offering it would offer a guaranteed 404.
  const RELEASES = [
    {
      tag_name: 'v0.1.4',
      name: '0.1.4',
      body: 'notes for 4',
      draft: false,
      prerelease: false,
      assets: [{ name: 'latest-mac.yml' }, { name: 'latest.yml' }]
    },
    {
      tag_name: 'v0.2.0-beta.1',
      name: 'beta',
      body: 'beta notes',
      draft: false,
      prerelease: true,
      assets: [{ name: 'latest-mac.yml' }]
    },
    {
      tag_name: 'v0.1.3',
      name: '0.1.3',
      body: 'notes for 3',
      draft: false,
      prerelease: false,
      assets: [{ name: 'latest-mac.yml' }, { name: 'latest.yml' }]
    },
    { tag_name: 'v0.1.2', name: '0.1.2', body: '', draft: false, prerelease: false, assets: [{ name: 'NodeGX.dmg' }] },
    {
      tag_name: 'v0.9.9',
      name: 'unreleased',
      body: '',
      draft: true,
      prerelease: false,
      assets: [{ name: 'latest-mac.yml' }]
    },
    { tag_name: 'release', name: 'stray', body: '', draft: false, prerelease: false, assets: [{ name: 'source.zip' }] }
  ];

  it('offers only releases carrying a feed this platform can read', () => {
    const { __internal } = loadModule();
    const offered = __internal.installableFrom(RELEASES, 'latest-mac.yml').map((v) => v.version);

    // 0.1.2 has artifacts but no feed; 0.9.9 is a draft; `release` is neither.
    expect(offered).toEqual(['0.2.0-beta.1', '0.1.4', '0.1.3']);
  });

  it('drops a release whose feed exists for another platform only', () => {
    const { __internal } = loadModule();
    const offered = __internal.installableFrom(RELEASES, 'latest.yml').map((v) => v.version);

    // The beta publishes a mac feed and no Windows one.
    expect(offered).toEqual(['0.1.4', '0.1.3']);
  });

  it('carries the release notes through, because consenting to an update means reading them', () => {
    const { __internal } = loadModule();
    const [newest] = __internal.installableFrom(RELEASES, 'latest-mac.yml');

    expect(newest).toMatchObject({ version: '0.2.0-beta.1', tag: 'v0.2.0-beta.1', notes: 'beta notes', prerelease: true });
  });
});
