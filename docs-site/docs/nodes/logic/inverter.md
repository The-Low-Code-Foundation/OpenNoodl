---
title: "Inverter"
---
Logical NOT: outputs the boolean opposite of its input.

Inverter takes one boolean `value` (Value) input and exposes its negation on the `result` (Result) value output. Until the input has received a value, the result is undefined rather than true — the node does not invent a state before it has one. Any change to the input immediately updates the result. It has no signals and no configuration.

## When to use it

Use it wherever you have the boolean you need, but backwards — e.g. a Switch's `state` drives a panel's `visible` and, inverted, a placeholder's `visible`. If the boolean comes from a Condition, prefer its built-in `isfalse` output and skip the Inverter. For combining several booleans, use And/Or or an Expression.

## At a glance

| | |
|---|---|
| Category | Logic |
| Type name | `Inverter` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `value` | Boolean | — | Value to negate; anything falsy counts as false, and leaving it unset keeps Result unset too |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `result` | Boolean | — | The opposite of Value, and unset rather than true while Value has never been set |

## Patterns

- A 'is loading' boolean → Inverter → a button's `enabled`: disable actions while busy.
- Switch `state` → Inverter → the collapsed view's `visible`: show exactly one of two views from a single boolean.

## Watch out for

- Chaining Condition → Inverter to get 'is false' — Condition already outputs `isfalse` directly.

## Examples

**Toggle a details panel with a self-labelling button**

The standard show/hide toggle: one button flips a Switch, and everything else derives from the Switch's boolean `state` as levels — the details Group's visibility directly, the summary text's visibility through an Inverter (visible only while collapsed), and the button's own label through Boolean To String so the button always names what it will do next. Note the split of flow kinds: `onClick` → `flip` is a signal (momentary), while every `state`-derived wire is a value that holds its level.

## Related nodes

[And](./and.md), [Or](./or.md), [Condition](./condition.md), [Switch](./switch.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
