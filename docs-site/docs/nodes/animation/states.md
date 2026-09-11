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

Ports are generated from the "states" and "values" parameters: each value gets one input per state (`value-<state>-<value>`) and a current-value output; each state gets an activation signal input (`to-<state>`), a boolean output (`at-<state>`) and a signal output (`reached-<state>`). Once "states" is set the node also mints a single enum INPUT named `currentState` — the same name as the declared string output — which selects a state by name in one wire, without a signal port per state.

## Ports at runtime

All state- and value-specific ports are runtime-discovered: the viewer generates them from the `states` and `values` parameters and pushes them to the editor per instance. For each value V: an output named `V` (connections only; type chosen by a generated enum input `type-V` — number, string, boolean, color or textStyle, default number). For each state S and value V: an input `value-S-V` holding V's setting while in state S. For each state S: a signal input `to-S` (go to S), a boolean output `at-S` (true while S is active), a signal output `reached-S` (fires when the transition into S completes — immediately when there is no transition), and, while `useTransitions` is on, a curve input `transitiondef-S` (state-wide default) plus per-value overrides `transition-S-V` for number/color values. Separately, once `states` is set the node mints ONE enum input named `currentState`, sharing the name of the declared string output and defaulting to the first state; writing or wiring it moves the node to that state. An authoring tool should write `states`, `values`, `type-V` and `value-S-V` as parameters, and read `V`, `at-S` and `reached-S`. To change state it has two forms and they are not interchangeable: wire a signal to `to-S` when an event causes the change (a click, a `done`), and wire a VALUE to `currentState` when the state IS a value the component was handed (a `size`, a `tone`, a `Request Type`) — the second is one wire where the first would need one port per state plus a Condition chain. The runtime registers all of these names on demand.

## Patterns

- Button `onClick` → `to-<state>` to enter a specific state; `toggle` when there are exactly two states.
- One value output → a Group's `opacity` and another → Color Blend `blendValue`: several properties animate together from a single state change.
- `at-<state>` (boolean) → `visible` or `enabled` inputs: gate UI on the current state as a level.
- `Component Inputs.<enum>` → `States.currentState` (the enum INPUT): the component takes its variant as a parameter and the state machine holds the per-variant values. This is how a `size`/`tone`/`type` port reaches a States node in one wire — `library/prefabs` uses it in toast (`Type`), xano (`Request Type`, `Auth Token Storage`) and media-query (`Debugger Position`).
- `reached-<state>` (signal) → a follow-up action: sequence work after the transition finishes ( `stateChanged` fires at the start, `reached-` at the end).

## Watch out for

- Comparing `currentState` strings in an Expression to derive booleans — the generated `at-<state>` outputs already provide them.
- One signal input per state plus a Condition or Switch chain to pick between them, where the state is simply a value the component was given — wire that value to the `currentState` enum input instead.
- Wiring `stateChanged` where 'animation done' is meant; it fires when the change starts. Use `reached-<state>`.

## Examples

**States: a collapsible panel with transitioned values**

States is the interaction state machine: the `states` parameter names the states ('collapsed,expanded'), the `values` parameter names the outputs each state assigns ('panelHeight'), and with `useTransitions` on, changing state tweens each value. `toggle` flips between two states; the per-value output drives the layout input (number→dimension cast gives pixels). Signal outputs per state and `stateChanged` are registered from the same configuration — this is the current replacement for the deprecated Animation node.

**One size port, three sizes: a variant selector wired into States**

The component a page places three times at three sizes, without three components. `size` is a `Component Inputs` port wired straight into `States.currentState` — 🔴 that port is TWO ports sharing one name: a static string **output** that reports the current state, and, once `states` is set, a generated **enum input** that selects one by name. The input is the wire that makes a variant port work, and a chain of `Condition` nodes each setting one property is the same idea written badly. The `values` parameter (`padX,padY,labelSize`) mints one input per state per value (`value-small-padX`) and one output per value, so each state assigns the whole set at once and the graph carries no branch. `showDot` is the other half of a real interface: chrome chosen at the instance, not by making a second component. And the badge publishes `clicked`, so the page can act on a press — a component that only draws is a component the page has to work around.

**Blink a button, and stop cleanly**

A strobe is a good miniature of a hard problem: something that keeps running after the signal that started it, and therefore has to be stopped by something other than the thing that started it. A `Javascript2` node owns the interval, a `Switch` turns it on and off, a `States` node carries the two appearances, and a `Number` makes the period an input instead of a literal. ⚠️ The half people leave out is the reset — stopping an interval without restoring the state leaves the button frozen in whichever half of the blink it happened to be in, which looks like a different bug entirely. This one restores it.

**One button component that drives any editor command**

A toolbar has a dozen buttons that differ only in a label, an icon and the name of the command they run — so this makes them one component with those three as inputs. A `States` node turns the button's type into its label, a `JavaScriptFunction` calls the matching command on the editor instance, and `Component Outputs` reports back whether the mark is currently active so the button can render as pressed. The lesson is not about Tiptap: it is that 'twelve buttons' and 'one button placed twelve times' are the same screen, and only one of them is editable later. 🔴 A component parameter arrives ONLY through a `Component Inputs` node whose ports are plugged `output` — that inversion is what makes this work, and it is the single most common thing to get backwards.

## Related nodes

[Animate To Value](./net-noodl-animatetovalue.md), [Color Blend](../interpolation/color-blend.md), [Condition](../logic/condition.md), [Switch](../logic/switch.md), [Group](../visual/group.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
