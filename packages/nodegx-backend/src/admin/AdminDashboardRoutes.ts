/**
 * The served admin dashboard (BAK-005) — server side.
 *
 * `nodegx-backend` carries its own operator UI, the way Pocketbase does: a
 * deployed backend is administered from a browser with no editor installed.
 * This module is the entire server-side surface, and it is deliberately two
 * routes:
 *
 *   GET /_admin          the dashboard document (one self-contained page)
 *   GET /_admin/whoami   which credential tier you hold + which sections exist
 *
 * Everything else the dashboard does — collections, schema, users, roles,
 * permissions, keys, triggers, workflows, executions, email, backups — goes
 * over the ADMIN ROUTES THAT ALREADY EXIST (WF-004/BAK-001/BAK-002/BAK-003/
 * BAK-007/WF-001/WF-005). That is the seam decision recorded in BAK-005-NOTES:
 * the reuse that matters is the HTTP contract, not the editor's React
 * components. It is also why the dashboard cannot drift from the editor's
 * Backend Services panel — both are HTTP clients of this one server, so the
 * existing route tests are the shared contract suite.
 *
 * ## One document, zero external origins
 *
 * The page is a single HTML document with its CSS and JS inlined at build time
 * (esbuild's `text` loader pulls `ui/index.html` and `ui/styles.css` into the
 * bundle as strings). No CDN, no asset routes, no second bundler in a package
 * that produces exactly one CommonJS file. Consequences worth naming:
 *   - `WF-003`'s "copy this file and run it" story survives intact.
 *   - The CSP can be `default-src 'none'` with a per-response nonce, because
 *     there is genuinely nothing to fetch.
 *   - Client-side routing is hash-based, so the service needs no catch-all
 *     route and the route table stays exactly-length-matched.
 *
 * ## Auth
 *
 * BAK-003's admin credential, unchanged — the dashboard holds it as a bearer
 * token in `sessionStorage` and sends it on every request. There is no
 * dashboard session, no cookie, and therefore no CSRF surface (the spec's
 * "pick token-header auth"). The read-only tier is a second credential, not a
 * client-side toggle: refusal happens in the dispatcher (see ./readonly).
 *
 * The DOCUMENT itself is public — it is the login page, and it contains no
 * data. Every byte of actual backend state comes from admin-gated routes.
 *
 * @module nodegx-backend/admin/AdminDashboardRoutes
 */

import * as crypto from 'crypto';

import type { BackendServiceOptions } from '../config';
import type { SecurityState } from '../security/state';
import type { RequestContext } from '../server/HttpServer';
import { sendJSON } from '../server/http-util';

// The UI, inlined by esbuild's text loader (and by tests/text-transformer.js
// under jest). `require` rather than `import` so the one call site works
// identically in both without a synthetic-default dance.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const UI_HTML: string = require('./ui/index.html');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const UI_CSS: string = require('./ui/styles.css');

/** Assembled from fragments so the markers never appear literally in this file. */
const CSS_MARKER = '/*__ADMIN' + '_CSS__*/';
const NONCE_MARKER = '__CSP' + '_NONCE__';

/**
 * Which dashboard sections have a backing implementation in THIS build.
 *
 * The spec requires sections to hide rather than error when their backing task
 * has not shipped. Rather than hard-code today's answer, each flag is derived
 * from whether the subsystem is actually wired into the composition root — so a
 * service constructed without workflows, or with execution history disabled
 * because its database would not open, reports that honestly instead of serving
 * a tab that 503s.
 */
export interface DashboardFeatures {
  collections: boolean;
  schema: boolean;
  users: boolean;
  roles: boolean;
  permissions: boolean;
  apiKeys: boolean;
  triggers: boolean;
  workflows: boolean;
  executions: boolean;
  email: boolean;
  backups: boolean;
  realtime: boolean;
  /** BAK-008: per-collection full-text search config exists (schema manager available). */
  search: boolean;
  /** File storage config (BAK-006) — always true once the subsystem is wired. */
  files: boolean;
  /** BAK-009: the `_Audit` trail and the operational config it lives beside. */
  ops: boolean;
}

