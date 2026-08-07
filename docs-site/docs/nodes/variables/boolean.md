---
title: "Boolean"
---
Per-instance true/false holder: stores one boolean locally, optionally latching new values until a Set signal fires.

Boolean holds a single true/false value that belongs to this node instance alone — it is not named or shared (for an app-wide named value use Variable2). The `value` input sets it and `savedValue` (Value) reads it back. While the `saveValue` (Set) signal input is unconnected, values written to `value` apply immediately; once `saveValue` is connected the node latches: incoming values are held pending and only applied when Set fires. Incoming values are cast with JavaScript Boolean(). `changed` fires only when the stored value actually changes; `stored` fires after every Set trigger, changed or not.

## When to use it

Use it for a local flag inside one component — 'has clicked', 'panel expanded' — especially the latch shape (pin `value` to true, fire Set from a signal) that turns a momentary signal into a level. For state shared across components use Variable2 + Set Variable; for multi-state logic use States.

## At a glance

| | |
|---|---|
| Category | Variables |
| Type name | `Boolean` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `runOnChange-value` | Boolean | `true` | Whether a new value on Value re-runs this node. On by default; untick to make this input passive so only the control signal runs it |
| `treatEmptyAs` | Enum (`null`, `false`) | `null` | Back-compat for graphs written before Variables were nullable. `null` (default) keeps a cleared value distinguishable from a real false. Choosing another option restores the pre-NDA-003 coercion for authors who relied on it. |
| `treatUnchangedAs` | Enum (`unchanged`, `done`) | `unchanged` | What this node reports when the action was valid and there was nothing to do. Unchanged (the default) keeps it a third outcome of its own. Done suits a project whose chains should carry on either way. Completed fires whatever this is set to. |
| `value` | Boolean | `false` | The empty-value contract (dev-docs/reference/EMPTY-VALUE-CONTRACT.md): `undefined` abstains and leaves the Variable's stored value untouched. `null` is a real value — it clears the Variable, is stored, and fires Changed. What "cleared" is stored as is controlled by `Treat empty as` (null by default). |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `saveValue` | Signal | — | Stores the latest value now. This is additional to Value storing on change; untick Value under Run On Value Change to stop that |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `savedValue` | Boolean | — | Can be `null` — a cleared Variable (see `value`'s description) stores and emits null by default, not this type's zero value, unless `Treat empty as` says otherwise. |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `changed` | Signal | — | Fires whenever the stored value actually changed, however it was reached — including Value writing straight through under Run On Value Change. It is a value-level event, not the outcome of a Set |
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires when a Set stored a value the Variable was not already holding |
| `unchanged` | Signal | — | Fires when a Set stored the value it already held, so nothing changed. ⚠️ With Value left ticked under Run On Value Change this is the common case, because Value has already stored by the time Set fires |

## Patterns

- Latch a signal into a level: set `value` to true in parameters, wire the signal to `saveValue`, and read `savedValue` — a sticky 'this has happened' flag.
- `savedValue` → Condition `condition` to branch signal flow on the stored flag.

## Watch out for

- Using two Boolean nodes in different components to 'share' a flag — each instance has its own value and they never sync. Use Variable2 for shared state.

## Examples

**Click counter with a latched Number and a Boolean flag**

The canonical per-instance counter: a Number node's savedValue feeds an Expression (count + 1) whose result loops back into the Number's value input. Because saveValue (Set) is connected, the incremented value is only committed when the Button's onClick fires — the latch is what makes the feedback loop safe. The count renders directly in a Text (number casts to string on delivery). A Boolean node shows the latch-a-signal-into-a-level shape: its value is pinned to true in parameters, the same click fires its Set, and its savedValue permanently reveals the hint text — a level, unlike the momentary click signal.

## Related nodes

[Number](./number.md), [String](./string.md), [Color](./color.md), [Variable](../data/variable2.md), [Condition](../logic/condition.md), [Switch](../logic/switch.md), [States](../animation/states.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
