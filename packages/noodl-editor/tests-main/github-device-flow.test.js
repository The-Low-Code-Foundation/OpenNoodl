/**
 * F63 — the GitHub device-flow polling state machine.
 *
 * Every branch here is one you cannot reach by clicking: `slow_down` arrives
 * only when you poll faster than GitHub allows, `expired_token` only after
 * fifteen minutes, `access_denied` only if a human presses Cancel in the
 * browser at the right moment. That is the whole reason `github-device-flow.js`
 * takes its `fetch`, its `sleep` and its clock as arguments — this file drives
 * all of them in milliseconds and touches no network.
 *
 * ⚠️ Two of these assert *timing*, not just outcome: `slow_down` must raise the
 * interval for the **rest of the flow**, and the flow must never poll before it
 * has waited. Both are asserted through the recorded `sleep` durations, because
 * a machine that returned the right token after hammering GitHub twenty times a
 * second would pass an outcome-only test and get the client id rate-limited in
 * production.
 */

const {
  pollForToken,
  requestDeviceCode,
  DeviceFlowError,
  describeDeviceFlowError,
  GITHUB_CLIENT_ID
} = require('../src/main/src/github-device-flow');

/**
 * A fetch that replays a scripted list of GitHub bodies, one per call, and
 * records what it was asked. Every body is returned as `200 + JSON text`,
 * which is what GitHub does for device-flow errors — they are *not* HTTP
 * errors, which is exactly the trap a mock built on status codes would hide.
 */
function scriptedFetch(bodies) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, body: options && options.body ? JSON.parse(options.body) : null, headers: options?.headers });
    const body = bodies[Math.min(calls.length - 1, bodies.length - 1)];
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify(body),
      json: async () => body
    };
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

/** A `sleep` that never sleeps but remembers how long it was asked to. */
function recordingSleep() {
  const waits = [];
  const sleep = async (ms) => {
    waits.push(ms);
  };
  sleep.waits = waits;
  return sleep;
}

describe('device code request', () => {
  it('sends the client id and scopes, and asks for JSON', async () => {
    const fetchImpl = scriptedFetch([
      {
        device_code: 'dev-123',
        user_code: 'ABCD-1234',
        verification_uri: 'https://github.com/login/device',
        expires_in: 900,
        interval: 5
      }
    ]);

    const device = await requestDeviceCode({ fetchImpl });

    expect(device.user_code).toBe('ABCD-1234');
    expect(device.verification_uri).toBe('https://github.com/login/device');
    expect(device.interval).toBe(5);

    const [call] = fetchImpl.calls;
    expect(call.url).toBe('https://github.com/login/device/code');
    expect(call.body.client_id).toBe(GITHUB_CLIENT_ID);
    expect(call.body.scope).toBe('repo read:org read:user user:email');
    // ⚠️ Without this header GitHub answers 200 with a form-encoded body and
    // the parse fails on a *successful* request.
    expect(call.headers.Accept).toBe('application/json');
  });

  it('carries no client secret — the thing F63 existed to remove', async () => {
    const fetchImpl = scriptedFetch([
      {
        device_code: 'dev-123',
        user_code: 'ABCD-1234',
        verification_uri: 'https://github.com/login/device',
        expires_in: 900,
        interval: 5
      }
    ]);

    await requestDeviceCode({ fetchImpl });

    expect(fetchImpl.calls[0].body).not.toHaveProperty('client_secret');
  });

  it('reports device_flow_disabled distinctly, because only a human at GitHub can fix it', async () => {
    const fetchImpl = scriptedFetch([{ error: 'device_flow_disabled' }]);

    await expect(requestDeviceCode({ fetchImpl })).rejects.toMatchObject({ code: 'device_flow_disabled' });
  });
});

