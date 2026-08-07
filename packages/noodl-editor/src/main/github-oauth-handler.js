/**
 * GitHub sign-in, main-process half.
 *
 * F63 replaced the authorization-code flow this file used to run with the
 * **device flow**. The reason was not ergonomics: the old flow needed a client
 * *secret*, and the secret was a literal here —
 *
 *     const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || 'c452…';
 *
 * — behind a `process.env` fallback that was never taken, because
 * `GITHUB_CLIENT_SECRET` is set by no workflow, build script or webpack config
 * anywhere in the tree. In a public repo, in a file that shipped both inlined
 * into `main.bundle.js` and as readable source. Anyone could impersonate the
 * app to GitHub. ⚠️ **That secret is burned and must be revoked by hand in the
 * OAuth app's settings** — deleting it from source does not un-leak it.
 *
 * The device flow uses the client **id** only, so there is nothing confidential
 * left in this file. It also has no redirect URI, which is why the custom
 * `noodl://github-callback` protocol handling is gone with it.
 *
 * The polling state machine lives in `./src/github-device-flow` with every
 * clock and socket injected, so `tests-main/` can drive `slow_down`,
 * `expired_token` and `access_denied` without a network. This file is the
 * Electron wiring: IPC in, browser-window broadcasts out.
 *
 * ── The IPC contract ────────────────────────────────────────────────────────
 *
 * - `invoke('github-oauth-start')` → `{ success, userCode, verificationUri,
 *   expiresIn, interval }`. The renderer shows `userCode` and opens
 *   `verificationUri`. ⚠️ GitHub does **not** return `verification_uri_complete`,
 *   so the code cannot be carried in the URL — showing it is mandatory, not a
 *   nicety.
 * - `invoke('github-oauth-stop')` → cancels the poll.
 * - `send('github-oauth-complete', { token, user, installations, authMethod })`
 *   — unchanged shape, so `GitHubOAuthService` and `GitHubAuth` keep working.
 * - `send('github-oauth-error', { error, message })` where `error` is the
 *   machine-readable code: `access_denied` and `expired_token` are distinct, and
 *   the dialog says different things for them.
 *
 * @module noodl-editor/main
 */

const { ipcMain, BrowserWindow } = require('electron');

const {
  GITHUB_CLIENT_ID,
  GITHUB_SCOPES,
  DeviceFlowError,
  describeDeviceFlowError,
  requestDeviceCode,
  pollForToken
} = require('./src/github-device-flow');

/**
 * The app's deep-link scheme.
 *
 * ⚠️ Not an OAuth concern any more — the device flow never comes back to the
 * app — but registering it is still done here because this is the only place
 * that ever did it, and `noodl:import/…` links (the design-tool import, handled
 * in `editor/index.ts`) stop working without it. `main.js` registers `nodegx`
 * separately; this belongs beside that, and moving it is a `main.js` edit.
 */
const DEEP_LINK_PROTOCOL = 'noodl';

/**
 * Runs one device-flow sign-in at a time.
 */
class GitHubDeviceFlowHandler {
  /**
   * @param {object} [deps] injection seam for tests; production passes nothing.
   */
  constructor(deps = {}) {
    this.deps = deps;
    /** The in-flight flow, or null. */
    this.pending = null;
  }

  /**
   * Ask GitHub for a code, then poll in the background.
   *
   * Returns as soon as there is something to show the user — the poll is
   * deliberately *not* awaited, because the renderer needs the code on screen
   * while it runs. Completion arrives over IPC.
   */
  async start() {
    // A second Connect click while one flow is live would otherwise leave an
    // orphaned poll racing the new one, and whichever finished first would win.
    this.cancel();

    const device = await requestDeviceCode({
      fetchImpl: this.deps.fetchImpl,
      clientId: GITHUB_CLIENT_ID,
      scopes: GITHUB_SCOPES
    });

    const pending = { cancelled: false, deviceCode: device.device_code };
    this.pending = pending;

    console.log('[GitHub device flow] Code issued, waiting for the user to enter it on GitHub');

    this.runPoll(pending, device);

    return {
      userCode: device.user_code,
      verificationUri: device.verification_uri,
      expiresIn: device.expires_in,
      interval: device.interval
    };
  }

