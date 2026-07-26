# AIX-005 — the example project and the user documentation (as built)

Closes the last two items of AIX-005's scope: *"Example project demonstrating an
agent chat UI end to end"* and user-facing documentation for the fifteen nodes
AGENT-001…007 shipped. Written after all six as-built notes in this directory;
where a phase-3.5 spec and a notes file disagreed, the notes won.

This is the first time all fifteen nodes have been used as one system, and the
first time any of them has spoken to a real server. §5 and §6 are the parts
worth reading if you are short of time.

Base: `cline-dev` @ `75b5289`. The worktree was created **545 commits behind**
(at `360cdc4`) and was `git reset --hard cline-dev` before any work — the same
trap every AIX-005 worktree has hit.

---

## 1. What shipped

| File | What it is |
|---|---|
| `project-examples/agent-chat/project.json` | The example project. 7 components, 262 nodes, 111 connections, 4 pages. |
| `project-examples/agent-chat/mock-agent-server.mjs` | The mock endpoint: SSE chat stream, SSE action stream, WebSocket. Zero dependencies. |
| `project-examples/agent-chat/README.md` | How to run it, page by page, and how the graph is put together. |
| `docs/runtime/AGENTIC-UI.md` | The user documentation. |
| `packages/noodl-runtime/test/agent-live-endpoint.test.ts` | 5 opt-in specs that drive the real nodes against the real mock server. |
| `docs/node-catalog/examples/agent-state-undo-redo.json` | Catalog example — the four state nodes had none. |
| `docs/node-catalog/examples/agent-optimistic-rename.json` | Catalog example — Optimistic Update had none. |

No node source was touched. `packages/noodl-runtime/package.json` untouched, zero
new dependencies. `packages/noodl-types/src/node-catalog-enriched.json` is
regenerated (the two new examples), never hand-edited; `node-catalog.json` is
unchanged, which is the check that no node definition moved.

---

## 2. Where the example lives, and why there

**`project-examples/agent-chat/`, as a plain project directory opened with
*Open project*.**

The alternative was the embedded-template system
(`packages/noodl-editor/src/editor/src/models/template/`), which is the right
home for a *starter*: a `ProjectTemplate` object in `templates/`, registered in
`EmbeddedTemplateProvider`'s map, instantiated as `embedded://<id>`. It is
better-engineered than the file-based path it replaced and it resolves
`rootComponent` → `rootNodeId` correctly. It was rejected for two reasons, both
verified by reading the code rather than assumed:

1. **Nothing in the launcher can reach a second embedded template.** The only
   template picker is `ProjectCreationWizard` (in `noodl-core-ui`), and it offers
   *style presets*, not project templates — `ProjectsPage.tsx:407` calls
   `newProject` with `projectTemplate: ''` unconditionally. Registering a
   template would produce an artifact nobody can select: exactly the
   `inNodePicker: false` mistake three AIX-005 agents already made and had to
   have fixed for them.
2. **`embedded://` does not survive `LocalProjectsModel.newProject` anyway.** A
   non-empty `projectTemplate` goes through `TemplateRegistry.download`, which
   treats the provider's output as a **zip** and calls `filesystem.unzipUrl` on
   it (`template-registry.ts:46-66`). `EmbeddedTemplateProvider.download` writes
   a *directory* containing `project.json`. The only working embedded path is
   `newProject`'s `else` branch, which is hard-coded to `embedded://hello-world`.
   So making a second template usable means editing the launcher **and** the
   creation flow — launcher UI is UIX territory and another session was live in
   the editor.

*Open project* needs neither: the launcher's own `handleOpenProject` takes any
folder containing a `project.json`. `project-examples/` already exists at the
repo root as the home for example projects, and the legacy
`local-template-provider.ts` still points into it.

**If someone later adds a template picker to the launcher**, this project is
straightforward to promote: the content is a plain `ProjectContent`, so it
transliterates into a `*.template.ts` almost verbatim — but do the two edits in
§2.2 at the same time, or it will be invisible.

### The Home-component trap, handled

