# Conventions

## How this file is used

The rules below are read by the assistant on **every authoring turn**, and they
outrank its own defaults. Editing this file changes what gets built.

Write rules that are checkable. "Make it nice" is not a rule; "every page's
outermost node is a Group named `Page Root`" is.

## Structure

- The tree is exactly the one in `docs/ARCHITECTURE.md`. Everything except
  `Story`, `Caption` and `Excitement` belongs to lessons 1-4 and is not edited
  here.
- Logic nodes have no parent and sit in a column to the right of the visual node
  they feed.

## Naming

- Every node carries an explicit label, because lesson conditions address nodes
  by `#Label` and type-only addressing is an F3 ambiguity risk.

## Wiring

- 🔴 **Take an `Expression`'s value from `result`, never from `asNumber`,
  `asString` or `asBoolean`.** Those three outputs are never flagged dirty and a
  wire from them never updates — see `docs/ARCHITECTURE.md` §1. This is a rule
  about the product, not about this lesson.

## Styling

- Colour and spacing parameters are set as `var(--token)` from the style
  vocabulary, never a raw hex or px — **except** on a parameter a step grades
  with `paramsEqual`. A learner types into the panel, so a graded value has to be
  the shape a learner produces. `Caption`'s `format` and `Excitement`'s
  `expression` are the two such parameters here, and both are plain strings.
- `Story` carries NO `text` parameter. See `docs/ARCHITECTURE.md` §2; this one is
  load-bearing, not a style choice.
- Neither button carries a colour. Their black is the product's default and is
  left visible on purpose — see the lesson 3 register, row E1.

## Data

- No data. No Record, Query or Function nodes.
- No node that decides. A `Condition` would take `moods`' opening problem away,
  and so would a ternary inside `Excitement`'s expression — which is why the
  expression is deliberately arithmetic.

## What not to do

- Do not set a parameter on a node this lesson does not create unless a step
  grades it. Ungraded parameters survive `derive_starter` into the starter, and
  the starter has to equal lesson 4's solution byte for byte.
- Do not give `Score` a `text`, remove it, or restyle it. It is lesson 4's node
  and the raw number it shows is inherited, not a choice this lesson can revisit.
- Do not set `Pokes`' `startValue`. It is used as a measurement control (see
  `docs/ARCHITECTURE.md` §2) and must ship at its default.

## Established during scoping

- Only additions. No step grades a parameter lesson 4 already set.
- Every parameter on a node this lesson creates is one a step asks for, so the
  learner's result matches the answer.