export interface AdminDashboardDeps {
  options: BackendServiceOptions;
  security: SecurityState;
  /** Live capability probe — evaluated per request, not captured at construction. */
  features: () => DashboardFeatures;
}

/**
 * Substitute a marker that must occur EXACTLY once, and say so loudly when it
 * does not.
 *
 * This exists because the naive `String.replace(marker, value)` silently
 * replaces the FIRST occurrence — and the first occurrence of the stylesheet
 * marker was, at one point, a mention of it inside this file's own doc comment.
 * The page still rendered "fine" (200, right length, CSS text present) while
 * the entire stylesheet sat inside an HTML comment and the style block was
 * empty. A quiet mis-substitution that produces a plausible page is precisely
 * the failure mode this codebase refuses to ship: count, and throw.
 */
function injectOnce(template: string, marker: string, value: string): string {
  const first = template.indexOf(marker);
  if (first === -1) {
    throw new Error(`Admin dashboard template is missing its "${marker}" marker — the page cannot be assembled.`);
  }
  if (template.indexOf(marker, first + marker.length) !== -1) {
    throw new Error(
      `Admin dashboard template contains more than one "${marker}" marker, so the substitution is ambiguous. ` +
        'Markers must appear exactly once (do not mention them in prose).'
    );
  }
  return template.slice(0, first) + value + template.slice(first + marker.length);
}

export class AdminDashboardRoutes {
  constructor(private readonly deps: AdminDashboardDeps) {}

  /**
   * `GET /_admin`. Renders the one document, with a fresh CSP nonce so the
   * inline script and style run under a policy that still forbids any other
   * script — including one injected into a record value we render.
   */
  serve(ctx: RequestContext): void {
    const nonce = crypto.randomBytes(16).toString('base64');
    // The nonce genuinely appears more than once (one style tag, one script
    // tag), so it is a global replace; the stylesheet must not be.
    const html = injectOnce(UI_HTML, CSS_MARKER, UI_CSS).split(NONCE_MARKER).join(nonce);

    const body = Buffer.from(html, 'utf-8');
    ctx.res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': body.length,
      'Cache-Control': 'no-store',
      // Everything the page needs is in the page. `connect-src 'self'` is what
      // lets it call this backend's own API (and open the SSE stream); nothing
      // else is reachable, so a hostile record value cannot exfiltrate.
      'Content-Security-Policy':
        "default-src 'none'; " +
        `script-src 'nonce-${nonce}'; ` +
        `style-src 'nonce-${nonce}'; ` +
        "connect-src 'self'; " +
        "img-src 'self' data:; " +
        "font-src 'none'; " +
        "form-action 'none'; " +
        "frame-ancestors 'none'; " +
        "base-uri 'none'",
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer'
    });
    ctx.res.end(body);
  }

  /**
   * `GET /_admin/whoami`. Admin-gated, so reaching it at all proves the
   * credential — that is the dashboard's "login". Answers the two things the
   * client cannot know on its own: which tier it holds, and which sections to
   * render.
   */
  whoami(ctx: RequestContext): void {
    const readonly = ctx.principal.kind === 'admin' && ctx.principal.readonly === true;
    sendJSON(ctx.res, 200, {
      ok: true,
      readonly,
      backend: {
        id: this.deps.options.backendId,
        name: this.deps.options.backendName,
        host: this.deps.options.host,
        port: this.deps.options.port
      },
      security: {
        devOpen: this.deps.security.config.devOpen,
        enforced: !this.deps.security.devOpenActive,
        hasReadonlyTier: this.deps.security.adminReadonlyToken !== null
      },
      /**
       * First run, honestly (see BAK-005-NOTES §first-run): under BAK-003 an
       * admin credential ALWAYS exists by the time anything can be served, so
       * the Pocketbase "create the first admin" page has no safe analogue —
       * an unauthenticated setup route on an already-provisioned backend is a
       * takeover. What the dashboard shows instead is this flag: the credential
       * was auto-minted on this very start, which means no operator has ever
       * chosen one, and the page explains where to find it and how to replace
       * it with `--token`.
       */
      firstRun: this.deps.security.adminTokenMintedThisStart,
      features: this.deps.features()
    });
  }
}
