# Conventions

## How this file is used

The rules below are read by the assistant on **every authoring turn**, and they
outrank its own defaults. Editing this file changes what gets built.

Write rules that are checkable. "Make it nice" is not a rule; "every page's
outermost node is a Group named `Page Root`" is.

## Structure

- The tree is exactly the one in `docs/ARCHITECTURE.md`. Everything except
  `Pantry`, `Menu` and the whole of the `Snack` component belongs to lessons 1-7
  and is not edited here.
- Logic nodes have no parent and sit in a column to the right of the visual node
  they feed. In `Snack`, `Fields` sits beside `Name` (it feeds it) and `Signals`
  beside `Snack row` (it is fed by it).

## Naming

- Every node carries an explicit label, because lesson conditions address nodes
  by `#Label` and type-only addressing is an F3 ambiguity risk.
- The component is `/Snack` — top level, no folder. A learner creating it from the
  Components panel's **+** gets exactly that name, and the Repeater's `template`
  parameter is that string.

## Wiring

- 🔴 **The header in `Pantry` and the port on `Fields` are ONE name.** Change one
  and the rows say `Text`. The header is `name`.
- 🔴 **A Component Outputs port takes its type from its wire.** `eaten` is a
  signal because `Snack row`'s Click feeds it. The Repeater publishes it as
  `itemOutputSignal-eaten`; that is the `fromProperty` in `Home`'s connections
  and there is no other spelling.
- `Menu`'s `eaten` goes to the same two places `Poke`'s Click goes for the nag:
  `Ignored.off` and `Patience.restart`. It does NOT go to `Pokes.increase`;
  feeding is not poking.

## Styling

- Colour and spacing parameters are set as `var(--token)` from the style
  vocabulary, never a raw hex or px — **except** on a parameter a step grades
  with `paramsEqual`. The only `paramsEqual` here is `template`, a component name.
- `Name` carries NO `text`. The word arrives on a wire; the catalog default
  `Text` is the visible failure when it does not.
- `Snack row` is styled and none of it is graded. The learner's row may be bare.

## Data

- `Pantry` is CSV with one column, `type` left at its default. No JSON, no ids,
  no second column.
- No Record, Query or Function nodes. Records are lesson 9.

## What not to do

- Do not set a parameter on a node this lesson does not create unless a step
  grades it. Ungraded parameters survive `derive_starter` into the starter, and
  the starter has to equal lesson 7's solution.
- Do not set `templateType` on `Menu`. It defaults to explicit; setting it puts a
  parameter in the solution the learner never touches.
- Do not put a `text` on `Name`.
- Do not add `For Each Actions`. See `docs/BRIEF.md`.

## Established during scoping

- Only additions. No step grades a parameter lesson 7 already set.
- Every graded parameter on a node this lesson creates is one a step asks for;
  the ungraded ones are all on `Snack row`, which the learner creates.
