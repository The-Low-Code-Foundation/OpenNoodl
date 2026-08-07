---
title: "And"
---
Logical AND over any number of boolean inputs: Result is true only while every connected input is true.

And combines an unbounded series of boolean inputs into one boolean `result` (Result) value output. The result is true only when at least one input is connected and none of them is false — inputs are coerced with plain JavaScript truthiness, so an input that has never received a value counts as false. Whenever any input changes, the result is recomputed and pushed downstream. This is a pure value node: it has no signals and no memory beyond its inputs' latest values.

## When to use it

Use it to require several conditions at once — e.g. two checkboxes both ticked before enabling a button. For 'any of' semantics use Or; for a single negation use Inverter; for arithmetic or comparisons that produce the booleans in the first place, use Expression, then combine here (or fold the whole thing into one Expression if it reads better).

## At a glance

| | |
|---|---|
| Category | Logic |
| Type name | `And` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `result` | Boolean | — | True only while every connected input is true; false when no input is connected at all |

## Dynamic ports

_This node's port list changes at runtime (numbered-inputs); the tables above may be incomplete for a given instance._

Accepts an unbounded numbered series of inputs (see numberedInputs); ports are named "<base> <N>" counting from 0.

## Ports at runtime

Inputs are numbered ports named "input 0", "input 1", … counting from 0 (displayed as "Input 0", "Input 1"). The editor always offers one more port than is currently connected, so connecting to the highest port makes the next one appear. An authoring tool should connect booleans to "input N" names, using consecutive indices starting at 0.

## Patterns

- Several `checked` outputs → "input 0", "input 1", … with `result` → a button's `enabled`: require every consent before proceeding.
- `result` → a Condition's `condition` when you need signal outputs (fired on evaluation) instead of a level.

## Examples

**Gate a button on all required checks, reveal a note on any optional one**

And and Or as pure boolean-value combiners over numbered inputs. Two required checkboxes feed an And node's "input 0" and "input 1"; its `result` drives the submit button's `enabled` as a level, so the button enables the instant both are ticked and disables again if either is cleared. Two optional email checkboxes feed an Or the same way; its `result` shows an explanatory note while at least one is ticked. No signals are involved — everything here is level logic.

## Related nodes

[Or](./or.md), [Inverter](./inverter.md), [Condition](./condition.md), [Expression](../custom-code/expression.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
