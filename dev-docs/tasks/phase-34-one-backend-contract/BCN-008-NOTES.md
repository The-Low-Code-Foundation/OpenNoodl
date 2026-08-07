# BCN-008 (contract half) — `IRealtimeAdapter`, and five backends measured

**Date** 2026-07-31 · **Scope** the interface and the measurements only. No transport was
implemented, nothing was folded into the record family, and `noodl.byob.SubscribeToChanges` is
untouched and still working.

**Artefacts**

| What | Where |
|---|---|
| The interface | `packages/nodegx-backend-contract/src/realtime.ts` |
| Its tests | `packages/nodegx-backend-contract/tests/realtime.test.ts` (19 tests; package total 127 → 146) |
| The probe | `dev-docs/tasks/phase-16-runtime-deploy-health/uba-e2e/bcn-008-realtime-probe.mjs` |
| Its recorded output | `dev-docs/tasks/phase-16-runtime-deploy-health/uba-e2e/BCN-008-REALTIME-OUTPUT.txt` |
| Descriptor cells | `realtime.subscribe` in `descriptors/{directus,nodegx,pocketbase,supabase,parse}.ts` |

`npx tsc -p tsconfig.json --noEmit` clean. `npx jest` 4 suites, 146 tests, 0 failures.

---

## 1. The measurement table

One row per backend. Every cell traces to a line in `BCN-008-REALTIME-OUTPUT.txt` unless it is
marked **inferred**, which here means "read in a manual, never seen".

| | **NodeGX** | **Directus 11** | **PocketBase 0.30** | **Parse 7.3.0** | **Supabase** |
|---|---|---|---|---|---|
| **Transport** | SSE `GET /realtime` | WebSocket `/websocket` | SSE `GET /api/realtime` | none running | *not in the rig* |
| **Handshake** | stream → `connected{clientId}` → `POST /realtime/subscriptions` | `{type:auth,access_token}` → `{status:ok}` → `{type:subscribe,collection,uid}` | stream → `PB_CONNECT{clientId}` → `POST /api/realtime {clientId,subscriptions:["coll"]}` | — | phx_join *(inferred)* |
| **Confirmation** | `200 {accepted:[…]}` — **read the body, a rejection is also 200** | `{type:subscription,event:"init",data:[…rows]}` | `204`, **and a 204 is not a promise** (below) | — | `phx_reply` *(inferred)* |
| **Event frame** | `event: change`, `data:{action,collection,record}` | `{type:subscription,event,data:[…],uid}` | **SSE event name is the *collection name***, `data:{action,record}` | — | *(inferred)* |
| **Delete carries** | **the whole record** as it was pre-delete | **keys only, `["2"]` — a string, for an `integer` pk** | **the whole record** | — | key only unless `REPLICA IDENTITY FULL` *(inferred)* |
| **Id type on the wire** | string (uuid) | **string, coerced from a numeric REST id** | string (15 chars) | — | unknown |
| **Keepalive** | server sends `: heartbeat` comment at 25 018 ms; client owes nothing | server `ping` at 30 016 ms; **client must `pong`** | **nothing in 130 s** — no keepalive *observed*, which is a bound not a fact | — | unknown |
| **Silent client** | tolerated | **closed at 60 035 ms, code 1005**, after ignoring one ping | tolerated (nothing to answer) | — | unknown |
| **Failed connect** | `fetch` rejects (`TypeError: fetch failed`) | `error` fires, `close` **never** does | `fetch` rejects | `error` at 20 ms, `close` never | `error` at 5 ms (against PostgREST, which proves nothing about Supabase) |
| **Bad auth** | n/a (dev-open) | `{type:auth,status:"error",error:{code:"AUTH_FAILED"}}` then close 2 ms later | n/a | — | unknown |
| **Bad subscription** | `200` with `rejected[].reason` | — | `404 "Missing or invalid client id."` for a bad clientId; a bad *collection* is accepted | — | unknown |
| **Reconnect** | `Last-Event-ID` → `connected` (**fresh** clientId) → `resync{reason:"reconnect"}` | resubscribe from scratch | resubscribe from scratch | — | unknown |
| **Measured?** | **yes**, live | **yes**, live | **yes**, live | **yes — measured ABSENT** | **NO** |

