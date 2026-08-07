---
title: "String"
---
Per-instance text holder: stores one string locally, with a Length output and optional latch-until-Set behaviour.

String holds a single text value that belongs to this node instance alone — it is not named or shared (for an app-wide named value use Variable2). The `value` input sets it and `savedValue` (Value) reads it back; `length` always reports the stored string's character count. While the `saveValue` (Set) signal input is unconnected, values written to `value` apply immediately; once `saveValue` is connected the node latches: incoming values are held pending and only applied when Set fires — the idiomatic way to snapshot a text field at the moment of a click. Incoming values are cast with JavaScript String(). `changed` fires only when the stored value actually changes; `stored` fires after every Set trigger.

## When to use it

Use it to hold or snapshot local text: capture a Text Input's current value on submit, keep a reusable literal in one editable place, or derive `length` for validation. For text shared across components use Variable2 + Set Variable; for computed text use an Expression.

## At a glance

| | |
|---|---|
| Category | Variables |
| Type name | `String` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `runOnChange-value` | Boolean | `true` | Whether a new value on Value re-runs this node. On by default; untick to make this input passive so only the control signal runs it |
| `treatEmptyAs` | Enum (`null`, `empty-string`) | `null` | Back-compat for graphs written before Variables were nullable. `null` (default) keeps a cleared value distinguishable from a real "". Choosing another option restores the pre-NDA-003 coercion for authors who relied on it. |
| `treatUnchangedAs` | Enum (`unchanged`, `done`) | `unchanged` | What this node reports when the action was valid and there was nothing to do. Unchanged (the default) keeps it a third outcome of its own. Done suits a project whose chains should carry on either way. Completed fires whatever this is set to. |
| `value` | String | `` | The empty-value contract (dev-docs/reference/EMPTY-VALUE-CONTRACT.md): `undefined` abstains and leaves the Variable's stored value untouched. `null` is a real value — it clears the Variable, is stored, and fires Changed. What "cleared" is stored as is controlled by `Treat empty as` (null by default). |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `saveValue` | Signal | — | Stores the latest value now. This is additional to Value storing on change; untick Value under Run On Value Change to stop that |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `length` | Number | — | 0 when the Variable is cleared (`savedValue` is `null`) — there is no text to measure, and 0 is what an author reading this as a plain number expects, rather than a thrown error or `null` itself. |
| `savedValue` | String | — | Can be `null` — a cleared Variable (see `value`'s description) stores and emits null by default, not this type's zero value, unless `Treat empty as` says otherwise. |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `changed` | Signal | — | Fires whenever the stored value actually changed, however it was reached — including Value writing straight through under Run On Value Change. It is a value-level event, not the outcome of a Set |
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires when a Set stored a value the Variable was not already holding |
| `unchanged` | Signal | — | Fires when a Set stored the value it already held, so nothing changed. ⚠️ With Value left ticked under Run On Value Change this is the common case, because Value has already stored by the time Set fires |

## Patterns

- Snapshot on submit: Text Input `onTextChanged` → `value`, Button `onClick` → `saveValue`; `stored` then triggers whatever consumes the committed text.
- `length` → an Expression or Condition for 'minimum characters' style validation.

## Watch out for

- Using String nodes in two components to 'share' text — each instance has its own value. Use Variable2 for shared text.

## Examples

**Share a value between components with Set Variable and Variable**

The idiomatic shared-state shape, contrasting per-instance and app-wide storage. In the form component, a String node snapshots the text field: because its saveValue (Set) is connected, keystrokes only latch a pending value, and the Button click commits it. The String's stored signal then fires the Set Variable's do, writing the committed text into the app-wide variable 'userName' (setWith 'string' types the dynamic value input). In a completely separate component, a Variable2 node bound to the same name reads the value reactively — its changed/value update the greeting automatically whenever the variable is written, with no connection between the two components.

## Related nodes

[Boolean](./boolean.md), [Number](./number.md), [Color](./color.md), [Variable](../data/variable2.md), [Set Variable](../data/set-variable.md), [Expression](../custom-code/expression.md), [Text Input](../visual/net-noodl-controls-textinput.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
