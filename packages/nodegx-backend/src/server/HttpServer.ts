/**
 * HTTP surface — PLACEHOLDER (relocation deferred to WF-004 second half).
 *
 * ============================================================================
 * DEFERRED. Do not build the full surface here yet.
 * ============================================================================
 *
 * The real HTTP surface currently lives in the editor's main process at
 * `packages/noodl-editor/src/main/src/local-backend/LocalBackendServer.js`
 * (Express app, ~595 lines). It is being actively edited by another task
 * (WF-006) at the time of this scaffold, so extracting/relocating it here is
 * explicitly out of scope for the front half to avoid a collision.
 *
 * When the second half lands, this module becomes the standalone HTTP server
 * that fronts the same LocalSQLAdapter with TWO route families:
 *
 *   1. `/api/:table`  — the existing BYOB CRUD routes (move as-is).
 *   2. Parse-wire subset — `/classes/:collection`, `/aggregate`, `/files`,
 *      `/functions/:name`, `/config`, minimal sessions (`/login`, `/logout`,
 *      `/users`, `/users/me`). This is what lets the 9 record nodes and the
 *      user nodes talk to the local backend with zero client-file changes.
 *      (See WF-004 §"The wire-protocol decision".)
 *
 * Plus a real `/health` endpoint (the minimal placeholder below is the only
 * part that exists today, purely to prove the process boundary is runnable).
 *
 * Auth: localhost-only by default; bearer token enforced on any non-loopback
 * bind (see config.requiresAuth).
 *
 * @module nodegx-backend/server/HttpServer
 */

import * as http from 'http';

import type { BackendServiceOptions } from '../config';
import type { PersistenceHandle } from '../persistence/createAdapter';

export interface HttpServerDeps {
  options: BackendServiceOptions;
  persistence: PersistenceHandle;
}

/** Result of a successful listen(). */
export interface ListenInfo {
  host: string;
  port: number;
  url: string;
}

/**
 * Minimal health-only HTTP server.
 *
 * This is a deliberate stub: it exposes ONLY `/health` so the packaged/headless
 * service can be started, supervised, and probed today. Every data/auth/function
 * route is a 501 pointing at the second half. Do not grow this into the real
 * surface here — that relocation is tracked and must not collide with WF-006.
 */
export class HttpServer {
  private readonly options: BackendServiceOptions;
  private readonly persistence: PersistenceHandle;
  private server: http.Server | null = null;

  constructor(deps: HttpServerDeps) {
    this.options = deps.options;
    this.persistence = deps.persistence;
  }

  listen(): Promise<ListenInfo> {
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => this.handle(req, res));
      server.on('error', reject);
      server.listen(this.options.port, this.options.host, () => {
        const addr = server.address();
        const port = typeof addr === 'object' && addr ? addr.port : this.options.port;
        this.server = server;
        resolve({ host: this.options.host, port, url: `http://${this.options.host}:${port}` });
      });
    });
  }

  private handle(req: http.IncomingMessage, res: http.ServerResponse): void {
    if (req.url && req.url.split('?')[0] === '/health') {
      const status = this.persistence.status;
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          ok: true,
          service: 'nodegx-backend',
          persistence: {
            mode: status.mode,
            engine: status.engine,
            persistent: status.persistent,
            ephemeral: status.ephemeral
          }
        })
      );
      return;
    }

    // Everything else is deferred to the second half.
    res.writeHead(501, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        error: 'Not implemented in the front-half scaffold',
        detail:
          'Data/auth/function routes (BYOB /api/:table + Parse-wire /classes, /functions, ' +
          '/files, /config, sessions) are relocated in the second half of WF-004.'
      })
    );
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) return resolve();
      this.server.close(() => resolve());
      this.server = null;
    });
  }
}
