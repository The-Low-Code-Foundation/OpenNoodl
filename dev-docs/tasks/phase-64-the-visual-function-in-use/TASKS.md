# Phase 64 — the tasks (VFN: the visual function in use)

**Created:** 2026-08-13, out of [README.md](README.md) and eleven reports from one session of
building with the floating Logic Builder.

> **Status, 2026-08-13** — tier 1 (VFN-001, 002, 003) is **built and merged in `0067304d`**, and
> **none of it is driven**. Start at [NEXT-SESSION-2026-08-13.md](NEXT-SESSION-2026-08-13.md): its
> first item is one drive session that closes tier 1's owed criteria *and* answers VFN-005's and
> VFN-007's reproduce-first steps, which are acceptance criterion 1 of each.

**Every claim about existing code in these files was read in source**, and every claim that was
*not* pinned says so and carries a reproduce-first instruction. Six of the eleven reports have a
mechanism; two do not; three are design work.

| Task | File | One line | Report | Tier | State |
|---|---|---|---|---|---|
| VFN-001 ⭐ | [VFN-001-ONE-DELETE-STILL-MEANS-TWO.md](VFN-001-ONE-DELETE-STILL-MEANS-TWO.md) | the focus guard reads `activeElement` *after* Blockly removed the focused block | 2 | **1 — ship-blocking** | 🔨 **BUILT 2026-08-13, not driven.** 🔴 **The task's own fix sketch was insufficient and the spec caught it (VFN-001b):** a detached element has no ancestors, so `path[0].closest('[data-keyboard-scope]')` is `null` on the very block that was removed — the resolver walks the captured composed path and takes the first element still `isConnected`. 13 specs (6 jasmine + 7 jest), including a negative control taken at the same instant on the same event. Also made correct: closing tabs is one transition, because a batched loop of `closeTab` never emits `AllTabsClosed` |
| VFN-002 | [VFN-002-THE-FIELD-YOU-CANNOT-READ.md](VFN-002-THE-FIELD-YOU-CANNOT-READ.md) | our own `padding` takes 18 px out of a box Blockly sized to fit the text exactly | 3 | **1 — ship-blocking** | 🔨 **BUILT 2026-08-13, not measured live.** Border and padding gone, ring is a `box-shadow`, `font-family` override deleted — ✅ and the font half is *confirmed in source*: `WidgetDiv.show` copies the renderer and theme class names onto the widget div so Blockly's own `FIELD_TEXT_FONTFAMILY` rule reaches the input, which is why no theme change was needed. 6 tests parse the stylesheet, with a negative control over the pre-fix rule. 🔴 `scrollWidth > clientWidth` on a live field still owed |
| VFN-003 | [VFN-003-THE-DIALOG-ELECTRON-DOES-NOT-HAVE.md](VFN-003-THE-DIALOG-ELECTRON-DOES-NOT-HAVE.md) | Blockly asks for a name with `window.prompt`, which Electron does not implement | 4 | **1 — ship-blocking** | 🔨 **BUILT 2026-08-13, not driven.** All three registered (`setPrompt`/`setConfirm`/`setAlert`), contract split into a React-free module so it is assertable — 10 specs, including the whole prompt → taken → alert → re-prompt gesture. 🔴 **Registered from `BlocklyWorkspace`, NOT `initBlocklyIntegration()`** — the latter is reachable from the plain-Node runner and a `@noodl-core-ui` import in its graph broke two suites *to run*. ✅ Ephemeral focus handled. 🔴 The failure is *silence*; a spec cannot see silence |
| VFN-004 | [VFN-004-THE-WINDOW-SAYS-WHERE-IT-BELONGS.md](VFN-004-THE-WINDOW-SAYS-WHERE-IT-BELONGS.md) | the tab names the component, and clicking it takes you back to the node | 1A | 2 | 📋 open |
| VFN-005 | [VFN-005-THE-APP-IS-BEHIND-THE-WINDOW.md](VFN-005-THE-APP-IS-BEHIND-THE-WINDOW.md) | 82% of the viewport, centred, is on top of the running app — park it, snap it, or place it better | 1B | 2 | 📋 open |
| VFN-006 | [VFN-006-SHOW-ME-WHAT-I-AM-SAVING.md](VFN-006-SHOW-ME-WHAT-I-AM-SAVING.md) | "5 blocks" becomes *those* five blocks, outlined on the workspace | 5 | 2 | 📋 open |
| VFN-007 | [VFN-007-THE-SHELF-THAT-DOES-NOT-SAY-WHICH.md](VFN-007-THE-SHELF-THAT-DOES-NOT-SAY-WHICH.md) | the backpack radio takes the choice and does not show it — reproduce, then replace the control | 6 | 3 | 📋 open |
| VFN-008 ⭐ | [VFN-008-A-SAVED-BLOCK-THAT-DESCRIBES-ITSELF.md](VFN-008-A-SAVED-BLOCK-THAT-DESCRIBES-ITSELF.md) | a description that is asked for, stored, and shown everywhere the block appears | 7 | 2 | 📋 open |
| VFN-009 ⭐ | [VFN-009-THE-LIBRARY-IN-THE-PROJECT.md](VFN-009-THE-LIBRARY-IN-THE-PROJECT.md) | open, rename, delete and **edit** a saved block, with a warning that names every call site | 8, 9 | 2 | 📋 open |
| VFN-010 | [VFN-010-THE-BACKPACK-IN-THE-LAUNCHER.md](VFN-010-THE-BACKPACK-IN-THE-LAUNCHER.md) | backpack blocks are marked in the picker and managed from the launcher | 8 | 3 | 📋 open |
| VFN-011 ⭐ | [VFN-011-THE-BENCH.md](VFN-011-THE-BENCH.md) | set sandbox values, press Run, watch the badges fill — with no app running | 10 | **1 — the flagship** | 📋 open |
| VFN-012 | [VFN-012-THE-BLOCKS-THE-APP-ALREADY-HAS.md](VFN-012-THE-BLOCKS-THE-APP-ALREADY-HAS.md) | app-config variables, registered libraries and `window` become blocks | 11 | 3 | 📋 open |

