---
title: "Counter"
---
A number you step up and down with signals, with optional min/max limits and a reset.

Counter holds a number, exposed on `currentCount` (Current Count). The `increase` (Increase Count) and `decrease` (Decrease Count) signal inputs step it by exactly 1; `reset` (Reset To Start) puts it back to `startValue` (Start Value, default 0), which is also the initial count. When `limitsEnabled` (Limits Enabled) is true, an `increase` at or above `limitsMax` (Max Value) and a `decrease` at or below `limitsMin` (Min Value) are ignored entirely — the count does not change and `countChanged` does not fire. Every actual change fires the `countChanged` (Count Changed) signal after `currentCount` has been updated.

## When to use it

Use it for user-driven tallies: quantity steppers, pagination cursors, wizard step tracking. For arbitrary arithmetic (step sizes other than 1, computed values) use Expression or a Function; for a persistent number shared across components use a Variable or an Object.

## At a glance

| | |
|---|---|
| Category | Math |
| Type name | `Counter` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `limitsEnabled` | Boolean | `false` | Whether Min Value and Max Value bound the count; without it the count runs unbounded in both directions |
| `limitsMax` | Number | `0` | Highest count Increase will reach, ignored unless Limits Enabled |
| `limitsMin` | Number | `0` | Lowest count Decrease will reach, ignored unless Limits Enabled |
| `startValue` | Number | `0` | Count to begin at and to return to on Reset; setting it announces a change on Count Changed at page load |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `decrease` | Signal | — | Subtracts one from the count, or does nothing at all when Limits Enabled and the count is already at Min Value |
| `increase` | Signal | — | Adds one to the count, or does nothing at all when Limits Enabled and the count is already at Max Value |
| `reset` | Signal | — | Puts the count back to Start Value, or reports Unchanged and leaves Count Changed silent when it is already there |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `currentCount` | Number | — | The count as it stands |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `countChanged` | Signal | — | Fires after the count has moved, and also once at page load when Start Value is set |
| `done` | Signal | — | Fires when the count actually moved |
| `unchanged` | Signal | — | Fires when nothing moved: Limits Enabled held the count at Min or Max, or Reset was pressed on a count already at Start Value |

## Patterns

- Plus/minus buttons' `onClick` → `increase`/`decrease` with limits enabled: a bounded quantity stepper.
- `currentCount` → a String Format input: display the count inside a sentence without a Function node.

## Watch out for

- Polling `currentCount` to react to changes — wire `countChanged` (signal) or `currentCount` (value) directly; the node already pushes updates.

## Examples

**Quantity stepper: Counter with remapped and formatted readouts**

Two buttons drive a Counter up and down within limits. The count feeds three displays: a String Format caption ('{count} items'), a String Mapper that maps special values to words (0 → 'empty'), and a Number Remapper converting the 0–10 range into 0.2–1 opacity for a fill indicator. Counter holds the state; the display nodes are pure value-shaping between it and the UI.

## Related nodes

[Number](../variables/number.md), [Expression](../custom-code/expression.md), [Number Remapper](./number-remapper.md), [String Format](../string-manipulation/string-format.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
