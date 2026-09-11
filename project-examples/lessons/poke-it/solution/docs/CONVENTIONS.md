# Conventions

## How this file is used

The rules below are read by the assistant on **every authoring turn**, and they
outrank its own defaults. Editing this file changes what gets built.

Write rules that are checkable. "Make it nice" is not a rule; "every page's
outermost node is a Group named `Page Root`" is.

## Structure

- The tree is exactly the one in `docs/ARCHITECTURE.md`. `Card`, `Board` and
  `Care` belong to lessons 1 and 2; this lesson adds children to the first two
  and edits neither.
- Logic nodes have no parent and sit in a column to the right of the visual node
  they feed.

## Naming

- Every node carries an explicit label, because lesson conditions address nodes
  by `#Label` and type-only addressing is an F3 ambiguity risk.

## Styling

- Colour and spacing parameters are set as `var(--token)` from the style
  vocabulary, never a raw hex or px — **except** on a parameter a step grades
  with `paramsEqual`. A learner types a number into the panel, so a graded value
  has to be the shape a learner produces. `duration` is the one such parameter
  here, and it is a plain `200` — it is a bare number port with no unit
  dropdown, which was checked with `get_node_type` before it was graded.
- `Poke` carries no colour at all. Its black is the product's default and is
  left visible on purpose — see `docs/ARCHITECTURE.md` §3.

## Data

- No data. No Record, Query or Function nodes.
- No node that accumulates. A `Counter` or a `Variable` here would take
  `it-forgets-you`'s opening problem away.

## What not to do

- Do not set a parameter on a node this lesson does not create unless a step
  grades it. Ungraded parameters survive `derive_starter` into the starter, and
  the starter has to equal lesson 2's solution.
- Do not add a fifth node or a fourth wire. Three wires are the lesson; a fourth
  is `it-forgets-you`.

## Established during scoping

- Only additions. No step grades a parameter lesson 2 already set.
- Every parameter on a node this lesson creates is one a step asks for, so the
  learner's result matches the answer.
