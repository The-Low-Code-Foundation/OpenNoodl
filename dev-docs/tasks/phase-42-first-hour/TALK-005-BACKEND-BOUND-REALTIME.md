# TALK-005 — A realtime node bound to the selected backend

Covers reported item **2**. A brainstorm doc — the plumbing exists; the question is what node(s)
to put on top of it.

## What was reported

> Websocket node lets you set your own websocket data, which is cool, but shouldn't we have a
> version that's connected to our 'backend' tab selected backend? Especially the in built SQLite
> backend, but also Pocketbase and Directus etc have their own websocket system.

## The reframe research forces: it's not a WebSocket variant

The built-in backend **deliberately does not speak WebSocket** — BAK-001 pre-decided SSE ("SSE
survives proxies and CDNs that mangle WebSocket upgrades… WebSocket is not a fallback here; it is
out of scope"). And of the six supported backend types, the realtime transports are: nodegx → SSE,
PocketBase → SSE, Directus → WebSocket, Parse → LiveQuery (probe-gated), Supabase → none built,
custom → none by design. So "a WebSocket node bound to the backend" would be wrong for four of the
six. What you're actually asking for is **a backend-bound *subscription* node** that hides the
transport entirely.

## What already exists (more than you'd think)

- A full five-transport realtime layer behind one contract: `IRealtimeAdapter.subscribe()`
  (deliberately one method, BCN-008), `RealtimeSubscription` shared lifecycle (reconnect,
  confirmation deadlines, fatal-as-data), `realtimeSupportFor(type)` to answer "can this backend
  even do it" statically, normalized events
  (`init|create|update|delete|resync`, `ids` always, `records` best-effort). nodegx, PocketBase
  and Directus transports are built **and measured live** (BCN-008 probe).
- Exactly **one door** into all of that: the `Subscribe To Changes` boolean on **Query Records**
  (`dbcollectionnode2.ts:1246-1256`, outputs `created/updated/deleted/changed/changedRecord/…`).
  Collection-and-query-shaped; nothing else can subscribe.
- The pre-BCN-008 standalone node (`noodl.byob.SubscribeToChanges`) was **deleted** when its
  behaviour was folded into Query Records.
- The generic WebSocket node (`net.noodl.WebSocket`) is unrelated: a raw transport node for
  arbitrary `ws://` endpoints, zero backend awareness. It stays as-is — it's for third-party
  sockets, device telemetry, etc.

## The design question for the session

**Q1 — Is Query Records' checkbox enough, or do we restore a standalone node?**

The case for a standalone **"Subscribe To Changes"** node (the old ergonomics on the new
contract): you can react to backend changes without owning a query — e.g. "any change to
`orders`, ping a signal" — and it's discoverable in the picker as a *thing that exists*, which the
checkbox is not. Your report is itself evidence: the capability shipped and you didn't know.

Every seam it needs is already load-bearing (the research enumerated them): `backendPickerPorts`
(`backendId` enum, `_active_` default), `resolveBackendFromRuntime` → `handleFor`,
`realtimeSupportFor` for gating the port with a reason before any socket opens,
`createRealtimeSubscription`, the output set copied from `dbcollectionnode2.ts:453-540`, and a
`nodeCapabilities.ts` entry so the editor and MCP can gate/enumerate it.

My recommendation: **yes, build it** — it's mostly assembly, and it makes realtime a visible
concept. Keep the Query Records checkbox as the query-refreshing form.

**Q2 — Does the WebSocket node get a "backend" mode?** Recommend **no** — wrong abstraction for
4 of 6 backends, and it would leak transport details the contract exists to hide. Instead the
WebSocket node's description should point at Subscribe To Changes for backend data.

**Q3 — What do we do about the two holes?** Supabase has no transport at all
(`UnavailableTransport`, unmeasured), and SSR behaviour of the SSE transports has no browser
evidence (only an EventSource shim was exercised). Neither blocks Q1; both should be named in the
node's docs ("Realtime Error tells you why" is already the pattern the checkbox uses).

**Q4 — Cloud workflows.** Your item 11 asks for SSE *from workflows to the frontend* (LLM
streaming). That's a different pipe (workflow → client, not DB → client) and belongs to TALK-001's
workflow audit — but if both land, the vocabulary should rhyme: "the backend pushes, nodes
subscribe".

## If Q1 is a yes, the task is

Standalone `Subscribe To Changes` node: backend picker port, collection port, optional filter,
outputs matching Query Records' realtime set, `realtimeSupportFor`-driven port gating, catalog +
enrichment entries, corpus test against the local backend, live-verified against PocketBase or
Directus for one non-nodegx transport.

---

## ✅ Talked 2026-08-05

| Q | Decision |
|---|---|
| Q1 | **Yes, build it.** A standalone `Subscribe To Changes` node on the BCN-008 contract. Query Records' checkbox **stays** as the query-refreshing form — the two are not alternatives. |
| Filter | **Declare the port, send it on nodegx only, disclose it.** Not "no filter port" — the built-in backend does accept one and it is useful today. The tooltip and the docs must say plainly that other backends deliver the collection unfiltered. |
| Q2 | **The WebSocket node stays raw** — and not for the reason this doc gave. See correction 4: *our backend has no WebSocket at all*, so the mode had nothing to connect to. The "easy path to our own backend" Richard asked for is delivered by the new node's `_active_` default instead. |
| Q3 | **Document both holes.** Supabase's missing transport and the unproven SSR path are named on the node and in its docs; neither is fixed here. |
| Q4 / CWF-007 | **Two deliberate nodes, and the reason recorded.** Record-change and function-published-channel subscriptions share `RealtimeSubscription` but not a node: different payloads (a row vs an arbitrary chunk) and different auth postures. This closes CWF-007 Q3 — it is *not* a deferral, and the decision is written down precisely so the pair is not later read as a twin. |

### Four corrections to this doc

1. **"`realtimeSupportFor`-driven port gating" is the opposite of what shipped.** The checkbox's
   port is deliberately **never** gated:
   [dbcollectionnode2.ts:1242-1245](../../../packages/noodl-runtime/src/nodes/std-library/data/dbcollectionnode2.ts#L1242-L1245)
   — *"the port stays declared whatever the backend is — a capability that disappears from the
   panel when the picker moves is worse than one that says why it cannot connect"* — and
   [nodeCapabilities.ts:83-87](../../../packages/nodegx-backend-contract/src/nodeCapabilities.ts#L83-L87)
   records the same reasoning against `DbCollection2.realtime → realtime.subscribe`. The new node
   copies that: ports always declared, `realtimeSupportFor` answers on `Realtime Error` at runtime.
   Building the gating this doc asked for would have made the node's Realtime group vanish on
   Supabase with nothing on screen saying why.

2. **The filter is nodegx-only, and that is a property of the wire, not an oversight.** `where`
   reaches a server in exactly one dialect —
   [`NODEGX_SSE.subscribeRequest`](../../../packages/noodl-runtime/src/api/backends/realtime/SseTransport.ts#L112)
   sets `subscription.filter`. `POCKETBASE_SSE` and `DirectusWebSocketTransport` never read
   `options.where`. Query Records sends none at all for exactly this reason
   ([:638-643](../../../packages/noodl-runtime/src/nodes/std-library/data/dbcollectionnode2.ts#L638-L643):
   a transport that cannot filter server-side *must not* filter client-side and call it the same
   thing). So the decision above is a knowing asymmetry, and the disclosure is the whole point of
   it — otherwise this becomes a fourth twin of the filter semantics BCN-003 spent a task
   collapsing.

3. **The code contains an argument against Q1 that this doc did not cite.**
   [:624-628](../../../packages/noodl-runtime/src/nodes/std-library/data/dbcollectionnode2.ts#L624-L628):
   the subscription lives on Query Records *"because a subscription without a query is a stream of
   ids nobody can render"*. That was true of the retired Directus-only node and is weaker now —
   the fold added `changedRecord` / `changedRecords`, which carry the row wherever the transport
   sends a complete one. It is still true for a Directus delete, which sends the key only
   ([:534-535](../../../packages/noodl-runtime/src/nodes/std-library/data/dbcollectionnode2.ts#L534-L535)).
   Counterweight, also missed: the retired node's `ssr: { compat: 'client-only' }` seam still
   exists and still works ([websocket.ts:159](../../../packages/noodl-runtime/src/nodes/std-library/agent/websocket.ts#L159),
   [sse.ts:71](../../../packages/noodl-runtime/src/nodes/std-library/agent/sse.ts#L71)). Query
   Records could not use it — it has to run during a server render — and had to gate the
   *capability* instead ([:668-679](../../../packages/noodl-runtime/src/nodes/std-library/data/dbcollectionnode2.ts#L668-L679)).
   A standalone node **can**, so it is strictly simpler on SSR than the checkbox was.

4. **"Wrong abstraction for 4 of 6 backends" understated Q2.** There is no WebSocket server in
   [nodegx-backend](../../../packages/nodegx-backend/src/) at all — no upgrade handling, no `ws`
   dependency, nothing. Realtime is the SSE `/realtime` endpoint served by
   [RealtimeHub](../../../packages/nodegx-backend/src/realtime/RealtimeHub.ts), which is BAK-001's
   explicit decision. So a "connect to my backend" mode on the WebSocket node is not merely the
   wrong abstraction for four backends — it is **unbuildable for our own**, which was the one
   Richard most wanted it for. What he actually wanted (make choosing our backend the easy path)
   falls out of `backendPickerPorts`' `_active_` default: drop the node, pick a collection, done —
   while Supabase and custom backends light up an honest reason on `Realtime Error`.

### One stale artifact, not a survival

`dist-types/src/nodes/std-library/data/byob-subscribe.d.ts` and `byob-realtime.d.ts` still exist
with no sources behind them. They are build leftovers from the BCN-008 fold, not a node — anyone
grepping for the retired node will find them and should not conclude it still ships.

### The task

[FH-021](FH-021-SUBSCRIBE-TO-CHANGES.md). Not blocked on anything; every seam it needs is
load-bearing today.