`ProjectModel.fromJSON` (`projectmodel.ts:198-205`) resolves the root by
`rootNodeId` *first*, by id lookup, and only falls back to the `rootComponent`
name via `setRootComponent()` — which no-ops when the NodeLibrary has not loaded
the root node's type. This project therefore carries **both**: `rootComponent:
"App"` and a concrete `rootNodeId` pointing at App's `Router` node, asserted to
be `App.graph.roots[0].id`. The Router is `name: "Main"` with the
`{ startPage, routes }` shape, every route resolves to a real component, and each
page component has exactly **one** `Page` root — the three things the
`EmbeddedTemplate.test.ts` specs learned the hard way.

---

## 3. The project

`chat` is the one store, configured once by a `Global Store` node in **App**, so
all four pages share it. Keys: `messages` (array of `{id, role, text}`), `answer`
(the last completed answer), `title`.

| Component | Contains |
|---|---|
| `App` | `Router` (Main) + `Global Store` + a Function node supplying `initialState` |
| `/Nav` | 4 buttons → 4 `RouterNavigate` nodes; included on every page |
| `/#__page__/Chat` | `SSE` → `Text Accumulator` → Text; Function nodes for the request and for appending turns; `Set Global Store` ×3; `Subscribe to Store`; `For Each` over `messages` |
| `/Message Row` | the Repeater template; `Component Object` with `role,text` |
| `/#__page__/Tools` | `Action Dispatcher` + one `Action Handler` fed by a second `SSE`; every refusal output on screen; `Pattern Extractor` over the store's `answer` |
| `/#__page__/State` | `State History`, `Undo / Redo`, `State Snapshot`, `Optimistic Update`, all over `title` |
| `/#__page__/Live` | `WebSocket` → `Stream Buffer` and `JSON Stream Parser` |

All fifteen node types appear. Two graph decisions worth keeping:

- **`messages` is a plain JS array, not a Collection.** A snapshot deep-copies a
  plain array, so undo restores the transcript completely; a Collection is kept
  by reference and lands on `byReferenceKeys`. The Repeater accepts a plain array
  (`foreach.tsx` documents `items` as "may be a plain array"; `Collection.set`
  wraps each item with `Model.create`, which is why the items need `id` fields).
- **Every Function node that emits a signal has `Run` connected.** A Function
  node re-runs on any input change *unless* `run` is connected
  (`simplejavascript.js:88`). With `Run` free, the request builder would fire a
  request per keystroke.

### How it was authored, and how to change it

The JSON was generated once by a throwaway script, then verified; the file is now
the source of truth and should be edited **in the editor**. The one thing the
generator did that is not reproducible by hand is the `dynamicports` arrays for
the four Function nodes and the `Component Object`: those were produced by calling
the runtime's own `JavascriptNodeParser.parseAndAddPortsFromScript(script, ports,
{ inputPrefix: 'in-', outputPrefix: 'out-' })`, which is exactly what the editor
calls, so the persisted port names cannot differ from the ones it will compute on
load. (Two notes if you ever repeat this: `./utils` next to the parser is
TypeScript and has to be stubbed to require the parser from plain node; and the
parser does **not** strip comments, so `Inputs.Foo` inside a comment creates a
port.)

---

## 4. The mock endpoint

`node project-examples/agent-chat/mock-agent-server.mjs` → port 4830, which is
what the project's URLs use. `[port] [tokenDelayMs]`; 120 ms makes the streaming
easier to watch.

- `POST /chat/stream` — a canned answer, one token per event, each with an `id:`,
  ending the response **cleanly** (so `reconnectOnStreamEnd: false` is
  exercised). Honours `Last-Event-ID`. Logs the `Authorization` header without
  checking it. The answer contains a fenced code block so the Tools page's
  Pattern Extractor has something real to find.
- `GET /agent/actions` — six envelopes chosen to produce every dispatcher
  outcome: two execute, and one each of `not-allowed` (key outside
  `allowedKeys`), `not-allowed` (`CLEAR_STORE` under an allow-list), `invalid`
  (no `type`), and `unknown` (parks on `waitingFor` first).
- `ws://…/live` — `ping`→`pong`, echo, `bye`→ a 1001 close carrying a reason, and
  an NDJSON burst (two JSON objects in **one** frame) every 400 ms.

