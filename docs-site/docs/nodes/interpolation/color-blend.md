---
title: "Color Blend"
---
Interpolates between configured colors as blendValue moves 0→1, outputting the mixed color.

Color Blend holds a list of colors (`color-0`, `color-1`, … per its `colors` count) and outputs on `result` the interpolation selected by `blendValue`: 0 is the first color, 1 the last, values between blend smoothly across the sequence. Feed `blendValue` from an animated source and the color animates.

## When to use it

Any color that should respond continuously to a value: hover highlights, scroll-linked tints, state colors with smooth transitions. For discrete color switches with no blending, States values are simpler.

## At a glance

| | |
|---|---|
| Category | Interpolation |
| Type name | `Color Blend` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `blendValue` | Number | `0` | Position along the colour list, where 1 is exactly Color 1 and 1.5 is halfway to Color 2; values outside the list are clamped |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `result` | Color | — | The blended colour as a hex string; the inputs must be 6-digit hex, since any other notation yields nonsense |

## Dynamic ports

_This node's port list changes at runtime (numbered-inputs); the tables above may be incomplete for a given instance._

Accepts an unbounded numbered series of inputs (see numberedInputs); ports are named "<base> <N>" counting from 0.

## Ports at runtime

Numbered inputs: the `colors` count parameter generates `color-N` inputs (numbered-inputs mechanism); only `blendValue` is static.

## Patterns

- Animate To Value `currentValue` → `blendValue` → a background color: the corpus's standard smooth-hover wiring (Color Blend → color inputs appears 21× in real projects).

## Examples

**Hover highlight: Animate To Value driving a Color Blend**

The smooth-hover idiom: the card's `hoverStart`/`hoverEnd` signals flip a Switch, whose boolean (cast to 0/1) becomes the `targetValue` of Animate To Value — the node tweens `currentValue` toward the target whenever it changes. That animated 0→1 feeds Color Blend's `blendValue`, interpolating between its configured colors, and the result drives the card background. State, easing and color are three separate concerns in three small nodes.

## Related nodes

[Animate To Value](../animation/net-noodl-animatetovalue.md), [States](../animation/states.md), [Switch](../logic/switch.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
