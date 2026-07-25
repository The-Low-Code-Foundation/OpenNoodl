# BAK-001: Realtime Subscriptions (SSE)

## Metadata

| Field | Value |
|-------|-------|
| **ID** | BAK-001 |
| **Phase** | Phase 22 — Production Backend (Revival Track H) |
| **Tier** | 1 — credibility |
| **Priority** | 🟠 High (the single most visible "it's alive" feature) |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | 1–2 weeks |
| **Prerequisites** | WF-004 (the service); coordinate with BAK-003 (delivery-time permission checks) |
| **Branch** | `task/bak-001-realtime-subscriptions` |
| **Recommended executor** | 🟠 **Opus 4.8** — the protocol is pre-decided below; the work is careful engineering around reconnects, slow clients, and filter matching, which have opaque failure modes. |

## Objective

Give `nodegx-backend` server-pushed realtime: a client subscribes to a collection (optionally with a filter) and receives create/update/delete events as they happen, over SSE, consumable both by the existing realtime node family and by a live-updating option on Query Records.

## Background

Phase 19 deliberately excluded live queries from WF-004 ("the clients never call them" — true of the *Parse* clients). But RUN-003 shipped a realtime node whose only provider is Directus WebSocket, which leaves the flagship local backend as the one backend NodeGX apps *can't* watch live. Meanwhile the plumbing already half-exists: `LocalSQLAdapter` emits `create`/`save`/`delete` events on every write ([LocalSQLAdapter.js](../../../packages/noodl-runtime/src/api/adapters/local-sql/LocalSQLAdapter.js) — the `events.emit` calls in `create`/`save`/`delete`), and after WF-004 every write from every client funnels through that one adapter inside the service. An SSE endpoint over those events is the cheapest high-leverage feature in this phase.

**Pre-decided: SSE, not WebSocket.** SSE survives proxies and CDNs that mangle WebSocket upgrades, needs no heartbeat protocol of its own, auto-reconnects in every browser via `EventSource`, and is unidirectional — which is all a subscription is. Pocketbase made the same call for the same reasons. Subscription management (subscribe/unsubscribe) happens over plain HTTP requests referencing the connection's client id, exactly as Pocketbase does. WebSocket is not a fallback here; it is out of scope.

## Current State

- Adapter emits post-write events in-process; nothing consumes them beyond the editor's data-browser refresh.
- No `/realtime` route in `LocalBackendServer.js`.
- The runtime realtime node (RUN-003 slice 7) is Directus-WebSocket only.
- WF-005 (specced) consumes the same change events server-side for DB-change triggers — same source, different consumer; do not duplicate the event tap.

## Desired State

- `GET /realtime` — SSE stream. First event delivers a server-generated `clientId`. `POST /realtime/subscriptions` with `{clientId, subscriptions: [{collection, filter?}]}` replaces that connection's subscription set (idempotent, Pocketbase-style).
- Events: `{action: 'create'|'update'|'delete', collection, record}` delivered **post-commit**, with monotonically increasing event ids per connection so `Last-Event-ID` reconnects can detect a gap.
- **Gap semantics (pre-decided): events-only, no replay.** The server keeps no event log. On reconnect with a gap, the server sends a `resync` event; clients re-run their query. This keeps the server stateless-ish and honest — document it prominently.
- Filters use the same operator grammar as the query routes (whatever subset `QueryBuilder` encodes) and are matched server-side against the changed record before delivery.
- Auth: the SSE connection carries the session token (query param — `EventSource` cannot set headers — accept and document it) or bearer token. Delivery-time permission checks: design the matcher with a pluggable `canRead(session, collection, record)` hook so BAK-003 can enforce ACLs without reworking delivery. Until BAK-003 lands, the hook allows what the query routes allow.
- Slow-client policy: bounded per-connection queue; on overflow, drop the queue, send `resync`, keep the connection. Never buffer unboundedly, never silently drop single events.
- **Client surface:** (1) the RUN-003 realtime node gains a "NodeGX Backend" provider; (2) Query Records against the local backend gains an opt-in **Live** boolean that re-runs the query on matching events (debounced). Both ship catalog entries; MCP can enumerate the capability.
- Editor's data browser rides the same stream (replacing any polling/refresh hacks) — dogfooding the protocol.