Three implementation notes:

- **CORS is load-bearing, not decoration.** The preview serves the app from its
  own origin, so every request is cross-origin and a POST carrying
  `Authorization` + `Content-Type: application/json` triggers a preflight. The
  same trap RUN-002 recorded for its mock backend.
- **The WebSocket half is a hand-rolled RFC 6455 codec** (~80 lines: SHA-1
  handshake, frame encode, masked frame decode, continuation joining, ping/pong,
  close). No new dependency was permitted and `ws` is a *noodl-editor*
  dependency that must not be pulled into a runtime example.
- **A close frame must echo the client's status code and reason.** Echoing an
  empty close frame makes the browser report **1005 "no status"**, which would
  make the WebSocket node's `closeCode` output useless for every clean close.
  Found by looking at the output of the first live run, not by reading the RFC.

A token containing newlines is emitted as several `data:` lines, which the
receiver rejoins with `\n` — that is the only way a line break survives a wire
format whose field separator *is* the line break. Verified end to end: the
accumulated answer contains its blank lines and its code fence.

---

## 5. The live run — what a real endpoint proved

Every previous AIX-005 suite injects a double for the transport, and all six
notes files list *"no live run against a real endpoint"* as their largest gap.
`packages/noodl-runtime/test/agent-live-endpoint.test.ts` closes it, and it is
**committed and repeatable**:

```sh
node project-examples/agent-chat/mock-agent-server.mjs 4831 5
cd packages/noodl-runtime
NODEGX_AGENT_LIVE=http://localhost:4831 npx jest test/agent-live-endpoint --forceExit
```

It is `describe.skip` without `NODEGX_AGENT_LIVE`, so it contributes 5 *skipped*
specs and the package baseline stays at **891 passing**. `--forceExit` is needed
because Node's global fetch keeps its connection pool alive after the last
request — it is not masking a leak in the nodes; each node's `_onNodeDeleted` is
called and the cancellation spec asserts nothing further arrives.

Results, all green, first time the code paths have ever run:

| Case | Observed |
|---|---|
| SSE `fetch` transport, real streamed POST with an `Authorization` header | 169 events, `connectionState` `open → closed`, `lastEventId` 169, `retryCount` 0, `lastError` empty, `onOpen`/`onMessage`/`onClose` fired |
| Delivery semantics computed from what the server sent | `at-least-once-deduped`, `duplicatesSuppressed` 0 |
| Text Accumulator over a real token stream | 486 characters, newlines and the code fence intact |
| A 404 | terminal `error`, `lastError` = *"The stream endpoint returned HTTP 404"*, `onError` + `onClose` |
| Cancel mid-stream | `messageCount` frozen at the cancel point, state `closed`, nothing further delivered |
| Action Dispatcher fed by a real stream | `completedCount` 2, `refusedCount` 4, and the four refusals were exactly `not-allowed:SET_STORE`, `not-allowed:CLEAR_STORE`, `invalid:`, `unknown:DELETE_EVERYTHING`; the store's `title` was written, `messages` was **not** created |
| Action Handler | triggered once, payload `"This notice was sent by the server."` |
| WebSocket against a real socket | handshake, `onOpen`/`onMessage`/`onMessageSent`, `retryCount` 0, no dropped sends |
| JSON Stream Parser over batched frames | 8 values from 6 frames, `errorCount` 0, `pendingCharacters` 0 — real boundary work, since a burst frame is not itself valid JSON |
| Stream Buffer | 3 flushes, batch sizes `[2, 1, 1]` — the 250 ms interval beating `flushSize: 4`, which is correct |
| Server-initiated close | `closeCode` 1001, `closeReason` *"the mock said goodbye"* |

**Two traps for anyone driving these nodes from a test.** Both cost a full run:

1. **An unconnected output's cached `.value` is not what the graph sees.** Polling
   `getOutput('data').value` in a loop got one space out of 169 tokens. Drive
   downstream nodes from the upstream node's own `sendSignalOnOutput` — that is
   what a connection does.
2. **Signal inputs are edge-triggered.** `setInputValue(name, true)` twice in a
   row fires **once**. The existing suites have a `pulse()` helper that resets the
   edge first; use it.

