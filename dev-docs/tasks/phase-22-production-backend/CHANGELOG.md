# Phase 22 — Production Backend: CHANGELOG

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
