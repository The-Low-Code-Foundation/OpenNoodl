# Conventions

## How this file is used

The rules below are read by the assistant on **every authoring turn**, and they
outrank its own defaults. Editing this file changes what gets built.

Write rules that are checkable. "Make it nice" is not a rule; "every page's
outermost node is a Group named `Page Root`" is.

## Structure

- The tree is exactly the one in `docs/ARCHITECTURE.md`. Everything except
  `Mood Line`, `Is Happy`, `Mood Check` and `Mood` belongs to lessons 1-5 and is
  not edited here.
- Logic nodes have no parent and sit in a column to the right of the visual node
  they feed.

## Naming

- Every node carries an explicit label, because lesson conditions address nodes
  by `#Label` and type-only addressing is an F3 ambiguity risk.
- 🔴 A `States` node's state names and value names become **port names**
  (`to-<state>`, `value-<state>-<value>`, and `<value>` as an output). They are
  split on `-`, so no state or value name may contain a hyphen, and no value may
  be called `failure`, `stateChanged`, `done`, `unchanged` or `completed`
  (`RESERVED_OUTPUTS`, `states.ts:119`).

## Wiring

- 🔴 **Take an `Expression`'s boolean from `isTrue`, never from `asBoolean`.**
  `asBoolean` is one of the three outputs never flagged dirty
  (`expression.ts:238-240`), so a wire from it delivers one reading and never
  updates. Inherited from lesson 5, row G1, and it applies to the boolean case
  exactly as it applied to the number case.
- 🔴 **A `States` node is moved by signals, not by values.** `to-<state>` are
  signal inputs; there is no "set the state to this boolean" port. That is why
  the `Condition` is between the comparison and the states rather than the
  comparison being wired straight in.
- `Condition`'s **Evaluate** is left unwired. It is additive to testing on change
  (`condition.ts`, NDA-017 §2), not a replacement for it, and a lesson that wired
  it would teach the trap the port's description exists to correct.

## Styling

- Colour and spacing parameters are set as `var(--token)` from the style
  vocabulary, never a raw hex or px — **except** on a parameter a step grades
  with `paramsEqual`. A learner types into the panel, so a graded value has to be
  the shape a learner produces. Every graded parameter here is a plain string.
- `Mood Line` carries NO `text` parameter. See `docs/ARCHITECTURE.md` §3; this
  one is load-bearing, not a style choice.

## Data

- No data. No Record, Query or Function nodes.
- No **And**, **Or**, **Inverter** or **Timer**. Those are `it-gets-demanding`,
  and using one here would spend the next lesson's idea.

## What not to do

- Do not set a parameter on a node this lesson does not create unless a step
  grades it. Ungraded parameters survive `derive_starter` into the starter, and
  the starter has to equal lesson 5's solution byte for byte.
- Do not change `Caption`'s `format`. It is lesson 5's graded parameter; grading
  it again would retract it from this lesson's starter and break the chain. The
  plural stays wrong, and `docs/BRIEF.md` says so out loud.
- Do not set `Pokes`' `startValue`. It is used as a measurement control (see
  `docs/ARCHITECTURE.md` §3) and must ship at its default.

## Established during scoping

- Only additions. No step grades a parameter lesson 5 already set.
- Every parameter on a node this lesson creates is one a step asks for, so the
  learner's result matches the answer.
