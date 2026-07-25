# Realtime Subscriptions (NodeGX Backend)

The NodeGX standalone backend (`nodegx-backend`) pushes live create/update/delete
events to clients over **Server-Sent Events (SSE)**. This is what makes a NodeGX
app feel alive: a record created in one browser appears in another without a
refresh, the editor's Data Browser updates as functions write, and a Query Data
node with **Live** on re-queries automatically.

> **Why SSE, not WebSocket?** SSE survives proxies and CDNs that mangle WebSocket
> upgrades, auto-reconnects in every browser via `EventSource`, needs no
> heartbeat protocol of its own, and is unidirectional — which is all a
> subscription is. Subscription management (subscribe/unsubscribe) happens over
> ordinary HTTP requests keyed by the connection's client id. This is the same
> shape Pocketbase uses.

## The protocol

### 1. Open the stream

```
GET /realtime            Accept: text/event-stream
```

The first frame delivers a server-generated client id:

```
id: 1
event: connected
data: {"clientId":"J9x…"}
```

A `GET /realtime` **without** the `Accept: text/event-stream` header returns a
small JSON hint instead of a stream (so probes and health checks never hang).

**Auth token via query param.** `EventSource` cannot set request headers, so the
session/admin/api token is passed as a query parameter:

- `?token=<sessionToken>` (or `?sessionToken=`)
- `?authToken=<adminBearerToken>`
- `?apiKey=<key>`

A real header, if present (non-`EventSource` clients), always wins. Because the
token appears in the URL, prefer short-lived session tokens and TLS in
production, and avoid logging full realtime URLs.

### 2. Subscribe (replace semantics)

```
POST /realtime/subscriptions
{ "clientId": "J9x…", "subscriptions": [ { "collection": "Todos", "filter": { "done": false } } ] }
```

This **replaces** the connection's entire subscription set (idempotent,
Pocketbase-style) and returns which subscriptions were accepted and which were
rejected:

```json
{ "accepted": [ { "collection": "Todos", "filter": { "done": false } } ],
  "rejected": [ { "collection": "Secret", "reason": "rule \"nobody\" denies find to user" } ] }
```

Subscription creation is gated on the collection's **`find` permission** (CLP)
for the connection's principal. A rejected collection is simply not watched.

### 3. Receive events

```
id: 7
event: change
data: {"action":"create","collection":"Todos","record":{"objectId":"…","title":"Buy milk","done":false}}
```

- `action` is `create`, `update`, or `delete`.
- `record` is the affected record; for a delete it is the row as it was just
  before deletion.
- Events are delivered **post-commit** — a transaction that rolls back emits
  nothing.
- Filters use the **same operator grammar as the query routes** (`$eq`, `$ne`,
  `$gt`/`$gte`/`$lt`/`$lte`, `$in`/`$nin`, `$exists`, `$regex`/`$contains`,
  `$and`/`$or`, direct equality) and are matched server-side against the changed
  record before delivery. The matcher is property-tested against the SQL query so
  a record a paired query would return is exactly a record delivered over
  realtime.
- Every event carries **row-level permission checks**: the same ACL predicate the
  query routes enforce (`canReadRecord`) runs per event per subscriber, so
  realtime can never leak a row a query would hide. (In local `devOpen` mode,
  where queries bypass row ACLs, realtime bypasses them too — for parity.)

## Gaps and reconnection — the honest limits

**The server keeps no event log. There is no replay.** This keeps the server
honest and near-stateless. Instead of replaying missed events, the server tells
the client to re-run its query:

```
id: 12
event: resync
data: {"reason":"reconnect"}    // or {"reason":"overflow"}
```

A `resync` is sent when:

- **Reconnect with a gap** — the connection dropped and reopened (an `EventSource`
  reconnect presents `Last-Event-ID`); events during the gap were not queued.
- **Slow-client overflow** — a client that stops reading backs up into a
  **bounded per-connection queue**; on overflow the queue is dropped, a single
  `resync` replaces it, and the connection is kept. The server never buffers
  unboundedly and never silently drops individual events.

On `resync`, re-run your query; you are then whole again. The Subscribe To Changes
node fires its generic `changed` signal on a resync, and Query Data's **Live**
option re-fetches — so recovery is automatic for both.

### Per-event ids

Every data frame carries a monotonically increasing `id:` per connection, so a
reconnect can *detect* a gap (via `Last-Event-ID`). Ids are per-connection and
reset when a new connection opens; they are not a global cursor (there is no log
to seek).

## Using it in a graph

- **Subscribe To Changes** node: pick a NodeGX backend and it uses SSE
  automatically (Directus backends use WebSocket — same node, no wiring
  difference). Wire its `changed` signal to a **Query Data** `fetch` to keep a
  list live, or react to `created`/`updated`/`deleted` individually.
- **Query Data** node: turn on **Live** (NodeGX backends) and the node keeps its
  results current on its own — it opens a collection subscription and re-runs the
  query (debounced) whenever a record changes.
- **Editor Data Browser**: rides the same stream, so it reflects writes from other
  clients and cloud functions without a manual refresh.

## Out of scope (by design)

- **WebSocket transport** — decided against, not deferred.
- **Event replay / history** — the `resync` contract *is* the design.
- **Cross-instance fan-out** — a single backend process; horizontal fan-out is a
  separate concern.
- **Presence / typing / broadcast channels** — records only.
- **`$relatedTo` filters** — a relation-membership filter cannot be decided
  against a lone changed record, so it is refused at subscription time.

## Deployment notes

- SSE responses are sent with `Cache-Control: no-cache, no-transform` and
  `X-Accel-Buffering: no`, and the server emits heartbeat comment frames every
  ~25s to keep idle proxies from closing the stream.
- Behind nginx, disable proxy buffering for the `/realtime` location
  (`proxy_buffering off;`) and allow long-lived connections.
