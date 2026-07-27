# Agentic UI — streaming, shared state, and server-driven actions

Fifteen nodes for building front-ends that talk to AI agents and other
long-lived services: two transports, four stream-shaping utilities, a shared
state store with undo and optimistic writes, and a dispatcher that lets a
server ask the app to do something.

They are transport and state primitives, not an AI integration. No provider is
bundled; you point them at your own endpoint. Everything lives in the **Data**
category of the node picker, under *Streaming*, *App State* and *Agent
Actions*.

A runnable example project — chat, actions, undo and a two-way stream, with a
zero-dependency mock endpoint so no API key is needed — is at
[`project-examples/agent-chat`](../../project-examples/agent-chat/README.md).

## The one thing that shapes all of it

Streaming is easy; *ending* a stream correctly is not. Closing a connection
when the user navigates away mid-answer, reconnecting after a blip without
replaying half the response, cancelling in flight — that is where streaming
implementations fail, and a failure that is invisible is the worst kind for
someone who cannot step through code.

So connection state, retry counts, errors, refusals and delivery semantics are
all **node outputs**. If something is going wrong you can wire it to a Text
node and look at it. Nothing important is only visible in the devtools.

---

## Choosing a transport

| | Server-Sent Events | WebSocket |
|---|---|---|
| Direction | Server → client only | Both ways |
| Under the hood | One HTTP response that stays open | Its own protocol after an HTTP upgrade |
| Sending mid-stream | Not possible — open a new request | `send`, with a queue while disconnected |
| Proxies / corporate networks | Ordinary HTTP; almost always fine | Needs upgrade support; sometimes blocked |
| Reconnection resume | `Last-Event-ID`, if your server sends `id:` | None — a reconnect is a new session |

**Use Server-Sent Events for a streamed answer.** Almost every AI endpoint is a
POST that replies `text/event-stream`, and one request per response is the
right shape: the request carries the prompt, the response carries the tokens,
and the stream ends when the answer does.

**Use WebSocket when the client has to talk back mid-stream** — cancelling a
tool call, answering a server's question, a collaborative cursor, live
telemetry. If you only ever receive, SSE is less to go wrong.

### Server-Sent Events

Two transports, chosen by the `transport` input:

- **`fetch`** (what `auto` picks whenever `fetch` exists, and what you want) —
  can POST, can set an `Authorization` header, delivers every event type
  without declaring it up front, and can tell a clean end of stream apart from
  a dropped connection.
- **`eventsource`** — the browser's own `EventSource`. GET only, no headers, no
  body. Its reconnection is battle-tested, which is the one reason to choose
  it, but it **cannot distinguish a clean stream end from a drop**, so a server
  that closes the stream looks like a reconnect loop.

`connectionState` is the port to watch: `idle → connecting → open → closed`,
with `reconnecting` in between when something went wrong and another attempt is
coming, and `error` when it is terminal and nothing further will happen.

- **`reconnecting`** means we lost it and are working on it. A dropped socket,
  a 5xx, a 408, a 429. `retryCount` says how many attempts have failed;
  `reconnectDelay` doubles up to `maxReconnectDelay`, and a `retry:` field from
  your server overrides the base delay because that is a direct instruction.
- **`error`** means done. A 4xx that is not 408 or 429, a malformed URL, a
  spent `maxRetries` budget, or an environment with no usable API. `lastError`
  says which.

**`reconnectOnStreamEnd` is off by default, against the SSE spec's own
default.** The protocol says a client should reconnect when the server closes
the stream. For an agent answer that is actively harmful: the response
finishes, the client reconnects, the request is re-issued, and the model
generates the whole answer again — for ever. A clean end goes to `closed` and
fires `onClose`. Turn it on only for an endpoint that is genuinely a
never-ending feed. (It only works on the `fetch` transport, for the reason
above.)

**Delivery semantics are reported, not configured.** `deliverySemantics` is
computed from what your server actually sent:

- `at-most-once` — no `id:` fields, so a reconnect cannot resume, so anything
  sent during the gap is lost.
- `at-least-once` — `id:` fields present, so the resume point goes back on
  reconnect and the server may replay.
