---
title: "Set Variable"
---
Writes one named app-wide variable when its Do signal fires, converting the value per the 'Set as' type choice.

Set Variable stores a value into the named app-wide variable — the same store Variable2 reads — only when the `do` (Do) signal fires; the incoming value is held but nothing is written before that. `setWith` (Set as, parameters-only) selects the value type: it types the node's dynamic `value` input and controls conversion on store — 'boolean' coerces with !!, 'emptyString' writes '' and removes the value input entirely, and 'object'/'array' accept a shared Object/Array id string and resolve it to the actual object or collection before storing. Writes always use force-change semantics, so Variable2 nodes bound to that name fire `changed` even when the new value equals the old one. `done` fires after the store completes, `failure` when no `name` is set, and `completed` after either.

## When to use it

Use it when writing shared state should happen at an explicit moment — on click, on submit, after a fetch — or when you need the type conversions ('Set as'). For continuous write-on-change semantics, wire into a Variable2 node's `value` input instead; to clear a variable, choose Set as 'Empty string'.

## At a glance

| | |
|---|---|
| Category | Data |
| Type name | `Set Variable` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `name` | String (VariableName id) | — | Which app-wide variable to write; leaving it blank refuses the write rather than storing it somewhere unreadable |
| `setWith` | Enum (`string`, `boolean`, `number`, `emptyString`, `date`, `object`, `array`, `*`) | `*` | Chooses the type of the Value port; Empty string stores "" and needs no Value, Object and Array accept an id as well as a value, and Boolean is coerced |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `do` | Signal | — | Writes Value into the named variable, or fires Failure when no Name is set |

## Outputs

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once the variable has been written and every Variable node reading it has been notified |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the write was refused, in one sentence; empty until something fails |
| `failure` | Signal | — | Fires when nothing was stored because no variable Name is set |

## Dynamic ports

_This node's port list changes at runtime (runtime-discovered); the tables above may be incomplete for a given instance._

The value input type follows the selected variable type.

## Ports at runtime

The value input is runtime-determined: the editor pushes a single dynamic input port named `value` whose type follows the `setWith` parameter ('*' when unset), and no value port exists at all when setWith is 'emptyString'. The runtime registers `value` on demand when a connection or parameter references it. An authoring tool may wire or set `value` (except in emptyString mode) and must set `setWith` via parameters, never a connection.

## Patterns

- Button `onClick` → `do` with the form's data on `value`: commit shared state at the moment of a user action.
- `done` → a navigation or feedback signal: sequence 'store, then move on' explicitly.

## Watch out for

- Expecting the write to happen when `value` changes — Set Variable only writes on `do`. Use Variable2's value input for write-on-change.

## Examples

**Share a value between components with Set Variable and Variable**

The idiomatic shared-state shape, contrasting per-instance and app-wide storage. In the form component, a String node snapshots the text field: because its saveValue (Set) is connected, keystrokes only latch a pending value, and the Button click commits it. The String's stored signal then fires the Set Variable's do, writing the committed text into the app-wide variable 'userName' (setWith 'string' types the dynamic value input). In a completely separate component, a Variable2 node bound to the same name reads the value reactively — its changed/value update the greeting automatically whenever the variable is written, with no connection between the two components.

## Related nodes

[Variable](./variable2.md), [Object](./model2.md), [String](../variables/string.md), [Boolean](../variables/boolean.md), [Number](../variables/number.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