## Scope

### In Scope
- [ ] SSE endpoint + subscription management routes in `nodegx-backend`
- [ ] Post-commit event tap shared with WF-005's DB-change triggers (one tap, two consumers)
- [ ] Server-side filter matching against the query operator subset
- [ ] Reconnect/`Last-Event-ID`/`resync` semantics implemented and documented
- [ ] Slow-client queue policy with tests
- [ ] Pluggable delivery-time permission hook (BAK-003 seam)
- [ ] Realtime node provider + Query Records "Live" option, with catalog entries
- [ ] MCP visibility of the capability
- [ ] Docs: protocol, semantics, limits, the query-param-token caveat

### Out of Scope
- WebSocket transport (decided against, not deferred)
- Event replay/history (the `resync` contract is the design)
- Realtime for BYOB backends beyond the existing Directus node
- Cross-instance fan-out (single process, per phase README)
- Presence/typing/broadcast channels — records only

## Implementation Steps

1. **One event tap.** Formalize the adapter's post-write events into a small server-side change bus (collection, action, record, txn boundary respected); WF-005's trigger dispatch and this task's SSE both subscribe to it.
2. **SSE endpoint + subscription registry** keyed by clientId; heartbeat comment frames to defeat idle proxy timeouts.
3. **Filter matcher** reusing the query grammar; property-based tests against `QueryBuilder` semantics so the two never drift.
4. **Reconnect + slow-client semantics** with tests (kill connection mid-stream, overflow the queue, verify `resync`).
5. **Permission hook seam**, default mirroring query-route access.
6. **Client work**: realtime-node provider, Query Records Live option, editor data browser migration; catalog + MCP entries.
7. **Docs.**

## Success Criteria

- [ ] Two browsers open on a deployed app; a record created in one appears in the other without refresh, via SSE
- [ ] A filtered subscription receives only matching records; filter semantics match a paired query exactly (shared tests)
- [ ] Killing and resuming the connection past the queue bound yields `resync`, and the client node recovers by re-query
- [ ] The editor data browser updates live through the same protocol
- [ ] Catalog + MCP entries exist; an agent can discover that realtime exists and wire the node
- [ ] Protocol and its honest limits documented

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Filter matcher drifts from SQL query semantics | Shared property-based tests: same record, same filter → matcher verdict must equal query membership |
| Proxies buffer/kill SSE in deployment | Heartbeats + `X-Accel-Buffering: no` + reverse-proxy notes in WF-003's deploy docs |
| Event tap fires pre-commit or inside transactions | Tap sits post-commit by contract, tested with a transaction that rolls back — no event may escape |
| Unbounded memory from slow clients | Bounded queue + resync policy is a scope item with a test, not an afterthought |
| BAK-003 lands later and subscriptions leak private records | The permission hook ships now; BAK-003's spec lists flipping it as a checklist item |

## References

- [WF-004](../phase-19-cloud-workflows/WF-004-BACKEND-SERVICE.md) — the service and route table this extends
- [WF-005](../phase-19-cloud-workflows/WF-005-TRIGGERS.md) — the sibling consumer of change events
- RUN-003 slice 7 — the Directus realtime node this generalizes
- Pocketbase realtime API — prior art for SSE + subscription-replace semantics

## Checklist

- [ ] Change bus shared with WF-005; SSE endpoint + subscriptions
- [ ] Filter matcher with shared-semantics tests
- [ ] Reconnect/resync + slow-client tests
- [ ] Permission hook seam recorded for BAK-003
- [ ] Node provider + Live option + catalog + MCP
- [ ] Docs; CHANGELOG
