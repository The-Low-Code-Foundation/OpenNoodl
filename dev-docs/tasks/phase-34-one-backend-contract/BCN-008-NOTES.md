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
