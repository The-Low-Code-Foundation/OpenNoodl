/**
 * ServiceSupervisor — runs one `nodegx-backend` service as a supervised child
 * process (WF-004 second half).
 *
 * The process contract:
 *   - Spawned as `process.execPath` with `ELECTRON_RUN_AS_NODE=1`, so the same
 *     binary that runs the editor runs the service as plain Node — no system
 *     Node dependency, identical in dev and in the packaged app.
 *   - The service prints `NODEGX_BACKEND_READY {json}` on stdout when its HTTP
 *     surface is up; the supervisor handshakes on that line, with an overall
 *     startup timeout as the backstop.
 *   - stdout/stderr are captured into a ring buffer surfaced in status — a
 *     crashed backend shows its last lines in the panel instead of vanishing.
 *   - stop() is SIGTERM, then SIGKILL after a grace period.
 *
 * Loud-failure rules: an entry point that cannot be found, a child that exits
 * before READY, or a READY timeout all reject start() with the probed paths /
 * log tail in the message. Nothing here degrades silently.
 *
 * @module local-backend/ServiceSupervisor
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const READY_PREFIX = 'NODEGX_BACKEND_READY ';
const READY_TIMEOUT_MS = 15000;
const STOP_GRACE_MS = 3000;
const LOG_RING_SIZE = 200;

function safeLog(...args) {
  try {
    console.log('[ServiceSupervisor]', ...args);
  } catch (e) {
    // Ignore EPIPE errors
  }
}

/**
 * Locate the service's runnable bundle. Candidates, in order:
 *   1. NODEGX_BACKEND_ENTRY env override (tests, unusual setups)
 *   2. The monorepo sibling (dev): packages/nodegx-backend/dist/cli.js
 *   3. The packaged app's resources: <resources>/nodegx-backend/cli.js
 *
 * @returns {{ entry: string|null, probed: string[] }}
 */
function resolveServiceEntry() {
  const probed = [];

  if (process.env.NODEGX_BACKEND_ENTRY) {
    probed.push(process.env.NODEGX_BACKEND_ENTRY);
    if (fs.existsSync(process.env.NODEGX_BACKEND_ENTRY)) {
      return { entry: process.env.NODEGX_BACKEND_ENTRY, probed };
    }
  }

  // Dev: the monorepo sibling. __dirname differs between source runs
  // (…/src/main/src/local-backend) and the webpack main bundle (…/src/main),
  // so probe both depths, plus the app-path route.
  const candidates = [];
  try {
    // From the bundle location packages/noodl-editor/src/main:
    candidates.push(path.resolve(__dirname, '..', '..', '..', 'nodegx-backend', 'dist', 'cli.js'));
    // From the source location packages/noodl-editor/src/main/src/local-backend:
    candidates.push(path.resolve(__dirname, '..', '..', '..', '..', '..', 'nodegx-backend', 'dist', 'cli.js'));
  } catch (e) {
    /* ignore */
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { app } = require('electron');
    if (app) {
      candidates.push(path.join(app.getAppPath(), '..', 'nodegx-backend', 'dist', 'cli.js'));
    }
  } catch (e) {
    /* electron not available (tests) */
  }
  if (process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, 'nodegx-backend', 'cli.js'));
  }

  for (const candidate of candidates) {
    probed.push(candidate);
    if (fs.existsSync(candidate)) {
      return { entry: candidate, probed };
    }
  }

  return { entry: null, probed };
}

class ServiceSupervisor {
  /**
   * @param {Object} config
   * @param {string} config.id - Backend ID
   * @param {string} config.name - Backend display name
   * @param {string} config.dataDir - Data directory (SQLite files, workflows, uploads)
   * @param {number} config.port - Port to bind
   * @param {boolean} [config.ephemeral] - Opt in to non-persisting mode
   * @param {(exit: {code: number|null, signal: string|null}) => void} [config.onUnexpectedExit] -
   *   Called when the child dies AFTER it was ready — i.e. a crash, not a
   *   `stop()`. A failure during startup is reported by rejecting `start()`
   *   instead, so this fires exactly once and only for the case nobody asked
   *   for. WFA-005 uses it to tell the renderer a backend went away, which is
   *   otherwise indistinguishable from one that is still running.
   */
  constructor(config) {
    this.config = config;
    this.child = null;
    /** True from the moment `stop()` is asked for, so the exit it causes is not reported as a crash. */
    this.stopping = false;
    this.ready = null; // parsed READY payload
    this.lastExit = null; // { code, signal }
    this.logRing = [];
    this.endpoint = `http://127.0.0.1:${config.port}`;
  }

