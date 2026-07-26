# Phase 22 — Production Backend: PROGRESS

Task-by-task status for Track H. Trust this file and the per-task CHANGELOG over
higher-level summaries.

| ID | Title | Status |
|----|-------|--------|
| BAK-001 | Realtime subscriptions (SSE) | ✅ Core shipped 2026-07-25 (client live-verify residual) |
| BAK-002 | Email subsystem | ✅ Complete 2026-07-26 (merge `d22a511`) |
| BAK-003 | Access control | ✅ Complete (Phase 22, prior) |
| BAK-004 | OAuth & passwordless | ⬜ Not started |
| BAK-005 | Served admin dashboard | 🔵 In progress 2026-07-26 (worktree agent) |
| BAK-006 | File storage v2 | ⬜ Not started |
| BAK-007 | Backups / export / promotion | ✅ Complete 2026-07-26 (merge `c8431a0`) |
| BAK-008 | Full-text search | ⬜ Not started |
| BAK-009 | Production ops | ⬜ Not started |

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
