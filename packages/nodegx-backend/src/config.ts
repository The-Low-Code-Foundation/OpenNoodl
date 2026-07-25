/**
 * Backend service configuration + options parsing.
 *
 * The service is configured entirely from CLI flags / a config object — it has
 * NO knowledge of Electron, `~/.noodl`, or the editor. The editor (in the
 * second half of WF-004) is responsible for choosing the data-dir and port and
 * passing them in when it spawns this as a child process; a headless deploy
 * passes them on the command line. That separation is the whole point of the
 * package boundary.
 *
 * @module nodegx-backend/config
 */

import * as crypto from 'crypto';
import * as os from 'os';
import * as path from 'path';

/** Fully-resolved options a BackendService runs with. */
export interface BackendServiceOptions {
  /** Directory holding the SQLite file(s), uploaded files, and backend config. */
  dataDir: string;
  /** TCP port to bind. 0 = ephemeral (OS-assigned) — useful for the editor's child process. */
  port: number;
  /**
   * Host/interface to bind. Defaults to 127.0.0.1 (localhost-only). Binding to
   * anything wider REQUIRES a bearer token (see requiresAuth). WF-004 policy.
   */
  host: string;
  /**
   * Bearer token required for requests when bound to a non-localhost interface.
   * Generated per backend and persisted in the data-dir config. null = none yet.
   */
  authToken: string | null;
  /**
   * When the SQLite engine cannot be loaded, opt in to a non-persisting
   * in-memory mode instead of refusing to start. Data is LOST on restart; the
   * service reports this loudly. Off by default (RUN-004 loud-failure policy).
   */
  allowEphemeral: boolean;
}

/** Non-loopback bind => a token is mandatory. */
export function requiresAuth(options: Pick<BackendServiceOptions, 'host'>): boolean {
  const h = options.host;
  return h !== '127.0.0.1' && h !== 'localhost' && h !== '::1';
}

/** Generate a URL-safe bearer token. */
export function generateAuthToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

const DEFAULTS: BackendServiceOptions = {
  dataDir: path.join(os.homedir(), '.nodegx', 'backend', 'default'),
  port: 8577,
  host: '127.0.0.1',
  authToken: null,
  allowEphemeral: false
};

/**
 * Merge partial options over the defaults, filling in derived values. Does not
 * touch disk — persistence of config to the data-dir is the second half's job
 * (it moves with BackendManager). See PLACEHOLDER note in service.ts.
 */
export function resolveOptions(partial: Partial<BackendServiceOptions> = {}): BackendServiceOptions {
  const merged: BackendServiceOptions = { ...DEFAULTS, ...partial };

  // A wider bind without a token is a misconfiguration; mint one so we never
  // silently expose an unauthenticated service. (The editor/deploy should pass
  // a persisted token; this is the safety net.)
  if (requiresAuth(merged) && !merged.authToken) {
    merged.authToken = generateAuthToken();
  }

  return merged;
}
