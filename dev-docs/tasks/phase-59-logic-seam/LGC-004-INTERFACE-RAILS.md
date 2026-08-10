# LGC-004 — the signature is scattered among the blocks

**Status:** 📋 open · **Track: the seam** · the change that makes it read as a function

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

## Register

| # | Finding | State |
|---|---|---|
| L10 | `detectIO` deliberately lives in the runtime because ports are announced from the viewer window. **Any editor-side port store is unreachable from the place that needs it** — this already broke once | ⚠️ standing constraint |
| L11 | A props panel with its own port array is the BLD-007 defect exactly: one fact, two sources, all gates green | ⚠️ the trap this task exists to avoid |
| L12 | Implicit ports are a feature (`detectIO` counts uses, not just declarations). The panel must not turn "works undeclared" into "must declare" | 📋 open |
