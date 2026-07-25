/**
 * The service's HTTP surface (WF-004 second half — the front-half /health stub
 * grown into the real router). Three route families front the same database:
 *
 *   1. BYOB `/api/:table` + `/api/_schema` + `/api/_batch` — the existing
 *      local-backend REST surface (BYOB nodes, Data Browser via IPC proxy).
 *   2. Parse-wire subset — `/classes`, `/aggregate`, `/files`, `/functions`,
 *      `/config`, `/login`, `/logout`, `/users*`. What lets the record/user/
 *      function nodes work against this backend with zero client changes.
 *   3. Admin — `/admin/*`, `/executions*`: the supervisor surface the editor's
 *      BackendManager proxies its IPC to, plus execution history reads.
 *
 * Auth policy (WF-004): loopback binds are open; any wider bind requires
 * `Authorization: Bearer <token>` on everything except `/health`.
 *
 * @module nodegx-backend/server/HttpServer
 */

import * as http from 'http';

import type { BackendServiceOptions } from '../config';
import { requiresAuth } from '../config';
import type { PersistenceHandle } from '../persistence/createAdapter';
import type { AdapterFacade } from '../persistence/AdapterFacade';
import type { ExecutionHistory } from '../execution/ExecutionStore';
import type { WorkflowRunner } from '../workflow/WorkflowRunner';
import { ByobAdminRoutes } from './byob-admin';
import { FileRoutes } from './files';
import { ParseWireRoutes } from './parse-wire';
import { UserRoutes } from './users';
import { CORS_HEADERS, HttpError, parseURL, readJSONBody, sendError, sendJSON } from './http-util';

export interface HttpServerDeps {
  options: BackendServiceOptions;
  persistence: PersistenceHandle;
  facade: AdapterFacade;
  executions: ExecutionHistory;
  /** Late-bound: the runner loads after the server starts listening. */
  getRunner: () => WorkflowRunner | null;
  /** Project config served at /config. Defaults to {}. */
  getConfigParams?: () => Record<string, unknown>;
}

/** Result of a successful listen(). */
export interface ListenInfo {
  host: string;
  port: number;
  url: string;
}

export class HttpServer {
  private readonly options: BackendServiceOptions;
  private readonly persistence: PersistenceHandle;
  private readonly getRunner: () => WorkflowRunner | null;
  private server: http.Server | null = null;
  private startedAt = 0;

  private readonly byob: ByobAdminRoutes;
  private readonly parse: ParseWireRoutes;
  private readonly users: UserRoutes;
  private readonly files: FileRoutes;

  constructor(deps: HttpServerDeps) {
    this.options = deps.options;
    this.persistence = deps.persistence;
    this.getRunner = deps.getRunner;

    this.byob = new ByobAdminRoutes(deps.facade, deps.executions, deps.getRunner);
    this.parse = new ParseWireRoutes(deps.facade, deps.getConfigParams || (() => ({})));
    this.users = new UserRoutes(deps.facade);
    this.files = new FileRoutes(deps.options.dataDir, `http://127.0.0.1:${deps.options.port}`);
  }