### The three findings worth carrying forward

1. **Directus deletes carry string keys for an integer primary key.** Re-measured, not
   transcribed: row `id: 2` (a real `integer` column, confirmed via `GET /fields/…/id`) deletes as
   `data: ["2"]`. RUN-003's original finding stands, and it is now the reason `RealtimeChange.ids`
   is `string[]` on every transport.

2. **A 204/200 is not a subscription.** PocketBase answers `204` to an anonymous subscription to a
   superuser-only collection — and then delivers nothing when a row is written to it. Our own
   backend answers `200` to an unsupported filter with `{accepted:[],rejected:[{reason}]}`. Two
   different backends, same trap: acceptance is not gated, delivery is, and the status line lies in
   both directions. This is the same "a 200 is not a yes" lesson BCN-001 learned from PocketBase's
   aggregates, in a second place.

3. **`onclose` + `onerror` is still not enough.** See §2.

---

## 2. The undici trap, generalised — and made worse

Four failure modes, one run, `close` never fired once:

| connecting to | `open` | `error` | `close` |
|---|---|---|---|
| a port with nothing listening | — | 1 ms | **never** |
| a listening server that is not a WebSocket server (PostgREST) | — | 20 ms | **never** |
| **a real WebSocket server on a path it does not upgrade** | — | **never** | **never** |
| an unresolvable host | — | 16 ms | **never** |

The third row is new and it is worse than the trap RUN-003 documented. A `ws://` to Directus on a
path it does not serve is silent for the full 20 s the probe waited — no `error`, no `close`,
nothing. A raw TCP upgrade request to the same path confirms why: Directus accepts the connection
and then sends **no bytes at all**, ever.

`byob-realtime.ts` funnels `onclose` and `onerror` into one `_handleSocketDown`, which covers rows
1, 2 and 4. It has **no connect deadline**, so row 3 is a subscription that never connects and never
reports — the exact silence the spec's Parse trap warns about, arriving from a different direction.

That is why `RealtimeDownReason` has three pre-establishment members and `RealtimeTiming` has a
required `connectTimeoutMs` (15 s: the slowest definite answer measured was 20 ms). A transport
cannot satisfy `RealtimeLifecycle` while reconnecting from events alone.

---

## 3. The interface

```
IRealtimeAdapter        { transport, subscribe(handle, options) → RealtimeHandle }
RealtimeChange          { type, collection, ids: string[], records, recordsComplete }
RealtimeStatus          connecting | subscribed | interrupted | stopped
RealtimeLifecycle       connect() · confirmed() · transportDown(reason) · dispose() · status
RealtimeDownReason      closed | errored | connect-timeout | heartbeat-missed
RealtimeError           { message, code, kind }   kind: fatal | retryable
REALTIME_FAILURE_KINDS  the one classification, as data
REALTIME_TIMING         1 s → 30 s backoff + a required 15 s connect deadline
nextReconnectDelay()    the one piece of arithmetic, tested against hostile counters
RealtimeDeps            WebSocketImpl / EventSourceImpl / fetchImpl / timers — injectable
REALTIME_SSR_COMPAT     'client-only'
REALTIME_TRANSPORT_PROFILES  the table above, as frozen data, with `measured: boolean`
```

**One method, not fourteen.** `IDataAdapter` has fourteen because `CloudStore` had fourteen. There
is one thing to do here; the content is in the lifecycle the returned handle obeys.

**`subscribe` returns a handle** rather than taking an `unsubscribe` callback. That is the one
deviation from this package's `{success, error}` house style and it is deliberate — a subscription
outlives the call that made it, so something has to be holdable.

