---
title: "Switch"
---
A remembered on/off boolean, driven by On / Off / Flip signals — the graph's toggle and one-bit memory.

Switch stores a single boolean state. The `on` (On), `off` (Off) and `flip` (Flip) signal inputs change it; `onFromStart` (State) is a boolean value input that sets the state directly and provides its initial value (default false). The current state is always readable on the `state` (Current State) boolean value output, and every state change also fires signals: `switched` (Switched) on any change, plus `switchedToOn` or `switchedToOff` matching the new state. `on` and `off` are ignored when the state already matches, so they never re-fire the signals; `flip` always changes state.

## When to use it

The idiomatic node for anything a user toggles: expand/collapse, mute, edit mode. Use `state` (a level) to drive `visible`/`enabled`-style inputs, and the switched signals only when something must happen at the moment of change. For more than two states use States; for deriving a boolean from data rather than events, use Condition or Expression.

## At a glance

| | |
|---|---|
| Category | Logic |
| Type name | `Switch` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `onFromStart` | Boolean | `false` | State to start in, and setting it announces a switch on Switched even though nothing switched |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `flip` | Signal | — | Switches to whichever state it is not currently in |
| `off` | Signal | — | Switches off, or fires Unchanged if it is already off |
| `on` | Signal | — | Switches on, or fires Unchanged if it is already on |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `state` | Boolean | — | True while the switch is on — wire it into a mounted or visible port for a gate that turns on AND off |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires when the switch actually changed state |
| `switched` | Signal | — | Fires on every state change, alongside whichever of Switched To On and Switched To Off applies |
| `switchedToOff` | Signal | — | Fires when the switch becomes off |
| `switchedToOn` | Signal | — | Fires when the switch becomes on |
| `unchanged` | Signal | — | Fires when it was already in that state, so none of the Switched signals fired |

## Patterns

- Button `onClick` → `flip`, `state` → a Group's `visible`: the standard show/hide toggle.
- `state` → Boolean To String `input` → the toggling button's `label`: the button describes what it will do next.

## Watch out for

- Wiring `switchedToOn` (a momentary signal) to a boolean input like `visible` — it delivers only a pulse; use `state` for anything that must stay on.

## Examples

**Toggle a details panel with a self-labelling button**

The standard show/hide toggle: one button flips a Switch, and everything else derives from the Switch's boolean `state` as levels — the details Group's visibility directly, the summary text's visibility through an Inverter (visible only while collapsed), and the button's own label through Boolean To String so the button always names what it will do next. Note the split of flow kinds: `onClick` → `flip` is a signal (momentary), while every `state`-derived wire is a value that holds its level.

**Record audio in the browser and save it**

The full arc of a MediaRecorder capture, which is longer than it looks because three different things have to be true before a single byte is recorded. A `JavaScriptFunction` asks for microphone permission and a `Switch` gates everything on the answer; a `Javascript2` node owns the recorder itself and accumulates chunks; a second one runs the seconds counter; a third converts the finished `Blob` into the shape `NewDbModelProperties` can store. ⚠️ Permission is asynchronous and revocable, which is why the gate is a node and not an assumption — a recorder started before the user has answered produces silence rather than an error. The preview player is a Custom HTML node because an `<audio>` element with a blob URL is the shortest honest way to play back something that has no file yet.

**Blink a button, and stop cleanly**

A strobe is a good miniature of a hard problem: something that keeps running after the signal that started it, and therefore has to be stopped by something other than the thing that started it. A `Javascript2` node owns the interval, a `Switch` turns it on and off, a `States` node carries the two appearances, and a `Number` makes the period an input instead of a literal. ⚠️ The half people leave out is the reset — stopping an interval without restoring the state leaves the button frozen in whichever half of the blink it happened to be in, which looks like a different bug entirely. This one restores it.

## Related nodes

[Condition](./condition.md), [States](../animation/states.md), [Inverter](./inverter.md), [Boolean To String](../utilities/boolean-to-string.md), [Value Changed](./value-changed.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