describe('polling', () => {
  /** The happy shape of a poll: the same options every test starts from. */
  function poll(fetchImpl, overrides = {}) {
    return pollForToken({
      deviceCode: 'dev-123',
      interval: 5,
      expiresIn: 900,
      fetchImpl,
      sleep: overrides.sleep || recordingSleep(),
      now: overrides.now || (() => 0),
      isCancelled: overrides.isCancelled,
      ...(overrides.extra || {})
    });
  }

  it('loops on authorization_pending and returns the token when it arrives', async () => {
    const fetchImpl = scriptedFetch([
      { error: 'authorization_pending' },
      { error: 'authorization_pending' },
      { access_token: 'gho_abc', token_type: 'bearer', scope: 'repo' }
    ]);

    const token = await poll(fetchImpl);

    expect(token.access_token).toBe('gho_abc');
    expect(token.token_type).toBe('bearer');
    expect(fetchImpl.calls).toHaveLength(3);
  });

  it('sends the device-flow grant type on every poll', async () => {
    const fetchImpl = scriptedFetch([{ access_token: 'gho_abc' }]);

    await poll(fetchImpl);

    expect(fetchImpl.calls[0].url).toBe('https://github.com/login/oauth/access_token');
    expect(fetchImpl.calls[0].body).toEqual({
      client_id: GITHUB_CLIENT_ID,
      device_code: 'dev-123',
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
    });
    expect(fetchImpl.calls[0].headers.Accept).toBe('application/json');
  });

  it('waits before the first poll, never immediately', async () => {
    const sleep = recordingSleep();
    await poll(scriptedFetch([{ access_token: 'gho_abc' }]), { sleep });

    expect(sleep.waits).toEqual([5000]);
  });

  it('slow_down raises the interval for the rest of the flow, not just once', async () => {
    const sleep = recordingSleep();
    const fetchImpl = scriptedFetch([
      { error: 'authorization_pending' },
      { error: 'slow_down', interval: 12 },
      { error: 'authorization_pending' },
      { access_token: 'gho_abc' }
    ]);

    await poll(fetchImpl, { sleep });

    // 5s before polls 1 and 2, then 12s before polls 3 and 4 — the new interval
    // is permanent. Reverting to 5s would just earn another slow_down.
    expect(sleep.waits).toEqual([5000, 5000, 12000, 12000]);
  });

  it('slow_down with no interval of its own adds five seconds', async () => {
    const sleep = recordingSleep();
    const fetchImpl = scriptedFetch([{ error: 'slow_down' }, { access_token: 'gho_abc' }]);

    await poll(fetchImpl, { sleep });

    expect(sleep.waits).toEqual([5000, 10000]);
  });

  it('access_denied ends the flow with its own code', async () => {
    const fetchImpl = scriptedFetch([{ error: 'authorization_pending' }, { error: 'access_denied' }]);

    await expect(poll(fetchImpl)).rejects.toMatchObject({ code: 'access_denied' });
  });

  it('expired_token ends the flow with a different code from access_denied', async () => {
    const fetchImpl = scriptedFetch([{ error: 'expired_token' }]);

    const denied = describeDeviceFlowError('access_denied');
    const expired = describeDeviceFlowError('expired_token');

    await expect(poll(fetchImpl)).rejects.toMatchObject({ code: 'expired_token' });

    // The brief's requirement stated as an assertion: a user who refused must
    // not be told to try again, and a user who timed out must not be told they
    // refused.
    expect(expired).not.toBe(denied);
    expect(denied).toMatch(/cancelled/i);
    expect(expired).toMatch(/expired/i);
  });

  it('gives up locally once the code has outlived expires_in', async () => {
    // GitHub is answering `authorization_pending` forever; the clock is what
    // ends this. Without the deadline check the loop would never terminate.
    const fetchImpl = scriptedFetch([{ error: 'authorization_pending' }]);
    let clock = 0;
    const sleep = async () => {
      clock += 60_000;
    };

    await expect(
      pollForToken({
        deviceCode: 'dev-123',
        interval: 5,
        expiresIn: 120,
        fetchImpl,
        sleep,
        now: () => clock
      })
    ).rejects.toMatchObject({ code: 'expired_token' });

    // It stopped rather than polling on: two minutes is two sleeps.
    expect(fetchImpl.calls.length).toBeLessThanOrEqual(2);
  });

  it('stops when the flow is cancelled and does not poll again', async () => {
    const fetchImpl = scriptedFetch([{ error: 'authorization_pending' }, { access_token: 'gho_abc' }]);
    let cancelled = false;

    await expect(
      poll(fetchImpl, {
        sleep: async () => {
          cancelled = true;
        },
        isCancelled: () => cancelled
      })
    ).rejects.toMatchObject({ code: 'cancelled' });

    expect(fetchImpl.calls).toHaveLength(0);
  });

  it('turns an unreachable GitHub into a network_error rather than a raw TypeError', async () => {
    const fetchImpl = async () => {
      throw new TypeError('fetch failed');
    };

    await expect(poll(fetchImpl)).rejects.toMatchObject({ code: 'network_error' });
  });

  it('treats an unparseable body as a network error, not a signed-in user', async () => {
    // GitHub without `Accept: application/json` answers 200 with
    // `error=authorization_pending&…`. If that ever slipped through, the flow
    // must fail loudly rather than resolve with an undefined token.
    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      text: async () => 'error=authorization_pending&interval=5'
    });

    await expect(poll(fetchImpl)).rejects.toBeInstanceOf(DeviceFlowError);
  });
});