  listen(): Promise<ListenInfo> {
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        this.handle(req, res).catch((err) => sendError(res, err));
      });
      server.on('error', reject);
      server.listen(this.options.port, this.options.host, () => {
        const addr = server.address();
        const port = typeof addr === 'object' && addr ? addr.port : this.options.port;
        this.server = server;
        this.startedAt = Date.now();
        const url = `http://${this.options.host}:${port}`;
        this.files.setBaseUrl(url);
        resolve({ host: this.options.host, port, url });
      });
    });
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) return resolve();
      this.server.close(() => resolve());
      this.server = null;
    });
  }

  // ==========================================================================
  // Router
  // ==========================================================================

  private async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const { pathname, query } = parseURL(req.url || '/');
    const method = req.method || 'GET';

    if (method === 'OPTIONS') {
      res.writeHead(204, { ...CORS_HEADERS, 'Access-Control-Max-Age': '86400' });
      res.end();
      return;
    }

    if (pathname === '/health' && method === 'GET') {
      return this.health(res);
    }

    // Bearer-token gate for non-loopback binds (everything except /health).
    if (requiresAuth(this.options) && this.options.authToken) {
      const auth = req.headers['authorization'];
      if (auth !== `Bearer ${this.options.authToken}`) {
        throw new HttpError(401, 'Unauthorized: this service is bound beyond localhost and requires a bearer token.');
      }
    }

    const seg = pathname.split('/').filter(Boolean).map(decodeURIComponent);

    // ---- BYOB family -------------------------------------------------------
    if (seg[0] === 'api') {
      if (seg[1] === '_schema' && seg.length === 2) {
        if (method === 'GET') return this.byob.getSchema(res);
        if (method === 'POST') return this.byob.mutateSchema(req, res);
      }
      if (seg[1] === '_batch' && seg.length === 2 && method === 'POST') {
        return this.byob.batch(req, res);
      }
      if (seg.length === 2) {
        if (method === 'GET') return this.byob.query(res, seg[1], query);
        if (method === 'POST') return this.byob.create(req, res, seg[1]);
      }
      if (seg.length === 3) {
        if (method === 'GET') return this.byob.fetch(res, seg[1], seg[2]);
        if (method === 'PUT') return this.byob.save(req, res, seg[1], seg[2]);
        if (method === 'DELETE') return this.byob.delete(res, seg[1], seg[2]);
      }
    }

    // ---- Admin family ------------------------------------------------------
    if (seg[0] === 'admin') {
      if (seg[1] === 'status' && method === 'GET') return this.adminStatus(res);
      if (seg[1] === 'schema' && seg.length === 2) {
        if (method === 'GET') return this.byob.getSchema(res);
        if (method === 'POST') return this.byob.mutateSchema(req, res);
      }
      if (seg[1] === 'schema' && seg.length === 3 && method === 'GET') {
        return this.byob.getTableSchema(res, seg[2]);
      }
      if (seg[1] === 'schema-export' && method === 'GET') {
        return this.byob.exportSchema(res, query.format || 'json');
      }
      if (seg[1] === 'workflows' && seg.length === 2 && method === 'GET') {
        return this.byob.workflowStatus(res);
      }
      if (seg[1] === 'workflows' && seg[2] === 'reload' && method === 'POST') {
        return this.byob.reloadWorkflows(res);
      }
      if (seg[1] === 'workflows' && seg.length === 3) {
        if (method === 'PUT') return this.byob.updateWorkflow(req, res, seg[2]);
        if (method === 'DELETE') return this.byob.deleteWorkflow(res, seg[2]);
      }
    }

    if (seg[0] === 'executions') {
      if (seg.length === 1 && method === 'GET') return this.byob.listExecutions(res, query);
      if (seg.length === 2 && method === 'GET') return this.byob.getExecution(res, seg[1]);
    }

    // ---- Parse-wire family -------------------------------------------------
    if (seg[0] === 'classes') {
      if (seg.length === 2) {
        if (method === 'POST') return this.parse.classesPost(req, res, seg[1]);
        if (method === 'GET') return this.parse.classesGet(res, seg[1], query);
      }
      if (seg.length === 3) {
        if (method === 'GET') return this.parse.classGet(res, seg[1], seg[2], query);
        if (method === 'PUT') return this.parse.classPut(req, res, seg[1], seg[2]);
        if (method === 'DELETE') return this.parse.classDelete(res, seg[1], seg[2]);
      }
    }

    if (seg[0] === 'aggregate' && seg.length === 2 && method === 'GET') {
      return this.parse.aggregate(res, seg[1], query);
    }

    if (seg[0] === 'config' && seg.length === 1 && method === 'GET') {
      return this.parse.config(res);
    }

    if (seg[0] === 'functions' && seg.length === 2 && method === 'POST') {
      return this.runFunction(req, res, seg[1]);
    }

    if (seg[0] === 'files' && seg.length === 2) {
      if (method === 'POST') return this.files.upload(req, res, seg[1]);
      if (method === 'GET') return this.files.serve(res, seg[1]);
      if (method === 'DELETE') return this.files.delete(res, seg[1]);
    }

    // Sessions
    if (pathname === '/login' && method === 'POST') return this.users.login(req, res);
    if (pathname === '/logout' && method === 'POST') return this.users.logout(req, res);
    if (pathname === '/users' && method === 'POST') return this.users.signup(req, res);
    if (pathname === '/users/me' && method === 'GET') return this.users.me(req, res);
    if (seg[0] === 'users' && seg.length === 2 && method === 'PUT') {
      return this.users.updateUser(req, res, seg[1]);
    }
    if (this.users.handleUnsupported(res, pathname)) return;

    throw new HttpError(404, `Not found: ${method} ${pathname}`);
  }

  // ==========================================================================
  // Handlers that live at the router level
  // ==========================================================================

  private health(res: http.ServerResponse): void {
    const runner = this.getRunner();
    const status = this.persistence.status;
    sendJSON(res, 200, {
      ok: true,
      service: 'nodegx-backend',
      backendId: this.options.backendId,
      backendName: this.options.backendName,
      uptimeMs: this.startedAt ? Date.now() - this.startedAt : 0,
      persistence: {
        mode: status.mode,
        engine: status.engine,
        persistent: status.persistent,
        ephemeral: status.ephemeral,
        error: status.error
      },
      workflows: runner ? runner.getStatus() : { initialized: false, workflowCount: 0, functions: [] }
    });
  }

  private adminStatus(res: http.ServerResponse): void {
    // Same payload as /health — the IPC proxy uses this name for clarity.
    this.health(res);
  }

  private async runFunction(req: http.IncomingMessage, res: http.ServerResponse, functionName: string): Promise<void> {
    const runner = this.getRunner();
    if (!runner) {
      throw new HttpError(503, 'Workflows are still starting up');
    }

    // The runner receives the request in CloudRunner's shape: raw JSON string
    // body + headers verbatim (session tokens ride along in headers).
    const body = await readJSONBody(req);
    const response = await runner.run(functionName, {
      body: JSON.stringify(body),
      headers: req.headers as Record<string, unknown>
    });

    res.writeHead(response.statusCode, { 'Content-Type': 'application/json', ...CORS_HEADERS });
    res.end(response.body);
  }
}
