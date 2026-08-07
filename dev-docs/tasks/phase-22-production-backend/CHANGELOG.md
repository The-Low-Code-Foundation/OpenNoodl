# Phase 22 — Production Backend: CHANGELOG

## 2026-07-27 — BAK-004 OAuth & Passwordless Sign-In (phase complete)

### Added
- **Generic OpenID Connect**, authorization-code + PKCE, server-side, driven
  entirely by the issuer's discovery document — so Keycloak, Authentik, Entra
  ID, Auth0, Okta and GitLab are *configuration*, not code. Google is a preset
  over the same shape. **GitHub is the one bespoke adapter**, because it is
  OAuth2 but not OIDC. That is the whole provider matrix, on purpose.
- **The ID token's signature is verified against the issuer's JWKS, always.**
  OIDC permits skipping it on a direct TLS channel; we don't take the exemption,
  and there is no fallback path — a fallback is how verification quietly stops
  happening. `iss`, `aud`/`azp`, `exp`, `iat` and `nonce` are all checked. Only
  asymmetric algorithms are accepted; an `HS256` ID token is refused.
- **A one-time handoff code** (single use, 2-minute TTL, server-side) carries a
  completed sign-in to the app, exchanged at `POST /oauth/exchange` for the same
  response shape `/login` returns. The session token never appears in a URL, and
  the runtime strips the code with `history.replaceState` before anything else
  runs. Query rather than fragment, because Noodl apps can use hash routing.
- **A flow-binding cookie** (`HttpOnly`, `SameSite=Lax`, `Path=/oauth`) ties a
  callback to the browser that started it. `state` alone does not, which is what
  makes login CSRF possible — an attacker completing their own flow in your
  browser and logging you into *their* account.
- **The account-linking rule**, and the takeover it closes. A provider identity
  is keyed on the immutable subject, never the email. An unverified provider
  email never matches an existing account. A verified one links — and if the
  local account had **never** verified its own address, its password and every
  session are revoked at that moment. That is what stops account pre-hijacking
  (an attacker registering your address before you do and keeping access
  afterwards). The user is told, and every occurrence is audited.
- **Magic links**, on BAK-002's token and template infrastructure, routed
  through the *same* linking rule — a magic link is proof of inbox control, so
  it carries the same weight and there is no second path to find a gap in.
  Anti-enumerating: always 200, known address or not.
- **A redirect allow-list.** A completed sign-in may only be redirected to the
  backend's own origin or a listed one. An unvalidated redirect on an auth
  callback is the delivery mechanism for a phishing chain ending in a genuine
  login on a genuine domain. `//evil.example` is refused, not treated as a path.
- **`Sign In With` and `Request Magic Link` nodes**, with catalog enrichment.
  The return leg is handled by `UserService` on load, before its stale-session
  check — with no page code in the graph.
- **`GET /users/me/identities` + `DELETE /users/me/identities/:id`.** Unlinking
  the last way into an account is refused.
- **Three fronts on one model**: the editor's Backend Services → Sign-in panel,
  the served dashboard's Sign-in view, and five MCP tools. All exist mainly to
  **display the callback URL** — the redirect-URI mismatch is the most expensive
  mistake in OAuth setup and is entirely avoidable.
- **Ops**: three declared audit actions plus `auth.signin` and
  `auth.link.credentials-revoked` raised by the handler; per-flow rate limits
  stricter than the `auth` class; `nodegx_auth_pending_flows` on `/metrics` (a
  number that only grows is a redirect-URI mismatch); startup warnings for an
  enabled-but-incomplete provider and an `http://` issuer on a public bind.
- **Docs**: `docs/runtime/BACKEND-AUTH.md`, with cold walkthroughs for Google,
  GitHub and Keycloak, and the linking rule stated in full. `/auth` and `/oauth`
  added to the nginx and Caddy route families and to SELF-HOSTING's reserved
  names.

### Fixed
- **`--port 0` made every generated link say `http://127.0.0.1:0`.** The
  local-URL fallback used the *requested* port rather than the bound one. Every
  test and every editor-spawned backend uses port 0, so this affected OAuth
  callback URLs, magic links **and BAK-002's password-reset links** — wrong
  since BAK-002 shipped. Nothing crashed; the links were simply unusable, and no
  test had ever read a generated URL back on a port-0 backend. Found by the live
  pass against the built bundle; fixed once, at the HTTP server, for all three.