- `at-least-once-deduped` — `id:` fields present and `dedupeById` on (the
  default), so replays inside a bounded window of recently-seen ids are
  dropped. `duplicatesSuppressed` counts them.

If you need exactly-once, your server has to send `id:` fields; nothing on the
client can invent them.

### WebSocket

Backoff is `reconnectDelay * 2^attempt` capped at `maxReconnectDelay`, with
jitter scaled into 50–100% of the computed delay so a fleet of clients does not
all reconnect in the same instant. `maxRetries` defaults to 10; negative
retries for ever, `0` never retries.

Reconnection fires for **any close the client did not ask for**, except the
protocol and policy failures where the next attempt would fail identically
(close codes 1002, 1003, 1007–1010 and 1015). 1006, 1011–1013 and the whole
application range 4000–4999 are retried. `connectionState` stays
`reconnecting` for the entire outage rather than flickering per attempt;
`retryCount` is how hard it is working. Giving up is never quiet:
`connectionState` goes to `error`, `lastError` names the attempt count, and
`onError` fires.

`closeCode` and `closeReason` carry the server's own explanation, which is
usually the most useful thing it will ever tell you.

**`onReconnect` fires on every open after the first.** A reconnect is a new
session — the node does not and cannot replay what you missed. Treat
`onReconnect` as the cue to re-fetch.

**Sending while disconnected** is governed by `whenDisconnected`:

- **Queue** (default) — FIFO, bounded by `maxQueueSize` (100). When it is full
  the *newest* send is refused rather than the oldest evicted, so the queue
  stays an ordered prefix of what the app tried to say. The queue flushes
  inside the open handler, after `onOpen`, so an auth frame you send from
  `onOpen` goes first and a queued message can never overtake one sent after
  recovery.
- **Drop** — discarded and counted on `droppedCount`. Not an error; you asked
  for it. Still never invisible.
- **Report Error** — counted *and* surfaced on `lastError` + `onError`.

**What can still be lost, stated plainly.** `socket.send()` only buffers. If
the connection dies before the frame leaves the machine, the message is gone,
and the protocol gives no way to learn which one. `connectionState` going to
`reconnecting` is the only hint. An app that cannot tolerate that needs its own
acknowledgements — there is no setting that fixes it.

**Heartbeat is off by default** (`heartbeatInterval: 0`). Browsers cannot send
protocol ping frames, so a heartbeat is *application data injected into your
server's protocol*; most servers will ignore it or close the connection. Turn
it on only when your server expects it, and set `heartbeatMessage` /
`heartbeatReply` to whatever it actually speaks. When it is on, a reply that
never arrives within one interval closes and reconnects the socket — TCP can
hold a half-open connection for minutes, so this is the only way to notice a
dead peer.

### Shaping the stream

Four utilities, all pure — no timers except Stream Buffer's, no transports:

- **Text Accumulator** — the token-to-text node. `text → chunk`,
  `onMessage → add`, delimiter empty, and `accumulated` is the answer as it is
  being written. With a delimiter set it also splits into `messages` /
  `lastMessage`. Capped by `maxLength` / `maxMessages`, with the loss reported
  on `droppedCharacters` / `droppedMessages` and an `overflowed` signal rather
  than dropped quietly. A chunk that is not text (an object, an array) is
  **refused and named on `error`** rather than stringified — see below.
- **JSON Stream Parser** — an incremental scanner, correct at every chunk
  boundary including one that lands inside a string. `ndjson` for
  newline-delimited, `stream` for concatenated objects or a streamed array,
  `single` for one document. `values` holds the complete values; anything
  half-arrived is counted on `pendingCharacters` and stays buffered.
- **Pattern Extractor** — a regular expression over text: `match`, `matches`,
  `groups`, `firstGroup`, `namedGroups`. Note the split between `notFound` (no
  match, a normal outcome) and `failure` + `error` (your pattern does not
  compile, which is a bug to fix).
- **Stream Buffer** — collects items and releases them in batches on
  `flushSize` or `flushInterval`, so a burst repaints once instead of once per
  message. `flushedData` is a detached array, so a later `add` cannot mutate
  what a Repeater is already rendering.

### Which data output to wire — the thing to get right first

