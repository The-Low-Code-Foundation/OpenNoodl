# Conventions

## How this file is used

The rules below are read by the assistant on **every authoring turn**, and they
outrank its own defaults. Editing this file changes what gets built.

Write rules that are checkable. "Make it nice" is not a rule; "every page's
outermost node is a Group named `Page Root`" is.

## Structure

- The tree is exactly the one in `docs/ARCHITECTURE.md`. Everything except `Nag`,
  `Patience`, `Ignored`, `Demanding` and `Fade the nag` belongs to lessons 1-6
  and is not edited here.
- Logic nodes have no parent and sit in a column to the right of the visual node
  they feed.

## Naming

- Every node carries an explicit label, because lesson conditions address nodes
  by `#Label` and type-only addressing is an F3 ambiguity risk.

## Wiring

- 🔴 **A signal is not a boolean.** `timerFinished` cannot be read by `And`; a
  `Switch` is the bridge. Any future step that wants to ask *did that happen?*
  needs one too.
- 🔴 **Take a negation from the node that already publishes it.** `Mood Check`
  has `isfalse`; an `Inverter` on `result` would be a second node saying the same
  thing. The same applies to `Expression`'s `isFalse`.
- `And`'s inputs are `input 0`, `input 1`, … — consecutive from zero, with a
  space in the name.
- The **Delay** is started from the page's `didMount` and restarted from the
  poke. Do not use `start` for the restart: it stacks a second countdown.

## Styling

- Colour and spacing parameters are set as `var(--token)` from the style
  vocabulary, never a raw hex or px — **except** on a parameter a step grades
  with `paramsEqual`. Every graded parameter here is a plain string or a unitless
  number (`duration`), which is what makes `paramsEqual` safe on them.
- `Nag` carries its `text` and NOT its `opacity`. See `docs/ARCHITECTURE.md` §5;
  both halves are load-bearing.
- Nothing uses `visible`. It keeps the element's space.

## Data

- No data. No Record, Query or Function nodes.
- No `For Each` and no `Static Data`. Those are `snacks`, and the outro hands
  them their opening problem.

## What not to do

- Do not set a parameter on a node this lesson does not create unless a step
  grades it. Ungraded parameters survive `derive_starter` into the starter, and
  the starter has to equal lesson 6's solution byte for byte.
- Do not touch `Mood`, `Mood Check` or `Is Happy`. Reading `Mood Check.isfalse`
  is an addition; changing anything on those three is not.
- Do not set `Pokes`' `startValue` or `Ignored`'s `onFromStart`. Both are used as
  measurement controls and must ship at their defaults.

## Established during scoping

- Only additions. No step grades a parameter lesson 6 already set.
- Every parameter on a node this lesson creates is one a step asks for.