- **`emailVerified === true` was always false.** SQLite has no boolean type and
  the adapter hands back `1`. Harmless-looking almost everywhere — and here it
  would have sent every *already-verified* account down the credential-revoking
  branch of the linking rule. Caught by the linking tests before it shipped.
  The same comparison in BAK-002's verification re-request (an already-verified
  user got another email every time they asked) is fixed with it.
- **The auth handlers' 429s carried no `Retry-After`** — the message had the
  number, the header did not.
- **The dashboard's inline script had no syntax check.** esbuild inlines it as
  text and no compiler reads it, so a stray bracket would ship a 200 that
  renders a blank page and passes every other assertion. There is now a parse
  guard.

### Tests
Four new suites (84 cases) against a **real local OIDC provider** — an actual
server with an actual RSA keypair, real discovery, real PKCE verification and
real signatures — plus a GitHub stand-in that *enforces* GitHub's three quirks.
Nine ID-token forgeries each disable exactly one check and are each refused.
The pre-hijacking vector is tested end to end, including that the attacker's
live session dies too. Backend **61 suites / 619 passed**, runtime **696**, MCP
**68** (against a real spawned `dist/cli.js`), editor **1429 specs / 0
failures**; typecheck clean in all four; `catalog:check` green; both bundles
build and carry the new nodes. A 15-point live curl pass ran against the built
`dist/cli.js`.

### Residual
No sign-in has been performed against a real Google or GitHub app on a deployed
instance — that needs provider-console access and a public origin, and it is the
task's one open success criterion. Neither the editor panel nor the dashboard
view has been opened in a browser, and the nodes have not been used in a live
graph. Full list in [BAK-004-NOTES.md](./BAK-004-NOTES.md).

## 2026-07-26 — BAK-009 Production Ops

### Added
- **Structured logging**: one JSON line per request on stdout (pretty on a TTY),
  plus application events. `ts`/`level`/`event` first on every line; `route` is
  the low-cardinality pattern and `path` what was asked for; `principal` is a
  KIND and never a credential. `NODEGX_LOG_LEVEL` / `NODEGX_LOG_FORMAT` override
  `ops.json` so detail can be raised on a running container.
- **Request correlation**: `X-Request-Id` accepted (if short and boring) or
  minted, echoed in the header, included in error bodies, and stamped onto the
  execution records that direct function calls, webhooks and workflow runs
  produce — one id from access log to execution record to reply.
- **One rate limiter**: token buckets per route class, keyed by principal once
  resolved and by proxy-aware address otherwise. 429 + `Retry-After`. BAK-002's
  two bespoke fixed windows migrated onto it (still stricter than the `auth`
  class, no longer their own implementation). Realtime is capped by CONNECTION
  COUNT, not request rate.
- **`_Audit` trail**: privileged mutations, admin logins and login failures,
  each with actor, origin, outcome and request id. Written by the DISPATCHER
  from a declared action per route; queryable at `GET /admin/audit`, in the
  dashboard's new **Ops → Audit** view, and via MCP. Retention pruning at
  startup and hourly.
- **`/metrics`**: Prometheus exposition, admin-or-loopback gated. Requests by
  class/method/status, a duration histogram, rate-limit refusals, SSE
  connections, trigger fires, email sends, backup age, database size, process
  stats.
- **Graceful shutdown**: SIGTERM stops accepting, sends SSE clients a `resync`
  goodbye, drains in-flight requests for up to 10s, closes idle sockets, exits 0.
  A second signal exits immediately.
- **`ops.json`**: one operational config file beside `security.json` — logging,
  rate limits and trusted proxies, CORS, audit retention, metrics. Unknown keys
  are errors. Readable/patchable at `GET`/`PUT /admin/ops`.
- **Configurable CORS + security headers**, replacing an unconditional `*`
  constant. Startup warnings on a public bind for wildcard CORS, trust-every-
  proxy, and rate limiting switched off — each naming the setting to change.
- **MCP**: `get_backend_ops_config` (what a 429 means) and `query_backend_audit`
  (what this agent already changed). Read-only on purpose.
- **Docs**: `docs/runtime/BACKEND-OPERATIONS.md` (the operator runbook) and
  `deploy/Caddyfile.example`.

