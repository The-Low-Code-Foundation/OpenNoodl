/**
 * SecretsStore — the ONE secrets convention for the backend (WF-005).
 *
 * The task specifies a single shared secrets convention that BAK-002 (email)
 * and WF-005 (webhook secrets) both use. This module is that convention.
 *
 * ## The convention
 *
 * `<dataDir>/secrets.json` is a flat JSON object, written mode 0600, holding
 * every backend secret. It is NAMESPACED by subsystem so independently-built
 * features never collide:
 *
 *   {
 *     "adminToken": "<security's admin credential>",   // BAK-003 (top-level, legacy)
 *     "webhooks":   { "<triggerId>": "<hook secret>" }, // WF-005 (this module)
 *     "email":      { ... },                            // BAK-002 (reserved namespace)
 *     "functions":  { "STRIPE_KEY": "sk_live_…" }       // CWF-009 (the USER namespace)
 *   }
 *
 * Rules every writer MUST follow (why this composes):
 *   - Read-modify-write the WHOLE file and preserve unknown top-level keys.
 *     SecurityState already does this for `adminToken`; this store does it for
 *     every namespaced section. So SecurityState writing `adminToken` and this
 *     store writing `webhooks` never clobber each other.
 *   - Own exactly one top-level key (your namespace). WF-005 owns `webhooks`.
 *     BAK-002 should own `email` (or `smtp`). Never write another subsystem's key.
 *   - Secrets live HERE, never in the diffable/deployable policy files
 *     (security.json, triggers.json). Those files may reference a secret by id,
 *     but the plaintext only ever lives in secrets.json.
 *
 * ## `functions` — the one namespace a cloud function may read (CWF-009)
 *
 * Every namespace above belongs to a SUBSYSTEM: the backend itself is the only
 * reader, and the credential is one the backend minted or was configured with.
 * `functions` is different in kind — it is the namespace the *author of the
 * project* owns, and the only one a Secret node inside a cloud function can
 * reach ({@link FUNCTION_SECRETS_NAMESPACE}).
 *
 * The policy, decided here because this comment is what the next subsystem
 * reads:
 *
 *   - **A cloud function reads `functions` and nothing else.** The resolver in
 *     `service.ts` passes this constant and never takes a namespace from the
 *     graph, so `webhooks`, `email`, `auth`, `files` and the top-level
 *     `adminToken` are not merely forbidden to the Secret node — they are
 *     unnameable by it. That matters because "the author of a function is the
 *     person who deploys the backend" stops being true the day an agent writes
 *     one (TALK-007 §3.1 consequence 3), and a flat trust model is a bad thing
 *     to still be relying on when that happens.
 *   - **No subsystem may put its own credential in `functions`**, for the
 *     mirror-image reason: everything in there is readable by any function in
 *     the project.
 *   - **Names, never values, leave this process.** {@link SecretsStore.names}
 *     exists so a future editor panel can list what is provisioned without a
 *     read-back path; there is deliberately no "get every secret" method.
 *
 * A function may ALSO be given a secret through the environment, as
 * `NODEGX_SECRET_<NAME>` — resolved in `service.ts` as a fallback after this
 * file, for deploy targets that provision env vars rather than a data
 * directory. That is not a second store: `process.env` is already fully
 * readable from any cloud function (TALK-007 §3.1), so the env fallback adds a
 * door, not an exposure.
 *
 * secrets.json is provisioned by the deploy target (or minted on first start)
 * and is NOT committed / NOT part of the diffable config that deploys with the
 * backend — it is machine-local credential material.
 *
 * @module nodegx-backend/config/SecretsStore
 */

import * as fs from 'fs';
import * as path from 'path';

const SECRETS_FILE = 'secrets.json';

function atomicWrite0600(filePath: string, value: unknown): void {
  const tmp = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(tmp, filePath);
  try {
    fs.chmodSync(filePath, 0o600);
  } catch {
    // chmod is best-effort on platforms without POSIX modes.
  }
}

