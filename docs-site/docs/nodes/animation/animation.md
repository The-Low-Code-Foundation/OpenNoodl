---
title: "Animation"
---
:::warning Deprecated
This node is deprecated and kept only so existing projects keep working. It is not offered in the node picker for new use.
:::

Deprecated keyframe animation player. Use States (with transitions) or Animate To Value in new graphs.

The legacy Animation node plays an editor-authored keyframe animation over its target values, with play/jump/replay signal controls in both directions. It is deprecated and hidden from the node picker; States covers state-shaped animation and Animate To Value covers single-value tweens.

## When to use it

Do not use in new graphs — use States or net.noodl.animatetovalue instead.

## At a glance

| | |
|---|---|
| Category | Animation |
| Type name | `Animation` |
| Available in | browser |
| SSR compatibility | partial — The scheduler clock is frozen during server render; animations do not run or complete there. |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `cubicBezierP1X` | Number | — | First control point along the time axis, clamped between 0 and 1; used only when Easing Curve is Cubic Bezier |
| `cubicBezierP1Y` | Number | — | First control point along the value axis, where beyond 0 and 1 overshoots; used only when Easing Curve is Cubic Bezier |
| `cubicBezierP2X` | Number | — | Second control point along the time axis, clamped between 0 and 1; used only when Easing Curve is Cubic Bezier |
| `cubicBezierP2Y` | Number | — | Second control point along the value axis, where beyond 0 and 1 overshoots; used only when Easing Curve is Cubic Bezier |
| `duration` | Number | `300` | How long a play takes, in milliseconds |
| `easingCurve` | Enum (`easeOut`, `easeIn`, `linear`, `easeInOut`, `cubicBezier`) | `easeOut` | Shape of the movement between each value's start and end |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `jumpToEnd` | Signal | — | Sets every value to its end value with no animation |
| `jumpToStart` | Signal | — | Sets every value to its start value with no animation |
| `playToEnd` | Signal | — | Animates every value from where it is now to its end value |
| `playToStart` | Signal | — | Animates every value from where it is now to its start value |
| `replayToEnd` | Signal | — | Animates every value from its start value to its end value, wherever it is now |
| `replayToStart` | Signal | — | Animates every value from its end value to its start value, wherever it is now |
| `stop` | Signal | — | Abandons the play in progress, leaving every animated output unset |

## Outputs

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `hasReachedEnd` | Signal | — | Fires when a play towards the end values has finished |
| `hasReachedStart` | Signal | — | Fires when a play towards the start values has finished |

## Dynamic ports

_This node's port list changes at runtime (declared-port-groups, runtime-discovered); the tables above may be incomplete for a given instance._

Declares conditional/expandable port groups whose visibility depends on parameter values (see declaredPortGroups). Some ports are discovered at runtime from user code, parameters or connected components, and are pushed to the editor per instance; the static port list below is incomplete for such instances.

| Condition | Inputs shown | Outputs shown |
|---|---|---|
| easingCurve = cubicBezier | `cubicBezierP1X`, `cubicBezierP1Y`, `cubicBezierP2X`, `cubicBezierP2Y` | — |
| — | — | — |
| '{{portname}}.startMode' = explicit | — | — |

## Ports at runtime

Animated value outputs are runtime-registered from the keyframe tracks authored on the node instance; easing ports swap by curve type (declared-port-groups).

## Related nodes

[States](./states.md), [Animate To Value](./net-noodl-animatetovalue.md), [Color Blend](../interpolation/color-blend.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
