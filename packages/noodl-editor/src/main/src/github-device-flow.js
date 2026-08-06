/**
 * The GitHub OAuth **device flow**, as a pure state machine.
 *
 * F63. What this replaced: an authorization-code flow whose **client secret was
 * a literal in `src/main/github-oauth-handler.js`**, behind a `process.env`
 * fallback that nothing ever set. The repo is public, and that file shipped
 * twice in every build — inlined into `main.bundle.js` and again as readable
 * source, because `package.json`'s `files` allow-list excluded its siblings but
 * not it. Anyone could impersonate the app to GitHub.
 *
 * The device flow uses the client **id** only. A client id is public by design
 * (it is in every authorize URL the user's browser sees), so there is nothing
 * confidential left to ship. It also needs no redirect URI and no custom
 * protocol handler, which is why it was chosen over PKCE: PKCE would have meant
 * an admin re-registering the OAuth app.
 *
 * ── Why this file has no `require('electron')` ──────────────────────────────
 *
 * The interesting part of the flow is the *polling*, and its interesting cases
 * are all ones you cannot reach by hand: `slow_down` arrives only when you poll
 * too fast, `expired_token` only after fifteen minutes, `access_denied` only if
 * a human clicks Cancel at exactly the right moment. Every dependency that
 * would need a network or a clock is injected, so `tests-main/` can drive all
 * of them in milliseconds. `github-oauth-handler.js` is the Electron wiring
 * around this and holds no logic of its own.
 *
 * @module main/src/github-device-flow
 */

/**
 * The OAuth app's client id. Public by design — see the header. There is
 * deliberately no secret here and no `process.env` fallback: a fallback that
 * nothing sets is not configuration, it is a literal with a comment.
 */
const GITHUB_CLIENT_ID = 'Ov23li2n9u3dwAhwoifb';

/**
 * Scopes requested. Unchanged from the code flow it replaced:
 * - `repo`        full control of private repositories (issues, PRs, push)
 * - `read:org`    organisation membership, for the org picker
 * - `read:user`   profile
 * - `user:email`  the address commits are attributed to
 */
const GITHUB_SCOPES = ['repo', 'read:org', 'read:user', 'user:email'];

const DEVICE_CODE_URL = 'https://github.com/login/device/code';
const ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';

/**
 * GitHub's documented floor when it does not say otherwise, and the amount it
 * documents as the correct back-off when it does not send a new `interval`.
 */
const DEFAULT_INTERVAL_SECONDS = 5;
const SLOW_DOWN_INCREMENT_SECONDS = 5;

/**
 * An error with a machine-readable `code`, so the renderer can tell a user who
 * *denied* the request from one who let the code expire — the brief's
 * requirement, and the difference between "you cancelled" and "try again".
 */
class DeviceFlowError extends Error {
  constructor(code, message) {
    super(message || describeDeviceFlowError(code));
    this.name = 'DeviceFlowError';
    this.code = code;
  }
}

/**
 * The user-facing sentence for each terminal code.
 *
 * Lives here rather than in the dialog because the main process is what learns
 * the code, and a renderer that had to re-derive the wording would be a second
 * place to forget a case.
 */
function describeDeviceFlowError(code) {
  switch (code) {
    case 'access_denied':
      return 'You cancelled the request on GitHub, so nothing was connected.';
    case 'expired_token':
      return 'The code expired before it was entered. Start again to get a new one.';
    case 'cancelled':
      return 'Sign-in was cancelled.';
    case 'device_flow_disabled':
      // Reachable only via a setting on the OAuth app itself, so the message
      // says whose problem it is rather than asking the user to retry.
      return 'This build of the app is not allowed to sign in with a device code. Device flow must be enabled on its GitHub OAuth app.';
    case 'incorrect_client_credentials':
    case 'unauthorized_client':
      return 'GitHub did not recognise this application. Please report this.';
    case 'incorrect_device_code':
      return 'GitHub rejected the sign-in code. Start again to get a new one.';
    case 'network_error':
      return 'Could not reach GitHub. Check your connection and try again.';
    default:
      return 'GitHub sign-in failed.';
  }
}

/**
 * Read a GitHub OAuth response.
 *
 * ⚠️ `Accept: application/json` is not optional on either endpoint: without it
 * GitHub answers **200 with a form-encoded body**, so `response.json()` throws
 * and a perfectly successful sign-in looks like a parse failure. Both callers
 * set it; this parses what comes back and turns transport failures into a
 * `network_error` rather than letting a `TypeError` escape as the flow's result.
 */
async function readJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new DeviceFlowError('network_error', `GitHub returned an unreadable response (${response.status}).`);
  }
}

/**
 * Step 1 — ask GitHub for a device code.
 *
 * @returns {Promise<{device_code: string, user_code: string, verification_uri: string, expires_in: number, interval: number}>}
 */
