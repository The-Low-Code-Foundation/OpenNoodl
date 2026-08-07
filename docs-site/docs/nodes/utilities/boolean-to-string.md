---
title: "Boolean To String"
---
Picks between two strings based on a boolean: outputs String for true or String for false.

Boolean To String selects one of two configured strings using the boolean `input` (Selector): while the selector is true, `currentValue` (Current Value) is `trueString` (String for true); otherwise it is `falseString` (String for false). The output updates whenever the selector or the currently selected string changes, and `inputChanged` (Selector Changed) fires as a signal each time the selector itself flips. Both strings are usually set as parameters but can also be connected.

## When to use it

Use it to turn app state into UI copy: a toggle button's label, an on/off status caption, a yes/no cell. For mapping more than two cases, use String Mapper (string keys) or States; for text with variable parts inside it, use String Format.

## At a glance

| | |
|---|---|
| Category | Utilities |
| Type name | `Boolean To String` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `falseString` | String | — | Text published on Current Value while Selector is false |
| `input` | Boolean | — | Which of the two strings to publish; anything that is not true counts as false |
| `trueString` | String | — | Text published on Current Value while Selector is true |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `currentValue` | String | — | String for true or String for false, whichever Selector currently picks |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `inputChanged` | Signal | — | Fires when Selector flips, after Current Value has been updated |

## Patterns

- Switch `state` → `input`, `currentValue` → the same toggle button's `label`: the button always names the action it will perform next.

## Examples

**Toggle a details panel with a self-labelling button**

The standard show/hide toggle: one button flips a Switch, and everything else derives from the Switch's boolean `state` as levels — the details Group's visibility directly, the summary text's visibility through an Inverter (visible only while collapsed), and the button's own label through Boolean To String so the button always names what it will do next. Note the split of flow kinds: `onClick` → `flip` is a signal (momentary), while every `state`-derived wire is a value that holds its level.

## Related nodes

[String Mapper](./string-mapper.md), [String Format](../string-manipulation/string-format.md), [Switch](../logic/switch.md), [Condition](../logic/condition.md), [States](../animation/states.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
