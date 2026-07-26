# Phase 22 — Production Backend: PROGRESS

Task-by-task status for Track H. Trust this file and the per-task CHANGELOG over
higher-level summaries.

| ID | Title | Status |
|----|-------|--------|
| BAK-001 | Realtime subscriptions (SSE) | ✅ Core shipped 2026-07-25 (client live-verify residual) |
| BAK-002 | Email subsystem | ✅ Complete 2026-07-26 (merge `d22a511`) |
| BAK-003 | Access control | ✅ Complete (Phase 22, prior) |
| BAK-004 | OAuth & passwordless | ⬜ Not started |
| BAK-005 | Served admin dashboard | ✅ Shipped 2026-07-26 (browser walkthrough + packaged run residual) |
| BAK-006 | File storage v2 | ✅ Complete 2026-07-26 |
| BAK-007 | Backups / export / promotion | ✅ Complete 2026-07-26 (merge `c8431a0`) |
| BAK-008 | Full-text search | ✅ Shipped 2026-07-26 (editor panel + served-dashboard live-smoke residuals) |
| BAK-009 | Production ops | ✅ Complete 2026-07-26 (live-verified behind Caddy; not distributed) |

**Tier 1 (credibility) is complete** — BAK-001, BAK-002, BAK-003, BAK-007 all shipped.
That is the phase's designated stopping point; everything below is Tier 2 parity onward.

---

## BAK-001 — Realtime Subscriptions (SSE)

**Status:** Core shipped and thoroughly tested headlessly. Live two-browser /
packaged-app runs and the in-editor Data Browser live-refresh are residual
(need a running editor/deployed app).

### What shipped

**Server (`packages/nodegx-backend`)**
- `src/realtime/ChangeBus.ts` — the single post-commit change tap. Subscribes to
  `LocalSQLAdapter` events once, normalizes to `{action, collection, id, record}`,
  fans out to listeners. Built so WF-005's DB-change triggers can be the second
  consumer without re-tapping the adapter.
- `src/realtime/filter.ts` — server-side filter matcher over the query operator
  grammar. **Property-tested against a real `node:sqlite` query** (matcher verdict
  === query membership) so it cannot drift from the SQL WHERE clause.
- `src/realtime/RealtimeHub.ts` — SSE connection registry: subscription-replace
  (Pocketbase-style), monotonic per-connection event ids, heartbeat frames,
  bounded per-connection queue with drop-and-`resync` on overflow, delivery-time
  `canReadRecord` gating (bypassed in `devOpen` for query parity), subscription
  creation gated on the `find` CLP.