async function requestDeviceCode({ fetchImpl = fetch, clientId = GITHUB_CLIENT_ID, scopes = GITHUB_SCOPES } = {}) {
  let response;
  try {
    response = await fetchImpl(DEVICE_CODE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ client_id: clientId, scope: scopes.join(' ') })
    });
  } catch (err) {
    throw new DeviceFlowError('network_error', describeDeviceFlowError('network_error'));
  }

  const data = await readJson(response);

  if (data.error) {
    throw new DeviceFlowError(data.error, data.error_description);
  }

  if (!data.device_code || !data.user_code || !data.verification_uri) {
    throw new DeviceFlowError('network_error', 'GitHub did not return a device code.');
  }

  return {
    device_code: data.device_code,
    user_code: data.user_code,
    verification_uri: data.verification_uri,
    expires_in: Number(data.expires_in) || 900,
    interval: Number(data.interval) || DEFAULT_INTERVAL_SECONDS
  };
}

/**
 * Step 2 — poll until the user finishes, refuses, or runs out of time.
 *
 * The five outcomes, all distinct:
 * - a token           → returned
 * - `authorization_pending` → keep waiting (the *normal* case, most of the time)
 * - `slow_down`       → we polled too fast; wait longer from now on. GitHub sends
 *                       a new `interval`; when it does not, add five seconds.
 *                       ⚠️ this is permanent for the rest of the flow, not a
 *                       one-off pause — polling at the old rate again just earns
 *                       another `slow_down`.
 * - `expired_token`   → throw, code `expired_token`
 * - `access_denied`   → throw, code `access_denied`
 *
 * The first sleep happens *before* the first poll: a poll issued the instant the
 * code is displayed cannot succeed (the user has not typed it yet) and counts
 * against the rate limit.
 *
 * @param {object}   opts
 * @param {string}   opts.deviceCode
 * @param {number}   [opts.interval]   seconds, from `requestDeviceCode`
 * @param {number}   [opts.expiresIn]  seconds, from `requestDeviceCode`
 * @param {Function} [opts.fetchImpl]
 * @param {Function} [opts.sleep]      `(ms) => Promise<void>`
 * @param {Function} [opts.now]        `() => epoch ms`
 * @param {Function} [opts.isCancelled] polled between steps; truthy aborts
 * @param {Function} [opts.onPoll]     called with the attempt number, for logging
 */
async function pollForToken({
  deviceCode,
  clientId = GITHUB_CLIENT_ID,
  interval = DEFAULT_INTERVAL_SECONDS,
  expiresIn = 900,
  fetchImpl = fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = () => Date.now(),
  isCancelled = () => false,
  onPoll
} = {}) {
  let currentInterval = Number(interval) || DEFAULT_INTERVAL_SECONDS;
  const deadline = now() + (Number(expiresIn) || 900) * 1000;
  let attempt = 0;

  for (;;) {
    if (isCancelled()) throw new DeviceFlowError('cancelled');

    await sleep(currentInterval * 1000);

    if (isCancelled()) throw new DeviceFlowError('cancelled');

    // Checked after the sleep, not before: the deadline can only be crossed by
    // waiting, and GitHub's own `expired_token` may well arrive first — this is
    // the belt to its braces, for the case where the machine slept.
    if (now() >= deadline) throw new DeviceFlowError('expired_token');

    attempt += 1;
    onPoll && onPoll(attempt);

    let response;
    try {
      response = await fetchImpl(ACCESS_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          client_id: clientId,
          device_code: deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        })
      });
    } catch (err) {
      throw new DeviceFlowError('network_error', describeDeviceFlowError('network_error'));
    }

    const data = await readJson(response);

    if (data.access_token) {
      return {
        access_token: data.access_token,
        token_type: data.token_type || 'bearer',
        scope: data.scope || ''
      };
    }

    switch (data.error) {
      case 'authorization_pending':
        continue;

      case 'slow_down':
        currentInterval = Number(data.interval) || currentInterval + SLOW_DOWN_INCREMENT_SECONDS;
        continue;

      case 'expired_token':
      case 'access_denied':
      case 'incorrect_device_code':
      case 'unsupported_grant_type':
      case 'incorrect_client_credentials':
      case 'device_flow_disabled':
        throw new DeviceFlowError(data.error, data.error_description);

      default:
        throw new DeviceFlowError(data.error || 'network_error', data.error_description);
    }
  }
}

module.exports = {
  GITHUB_CLIENT_ID,
  GITHUB_SCOPES,
  DEVICE_CODE_URL,
  ACCESS_TOKEN_URL,
  DEFAULT_INTERVAL_SECONDS,
  DeviceFlowError,
  describeDeviceFlowError,
  requestDeviceCode,
  pollForToken
};
