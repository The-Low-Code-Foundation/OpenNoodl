---
title: "Delay"
---
Delay: fires a Finished signal a set number of milliseconds after being started; restartable for debouncing.

Timer (displayed as Delay) turns one signal into a later signal. Triggering `start` (Start) begins a countdown of `duration` milliseconds (after an optional `startDelay`, also milliseconds); when it completes, `timerFinished` (Finished) fires. `timerStarted` (Started) fires at the moment the countdown actually begins. `start` does nothing while the timer is already running, whereas `restart` (Restart) always begins the countdown again from zero — that difference is what makes `restart` the debounce input. `stop` (Stop) cancels a running countdown without firing `timerFinished`. With the default `duration` of 0 the finish fires on the next tick, which still defers the signal until after the current update.

## When to use it

Use it to defer an action (auto-dismiss a toast, poll once after mount) or, via `restart`, to debounce a noisy source such as typing. For repeating ticks, loop `timerFinished` back into `restart`. For animating a value over time use Animation instead — Timer carries no value, only timing.

## At a glance

| | |
|---|---|
| Category | Utilities |
| Type name | `Timer` |
| Available in | browser |
| SSR compatibility | partial — The scheduler clock is frozen during server render, so Started/Finished never fire there; do not gate Page Ready on a Delay. |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `duration` | Number | `0` | How long the countdown runs before Finished fires, in milliseconds |
| `startDelay` | Number | `0` | How long to wait after Start before the countdown begins, in milliseconds |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `restart` | Signal | — | Begins the countdown again from zero, whether or not one is already running |
| `start` | Signal | — | Starts the countdown, or fires Unchanged while one is already running — use Restart to begin again |
| `stop` | Signal | — | Abandons the countdown, so Finished never fires for it |

## Outputs

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires when the action changed what the timer was doing |
| `timerFinished` | Signal | — | Fires once Duration has elapsed, and not at all for a countdown that was stopped |
| `timerStarted` | Signal | — | Fires when the countdown begins, once Start Delay has elapsed |
| `unchanged` | Signal | — | Fires on a Start while one is already running, or a Stop with nothing running |

## Patterns

- Value Changed `valueChanged` → `restart`, act on `timerFinished`: debounce — the action runs only after the input has been quiet for `duration` ms.
- `timerFinished` → its own `restart`: a simple repeating tick.

## Watch out for

- Using `start` for debouncing — while running it ignores triggers, so the action fires on the first quiet gap after the *first* event, not the last. Use `restart`.
- Treating `duration` as seconds — it is milliseconds.

## Examples

**Debounced autosave with timestamped status**

The debounce idiom: every keystroke fires Value Changed, whose signal restarts a 1.5-second Timer — the save only runs when the user pauses. The save Function stamps the moment; Date To String formats it, Unique Id issues a save id shortened by Substring, and String Format assembles the status line. Signals sequence the flow; values shape the display.

## Related nodes

[Value Changed](../logic/value-changed.md), [Animation](../animation/animation.md), [States](../animation/states.md), [Switch](../logic/switch.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
