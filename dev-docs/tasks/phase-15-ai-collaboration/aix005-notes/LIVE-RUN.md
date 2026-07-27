# AIX-005 — running the example app, which had never been done

**Date:** 2026-07-27 · **Branch:** `cline-dev` · Editor driven over CDP, app driven in
the preview webview, `mock-agent-server.mjs` on 4830 at a 120 ms token delay.

`LIVE-VERIFICATION.md` closed the editor-side questions: the fifteen nodes are in the
library, the example opens, nothing throws. It was explicit that **the app had never been
run** — no preview, no stream watched arriving. This is that run, and it found two
defects, one of them in the runtime rather than in these nodes.

## What the run found

### 1. `fetch` called with a receiver a browser rejects

First press of **Send**: *Connection* went to `reconnecting`, *Retries* climbed, and
*Last error* read

```
Stream request failed: Failed to execute 'fetch' on 'Window': Illegal invocation
```

`FetchStreamTransport.open` called `this._fetch(url, init)` — a method call on the
transport. A browser's `fetch` brand-checks its receiver and rejects anything that is not
a Window; **Node's is an ordinary function and does not care**. Every one of the 39 specs
in `agent-sse-connection.test.ts` injects `fetchImpl` and calls it the same way, so the
suite could not see it, and neither could `agent-live-endpoint.test.ts`, which drives a
real server *from Node*. The node has never worked in a browser.

Fixed by calling through a local (`sse-connection.ts`), which leaves `this` undefined and
lets the browser resolve the global. The regression guard is a fetch double that
brand-checks its receiver the way a browser does — with the fix reverted it fails, which
was checked rather than assumed.

### 2. A signal and the value beside it come apart when events batch

With the transport fixed, the answer streamed — and then the tail of it arrived as

```
…or stop this mock server mid-answermid-answermid-answermid-answer…
```

with every space missing from the sentence before it. The store held the same corruption,
so it was not a rendering artefact.

The cause is in `node.ts`, not in these nodes. Inputs are queued **per port** and drained
one entry per port per pass. A value input queues one entry per event. `sendSignalOnOutput`
queued **two** — the `true` and the `false` — so a signal advanced through the queue at
half the rate of the value it pairs with. Wire the accumulator the way the docs say
(`SSE.text -> chunk`, `SSE.onMessage -> add`) and three or more frames inside one update
iteration produce: chunk 2 dropped, chunk 3 appended twice. A fast stream batches
constantly; a test that awaits between events never does.

Reproduced deterministically before fixing:

| Frames queued in one iteration | Accumulated | Expected |
|---|---|---|
| `a`,` `,`b`,` `,`c`,` `,`d` | `abcdddd` | `a b c d` |

Fixed by making a signal occupy **one** queue entry — `SIGNAL_PULSE` — expanded to
`true`/`false` back-to-back when it is drained. `OutputProperty.sendPulse` falls back to
the old two-value form for any receiver that does not implement
`_setPulseFromConnection`, so the change is additive.

This is a runtime-wide defect that happened to surface here. **Every** node pairing a
value output with a signal has it: WebSocket (`received` + `onMessage`), the JSON Stream
Parser, and plenty of pre-existing nodes. They are all fixed by the same change.

### 3. The example's Repeater template read its item from the wrong node

The transcript rendered one row per message with **every field blank** — the role showed
the static `"You"` the Text node was authored with, which made it look like a styling
quirk rather than no data at all.

`/Message Row` used a `Component Object` node. `Component Object` is per-component-instance
state (`Model.get('componentState' + instanceId)`); it has no relationship to the repeated
item. A Repeater sets the template's **component inputs** from the item's fields, by name
(`foreach.tsx`, `addItem`). Replaced with a `Component Inputs` node declaring `role` and
`text`, and the static `"You"` cleared so a future breakage is visible rather than
plausible. The README said the wrong thing too, and now says why.

## What was verified after the fixes

All of it on a stack rebuilt from the fixed tree, project opened from the launcher.

