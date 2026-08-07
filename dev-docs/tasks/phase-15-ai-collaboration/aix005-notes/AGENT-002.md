# AGENT-002 — WebSocket node (AIX-005)

As-built notes. Scope: AGENT-002 only. AGENT-001/007 (SSE, stream parsers) and
AGENT-003 (global state store) were built in parallel by other agents;
AGENT-004/005/006 are a later wave.

## What shipped

| File | Role |
|---|---|
| `packages/noodl-runtime/src/nodes/std-library/agent/websocket-connection.ts` | The lifecycle state machine. Socket, timers, clock and RNG are all injectable. |
| `packages/noodl-runtime/src/nodes/std-library/agent/websocket.ts` | The node shell: ports, input-change policy, `_onNodeDeleted`. |
| `packages/noodl-runtime/test/websocket.test.ts` | 76 specs: the state machine against a fake socket and a manual clock. |
| `packages/noodl-runtime/test/websocket-node.test.ts` | 33 specs: the node through the real runtime (`NodeContext`, `defineNode`, real port connections). |
| `packages/noodl-runtime/noodl-runtime.js` | One `require` line appended to the registration array. |
| `packages/noodl-runtime/src/nodelibraryexport.js` | One type name appended to the picker's *External Data* subcategory. |
| `docs/node-catalog/enrichment/net.noodl.websocket.json` | SUB-005 enrichment entry. |
| `docs/node-catalog/examples/data-websocket-agent-chat.json` | Validated example graph. |
| `packages/noodl-types/src/node-catalog*.json` / `.d.ts` | Regenerated, not hand-edited. |

Split into two files rather than one because `byob-realtime.js` +
`byob-subscribe.js` set that precedent for exactly this reason: the lifecycle is
what needs exhaustive testing and it can only be tested if the socket comes in
through the door.

## Ports

Type name `net.noodl.WebSocket`, display name **WebSocket**, category Data,
colour data, `ssr: client-only`.

**Inputs — Connection:** `url`, `autoConnect`, `protocols`, `autoReconnect`,
`reconnectDelay`, `maxReconnectDelay`, `maxRetries`, `jitter`,
`heartbeatInterval`, `heartbeatMessage`, `heartbeatReply`
**Inputs — Actions (signals):** `connect`, `disconnect`, `send`
**Inputs — Message:** `message`, `messageType`, `whenDisconnected`, `maxQueueSize`

**Outputs — Status:** `connectionState`, `connected`, `retryCount`, `lastError`,
`queueSize`, `droppedCount`, `latency`, `closeCode`, `closeReason`
**Outputs — Data:** `received`, `receivedRaw`, `receivedIsBinary`
**Outputs — Events (signals):** `onOpen`, `onMessage`, `onMessageSent`,
`onError`, `onClose`, `onReconnect`

The port set is pinned by an assertion in `websocket-node.test.ts`, so a rename
has to be made deliberately.

## Policies, stated plainly

### Reconnection

