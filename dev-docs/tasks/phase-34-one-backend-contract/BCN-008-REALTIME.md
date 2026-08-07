# BCN-008: Realtime Across Three Transports

## Metadata

| Field | Value |
|-------|-------|
| **ID** | BCN-008 |
| **Phase** | Phase 34 — One Backend Contract (Track S) |
| **Tier** | 2 — the adapters |
| **Priority** | 🟡 Medium |
| **Difficulty** | 🟠 Medium-Hard — three transports, and connection-state bugs surface only in live conditions |
| **Estimated Time** | 1–1.5 weeks |
| **Prerequisites** | BCN-004 |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🟠 **Opus 4.8** |

## Objective

One `Subscribe To Changes` capability on the record-node family, served by three transports — SSE,
Directus WebSocket, Supabase Realtime — with Parse LiveQuery declared `conditional` and off by default.
Retires the fifth and last `noodl.byob.*` node type.

## Background

Realtime is the row where every backend has *something* and no two agree on the transport:

| Backend | Transport | State |
|---|---|---|
| NodeGX | SSE, via BAK-001's generic `ChangeBus` | shipped, two consumers (BAK-001, WF-005) |
| Directus | WebSocket with auth handshake | shipped — RUN-003 slice 7, live-verified |
| PocketBase | SSE `/api/realtime` | not built |
| Supabase | Realtime WS (Phoenix channels) | not built |
| Parse | LiveQuery, **a separate server** | not built, and usually not running |

RUN-003 slice 7 is the template and it earned its traps the hard way. `byob-realtime.js` isolates
connection machinery behind injectable WebSocket and timers so it is fully unit-testable: auth handshake
→ subscribe → `init` confirms, server `ping` answered with `pong` (Directus disconnects otherwise),
unexpected close → exponential backoff 1s→30s with the counter reset on resubscribe, `AUTH_FAILED` fatal
by design. The protocol was probed live *before* implementation, which is how it learned that a delete
event carries only string keys even for numeric primary keys.

It also found a defect no unit test could produce: **Node's undici WebSocket fires only `error`, never
`close`, when a connect fails before establishing.** Reconnect logic living on `onclose` alone — the
browser pattern — dead-ends. Both events now funnel into one `_handleSocketDown`.

That is the standard this task generalises to two more transports.

## Current State

| Piece | State |
|---|---|
| `noodl.byob.SubscribeToChanges` | shipped, Directus-only, `ssr: { compat: 'client-only' }` |
| `byob-realtime.ts` | connection machinery, injectable deps, 25 unit tests |
| NodeGX SSE | BAK-001 `ChangeBus`; realtime type read from `backendServices`, **not** Parse `cloudservices` |
| Supabase / PocketBase / Parse | nothing |
| Token source | `auth.publicToken`, like its sibling nodes; persistent role setup is manual |

That `ChangeBus` note is worth keeping in view: our own backend's realtime already routes through the
BYOB metadata rather than the Parse config, which is another instance of the two-config-surface mess
this phase exists to end.

## Desired State

1. **One `Subscribe To Changes` capability on the record family**, with the same outputs regardless of
   transport: Created / Updated / Deleted / Changed signals, event type, changed record(s), changed
   record id.
2. **Three transports behind it** — SSE (NodeGX, PocketBase), Directus WS, Supabase Realtime — each with
   its own connection machinery but the same lifecycle contract: connect, confirm, heartbeat, backoff,
   fatal-vs-retryable.
3. **Parse LiveQuery is `conditional` and off unless probed.** Most Parse deployments do not run it. A
   node that connects to nothing and reports nothing is the exact failure BCN-001's `conditional` state
   was invented for.
4. **Delete events are normalised.** They carry only keys on Directus (as strings, even for numeric
   pks); other transports carry more or less. The contract states what an app author can rely on.
5. **`ssr: { compat: 'client-only' }` holds for every transport.** A server render must not open a
   socket per request.
6. **The fifth BYOB node type is retired**, completing BCN-004's retirement list.

## Implementation Steps

1. Extract the lifecycle contract from `byob-realtime.ts` — connect, confirm, heartbeat, backoff, fatal
   classification — keeping the injectable-dependency property that makes it testable.
2. **Probe each new transport live before implementing it**, as RUN-003 did. The Supabase Realtime
   handshake and PocketBase's SSE subscription format are both easier to observe than to read about, and
   both carry payload-shape surprises of the kind that cost slice 7 a rewrite.
3. Implement SSE (shared by NodeGX and PocketBase), Supabase Realtime, keep Directus WS.
4. Normalise event payloads and the delete-event key contract.
5. Probe-based `conditional` resolution for Parse LiveQuery; default off.
6. Fold the capability into the record family; delete `noodl.byob.SubscribeToChanges` and its
   registrations.
7. **Live pass per transport**: subscribe, mutate from outside the app, confirm the signal pair, then
   **restart the backend container** and confirm auto-reconnect and resubscribe. RUN-003 verified
   Directus against a `docker compose restart`; every transport gets the same treatment.
8. Flip descriptor cells.

## Success Criteria

- [ ] One realtime capability, same outputs, three transports.
- [ ] Each transport survives a backend restart with automatic reconnect and resubscribe — **verified by
      actually restarting the backend**, not by simulating a close.
- [ ] Both the connect-failed-before-established case and the clean-close case drive reconnection on
      every transport (the undici trap, generalised).
- [ ] Parse LiveQuery is `conditional`, probed, and off by default; an app on a Parse server without it
      sees a disabled port with a reason, not silence.
- [ ] Delete-event payload guarantees are documented and identical across transports where possible,
      declared where not.
- [ ] `client-only` SSR compat holds; a server render opens no sockets.
- [ ] `noodl.byob.SubscribeToChanges` no longer exists; the catalog regenerates cleanly.

## Out of Scope

- **Presence and broadcast.** Supabase Realtime has both; nothing else does, and no node consumes them.
- **Optimistic UI.** There is already an `Optimistic Update` node; wiring it to realtime is a graph
  pattern, not adapter work.
- **Realtime over relations.** A change to a related record is not a change to the parent. Do not try.
- **Persistent role/token setup.** RUN-003 left this manual and it stays manual; BCN-009's panel work is
  where a better token story would live if one is wanted.

## Traps

- **`onclose` alone is not enough.** Node's undici WebSocket fires only `error` when the connect fails
  before establishing. This bit RUN-003 in production-shaped conditions and will bite each new transport
  identically.
- **Directus disconnects a client that does not answer `ping` with `pong`.** Every transport has one
  such rule and none of them are optional; probe for them.
- **A `Page.reload` on the viewer webview CDP target reloads the embedder editor page too**, killing the
  session. After a runtime change, relaunch or reopen the project rather than reloading the webview.
- **`Noodl.getMetaData('backendServices')` returns a live mutable ref**, which RUN-003 used to inject a
  session token for smoke tests. Convenient and easy to leave behind in a way that makes a later test
  pass for the wrong reason.
- **Parse LiveQuery's absence is silent.** The client connects to a URL that is not serving; nothing
  errors in an obvious place. Probe explicitly and time out fast, or `conditional` degenerates into
  "always claims supported."
- **Two `ChangeBus` consumers already exist** (BAK-001, WF-005) and neither should acquire a second tap.
  Generalising realtime must not fork our own backend's change stream.