### Fixed
- **`readRawBody`'s 413 reached nobody.** It rejected and called `req.destroy()`
  in the same tick, so the response the caller then wrote never arrived —
  senders saw a bare `ECONNRESET`. Two subsystems (WF-005 webhooks, BAK-006
  uploads) had each worked around it instead of into it. Now it pauses without
  destroying, and `sendError` marks 413s `Connection: close`.
- **`PUT /admin/permissions/collections/:name` reported success for a body it
  ignored** — `{"find":"public"}`, the shape its own response suggests, changed
  nothing and answered `{"success":true,"rules":{}}`. Found the hard way during
  WF-003's live verification. It now refuses unknown fields and empty changes,
  naming the expected shape.
- **`X-Forwarded-For` was read leftmost-first**, which let any client choose its
  own rate-limit bucket and audit origin. The header is now believed only from a
  trusted peer, and the rightmost untrusted hop wins.
- **`service.stop()` closed the realtime hub before the HTTP server**, cutting
  SSE streams before a goodbye could be sent.

### Tests
- New suites: `ops-redaction`, `ops-request-id`, `ops-client-ip`,
  `ops-rate-limit`, `ops-audit`, `ops-metrics-headers`, `ops-config`,
  `ops-shutdown`. Backend **57 suites / 533 passed / 7 skipped**; MCP 61 passed;
  typecheck clean.
- Two structural guards in CI: every state-changing privileged route must
  declare an audit action (or an explicit exemption with its reason), and the
  per-class rate-limit tally of the live route table is asserted, so adding a
  route forces both questions.
- `ops-shutdown` spawns the real CLI and sends a real SIGTERM — and builds the
  bundle first, because `bin/` loads `dist/` and would otherwise grade a stale
  artifact.
- Deliberate-regression checks: re-narrowing the redaction pattern fails
  `ops-redaction`; removing the SSE goodbye fails `ops-shutdown`.

### Verified live
Caddy 2 in Docker (`tls internal`) in front of a real backend bound beyond
loopback with enforcement on: TLS terminated on one origin; `/metrics` refused
at the edge and served on loopback; a forged `X-Forwarded-For: 9.9.9.9` ignored;
429 + `Retry-After: 10` through TLS; a failed admin login and a REFUSED
permission change both in the trail with origin and request id; SSE unbuffered;
SIGTERM producing the `resync` goodbye, a 26ms drain and exit 0. The served
dashboard's Audit view was driven in jsdom against a live backend — nav entry,
rows, the server-supplied action filter (42 options), and the detail modal, with
no console errors.

### Residual
- **Not distributed.** In-memory buckets, one process's metrics, a local trail.
  Two replicas each get their own budget — documented, not accidental.
- **CLI backup/restore is not audited.** The HTTP routes are; a `nodegx-backend
  restore` run from a shell writes an execution record but no `_Audit` row,
  because that process has no request to attribute it to.
- The nginx TLS path was not re-verified in this pass (the Caddy example was);
  `deploy/nginx.conf` is unchanged apart from the `/metrics` refusal.
- No OpenTelemetry. Request ids are the seam if that is ever wanted.

## 2026-07-26 — BAK-005 The Served Admin Dashboard

### Seam decision
Route **(b)** — a lean SPA reusing the HTTP *contract*, not the editor's React
components. Measured, not assumed: the panel's data-browser/schema/permissions/
email/triggers views are ~3,231 TSX with **zero** editor-model imports (their
only coupling is one `window.require('electron')` line each), but
`@noodl-core-ui` has no build, no entry points and reverse tsconfig aliases back
into the editor; there is no browser `@noodl/platform`; and `noodl-preview`'s
esbuild+shims recipe — the spec's named prior art — is a **Node CJS** bundle
that loads every view asset with the `empty` loader, so it does not transfer to
a rendering SPA at all. Extraction would have added a browser bundler, a
sass/CSS-modules pipeline for 1,242 lines of `.module.scss`, and a platform shim
to the one package whose deploy story is "copy `dist/cli.js` and run it". The
editor keeps its panel; both UIs are HTTP clients of the same server, so there
is no second implementation to drift from. Full reasoning: `BAK-005-NOTES.md`.