## Suggested order, and why

**Tier 1 first, and it is genuinely a tier rather than a preference.** VFN-001, 002 and 003 are each
a builder losing work or being unable to proceed: a node deleted that nobody touched, a number you
cannot see while typing it, a button that does nothing at all. All three are small — the largest is
VFN-003 and it is one seam and one dialog — and none of them depends on anything else in the phase.
Shipping the rest of this phase on top of them is shipping polish over a data-loss bug.

**VFN-011 next, alone if necessary.** It is the flagship and it is the one task that changes what the
node *is*: a visual function you can exercise without running the app is a different tool from one
you can only watch. It is also the task most likely to find that something else is wrong, because it
is the first thing in this feature's history that executes a block program on demand.

**Then the library, in order: VFN-008 → VFN-009 → VFN-010.** They are one job in three sizes, and
008 is the cheapest half of the value: a saved block that says what it does removes most of the
reason to open it. 009 needs 008's description field to have somewhere to edit it. 010 needs 009's
manager to exist before it can be a second instance of it.

**VFN-004, 005, 006, 007 in any order.** All four are independent, all four are small, and none of
them blocks anything. VFN-005 is the only one with a reproduce step in front of it.

**VFN-012 last**, because it adds vocabulary to a language the previous eleven tasks are busy making
work. It is also the one task whose scope can be cut without leaving a hole: shipping the app-config
variables and not the libraries is a coherent partial answer.

## Two things to check before starting *any* task here

1. 🔴 **Reproduce the report.** Two of eleven have no pinned mechanism and both are written to look
   obvious. This register has filed a "not there" finding that was a grep of the wrong surface, a
   guard that was decoration, and a spec containing the sentence it forbade. Reproduce first.
2. ⚠️ **`test:main` and `test:ci` before and after.** `test:main` measured 144 suites / 2107 green
   on 2026-08-12; `test:ci` has a floor of 6 failures at 2670 specs. Compare **names**, not counts,
   and read `tests/test-results.json` rather than the log. `cloud-library:check` is a required PR
   gate and drifts red on any port-group rename — VFN-012 adds ports and must run it.