  /**
   * The background half of `start`. Separated so `start` can return without
   * `await`ing it, and so the catch is in one place.
   */
  async runPoll(pending, device) {
    try {
      const token = await pollForToken({
        deviceCode: device.device_code,
        clientId: GITHUB_CLIENT_ID,
        interval: device.interval,
        expiresIn: device.expires_in,
        fetchImpl: this.deps.fetchImpl,
        sleep: this.deps.sleep,
        now: this.deps.now,
        isCancelled: () => pending.cancelled
      });

      // A flow the user cancelled while the last request was in flight must not
      // sign them in anyway.
      if (pending.cancelled || this.pending !== pending) return;

      const user = await this.fetchUserInfo(token.access_token);
      const installations = await this.fetchInstallations(token.access_token);

      if (pending.cancelled || this.pending !== pending) return;

      this.pending = null;
      this.sendSuccessToRenderer({ token, user, installations, authMethod: 'device_flow' });
    } catch (error) {
      if (pending.cancelled || this.pending !== pending) return;
      this.pending = null;

      const code = error instanceof DeviceFlowError ? error.code : 'unknown_error';
      // `cancelled` is the app's own doing; the renderer already knows.
      if (code === 'cancelled') return;

      console.error('[GitHub device flow] Failed:', code, error.message);
      this.sendErrorToRenderer(code, error.message || describeDeviceFlowError(code));
    }
  }

  /**
   * Abandon the in-flight flow, if any. Idempotent.
   */
  cancel() {
    if (this.pending) {
      this.pending.cancelled = true;
      this.pending = null;
      console.log('[GitHub device flow] Cancelled');
    }
  }

  /**
   * Fetch user information from GitHub.
   */
  async fetchUserInfo(token) {
    const fetchImpl = this.deps.fetchImpl || fetch;
    const response = await fetchImpl('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch user info: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Fetch installation information (orgs/repos the user granted access to).
   *
   * Best-effort: a user with no GitHub App installations gets a 403 here, and
   * that is not a failed sign-in.
   */
  async fetchInstallations(token) {
    try {
      const fetchImpl = this.deps.fetchImpl || fetch;
      const response = await fetchImpl('https://api.github.com/user/installations', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        console.warn('[GitHub device flow] Could not fetch installations:', response.status);
        return [];
      }

      const data = await response.json();
      return data.installations || [];
    } catch (error) {
      console.warn('[GitHub device flow] Error fetching installations:', error);
      return [];
    }
  }

  /**
   * Broadcast to ALL windows — the editor is not reliably `windows[0]`.
   */
  sendSuccessToRenderer(result) {
    console.log('[GitHub device flow] Signed in as', result.user && result.user.login);

    for (const win of BrowserWindow.getAllWindows()) {
      try {
        win.webContents.send('github-oauth-complete', result);
      } catch (err) {
        // A window that is being torn down cannot receive; the others still can.
      }
    }
  }

  sendErrorToRenderer(error, description) {
    for (const win of BrowserWindow.getAllWindows()) {
      try {
        win.webContents.send('github-oauth-error', {
          error,
          message: description || describeDeviceFlowError(error)
        });
      } catch (err) {
        // See above.
      }
    }
  }
}

// Singleton instance
let handlerInstance = null;

/**
 * Initialize GitHub sign-in IPC handlers.
 */
function initializeGitHubOAuthHandlers(app) {
  handlerInstance = new GitHubDeviceFlowHandler();

  // See DEEP_LINK_PROTOCOL — kept for `noodl:import/…`, not for sign-in.
  if (!app.isDefaultProtocolClient(DEEP_LINK_PROTOCOL)) {
    app.setAsDefaultProtocolClient(DEEP_LINK_PROTOCOL);
    console.log(`[GitHub device flow] Registered ${DEEP_LINK_PROTOCOL}:// deep-link handler`);
  }

  ipcMain.handle('github-oauth-start', async () => {
    try {
      const device = await handlerInstance.start();
      return { success: true, ...device };
    } catch (error) {
      const code = error instanceof DeviceFlowError ? error.code : 'unknown_error';
      return { success: false, code, error: error.message || describeDeviceFlowError(code) };
    }
  });

  ipcMain.handle('github-oauth-stop', async () => {
    handlerInstance.cancel();
    return { success: true };
  });

  console.log('[GitHub device flow] IPC handlers initialized');
}

module.exports = {
  GitHubDeviceFlowHandler,
  initializeGitHubOAuthHandlers,
  DEEP_LINK_PROTOCOL
};