### Added
- **The dashboard**: `nodegx-backend` serves its own operator UI at `/_admin`.
  Collections (browse/filter/page/CRUD), schema (tables, columns, **delete
  table**), users, roles, permissions, API keys, triggers (enable/disable/fire),
  workflows (run), executions (list + detail), email (config/templates/test
  send), backups (status/archives/run now). Live record updates ride BAK-001's
  SSE — the dashboard is just another subscriber.
- **Two routes, not a route family**: `GET /_admin` (the document — `public`,
  because it IS the login page and carries no backend state) and
  `GET /_admin/whoami` (admin-gated: credential tier, enforcement posture, and
  which sections this build can serve). Everything else rides the admin routes
  WF-004/BAK-001/002/003/007 and WF-001/005 already shipped, which is what kept
  the shared route table's diff to a single spread.
- **One self-contained document.** Markup, stylesheet and script are inlined
  into the bundle by esbuild's `text` loader (`tests/text-transformer.js` is its
  jest twin, so the UI is testable without a build). No CDN, no asset routes, no
  second bundler — so the CSP is genuinely `default-src 'none'` with a
  per-response nonce and **no `unsafe-inline`**, plus `nosniff`,
  `frame-ancestors 'none'`, `no-referrer`, `no-store`. Hash routing keeps the
  route matcher exact-length. Record values reach the DOM as text only.
- **Sections hide rather than error.** `whoami.features` is derived from the
  subsystems actually wired into the composition root — a service whose
  execution-history database refused to open hides that tab.
- **Read-only credential tier** (`--readonly-token`, stored as
  `adminReadonlyToken` beside `adminToken` in the one `secrets.json`
  convention). Resolves to `{kind:'admin', readonly:true}` and is refused **in
  the dispatcher** for every state-changing method, before any handler runs —
  not a UI toggle, so `curl` cannot write either. Coarse on purpose: a route
  added by a future task is refused by default if it mutates. Three reviewed
  safe POSTs (realtime subscribe, permission dry-run, schema *diff*); `apply`
  and `restore` pointedly not. Provisioning it identical to the full credential
  **refuses to start**.
- **Credential failure budget** (`src/admin/auth.ts`): 10 failures per client
  per 5 minutes, then `429` with `Retry-After`. Only failures count — a valid
  session must not launder a guessing run.
- **`--no-admin`** unregisters the routes entirely: `404`, not `403`, so an
  operator who disabled the dashboard leaks no evidence it existed.
- **`backend:deleteTable` finally has a caller** — behind a typed confirmation,
  verified end to end.
- **MCP**: `get_backend_admin_dashboard` (enabled/disabled + reason, URL, the
  agent's own credential tier, whether a read-only tier exists, posture, section
  map). `BackendClient.request` gains a `tolerate` list so a `--no-admin`
  backend's 404 is an *answer* rather than an error; 401 is never tolerable.
- **Docs**: `docs/runtime/BACKEND-ADMIN-DASHBOARD.md` — features, sign-in, first
  run, dev-open, read-only, `--no-admin`, and exposure guidance (SSH tunnel by
  default; VPN / reverse-proxy auth / IP allow-list otherwise; TLS always).

### Changed
- **First run deviates from the spec, deliberately.** BAK-003 mints an admin
  credential before anything can be served, so "a freshly deployed instance with
  no admin credential set" never occurs — and an unauthenticated setup page on a
  provisioned backend is a takeover vector. Instead the CLI prints where the
  auto-minted credential lives and the dashboard banners that nobody has chosen
  one yet, with the `--token` fix.
- **Dev-open is no longer papered over.** When the backend bypasses every gate,
  the dashboard skips the login box and banners that enforcement is off on every
  view, rather than staging a password prompt in front of a backend that would
  ignore it.

### Removed
- `packages/noodl-editor/src/editor/parse-dashboard-public/` — 40 tracked files,
  6.1 MB of built Parse-Dashboard output orphaned by WF-007, with zero inbound
  references. Stale comments in `.gitignore`, `.eslintrc.js`,
  `check-build-artefacts.js` and a dead `tsconfig` exclude went with it.

### Tests
- `nodegx-backend` **283/283** (34 suites; 24 new in `tests/admin-dashboard.test.ts`
  at three levels: pure policy, document invariants — marker counts, no external
  origin, no `innerHTML`, red-is-danger-only — and end-to-end over real HTTP on a
  **locked** backend covering CSP, per-response nonce, the public-page/gated-whoami
  split, the read-only tier reading everything and writing nothing with the right
  message and code 119, the safe-POST exception, delete-table, `--no-admin`
  returning 404, and the credential-collision interlock). Typecheck clean; bundle
  builds.
