---
title: "String Mapper"
---
Looks a string up in a configured key list and outputs the matching mapping — a wirable lookup table with a default.

String Mapper compares `inputString` (Input String) against its numbered "input N" entries (displayed Input 0, Input 1, …) using exact string equality. On a match, the `mappedString` (Mapped String) output takes the value of the "output N" entry with the same N (displayed Mapping 0, Mapping 1, … — these mappings are themselves inputs, despite the port name); with no match it takes `defaultMapping` (Default). All values are coerced to strings before comparison, and the mapping re-runs once per update cycle after any of its inputs change. Keys and mappings are usually typed in as parameters but can also be connected.

## When to use it

Use it to translate machine values into display text: status codes to labels, option keys to descriptions, locale keys to phrases. For just true/false use Boolean To String; for composing text with variables inside use String Format; for mappings that live in data rather than in the graph, use an Object or a Function.

## At a glance

| | |
|---|---|
| Category | Utilities |
| Type name | `String Mapper` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `defaultMapping` | String | — | Published when Input String matches none of the numbered inputs |
| `inputString` | String | — | The string to look up among the numbered inputs |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `mappedString` | String | — | The mapping paired with the input that matched, or Default when none did |

## Dynamic ports

_This node's port list changes at runtime (numbered-inputs); the tables above may be incomplete for a given instance._

Accepts an unbounded numbered series of inputs (see numberedInputs); ports are named "<base> <N>" counting from 0.

## Ports at runtime

Two numbered port series, both inputs, indexed from 0: keys are named "input 0", "input 1", … (group Inputs) and their mapped values are named "output 0", "output 1", … (group Mappings) — pair N maps key N to value N. The editor always offers the next unused index. An authoring tool typically writes both series as parameters (e.g. "input 0": "S", "output 0": "Small"), and may connect any of them.

## Patterns

- A Radio Button Group's `value` → `inputString`, mappings to human copy → a Text's `text`: option keys stay short and stable while the UI text stays editable in one place.

## Watch out for

- Using it for numeric ranges ('0-9' → 'low') — matching is exact equality only; use Expression or Condition chains for ranges.

## Examples

**Quantity stepper: Counter with remapped and formatted readouts**

Two buttons drive a Counter up and down within limits. The count feeds three displays: a String Format caption ('{count} items'), a String Mapper that maps special values to words (0 → 'empty'), and a Number Remapper converting the 0–10 range into 0.2–1 opacity for a fill indicator. Counter holds the state; the display nodes are pure value-shaping between it and the UI. ⚠️ This component has no `Component Inputs` or `Component Outputs`: nothing outside it can set the starting quantity or read the count back, so it is a demonstration of the value-shaping nodes rather than a part a page can use. `comp-controlled-quantity-stepper` is the same idea with an interface — `value` in, `value` and `valueChanged` out.

## Related nodes

[Boolean To String](./boolean-to-string.md), [String Format](../string-manipulation/string-format.md), [States](../animation/states.md), [Expression](../custom-code/expression.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
