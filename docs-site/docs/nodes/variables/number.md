---
title: "Number"
---
Per-instance numeric holder: stores one number locally, optionally latching new values until a Set signal fires.

Number holds a single numeric value that belongs to this node instance alone — it is not named or shared (for an app-wide named value use Variable2). The `value` input sets it and `savedValue` (Value) reads it back. While the `saveValue` (Set) signal input is unconnected, values written to `value` apply immediately; once `saveValue` is connected the node latches: incoming values are held pending and only applied when Set fires. Incoming values are cast with JavaScript Number(), so non-numeric strings become NaN. `changed` fires only when the stored value actually changes; `stored` fires after every Set trigger.

## When to use it

Use it to hold a local number — a counter, an index, a captured measurement — especially with the latch: feed a computed value into `value` and commit it with Set at the moment of an action. For simple increment/decrement a Counter is less wiring; for app-wide numbers use Variable2 + Set Variable.

## At a glance

| | |
|---|---|
| Category | Variables |
| Type name | `Number` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `runOnChange-value` | Boolean | `true` | Whether a new value on Value re-runs this node. On by default; untick to make this input passive so only the control signal runs it |
| `treatEmptyAs` | Enum (`null`, `zero`) | `null` | Back-compat for graphs written before Variables were nullable. `null` (default) keeps a cleared value distinguishable from a real 0. Choosing another option restores the pre-NDA-003 coercion for authors who relied on it. |
| `treatUnchangedAs` | Enum (`unchanged`, `done`) | `unchanged` | What this node reports when the action was valid and there was nothing to do. Unchanged (the default) keeps it a third outcome of its own. Done suits a project whose chains should carry on either way. Completed fires whatever this is set to. |
| `value` | Number | `0` | The empty-value contract (dev-docs/reference/EMPTY-VALUE-CONTRACT.md): `undefined` abstains and leaves the Variable's stored value untouched. `null` is a real value — it clears the Variable, is stored, and fires Changed. What "cleared" is stored as is controlled by `Treat empty as` (null by default). |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `saveValue` | Signal | — | Stores the latest value now. This is additional to Value storing on change; untick Value under Run On Value Change to stop that |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `savedValue` | Number | — | Can be `null` — a cleared Variable (see `value`'s description) stores and emits null by default, not this type's zero value, unless `Treat empty as` says otherwise. |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `changed` | Signal | — | Fires whenever the stored value actually changed, however it was reached — including Value writing straight through under Run On Value Change. It is a value-level event, not the outcome of a Set |
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires when a Set stored a value the Variable was not already holding |
| `unchanged` | Signal | — | Fires when a Set stored the value it already held, so nothing changed. ⚠️ With Value left ticked under Run On Value Change this is the common case, because Value has already stored by the time Set fires |

## Patterns

- Counter loop: `savedValue` → an Expression (`count + 1`) → `value`, with a click signal on `saveValue` — each click commits the incremented value. The latch prevents an infinite feedback loop.
- `savedValue` → a Text's `text`: numbers cast to strings on delivery, so the count renders directly.

## Watch out for

- Wiring `savedValue` through an Expression back into `value` without connecting `saveValue` — with no latch the loop applies immediately and the value is unstable. Connect Set and drive it from a signal.

## Examples

**Click counter with a latched Number and a Boolean flag**

The canonical per-instance counter: a Number node's savedValue feeds an Expression (count + 1) whose result loops back into the Number's value input. Because saveValue (Set) is connected, the incremented value is only committed when the Button's onClick fires — the latch is what makes the feedback loop safe. The count renders directly in a Text (number casts to string on delivery). A Boolean node shows the latch-a-signal-into-a-level shape: its value is pinned to true in parameters, the same click fires its Set, and its savedValue permanently reveals the hint text — a level, unlike the momentary click signal.

## Related nodes

[Counter](../math/counter.md), [Expression](../custom-code/expression.md), [Number Remapper](../math/number-remapper.md), [Boolean](./boolean.md), [String](./string.md), [Variable](../data/variable2.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
