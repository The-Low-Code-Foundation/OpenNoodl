---
title: "Number Remapper"
---
Linearly maps a number from one range to another, optionally clamped — e.g. 0–100 progress to 0–1 opacity.

Number Remapper converts `inputValue` (Input Value) from the input range [`minInputValue` (Input Minimum), `maxInputValue` (Input Maximum)] to the output range [`minOutputValue` (Output Minimum, default 0), `maxOutputValue` (Output Maximum, default 1)] with straight linear interpolation, writing the result to the `remappedValue` (Remapped Value) number output. With `clamp` (Clamp Output, default true) the normalized position is limited to 0…1 so the output never leaves the output range; with clamping off, values outside the input range extrapolate. Ranges may be inverted (min greater than max) to reverse direction. If the input range is empty (minimum equals maximum) the output is pinned to `minOutputValue`. Every input recomputes the output immediately.

## When to use it

The no-code way to scale a value between domains: a count to a progress-bar width, a scroll position to an opacity, a slider value to a rotation. For non-linear curves or multi-input math use Expression or a Function.

## At a glance

| | |
|---|---|
| Category | Math |
| Type name | `Number Remapper` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `clamp` | Boolean | `true` | Holds the result inside the output range when Input Value falls outside the input range, instead of extrapolating |
| `inputValue` | Number | `0` | Number to remap, read against Input Minimum and Input Maximum |
| `maxInputValue` | Number | `1` | Value of Input Value that maps to Output Maximum; set equal to Input Minimum and the result is pinned at Output Minimum for every input |
| `maxOutputValue` | Number | `1` | Result when Input Value is at Input Maximum |
| `minInputValue` | Number | `0` | Value of Input Value that maps to Output Minimum |
| `minOutputValue` | Number | `0` | Result when Input Value is at Input Minimum |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `remappedValue` | Number | — | Input Value rescaled from the input range onto the output range |

## Patterns

- Counter `currentCount` → `inputValue` with the output range sized in pixels → a Group's `width`: a value-driven fill bar.
- Scroll position → `inputValue`, output range 1…0 → `opacity`: fade an element out as the user scrolls.

## Watch out for

- Leaving Input Minimum and Input Maximum both at 0 — the output sits at Output Minimum no matter what comes in; set a real input range.

## Examples

**Quantity stepper: Counter with remapped and formatted readouts**

Two buttons drive a Counter up and down within limits. The count feeds three displays: a String Format caption ('{count} items'), a String Mapper that maps special values to words (0 → 'empty'), and a Number Remapper converting the 0–10 range into 0.2–1 opacity for a fill indicator. Counter holds the state; the display nodes are pure value-shaping between it and the UI.

## Related nodes

[Counter](./counter.md), [Expression](../custom-code/expression.md), [Animation](../animation/animation.md), [Number](../variables/number.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
