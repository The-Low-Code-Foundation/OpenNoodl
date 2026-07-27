# Architecture

<!--
  Reasons, contracts and decisions. NOT a node inventory: the graph is the spec,
  and Explain Mode narrates it on demand. If a sentence here would change when
  you drag a node, delete the sentence.
-->

## Page map

Four pages sit behind one router ("Main") in App, with Chat as the start page. Each page carries an
instance of `/Nav`, giving every page a persistent way to reach the other three; navigation is flat rather
than hierarchical — there is no page that is "inside" another.

- **Chat** (`/chat`, start page) — sends a prompt to a streaming endpoint over SSE and appends both the
  user's turn and the completed answer to a shared store. This is the only page that writes to the
  `messages` and `answer` keys; the other pages read them.
- **Tools** (`/tools`) — demonstrates server-driven UI: a second SSE connection delivers actions that an
  Action Dispatcher executes against an explicit allow-list, and a Pattern Extractor pulls structured
  content back out of the `answer` value Chat produced. Tools is a consumer of Chat's output, not an
  independent data source.
- **State** (`/state`) — demonstrates undo/redo, named checkpoints, and optimistic writes against the same
  store, using a `title` key that appears to exist only for this demonstration.
- **Live** (`/live`) — demonstrates a bidirectional WebSocket, buffering of fast message bursts, and
  incremental NDJSON reassembly. It does not appear to depend on Chat or State.

> TODO: confirm whether Tools/State/Live are meant to ship as real product surfaces, or whether this is a
> single-page app (Chat) with three built-in technique demos alongside it. The page titles and on-page
> explanatory copy read like documentation for the platform's own capabilities, not like separate features
> aimed at an end user — but that is an inference from tone, not something the graph can confirm.

## Data model

There is no database in evidence — the shared "shape" here is a single client-side Global Store named
`chat`, not a backend collection. Known keys, inferred from what writes and reads them:

- `messages` — an array, appended to (not replaced) by Chat as each turn completes. Kept as a plain array
  deliberately, per an in-graph comment: a plain array can be deep-copied for undo/checkpoint snapshotting,
  which a by-reference structure could not.
- `answer` — the latest completed assistant response text, written once per stream close by Chat, read by
  Tools' Pattern Extractor.
- `title` — a string used only on the State page to demonstrate undo/redo, checkpoints and optimistic
  updates. It does not appear to represent real application content.

> TODO: confirm there is no persistence layer beyond this in-memory store (the Global Store node has
> `persist: false`) — if this is meant to survive a reload or represent real user data, that's a gap, not a
> feature.

## Backend contracts

No backend source was available to this review, so the following is inferred entirely from the client
graph's expectations and must be confirmed against the actual service(s):

- **Chat completion stream** — an HTTP endpoint accessed via Server-Sent Events, POST method, expecting a
  JSON body built from the user's prompt, and returning token fragments as SSE messages that Chat
  accumulates into a growing string and splits into a finished message on stream close.
- **Agent actions stream** — a second SSE endpoint (`GET http://localhost:4830/agent/actions`) delivering
  discrete action payloads, dispatched through an Action Dispatcher restricted to `SET_STORE`, `MERGE_STORE`,
  and a custom `SHOW_NOTICE` type this graph registers a handler for. Anything else is refused.

  > TODO: confirm what backend serves this endpoint and whether `localhost:4830` is a placeholder for local
  > development or a real dependency.

- **Live WebSocket** — a two-way connection with heartbeat (`ping`/`pong`) and auto-reconnect, expected to
  send and receive both plain messages and NDJSON-framed JSON.

  > TODO: confirm the WebSocket's target URL and what protocol/message contract the real backend implements
  > — this could not be read from the material provided.

None of these three integration points appear to be the same backend necessarily; Tools' action stream and
Live's WebSocket use different transport mechanisms and there's no evidence they share a server.

> TODO: confirm whether Chat, Tools' action stream, and Live's WebSocket are all served by one backend
> service or three separate ones — this materially affects deployment and auth assumptions.

## Decisions

- **Streaming is accumulated client-side, not stored token-by-token.** Chat's Text Accumulator buffers
  fragments and only commits to the store once, on stream close — the store's `messages`/`answer` keys hold
  finished text, not partial state. This keeps undo/checkpoint semantics (which operate on the store)
  meaningful, since they're never asked to snapshot a half-received answer.
- **A plain array, not a keyed map, backs message history**, apparently so that State's undo/redo and
  checkpoint features can deep-copy it faithfully. This is called out explicitly in an in-graph comment on
  the Chat page, so it reads as a deliberate constraint rather than an accident.
- **The action vocabulary a backend may trigger is enumerated in-graph** (`SET_STORE`, `MERGE_STORE`, plus
  one registered custom handler), rather than the dispatcher executing arbitrary server-named actions. This
  is a deliberate security boundary: the Action Dispatcher node's contract is to refuse anything not on the
  list.
- **Undo and checkpoints are independent mechanisms over the same store**: State History tracks a moving
  undo/redo stack, State Snapshot takes named point-in-time checkpoints, and restoring a checkpoint is
  itself an ordinary — and therefore undoable — write. This layering (checkpoint restore composes with undo
  history rather than bypassing it) looks deliberate given the on-page explanatory text, but:

  > TODO: confirm this composability (restoring a checkpoint is itself undoable) is intended behavior and
  > not an incidental consequence of both mechanisms writing through the same store.
