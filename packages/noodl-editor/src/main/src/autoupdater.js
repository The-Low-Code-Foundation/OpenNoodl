const fs = require('fs');
const path = require('path');

const { app, ipcMain, BrowserWindow } = require('electron');
const { autoUpdater } = require('electron-updater');
const yaml = require('js-yaml');

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

/**
 * The update feed file electron-updater reads for this platform. Also what a
 * release must carry for us to offer it: a GitHub release with no feed for the
 * running platform cannot be installed, however new it is. `v0.1.2` is exactly
 * that — it predates signing and has no `latest-mac.yml` — so a version list
 * built from tags alone would offer an install that could only fail.
 */
const FEED_FILE = process.platform === 'darwin' ? 'latest-mac.yml' : 'latest.yml';

/**
 * Everything the renderer knows about updating, in one object.
 *
 * One state event rather than six (`available`, `progress`, `downloaded`,
 * `error`, …) because the UI is a single dialog whose whole appearance is a
 * function of this: six events means six ways for the dialog to disagree with
 * itself, and a renderer that starts late having missed the ones it needed.
 * `update:get-state` replays it, so a window opened mid-download shows the
 * download.
 */
const state = {
  /** idle | checking | available | downloading | downloaded | error */
  status: 'idle',
  currentVersion: app.getVersion(),
  /** The version an install would land on — not necessarily the newest. */
  targetVersion: null,
  releaseNotes: null,
  releaseName: null,
  /** Installable releases, newest first. Empty until listed. */
  versions: [],
  includePrereleases: false,
  percent: 0,
  transferred: 0,
  total: 0,
  bytesPerSecond: 0,
  error: null,
  /** True once the user has asked for this version, so the UI stops offering it. */
  dismissed: false
};

function broadcast() {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send('update:state', state);
  }
}

function setState(patch) {
  Object.assign(state, patch);
  broadcast();
}

/**
 * `owner`/`repo` for the releases API, taken from the `app-update.yml` that
 * electron-builder stamps into the packaged app.
 *
 * Read rather than hardcoded so a fork's builds talk to the fork's releases.
 * When it is absent — every unpackaged dev run — the version *list* is
 * unavailable and the dialog falls back to offering only what the updater
 * itself found. That is a smaller feature, not a broken one.
 */
function feedRepo() {
  try {
    const file = path.join(process.resourcesPath, 'app-update.yml');
    const config = yaml.load(fs.readFileSync(file, 'utf8'));
    return config && config.owner && config.repo ? { owner: config.owner, repo: config.repo } : null;
  } catch {
    return null;
  }
}

