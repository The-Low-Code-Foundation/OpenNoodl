/**
 * SecurityState — the model wired to disk and database (BAK-003).
 *
 * Three stores, three lifetimes (model doc §2):
 *   - `<dataDir>/security.json` — policy. Diffable, deploys with the backend,
 *     MCP-editable. Strictly validated; an invalid file refuses to start.
 *   - `<dataDir>/secrets.json`  — the admin credential (plaintext, mode 0600).
 *     The editor reads it from the backend dir it owns; deploys provision it
 *     via --token (the WF-004 flag, which now means "admin credential").
 *   - the database — sessions, role membership, hashed API keys.
 *
 * Also home of the deploy interlock: a non-loopback bind with devOpen on is a
 * refuse-to-start error, and enforcement over the ephemeral mock (which cannot
 * evaluate ACLs) likewise refuses. Loud-failure doctrine applied to security.
 *
 * @module nodegx-backend/security/state
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type * as http from 'http';

import type { AdapterFacade, AclOption } from '../persistence/AdapterFacade';
import { HttpError } from '../server/http-util';
import {
  ClpOp,
  Principal,
  SecurityConfig,
  defaultSecurityConfig,
  validateSecurityConfig,
  principalKeys,
  checkClp,
  effectiveCreatorOwns,
  AccessDecision
} from './model';

export class SecurityStartupError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'SecurityStartupError';
    this.code = code;
  }
}

export type { AclOption } from '../persistence/AdapterFacade';

const SECURITY_FILE = 'security.json';
const SECRETS_FILE = 'secrets.json';

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

/** Constant-time string compare (hash both sides to erase length information). */
function safeEqual(a: string, b: string): boolean {
  return crypto.timingSafeEqual(Buffer.from(sha256(a), 'hex'), Buffer.from(sha256(b), 'hex'));
}

function atomicWriteJSON(filePath: string, value: unknown, mode?: number): void {
  const tmp = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', mode !== undefined ? { mode } : undefined);
  fs.renameSync(tmp, filePath);
  if (mode !== undefined) {
    try {
      fs.chmodSync(filePath, mode);
    } catch {
      // chmod is best-effort on platforms without POSIX modes.
    }
  }
}

export interface SecurityDeps {
  dataDir: string;
  /** Loopback bind? (The interlock and the dev-open fast-path both key on it.) */
  loopback: boolean;
  /** WF-004 --token value, if given: provisions/overrides the admin credential. */
  cliToken: string | null;
  facade: AdapterFacade;
}

export class SecurityState {
  readonly config: SecurityConfig;
  readonly adminToken: string;
  /** True when the default config was just written (migration notice surface). */
  readonly migratedThisStart: boolean;
  private readonly deps: SecurityDeps;

