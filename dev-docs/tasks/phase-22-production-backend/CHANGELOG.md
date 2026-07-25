# Phase 22 — Production Backend: CHANGELOG

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