**The delete contract, stated once.** `ids` is the guarantee: always present, always strings, on
every transport. `records` is best-effort, and `recordsComplete` says which you got. The alternative
— letting a node infer it from `records.length === 0` — cannot tell a key-only delete from an empty
page, and would have a "deleted record" output publish `{}` on Directus and a full row on PocketBase
with nothing anywhere saying why.

---

## 4. Stale premises found in the spec and the descriptors

1. **The Directus probe path was wrong.** `descriptors/directus.ts` told a probe to look for "a
   websocket section" in `GET /server/info`. Measured on an instance with `WEBSOCKETS_ENABLED=true`
   and realtime provably working: `/server/info` returns `{data:{project:{…},setupCompleted:true}}`
   and mentions websockets nowhere. That probe answers `unsupported` on a server where realtime is
   fine. Repointed at the handshake.

2. **The Parse probe path was wrong in the same way, and worse.** `descriptors/parse.ts` said to
   look for "a `liveQueryServer` entry" in `/serverInfo`. Parse Server 7.3.0 with the master key
   returns features `globalConfig, hooks, cloudCode, logs, push, schemas, settings` — LiveQuery is
   not mentioned whether it is running or not, so a `/serverInfo` probe answers "no" on every Parse
   server in existence. Only the socket settles it, and it settles in 20 ms. Repointed.

3. **The spec's transport table says "Supabase Realtime — not built".** True, and it understates
   the situation: it is also **not runnable here**. See §5.

4. **"Probe each new transport live before implementing it" assumes each transport is probeable.**
   Two of the five were not (Supabase, Parse LiveQuery) and one of those turned out to be
   *measurably absent*, which is a different and more useful result than "did not get to it".

5. **The spec's Current State table gives PocketBase realtime as simply "not built".** It is also
   *not authenticated* in any way we have exercised: the whole PocketBase probe ran anonymously,
   with no token anywhere, and worked. Whatever BCN-008 proper does with `auth.publicToken` on this
   transport, it is not carrying it today because nothing needed it.

---

## 5. Could not verify

Ruthlessly, and loudly.

- **Supabase Realtime: NOTHING was verified. There is no Supabase Realtime in the rig.** The
  `supabase` compose profile is one Postgres and one PostgREST container. Supabase Realtime is a
  separate Elixir service speaking Phoenix channels and it has never been in `docker-compose.yml`.
  The probe established the absence three ways — the descriptor's own health path is a plain `404`
  from PostgREST, `ws://localhost:8056/realtime/v1/websocket` errors in 5 ms, ports 4000 and 54321
  are silent — and then stopped rather than transcribing the documentation into a measurement.
  **Every Supabase cell in `REALTIME_TRANSPORT_PROFILES` is `measured: false`,** including the
  delete-payload claim, which is precisely the field RUN-003 got wrong on Directus by reading rather
  than asking. A test asserts that an unmeasured profile cannot sit next to a `supported` descriptor
  cell.

- **Parse LiveQuery's protocol was never exercised.** What was measured is that it is *absent*: no
  advertisement in `/serverInfo`, `error` in 20 ms on the socket, a raw upgrade request answered
  `403` by the ordinary Express app. No NodeGX code has ever spoken to a running LiveQuery server,
  and the rig's Parse container has no `PARSE_SERVER_START_LIVE_QUERY_SERVER` — standing one up is a
  compose change nobody has made. `conditional` is correct and the socket-based probe is now cheap
  enough (20 ms) to justify it.

- **PocketBase's keepalive is `none-observed`, not "none".** 130 s of idle stream, zero frames. That
  is a bound on the observation, not a fact about the product, and the type says so
  (`observedForMs: 130000`). A proxy-idle-timeout question that matters in deployment is therefore
  still open.

