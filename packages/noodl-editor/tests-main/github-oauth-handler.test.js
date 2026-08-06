/**
 * F63 — the Electron half of GitHub sign-in.
 *
 * `github-device-flow.test.js` grades the state machine; this grades the wiring
 * around it, which has its own failure modes and no logic to speak of:
 *
 * - the flow must broadcast to **every** window, because the editor is not
 *   reliably `windows[0]` (the bug the old handler's comment records);
 * - a terminal error must arrive as a *code*, not prose, or the dialog cannot
 *   tell "you cancelled" from "it expired";
 * - `cancel()` mid-flight must not sign the user in when the last request lands.
 *
 * `electron` is mocked because `BrowserWindow.getAllWindows()` is the only part
 * of it this file touches, and a real one needs a display.
 */

jest.mock('electron', () => ({
  ipcMain: { handle: jest.fn() },
  BrowserWindow: { getAllWindows: jest.fn(() => []) }
}));

const { BrowserWindow } = require('electron');
const { GitHubDeviceFlowHandler } = require('../src/main/github-oauth-handler');

/** A window that records what was sent to it. */
function fakeWindow() {
  const sent = [];
  return { sent, webContents: { send: (channel, payload) => sent.push({ channel, payload }) } };
}

/**
 * A fetch that answers by URL rather than by call order, because the handler
 * interleaves three different endpoints (token poll, /user, /user/installations).
 */
function routedFetch(routes) {
  const calls = [];
  return async (url, options) => {
    calls.push(url);
    const key = Object.keys(routes).find((k) => url.includes(k));
    const body = key ? routes[key]() : {};
    return { ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body };
  };
}

const DEVICE_CODE = {
  device_code: 'dev-123',
  user_code: 'WXYZ-9876',
  verification_uri: 'https://github.com/login/device',
  expires_in: 900,
  interval: 5
};

/** Let the detached poll (`runPoll`) drain. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

describe('GitHubDeviceFlowHandler', () => {
  let windows;

  beforeEach(() => {
    windows = [fakeWindow(), fakeWindow()];
    BrowserWindow.getAllWindows.mockReturnValue(windows);
  });

  it('returns the user code and verification URI to the renderer, and broadcasts the token to every window', async () => {
    let tokenPolls = 0;
    const handler = new GitHubDeviceFlowHandler({
      sleep: async () => {},
      now: () => 0,
      fetchImpl: routedFetch({
        'login/device/code': () => DEVICE_CODE,
        'login/oauth/access_token': () => {
          tokenPolls += 1;
          return tokenPolls === 1
            ? { error: 'authorization_pending' }
            : { access_token: 'gho_abc', token_type: 'bearer', scope: 'repo' };
        },
        'api.github.com/user/installations': () => ({ installations: [{ account: { login: 'acme' } }] }),
        'api.github.com/user': () => ({ login: 'octocat', email: 'octocat@github.com' })
      })
    });

    const device = await handler.start();

    // ⚠️ GitHub does not return `verification_uri_complete`, so showing the code
    // is the whole UI contract — the renderer cannot skip it.
    expect(device).toMatchObject({
      userCode: 'WXYZ-9876',
      verificationUri: 'https://github.com/login/device',
      interval: 5
    });

    await settle();

    for (const win of windows) {
      const complete = win.sent.find((m) => m.channel === 'github-oauth-complete');
      expect(complete).toBeDefined();
      expect(complete.payload.token.access_token).toBe('gho_abc');
      expect(complete.payload.user.login).toBe('octocat');
      expect(complete.payload.authMethod).toBe('device_flow');
      expect(complete.payload.installations).toHaveLength(1);
    }
  });

  it('broadcasts access_denied as a code the dialog can branch on', async () => {
    const handler = new GitHubDeviceFlowHandler({
      sleep: async () => {},
      now: () => 0,
      fetchImpl: routedFetch({
        'login/device/code': () => DEVICE_CODE,
        'login/oauth/access_token': () => ({ error: 'access_denied' })
      })
    });

    await handler.start();
    await settle();

    const error = windows[0].sent.find((m) => m.channel === 'github-oauth-error');
    expect(error.payload.error).toBe('access_denied');
    expect(error.payload.message).toMatch(/cancelled/i);
  });

  it('broadcasts expired_token, and says something different from access_denied', async () => {
    const handler = new GitHubDeviceFlowHandler({
      sleep: async () => {},
      now: () => 0,
      fetchImpl: routedFetch({
        'login/device/code': () => DEVICE_CODE,
        'login/oauth/access_token': () => ({ error: 'expired_token' })
      })
    });

    await handler.start();
    await settle();

    const error = windows[0].sent.find((m) => m.channel === 'github-oauth-error');
    expect(error.payload.error).toBe('expired_token');
    expect(error.payload.message).not.toMatch(/you cancelled/i);
  });

  it('a cancelled flow signs nobody in, even when the token was already in flight', async () => {
    const handler = new GitHubDeviceFlowHandler({
      sleep: async () => {},
      now: () => 0,
      fetchImpl: routedFetch({
        'login/device/code': () => DEVICE_CODE,
        'login/oauth/access_token': () => ({ access_token: 'gho_abc' }),
        'api.github.com/user': () => ({ login: 'octocat' })
      })
    });

    await handler.start();
    handler.cancel();
    await settle();

    expect(windows[0].sent).toHaveLength(0);
  });

  it('never puts a client secret on the wire', async () => {
    const bodies = [];
    const handler = new GitHubDeviceFlowHandler({
      sleep: async () => {},
      now: () => 0,
      fetchImpl: async (url, options) => {
        if (options && options.body) bodies.push(JSON.parse(options.body));
        const body = url.includes('device/code') ? DEVICE_CODE : { access_token: 'gho_abc' };
        return { ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body };
      }
    });

    await handler.start();
    handler.cancel();
    await settle();

    expect(bodies.length).toBeGreaterThan(0);
    for (const body of bodies) {
      expect(body).not.toHaveProperty('client_secret');
    }
  });
});
