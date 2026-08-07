---
title: "Number Blend"
---
:::warning Deprecated
This node is deprecated and kept only so existing projects keep working. It is not offered in the node picker for new use.
:::

Deprecated numbered-input number interpolator. Use Number Remapper or Animate To Value in new graphs.

The legacy Number Blend interpolates across its numbered `value-N` inputs as `blendValue` moves 0→1, with optional clamping — the numeric sibling of Color Blend. Deprecated: Number Remapper covers range mapping and Animate To Value covers animated values.

## When to use it

Do not use in new graphs — use Number Remapper (range mapping) or net.noodl.animatetovalue (tweening) instead.

## At a glance

| | |
|---|---|
| Category | Interpolation |
| Type name | `Number Blend` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `blendValue` | Number | `0` | Position along the number list, where 1 is exactly Number 1 and 1.5 is halfway to Number 2 |
| `clamp` | Boolean | `false` | Holds Blend Value inside the list rather than extrapolating past either end |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `result` | Number | — | The interpolated number |

## Dynamic ports

_This node's port list changes at runtime (numbered-inputs); the tables above may be incomplete for a given instance._

Accepts an unbounded numbered series of inputs (see numberedInputs); ports are named "<base> <N>" counting from 0.

## Ports at runtime

The `value-N` inputs are generated from the configured count (numbered-inputs mechanism).

## Related nodes

[Number Remapper](../math/number-remapper.md), [Animate To Value](../animation/net-noodl-animatetovalue.md), [Color Blend](./color-blend.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