- **No backend was restarted.** Success criterion 2 of BCN-008 ("survives a backend restart,
  verified by actually restarting the backend") is untouched — two other workers share this rig and
  restarting a container underneath them was not acceptable. Reconnect-and-resubscribe is
  **unverified for every transport**, including Directus, in this task.

- **Nothing was run in a browser.** Every measurement is Node 22.22 with undici. Browser WebSocket
  and browser `EventSource` differ from undici in exactly the area this task is about — the browser
  *does* fire `close` after `error`. The contract handles both, but the browser half is reasoned,
  not measured.

- **`ssr: { compat: 'client-only' }` was not verified by rendering anything.** What was measured is
  the supporting fact: Node 22.22 has `WebSocket` and **no `EventSource`**, so two of the three
  transports cannot even be constructed server-side. An actual SSR render opening zero sockets is
  BCN-008 proper's to demonstrate.

- **Directus was probed with an admin token.** `auth.publicToken` with a restricted role — the token
  a shipped app actually carries — was not exercised, so "which collections a public token can
  subscribe to" is unknown.

---

## 6. Deviations, with reasoning

1. **`RealtimeStatus` is four states, not the shipped `subscribed: boolean`.** The boolean cannot
   distinguish "connecting for the first time" from "dropped, retrying", and those want different
   things on screen. It also cannot express `stopped`, so today a fatal `AUTH_FAILED` reads exactly
   like a slow connect that will succeed in a second.

2. **`RealtimeError.kind` is required and defaulted from data.** `Capability` makes `reason`
   required so a cell cannot take something away without saying why; the same argument applies to a
   transport reporting a failure without saying whether retrying helps. `REALTIME_FAILURE_KINDS` is
   the single classification so five transports cannot each decide differently.

3. **`connectTimeoutMs` added, and not optional.** Not in the spec, and not optional because of the
   silent-socket row in §2. 15 s.

4. **`transport: 'phoenix-channel'` is a distinct value from `'websocket'`.** Supabase Realtime runs
   over a WebSocket but the entire lifecycle above the socket — join, reply, per-topic config — is
   different. Calling it `websocket` would invite reusing the Directus transport for it, which is
   the mistake this contract exists to make hard.

5. **PocketBase stays `supported`, despite the accepted-then-silent behaviour.** The temptation was
   `degraded`. It is wrong: delivery being gated by read permission is true of *every* backend here
   (our own hub calls `canReadRecord` per event per subscriber), so singling PocketBase out would
   misinform. The footgun is recorded in the cell's `evidence` instead, where BCN-009's panel can
   pick it up.

6. **`custom` has no profile row and its cell is untouched.** A user's own API might push over
   anything or nothing; the descriptor is `declarable` for exactly this case, and inventing a
   profile would be inventing a wire nobody has seen.

7. **The probe creates its own collections (`bcn008_items`) rather than reusing seed data.** The rig
   is shared with two concurrent workers. Creating is additive; reusing and mutating would not be.
   A numeric primary key on Directus was required to ask the delete question at all.

---

## 7. What BCN-008 proper inherits

- Implement SSE (NodeGX + PocketBase — **the two frame formats differ**: our event name is
  `change`, PocketBase's is the collection name), Directus WS, Supabase Realtime.
- **Give every transport a connect deadline.** `byob-realtime.ts` has none.
- **Answer Directus's ping.** Measured: one ignored ping and the server closes you at 60 s.
- PocketBase's subscription POST **replaces** the set, like ours. Two nodes subscribing on one
  connection will clobber each other unless the transport owns the set.
- Our backend hands out a **fresh `clientId`** on every reconnect and follows it with `resync` —
  the re-POST is mandatory, not an optimisation.
- Read subscription *bodies*, not statuses.
- Do not fork the `ChangeBus`: it has two consumers (BAK-001, WF-005) and realtime must remain the
  first tap, not a third.
- Get a real Supabase stack into the rig, or leave that column `conditional` forever.

---
---

# BCN-008 (proper) — the transports, built and restarted

**Date** 2026-08-01 · **Scope** steps 1–8. Four transports built, the fifth deliberately not.
`noodl.byob.SubscribeToChanges` retired and folded into Query Records. **Every backend the
rig can reach was restarted underneath a live subscription**, which is the one thing the
contract half could not do.

**Artefacts**

| What | Where |
|---|---|
| The lifecycle | `packages/noodl-runtime/src/api/backends/realtime/RealtimeSubscription.ts` |
| Directus WS | `…/realtime/DirectusWebSocketTransport.ts` |
| SSE, two dialects | `…/realtime/SseTransport.ts` (`NODEGX_SSE`, `POCKETBASE_SSE`) |
| Parse LiveQuery | `…/realtime/ParseLiveQueryTransport.ts` — a probe and a reason, not a protocol |
| Supabase / custom | `…/realtime/UnavailableTransport.ts` |
| The seam | `…/realtime/index.ts` — `realtimeSupportFor`, `createRealtimeSubscription` |
| Unit tests | `packages/noodl-runtime/test/backends/realtime-transports.test.ts` (53) |
| Live driver — transports | `uba-e2e/bcn-008-realtime-driver.ts` → `BCN-008-DRIVER-OUTPUT.txt` (**70 checks, 0 failed**) |
| Live driver — the node | `uba-e2e/bcn-008-node-driver.ts` → `BCN-008-NODE-OUTPUT.txt` (**29 checks, 0 failed**) |
| The capability | `Subscribe To Changes` on `DbCollection2` (Query Records) |
| Deleted | `byob-subscribe.ts`, `byob-realtime.ts`, and their two test suites |

**Gates.** `noodl-runtime` 86 suites / **0 failures** (1602 of 1615 passing, 13 skipped —
up 22 tests on the 1580 baseline). `nodegx-backend-contract` 146. Editor `test:ci` **1957
specs, 0 failures**. `npm run catalog:check` clean at 155 node types (156 before). `tsc`
clean in both packages.

---

## 8. The live pass, per transport — including the restart

Two drivers, because they answer different questions. The transport driver bundles the
shipped classes and asks whether the *wire* works. The node driver registers a real
`DbCollection2` into a real `NodeContext` and asks whether a **signal** fires — which is
what the success criterion actually says, and which no amount of frame-parsing proves.

| | subscribe | mutate from outside | **restart, then deliver** | at the node |
|---|---|---|---|---|
| **NodeGX** SSE | ✅ non-empty `accepted[]` | ✅ create/update/delete + whole record on delete | ✅ **process killed & relaunched** → reconnected, re-registered, delivered; 2 `resync` frames | ✅ signals + `Changed Record` carries the pre-delete row |
| **Directus** WS | ✅ `init` frame | ✅ create/update/delete, delete `ids: ["1"]` for an integer pk | ✅ **`docker restart uba-e2e-directus-1`** → interrupted → subscribed → post-restart row delivered | ✅ signals, `Items` re-queried, `Changed Record` **null** on delete |
| **PocketBase** SSE | ✅ 204 | ✅ event name is the collection; delete carries the whole record | ✅ **`docker restart uba-e2e-pocketbase-1`** → re-POSTed with the fresh clientId, post-restart row delivered | — (same code path as NodeGX) |
| **Parse** | n/a | n/a | n/a | ✅ `CAPABILITY_UNAVAILABLE` in **32ms**, fatal, reported once |
| **Supabase** | n/a | n/a | n/a | ✅ reason on `Realtime Error` + `Realtime Failure` signal, no socket opened |

⚠️ **The restart check demands a delivery, not a status.** A status flipping back to
`subscribed` proves a socket reconnected and proves nothing about whether the subscription
was re-registered — and on both SSE servers the `clientId` is fresh per connection and the
subscription POST *replaces* the set, so "reconnected" and "resubscribed" are genuinely
separable states. Mutation M4 below shows the check earns its keep.

⚠️ **NodeGX was a process restart, not `docker restart`.** The rig has no nodegx-backend
service; the driver kills and relaunches the `:8593` process it started. Same event from
the socket's side (connections dropped, fresh clientIds), and said out loud rather than
filed under "restarted the backend".

### The ping/pong rule, verified by removing it

Directus, 72 seconds of deliberate client silence: the subscription never left
`subscribed`. With the `pong` reply removed it dropped and reconnected — **and the very
next check, "a row written after the idle window is still delivered", still passed**,
because the reconnect logic recovered. A driver that only asked "did the row arrive?" would
have scored a missing pong as a pass. That is the shape of this whole task's instrumentation
risk, caught in the one place it was cheap to catch.

## 9. Mutation testing the driver

Each fix reverted, one at a time, the driver re-run.

| mutation | checks that failed |
|---|---|
| **M1** `_armDeadline` returns immediately — the pre-BCN-008 behaviour, no connect deadline | **4** — the silent-socket case never reports, *and* an SSE host whose `EventSource` does not auto-retry never recovers at all |
| **M2** Directus `ping` not answered | **1** — and delivery still passed (above) |
| **M3** `NODEGX_SSE.readVerdict` returns `{ok:true}`, trusting the 200 | **2** — a rejected filter reads as a live subscription |
| **M4** register once instead of on every hello frame | **2** — reconnects, never resubscribes, silent forever after a restart |

M1's second failure was not predicted and is the most useful thing in this table: the
confirmation deadline is not only the silent-socket guard, it is **the only path by which
an SSE subscription recovers on a host whose `EventSource` does not retry**. `byob-realtime.ts`
had neither, so it depended entirely on the browser's retry and had no fallback.

## 10. Stale premises in the spec (in addition to §4's)

6. **"Three transports" is four, or two, depending how you count.** The spec's desired
   state says SSE, Directus WS and Supabase Realtime. What exists is SSE (two *different*
   dialects — our event name is `change`, PocketBase's is the collection's own name, and
   the subscription bodies differ in shape as well as path), Directus WS, and a Parse
   probe. Supabase is not among them. Counting "SSE" as one transport is what made the
   spec's estimate look reasonable.

7. **"Probe each new transport live before implementing it" was followed for two of the
   four and was impossible for the other two** — already noted in §4.4, now closed one way:
   Parse got a probe *as its implementation*, and Supabase got nothing at all.

8. **The spec's success criterion 3 says an app on a Parse server without LiveQuery "sees a
   disabled port with a reason".** There is no port-disabling mechanism in the runtime — that
   is BCN-010's and BCN-009's surface. What ships is the runtime half: a `Realtime Error`
   port carrying `CAPABILITY_UNAVAILABLE` and a sentence, a `Realtime Failure` signal, and a
   `Subscribed` output that stays `false` rather than pending. The port is still *drawn*.

9. **The spec assumed `ssr: { compat: 'client-only' }` could stay a node-level flag.** It
   cannot once the capability lives on Query Records, which has to run during a server
   render. See §11.4.

## 11. Deviations, with reasoning

1. **The connect deadline is a *confirmation* deadline.** `REALTIME_TIMING.connectTimeoutMs`
   is described as time-to-`open`. It is armed here whenever the subscription is not
   `subscribed` and disarmed only by `confirmed()`. The measured reason: three of the five
   backends will hold an *open* connection that confirms nothing (PocketBase's 204 for a
   collection it will never deliver; our own 200 carrying a rejection), and "open but never
   subscribed" is the same silence as "never opened" from the app's side. One timer, both
   silences — and M1 showed it doing a third job nobody designed it for.

2. **A generation counter replaces the shipped `_downHandled` flag.** That flag
   de-duplicated *within* a socket, so a late `close` from generation 1 arriving after
   generation 2 had connected still scheduled a second reconnect — two live sockets, one
   subscription. Reports are now tagged and stragglers dropped. There is a unit test whose
   whole content is that scenario.

3. **A connection that goes down before it ever confirmed reports `CONNECT_FAILED`.** Not in
   the spec. Found by writing the driver: against PostgREST the only observable was a status
   quietly turning `interrupted` — no code, no message, nothing naming what was wrong.
   A confirmed connection dropping reports nothing, deliberately: a backend restart is an
   ordinary event and an error per restart trains people to ignore errors.

4. **`client-only` is enforced per *capability*, not per node.** The retired node could
   declare `ssr: { compat: 'client-only' }` and be made inert server-side. Query Records
   cannot — SSR is most of what it is for. So `reconfigureRealtime` checks
   `context.platform.isSSRServer()` and returns. Same guarantee (a server render opens no
   sockets), different mechanism, and the mechanism is now in a place a future capability on
   an SSR-critical node can copy.

5. **No server-side filter is sent, on any transport.** Our own backend accepts one;
   Directus takes none on a subscribe and PocketBase takes a different expression language.
   The contract says a transport that cannot filter server-side must not filter client-side
   and call it the same thing — so a change to a record *outside* the query's filter still
   fires `Records Changed`, and the debounced re-query is what settles whether `Items`
   actually moved. Coarser, uniform, and correct by construction. (The transport still
   *supports* `where`; the node just does not use it.)

6. **A change re-runs the query rather than patching the collection.** `cloudStoreEvents`
   patches, using a **Parse-shaped** local matcher — wrong for a Directus filter, wrong for a
   search term, wrong for anything the server evaluated that the client cannot. BAK-001's
   `Live` toggle already re-queried; this is that, generalised.

7. **One stream/socket per subscription, deliberately.** Both SSE servers' subscription POST
   *replaces* the set for a `clientId`, so a shared connection means two nodes clobbering
   each other silently. The cost is one connection per subscribing node. The alternative is a
   shared registry that has to be right about ordering, and a wrong one presents as "the
   other node stopped receiving" with nothing in any log.

8. **Consumer callbacks are wrapped.** An exception thrown by a node's handler no longer
   escapes into the transport's own bookkeeping — the Directus `pong` is dispatched from the
   very handler a throwing consumer would have killed. This is BCN-004 step 6's
   `_addModelAtCorrectIndex` defect one layer up, pre-empted rather than waited for. It is
   reported to `console.error`, not swallowed; this layer has no `raiseRuntimeError` and
   giving it one would put the node layer inside the transport layer.

9. **Parse's transport declares `transport: 'none'` and only probes.** It reports
   `CAPABILITY_UNAVAILABLE` in ~30ms when nothing answers — and *also* when something does,
   with a different sentence, because no NodeGX code has ever spoken the LiveQuery protocol
   and writing a decoder from documentation is the habit this phase exists to end.

10. **`byob-query-data.ts` was repointed rather than left alone.** It held the only other
    reference to `byob-realtime.ts`. Keeping a second realtime implementation alive to avoid
    a five-line edit would have contradicted the task. ⚠️ **This is a one-file overlap with
    the orchestrator's pending deletion of the other four `noodl.byob.*` types** — a
    delete-vs-modify conflict that resolves as "delete wins".

11. **The Supabase descriptor's `realtime.subscribe` reason was rewritten** (state left
    `conditional`). It said "turn Realtime on in your Supabase dashboard", which is now
    actively wrong: doing that will not make this work, because no transport exists. See
    §13 for the state disagreement this leaves.

## 12. Could not verify

- **Supabase Realtime: still nothing. No transport was written and none was measured.** The
  decision, stated plainly: the two acceptable options were "add Realtime to
  `docker-compose.yml` and measure it" or "leave it `conditional` and say so", and this took
  the second. The reason is cost and blast radius, not preference — the rig's
  `uba-e2e-supabase-db-1` runs `wal_level = replica` and has **zero publications** (checked
  today), so a real Realtime service needs a Postgres restart onto logical replication, a
  `supabase_realtime` publication, `SECRET_KEY_BASE`/`DB_ENC_KEY`/`API_JWT_SECRET`, and a
  tenant POSTed to the service's own API before it will serve a socket. That is a compose
  change to a file **two other workers are running against right now**. Every Supabase cell
  in `REALTIME_TRANSPORT_PROFILES` remains `measured: false`, untouched.
- **A browser was never used.** Every measurement is Node 22.22. The Directus half runs on
  the real undici `WebSocket`; **both SSE transports run on a hand-written `EventSource`
  shim**, because Node has none. The shim implements dispatch-by-event-name, multi-line
  `data`, comment skipping, `Last-Event-ID` replay and a 3s retry, and was run in both
  auto-retry and no-auto-retry modes — but a browser's `EventSource` remains unexercised,
  and the browser fires `close` after `error` where undici does not. The contract handles
  both; only one half is measured.
- **The editor was never opened.** No screenshot, no port panel, no check that
  `Subscribe To Changes` renders in the Realtime group or that the new outputs group
  sensibly. The catalog regenerates and the editor's 1957 specs pass; that is not the same
  thing.
- **`ssr: { compat: 'client-only' }` still has not been verified by rendering anything.**
  §11.4 replaced the mechanism, and the new guard is covered by neither a unit test (it
  needs a `context.platform`) nor a live render. **An SSR render opening zero sockets is
  still owed.** This is the one deviation in this document with no evidence behind it.
- **Directus was driven with an admin token throughout.** `auth.publicToken` with a
  restricted role — what a shipped app carries — is still unexercised, so "which collections
  a public token can subscribe to" is still unknown. Unchanged from §5.
- **PocketBase's keepalive is still `none-observed`**, and the proxy-idle-timeout question
  that matters in deployment is still open. No watchdog was written for either SSE transport
  and that is a measurement, not an omission: SSE keepalives are `:` comment lines, which
  `EventSource` does not surface to any listener, so an SSE watchdog would be counting frames
  it cannot see.
- **The heartbeat watchdog's 90s threshold has never fired against a real server.** It is
  unit-tested on an injected clock. Producing the condition needs a connection killed without
  a FIN — a NAT timeout or a `kill -9` on the right side of a proxy — which `docker restart`
  does not reproduce.
- **Nothing tested two subscriptions to the same backend at once.** §11.7 argues one
  connection per subscription makes the clobbering impossible by construction. It is an
  argument, not a measurement.

## 13. Handover — what the next task inherits

- ⚠️ **`realtimeSupportFor('supabase')` says `unsupported`; the descriptor cell says
  `conditional`.** Deliberate and recorded: they answer different questions ("could a
  Supabase project have realtime?" vs "can NodeGX speak to it?"). **BCN-010 is where one of
  them has to give**, and the answer that matches shipped behaviour is `unsupported`.
- ⚠️ **`packages/noodl-editor/.../cloud-node-library.json` still lists
  `noodl.byob.SubscribeToChanges`** in its "BYOB Data" group. That file is Worker D's
  territory and was left alone; `nodelibraryexport.ts` and `register-nodes.js` were both
  updated. **Whoever deletes the other four types must take this fifth line with them**, or
  the cloud runtime's picker offers a type that no longer exists.
- **`byob-query-data.ts` now imports `api/backends/realtime`** — see §11.10 for the merge
  conflict this sets up with the pending BYOB deletions.
- **The two drivers are re-runnable and cheap.** `bcn-008-node-driver.ts` in particular is
  BCN-004 step 6's harness and is the right place to add a check that a subscription reaches
  a graph on a backend nobody has tried yet.
- **`REALTIME_TRANSPORT_PROFILES` now carries restart evidence** for the three measured
  backends. The `measured` column is unchanged: `true` for nodegx/directus/pocketbase/parse
  (parse = measured **absent**), `false` for supabase. **No cell was flipped.**