Exponential backoff `reconnectDelay * 2^attempt`, capped at `maxReconnectDelay`,
with **equal jitter** (scaled into [50%, 100%] of the computed delay — never
sooner than half the intended wait, so jitter can't defeat the backoff).
Defaults 1000 ms / 30000 ms / `maxRetries: 10`; a negative `maxRetries` retries
forever, `0` never retries.

Reconnection fires for **any close the client did not initiate**, except close
codes 1002, 1003, 1007, 1008, 1009, 1010, 1015 — the protocol/policy failures
where the next attempt fails identically. Same "fatal" reasoning as
`byob-realtime.js`'s `AUTH_FAILED` case. 1006, 1011–1013 and the 4000–4999
application range are all retried.

`connectionState` is `reconnecting` for the *whole* outage — the wait and every
attempt — rather than flickering to `connecting` per try, because "we lost it,
we're working on it" is one thing to render and `retryCount` already says how
hard we're working.

Giving up is never quiet: `connectionState` → `error`, `lastError` names the
attempt count, `onError` fires, `onClose` fires with `willReconnect` false.

### Send while disconnected

`whenDisconnected` enum, default **Queue**:

- **Queue** — FIFO, bounded by `maxQueueSize` (default 100). When full the
  **newest** send is refused, not the oldest evicted: the queue stays an ordered
  prefix of what the app tried to say, and the loss is attributable to a
  specific send. `0` or less means unlimited.
- **Drop** — discarded and counted in `droppedCount`. Not an error, because it
  was asked for; still never invisible.
- **Report Error** — counted *and* `lastError` + `onError`.

### Delivery semantics (the honest version)

- **Ordering is FIFO, always.** The queue flushes inside the `open` handler
  before control returns to the graph, so a queued message can never overtake
  one sent after recovery. Flush happens *after* `onOpen`, so an auth frame sent
  from the open handler precedes the backlog.
- **Never duplicated.** Nothing handed to `socket.send()` is ever handed to
  another socket. A send that *throws* during a queue flush is pushed back to
  the front, which is what keeps queued messages exactly-once rather than
  at-most-once.
- **Loss is possible and not attributable.** `socket.send()` only buffers; if
  the connection dies before the frame leaves, the message is gone and RFC 6455
  gives no way to learn which. `connectionState → reconnecting` is the only
  signal that it may have happened. Applications that can't tolerate this need
  their own acknowledgements — documented in the enrichment anti-patterns.
- **Received messages are never de-duplicated or replayed.** A reconnect is a
  new session; the server decides whether it repeats anything. `onReconnect`
  fires on every open after the first as the app's cue to re-fetch — the same
  role BAK-001's SSE `resync` frame plays.

## Deviations from the phase-3.5 spec, with reasoning

The January-2026 draft was reviewed line by line. Deviations:

1. **TypeScript, in `std-library/agent/`, not JS in `std-library/data/`.**
   PLAT-003 typed the runtime; AIX-005 says to follow it. `agent/` is the
   AIX-005 convention shared with the sibling agents.

2. **Renamed ports to the shared AIX-005 lifecycle contract.** So the SSE and
   WebSocket nodes read alike to an author: `isConnected` → `connected`;
   `connected` (signal) → `onOpen`; `disconnected` → `onClose`;
   `messageReceived` → `onMessage`; `messageSent` → `onMessageSent`;
   `error` (string) → `lastError`. Added `connectionState`, `retryCount`,
   `autoConnect`, `onError`.

3. **Reconnect no longer gated on `!event.wasClean`.** The draft's check fires
   the feature in roughly the least useful subset of cases: `wasClean` is *true*
   for a server closing an idle connection (the commonest reason to want
   reconnection) and *false* for the ordinary 1006 drop. Replaced with the
   fatal-code list above.

4. **Heartbeat is off by default (`heartbeatInterval: 0`).** The draft defaulted
   it to 30 s and sent the literal string `ping`. Browser WebSockets cannot send
   protocol ping frames, so this is *application data* injected into someone
   else's protocol — most servers will ignore it or close. It is now opt-in with
   `heartbeatMessage`/`heartbeatReply` configurable.

5. **Heartbeat also detects dead connections.** The draft measured latency but
   never acted on silence. A heartbeat unanswered for a full interval now closes
   and reconnects through the ordinary unsolicited-close path. This is what
   satisfies the draft's own "heartbeat detects dead connections" criterion —
   TCP can hold a half-open socket for minutes.

6. **The reply marker only filters while the heartbeat runs.** Otherwise a
   server whose protocol legitimately uses the word `pong` would lose messages
   to the transport layer — a bug in the draft's `handleMessage`.

7. **`queueWhenDisconnected` (boolean) → `whenDisconnected` (enum).** The
   boolean cannot express "report an error", yet the draft's own code did all
   three things. `maxQueueSize` added because the draft listed "queue doesn't
   grow unbounded" as an edge case with no way to bound it.

8. **`messageType` gained `auto`, and it is the default.** The value's own type
   already says whether it is binary; forcing every author to declare it is
   noise, and re-encoding an ArrayBuffer as text corrupts it.

9. **`binaryType = 'arraybuffer'`.** The platform default is `blob`, which
   cannot be read synchronously and is therefore useless to a node graph.

10. **`onReconnect` added** (not in the draft). The one thing a WebSocket
    reconnect cannot tell you is what you missed.

11. **Empty `message` is reported, not ignored.** The draft returned silently;
    a Send with nothing to send is almost always a wiring mistake.

12. **`closeCode` / `closeReason` added.** Legibility is the phase premise, and
    the server's own explanation is the most useful thing it will ever say.

13. **Errors are recovered from, not just logged.** Every author callback runs
    inside a try/catch so a throwing Function node cannot leave the connection
    half-updated or a timer unscheduled.

Not implemented from the draft's "future enhancements": compression, connection
pooling, message batching, reacting to the negotiated subprotocol. All were
listed as post-MVP there too.

## Design decisions worth knowing

- **`connect()` while open replaces the socket without firing `onClose`.** The
  app asked for the replacement; reporting it as a failure trains authors to
  ignore the signal.
- **`rebuild()` is identity-based.** Only `url`/`protocols` rebuild the
  connection; everything else is applied in place via `configure()`. Crucially
  the rebuild is a **no-op when the identity has not actually changed** — three
  inputs schedule it and any of them can land in the same frame as a `send` or a
  `connect`, and an unconditional rebuild threw that frame's work away. (Found
  by the node-level tests, not by inspection.)
