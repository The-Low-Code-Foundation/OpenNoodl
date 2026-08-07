---
title: "Variable"
---
Reads and writes one named app-wide variable; every node bound to the same name sees the same value.

Variable2 (shown as 'Variable' in the editor) binds to one entry in the app-wide variable store — a single shared, untyped key/value map for the running session (in memory only, not persisted across reloads). `name` selects the variable; the `value` output reads it, and the `value` *input* writes it: sending a value in stores it under the current name for every other Variable node to see. When the variable is written anywhere else in the app, `changed` fires and the `value` output updates automatically. Connecting the `fetch` signal input changes this to pull mode: external changes and name changes no longer propagate on their own, and the node only re-reads when `fetch` fires, after which `fetched` fires. This is the shared counterpart of the per-instance Boolean/Number/String/Color holders, which each keep a private value.

## When to use it

Use it for state shared across components — the logged-in user's name, a selected id, a UI mode — reading it where needed and writing via its `value` input or, for explicit signal-driven writes with type control, a Set Variable node. For a value used only inside one component prefer a per-instance holder (Boolean/Number/String/Color); for structured data use Model2.

## At a glance

| | |
|---|---|
| Category | Data |
| Type name | `Variable2` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `name` | String (VariableName id) | — | Which app-wide variable this node reads and writes |
| `runOnChange-name` | Boolean | `true` | Whether a new value on Name re-runs this node. On by default; untick to make this input passive so only the control signal runs it |
| `runOnChange-variable` | Boolean | `true` | Whether a new value on Variable changes re-runs this node. On by default; untick to make this input passive so only the control signal runs it |
| `value` | * | — | Stores this value in the named variable as soon as it arrives; refused, loudly, when Name is empty |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `fetch` | Signal | — | Re-reads the variable named by Name and refreshes Value. This is additional to Name rebinding on change and to changes being announced; untick either under Run On Value Change to stop it |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `name` | String | — | The variable name this node is currently bound to |
| `value` | * | — | Current contents of the named variable, or empty until something writes it |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `changed` | Signal | — | Fires when the named variable is written from anywhere in the app |
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires when a Fetch finished and Value is up to date |
| `fetched` | Signal | — | Fires once Fetch has rebound this node and Value is up to date |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the last write was refused, in one sentence; empty until something fails |
| `failure` | Signal | — | Fires when a value arrived but could not be stored because no Name is set. This belongs to the Value input rather than to Fetch, so it reports no outcome and does not fire Completed |

## Patterns

- Set Variable writes on a user action; Variable2 nodes with the same name anywhere in the app update reactively — the idiomatic shared-state shape.
- `value` output → an Expression → visual inputs: derive display text or booleans from shared state where it is consumed.

## Watch out for

- Expecting each Variable2 instance to hold its own value — the name is the identity, all instances with one name share one value. For private per-node state use Boolean/Number/String/Color.
- Using variables as persistent storage — the store is in-memory and resets on page reload; persist important data in the cloud database or browser storage nodes.

## Examples

**Share a value between components with Set Variable and Variable**

The idiomatic shared-state shape, contrasting per-instance and app-wide storage. In the form component, a String node snapshots the text field: because its saveValue (Set) is connected, keystrokes only latch a pending value, and the Button click commits it. The String's stored signal then fires the Set Variable's do, writing the committed text into the app-wide variable 'userName' (setWith 'string' types the dynamic value input). In a completely separate component, a Variable2 node bound to the same name reads the value reactively — its changed/value update the greeting automatically whenever the variable is written, with no connection between the two components.

## Related nodes

[Set Variable](./set-variable.md), [Object](./model2.md), [Boolean](../variables/boolean.md), [Number](../variables/number.md), [String](../variables/string.md), [Color](../variables/color.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
