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
| LGC-001 ⭐ | [LGC-001-THE-LOGIC-TRIAD.md](LGC-001-THE-LOGIC-TRIAD.md) | **the flagship** — the picker explains Expression vs Function vs Visual Function, with examples, and answers `multiply` | 🟡 **built 2026-08-12**, live verification deferred (see the task file's *Deferred verification*). ✅ **L7 closed `144f1a0d`** — ruled: rename the sub-category, keep the rail label; `Logic & Utilities`' sub-category is now **`Conditions & Booleans`**. ✅ §5 confirmed on a drive: the rail reads **Logic**. §4's preview column: the **Function** row passes on all three counts (incidental screenshot); Expression and Visual Function unobserved |
| LGC-002 | [LGC-002-DO-IT.md](LGC-002-DO-IT.md) | right-click a block, run it, see the value in a balloon — App Inventor's most-loved feature | 🔨 §1–§4 built; **one line of wiring outstanding**, no drive run |
| LGC-003 | [LGC-003-VALUES-STAY-ON-SCREEN.md](LGC-003-VALUES-STAY-ON-SCREEN.md) | ambient values during a run, the didn't-execute tell, and the run scrubber | 🔨 §1/§3/§5 built 2026-08-12, no drive · 🔴 **§2's static half was built and then REVERTED** — `disableOrphans` disabled every program in the language and emptied `generatedCode` to disk. Ruled 2026-08-12; re-filed against the drawn treatment. §4 filed not built |
| LGC-004 | [LGC-004-INTERFACE-RAILS.md](LGC-004-INTERFACE-RAILS.md) | pin the signature to the workspace edges; the props panel edits blocks rather than shadowing them | 🔨 **§1 + §4 done 2026-08-12** — both rails built, rows derived from a new `detectInterface` projection of `detectIO`'s own traversal, **no second store, proved red**. 72 specs. 🔴 **§2/§3's panel NOT built** (a concurrent session owned `PortsTab/`) — the design is written and it **corrects §2's table in three places**, one of which decides the architecture (**L38**: a panel edit made while the block tab is open is silently destroyed). 🔴 **Nothing was seen in an editor**; 15 steps in `## Deferred verification` |
| LGC-005 | [LGC-005-TYPES-BECOME-CONNECTIONS.md](LGC-005-TYPES-BECOME-CONNECTIONS.md) | Noodl port types → Blockly connection checks, so wrong connections stop snapping | 🔨 §1/§2 built, §3 deferred; live verification not run |
| LGC-006 | [LGC-006-PLUGIN-SWEEP.md](LGC-006-PLUGIN-SWEEP.md) | thirteen official plugins that cover things we specced by hand, including the a11y themes | 🔬 **verdict done 2026-08-12, adoption deferred** — nothing installed or run; every plugin's `latest` peer-deps Blockly 13, so each adoption pins a frozen 12-line release |
| LGC-007 ⭐ | [LGC-007-MY-BLOCKS.md](LGC-007-MY-BLOCKS.md) | **the second flagship** — save a group of blocks, reuse it in any Visual Function | ✅ **§6 RE-DRIVEN 2026-08-12: 3 of 3 pass.** The fix (`3416cf9e`) is confirmed on disk, and the pass is non-vacuous — the same flush wrote the moved block's coordinates while leaving `generatedCode` byte-identical. Both open questions answered: the old write needed **one edit after mount**, not a mere open; and a fixed node regenerates **on its own next edit**, not when the definition changes. Earlier: ✅ **§6 DRIVEN: 2 of 3 pass**, and ✅ **the third FIXED (`3416cf9e`).** The mechanism was **not** the cycle guard: `BlocklyWorkspace` held a `useRef('')` seeded from nothing and never from the node's saved `generatedCode`, so a refusal on the first flush after mount wrote that `""` to disk. Fixed by **deleting the ref** — the node's parameter *is* the last good code (**L11**); `undefined` now travels the seam and the writer skips the parameter. 🔴 **`undefined` ≠ `""`** — `""` is a real program, so a tidy-up that collapses them re-opens the defect. ✅ **§4's sweep is RULED unauthorised** until this is confirmed. 🚧 **engine built, no UI** — format, two shelves, cycle guard, shape inference, inliner, export/import; 66 + 5 specs in a plain-Node runner. 🔴 **No save menu item, no dialog, no backpack.** 🔴 **Resized by LGC-006**: the two npm packages do **not** do most of it |
| LGC-008 | [LGC-008-A-PANE-NOT-A-TAKEOVER.md](LGC-008-A-PANE-NOT-A-TAKEOVER.md) | the workspace stops hiding the whole canvas; blocks beside the running app | ✅ **F2 RULED 2026-08-12: both panes on screen at once — the second splitter gets built.** 🔬 §3 analysed + `svgResize` seam built · pane **not** built. 🔴 The ruling took the expensive branch: **F3** (a hidden canvas measures 0×0 and nothing re-binds) becomes **every drag** and must be built first, and **F4**'s remount trap — `handleWorkspaceChange` writes to the *render's* `activeTab` — becomes a live program-eating bug the moment two workspaces are mounted at once |
| LGC-009 | [LGC-009-A-HAT-FOR-THE-LANGUAGE.md](LGC-009-A-HAT-FOR-THE-LANGUAGE.md) | give block programs a stated beginning — *"when Run is received"* | ✅ **RULED 2026-08-12: the hat is MANDATORY**, so `disableOrphans` becomes correct and **LGC-003 §2 is bought back**. Buildable, not built. The grammar has **9 statement / 6 value / 0 hat** blocks. 🔴 Do **not** re-derive the cost — the migration is **two fixtures, both ours**, not a fleet; that number was wrong once and nearly decided the ruling the other way. 🔴 Open and now urgent: a hat naming a signal is a **second declaration** of a port `noodl_define_signal_input` already declares, landing straight on **L39** (`detectIO` resolves clashes by *document order*). Settle that before writing the generator. One-hat-vs-several is unruled but does not block starting |

## Suggested order, and why

1. **LGC-001 first, alone if necessary.** It is the only task that addresses what the video actually
   showed. Every other task here improves a node that nobody currently finds, so shipping any of
   them before LGC-001 improves something no user reaches. It is also the cheapest.
2. **LGC-006 next** — mostly configuration, and it delivers `toolbox-search` (LGC-001's intercept,
   inside the workspace). ✅ **The verdict half is done**; the install-and-drive half is deferred and
   its steps are written down at the end of that file. 🔴 It **grows LGC-007**.
   🔴 **It no longer delivers the didn't-execute tell.** That read "one line and zero bytes" via
   `Blockly.Events.disableOrphans` in core — which was true about the cost and wrong about the
   semantics: the line disabled every program in the language. Reverted 2026-08-12. The static tell
   is now LGC-003 §2's drawn treatment or LGC-009's hat, and neither is free.
3. **LGC-002** — the probe seam, and the pull half of it. Small, and it proves the mechanism that
   LGC-003 then scales up.
4. **LGC-005** alongside — independent, mechanical, and the strongest single beginner affordance in
   the phase.
5. **LGC-007** — promoted above the debugging polish by the scale research: median App Inventor
   project is 54 blocks and the literature names viscosity as the failure mode. This is the
   mitigation. 🔴 **Re-estimate it before scheduling it**: LGC-006 read both plugins in source and
   they do *not* do most of it — `block-shareable-procedures` shares procedures between live
   workspaces, not block groups across a project, and the backpack is a drawer with no cupboard. It
   is the largest job in the phase.
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
