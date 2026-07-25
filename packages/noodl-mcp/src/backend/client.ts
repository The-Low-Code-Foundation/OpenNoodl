/**
 * BackendClient — the MCP server's HTTP link to a running nodegx-backend
 * (BAK-003). The rest of noodl-mcp is file-only; this is the one place it
 * reaches a live service, so the backend tools (permissions/roles/keys) can
 * exist despite the server having no editor bridge.
 *
 * Discovery mirrors the editor's own layout (BackendManager): backends live
 * under `~/.noodl/backends/<id>/` with a `config.json` (id, name, port) and,
 * once BAK-003 has run, a `secrets.json` (the admin credential). We read the
 * admin token straight from the backend dir the same way the editor does — no
 * bootstrap chicken-and-egg — and talk to `http://127.0.0.1:<port>` with it.
 *
 * A backend is "reachable" when its `/health` answers; tools call
 * `requireBackend()` which resolves the target (explicit id, or the sole
 * running one) and fails loudly with an actionable message otherwise.
 *
 * @module noodl-mcp/backend/client
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { ToolError } from '../errors';

export interface BackendDescriptor {
  id: string;
  name: string;
  port: number;
  dir: string;
  adminToken: string | null;
}

/** The directory the editor persists backends under (BackendManager). */
export function backendsRoot(): string {
  return process.env.NODEGX_BACKENDS_DIR || path.join(os.homedir(), '.noodl', 'backends');
}

/** Enumerate configured backends (running or not) from disk. */
export function listBackends(): BackendDescriptor[] {
  const root = backendsRoot();
  let entries: string[];
  try {
    entries = fs.readdirSync(root);
  } catch {
    return [];
  }
  const backends: BackendDescriptor[] = [];
  for (const id of entries) {
    const dir = path.join(root, id);
    const configPath = path.join(dir, 'config.json');
    if (!fs.existsSync(configPath)) continue;
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      let adminToken: string | null = null;
      const secretsPath = path.join(dir, 'secrets.json');
      if (fs.existsSync(secretsPath)) {
        try {
          adminToken = JSON.parse(fs.readFileSync(secretsPath, 'utf-8')).adminToken || null;
        } catch {
          adminToken = null;
        }
      }
      backends.push({ id: config.id || id, name: config.name || id, port: config.port, dir, adminToken });
    } catch {
      // A malformed config.json shouldn't hide the other backends.
    }
  }
  return backends;
}

export interface BackendResponse {
  status: number;
  json: unknown;
}

export class BackendClient {
  constructor(private readonly backend: BackendDescriptor) {}

  get descriptor(): BackendDescriptor {
    return this.backend;
  }

  async request(method: string, routePath: string, body?: unknown): Promise<BackendResponse> {
    const headers: Record<string, string> = {};
    if (this.backend.adminToken) headers.authorization = `Bearer ${this.backend.adminToken}`;
    if (body !== undefined) headers['content-type'] = 'application/json';

    let res: Response;
    try {
      res = await fetch(`http://127.0.0.1:${this.backend.port}${routePath}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined
      });
    } catch (e) {
      throw new ToolError(
        'no-backend',
        `Could not reach backend "${this.backend.name}" on port ${this.backend.port}: ${
          e instanceof Error ? e.message : e
        }. Is it running? Start it from the editor's Backend Services panel.`
      );
    }
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      /* non-JSON */
    }
    if (res.status === 401) {
      throw new ToolError(
        'backend-error',
        `Backend "${this.backend.name}" rejected the admin credential (401). ` +
          (this.backend.adminToken
            ? 'The token in its secrets.json may be stale.'
            : `No secrets.json found in ${this.backend.dir} — start the backend once under BAK-003 to mint the admin credential.`)
      );
    }
    if (res.status >= 400) {
      const message = (json && typeof json === 'object' && (json as { error?: string }).error) || `HTTP ${res.status}`;
      throw new ToolError('backend-error', `Backend "${this.backend.name}": ${message}`);
    }
    return { status: res.status, json };
  }

  /** Health probe used to decide "running". */
  async isReachable(): Promise<boolean> {
    try {
      const res = await fetch(`http://127.0.0.1:${this.backend.port}/health`);
      return res.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Resolve the target backend for a tool call: an explicit `backendId`, or the
 * single reachable backend when there's exactly one. Fails with an actionable
 * message listing candidates otherwise.
 */
export async function requireBackend(backendId?: string): Promise<BackendClient> {
  const all = listBackends();
  if (all.length === 0) {
    throw new ToolError(
      'no-backend',
      `No backends found under ${backendsRoot()}. Create one from the editor's Backend Services panel first.`
    );
  }

  if (backendId) {
    const match = all.find((b) => b.id === backendId || b.name === backendId);
    if (!match) {
      throw new ToolError(
        'no-backend',
        `No backend named "${backendId}". Known: ${all.map((b) => b.id).join(', ') || '(none)'}.`
      );
    }
    return new BackendClient(match);
  }

  // No id given: pick the sole reachable backend.
  const reachable: BackendDescriptor[] = [];
  for (const b of all) {
    if (await new BackendClient(b).isReachable()) reachable.push(b);
  }
  if (reachable.length === 1) return new BackendClient(reachable[0]);
  if (reachable.length === 0) {
    throw new ToolError(
      'no-backend',
      `No running backend. Configured: ${all
        .map((b) => b.id)
        .join(', ')}. Start one from the editor's Backend Services panel, then pass its id as backendId.`
    );
  }
  throw new ToolError(
    'no-backend',
    `Multiple backends are running (${reachable
      .map((b) => b.id)
      .join(', ')}); pass backendId to choose one.`
  );
}
