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
   * The ADMIN CREDENTIAL, when the caller is supplying one (the `--token` flag).
   * null = the caller is not choosing one, and BAK-003's SecurityState will
   * reuse the credential already in `<dataDir>/secrets.json` or mint one on
   * first run. It is NOT auto-filled here — see resolveOptions.
   */
  authToken: string | null;
  /**
   * When the SQLite engine cannot be loaded, opt in to a non-persisting
   * in-memory mode instead of refusing to start. Data is LOST on restart; the
   * service reports this loudly. Off by default (RUN-004 loud-failure policy).
   */
  allowEphemeral: boolean;
  /**
   * Identity of the backend this service runs. The editor passes the id/name it
   * persists under `~/.noodl/backends/<id>/`; a headless deploy may pass
   * anything (defaults below). `backendId` doubles as the accepted
   * `X-Parse-Application-Id` — reported, not enforced, on localhost.
   */
  backendId: string;
  backendName: string;
  /**
   * BAK-005: serve the admin dashboard at `/_admin`. `--no-admin` sets this
   * false, and then the route is not registered AT ALL — the URL 404s exactly
   * like any other unknown path, so an operator who disabled it cannot learn
   * from the response that there was ever a dashboard to disable.
   */
  adminDashboard: boolean;
  /**
   * BAK-005: the read-only admin credential ("look, don't touch"). Provisioned
   * with `--readonly-token`; never auto-minted, so a backend has this tier only
   * when an operator asks for one. Persisted in secrets.json beside adminToken.
   */
  readonlyToken: string | null;
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
  allowEphemeral: false,
  backendId: 'nodegx-backend',
  backendName: 'NodeGX Backend',
  adminDashboard: true,
  readonlyToken: null
};

/**
 * Merge partial options over the defaults, filling in derived values. Does not
 * touch disk — persistence of config to the data-dir is the second half's job
 * (it moves with BackendManager). See PLACEHOLDER note in service.ts.
 */
export function resolveOptions(partial: Partial<BackendServiceOptions> = {}): BackendServiceOptions {
  // WF-004 minted an authToken here whenever the bind was non-loopback, as a
  // net against exposing an unauthenticated service. BAK-003 replaced that
  // blanket bearer wall with the security model, and made SecurityState the one
  // owner of the admin credential: it persists it in `<dataDir>/secrets.json`,
  // reuses it across restarts, and reports a first-run mint so an operator can
  // find it. Against that owner the old net does active harm, and WF-003 found
  // it in a container:
  //
  //   * SecurityState treats a non-null token as "the operator chose this" and
  //     WRITES IT OVER the stored one. A fresh random value each start meant the
  //     admin credential of every DEPLOYED backend rotated on every restart —
  //     the dashboard password stopped working after a reboot, silently.
  //   * The same branch suppressed the "FIRST RUN: here is where to find your
  //     credential" message, precisely in the deploy case that needs it.
  //
  // So: no mint here. A null token means "I am not choosing one", which is a
  // question SecurityState already answers correctly and durably.
  return { ...DEFAULTS, ...partial };
}