The Server-Sent Events node has three data outputs, and the difference between
them is the single most common first-run mistake in this whole family.

| Output | Is | Wire it to |
|---|---|---|
| `text` | **Always a string** | Anything that displays or accumulates text |
| `data` | The payload parsed as JSON when it parses, the string when it does not | Things that want the structure: JSON Stream Parser, Action Dispatcher's `action` |
| `raw` | The payload exactly as sent, never parsed | Debugging, checksums, a parser of your own |

**Use `text` for text.** With `textPath` blank it is the payload as sent, which
is what an endpoint streaming bare tokens gives you. With `textPath` set it is
the field at that dot path inside the parsed payload:

```
textPath: choices.0.delta.content     for an OpenAI-compatible endpoint
textPath: delta.text                  for an Anthropic-style one
textPath:                             (blank) for a stream of bare tokens
```

Anything the path cannot find — the first frame of a real stream announces the
role and carries no content, the last is a `[DONE]` sentinel that is not JSON at
all — reads as the empty string, and an empty chunk is something every consumer
here already ignores. So the sentinel never lands in the middle of your answer.

> **Why this matters.** `data` is JSON-parsed because agent backends mix JSON
> frames and bare text on one stream, so for the commonest shape
> (`data: {"delta":"Hi"}`) `data` is an **object**. Wiring an object into Text
> Accumulator's `chunk` used to render `[object Object]`, once per token, with
> nothing anywhere saying why. It no longer does: a non-text chunk is refused,
> `error` names what arrived and which output to use instead, and the editor
> shows a warning on the node. Nothing is appended, so you get a Text node that
> stays empty and an explanation — not a page full of `[object Object]`.

**The WebSocket node has the same split under different names**, and no path
input: `receivedRaw` is always the frame as text (wire that to an accumulator),
`received` is the frame parsed when it is JSON. A socket carrying JSON envelopes
needs a Function node to pick the field out of `received`.

---

## Shared state

### The Global Store, and how it relates to Variables

A **Variable** is a single value in one app-wide bag. A **store** is a named,
keyed record with change notifications, batching, deletion, snapshots and
optimistic patches. Underneath they are the same machinery: a Variable is one
shared Object (the one keyed `--ndl--global-variables`), and a store named
`chat` is the Object keyed `--ndl--global-store--chat`. Nothing had to be
reinvented, and there is no second state system to keep in step.

Three consequences worth knowing:

- **The store's `storeId` output is that Object's id.** Paste it into a
  Function node — `Noodl.Object.get(storeId)` — and a write made there notifies
  store subscribers exactly as `Set Global Store` does. There is one source of
  truth.
- Writing a value equal to the one already there does **not** notify. That is
  Object's own change semantics, reused.
- A store is **process-global**, like Variables. Two runtimes in one process
  share it.

Use a Variable for one loose value. Use a store when several keys belong
together, when you want one notification for a multi-key change, or when you
want any of undo, checkpoints or optimistic updates — none of which exist for
Variables.

**Global Store** configures a named store: `initialState`, `persist`,
`storageKey`. `initialState` fills in keys the store does *not already have*, on
every mount, and never overwrites a live value — the node holding it may mount
and unmount many times over an app's life, and defaults stomping live state on
remount is a bug nobody can see. A persisted copy is applied after the
defaults and wins over them.

> `initialState` is an object-typed port, so it edits as a **literal in a code
> editor** — click the row and type `{ messages: [], title: 'Untitled' }`. JSON
> works too, since JSON is a subset of what a JS object literal accepts. A
> literal that does not parse leaves a warning on the node rather than silently
> becoming nothing. Wiring a Function node that emits an object still works and
> is the right choice when the starting shape has to be computed. The same is
> true of the SSE node's `headers` and State Snapshot's `snapshotData`.

**Set Global Store** writes one key. `merge` shallow-merges when both the old
and new values are plain objects. `transaction` ("Batch With Others") holds the
notification to the end of the current turn so several Set nodes firing
together produce **one** notification carrying all the keys — it does not
suppress the notification, it coalesces it.

**Subscribe to Store** reads. `keys` is a comma-separated list; blank means the
whole store. One watched key puts that key's bare value on `value`; several put
an object of just those keys; none puts the whole state. `changed` fires only
when a key you are watching actually changed value.