---

## 6. Problems found while wiring all fifteen together

Nothing here is a defect in any one agent's work; they are the seams that only
show up when the family is used as a system. Ordered by how likely each is to
cost a user an afternoon.

### 6.1 `SSE.data` → `TextAccumulator.chunk` silently shows `[object Object]` for the commonest endpoint shape

`SSE.data` runs every payload through `parseJsonOrText`, which is right — agent
backends mix JSON frames and bare text (`data: [DONE]`) on one stream. But the
**OpenAI-compatible shape is `data: {"delta":"Hi"}`**, so `data` is an *object*,
and the wiring both the enrichment and the catalog example recommend
(`data → chunk`) renders `[object Object]`: `chunk`'s setter does
`String(value)`, deliberately, so nothing looks broken.

This is the single most likely first-run failure for the pair. There is no code
change here; it is documented prominently in `AGENTIC-UI.md` (use `raw`, or take
the field out of `data` with a Function node). **Worth considering:** a `text`
output on the SSE node that is always the unparsed data field would remove the
trap entirely, and is ~5 lines.

### 6.2 Three object-typed inputs cannot be given a value in the property panel

`net.noodl.GlobalStore.initialState`, `net.noodl.SSE.headers` and
`net.noodl.StateSnapshot.snapshotData` are all `type: 'object'`. The property
editor's `viewClassForPort` has no branch for `object`
(`propertyeditor/DataTypes/Ports.ts:389-417`), so it returns `undefined` and
`_getPorts` **filters the row out**. The port is connection-only, with no
indication why.

Consequence for an author: the very first thing you do with a `Global Store` node
— give it a starting shape — requires wiring a Function node whose whole body is
`Outputs.State = { … };`. The example does exactly that, and the docs say so, but
it is a poor first five minutes.

The cheap fix is `type: 'array'`, which maps to `CodeEditorType` (a JSON editor)
and would give all three a real editor. The correct fix is an `object` branch in
`Ports.ts`. Either is outside this task's territory; flagging it as the highest-
value small improvement to this node family.

### 6.3 The built-in store actions read their fields off the envelope, not out of `payload`

`SET_STORE` and `DELETE_STORE_KEY` read `action.key` / `action.value`;
`MERGE_STORE` reads `action.values` (`action-dispatcher.ts:722-748`). A handler's
`payload` output, by contrast, resolves `payload` → `data` → the whole object. So
`{"type":"SET_STORE","payload":{"key":"title","value":"x"}}` — the obvious guess,
and what a server author will send — is refused as `invalid`. The refusal message
is good (*"SET_STORE requires a non-empty string key"*), but the asymmetry is not
documented anywhere except the source. Now in `AGENTIC-UI.md`.

### 6.4 `refusedType` is the empty string for a malformed action

Correct — an action with no `type` has no type to report — but a graph wiring
`refusedType` to a Text node shows a blank box for the `invalid` case. Wire
`refusalReason` and `refusalMessage` too; the example does. Not a bug, just a
thing to know before you build a refusal panel.

### 6.5 A duplicate node id passes both project validators

While building the project I gave two different nodes the same generated id. The
graph is malformed — a connection resolves to whichever node the id lookup finds
— and **neither `scripts/node-catalog/validate-project.js` nor the SUB-006
`SemanticValidator` in strict mode reported anything**: both build a
`Map<id, node>` and the second node silently displaces the first, after which
every connection still resolves.

Found by an ad-hoc uniqueness check, not by a gate. A `nodes[].id` uniqueness
rule is a few lines in either place and would catch a whole class of
hand-authored / AI-authored / merge-damaged project. Recommending it as a
follow-up; not done here because both are shared files with concurrent sessions
against them.

### 6.6 Repeater items become process-global Models that are never freed

`Collection.set` calls `Model.create(item)`, which is `Model.get(item.id)` —
Models live in a process-wide registry keyed by id and nothing removes them. A
long chat whose messages carry fresh ids therefore accumulates one Model per
message for the life of the page. Bounded in practice by the conversation length,
and consistent with how Noodl has always worked, but it is worth knowing that
`maxMessages` on the accumulator does not bound *this*.

