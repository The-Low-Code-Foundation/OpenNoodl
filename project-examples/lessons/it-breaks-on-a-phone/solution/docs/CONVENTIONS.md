# Conventions

## How this file is used

The rules below are read by the assistant on **every authoring turn**, and they
outrank its own defaults. Editing this file changes what gets built.

Write rules that are checkable. "Make it nice" is not a rule; "every page's
outermost node is a Group named `Page Root`" is.

## Structure

- The tree is exactly the one in `docs/ARCHITECTURE.md`. `Card` and everything
  under it belongs to lesson 1 and is not edited here.

## Naming

- Every node carries an explicit label, because lesson conditions address nodes
  by `#Label` and type-only addressing is an F3 ambiguity risk.

## Styling

- Colour and spacing parameters are set as `var(--token)` from the style
  vocabulary, never a raw hex or px — **except** on a parameter a step grades
  with `paramsEqual`. A learner types a number into the panel, so a graded value
  has to be the shape a learner produces. `maxWidth` is the one such parameter
  here, and it is a literal `{"value":560,"unit":"px"}` for that reason.

## Data

- No data. No Record, Query or Function nodes.

## What not to do

- Do not set a parameter on a node this lesson does not create unless a step
  grades it. Ungraded parameters survive `derive_starter` into the starter, and
  the starter has to equal lesson 1's solution.
- Do not add a connection. If this graph ever grows a wire, it has stopped being
  lesson 2 and become `poke-it`.

## Established during scoping

- Only additions. No step grades a parameter lesson 1 already set.
- Every parameter on a node this lesson creates is one a step asks for, so the
  learner's result matches the answer.
