# Agent Chat — the AIX-005 example project

A runnable NodeGX project that uses all fifteen agentic-UI nodes: a chat that
streams an answer token by token, a page where a server drives the UI through
the Action Dispatcher, undo/redo and optimistic updates over a shared store, and
a two-way WebSocket page.

It ships with a **mock endpoint**, so it runs with no API key and no account.

The concepts are documented in [docs/runtime/AGENTIC-UI.md](../../docs/runtime/AGENTIC-UI.md).
This file is only how to run it.

## Run it

**1. Start the mock endpoint.** From this directory:

```sh
node mock-agent-server.mjs
```

It listens on `http://localhost:4830` with no dependencies. `node
mock-agent-server.mjs 4830 120` slows the token delay to 120 ms, which makes the
streaming easier to watch; the project's URLs assume port 4830.

**2. Open the project.** In the NodeGX launcher choose **Open project** and pick
this folder (`project-examples/agent-chat`). Then press **Run** / open the
preview.

Opening a project writes a project id back into `project.json`, so `git status`
will show this file as modified afterwards. That is normal — discard it when you
are done, or copy the folder somewhere else first if you would rather not touch
the repository.

**3. Try each page.**

| Page | What to do | What to watch |
|---|---|---|
| **Chat** | Type a prompt, press Send | The answer appears a token at a time. *Connection* walks `idle → connecting → open → closed`; *Delivery* says `at-least-once-deduped` because the mock sends `id:` fields. The finished answer joins the transcript, which lives in the store. |
| | Press **Stop** mid-answer | Cancellation: the stream stops immediately and the partial answer is kept. |
| | Stop the mock server mid-answer, then restart it | *Connection* goes to `reconnecting` and *Retries* climbs, then it recovers. This is the failure the state outputs exist for. |
| **Tools** | Press **Start action stream** | Seven action envelopes arrive. Three execute — the title is renamed by the server twice (once with the fields on the envelope, once with them wrapped in `payload`; both are accepted) and a notice appears. Four are refused, each with its own reason: two `not-allowed`, one `invalid`, and one `unknown` that first parks on *Waiting for* while the dispatcher gives a handler time to mount. |
| | Press **Extract** (after sending a prompt on Chat) | Pattern Extractor pulls the fenced code block out of the finished answer, held in the same store. |
| **State** | Type a title, press **Set title**, several times | *History entries* grows. `coalesceMs` is 400 ms, so a burst of typing is one undo step. |
| | Press **Undo** / **Redo** | The title reverts and returns. *Can undo* / *Can redo* tell you in advance. |
| | **Save checkpoint**, change the title, **Restore checkpoint** | Restoring is an ordinary write, so it is itself undoable. |
| | **Apply**, then **Rollback** | An optimistic rename shown immediately and then reverted, with the reason on *Update error*. Apply, then set the title normally, *then* rollback — the newer value stands and the reason says so. |
| **Live** | **Connect**, then **Send** | NDJSON bursts arrive — two JSON objects in one frame — so *Values parsed* runs ahead of *Buffered items*. Send `bye` to make the server close with code 1001 and a reason. |

## What the mock endpoint serves

| Route | Purpose |
|---|---|
| `POST /chat/stream` | `text/event-stream`. A canned answer, one token per event, each with an `id:`, ending the response cleanly. Honours `Last-Event-ID` on a resume. Logs the `Authorization` header it received but does not check it. |
| `POST /chat/stream-json` | The same answer in the OpenAI-compatible shape — `data: {"choices":[{"delta":{"content":"…"}}]}`, ending with a `[DONE]` sentinel. Point the Chat page's stream at this and set the SSE node's **Text Path** to `choices.0.delta.content`; the answer renders identically. This is the shape that renders `[object Object]` if you wire `Data` instead of `Text`. |
| `GET /agent/actions` | `text/event-stream`. Seven action envelopes covering every dispatcher outcome. |
| `ws://localhost:4830/live` | Answers `ping` with `pong`, echoes anything else, closes with 1001 on `bye`, and pushes an NDJSON burst every 400 ms. |
| `GET /` | Plain-text index of the above. |

It sends CORS headers, which is not optional: the preview serves the app from
its own origin, so every request to the mock is cross-origin and the browser
would block the POST at the preflight without them.

The WebSocket half is a hand-rolled RFC 6455 implementation (about 80 lines of
frame codec) because the repository takes no new dependencies and there is no
WebSocket server in Node's standard library. It is adequate for this example and
nothing more. **Do not deploy it** — it authenticates nothing.

## How the graph is put together

Seven components:

- **App** — the page router, plus the `Global Store` node that configures the
  store named `chat` for the whole app. A small Function node supplies
  `initialState`, which is worth keeping here because the shape is documented in
  the script — an object-typed port can also simply be typed into as a literal in
  the property panel. Every page shares this one store.
- **/Nav** — four buttons and four Navigate nodes; included on each page.
- **/#\_\_page\_\_/Chat** — the streaming chat. `Server-Sent Events` **`Text`** →
  `Text Accumulator` `Chunk` → a Text node for the progressive render; a Function
  node builds the request body and headers and then pulses `Connect`; two more
  Function nodes append a turn to the store's `messages` array. `Text` and not
  `Data`: `Data` is JSON-parsed, so it is an object on any endpoint that sends
  JSON deltas, and an accumulator refuses an object rather than appending
  `[object Object]`. The mock's `/chat/stream` sends bare tokens, so **Text Path**
  is left blank here.
- **/Message Row** — the Repeater template. A `Component Object` node exposes
  each message's `role` and `text`.
- **/#\_\_page\_\_/Tools** — `Action Dispatcher` + one `Action Handler`, fed by a
  second stream, with every refusal output on screen; plus `Pattern Extractor`
  reading the finished answer out of the store.
- **/#\_\_page\_\_/State** — `State History`, `Undo / Redo`, `State Snapshot` and
  `Optimistic Update`, all over the store's `title` key.
- **/#\_\_page\_\_/Live** — `WebSocket` → `Stream Buffer` and `JSON Stream
  Parser`.

Two things about the graph worth copying:

**`messages` is a plain JavaScript array, not a Noodl Array (Collection).** A
snapshot deep-copies a plain array, so undo can restore the transcript
completely; a Collection would be kept by reference and only partly
restorable. The Repeater accepts a plain array of objects with `id` fields.

**Function nodes that produce a signal have their `Run` input connected.** A
Function node with no connection on `Run` re-runs whenever any input changes —
which for the request builder would mean firing off a request on every
keystroke. Connecting `Run` is what makes it fire only when asked.

## Safety note on the Tools page

The `Action Dispatcher` there enables two built-ins by name and restricts them
to one store key. Its `Action Handler` only sets a Text node, so the worst a
hostile server can do through this graph is write that key and show a notice.

That is a property of *this wiring*, not of the node. Wiring a handler to a
Navigate node would let a remote server navigate the app; wiring one to a delete
would let it delete. The dispatcher does not sandbox a handler — it only closes
and makes visible the set of things a server can ask for. See the Action
Dispatcher section of
[docs/runtime/AGENTIC-UI.md](../../docs/runtime/AGENTIC-UI.md) before wiring one
against a stream you do not control.
