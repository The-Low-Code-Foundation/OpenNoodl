---
title: "States"
---
Named state machine: define states and values, set each value per state, and outputs switch or tween when the state changes.

States is configured with two editable lists: `states` (state names, e.g. 'Hidden,Shown') and `values` (value names, e.g. 'opacity,tint'). From these the editor generates ports: each value becomes an output whose current setting depends on the active state, and each state gets ports to enter it and observe it. On a state change every value output updates — number and color values tween along per-state transition curves (default 300 ms ease-out bezier), while string, boolean and textStyle values switch instantly. The first state in the list is the initial state; it is applied at startup without firing `stateChanged`. This is the idiomatic node for coordinated show/hide and multi-property animations.

## When to use it

Reach for States whenever several properties must change together between named modes (open/closed, idle/loading/done) — it replaces the deprecated Animation and Transition nodes. For animating a single number toward a moving target use net.noodl.animatetovalue; for pure branching logic with no animated values use Condition or Switch.

## At a glance

| | |
|---|---|
| Category | Animation |
| Type name | `States` |
| Available in | browser |
| SSR compatibility | partial — The scheduler clock is frozen during server render; state transitions do not animate or complete there. |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `states` | Stringlist | — | Names of the states this node can be in; the node starts in the first |
| `useTransitions` | Boolean | `true` | Whether a state change animates its values or jumps straight to them |
| `values` | Stringlist | — | Names of the values that differ between states, each becoming an output |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `toggle` | Signal | — | Moves to the next state in the list, wrapping round after the last |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `currentState` | String | — | Which state the node is in now |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once a Toggle or To <state> you triggered has moved the node, after State Changed |
| `stateChanged` | Signal | — | Fires on every state change except entering the first, which is where the node starts |
| `unchanged` | Signal | — | Fires when the node is already in the state you asked for, or already heading there in this pass |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Which state was asked for and which ones this node actually has |
| `failure` | Signal | — | Fires when a state was asked for that this node does not have, leaving it where it was |

## Dynamic ports

_This node's port list changes at runtime (runtime-discovered); the tables above may be incomplete for a given instance._

Ports are generated from the "states" and "values" parameters: each value gets per-state value inputs and a current-value output, each state gets an activation signal input and reached/left signal outputs.

## Ports at runtime

All state- and value-specific ports are runtime-discovered: the viewer generates them from the `states` and `values` parameters and pushes them to the editor per instance. For each value V: an output named `V` (connections only; type chosen by a generated enum input `type-V` — number, string, boolean, color or textStyle, default number). For each state S and value V: an input `value-S-V` holding V's setting while in state S. For each state S: a signal input `to-S` (go to S), a boolean output `at-S` (true while S is active), a signal output `reached-S` (fires when the transition into S completes — immediately when there is no transition), and, while `useTransitions` is on, a curve input `transitiondef-S` (state-wide default) plus per-value overrides `transition-S-V` for number/color values. A generated enum input `currentState` sets the state by name. An authoring tool should write `states`, `values`, `type-V` and `value-S-V` as parameters, wire signals to `to-S`, and read `V`, `at-S` and `reached-S` — the runtime registers these names on demand.

## Patterns

- Button `onClick` → `to-<state>` to enter a specific state; `toggle` when there are exactly two states.
- One value output → a Group's `opacity` and another → Color Blend `blendValue`: several properties animate together from a single state change.
- `at-<state>` (boolean) → `visible` or `enabled` inputs: gate UI on the current state as a level.
- `reached-<state>` (signal) → a follow-up action: sequence work after the transition finishes ( `stateChanged` fires at the start, `reached-` at the end).

## Watch out for

- Comparing `currentState` strings in an Expression to derive booleans — the generated `at-<state>` outputs already provide them.
- Wiring `stateChanged` where 'animation done' is meant; it fires when the change starts. Use `reached-<state>`.

## Examples

**States: a collapsible panel with transitioned values**

States is the interaction state machine: the `states` parameter names the states ('collapsed,expanded'), the `values` parameter names the outputs each state assigns ('panelHeight'), and with `useTransitions` on, changing state tweens each value. `toggle` flips between two states; the per-value output drives the layout input (number→dimension cast gives pixels). Signal outputs per state and `stateChanged` are registered from the same configuration — this is the current replacement for the deprecated Animation node.

## Related nodes

[Animate To Value](./net-noodl-animatetovalue.md), [Color Blend](../interpolation/color-blend.md), [Condition](../logic/condition.md), [Switch](../logic/switch.md), [Group](../visual/group.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