A missing key is not an error — reading an unknown store creates it, empty,
exactly as `Noodl.Object.get` does. There is no "does this store exist"
question to answer first.

Errors are reported, not thrown: a Set node with no `key` puts *"Key is
required"* on `error` and does not fire `completed`; storage that is missing,
persisted state that will not parse, and a value that will not serialise each
land on the store node's `error` output naming the offending keys.

### Undo, redo and checkpoints

**State History** watches a store — the whole thing, or just `trackKeys` — and
records an entry per commit. **Undo / Redo** drives that history, found by store
name; it owns nothing itself. **State Snapshot** is a separate idea: a named
checkpoint you save and restore on purpose.

An undo is an **ordinary store commit**. Everything subscribed sees it as it
would see any other write; nothing has to know time travel exists.

The behaviours that matter in practice:

- **`maxHistory`** (50, floor 2) is a real memory bound, not tidiness — each
  entry pins a deep copy of the state. Trimming drops oldest first and never
  the entry you are currently sitting on.
- **A new write discards the redo stack.** Those futures no longer follow from
  the present.
- **`coalesceMs`** (0, off) folds a change to the same keys arriving within that
  window into the entry on top, so typing is one undo step instead of one per
  keystroke. The window slides, and it deliberately never folds into the entry
  an undo just landed on — otherwise typing after an undo would silently
  destroy the state you had just undone to.
- **Undo at the beginning and redo at the end are no-ops, not errors.** Nothing
  fires; `canUndo` / `canRedo` are how a graph asks in advance. `error` is
  reserved for two genuine mistakes: a `targetIndex` outside the history, and
  driving a store that nothing is tracking (otherwise a wired-looking button
  would silently do nothing).
- **`enabled: false` pauses; it does not delete.** Resuming records a fresh
  entry if the state drifted while paused.
- **Changing `trackKeys` clears the history**, because the existing entries were
  projected onto the old key set.
- Saving a checkpoint does not touch the undo stack. **Restoring one is an
  ordinary write and is therefore itself undoable** — which is exactly what you
  want, since restoring the wrong checkpoint is the mistake undo exists for.

**What time travel cannot restore, and how it tells you.** A snapshot deep-copies
plain objects, plain arrays and Dates. Anything live — an Object, an
Array/Collection, a class instance, a function, or anything reached through a
cycle — is kept **by reference**, so undoing that key puts the *same live object*
back and changes made to it since are not undone. Those keys are named on
`byReferenceKeys`, `fullyRestorable` goes false, each entry in the `history`
output carries `partial` and `byReference`, and the node inspector spells it out
in words. If you want a key to be fully undoable, keep a plain array or object
in it rather than a Collection.

### Optimistic updates

**Optimistic Update** writes the new value into the store the moment the user
acts, keeping what the key held before — including *the fact that it held
nothing*, so a key the update introduced is deleted on rollback rather than left
holding `undefined`.

- `apply` opens an update and puts its id on the `transactionId` output. Carry
  that id through your request and hand it back on the `transactionId` *input*
  so an out-of-order response resolves the right update. Several can be in
  flight; `pendingCount` reports how many. With no id, the **oldest** open
  update resolves.
- `timeout` (30 s; `0` disables) rolls back on its own if no answer arrives,
  firing `rolledBack` and then `timedOut`.
- `errorMessage` is where you wire the server's own explanation, so a rollback
  can say why instead of being generically "failed".
- `onDispose` decides what happens when the node dies with an update still
  open — `rollback` (default) because a value nothing can confirm has no
  business outliving the thing that showed it, or `commit` for a
  fire-and-forget action the user deliberately navigated away from.

**A rollback will not overwrite a newer write.** `value` is the live store key,
not a remembered copy, so the node can tell. If something else wrote that key
after the update was applied, the update is *superseded*: the newer value
stands, the patch is closed, and `error` says the value was left alone. The
transaction still resolves as rolled back — `rolledBack` fires, `isRolledBack`
goes true — so your failure branch still runs. Quietly reverting on top of
somebody else's write destroys data invisibly, which is the failure this whole
family exists to prevent.

