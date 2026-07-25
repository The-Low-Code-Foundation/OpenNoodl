# Phase 22 — Production Backend: CHANGELOG

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