function githubJson(url) {
  // `net` rather than `https`, so the request uses Chromium's stack and the
  // system proxy configuration the rest of the app already honours.
  return new Promise((resolve, reject) => {
    const request = require('electron').net.request({ url, headers: { Accept: 'application/vnd.github+json' } });
    let body = '';
    request.on('response', (response) => {
      response.on('data', (chunk) => (body += chunk));
      response.on('end', () => {
        if (response.statusCode >= 400) return reject(new Error(`GitHub responded ${response.statusCode}`));
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });
    request.on('error', reject);
    request.end();
  });
}

/** `0.1.4` → comparable tuple. Pre-release suffixes sort below their release. */
function versionKey(version) {
  const [core, pre] = String(version).split('-');
  const parts = core.split('.').map((n) => parseInt(n, 10) || 0);
  return { parts, pre: pre || null };
}

function compareVersions(a, b) {
  const va = versionKey(a);
  const vb = versionKey(b);
  for (let i = 0; i < 3; i++) {
    if ((va.parts[i] || 0) !== (vb.parts[i] || 0)) return (vb.parts[i] || 0) - (va.parts[i] || 0);
  }
  if (va.pre === vb.pre) return 0;
  if (!va.pre) return -1; // a release outranks its own pre-releases
  if (!vb.pre) return 1;
  return va.pre < vb.pre ? 1 : -1;
}

/**
 * Which of these GitHub releases this platform could actually install, newest
 * first.
 *
 * Filtered on the **feed asset**, not on the tag. A release with no
 * `latest-mac.yml` cannot be installed on macOS however new it is — `v0.1.2` is
 * exactly that, published before signing — so a picker built from tags alone
 * would offer an install whose only possible outcome is a 404. Drafts go for the
 * same reason: invisible to an unauthenticated updater.
 *
 * Pure, and separated from the fetch so the rule can be tested against real API
 * payloads without a network or an Electron `net`.
 */
function installableFrom(releases, feedFile) {
  return (releases || [])
    .filter((release) => !release.draft)
    .filter((release) => (release.assets || []).some((asset) => asset.name === feedFile))
    .map((release) => ({
      version: String(release.tag_name).replace(/^v/, ''),
      tag: release.tag_name,
      name: release.name || release.tag_name,
      notes: release.body || '',
      prerelease: !!release.prerelease,
      publishedAt: release.published_at
    }))
    .sort((a, b) => compareVersions(a.version, b.version));
}

async function listVersions() {
  const repo = feedRepo();
  if (!repo) return [];

  const releases = await githubJson(
    `https://api.github.com/repos/${repo.owner}/${repo.repo}/releases?per_page=30`
  );

  return installableFrom(releases, FEED_FILE);
}

/** The releases the user is currently willing to see. */
function offerable() {
  return state.versions.filter((v) => state.includePrereleases || !v.prerelease);
}

function setupAutoUpdate(window) {
  if (process.env.autoUpdate === 'no') return;

  // Linux has no in-app update path at all: electron-updater cannot replace an
  // AppImage it did not launch, and a .deb is the package manager's business.
  // The check is skipped rather than attempted-and-failed. A `latest-linux.yml`
  // *is* published (electron-builder emits one regardless) and nothing reads it.
  if (process.platform === 'linux') {
    return;
  }

  // Nothing is fetched and nothing is replaced without the user asking.
  //
  // Both of these defaulted to true, and together they meant a 169MB download
  // began on launch and the app was swapped out on quit — no prompt, no
  // progress, no consent. The first real upgrade was reported as "it doesn't
  // show anything about updating" by someone who was, at that moment, being
  // silently updated. An update is now something the user chooses.
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  // Required for the version picker: installing 0.1.3 while running 0.1.4 is a
  // downgrade, and electron-updater refuses one unless told otherwise.
  autoUpdater.allowDowngrade = true;

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
    // packaged app printed an UnhandledPromiseRejectionWarning on every launch.
    //
    // The handler deliberately does NOT retry: the `error` listener below
    // already schedules one for the same failure.
    try {
      const pending = autoUpdater.checkForUpdates();
      if (pending && typeof pending.catch === 'function') {
        pending.catch(() => {
          /* reported by the `error` listener, which also owns the retry */
        });
      }
    } catch (e) {
      _scheduleCheck(retryDelay);
      retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS);
    }
  }

  /**
   * Point the updater at one specific release, or back at the newest.
   *
   * Every release publishes its own feed file beside its artifacts, describing
   * *that* version — so a `generic` provider aimed at one tag's download path
   * is a feed with exactly one version in it. That is the whole mechanism
   * behind the version picker; electron-updater has no notion of "install this
   * particular version" on its own, only "install whatever the feed says".
   */
  function _pinFeed(tag) {
    const repo = feedRepo();
    if (!repo) return false;

    if (tag) {
      autoUpdater.setFeedURL({
        provider: 'generic',
        url: `https://github.com/${repo.owner}/${repo.repo}/releases/download/${tag}`
      });
    } else {
      autoUpdater.setFeedURL({ provider: 'github', owner: repo.owner, repo: repo.repo });
    }
    return true;
  }

  autoUpdater.on('update-available', async (info) => {
    // Reached only from a check, never from a download — `autoDownload` is off.
    if (state.status === 'downloading' || state.status === 'downloaded') return;

    setState({
      status: 'available',
      targetVersion: info.version,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : null,
      releaseName: info.releaseName || null,
      error: null
    });

    // The list is a nicety on top of the offer; a failure to build it must not
    // stop the user being told an update exists.
    try {
      const versions = await listVersions();
      const found = versions.find((v) => v.version === info.version);
      setState({
        versions,
        releaseNotes: state.releaseNotes || (found ? found.notes : null),
        releaseName: state.releaseName || (found ? found.name : null)
      });
    } catch {
      /* offer stands without it */
    }
  });

  autoUpdater.on('update-not-available', () => {
    // A successful check, so the backoff resets — a machine that was offline
    // for an hour goes straight back to the normal cadence once it reconnects.
    retryDelay = RETRY_MIN_MS;
    if (state.status === 'checking' || state.status === 'idle') setState({ status: 'idle' });
    _scheduleCheck(CHECK_INTERVAL_MS);
  });

  autoUpdater.on('download-progress', (progress) => {
    setState({
      status: 'downloading',
      percent: Math.round(progress.percent || 0),
      transferred: progress.transferred || 0,
      total: progress.total || 0,
      bytesPerSecond: progress.bytesPerSecond || 0
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    setState({ status: 'downloaded', percent: 100, targetVersion: info.version || state.targetVersion });
  });

  autoUpdater.on('error', (error) => {
    // Retry with a growing delay, so a permanently unreachable feed (a
    // firewall, an offline laptop) costs a handful of requests an hour rather
    // than one a minute for as long as the editor stays open.
    //
    // A failure *during a download* is shown; a failure during a background
    // check is not, because the user did not ask for anything and an error
    // about a check they never made is noise.
    if (state.status === 'downloading') {
      setState({ status: 'error', error: String((error && error.message) || error) });
    }
    _scheduleCheck(retryDelay);
    retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS);
  });

  _checkForUpdates();

  // ── The renderer's door ───────────────────────────────────────────────────

  ipcMain.handle('update:get-state', () => state);

  ipcMain.handle('update:check', async () => {
    setState({ status: 'checking', error: null, dismissed: false });
    _pinFeed(null);
    try {
      await autoUpdater.checkForUpdates();
    } catch (e) {
      setState({ status: 'idle' });
    }
    return state;
  });

  ipcMain.handle('update:list-versions', async () => {
    try {
      setState({ versions: await listVersions() });
    } catch (e) {
      setState({ error: String((e && e.message) || e) });
    }
    return state.versions;
  });

  ipcMain.handle('update:set-include-prereleases', (_event, include) => {
    setState({ includePrereleases: !!include });
    return offerable();
  });

  ipcMain.handle('update:download', async (_event, version) => {
    const wanted = version
      ? state.versions.find((v) => v.version === version)
      : offerable().find((v) => !v.prerelease) || offerable()[0];

    setState({
      status: 'downloading',
      percent: 0,
      transferred: 0,
      total: 0,
      error: null,
      targetVersion: wanted ? wanted.version : state.targetVersion,
      releaseNotes: wanted ? wanted.notes : state.releaseNotes,
      releaseName: wanted ? wanted.name : state.releaseName
    });

    try {
      // Pin only when a specific, non-newest version was asked for: the github
      // provider is the one that handles channels and pre-releases properly,
      // and swapping it out unnecessarily loses that.
      const isNewest = !wanted || wanted.version === (offerable()[0] && offerable()[0].version);
      _pinFeed(isNewest ? null : wanted.tag);

      // The pinned feed is a different feed, so it has to be re-read before the
      // download knows what it is fetching.
      await autoUpdater.checkForUpdates();
      await autoUpdater.downloadUpdate();
    } catch (e) {
      setState({ status: 'error', error: String((e && e.message) || e) });
    }
    return state;
  });

  ipcMain.handle('update:install', () => {
    // `isSilent = false`, `isForceRunAfter = true` — the app comes back up on
    // its own, which is the difference between "updating" and "it vanished".
    setImmediate(() => autoUpdater.quitAndInstall(false, true));
    return true;
  });

  ipcMain.handle('update:dismiss', () => {
    setState({ dismissed: true });
    return state;
  });

  // The timer holds the event loop open and would keep the process alive after
  // the last window closes.
  app.on('before-quit', () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  });
}

module.exports = {
  setupAutoUpdate,
  // Exported for tests, which must not start timers or touch the network.
  __internal: { compareVersions, installableFrom, state, FEED_FILE }
};