- **A url change while connected reconnects to the new url even with
  `autoConnect` off.** The app said "be connected"; changing *where* is not
  "stop". Silently landing on idle is precisely the invisible failure this node
  exists to prevent.
- **`autoConnect` with no url is silence; an explicit `Connect` with no url is
  an error.** An unconfigured node is not a broken one.

## Lifecycle matrix — what was tested and how

The test environment is `node`: no `WebSocket`, no `EventSource`, no DOM, and
the `ws` package is a *noodl-editor* dependency that must not be pulled into the
runtime. Everything is driven through the injectable seams — a `FakeWebSocket`
that records instances and a `TimerHarness` that never forgets an uncleared
timer. Nothing in either suite waits on real time.

| AIX-005 case | Where |
|---|---|
| navigate away / unmount mid-stream | `websocket.test.ts` "node deletion", `websocket-node.test.ts` "node deletion" (incl. 20 mount/unmount cycles) |
| network drop and recovery | "reconnection" in both suites |
| server closes the connection | "server-initiated close"; clean 1000, fatal 1008, server-error 1011 |
| cancel in flight | "cancellation": mid-connect, mid-backoff, mid-heartbeat |
| rapid open/close cycles | "rapid cycles": 10 back-to-back connects, 25 connect/disconnect alternations, stale-socket events after replacement |
| no leaked handles or timers | `expectNoLeaks()` — asserted against the *whole history*: every socket ever created must be closed with handlers detached, and zero timers pending |

Also covered: FIFO queue flush and exactly-once redelivery across an outage;
duplicate-free behaviour (a message sent before the drop is not resent);
error-then-close from one socket handled once (the undici-vs-browser difference
`byob-realtime.js` hit in RUN-003); a throwing graph callback; a throwing
`close()`; JSON/text/binary in both directions.

## Verification

- `npx tsc --noEmit` in `packages/noodl-runtime` — clean.
- `npx jest` in `packages/noodl-runtime` — **25 suites, 493 tests, all passing**
  (109 of them new here).
- `npm run catalog:check` — up to date. `catalog:merge:check --require-coverage`
  — 138/138 documented. `catalog:examples` — 43/43 validate clean (strict).
- The catalog extractor loads and registers every node for real, so registration
  through `noodl-runtime.js` is proven by the generator run, not just asserted.

## Not verified — be honest about this

- **No live run against a real WebSocket server.** Everything is against a fake
  socket. The protocol surface used is small (`send`, `close`, `binaryType`, the
  four handlers, the close event's `code`/`reason`), but real-browser behaviours
  — how Chrome reports a TLS failure, whether a given server's close code is
  what we assume — are unconfirmed.
- **Never opened in the editor.** No canvas screenshot, no property-panel check
  of the port groups, no confirmation the picker entry reads well.
- **Binary receive is untested against a real socket.** `binaryType =
  'arraybuffer'` is set defensively but only exercised against the fake.
- **Large messages (>1 MB) and high-frequency throughput are untested.** The
  draft's performance checklist ("memory stable over 1000+ messages", "no UI lag
  at high frequency") is not covered by anything here.
- **`latency` is only meaningful with a cooperating server.** Untested live.
- **The cloud runtime lists this node as available** (`availableIn: [browser,
  cloud]`), because it registers through `noodl-runtime.js`'s shared array — the
  same as `REST2`. A cloud function opening a long-lived socket is dubious;
  nobody has decided whether it should be excluded there.

## For the orchestrator

- `packages/noodl-runtime/noodl-runtime.js` — one appended line, union-merge.
- **`packages/noodl-runtime/src/nodelibraryexport.js` was not in the shared
  conventions but had to be touched**: without it the node is invisible in the
  editor's add-node picker (`inNodePicker: false` in the catalog). I appended
  `'net.noodl.WebSocket'` to the existing *External Data* subcategory —
  smallest possible diff, unions cleanly if the SSE agent did the same. Once all
  the AIX-005 transports have landed, a dedicated *Realtime* (or *Agent*)
  subcategory would read better than three nodes wedged in beside HTTP and REST.
- `packages/noodl-types/src/node-catalog*.json` / `.d.ts` are regenerated; a
  conflict there is harmless, just re-run `catalog:generate` and `catalog:merge`.
- The worktree was created 508 commits behind `cline-dev` (the known parallel
  worktree trap) and was hard-reset onto the tip before any work started.
