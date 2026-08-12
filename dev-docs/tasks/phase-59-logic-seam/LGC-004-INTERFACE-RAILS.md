# LGC-004 — the signature is scattered among the blocks

**Status:** 🔨 **§1 and §4 done 2026-08-12; §2 and §3's panel deliberately not built** · **Track:
the seam** · the change that makes it read as a function

**What landed:** the two rails, with the derivation, the drag gestures and the specs
(`ce8c5f01`). `detectIO` gained a sibling projection, `detectInterface`, on the same single walk.

**What did not, and why:** §2 and §3 are the **props panel**, and a concurrent session was
rewriting `views/panels/propertyeditor/components/PortsTab/` while this ran. Editing it would have
collided with work this session could not see. §3's *property* — an undeclared port is a working
port, shown inferred and typed honestly — **is built**, in the rails. What is deferred is the panel
that also shows it and the **Declare** action. The design for it is
[below](#2--the-design-for-the-props-panel-not-built-this-session), and it corrects the table in §2
in three places, one of them decisive.

**§4 is a written verdict, not an adoption** — no `npm install` was available to this session, and
the verdict is that the plugin does not do §4's job anyway. See
[§4 below](#4--the-mutator-verdict-2026-08-12).

## The problem

A Visual Function's interface is real and derived —
[`logic-builder-io.ts`](../../../packages/noodl-runtime/src/nodes/std-library/logic-builder-io.ts)
reads the workspace and reports every port the block program declares **or uses**, so a program works
whether or not its author declared its interface up front.

That is a good property. But it means the signature is **scattered**: a `Define input` block here, a
`Get input` twelve blocks away, a `Set output` at the bottom. There is no place a builder can look
and see *what this function takes and what it gives back*.

Right now it reads as a Blockly file. It should read as a function.

## §1 — Two rails, fixed to the workspace edges

An **Inputs rail** pinned to the left edge of the workspace and an **Outputs rail** pinned to the
right. Always visible, never scrolling away with the blocks, showing name, type, and — once LGC-003
lands — the live value.

Dragging from a rail entry creates a `Get input` block already bound to that name. Dragging to the
outputs rail creates a bound `Set output`.

This is the single change that turns the surface from "a canvas of blocks" into "a function with a
signature", and it is the answer to the video's *"I'd really like to build my functions visually"* —
because the function part becomes visible rather than inferred.

⚠️ Blockly does not do this natively. It is a fixed overlay with drag-to-create, which is real work.
It is also the highest-payoff item in this task, so do not let §2 absorb the time.

## §1, as built — 2026-08-12

| | |
|---|---|
| the rows | [`interfaceRails.ts`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/interfaceRails.ts) — a pure function of the workspace, no DOM |
| the rails | [`InterfaceRailsOverlay.ts`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/InterfaceRailsOverlay.ts) — DOM, drag, Blockly drop target |
| the styles | `BlocklyWorkspace.module.scss`, `.Rail*` |
| the wiring | `BlocklyWorkspace.tsx` — three lines in the effect, three in the JSX |
| the source | `detectInterface` in [`logic-builder-io.ts`](../../../packages/noodl-runtime/src/nodes/std-library/logic-builder-io.ts) |
| the specs | `tests-unit/lgc-004/interfaceRails.spec.ts` (23) · `noodl-runtime/test/logic-builder-interface.test.ts` (49) |

**How the rows are derived, in one sentence.** `detectIO`'s traversal was factored into a single
walk that records every *mention* of a port by a block; `detectIO` projects it into the four lists
the node registers from, and `detectInterface` projects the same walk into one row per port
carrying its side, its kind and whether a block declares it. The rails call
`railModelForWorkspace(workspace)`, which re-serialises the live workspace and calls
`detectInterface`, **on every refresh, with nothing cached**. There is no port array anywhere in
the editor.

That is the answer to the acceptance criterion about a second store, and it is not a claim about
intent: a cache added to `railModelForWorkspace` turns five specs red, and adding a `rows` field to
the overlay turns the structural gate red. Both were run.

**Three decisions worth arguing, made and written in source:**

1. **The rails are siblings of the injection div, not layers over it.** Blockly's toolbox owns the
   left edge of the injection div, so a floated left rail would cover it and eat its clicks. As
   siblings they take their width out of the flex row — and because they carry their classes from
   the **first React render**, the workspace is injected at its final width and needs no
   `svgResize`. A rail that widened after injection would leave the SVG at the width it was
   injected with, which is exactly what `blocklyResize.ts` exists for.
2. **Nothing touches the workspace model.** Same rule `DoItBalloons` documents: `BlocklyWorkspace`
   serialises the model into the node's `workspace` parameter on a 300 ms debounce, so a rail built
   from blocks, comments, icons or fields would be written into the user's saved program and would
   diff in git. The only Blockly event the rails create is the block a drag deliberately makes.
3. **No debounce and no timer on the refresh.** Serialising a workspace of the size block programs
   actually reach is microseconds, and a timer in an occluded Electron renderer is clamped by
   roughly 1000× — which would leave the rails minutes stale in the one window nobody is looking at
   and nobody can reproduce.

**The gestures.** Drag a row onto the blocks — **or click it**, which is the discoverable half, and
both are one undo step — and you get a `get input` / `set output` already carrying that row's name.
Drop a value block on the Outputs rail and it becomes that output: a `set output` bound to the row
you dropped on (or a freshly-named one below the last row), with the block plugged in. The
connection is *asked for*, not attempted — LGC-005 puts a real check on that socket, and a `number`
output refusing a `text` block is the check working, so the `set output` is still created and named
rather than the gesture throwing.

⚠️ **Signal rows are not draggable, on purpose.** `send signal` writes an output signal; there is no
"receive signal" block to write for an input one, because a signal input is a *trigger* and what it
runs is the whole program. A drag that produced the wrong block would be worse than no drag.

## §2 — The design for the props panel (not built this session)

**Read this before writing any of it.** §2's table below is right about the principle and wrong in
three places about the mechanism, and one of those three decides the architecture.

### 🔴 The decisive one: a panel edit made while the block editor tab is open is destroyed

`BlocklyWorkspace` reads `initialWorkspace` **once, on mount, and never reloads from it**
(`BlocklyWorkspace.tsx:39-43`), and it writes the serialised workspace into the node's `workspace`
parameter on every settled edit through a 300 ms debounce. So with the tab open:

1. the panel writes a new `workspace` parameter — the open workspace does not see it;
2. the user nudges a block — the debounce fires — and the tab writes the workspace it still has,
   **over the panel's edit**.

The panel edit vanishes, the panel re-reads the parameter and shows the old value, and nothing
errors. **This is not a race that can be tightened; it is the component's stated contract.**

**So the panel needs two write paths, chosen on whether a live workspace exists for that node:**

| | |
|---|---|
| **tab closed** | transform the `workspace` **JSON** and write the parameter |
| **tab open** | apply the same edit to the **live workspace** through Blockly, and let its own debounce write the parameter |

The registry for "is there a live workspace for node N" is three files' worth of precedent already
in this directory — `DoItController`'s `sessions` map keyed by `workspace.id`, and
`blocklyResize.ts`'s set of closures. Key it by **node id**, because that is what the panel has.

⚠️ **Do not implement the two paths twice.** Express each panel action as a *block operation* — add
a block of type T with fields F; set field `NAME` on every block matching a predicate; delete every
block matching a predicate — and write two small executors, one over the serialised JSON and one
over a live workspace. Then owe one spec that applies the same operation both ways and asserts the
two serialisations are **equal**. Two writers of one fact is fine; two *definitions* of the fact is
L11.

### 🔴 "Delete a row" is two different actions, and the table describes neither

Deleting the `Define input count` block **does not delete the port.** Every `get input count` still
in the program keeps it alive — that is `detectIO` counting uses, which is the feature §3 exists to
protect. What actually happens is that the row stops being declared and becomes an **inferred** row
typed `any`.

So the panel owes two distinct offers, and must not blur them:

- **Undeclare** — delete the declaration block. The port stays, untyped. Say so:
  *"3 blocks still use `count`. The port keeps working; it just loses its type."*
- **Remove the port** — delete every block that mentions it, which deletes the author's logic. This
  is a destructive edit to the program, not to a list, and it must read like one.

A "are you sure?" over a single delete would be a warning attached to the wrong action.

### 🔴 "Rename a row" must rename every mentioning block, not "the block"

A rename that touches only the `Define input` leaves every `get input` pointing at the old name —
which, because uses count, **mints back the old port** and adds a new one. The author sees a rename
that produced two ports and lost their wiring. Rename every block whose `NAME` matches, on the
side being renamed, in one undo group.

⚠️ And say what it costs: a renamed port is a *different* port to the node graph. Any wire attached
to the old name on the canvas dies with it. That is true of the block editor's rename today too;
the panel just makes it easy enough to do by accident that it needs saying.

### What the panel reads

`railModelFromWorkspaceJson(node.getParameter('workspace'))` — already exported from
`BlocklyEditor/index.ts`, already answers from the saved parameter with no Blockly loaded, and
already returns the `declared` flag §3's inferred rows need. **The panel must not parse the
workspace itself and must not keep a rows array.** Its state is the parameter.

For the delete warnings it needs one more fact the rails do not: *how many blocks mention this
port*. Add it as a **third projection of the same traversal** in `logic-builder-io.ts` — something
like `mentionsOfPort(workspaceJson, plug, name)` returning declaration and use counts. Do not count
them by re-walking the JSON in the editor.

### Where it goes

**In `LogicBuilderWorkspaceType`**, the existing editor for the `workspace` parameter
(`views/panels/propertyeditor/DataTypes/LogicBuilderWorkspaceType.ts`) — which already renders
React into the panel and already reaches the node model. ⚠️ **Not in `PortsTab`**: that component
was being rewritten by a concurrent session on 2026-08-12, and the Logic Builder's ports are not
the generic port list anyway — they are a projection of one parameter.

### The spec §2 owes, restated so it cannot be satisfied by a cache

Edit a port from the panel, then read `node.getParameter('workspace')`, parse it, and assert **the
blocks changed** — a `noodl_define_input` appeared, a `NAME` field moved, a block is gone. Never
assert on the panel's own state. And do the tab-open case: open a workspace for the node, edit from
the panel, fire a settled change in the workspace, and assert the panel's edit **survived**. That
second one is the spec that would have caught the mechanism above.

## §2 — The props panel edits the blocks; it does not shadow them

Richard asked for inputs and outputs to be definable from the node's props panel. **The constraint
that decides the whole design:** `detectIO` makes the workspace the single source of truth for ports,
deliberately, and it lives in `@noodl/runtime` rather than the editor because dynamic ports are
announced from the **viewer** window, which cannot see anything the editor put on `window`
(LEARNINGS-BLOCKLY §1 — the previous implementation was unreachable for exactly this reason).

**So the props panel must write blocks, not store a list.**

| Panel action | What actually happens |
|---|---|
| add a row | a `Define input` / `Define output` block is created in the workspace |
| rename a row | the block's `NAME` field is renamed |
| set a type | the declaration block's type field is set — a declaration is the only place a type is stated, per `detectIO` |
| delete a row | the block is deleted, **with a warning if `Get input` blocks still reference it** |

⚠️ **This is the BLD-007 shape and it must not be repeated.** That defect gave one fact two sources;
`tsc` was green and 21/21 specs passed while it was live, and what caught it was the specs nobody
touched. A props panel with its own port array would pass every test in this repo and be wrong.

**Acceptance owes a spec that proves there is one store**: edit ports from the panel, read the
serialised workspace, and assert the blocks changed — not that the panel's state changed.

## §3 — Inferred rows, kept inferred

`detectIO` counts implicit uses (`get input`, `set output`, `send signal`) as ports, so a program
works without declarations. That property is worth keeping.

The panel shows those as **inferred** rows — visually distinct, with a **Declare** action that adds
the declaration block and lets a type be set. Nudge toward a stated interface; never require one.

An inferred row has type `'*'` (what `detectIO` reports when the blocks declare none), and that is
the honest display: *"any"*, not a guess.

## §4 — Do not build a mutator

Blockly's native answer to variable-arity blocks is the mutator dialog, and mutators are a documented
novice cliff. **`@blockly/block-plus-minus`** exists precisely to replace them with inline `+`/`−`
controls (LGC-006, ⚠️ unverified against our blocks).

Adopt it rather than writing a dialog. If it does not fit, the reason goes in this file — per the
phase's adopt-over-build rule.

## §4 — the mutator verdict (2026-08-12)

**Verdict: adopt `@blockly/block-plus-minus@9.0.10`, without its procedures half — and it does not
do this section's job. Nothing about defining inputs and outputs was ever a mutator problem.**

### The premise under §4 does not survive contact with our block set

§4 reads as: *ports are a variable-arity thing, Blockly's answer to variable arity is the mutator
dialog, mutators are a novice cliff, so adopt the plugin that replaces them.* The first clause is
the one that fails.

**Our ports are not sockets on one block.** They are separate top-level blocks —
`noodl_define_input`, `noodl_get_input`, `noodl_define_output`, `noodl_set_output` and the three
signal blocks — and "adding an input" is dragging one more block into the workspace. There is
nothing of variable arity to mutate.

**And none of our fifteen Noodl blocks has a mutator at all.** `NoodlBlocks.ts` defines every one
of them with `appendDummyInput` / `appendValueInput` and fixed fields; `grep -rn
"mutator\|mutationToDom\|decompose" BlocklyEditor/` returns **nothing**, checked 2026-08-12. So there is
no dialog here to replace and none to build. **§4's instruction "do not build a mutator" was
already satisfied before it was written**, and the thing it was reaching for — a way to see and
manage the interface without a dialog — is §1, which is now built.

### What the plugin actually does for us, which is still worth having

LGC-006 read the published source and the numbers are its, not re-derived here:

- Pin **`9.0.10`** — `latest` peer-deps `blockly: ^13`, we are on `12.3.1`, and the 12-compatible
  line is frozen. **4.1 KB gz.**
- Its README scopes itself: it affects `controls_if`, `text_join`, `lists_create_with`,
  `procedures_defnoreturn`, `procedures_defreturn` and *"the ability to easily add this to your own
  mutators may be added in the future"*. It does **not** reach custom blocks.
- The first three **are in our toolbox** — `BlocklyToolbox.ts:120, 151, 162`, re-grepped
  2026-08-12 on this branch, which is not where LGC-006 found them; that file has moved since. So
  the cliff it
  removes is a real cliff on blocks we really ship: adding a third `else if`, joining a fourth
  string, making a five-item list. That is the whole win, and it is a good one for 4 KB.

### 🔴 Take three of its four files, not `index.js`

`src/index.js` is four bare imports. Import `if.js`, `list_create.js` and `text_join.js` directly
and leave `procedures.js` out. Two reasons, and the first is not a preference:

1. **`procedures.js` collides silently with `@blockly/block-shareable-procedures`**, which LGC-006
   also recommends adopting. It does `delete Blockly.Blocks['procedures_defnoreturn']` and
   `delete Blockly.Blocks['procedures_defreturn']` and redefines both with the **old name-based**
   procedure system, while `block-shareable-procedures` defines the same two types model-backed.
   **Whichever module is imported last wins, in either direction, with no error and no warning**
   (LGC-006 register **L32**).
2. `src/procedures.js:15` sets `Blockly.Msg['PROCEDURE_VARIABLE'] = 'variable:'` at import and
   appends it at `:456` with the source comment `// Untranslated!` — an English string in all 27
   languages in `SUPPORTED_LANGUAGES`. Moot once the file is excluded, which is another reason to
   exclude it.

### The install line, for whoever has a clean checkout

This session may not touch `package.json` or `package-lock.json`, so this is written down rather
than run:

```
npm i -w packages/noodl-editor @blockly/block-plus-minus@9.0.10
```

and then, in `initialize.ts` (not `index.js`):

```ts
import '@blockly/block-plus-minus/dist/if';
import '@blockly/block-plus-minus/dist/list_create';
import '@blockly/block-plus-minus/dist/text_join';
```

⚠️ **Check the published file layout before copying those three paths.** LGC-006 read the plugin's
`src/`, and the mapping from `src/*.js` to what the tarball actually exposes under `dist/` was not
checked — a wrong path here fails at build time, loudly, which is the acceptable failure, but it is
not verified and should not be presented as if it were.

⚠️ And it is **still a verdict from reading**. LGC-006 states this as its standing caveat (register
**L37**): no plugin in this phase has been injected into our workspace. The sentence "what it
actually did in our workspace" is owed and is not written here.

## Acceptance

- A Visual Function's inputs and outputs are visible at the workspace edges without scrolling, at
  every zoom level, in both themes.
- Dragging from a rail creates a correctly bound `Get input` / `Set output` block.
- Adding, renaming, typing and deleting a port from the props panel **changes the serialised
  workspace**, proven by reading the workspace JSON — and deleting a referenced port warns first.
- ⚠️ **There is no second store.** A spec asserts that the panel's rows are derived from `detectIO`
  output and nothing else. This is the acceptance criterion most likely to be quietly satisfied by a
  cache; it must be checked against the workspace, not against the panel.
- An undeclared-but-used port appears as an inferred row typed `*`, and Declare converts it.
- ⚠️ Verify with the node **placed but never opened** — a Visual Function whose workspace has never
  been rendered still has ports, because `detectIO` runs on the JSON without Blockly.

## Acceptance, answered — 2026-08-12

| Criterion | State |
|---|---|
| Inputs and outputs visible at the edges without scrolling | 🔨 **built, not seen.** The structure is right by construction — the rails are fixed-width flex siblings outside the scrolling SVG, so nothing can scroll them away — but **no screenshot was taken and no editor was launched.** Zoom levels and both themes are in *Deferred verification* below |
| Dragging from a rail creates a correctly bound `Get input` / `Set output` | 🔨 **the block is graded, the gesture is not.** `dragBlockJsonForRow` and the append are graded against a real headless workspace; the pointer sequence needs a drive |
| A panel edit changes the serialised workspace, and a referenced delete warns | ❌ **not built.** §2/§3's panel was out of scope — a concurrent session was rewriting `PortsTab/`. The design and the corrected mechanism are written above |
| ⚠️ **There is no second store** | ✅ **met, and proved red.** Rows derive from `detectInterface` — a projection of `detectIO`'s own traversal — with nothing cached. Adding a cache to `railModelForWorkspace` fails 5 specs; adding a `rows` field to the overlay fails the structural gate. Both were run, not reasoned about |
| An undeclared-but-used port appears as an inferred row typed `*` | ✅ **met in the rails**, with `'*'` printed as *"any"* and never as a guess. ❌ **Declare** is the panel's action and is not built |
| ⚠️ Verify with the node **placed but never opened** | ✅ **met.** `railModelFromWorkspaceJson` answers from the saved parameter, and the whole runtime suite for `detectInterface` runs with no Blockly imported at all |

**What no gate here can tell you:** whether the rails are *legible* — 152 px of two-line rows in
both themes, against a Blockly workspace whose ground is `#0b0e12`. No contrast ratio is claimed in
this file because none was measured.

## ✅ DRIVEN 2026-08-12 — 11 of 15 run, 9 clean passes, 3 findings

Fixture: a throwaway copy of `lgc59-drive` (the original is byte-identical afterwards, `d802e836`).
Both fixtures were left untouched. Results against the numbered steps below.

| # | Result |
|---|---|
| 1 | ✅ **PASS.** Exactly five rows, no others: `price/number`, `run/signal`, `quantity/any` on Inputs; `total/any`, `done/signal` on Outputs. Inferred rows carry `RailRowInferred` with a **dashed** edge and an **italic** type, declared ones do not. ⚠️ Row order is *declared first, then inferred* (`price, run, quantity`), not the order this table lists — a display choice, not a defect, but the table should say which it wants |
| 2 | ✅ **PASS, non-vacuously.** The block moved 725 → 401 px across the screen while the rail stayed at x=380. Proving the blocks *moved* is the whole point; a rail that holds still because nothing happened is not a pass |
| 3 | ✅ **PASS.** `getScale()` genuinely read 0.3 then 3.0. Rail rect (152×280) and row font (12 px) were byte-identical at both. This is the one the register warned about, and the rails are outside the SVG as designed |
| 4 | 🟡 **Mechanism passes, legibility fails.** See the contrast block below |
| 5 | 🟡 **Mostly.** The drag creates exactly one `noodl_get_input` named `price`, landing at the drop x exactly and 24 px below the drop y — under the cursor. **One undo removes the whole thing** (single undo group, the thing worth checking). 🔴 **It is not selected**: `Blockly.common.getSelected()` is `null` afterwards, and the step asks for selected. ⚠️ Undo was driven through `workspace.undo(false)`, so the *Ctrl+Z keybinding route* specifically is still unverified |
| 6 | 🔴 **SPLIT — half of it fails.** Released **outside the pane**: nothing created, correct. Released **over the toolbox**: a block **is** created. `elementsFromPoint` at the drop confirms `blocklyToolbox` is the hit target, so this is not a mis-aimed drop. The toolbox is inside the injection div, so the drop handler counts it as "inside the workspace" — but to a user it is the palette, and dropping a row on the palette reads as a cancel |
| 7 | ✅ **PASS.** Clicking `total` creates `noodl_set_output` named `total` at (896,618) against a view centre of (874,619). ⚠️ **Richard's eye is still needed**, and finding 6 sharpens the question: there are now *two* ways to create a block you did not mean to |
| 8 | ✅ **PASS.** Dragging a `math_arithmetic` onto the Outputs rail over `total` creates a new `noodl_set_output total` with the arithmetic block plugged into it |
| 9 | ✅ **PASS.** Dropping below the last row creates `noodl_set_output` named **`result`**, freshly minted, arithmetic plugged in |
| 10 | ❌ **NOT RUN.** Needs a `Define output total type number` block, which `lgc59-drive` does not contain. The LGC-005 refusal half is unobserved |
| 11 | ✅ **PASS.** The rail row renames on **every keystroke** — `prcice` → `prcice/number`, `procice` → `procice/number`, four characters, four updates. No debounce, as intended |
| 12 | ✅ **PASS.** Both rails read *"None yet. Any "get input" or "Define input" block you add shows up here."* The copy names blocks as the source and there is no "+ Add" |
| 13 | ✅ **PASS — and this is the one the task called most likely to be skipped.** Opened the tab, closed it, touched nothing: the `workspace` parameter on disk is **byte-identical**, 776 bytes before and after. Run from a pristine copy after a full editor restart, because doing it any other way would not have been an answer |
| 14 | ✅ **ANSWERED 2026-08-12**, once LGC-008's splitter existed. At a **288 px** pane the two rails alone are **152 + 152 = 304 px** and `.injectionDiv` measures **0** — the workspace is gone, with no clamp and no message. So the floor is not a taste question: it is 304 px of rails plus whatever a workspace needs. ⚠️ *What should happen* is a decision — clamp the splitter, collapse the rails below a threshold (they are DOM siblings, so they can), or let the pane close. Filed in LGC-008, not chosen |
| 15 | ✅ **Met incidentally.** `lgc59-drive`'s blocks were authored earlier in the week, and step 1 read them correctly with no migration |

### 🔴 The contrast measurement this file said it could not make

The *"what no gate here can tell you"* note above asked whether the rails are legible and declined to
claim a ratio. Measured now, live-flipped rather than reloaded — **step 4's mechanism passes**: the
rails re-colour on the flip, rail ground `#181d24` → `#f7f9fb`, with no reload.

| Element | Dark (on `#181d24`) | Light (on `#f7f9fb`) | AA 4.5 |
|---|---|---|---|
| Row **name**, 12 px | `#a6b0bb` — **7.70** | `#4a5663` — **7.10** | ✅ both |
| **Type** label, 10 px (`number`, `any`) | `#6b7682` — **3.66** | `#7c8894` — **3.43** | 🔴 **fails both** |
| **Signal** type, 10 px | `#4da3ff` — **6.45** | `#1570ef` — **4.33** | 🔴 **fails light** |

The type label is **10 px and weight 400**, so the large-text exemption does not apply and the
threshold is 4.5. Two of the three roles fail, one of them in both themes. This is the
[[a-control-can-work-and-be-unreadable]] shape: every functional step above passed against text that
is below AA.

### How it was driven, and one trap worth keeping

`cdp.js` had no drag command; steps 5–10 are all drags, so one was added (`cdp drag <from> <to>`,
either endpoint a selector or literal `x,y`). The intermediate moves are load-bearing — a press
followed straight by a release is a click at the origin.

🔴 **A Blockly block's bounding box is not its hit area, and mistaking the two manufactures a
"the mechanism is broken" finding.** Grabbing a nested block 8 px inside its `getBoundingClientRect()`
top-left hit empty workspace, the drag did nothing, and the honest-looking conclusion was *"CDP mouse
events do not reach Blockly's gesture handler"* — which would have written off steps 8–10 as
undrivable. They are fine. Pick the grab point by walking candidate points until
`document.elementFromPoint(x,y).closest('.blocklyDraggable')` carries the block's own `data-id`.

## Deferred verification

Everything below needs the editor running. **11 of the 15 were run on 2026-08-12 — see the results
table above.** The original note follows, for the record: this task's own session could not launch
Electron (`lerna exec` resolves to the primary checkout from a worktree, and a concurrent session
was live there).

**Setup, once.** Open a project, place a **Visual Function**, click *Edit Logic Blocks*, and build
a program with all four shapes in it: a `Define input price type number`, a bare `get input
quantity` with no declaration, a `Define signal input run`, a `set output total`, and a `send
signal done`.

| # | Do this | Passes when |
|---|---|---|
| 1 | Look at the two rails | Left says **Inputs**: `price / number`, `quantity / any` (dashed edge, italic type), `run / signal`. Right says **Outputs**: `total / any`, `done / signal`. Five rows, no others |
| 2 | Scroll and pan the blocks to the far corner of the canvas | Both rails stay exactly where they are. The **blocks** move under them |
| 3 | Zoom to minimum (0.3) and maximum (3.0) with the wheel | Rail text does **not** change size, because the rails are outside the SVG. ⚠️ This is the one the register warns about — glyphs painted inside a Blockly workspace scale with it, and the whole point of these being DOM is that they do not |
| 4 | Flip the editor light/dark with the workspace open — do not reload into each theme | Both rails re-colour on the flip. ⚠️ Flip **live**: LGC-006 found `workspace-minimap` fails exactly this and passes a reload-into-each-theme check. Print the foreground and background hex with any contrast claim |
| 5 | Drag the `price` row onto the canvas | A ghost follows the pointer; on drop a `📥 get input price` block appears **under the cursor**, already named, and is selected. One Ctrl+Z removes the whole thing |
| 6 | Drag a row and release it over the toolbox, or off the window | Nothing is created. A cancelled drag is a cancelled drag |
| 7 | **Click** the `total` row without moving | A `📤 set output total` appears in the middle of the view. ⚠️ **Richard's eye needed here**: the click gesture was added for discoverability and is not in the spec. It could equally read as an accidental-creation hazard |
| 8 | Drag a `math_arithmetic` block onto the **Outputs** rail, over the `total` row | The rail highlights on entry; on drop a `set output total` appears just inside the right edge with the arithmetic block plugged into it |
| 9 | Repeat 8, dropping **below** the last row | The same, with a freshly minted name — `result`, or `result2` if `result` is taken |
| 10 | Set `Define output total` to `type number`, then repeat 8 with a **text** block | The `set output total` is still created and named; the text block is **not** connected, because LGC-005's check refused it. No exception in the console |
| 11 | Type into a `Define input`'s name field, one character at a time | The rail row renames as you type. ⚠️ If it lags, look for a debounce someone added — there is deliberately none |
| 12 | Delete every block, then look at the rails | Both show their empty copy, and the copy says the ports come from blocks — not "+ Add" |
| 13 | Close the tab and reopen it. Then check `git diff` on the project file | The `workspace` parameter is **byte-identical** to before the rails were ever opened, apart from blocks you actually made. This is the criterion `DoItBalloons` names as the one most likely to be skipped |
| 14 | Drag the pane splitter (LGC-008) narrower than ~450 px | The two rails hold their 152 px and the Blockly container shrinks. ⚠️ At some width this stops being usable; find that width and say what should happen |
| 15 | Open a Visual Function whose blocks were written before today | The rails read it correctly. `detectInterface` is a projection of the existing traversal, so this should be free — confirm it anyway |

## Register

| # | Finding | State |
|---|---|---|
| L10 | `detectIO` deliberately lives in the runtime because ports are announced from the viewer window. **Any editor-side port store is unreachable from the place that needs it** — this already broke once | ✅ **honoured 2026-08-12.** The rails hold nothing; `detectInterface` was added beside `detectIO`, in the runtime, on the same traversal |
| L11 | A props panel with its own port array is the BLD-007 defect exactly: one fact, two sources, all gates green | ✅ **avoided in the rails, and proved.** Still ⚠️ **open for the panel**, which is not built |
| L12 | Implicit ports are a feature (`detectIO` counts uses, not just declarations). The panel must not turn "works undeclared" into "must declare" | ✅ **kept in the rails** — an inferred row is a row, marked and typed *"any"*, never a warning and never dimmed. 📋 open for the panel |
| L38 | 🔴 **A props-panel edit made while the block editor tab is open is silently destroyed.** `BlocklyWorkspace` reads `initialWorkspace` once and writes the parameter on every settled edit, so the tab's next debounce overwrites the panel. **This decides §2's architecture** — it needs two write paths chosen on whether a live workspace exists for that node | 🔴 found 2026-08-12, read in source. Nothing tests it |
| L39 | 🔴 **`detectIO` resolves a type clash by document order**, so a bare `get input count` serialised *above* its own `Define input count type number` leaves the port at `'*'` — the declaration silently loses, contradicting the docstring's *"a declaration wins on type"*. **Not changed**: it is runtime port-type behaviour and out of this task's scope. The rails report `'*'` for it, because that is the type the node registers | 🔴 found 2026-08-12. A spec pins the current behaviour so a future fix is a deliberate one |
| L40 | 🔴 **§2's "delete a row" is two different actions.** Deleting the `Define …` block does not delete the port — every use keeps it alive, and the row becomes inferred. *Undeclare* and *remove the port* must be separate offers with different warnings; a single "are you sure?" is a warning on the wrong action | 🔴 found 2026-08-12 |
| L41 | 🔴 **§2's "rename a row" must rename every mentioning block**, not "the block". Renaming only the declaration leaves the uses pointing at the old name, which **mints the old port back** and adds a new one — a rename that produces two ports. And a renamed port is a different port to the node graph, so any wire on the canvas dies | 🔴 found 2026-08-12 |
| L42 | ⚠️ **A name used as both a value and a signal is one port, and it is the signal.** `registerInputIfNeeded` / `registerOutputIfNeeded` consult the signal lists before falling through to a value port. Anything displaying a signature must agree, or it shows a value port the node never creates | ✅ handled in `detectInterface`, proved red |
| L43 | ⚠️ **Blockly's toolbox owns the left edge of the injection div**, so an "overlay" rail floated over it would cover the toolbox. The rails are flex **siblings** carrying their width from the first React render — which is also what makes injection measure the final size and need no `svgResize` | ✅ built that way 2026-08-12 |
| L44 | ⚠️ **§4's premise was wrong and the plugin does not do §4's job.** Our ports are separate top-level blocks, not sockets on one block; there is no mutator anywhere in `BlocklyEditor/`. `block-plus-minus` is still worth 4 KB for `controls_if` / `text_join` / `lists_create_with` — a different cliff | 🔴 found 2026-08-12; verdict written, **not installed** |
