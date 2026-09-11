---
title: "Condition"
---
Boolean gate: routes an evaluation into On True / On False signals and holds Is True / Is False as readable booleans.

Condition watches a single boolean input and exposes it in two forms: as level outputs (`result`/Is True and `isfalse`/Is False, plain booleans that always reflect the current state) and as event outputs (`ontrue`/On True and `onfalse`/On False, signals that fire when the condition is evaluated). Evaluation happens when the `condition` input changes, or on demand when the `eval` (Evaluate) signal is triggered — the idiomatic way to gate an action behind a check at the moment a user acts.

## When to use it

Use it to branch signal flow ('when clicked, proceed only if valid') or to derive a visible/enabled boolean and its inverse from one condition. For choosing between more than two cases use Switch or States; for combining several booleans first, feed it from And/Or or an Expression.

## At a glance

| | |
|---|---|
| Category | Logic |
| Type name | `Condition` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `condition` | Boolean | — | Value to test for truth; it is re-tested on every change unless you untick it below |
| `runOnChange-condition` | Boolean | `true` | Whether a new value on Condition re-runs this node. On by default; untick to make this input passive so only the control signal runs it |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `eval` | Signal | — | Tests Condition now. This is additional to Condition re-testing on change; untick it under Run On Value Change to stop that |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `isfalse` | Boolean | — | The opposite of Is True, so a false branch needs no Inverter; null until the first test |
| `result` | Boolean | — | Whether the last test found Condition true, for wiring into a value rather than branching on a signal; null until the first test. If Condition is a constant, every test pushes the same value — a mounted gate wired that way only ever turns on; a Switch is the two-way shape |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation. This node has no other outcome — no Unchanged and no Failure — so it always fires together with Done, and wiring either one does the same thing. It is here on every action so that reaching for it is never a per-node decision |
| `done` | Signal | — | Fires once an Evaluate you triggered has tested Condition, after On True or On False |
| `onfalse` | Signal | — | Fires each time Condition is tested and found false, including while Condition has never been set |
| `ontrue` | Signal | — | Fires each time Condition is tested and found true — exactly one of On True and On False fires per test |

## Patterns

- Button `onClick` → `eval`, with `ontrue` driving the action: gate an action behind a validity check at click time.
- `isfalse` → a message's `visible`: show an error as a level rather than pulsing it with a signal.

## Watch out for

- Wiring `ontrue` (signal) to a boolean input like `visible` delivers only a momentary pulse — use `result` for anything that must stay on.

## Examples

**Validate an input before acting on a click**

The idiomatic gate shape: a Button click does not act directly — it evaluates a Condition. The Condition's boolean comes from an Expression that checks the text input's current value, so the same click either proceeds (ontrue) or reveals an error message (isfalse drives the error Text's visibility as a level, not a pulse). Note the two kinds of flow: text/booleans are values, onClick/eval/ontrue are momentary signals.

## Related nodes

[And](./and.md), [Or](./or.md), [Inverter](./inverter.md), [Switch](./switch.md), [Expression](../custom-code/expression.md), [States](../animation/states.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