Two other things worth knowing: an update can only be committed by the node
that applied it (`transactionId` naming somebody else's update is reported on
`error`), and both a patch apply and a patch rollback look like ordinary commits
to State History, so each records its own history entry.

---

## The Action Dispatcher — letting a server drive the UI

**Read this section before you wire it.** A dispatcher takes a message that
arrived over a stream and causes something to happen in your app. That is a
useful capability and a real risk, and the two cannot be separated.

### What it can and cannot reach

A dispatcher executes exactly two kinds of thing:

1. **A built-in store action you enabled by name.** There are four —
   `SET_STORE`, `MERGE_STORE`, `DELETE_STORE_KEY`, `CLEAR_STORE` — and the
   `builtIns` input is **empty by default**, so out of the box the built-in
   vocabulary is nothing at all. Those that you enable write only to the store
   named on the dispatcher node (a `storeName` inside the message is ignored),
   and only to keys `allowedKeys` permits (blank means any key of that store).
   `CLEAR_STORE` is refused outright whenever `allowedKeys` is non-empty, since
   clearing would remove the keys the allow-list exists to protect.

2. **Whatever you wired downstream of an Action Handler's `trigger`.** This is
   open-ended by design. **A handler wired to a Navigate node means a remote
   server can navigate your app. A handler wired to a delete means a remote
   server can delete.** The capability is granted one action type at a time,
   visibly, by you — but it is granted in full.

A handler's **registration is its permission**. There is no second table of
allowed actions to keep in step with the graph: if the wire is not on the
canvas, the server cannot cause it. Deleting the handler node, or setting its
`enabled` to false, makes the action refused rather than quietly ignored.
Built-in names are reserved unconditionally, so a handler cannot claim one.

Nothing reachable through a message touches the network (there is no `FETCH`
built-in and no way to add one), the DOM, `window`, `eval`, or a function named
in a message. Nothing in a message can change the dispatcher's own
configuration — the rate limit, the queue bound, the allow-list, the timeouts
or the channel.

**This is not a sandbox and is not described as one.** A handler runs whatever
you wired, with full graph privileges. The safety property is different: the
*set* of things a server can trigger is closed, and every member of that set is
a visible wire.

### The risks that remain, and what bounds them

These are inherent to the feature, not defects:

| Risk | Bounded by | Visible on |
|---|---|---|
| A hostile or looping server floods the queue | `maxQueueSize` (100), `rateLimit` (off by default) + `rateLimitWindow` | `queueSize`, `refusedCount` |
| A server repeats an action you *did* register, as often as it likes | `rateLimit`; otherwise nothing — you registered it | `completedCount`, `actionType` |
| A server stalls a flow by sending types nothing handles | `waitForHandler` (2000 ms per unhandled action; `0` refuses at once) | `waitingFor` |

Authorising the *sender* is not attempted here and should not be: the transport
carries the auth, and a token shipped inside a client app is not a secret. If a
message must be trusted, the connection it arrived on is what has to be
trusted.

Set `rateLimit` on any dispatcher fed by a stream you do not control. Keep
`allowedKeys` as narrow as the app can live with. Register a handler for a type
only when you would be comfortable with the server invoking that wiring
whenever it liked.

### Using it

The envelope:

```jsonc
{ "type": "OPEN_SESSION",   // required, non-empty string. This is the whole allow-list check.
  "id": "srv-42",           // optional; otherwise generated, for acking back
  "payload": { }         // optional
}
```

An **array** is accepted as an ordered batch. A **string** is parsed as JSON
first, so a stream's `raw` output works as well as its parsed `data`.

A handler's `payload` output is the action's `payload` if that key is *present*,
else its `data` if present, else the whole action object — presence, not
truthiness, so a payload of `0` or `""` is still a payload.

The **built-in store actions read their own fields the same way**: `key`,
`value`, `values` and `merge` are taken from the envelope if they are there and
from the payload if they are not, so both of these work and mean the same thing:

```jsonc
{ "type": "SET_STORE", "key": "title", "value": "x" }
{ "type": "SET_STORE", "payload": { "key": "title", "value": "x" } }
```

