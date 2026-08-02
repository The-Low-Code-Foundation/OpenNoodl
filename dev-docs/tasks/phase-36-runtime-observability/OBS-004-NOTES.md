# OBS-004 — build notes

**Built:** 2026-08-02 · commits `75c10708`, `bc0ed19c`, `0d9e4a05`

Built in the primary checkout **while ERG-001 (phase 35) was live in the same checkout**, as
OBS-002 was. Territory was again disjoint; see [Working alongside phase 35](#working-alongside-phase-35).

**Tier 3 landed before tier 2, and that was a territory decision rather than a change of mind.**
OBS-003's first batch of checks targets `states.ts`, the Repeater family and generic checks in
`node.ts` — all files ERG-001 was actively rewriting, with `Set Variable`, `Array` and `Object` next
on its list. OBS-004 touches none of them. The spec's argument for building tier 2 first is
unaffected and still correct: **an agent is only as good as the tools underneath it**, and
`get_warnings` today returns whatever the existing `sendWarning` call sites happen to emit, which is
thin. OBS-003 is what makes this good.

## What shipped

| Scope item | State |
|---|---|
| 1 — an MCP server that registers on the relay | ✅ `nodegx-observe`, 9 tools, zero runtime dependencies |
| 2 — input injection | ✅ **addressed by node id, not by pixel** — see below. `click` and `set_text` |
| 3 — authentication on the relay | ✅ per-launch token on every `register`; unauthorised peers are neither sent to nor read from |
| 4 — the in-editor AI path | ❌ **not built.** The tools exist and the walk engine is shared; nothing consumes them from inside the editor |

## The corrections this task forced

### ⚠️ "Obscure but open" understated the exposure

The spec called the unauthenticated relay "obscure-but-open" and said documenting it as an
integration point would make it "a real surface". Both readings are too gentle, for one reason
neither the spec nor this session's first pass noticed:

**Browsers do not apply the same-origin policy to WebSockets.** There is no preflight and no
`Access-Control-Allow-Origin` check on a WS handshake. So *any page a user visited* could
`new WebSocket('ws://localhost:8574')`, register as an `editor` peer, and receive the full stream —
the project export, every traced value, every warning — with no prompt and nothing to notice. The
token was overdue, not newly required by OBS-004.

### ⚠️ Node ids are the right address for input, and coordinates are the wrong one

The spec proposed `webContents.sendInputEvent` (preferred) or CDP `Input.dispatchMouseEvent`. Both
address the app by **screen coordinate**, and that is the wrong address for this consumer:
everything else in tier 1 speaks node ids — the walk's rows, the session dictionary, the warnings —
so an agent that has just been told *"`Add To Cart.Click` never fired"* can name the node and has no
idea where it is on screen. Making it screenshot, run vision, guess a coordinate and hope nothing
scrolled is a great deal of machinery to arrive back where it started.

Addressing by node id also deletes a class of flake: no layout dependence, no scroll position, no
device pixel ratio, no window focus. And it settles the "which process" question — `sendInputEvent`
from main would first have to find the preview's `webContents` among all of them by URL, and would
*still* be unable to resolve a node id, because only the viewer process holds the node-to-element
mapping.

**The cost is recorded rather than hidden:** these are DOM events, so `event.isTrusted` is false.
NodeGX's own nodes do not check it; an embedded third-party React component might. CDP remains the
escape hatch and is untouched.

### ⚠️ Discovery must not disturb what it observes

A server attaching to a session already in progress never sees a `nodelibrary` announcement — those
only happen at registration — and every pull on the trace channel needs a viewer's `clientId`,
because the runtime self-filters on it. The obvious fix, `cmd: 'refresh'` to force a fresh
announcement, makes the viewer **reload the page**, which clears the trace buffer the caller
connected to read.

The relay is the only party that knows who is connected, so it now answers `cmd: 'clients'` directly
to the asking socket, with ids and peer types only. Nothing reaches the app.

## Acceptance, honestly

| Criterion | Verdict |
|---|---|
| A user's Claude Code, against a **packaged** NodeGX with no dev flags, can start a trace, click a button, and report where the data stopped | ⚠️ **Verified against a dev build, not a packaged one.** Nothing in the path is dev-gated — the relay, the token file and the injector all ship — but "packaged" is unverified |
| The MCP server needs no access to the project on disk | ✅ by construction; it never reads a path, and the corpus drives it against a fake viewer with no project anywhere |
| …and works on a legacy-format project | ⚠️ **unverified.** It cannot *not* work — it never parses a project — but no legacy project was tried |
| The relay rejects unauthenticated peers once the token lands | ✅ 11 specs over the real relay with real sockets |
| The walk engine is shared with OBS-002, not reimplemented | ✅ imported by relative path and bundled; `walkEngine.ts` now also compiles under `strictNullChecks` |

## The live run

Against the dev editor with the NodeGX QA Fixture open and the preview running. The whole loop,
end to end, driven by the real `RelayClient` — not a harness that reimplements it.

```
token source: ~/Library/Application Support/NodeGX/relay-token
connected to ws://localhost:8574
viewer clients: [ 'e315e62c-…' ]                 ← discovered via the relay, app untouched
topology: 11 nodes, 9 edges                       ← no project access anywhere
click btn -> {"ok":true,"matched":1,"message":"Clicked <button>."}
events captured: 7
  seq=1 cause=0 Button.onClick -> CloudFunction2.call = true
  seq=2 cause=0 Button.onClick -> Counter.increase  = true
  seq=5 cause=4 Counter.currentCount -> Text.text   = 1
```

Four walks, all reading correctly:

| | Result |
|---|---|
| **Cold**, no recording | `? Text.text · now = 1` → `? Counter.currentCount · now = 1` → … — **structural mode, `?` not `✕`, and real current values on a graph that had fired nothing.** Layer 1's whole claim |
| **After a click**, recording | switched to **causal** mode, `✓` chain, `now = 2` — the counter had incremented from the injected click |
| **Root events** | 4 roots: the click, plus the cloud function's async `failure`/`completed` continuations, correctly rooted rather than mis-attributed |
| **A port with no incoming wire** | `✕ CloudFunction2.nonexistentInput · never fired`, correctly named as the stopping point |

And the threat the token exists for, run against the live relay — a page opening the socket with no
token:

```
socket opened (expected — the gate is on register, not the upgrade)
closed: code=4401 reason=unauthorised
received before close: [{"cmd":"registerRejected","reason":"invalid or missing token"}]
PASS — refused, and it learned nothing about the project
```

⚠️ **What was *not* driven live: the editor's own Provenance panel.** `TraceSession` is not
reachable from the renderer's globals and the panel's entry points are canvas right-clicks. Its
change is five lines, typechecked, and the channel underneath it was exercised throughout — but the
panel itself was last driven by OBS-002, not by this session.

## What the live run found

**`explainTerminus` reported a count of failures as a claim about topology.** It rendered
*"Its `done` output has 1 connection"* from `silent.length` — right only when every connection on
those ports happened to be silent, and understating the fan-out the moment one of them fired. Seen
live on a node with a partly-silent output. Rewritten to count silent edges as silent edges
(*"A fired, but 2 of its 3 outgoing connections carried nothing"*), with a spec that pins the
distinguishing case. This is OBS-002 code, and it is the same species as the three defects OBS-002's
own live run found: **a surface stating more than it knew.**

**A seq filter that only moves forward silently discards a whole session.** The first version of
the `TraceSession` de-duplication assumed `seq` was monotonic. It is — within a session. A reloaded
preview builds a fresh `TraceBuffer` numbering from 1, so every event of the new session would have
been dropped, silently, for as long as the panel stayed open. A batch numbered entirely *below* what
is held can only mean the runtime restarted its numbering, and is now treated as a new session.
Found by reasoning about the fix, not by a test.

## What the corpus caught that review did not

**`JSON.stringify` does not escape `<`.** The token is handed to the preview by injecting
`window.__nodegxRelayToken = "…"` into the served HTML, and the first version used `JSON.stringify`
as the escaping — which is the obvious choice and is wrong: a token containing `</script>` closes
the tag from *inside* its own string literal, because the HTML tokenizer runs before the JS parser
ever sees the quotes. Escaped to `<`.

The token is hex today, so this was not exploitable. It mattered because the `NOODL_RELAY_TOKEN`
override lets a harness supply anything, and because **the point of a credential path is that it
stays correct when its input stops looking the way you expected**. The test was written to assert
the property rather than the current format, which is the only reason it fired.

## Two defects found by reasoning about the shared runtime

Neither would have shown up in this task's own tests; both are real today.

1. **`TraceSession` double-counted.** Every reply on the relay is a *broadcast* — the runtime's
   `send()` batches into arrays, which have no `target` field for the relay to route on — so a pull
   this server makes is answered to the editor too, and the reply to a first pull is the whole
   buffer. The editor's Provenance panel would have concatenated it onto what it already held and
   doubled every `fired N×` count. The aggregation exists precisely so one row can say "fired 100×"
   instead of showing 100 rows; silently doubling it is the failure that surface cannot afford.
   Fixed by filtering on `seq`, which is monotonic across the session and does not reset when the
   ring wraps.

2. **An unauthorised peer could provoke a full re-export.** The relay announced `disconnect` for
   *any* socket that closed, including one it had just refused. The editor drops that clientId's
   export cache on `disconnect`, so connect-and-leave in a loop was a cheap way to make the editor
   re-export the whole project repeatedly. Pinned by a spec.

## What this does not do

- **No in-editor AI path.** Scope item 4. The split it describes still holds (in-editor AI reads;
  Claude Code reads *and* acts) and the tools are all there — but nothing inside the editor calls
  them, and `AiChat` is untouched.
- **`get_warnings` has no backlog.** Warnings are pushed when they occur, so it only covers what has
  happened since the server connected. The tool says so rather than implying it has the full set.
- **The visual dead end is real and unaddressed.** If the value reached the node and it still
  rendered nothing, the trace says "data arrived" and the bug is in the DOM. The spec flagged this;
  it remains the one place CDP earns its keep, and the observe server will not find it.
- **`stop_trace` does not tell the editor.** Two consumers share one runtime and one global trace
  switch. Starting a trace here clears the panel's buffer, and neither surface tells the other.
  Documented in the tool descriptions; not solved.
- **Buffer scale is still untested.** Unchanged from OBS-001: 250k events with a 200-char preview
  cap, never run at that size.

## A pre-existing failure found while running the suites, and not fixed here

`packages/noodl-mcp` — **`tools.test.ts › create_component validates, writes and updates the
registry` fails, and did before this task.** It is unrelated to OBS-004 (nothing here touches the
validator, the catalog or the project format) and unrelated to phase 35's catalog rewrites.

The cause, established rather than guessed:

- The untouched fixture validates clean — 0 errors, 10 nodes.
- The component the test creates validates clean at creation — 0 errors, 5 nodes.
- The whole-project validation afterwards reports **3 × `duplicate-node-id`**: the new component
  uses the ids `page`, `layout` and `nav`, and `/Pages/Home` in the fixture already has all three.

So the test fixture reuses node ids across components, and `duplicateNodeId.ts` — added by
`7fd3e053` (SUB-012) — now flags that as an error. Either the rule's severity is wrong for
cross-component reuse, or the fixture needs distinct ids; that is a SUB-012 judgement, not one to
make from here.

Everything else is green: 93 editor jest specs, 753 viewer-react, 121 of 122 noodl-mcp.

## Traps for the next session

- ⚠️ **The relay token changes every editor launch.** Anything holding one across a restart —
  including a browser tab with the preview open — is refused. The preview self-heals by reloading
  **once**; a second failure stops rather than looping, because the browser's HTTP cache could
  otherwise serve the same stale token forever.
- ⚠️ **`web-server.js` drags Electron in through `jsonstorage`,** so nothing in it can be reached
  from plain jest. That is why the relay is now its own module (`relay-server.js`) — the split is
  what makes the token gate testable with real sockets.
- ⚠️ **`http.Server#close()` never fires its callback while a WebSocket is open.** It waits for
  existing connections and a WebSocket never ends on its own. Both new socket suites hang rather
  than fail without terminating the clients first; this cost one 120s timeout to find.
- ⚠️ **`noodl-mcp`'s tsconfig has `strictNullChecks`; the editor's does not.** Pulling an editor
  module into that package compiles it under stricter rules than it was written under.
  `duplicateNodeId.ts` already had one such error before this task — do not attribute it to a new
  import.
- Node 22's global `WebSocket` is why the observe server has no dependencies. `new WebSocket(...)`
  in a `.ts` file under this repo's config resolves to the DOM lib's type, which is correct here and
  would not be under `@types/node`'s.

## Working alongside phase 35

ERG-001 held the same checkout throughout, as it did for OBS-002. Territory was disjoint (OBS-004 is
the relay, the editor's `ViewerConnection`, `noodl-viewer-react`'s new injector and
`packages/noodl-mcp`; ERG-001 is `noodl-runtime/src/nodes/std-library/**` and the catalog).

- **Their editor test run held the single-instance lock for ~15 minutes.** `npm run dev:stop` would
  have killed it — it kills by checkout. The build was sequenced around it: everything that could be
  done without a live editor was done first, and the live verification waited.
- **A clean `git status` still proves nothing.** It was clean at 12:10 and had 18 of their modified
  files by 12:35.
- Every commit here used explicit pathspecs. No `git add -A`, no `git stash`.
