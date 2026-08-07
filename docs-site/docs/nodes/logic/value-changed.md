---
title: "Value Changed"
---
Turns value changes into events: fires a signal every time its input receives a different value.

Value Changed watches one input of any type (`value`, displayed as Input) and fires the `valueChanged` (Value Changed) signal each time the incoming value differs from the last one it saw — including the very first value it receives. Comparison uses strict equality, so for objects and arrays a change means a different reference, not a mutation of the same object. It is the bridge from the value world (levels) to the signal world (events).

## When to use it

Use it when something must happen at the moment data changes: restart a debounce Timer while the user types, re-run a Function when a selection changes, or trigger a save when a field updates. If you only need the value itself downstream, connect the value directly — no node needed. If you care about a boolean becoming true specifically, connect the boolean straight to a signal input (rising-edge trigger) instead.

## At a glance

| | |
|---|---|
| Category | Logic |
| Type name | `Value Changed` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `value` | * | — | Value to watch; changes are detected by identity, so editing an Object or Array in place is not a change here |

## Outputs

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `valueChanged` | Signal | — | Fires when Input becomes a different value, including the first time it arrives |

## Patterns

- A text input's `text` → `value`, `valueChanged` → a Timer's `restart`: debounce — the Timer only finishes once typing pauses.
- `valueChanged` → an Event Sender's `sendEvent`: broadcast that a piece of state changed.

## Watch out for

- Using it to detect a boolean turning true — it also fires on true→false. Connect the boolean directly to the target signal input (edge-triggered) or use Condition.

## Examples

**Debounced autosave with timestamped status**

The debounce idiom: every keystroke fires Value Changed, whose signal restarts a 1.5-second Timer — the save only runs when the user pauses. The save Function stamps the moment; Date To String formats it, Unique Id issues a save id shortened by Substring, and String Format assembles the status line. Signals sequence the flow; values shape the display.

## Related nodes

[Condition](./condition.md), [Switch](./switch.md), [Delay](../utilities/timer.md), [Expression](../custom-code/expression.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