- `noodl-mcp` **52/52** (1 new, driven against a real spawned backend); package
  typecheck error count unchanged at 17, all pre-existing jasmine conflicts.
- Live curl pass against the built `dist/cli.js` as a standalone process: page
  assembly, headers, both tiers, refusals, delete-table, 10-then-429 rate
  limiting, `--no-admin`.

### Residual
- **Nobody has opened the page in a browser.** Server-side behaviour is verified
  throughout; the rendered UI is not. A section-by-section walkthrough (once
  dev-open, once locked with the read-only token) is the missing pass, and it is
  the top residual.
- The SSE `Live` toggle has never run in a browser (the protocol is well-tested
  server-side; this client is not).
- Packaged-app and clean-VM runs not done — both named in the spec.
- Deliberately not built: a "disable user" control (no auth path honours a
  `disabled` flag, so the button would be a control that does nothing), a
  restore button (the CLI with the service stopped is the blessed path),
  whole-config permission editing (per-collection only; the rest is MCP/route),
  and any audit trail (BAK-009 owns it).
- Documented trade-offs: the rate limiter can lock out an operator sharing an
  attacker's apparent client identity behind NAT; the credential in
  `sessionStorage` is the master key; the dashboard palette is a *copy* of the
  UIX-001 tokens (this package must not depend on `noodl-core-ui`), pinned only
  by a red-is-danger-only test.

## 2026-07-26 — BAK-002 Email Subsystem