/**
 * A namespaced view over secrets.json. Every read and write goes through the
 * whole-file read-modify-write above so concurrent subsystems (and the
 * SecurityState admin-token writer) never lose each other's data.
 */
export class SecretsStore {
  private readonly filePath: string;

  constructor(dataDir: string) {
    this.filePath = path.join(dataDir, SECRETS_FILE);
  }

  /** Read and parse the whole file, or {} when absent. Throws on corrupt JSON (loud). */
  private readAll(): Record<string, unknown> {
    if (!fs.existsSync(this.filePath)) return {};
    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
    } catch (e) {
      throw new Error(
        `${this.filePath} is not valid JSON: ${e instanceof Error ? e.message : e}. ` +
          `Fix it or delete it (deleting loses the admin credential and every webhook secret).`
      );
    }
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  }

  /** The namespace section as a string→string map ({} when absent). */
  private section(namespace: string): Record<string, string> {
    const all = this.readAll();
    const section = all[namespace];
    return section && typeof section === 'object' && !Array.isArray(section) ? (section as Record<string, string>) : {};
  }

  /** Read one secret from a namespace, or undefined. */
  get(namespace: string, key: string): string | undefined {
    const value = this.section(namespace)[key];
    return typeof value === 'string' ? value : undefined;
  }

  /**
   * The names in a namespace, sorted. Names only — there is deliberately no
   * method that hands back every value, because a surface that can read a
   * secret back is a surface that has to be permissioned (CWF-009 design
   * question 4).
   */
  names(namespace: string): string[] {
    const section = this.section(namespace);
    return Object.keys(section)
      .filter((key) => typeof section[key] === 'string')
      .sort();
  }

  /** Set one secret in a namespace, preserving every other key and namespace. */
  set(namespace: string, key: string, value: string): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const all = this.readAll();
    const existing = all[namespace];
    const section: Record<string, string> =
      existing && typeof existing === 'object' && !Array.isArray(existing)
        ? { ...(existing as Record<string, string>) }
        : {};
    section[key] = value;
    all[namespace] = section;
    atomicWrite0600(this.filePath, all);
  }

  /** Delete one secret from a namespace (no-op if absent). */
  delete(namespace: string, key: string): void {
    const all = this.readAll();
    const existing = all[namespace];
    if (!existing || typeof existing !== 'object' || Array.isArray(existing)) return;
    const section = { ...(existing as Record<string, string>) };
    if (!(key in section)) return;
    delete section[key];
    all[namespace] = section;
    atomicWrite0600(this.filePath, all);
  }
}

/** The namespace WF-005 webhook secrets live under. */
export const WEBHOOK_SECRETS_NAMESPACE = 'webhooks';

/**
 * The namespace a cloud function's `Secret` node reads (CWF-009) — the project
 * author's own credentials, and the ONLY namespace reachable from a graph. See
 * the policy paragraph in this module's doc comment before adding a reader.
 */
export const FUNCTION_SECRETS_NAMESPACE = 'functions';

/** Environment fallback prefix for a function secret: `NODEGX_SECRET_STRIPE_KEY`. */
export const FUNCTION_SECRET_ENV_PREFIX = 'NODEGX_SECRET_';

/**
 * What a secret may be called.
 *
 * Narrow on purpose: the name is the only thing a graph controls about this
 * lookup, it is echoed back in an error message, and it maps to an environment
 * variable. Letters, digits, `_`, `.` and `-`, 1–128 characters.
 */
export const FUNCTION_SECRET_NAME_PATTERN = /^[A-Za-z0-9_.-]{1,128}$/;

/** The `NODEGX_SECRET_*` variable a secret name falls back to. */
export function functionSecretEnvName(name: string): string {
  return FUNCTION_SECRET_ENV_PREFIX + name.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase();
}
