---
title: "Transition"
---
:::warning Deprecated
This node is deprecated and kept only so existing projects keep working. It is not offered in the node picker for new use.
:::

Deprecated single-value tween. Use Animate To Value (net.noodl.animatetovalue) in new graphs.

The legacy Transition node tweens `currentValue` toward `targetValue` with duration/delay/easing — the same contract Animate To Value now provides, plus an override-current-value pair for jumping mid-flight. Deprecated and hidden from the picker.

## When to use it

Do not use in new graphs — use net.noodl.animatetovalue instead.

## At a glance

| | |
|---|---|
| Category | Animation |
| Type name | `Transition` |
| Available in | browser |
| SSR compatibility | partial — The scheduler clock is frozen during server render; the transition does not animate or complete there. |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `delay` | Number | `0` | How long to wait before the move begins, in milliseconds |
| `duration` | Number | `300` | How long the move takes, in milliseconds |
| `easingCurve` | Enum (`easeOut`, `easeIn`, `linear`, `easeInOut`) | `easeOut` | Shape of the movement between where the value is and Target Value |
| `overrideCurrentValue.value` | Number | — | Value to jump straight to when Do fires, without animating |
| `targetValue` | Number | — | Value to move towards; the first one to arrive is adopted outright rather than animated to |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `overrideCurrentValue.do` | Signal | — | Jumps Current Value to Override Value and carries on towards Target Value from there |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `currentValue` | Number | — | Where the move has got to, updated every frame while it runs |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `atTargetValue` | Signal | — | Fires when the value settles on Target Value, and not at all if a new target interrupted it |

## Related nodes

[Animate To Value](./net-noodl-animatetovalue.md), [States](./states.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