### Added
- **SMTP + templates + secrets convention**: `nodegx-backend` gains an email
  subsystem via `nodemailer`. Per-backend config (`<dataDir>/email.json`):
  SMTP host/port/security/username, from-address/name, the shared `baseUrl`
  setting (BAK-004's magic links reuse this same field — defined once here),
  and the verification policy. The SMTP password lives in the shared
  `secrets.json` under a new `email` namespace (`src/security/secrets.ts`
  generalises the BAK-003 admin-credential file into a read-modify-write,
  namespaced convention — the one WF-005's webhook secrets should also use).
- **Templates**: subject/text/html with `{{variable}}` interpolation, two
  shipped defaults (`passwordReset`, `verifyEmail`), per-backend overrides,
  enumerable/editable via the panel and MCP.
- **Password reset, for real**: `POST /requestPasswordReset` and
  `/apps/:id/request_password_reset` (GET serves a minimal reset-password
  page; POST processes it) replace the WF-004 501 stubs. Single-use,
  hashed-at-rest, 1-hour tokens (`EmailTokenStore`); every session for the
  user is invalidated on a successful reset.
- **Email verification**: opt-in per backend (`sendOnSignup`), a
  `requireForLogin` login-policy toggle enforced in `/login`, a re-request
  endpoint, and `GET /apps/:id/verify_email` to consume the token.
- **Anti-enumeration + rate limiting**: both public account-mail endpoints
  answer identically (200, empty body) whether or not the address exists and
  regardless of whether a send actually succeeded (failures are logged
  server-side, never surfaced to an anonymous caller); a simple fixed-window
  limiter (`src/server/rate-limit.ts`) covers both.
- **Send Email node** (`noodl.cloud.sendemail`, `noodl-viewer-cloud`):
  to/subject/text/html or a template reference in, sent/failed + error out.
  Server-side only; reaches the backend's Mailer via the same process-global
  idiom `_noodl_cloudservices` already established. Catalog + enrichment +
  a validated example (`fn-send-notification-email`) shipped; execution
  records come for free through the existing WorkflowRunner/CloudRunner path.
- **Loud failure everywhere it's admin-authenticated**: the Send Email node,
  `POST /admin/email/test`, and the MCP `send_backend_test_email` tool all
  throw/report the specific "email is not configured" reason — no silent
  drop, no queue.
- **Editor**: an Email section (`views/panels/email`) opened from
  `LocalBackendCard`, mirroring the Permissions panel's one-panel-constraint
  pattern — SMTP form, verification-policy toggles, template editor, and a
  "Send test email" button with loud success/failure.
- **MCP**: `get_backend_email_config`, `set_backend_email_config`,
  `send_backend_test_email`, `list_backend_email_templates`,
  `set_backend_email_template`, `reset_backend_email_template`,
  `preview_backend_email_template`.
- **Docs**: `docs/runtime/BACKEND-EMAIL.md` — setup, common providers,
  deliverability honesty (SPF/DKIM are the provider's job), the secrets
  convention, scope boundaries.

### Tests
- New suites in `nodegx-backend`: `email-templates`, `email-secrets`,
  `email-config`, `email-mailer`, `email-tokens` (unit-level), `email-flows`
  (full HTTP integration: admin config/test-send/templates, password reset
  end-to-end incl. session invalidation and single-use-token rejection,
  verification + login policy, anti-enumeration, rate limiting, and the Send
  Email node executed through a real WorkflowRunner both configured and
  unconfigured). `noodl-mcp`'s `backendTools.test.ts` gains an email-tools
  block against a live built backend. Backend 159/159, noodl-mcp 49/49,
  backend + noodl-mcp + editor typecheck clean; `catalog:check` and
  `catalog:merge:check` (with `--require-coverage`) green.

### Residual
- No live run against a real, deployed SMTP provider (Mailgun/SES/Postmark) —
  all tests use `Mailer.setTransportForTesting`'s fake-transport seam or
  assert the loud unconfigured-failure path; a real end-to-end send is
  untested by this pass.
- `send_backend_test_email` is only exercised via MCP in its unconfigured
  (loud-failure) path — a real send over MCP would need live SMTP, which the
  hermetic test suite doesn't have.
- Rich template editor UI, a local mail-capture dev server, and magic-link
  login are explicitly out of scope per the task spec (the latter is BAK-004,
  which reuses this plumbing and the `baseUrl` setting).
- The full Electron `test:ci` suite was not run in-sandbox (dugite/git-binary
  issues in this environment, per prior tasks' notes); editor `tsc --noEmit`
  was run directly instead and is clean.

## 2026-07-25 — BAK-001 Realtime Subscriptions (SSE)

### Added
- **Server-pushed realtime over SSE** in `nodegx-backend`: `GET /realtime`
  (EventSource stream, server-minted clientId) and `POST /realtime/subscriptions`
  (replace-semantics subscription set). Events are `{action, collection, record}`,
  delivered post-commit, with monotonic per-connection ids.
- **One post-commit change tap** (`ChangeBus`) shared with WF-005's future
  trigger dispatch; `LocalSQLAdapter` now buffers change events inside a
  transaction and releases them only on commit (rollback emits nothing), and
  `delete` events carry the pre-delete record including its ACL.
- **Server-side filter matching** over the query operator grammar, property-tested
  against the real SQL query so the matcher and the WHERE clause cannot drift.
- **Reconnect / `resync` semantics**: events-only, no replay. A reconnect with a
  gap, or a slow-client bounded-queue overflow, sends a single `resync`; clients
  re-run their query.
- **Delivery-time permission checks**: `canReadRecord` per event per subscriber
  (the JS twin of the SQL ACL filter); subscription creation gated on the
  collection's `find` CLP. Row ACLs are bypassed in `devOpen` for query parity.
- **Client surfaces**: Subscribe To Changes gains a NodeGX SSE provider
  (auto-selected by backend type); Query Data gains an opt-in **Live** boolean;
  the editor Data Browser rides the same stream.
- **AI visibility**: enrichment updated for both nodes; realtime is discoverable
  through the MCP-served enriched catalog.
- **Docs**: `docs/runtime/REALTIME.md` (protocol, semantics, limits, query-param
  token caveat, proxy/deploy notes).

### Tests
- New suites: `realtime-filter`, `realtime-changebus`, `realtime-hub`,
  `realtime-http` (nodegx-backend); `byob-realtime-sse` (noodl-runtime). Backend
  94/94 and runtime 362/362 green; backend typecheck clean; `catalog:check` and
  `catalog:merge:check` green.

### Residual
- Live two-browser run on a deployed app and packaged-app run (need a real
  deployment). Editor Data Browser live-refresh is implemented but not yet
  smoke-tested in a running editor. NodeGX backend `type` string and Subscribe
  node primary-key mapping reconcile with the Backend Services panel work (WF-007).
