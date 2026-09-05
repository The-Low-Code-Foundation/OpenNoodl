# Conventions

## How this file is used

The rules below are read by the assistant on **every authoring turn**, and they
outrank its own defaults. Editing this file changes what gets built.

Write rules that are checkable. "Make it nice" is not a rule; "every page's
outermost node is a Group named `Page Root`" is.

## Structure

- The tree is exactly the one in `docs/ARCHITECTURE.md`. Everything except
  `Score`, `Rest` and `Pokes` belongs to lessons 1-3 and is not edited here.
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
  here, and `Rest`'s `label` is a plain string.
- Neither button carries a colour. Their black is the product's default and is
  left visible on purpose — see the lesson 3 register, row E1.
- `Score` carries NO `text` parameter. See `docs/ARCHITECTURE.md` §1; this one
  is load-bearing, not a style choice.

## Data

- No data. No Record, Query or Function nodes.
- No node that formats or decides. A `String Format` would take
  `show-what-it-feels`'s opening problem away, and a `Condition` would take
  `moods`'.

## What not to do

- Do not set a parameter on a node this lesson does not create unless a step
  grades it. Ungraded parameters survive `derive_starter` into the starter, and
  the starter has to equal lesson 3's solution.
- Do not set `Counter`'s `startValue` or its limit ports. They are real and they
  are deliberately left at their defaults.

## Established during scoping

- Only additions. No step grades a parameter lesson 3 already set.
- Every parameter on a node this lesson creates is one a step asks for, so the
  learner's result matches the answer.
