---
title: "Animate To Value"
---
Animate To Value: tweens its output toward whatever targetValue currently is, with duration, delay and easing.

Animate To Value is the current general-purpose tween. Whenever `targetValue` changes, `currentValue` animates from wherever it is to the new target over `duration` ms with the chosen `easingCurve`; `atTargetValue` fires on arrival. It is retarget-safe: changing the target mid-flight redirects the animation smoothly instead of jumping.

## When to use it

Smoothing any numeric change: positions, opacity, blend values for Color Blend. It supersedes the deprecated Transition/Animation nodes. For multi-property, state-shaped animation use States with transitions.

## At a glance

| | |
|---|---|
| Category | Animation |
| Type name | `net.noodl.animatetovalue` |
| Available in | browser |
| SSR compatibility | partial — The scheduler clock is frozen during server render; the value stays at its start and Finished never fires there. |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `delay` | Number | `0` | How long to wait before the move begins, in milliseconds |
| `duration` | Number | `300` | How long the move takes, in milliseconds |
| `easingCurve` | Enum (`easeOut`, `easeIn`, `linear`, `easeInOut`) | `easeOut` | Shape of the movement between where the value is and Target Value |
| `targetValue` | Number | — | Value to move towards; the first one to arrive is adopted outright rather than animated to |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `currentValue` | Number | — | Where the move has got to, updated every frame while it runs |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `atTargetValue` | Signal | — | Fires when the value settles on Target Value, and not at all if a new target interrupted it |

## Patterns

- Boolean state → (boolean→number cast) → `targetValue`: a two-state tween in one wire.
- `currentValue` → Color Blend `blendValue`: animated color transitions.

## Examples

**Hover highlight: Animate To Value driving a Color Blend**

The smooth-hover idiom: the card's `hoverStart`/`hoverEnd` signals flip a Switch, whose boolean (cast to 0/1) becomes the `targetValue` of Animate To Value — the node tweens `currentValue` toward the target whenever it changes. That animated 0→1 feeds Color Blend's `blendValue`, interpolating between its configured colors, and the result drives the card background. State, easing and color are three separate concerns in three small nodes.

## Related nodes

[States](./states.md), [Color Blend](../interpolation/color-blend.md), [Switch](../logic/switch.md), [Number Remapper](../math/number-remapper.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