- `src/server/HttpServer.ts` — `GET /realtime` (SSE; opens only for
  `Accept: text/event-stream`, else a finite JSON hint so probes never hang) and
  `POST /realtime/subscriptions`. Both `public` and self-enforcing, like the
  session routes; token accepted via query param (EventSource can't set headers).
- `src/service.ts` — wires the ChangeBus + RealtimeHub into the composition root
  and tears them down on stop.

**Event source (`packages/noodl-runtime`)**
- `LocalSQLAdapter.js` — change events (`create`/`save`/`delete`) are now
  buffered inside a transaction and released only on commit (rollback drops
  them), and `delete` carries the pre-delete record (with its ACL). One generic
  tap, both consumers.

**Clients (`packages/noodl-runtime`)**
- `byob-realtime.js` — `RealtimeSSEConnection` + `buildSSEUrl` + `isNodeGXRealtime`,
  matching the WebSocket transport's callback contract.
- `byob-subscribe.js` — Subscribe To Changes picks SSE for NodeGX backends,
  WebSocket for Directus; `resync` fires the generic `changed` signal.
- `byob-query-data.js` — Query Data gains an opt-in **Live** boolean that opens a
  collection subscription and re-runs the query (debounced) on changes.

**Editor (`packages/noodl-editor`)**
- `ServiceSupervisor.js` — `openRealtimeStream()` main-process SSE client (parses
  the stream, auto-reconnects, re-subscribes).
- `BackendManager.js` — `backend:subscribeCollection`/`unsubscribeCollection` IPC
  bridge forwarding change events to the renderer.
- `DataBrowser.tsx` — subscribes to the current table and re-loads (debounced) on
  each change/resync.

**AI visibility**
- Enrichment updated for `noodl.byob.SubscribeToChanges` and `noodl.byob.QueryData`
  (SSE provider, `resync`, Live). MCP surfaces realtime through the enriched
  catalog. `catalog:check` and `catalog:merge:check` green.

**Docs**
- `docs/runtime/REALTIME.md` — protocol, filter grammar, permission model, the
  events-only/`resync` gap contract, slow-client policy, the query-param-token
  caveat, and deployment (proxy) notes.

### Tests (all green)
- `nodegx-backend`: `realtime-filter` (property test vs SQL, >20k comparisons),
  `realtime-changebus` (post-commit / rollback-emits-nothing / delete carries
  record), `realtime-hub` (delivery, filter, ACL, subscription CLP gating,
  reconnect resync, slow-client overflow, monotonic ids), `realtime-http`
  (end-to-end over real HTTP — the headless "two browsers" stand-in). 94 backend
  tests pass; typecheck clean.
- `noodl-runtime`: `byob-realtime-sse` (SSE transport lifecycle). 362 runtime
  tests pass.

### Success criteria
- ✅ A record created by one client appears on another subscriber, via SSE — proven
  headlessly over real HTTP (`realtime-http.test.ts`); **live two-browser run on a
  deployed app is residual.**
- ✅ Filtered subscription receives only matching records; **filter semantics match
  a paired query exactly** (shared property test).
- ✅ Killing/overflowing the connection yields `resync` and the client recovers by
  re-query (hub tests; node fires `changed` on resync).
- 🟡 Editor Data Browser updates live through the same protocol — **implemented,
  live-verify residual** (needs a running editor).
- ✅ Catalog + MCP entries exist; an agent can discover realtime and wire the node.
- ✅ Protocol and its honest limits documented.

### Residuals / follow-ups
- Live two-browser run on a WF-003-deployed app; packaged-app run.
- In-editor Data Browser live-refresh smoke test (code shipped, unverified).
- Primary-key mapping for NodeGX in the Subscribe node's `changedRecordId`
  depends on the Backend Services schema sync (WF-007) reporting `objectId` as the
  collection primary key — verify once WF-007 lands.
- The NodeGX backend `type` string used for transport selection
  (`isNodeGXRealtime`) is owned by the Backend Services panel (WF-007); reconcile
  the exact value on merge.

---

## BAK-005 — The Served Admin Dashboard

**Status:** Shipped 2026-07-26. Full detail, including the seam decision and its
evidence: [BAK-005-NOTES.md](./BAK-005-NOTES.md).

**Seam decision: route (b)** — a lean SPA on the HTTP contract, not extracted
editor components. Decided on measurement, not preference: the panel's views are
portable (~3,231 TSX with zero editor-model imports), but `@noodl-core-ui` has no
build or entry points and reverse-aliases back into the editor, no browser
`@noodl/platform` exists, and noodl-preview's esbuild+shims recipe is a Node CJS
bundle that loads every view asset with the `empty` loader — it is not prior art
for a rendering SPA. Extraction meant a second browser bundler + sass pipeline +
platform shim inside the one package whose deploy story is "copy a single file".
Drift risk is structurally low anyway: the editor panel and the dashboard are
both HTTP clients of the same server, so there is no second implementation to
drift from, and the existing route tests are the shared contract suite.

### What shipped
- `GET /_admin` (the document) and `GET /_admin/whoami` (credential tier +
  section map). **Two routes.** Everything else rides existing admin routes.
- One self-contained page — markup/CSS/JS inlined by esbuild's `text` loader.
  `default-src 'none'` CSP with a per-response nonce, no `unsafe-inline`, no
  external origin, record values never through `innerHTML`.
- v1 feature set: collections (with **live SSE**), schema (incl. **delete
  table**, finally given a caller), users, roles, permissions, API keys,
  triggers, workflows, executions, email, backups. Sections gate on a feature
  map derived from the wired subsystems, so an absent subsystem hides its tab.
- **Read-only tier** as a real second credential (`--readonly-token`), refused in
  the dispatcher for every state-changing method with a small reviewed safe-POST
  exception set. Coarse by design: a future route that mutates is refused by
  default. Provisioning it equal to the full credential refuses to start.
- Credential failure budget (10 / 5 min / client → 429 + `Retry-After`).
- `--no-admin` unregisters the routes (404, not 403).
- MCP: `get_backend_admin_dashboard`.
- `docs/runtime/BACKEND-ADMIN-DASHBOARD.md`, including exposure guidance.
- Retired `packages/noodl-editor/src/editor/parse-dashboard-public/` (40 files,
  6.1 MB) — WF-007's leftover, zero inbound references.

### Deliberate spec deviations
- **No first-run setup page.** BAK-003 always has a credential by serve time, so
  "no admin credential set" never occurs, and an unauthenticated setup route on a
  provisioned backend is a takeover vector. Replaced with an honest first-run
  banner plus a CLI announcement of where the auto-minted credential lives.
- **No "disable user".** No auth path honours a `disabled` flag; shipping the
  button would be a security control that does nothing.
- **No restore button** — the CLI with the service stopped stays the blessed path.

### Tests
`nodegx-backend` **283/283** (24 new), typecheck clean, bundle builds.
`noodl-mcp` **52/52** (1 new, against a real spawned backend).
Live curl pass against the built `dist/cli.js`: page assembly, CSP headers, both
credential tiers, refusal messages, delete-table, rate limiting, `--no-admin`.

### Residuals
- **Nobody has opened the page in a browser.** Every server-side property is
  verified; the rendered UI is not. Top residual — a section-by-section
  walkthrough (once dev-open, once locked with the read-only token) is the
  missing pass.
- The SSE `Live` toggle is unverified in a browser (the protocol itself is
  well-tested server-side).
- Packaged-app run and clean-VM run not done — both named in the spec.
- The audit trail arrived in BAK-009.
- Documented trade-offs: the rate limiter can lock out an operator who shares an
  attacker's apparent client identity; the credential in `sessionStorage` is the
  master key; the palette is a copy of the UIX-001 tokens, not an import.

---

## BAK-009 — Production Ops (Rate Limits, Logs, Metrics, Audit)

**Status:** Complete 2026-07-26. Full writeup: [BAK-009-NOTES.md](./BAK-009-NOTES.md).

### What shipped
All eight in-scope deliverables: structured logging with a shared redaction
rule, request ids that reach execution records, one token-bucket rate limiter
with per-route-class policies and proxy-aware keying, the `_Audit` trail
(written by the dispatcher, not by handlers), `/metrics`, graceful shutdown
with an SSE goodbye, configurable CORS/security headers, the MCP additions, and
`docs/runtime/BACKEND-OPERATIONS.md` with a Caddy example that was actually
run. Two long-standing defects were root-fixed along the way: the 413 that
reached nobody (two subsystems had worked around it) and the permissions route
that reported success for a body it ignored.

### Tests
Backend **57 suites / 533 passed / 7 skipped**, MCP **61/61**, typecheck clean.
Two structural CI guards: privileged routes must declare an audit action, and
the per-class rate-limit tally of the live route table is asserted.

### Residuals
Not distributed (in-memory buckets, one process's metrics) — documented, not
accidental. CLI-driven backup/restore writes an execution record but no audit
row. The nginx TLS path was not re-verified in this pass; the Caddy one was.

---

## BAK-008 — Full-Text Search (FTS5)

**Status:** Shipped 2026-07-26. Full writeup in `BAK-008-NOTES.md` (FTS5
verification, the `search` vs `$text` wire-shape decision and evidence, the
FTS5 query-syntax sharp edge found and fixed, ACL composition, and the honest
residual list — editor panel and served-dashboard live-smoke are unverified
from this worktree; every backend-level property is tested and passing).
---

## BAK-006 — File Storage v2 (Metadata, Transforms, S3 Driver)

**Status:** Complete 2026-07-26. Full detail, every decision, and exactly how
each was verified: [BAK-006-NOTES.md](./BAK-006-NOTES.md).

### What shipped
`_Files` metadata (real `ACL` column, BAK-003's row model reused verbatim);
size/type validation with magic-byte sniffing (never the declared type/
extension) and hash-bucketed storage keys; private files + short-TTL signed
URLs for `<img src>`; `?thumb=` presets with disk caching and correct
ETag/Cache-Control, sharp fully optional with a real (not simulated) loud 501
when absent; a `StorageDriver` interface with `local` and `S3`-compatible
implementations (S3 signed by a from-scratch SigV4 verified against AWS's own
published test fixtures, and separately run against a real MinIO instance);
a report-only-by-default orphan sweep on WF-005's `CronScheduler`; admin
dashboard **Files** tab + 3 new MCP tools; `docs/runtime/BACKEND-FILES.md`.

### Tests
`nodegx-backend` **403/403** (7 of them S3-conformance, env-gated — also run
green against real MinIO), typecheck clean, bundle builds (confirmed no
`require("sharp")` literal lands in `dist/cli.js`). `noodl-runtime`
**362/362** unaffected. `noodl-mcp` **55/55** (4 new, against a real spawned
backend). `catalog:check` green (no runtime node touched). Live curl pass
against the built `dist/cli.js`.

### Residuals
One real (non-MinIO) S3 provider spot-check; a live HTTP pass with S3 as the
ACTIVE driver (vs. its already-green conformance suite); a "Private" input on
the Upload File node + a "Sign File URL" node (header-based private upload is
fully functional today; node ergonomics are a scoped follow-up); dashboard
Files tab not opened in a browser. A real pre-existing bug was found and
worked around (not root-fixed, to keep the footprint in a shared file
minimal): `http-util.ts`'s `readRawBody` destroys the socket before an
over-limit response can send — `files.ts` now checks `Content-Length` upfront
first, matching WF-005's existing webhook workaround for the same issue.