| Check | Result |
|---|---|
| Chat streams token by token | Yes, visible progressively in the Text node |
| Final answer vs the server's canned answer | **Byte-identical, 494/494 characters** |
| Transcript | Two turns, `You` / `Agent`, correct text, correct roles |
| *Connection* / *Delivery* | `idle → connecting → open → closed`, `at-least-once-deduped` |
| **Stop** mid-answer | Stream stops at once, partial answer kept (118 chars, unchanged after), server logs `client went away mid-answer` |
| **Kill the server mid-answer** | `reconnecting`, *Retries* climbs 2 → 3 |
| **Restart the server** | Reconnects, sends `Last-Event-ID`; server logs `resuming after event 34`; answer completes with **no duplicated tokens** |
| Tools — action stream | 3 completed, 4 refused; last refusal `DELETE_EVERYTHING` / `unknown`, notice rendered |
| Tools — Pattern Extractor | Pulls the fenced block out of the finished answer, first group `js`, 1 match |
| State — history | `Set title` twice → 3 entries, *Can undo* true |
| State — undo / redo | Reverts to the previous title and back |
| Live — WebSocket | Connects, NDJSON bursts parsed: **71 values, 0 parse errors**, 35 flushes |
| Live — `bye` | Server closes 1001 and the client reconnects; see below |
| Object-typed property row | Renders as a labelled row with an **Edit** popout, exactly like `array` |
| Object literal round-trip | Typed into the popout → `initialState` on the node model → written to `project.json` |
| Port groups and labels | `STORE` group renders with Store Name / Initial State / Persist / Storage Key |
| Renderer exceptions across the whole session | None |

## Still open

- **A WebSocket close that heals leaves no trace.** `bye` gets the promised 1001, but the
  reopen clears `closeCode`, `closeReason` and `retryCount`, so by the time you look there
  is nothing to see. That is deliberate in `websocket-connection.ts` and defensible, but it
  undercuts the page's own claim that "an outage is visible rather than looking like a
  slow server". A retained *last* close code would fix it. The README now describes what
  actually happens; the node is unchanged.
- **The object popout is titled `EXPRESSION`** and prompts `// Enter your JavaScript code
  here` for what is a literal. It saves correctly. Whether an `array` port shows the same
  header was not checked, so this may be shared UI rather than anything new.
- **The transcript row layout is crude** — the role takes half the row's width. Cosmetic,
  in an example people will copy.
- **No real provider.** The OpenAI *shape* is exercised by the mock's `/chat/stream-json`;
  a real endpoint with real auth and real cross-origin is still untried.
- **The editor suite is seed-dependent.** Six runs during this work: four green, two red,
  with *different* specs failing each time (`projectimport` node-count characterization
  once, two `export tests` on a run that did not include any of these changes). Not caused
  by this work — established by running both trees repeatedly — but it means "the suite
  passed" is currently a weaker statement than it looks. Worth its own task.

## Traps worth recording

- **A stale preview webview looks exactly like a broken app.** The preview was blank white
  with `window.Noodl._viewerReact` undefined, on a bundle that had since been rebuilt.
  Neither switching Design/Preview nor clicking about fixes it; `location.reload()` inside
  the webview does. Two things were nearly blamed on AIX-005 before that.
- **`cdp.js` could not see the preview at all.** The in-editor preview is a `webview`
  target, not a `page`, and the target filter took only pages. Fixed here — `--target=viewer`
  now matches the embedded pane or a detached preview window, and the editor's fallback
  never lands on a webview.
- **`window.__nodeGraphEditor` is the way into the canvas.** The previous pass concluded
  node selection was unreachable because the editor instance lives in React state; it is
  also parked on `window` (see `services/HighlightManager/test-highlights.ts`). With it,
  `editor.selectNode(node)` drives the property panel, which is what made the object-typed
  row checkable.
- **`EventDispatcher.instance.emit('projectChangedOnDisk')`** makes the editor reload the
  open project from disk — no relaunch, no launcher round trip. That is what allowed the
  Message Row fix to be edited in the file and verified in the same session.
- **The editor rewrites `project.json` on save**: minified, `rootComponent` dropped
  (`rootNodeId` remains), every dynamic port materialised. The committed example is the
  hand-authored form, so after driving the editor the file has to be regenerated rather
  than committed as saved.
