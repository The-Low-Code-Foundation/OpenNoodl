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