The envelope wins if a field appears in both. `storeName` is deliberately not in
that list — the store a dispatcher writes to is the node's own configuration and
no message may name it, on the envelope or in a payload. `MERGE_STORE` wants
`values` specifically (`{"payload": {"values": {…}}}`); a payload that is itself
a bare key/value map is refused, because a store key called `values` would make
the two indistinguishable and a dispatcher may not guess about which keys a
server gets to write.

Actions execute strictly one at a time in arrival order. Several handlers on one
type run in registration order, and the action completes when the last one does.
`autoComplete` (on by default) completes an action once `trigger` has fired and
everything wired to it has run synchronously; set it false and fire `complete`
or `fail` yourself when a later step must be waited for.

Refusals are first-class. Every refusal fires `refused` with `refusedType`,
`refusalReason` and `refusalMessage` set *before* the signal, and never fires
`dispatched` — a refused action is never announced as having started.

| `refusalReason` | Means |
|---|---|
| `invalid` | Unparseable, not an object, no `type`, or a built-in missing a field it needs. |
| `unknown` | Well-formed, but nothing in this graph handles it (after the wait window). |
| `not-allowed` | Recognised but unauthorised: a disabled built-in, a key outside `allowedKeys`, `CLEAR_STORE` under an allow-list. |
| `rate-limited` | Over `rateLimit` in the window. Refused, not delayed — delaying would silently reorder the server's intent. |
| `queue-full` | Over `maxQueueSize`. The newest is refused so accepted actions keep their order. |

An action whose handler has not mounted yet **parks** at the head of the queue
for up to `waitForHandler` ms rather than being refused on a mount race you
would only see intermittently. While parked, `waitingFor` names the type — and
because ordering is a promise, everything behind it waits too. That is the
trade; it is bounded and it is visible.

`channel` scopes the registry, the way `storeName` scopes a store. Two
dispatchers on one channel share the registry but keep **separate queues**, so
`queueSize` and `isExecuting` always describe the node you are looking at.

Deleting a dispatcher node **discards** its queued actions rather than running
them: the outputs that would have reported them are going away, and running UI
actions into a screen the user has left is worse than dropping them. The
observable version is the `cancel` signal — the queue is dropped,
`cancelledCount` goes up, `cancelled` fires, and the dispatcher stays usable.

---

## Lifecycle, cleanup, and server-side rendering

Every one of these nodes releases what it holds when it is deleted: streams
abort the request and cancel the reader, sockets close with their handlers
detached, timers are cleared, store subscriptions are released, and open
optimistic patches are resolved according to `onDispose`. Navigating away
mid-stream is the tested path, not the hoped-for one.

Under server-side rendering (see [RENDERING-MODES.md](./RENDERING-MODES.md)):

- **Server-Sent Events** and **WebSocket** are `client-only`. A live stream
  cannot be consumed during a server render and would leak one connection per
  request, so the node is created inert and connects in the browser after
  hydration. Do not let a stream's output feed visible *initial* content.
- **Stream Buffer** is `partial` — its flush interval never fires server-side
  (the server clock is frozen); everything else works.
- Everything else is safe.

## Current limits

- **No live-endpoint soak.** The transports have been exercised against a real
  local server — including the OpenAI-shaped `{"choices":[{"delta":{…}}]}`
  envelope and its `[DONE]` sentinel — but not against a production agent
  endpoint, not cross-origin with credentials, and not for long enough to say
  anything about a connection held open for hours.
- **Performance is unmeasured.** Bounds exist and are tested (`maxLength`,
  `maxQueueSize`, `maxHistory`, the dedupe window), so nothing grows without
  limit — but no claim is made about messages larger than a megabyte, hundreds
  of subscribers, or hundreds of updates a second.
- **A store, a history and the action registry are all process-global**, like
  Variables. Consistent, but worth knowing.
- **The SSE `eventsource` transport cannot detect a clean stream end**, so
  `reconnectOnStreamEnd: false` cannot be honoured there.
- **Backoff has no jitter on the SSE node** (the WebSocket node does have it), so
  many clients reconnecting to a restarted server will arrive together.
- **A cloud function can instantiate these nodes**, because they register
  through the shared runtime. A cloud function opening a long-lived socket is a
  dubious idea and nothing prevents it.