  constructor(deps: SecurityDeps) {
    this.deps = deps;

    // --- security.json ------------------------------------------------------
    const configPath = path.join(deps.dataDir, SECURITY_FILE);
    if (fs.existsSync(configPath)) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      } catch (e) {
        throw new SecurityStartupError(
          'SECURITY_CONFIG_INVALID',
          `${configPath} is not valid JSON: ${e instanceof Error ? e.message : e}`
        );
      }
      const errors = validateSecurityConfig(parsed);
      if (errors.length > 0) {
        throw new SecurityStartupError(
          'SECURITY_CONFIG_INVALID',
          `${configPath} is invalid — refusing to start with a security config that would not be fully enforced:\n` +
            errors.map((e) => `  - ${e}`).join('\n')
        );
      }
      this.config = parsed as SecurityConfig;
      this.migratedThisStart = false;
    } else {
      this.config = defaultSecurityConfig();
      fs.mkdirSync(deps.dataDir, { recursive: true });
      atomicWriteJSON(configPath, this.config);
      this.migratedThisStart = true;
    }

    // --- secrets.json -------------------------------------------------------
    const secretsPath = path.join(deps.dataDir, SECRETS_FILE);
    let secrets: { adminToken?: string } = {};
    if (fs.existsSync(secretsPath)) {
      try {
        secrets = JSON.parse(fs.readFileSync(secretsPath, 'utf-8'));
      } catch {
        throw new SecurityStartupError(
          'SECRETS_INVALID',
          `${secretsPath} is not valid JSON. Delete it to mint a fresh admin credential, or fix it.`
        );
      }
    }
    if (deps.cliToken) {
      // WF-004 migration: the --token flag provisions the admin credential.
      secrets.adminToken = deps.cliToken;
      atomicWriteJSON(secretsPath, secrets, 0o600);
    } else if (!secrets.adminToken) {
      secrets.adminToken = crypto.randomBytes(32).toString('base64url');
      atomicWriteJSON(secretsPath, secrets, 0o600);
    }
    this.adminToken = secrets.adminToken;

    // --- The deploy interlock ----------------------------------------------
    if (!deps.loopback && this.config.devOpen) {
      throw new SecurityStartupError(
        'DEV_OPEN_ON_PUBLIC_BIND',
        `Refusing to start: ${configPath} has "devOpen": true but the service is asked to bind beyond ` +
          `localhost. Dev-open disables all access control and exists only for local development.\n` +
          `  Fix: set "devOpen": false in ${SECURITY_FILE} (then configure collection permissions), ` +
          `or bind to 127.0.0.1.`
      );
    }
  }

  /** Persist the (mutated) config. Callers mutate this.config then save. */
  save(): void {
    atomicWriteJSON(path.join(this.deps.dataDir, SECURITY_FILE), this.config);
  }

  /** Dev-open is only ever active on a loopback bind (the interlock guarantees it). */
  get devOpenActive(): boolean {
    return this.config.devOpen && this.deps.loopback;
  }

  // ==========================================================================
  // Principal resolution (evaluation-order step 1)
  // ==========================================================================

  async resolvePrincipal(req: http.IncomingMessage): Promise<Principal> {
    const h = req.headers;

    // 1. Master key / admin bearer token.
    const masterKey = h['x-parse-master-key'];
    if (typeof masterKey === 'string' && masterKey.length > 0) {
      if (safeEqual(masterKey, this.adminToken)) return { kind: 'admin' };
      throw new HttpError(401, 'Unauthorized.');
    }
    const auth = h['authorization'];
    if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
      if (safeEqual(auth.slice('Bearer '.length), this.adminToken)) return { kind: 'admin' };
      throw new HttpError(401, 'Unauthorized.');
    }

    // 2. API key.
    const apiKey = h['x-nodegx-api-key'];
    if (typeof apiKey === 'string' && apiKey.length > 0) {
      const row = this.lookupApiKey(apiKey);
      if (!row) throw new HttpError(401, 'Unauthorized.');
      this.touchApiKey(row.objectId);
      return { kind: 'apiKey', name: row.name, scopes: row.scopes };
    }

    // 3. Session token. The literal strings "undefined"/"null" occur when a
    //    client stringifies an absent token into the header; treat as absent.
    const token = h['x-parse-session-token'];
    if (typeof token === 'string' && token.length > 0 && token !== 'undefined' && token !== 'null') {
      const { results } = await this.deps.facade.rawQuery('_Session', {
        where: { sessionToken: token },
        limit: 1
      });
      const session = results[0];
      if (!session) throw new HttpError(400, 'Invalid session token', 209);
      let user: Record<string, unknown>;
      try {
        user = await this.deps.facade.rawFetch('_User', session.userId as string);
      } catch {
        throw new HttpError(400, 'Invalid session token', 209);
      }
      const userId = user.objectId as string;
      return { kind: 'user', userId, roles: this.rolesForUser(userId) };
    }

    return { kind: 'anonymous' };
  }

  // ==========================================================================
  // Decisions (evaluation-order steps 2–4 helpers)
  // ==========================================================================

  checkClp(principal: Principal, collection: string, op: ClpOp): AccessDecision {
    return checkClp(this.config, principal, collection, op);
  }

  /**
   * The acl option for an adapter call, or undefined when the caller bypasses
   * row-level checks (dev-open, admin, or an API key whose scope covers the
   * access — scoped keys are data-plane tools, not users; model doc §6).
   */
  aclFor(principal: Principal, access: 'read' | 'write'): AclOption | undefined {
    if (this.devOpenActive) return undefined;
    if (principal.kind === 'admin') return undefined;
    if (principal.kind === 'apiKey') {
      const covered =
        principal.scopes.includes('classes:*') ||
        principal.scopes.includes(access === 'read' ? 'classes:read' : 'classes:write');
      // A key that got past the CLP check has a covering scope, so this is
      // effectively always a bypass; the branch is defensive.
      return covered ? undefined : { access, keys: [] };
    }
    return { access, keys: principalKeys(principal) };
  }

  creatorOwns(collection: string): boolean {
    return effectiveCreatorOwns(this.config, collection);
  }

  // ==========================================================================
  // Roles (flat; membership in the _Join_users__Role junction)
  // ==========================================================================

  // The role/key stores use prepared statements on the raw engine handle: the
  // adapter's query API can't express joins, and these run on every request.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private get db(): any {
    return this.deps.facade.adapter.getDatabase();
  }

  rolesForUser(userId: string): string[] {
    try {
      const rows = this.db
        .prepare(
          'SELECT r."name" AS name FROM "_Role" r ' +
            'JOIN "_Join_users__Role" j ON j."owningId" = r."objectId" WHERE j."relatedId" = ?'
        )
        .all(userId) as { name: string }[];
      return rows.map((r) => r.name);
    } catch {
      // Tables exist from service start; a failure here means no memberships.
      return [];
    }
  }

  // ==========================================================================
  // API keys (_ApiKey: name, keyHash, scopes JSON, revoked, lastUsedAt)
  // ==========================================================================

  private lookupApiKey(secret: string): { objectId: string; name: string; scopes: string[] } | null {
    try {
      const row = this.db
        .prepare('SELECT "objectId", "name", "scopes", "revoked" FROM "_ApiKey" WHERE "keyHash" = ?')
        .get(sha256(secret)) as { objectId: string; name: string; scopes: string; revoked: number } | undefined;
      if (!row || row.revoked) return null;
      let scopes: string[] = [];
      try {
        scopes = JSON.parse(row.scopes) || [];
      } catch {
        scopes = [];
      }
      return { objectId: row.objectId, name: row.name, scopes };
    } catch {
      return null;
    }
  }

  private touchApiKey(objectId: string): void {
    try {
      this.db
        .prepare('UPDATE "_ApiKey" SET "lastUsedAt" = ? WHERE "objectId" = ?')
        .run(new Date().toISOString(), objectId);
    } catch {
      // lastUsedAt is advisory.
    }
  }

  /** Create a key; returns the plaintext secret exactly once. */
  createApiKey(name: string, scopes: string[]): { objectId: string; secret: string } {
    const secret = 'ngxk_' + crypto.randomBytes(32).toString('base64url');
    const objectId = crypto.randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        'INSERT INTO "_ApiKey" ("objectId", "createdAt", "updatedAt", "name", "keyHash", "scopes", "revoked") ' +
          'VALUES (?, ?, ?, ?, ?, ?, 0)'
      )
      .run(objectId, now, now, name, sha256(secret), JSON.stringify(scopes));
    return { objectId, secret };
  }

  listApiKeys(): { objectId: string; name: string; scopes: string[]; revoked: boolean; createdAt: string; lastUsedAt: string | null }[] {
    const rows = this.db
      .prepare('SELECT "objectId", "name", "scopes", "revoked", "createdAt", "lastUsedAt" FROM "_ApiKey"')
      .all() as { objectId: string; name: string; scopes: string; revoked: number; createdAt: string; lastUsedAt: string | null }[];
    return rows.map((r) => ({
      objectId: r.objectId,
      name: r.name,
      scopes: (() => {
        try {
          return JSON.parse(r.scopes) || [];
        } catch {
          return [];
        }
      })(),
      revoked: Boolean(r.revoked),
      createdAt: r.createdAt,
      lastUsedAt: r.lastUsedAt || null
    }));
  }

  revokeApiKey(objectId: string): boolean {
    const result = this.db.prepare('UPDATE "_ApiKey" SET "revoked" = 1 WHERE "objectId" = ?').run(objectId);
    return Boolean(result && result.changes > 0);
  }
}