### 6.7 Reconciliations that were *not* needed

Stated because "we checked" is more useful than silence:

- The store-backed nodes compose as documented. `Optimistic Update`'s patches,
  `State History`'s snapshots and `Action Dispatcher`'s built-ins all went
  through one store with no interference, and the live run's dispatcher test
  wrote through a real `Global Store` node.
- AGENT-006 §2's prediction ("a patch apply and a patch rollback each record
  their own history entry") is consistent with everything observed; it is still
  not *asserted* anywhere, and it is the one cross-agent claim left untested.
- The port-naming convention really does hold: `connectionState` / `connected` /
  `lastError` / `retryCount` / `onOpen` / `onMessage` / `onError` / `onClose`
  read identically on the SSE and WebSocket nodes, and swapping one for the other
  in the example was a URL change and nothing else.

---

## 7. Verification

- `npx jest` in `packages/noodl-runtime` — **33 suites, 891 passed, 5 skipped**
  (the opt-in live suite). Baseline held exactly.
- `NODEGX_AGENT_LIVE=… npx jest test/agent-live-endpoint --forceExit` — **5/5
  passing** against the running mock server. §5.
- `npx tsc --noEmit` in `packages/noodl-runtime` — clean.
- `npm run catalog:generate` — 154 node types, unchanged. `catalog:check` — the
  committed catalog is up to date.
- `npm run catalog:merge` — **154/154 documented**, 49 examples.
- `npm run catalog:examples` — **49/49 validate clean** (strict,
  warnings-as-errors), including the two new ones.
- `npm run catalog:validate -- project-examples/agent-chat` — 262 nodes, 222
  connection endpoints checked, 15 resolved as dynamic ports, **0 failures**.
- The SUB-006 `SemanticValidator` run over the project in **strict** mode —
  **0 errors, 0 warnings** across all 262 nodes. (Via a throwaway script that
  called `fromLegacyProject` + `SemanticValidator`; deleted, because a committed
  script for it belongs to whoever owns that validator's CLI.)
- The mock server was run and exercised by hand as well: `curl` against both SSE
  routes, and a Node `WebSocket` client for the socket.

---

## 8. What is **not** verified

Be sceptical of anything in this section.

1. **The project has never been opened in the editor.** No canvas, no property
   panel, no preview, no screenshot. Another session held the editor for the
   whole of this work, and it is not worth corrupting somebody else's session to
   look at a layout. Everything asserted about the project is asserted by the
   catalog validator, the SUB-006 semantic validator and structural checks on the
   JSON — which between them cover node types, every connection endpoint, port
   compatibility, one `Page` per page component, resolvable routes, unique ids and
   a concrete `rootNodeId`. **What they cannot tell you is whether it looks
   right.** Expect the visual layout to need a pass: paddings and gaps were
   written blind, the four pages have never been seen, and a Repeater's rendering
   inside a plain Group has not been eyeballed.
2. **The runtime has never executed the *project*.** The nodes were driven live
   against the mock server, but through a test harness, not through the viewer.
   In particular the Function-node scripts, the `For Each` → `/Message Row`
   binding and the `Component Object` ports have only been validated statically.
3. **No preview/export run**, so nothing is known about how the persisted
   `dynamicports` behave through a real export, or about the SSR classification
   in practice (the two transports are `client-only`; the project has never been
   server-rendered).
4. **Not run against a real agent endpoint.** The mock speaks plain-text tokens.
   An OpenAI-compatible endpoint sends JSON deltas, which is §6.1 — the very trap
   that has not been exercised against a real provider.
5. **No cross-origin-with-credentials run.** `withCredentials` is still untested
   against a real server, as AGENT-001 recorded.
6. **Nothing about performance.** The live run was seconds long, with one client,
   169 events and 39 frames.
7. **The mock's WebSocket implementation is minimal.** It has been exercised by
   Node's `WebSocket` and by the runtime's node through Node's `WebSocket`; a
   browser's implementation may differ (fragmentation, extension negotiation,
   permessage-deflate). No browser has connected to it.
8. **The two new catalog examples are validated, not run** — the same caveat every
   catalog example carries.