  appendLog(stream, chunk) {
    const lines = chunk.toString().split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      this.logRing.push(`[${stream}] ${line}`);
      if (this.logRing.length > LOG_RING_SIZE) this.logRing.shift();
    }
  }

  logTail(lines = 15) {
    return this.logRing.slice(-lines).join('\n');
  }

  isRunning() {
    return !!(this.child && this.child.exitCode === null && !this.child.killed);
  }

  /**
   * Spawn the service and wait for its READY handshake.
   * Rejects loudly on missing entry, early exit, or timeout.
   */
  start() {
    return new Promise((resolve, reject) => {
      const { entry, probed } = resolveServiceEntry();
      if (!entry) {
        reject(
          new Error(
            'nodegx-backend service not found. Build it with `npm run build` in packages/nodegx-backend.\n' +
              'Probed paths:\n  ' +
              probed.join('\n  ')
          )
        );
        return;
      }

      const args = [
        entry,
        'serve',
        '--data-dir',
        this.config.dataDir,
        '--port',
        String(this.config.port),
        '--backend-id',
        this.config.id,
        '--backend-name',
        this.config.name
      ];
      if (this.config.ephemeral) args.push('--ephemeral');

      safeLog(`Spawning service for ${this.config.id}: ${process.execPath} ${entry}`);
      const child = spawn(process.execPath, args, {
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
        stdio: ['ignore', 'pipe', 'pipe']
      });
      this.child = child;
      this.ready = null;
      this.lastExit = null;

      let settled = false;

      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        try {
          child.kill('SIGKILL');
        } catch (e) {
          /* ignore */
        }
        reject(
          new Error(
            `nodegx-backend for "${this.config.name}" did not become ready within ${READY_TIMEOUT_MS / 1000}s.\n` +
              `Last output:\n${this.logTail()}`
          )
        );
      }, READY_TIMEOUT_MS);

      child.stdout.on('data', (chunk) => {
        this.appendLog('out', chunk);
        const text = chunk.toString();
        const readyLine = text.split('\n').find((l) => l.startsWith(READY_PREFIX));
        if (readyLine && !settled) {
          settled = true;
          clearTimeout(timeout);
          try {
            this.ready = JSON.parse(readyLine.substring(READY_PREFIX.length));
          } catch (e) {
            this.ready = {};
          }
          if (this.ready.port) {
            this.endpoint = `http://127.0.0.1:${this.ready.port}`;
          }
          safeLog(`Service ready for ${this.config.id} at ${this.endpoint}`);
          resolve(this.ready);
        }
      });

      child.stderr.on('data', (chunk) => this.appendLog('err', chunk));

      child.on('error', (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(new Error(`Failed to spawn nodegx-backend: ${err.message}`));
      });

      child.on('exit', (code, signal) => {
        this.lastExit = { code, signal };
        safeLog(`Service for ${this.config.id} exited (code=${code}, signal=${signal})`);
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          reject(
            new Error(
              `nodegx-backend for "${this.config.name}" exited before becoming ready ` +
                `(code=${code}, signal=${signal}).\nLast output:\n${this.logTail()}`
            )
          );
          return;
        }
        // Already ready, and now gone: a crash or an outside kill. `stop()`
        // marks its own teardown so a deliberate stop does not arrive as one.
        if (this.stopping || !this.config.onUnexpectedExit) return;
        try {
          this.config.onUnexpectedExit({ code, signal });
        } catch (e) {
          safeLog(`onUnexpectedExit handler threw: ${e.message}`);
        }
      });
    });
  }

  /** SIGTERM, then SIGKILL after the grace period. Resolves when exited. */
  stop() {
    // Set before any signal: the exit this is about to cause is expected, and
    // `onUnexpectedExit` is only for the ones nobody asked for.
    this.stopping = true;
    return new Promise((resolve) => {
      const child = this.child;
      if (!child || child.exitCode !== null) {
        this.child = null;
        resolve();
        return;
      }

      const killTimer = setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch (e) {
          /* ignore */
        }
      }, STOP_GRACE_MS);

      child.once('exit', () => {
        clearTimeout(killTimer);
        this.child = null;
        resolve();
      });

      try {
        child.kill('SIGTERM');
      } catch (e) {
        clearTimeout(killTimer);
        this.child = null;
        resolve();
      }
    });
  }

  /** GET <endpoint>/health, or null when unreachable. */
  async fetchHealth() {
    try {
      const res = await fetch(`${this.endpoint}/health`, { signal: AbortSignal.timeout(1500) });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  /** JSON request against the service; throws with the server's error message. */
  /**
   * The backend's admin credential (BAK-003), read from secrets.json in its
   * data dir — the editor owns that directory, so there is no bootstrap
   * problem. Attached as a bearer token on every proxied request so admin
   * routes keep working when the operator turns dev-open off. In dev-open the
   * backend ignores it (loopback + relaxed), so it is harmless there too.
   * @private
   */
  adminToken() {
    if (this._adminToken !== undefined) return this._adminToken;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fs = require('fs');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const path = require('path');
      const secretsPath = path.join(this.config.dataDir, 'secrets.json');
      this._adminToken = JSON.parse(fs.readFileSync(secretsPath, 'utf-8')).adminToken || null;
    } catch (e) {
      this._adminToken = null;
    }
    return this._adminToken;
  }

  async request(method, pathName, body) {
    const headers = {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    const token = this.adminToken();
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(`${this.endpoint}${pathName}`, {
      method,
      headers: Object.keys(headers).length ? headers : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000)
    });
    let json = null;
    try {
      json = await res.json();
    } catch (e) {
      /* non-JSON response */
    }
    if (!res.ok) {
      const message = (json && json.error) || `${method} ${pathName} failed with HTTP ${res.status}`;
      throw new Error(message);
    }
    return json;
  }

  /**
   * Open a realtime (SSE) subscription to one collection on the running backend
   * (BAK-001). Parses the event stream in the main process (Electron's main has
   * no EventSource) and calls `onEvent(kind, data)` for each `change`/`resync`
   * frame. The admin bearer token rides the request, so the data browser — an
   * admin surface — sees every change regardless of ACL. Auto-reconnects after
   * a drop; the returned handle's `close()` stops the stream for good.
   *
   * @param {Object} opts
   * @param {string} opts.collection - Collection to watch
   * @param {(kind: 'change'|'resync', data: any) => void} opts.onEvent
   * @returns {{ close: () => void }}
   */
  openRealtimeStream({ collection, onEvent }) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const http = require('http');
    const state = { closed: false, req: null, clientId: null, reconnectTimer: null };

    const scheduleReconnect = () => {
      if (state.closed || state.reconnectTimer) return;
      state.reconnectTimer = setTimeout(() => {
        state.reconnectTimer = null;
        connect();
      }, 2000);
    };

    const subscribe = () => {
      if (state.closed || !state.clientId) return;
      this.request('POST', '/realtime/subscriptions', {
        clientId: state.clientId,
        subscriptions: [{ collection }]
      }).catch(() => {
        /* a failed (re)subscribe is retried on the next reconnect */
      });
    };

    const connect = () => {
      if (state.closed) return;
      const url = new URL(this.endpoint + '/realtime');
      const headers = { Accept: 'text/event-stream' };
      const token = this.adminToken();
      if (token) headers.Authorization = `Bearer ${token}`;

      const req = http.request(
        { hostname: url.hostname, port: url.port, path: url.pathname, method: 'GET', headers },
        (res) => {
          if (res.statusCode !== 200) {
            res.destroy();
            scheduleReconnect();
            return;
          }
          res.setEncoding('utf8');
          let buffer = '';
          res.on('data', (chunk) => {
            buffer += chunk;
            let sep;
            while ((sep = buffer.indexOf('\n\n')) !== -1) {
              const block = buffer.slice(0, sep);
              buffer = buffer.slice(sep + 2);
              if (block.startsWith(':')) continue; // heartbeat
              let event;
              let data;
              for (const line of block.split('\n')) {
                if (line.startsWith('event: ')) event = line.slice(7);
                else if (line.startsWith('data: ')) {
                  try {
                    data = JSON.parse(line.slice(6));
                  } catch (e) {
                    /* ignore unparsable frame */
                  }
                }
              }
              if (event === 'connected' && data) {
                state.clientId = data.clientId;
                subscribe();
              } else if (event === 'change' || event === 'resync') {
                if (onEvent) onEvent(event, data);
              }
            }
          });
          res.on('end', scheduleReconnect);
          res.on('error', scheduleReconnect);
        }
      );
      req.on('error', () => {
        if (!state.closed) scheduleReconnect();
      });
      req.end();
      state.req = req;
    };

    connect();

    return {
      close() {
        state.closed = true;
        if (state.reconnectTimer) clearTimeout(state.reconnectTimer);
        if (state.req) {
          try {
            state.req.destroy();
          } catch (e) {
            /* already gone */
          }
        }
      }
    };
  }
}

module.exports = { ServiceSupervisor, resolveServiceEntry };
