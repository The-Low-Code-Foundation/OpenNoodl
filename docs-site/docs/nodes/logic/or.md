---
title: "Or"
---
Logical OR over any number of boolean inputs: Result is true while at least one connected input is true.

Or combines an unbounded series of boolean inputs into one boolean `result` (Result) value output, which is true while any input is truthy. Inputs are coerced with plain JavaScript truthiness, so an input that has never received a value counts as false, and with nothing connected the result is false. Whenever any input changes, the result is recomputed and pushed downstream. It is a pure value node with no signals and no state of its own.

## When to use it

Use it when any one of several conditions should be enough — e.g. show a section if either of two checkboxes is ticked. For 'all of' semantics use And; for negating one boolean use Inverter; for conditions that need comparisons or arithmetic first, compute them in an Expression and combine here.

## At a glance

| | |
|---|---|
| Category | Logic |
| Type name | `Or` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `result` | Boolean | — | True while at least one connected input is true; false when no input is connected at all |

## Dynamic ports

_This node's port list changes at runtime (numbered-inputs); the tables above may be incomplete for a given instance._

Accepts an unbounded numbered series of inputs (see numberedInputs); ports are named "<base> <N>" counting from 0.

## Ports at runtime

Inputs are numbered ports named "input 0", "input 1", … counting from 0 (displayed as "Input 0", "Input 1"). The editor always offers one more port than is currently connected, so connecting to the highest port makes the next one appear. An authoring tool should connect booleans to "input N" names, using consecutive indices starting at 0.

## Patterns

- Several error booleans → "input 0", "input 1", … with `result` → an error banner's `visible`: show it while anything is wrong.
- `result` → Inverter → `enabled`: disable an action while any blocker is active.

## Examples

**Gate a button on all required checks, reveal a note on any optional one**

And and Or as pure boolean-value combiners over numbered inputs. Two required checkboxes feed an And node's "input 0" and "input 1"; its `result` drives the submit button's `enabled` as a level, so the button enables the instant both are ticked and disables again if either is cleared. Two optional email checkboxes feed an Or the same way; its `result` shows an explanatory note while at least one is ticked. No signals are involved — everything here is level logic.

## Related nodes

[And](./and.md), [Inverter](./inverter.md), [Condition](./condition.md), [Expression](../custom-code/expression.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
