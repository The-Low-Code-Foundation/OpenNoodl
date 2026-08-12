# Phase 59 — the tasks (LGC: the logic seam)

**Created:** 2026-08-09, out of [README.md](README.md) and a test user's first-steps video.

**Every claim about existing code in these files was read in source.** Claims about third-party
plugin behaviour are marked ⚠️ **unverified** and must be confirmed before the task that depends on
them is worked — the phase already caught two wrong premises about our own code, and a plugin we
have never run is a weaker claim than either of them.

## The one-line premise

A test user asked on camera for visual math and visual functions. **We ship both, in one node, and
he found neither.** No math nodes exist to sprawl across the canvas; the Blockly workspace with a
full math palette has been in the product since phase 3.

| Task | File | One line | State |
|---|---|---|---|
| LGC-001 ⭐ | [LGC-001-THE-LOGIC-TRIAD.md](LGC-001-THE-LOGIC-TRIAD.md) | **the flagship** — the picker explains Expression vs Function vs Visual Function, with examples, and answers `multiply` | 🟡 **built 2026-08-12**, live verification deferred (see the task file's *Deferred verification*) |
| LGC-002 | [LGC-002-DO-IT.md](LGC-002-DO-IT.md) | right-click a block, run it, see the value in a balloon — App Inventor's most-loved feature | 📋 open |
| LGC-003 | [LGC-003-VALUES-STAY-ON-SCREEN.md](LGC-003-VALUES-STAY-ON-SCREEN.md) | ambient values during a run, the didn't-execute tell, and the run scrubber | 📋 open |
| LGC-004 | [LGC-004-INTERFACE-RAILS.md](LGC-004-INTERFACE-RAILS.md) | pin the signature to the workspace edges; the props panel edits blocks rather than shadowing them | 📋 open |
| LGC-005 | [LGC-005-TYPES-BECOME-CONNECTIONS.md](LGC-005-TYPES-BECOME-CONNECTIONS.md) | Noodl port types → Blockly connection checks, so wrong connections stop snapping | 📋 open |
| LGC-006 | [LGC-006-PLUGIN-SWEEP.md](LGC-006-PLUGIN-SWEEP.md) | eleven official plugins that cover things we specced by hand, including the a11y themes | 📋 open |
| LGC-007 ⭐ | [LGC-007-MY-BLOCKS.md](LGC-007-MY-BLOCKS.md) | **the second flagship** — save a group of blocks, reuse it in any Visual Function. Mostly two npm packages | 📋 open |
| LGC-008 | [LGC-008-A-PANE-NOT-A-TAKEOVER.md](LGC-008-A-PANE-NOT-A-TAKEOVER.md) | the workspace stops hiding the whole canvas; blocks beside the running app | 🔬 §3 analysed + `svgResize` seam built (2026-08-12) · pane **not** built — §1 needs a ruling (L26/F2), and L28/L29/L30 are open defects to fix first |

## Suggested order, and why

1. **LGC-001 first, alone if necessary.** It is the only task that addresses what the video actually
   showed. Every other task here improves a node that nobody currently finds, so shipping any of
   them before LGC-001 improves something no user reaches. It is also the cheapest.
2. **LGC-006 next** — mostly configuration, and it delivers `disable-top-blocks` (the
   didn't-execute tell, statically, for free) and `toolbox-search` (LGC-001's intercept, inside the
   workspace). It de-scopes parts of three later tasks, so doing it early shrinks them.
3. **LGC-002** — the probe seam, and the pull half of it. Small, and it proves the mechanism that
   LGC-003 then scales up.
4. **LGC-005** alongside — independent, mechanical, and the strongest single beginner affordance in
   the phase.
5. **LGC-007** — promoted above the debugging polish by the scale research: median App Inventor
   project is 54 blocks and the literature names viscosity as the failure mode. This is the
   mitigation, and two npm packages do most of it.
6. **LGC-004** then **LGC-003** then **LGC-008** — real work, real payoff, but all three improve the
   inside of a node the first five tasks are busy making findable and legible.

## Standing constraints

- ⚠️ **The closest study to this plan found the hybrid lost.** IwC 38(1) 2026: pure block-based users
  beat dual-canvas hybrid users on completion, comprehension and usability *while preferring the
  hybrid*. **Minimise boundary crossings** — one entry into blocks for a whole computation, never
  fifteen for fragments. And do not treat the test user's preference as evidence of a performance
  win; it is evidence of a discoverability failure, which is a different thing.
- **`name: 'Logic Builder'` is the type id and is frozen.** It is the string in every saved project,
  in `node-catalog.json`, in the enrichment file and in the docs site. Only `displayNodeName`
  changes (LGC-001 §3). A type-id rename is a migration, and this phase does not do one.
- **The workspace is the single source of truth for ports.** `detectIO` reads the blocks; the editor
  publishes dynamic ports from the *viewer* window, which cannot see editor globals — which is why
  that file lives in `@noodl/runtime` and why the previous implementation was unreachable
  (LEARNINGS-BLOCKLY §1). Nothing in LGC-004 may create a second store.
- ⚠️ **`BlocklyWorkspace` reads `initialWorkspace` once and never reloads from props**, deliberately
  ([`BlocklyWorkspace.tsx:29-38`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/BlocklyWorkspace.tsx)).
  Every decoration in LGC-002/003 must be an imperative SVG overlay. Anything that touches the
  workspace model fires the change listener and serialises value noise into the saved program
  through the 300 ms debounce.
- ⚠️ **Occluded Electron fires zero `ResizeObserver` events** and clamps timers ~1000×. Blockly
  sizes itself via `Blockly.svgResize`. LGC-008's splitter must call it explicitly, and any headless
  verification needs a screenshot to force a frame.
  **Done 2026-08-12 (`83142881`)**: the seam is
  [`blocklyResize.ts`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/blocklyResize.ts)
  — call `resizeBlocklyWorkspaces()` **synchronously** from whatever moved the geometry. Verified
  in `blockly_compressed.js` that `inject`'s single `window` `"resize"` listener is the library's
  only `svgResize` caller, and that nothing in this editor called it: **any** container resize,
  including the existing preview/graph divider, left the workspace at its injected size. The
  registry deliberately does not import `blockly` — it would pull the 1.1 MB lazy chunk into the
  eager bundle for every session.
- **Adopt > build.** Any task that reimplements a `@blockly/*` plugin owes a written reason why the
  plugin was insufficient.
- **Structure > gate > documentation**, inherited from phase 58 and unchanged.

## What is deliberately not here

- **Math nodes.** No task adds arithmetic to the node library. The IwC finding says the boundary is
  the expensive part, so a canvas full of operators is the wrong direction, not merely an untidy one.
- **Renaming the Function node.** Ruled out by Richard. The JavaScript Function node keeps its name
  and its job; only the Blockly node's *display* name is in scope.
- **Blocks ⇄ JavaScript round-trip.** MakeCode's toggle is lovely and we already have the one-way
  half — `generatedCode` is a port on the node, so copy-paste into a Function node works today.
  Blocks-from-JavaScript is a parser, and it is not worth it while nobody can find the node.
- **AI authors the blocks.** Strategically the biggest idea in the originating conversation: a small,
  strictly-validated block vocabulary is a far safer LLM target than freeform graph authoring, which
  is phase 55's entire problem. **It needs LGC-007's definition store first.** Filed, not scheduled.
- **Breakpoints that suspend the running app.** MakeCode has them; they need the runtime to actually
  pause, which is a much larger change than LGC-003's record-and-replay. Out of scope; revisit if
  the scrubber proves insufficient.
