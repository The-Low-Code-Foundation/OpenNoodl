/**
 * secrets.json — the ONE secrets-at-rest convention for this backend (BAK-002).
 *
 * BAK-003 established the file (`<dataDir>/secrets.json`, mode 0600, plaintext
 * JSON — no at-rest encryption is claimed, matching WF-004's original bearer
 * token) for exactly one value: `adminToken`. BAK-002 needs a second secret
 * (the SMTP password) and generalises the file into a flat, NAMESPACED
 * object instead of inventing a second file or a second convention:
 *
 *   {
 *     "adminToken": "...",                  // BAK-003, unnamespaced for back-compat
 *     "email": { "smtpPassword": "..." },   // BAK-002
 *     "webhooks": { "<hookId>": "..." }     // WF-005 (reserved shape — not
 *                                           // written by this task; recorded
 *                                           // here so the two concurrent
 *                                           // tasks agree on ONE file/shape
 *                                           // instead of drifting)
 *   }
 *
 * Every reader/writer goes through `readSecretsFile`/`writeSecretsFile` below.
 * `writeSecretsFile` is a read-modify-write: it never clobbers keys it wasn't
 * asked to change, which is what lets SecurityState (adminToken) and
 * EmailConfigState (email.smtpPassword) — and, if WF-005 follows this
 * convention, a future webhook-secrets module — share the one file safely.
 *
 * @module nodegx-backend/security/secrets
 */

import * as fs from 'fs';
import * as path from 'path';

const SECRETS_FILE = 'secrets.json';

/**
 * The secrets file's shape. Namespaced by subsystem except for the original
 * `adminToken`, which predates this convention and stays at the top level for
 * back-compat with backends created before BAK-002.
 */
export interface SecretsFile {
  adminToken?: string;
  email?: { smtpPassword?: string };
  /** Reserved for WF-005; not written by BAK-002. */
  webhooks?: Record<string, string>;
  [namespace: string]: unknown;
}

function secretsPath(dataDir: string): string {
  return path.join(dataDir, SECRETS_FILE);
}

function atomicWriteJSON(filePath: string, value: unknown, mode = 0o600): void {
  const tmp = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', { mode });
  fs.renameSync(tmp, filePath);
  try {
    fs.chmodSync(filePath, mode);
  } catch {
    // chmod is best-effort on platforms without POSIX modes.
  }
}

export class SecretsFileInvalidError extends Error {
  constructor(filePath: string, cause: unknown) {
    super(`${filePath} is not valid JSON: ${cause instanceof Error ? cause.message : cause}`);
    this.name = 'SecretsFileInvalidError';
  }
}

/** Read `<dataDir>/secrets.json`, or `{}` if it does not exist yet. */
export function readSecretsFile(dataDir: string): SecretsFile {
  const p = secretsPath(dataDir);
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as SecretsFile;
  } catch (e) {
    throw new SecretsFileInvalidError(p, e);
  }
}

/**
 * Read-modify-write: `mutate` receives the CURRENT contents (or `{}`) and
 * mutates it in place; the result is written back atomically at 0600. Never
 * touches keys `mutate` doesn't set — the shared-file safety property the
 * module doc above depends on.
 */
export function writeSecretsFile(dataDir: string, mutate: (secrets: SecretsFile) => void): SecretsFile {
  fs.mkdirSync(dataDir, { recursive: true });
  const current = readSecretsFile(dataDir);
  mutate(current);
  atomicWriteJSON(secretsPath(dataDir), current);
  return current;
}
