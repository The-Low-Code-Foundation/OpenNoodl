---
title: "Set Global Store"
---
Writes a key into a named global store, optionally merging an object and optionally batching with other writes in the same frame.

Sets one key in the store named by Store Name. The write is deferred until every input on the node has landed, because Key, Value and the Set signal can arrive in one frame in no guaranteed order — so wiring Value and pulsing Set together behaves the way it reads. Setting a key to the value it already holds is not a change and notifies nobody. Writing `undefined` to a key that does not exist still registers as setting it, so absence and 'set to nothing' stay distinguishable to anything watching. Batch With Others coalesces this write with the other batched writes of the same frame into a single commit — subscribers see one notification with all the changed keys, instead of one per write.

## When to use it

Any write to shared state: recording a sign-in, appending a streamed message, flipping a panel open. Use one Set per key; for several keys that belong together, turn on Batch With Others so the UI moves once. Use Merge Object to update part of an object without reading it first.

## At a glance

| | |
|---|---|
| Category | Data |
| Type name | `net.noodl.GlobalStore.Set` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `key` | String | — | Key to write; a Set with no key is refused rather than dropped |
| `merge` | Boolean | `false` | Shallow-merges into the existing value when both the old and the new value are plain objects, instead of replacing it |
| `storeName` | String | `app` | Names the store to write; must match the Store Name of the Global Store node that owns it |
| `transaction` | Boolean | `false` | Holds the notification until the end of the current microtask so several writers in one turn produce a single change |
| `value` | * | — | Value to write, of any type; null is stored as null and is not coerced to a blank string |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `set` | Signal | — | Writes Value at Key, reading both as of the end of the current frame |

## Outputs

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once the write has been applied and every subscriber has been told |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the last write failed; blank once a write succeeds |
| `failure` | Signal | — | Fires when the write could not be made, most often because Key is empty |

## Patterns

- Several Set Global Store nodes with Batch With Others turned on, pulsed in the same frame, so a multi-field update renders as one change.
- Merge Object to update one field of a settings object without reading, spreading and writing it back.
- `done` → the next action, rather than assuming the write has landed by the time the next node runs. Use `completed` instead when the chain should continue even if the write was refused.

## Watch out for

- Expecting Batch With Others to hide a change. It groups notifications; it never drops the write.
- Setting the same key from several nodes each frame and relying on order — batched writes commit together, and last-write-wins within the batch.
- Writing a whole rebuilt object every keystroke where Merge Object would change one field.

## Examples

**Shared state: one store read by two unrelated components**

Two components that are not parent and child, sharing state through a named store instead of prop drilling or a Send/Receive Event pair. Sign In writes `user` with Set Global Store; Header declares the same store by name and renders `state` — no wiring runs between the two components, because naming the store is what connects them. Header also subscribes to just the `user` key, so a write to any other key does not wake it, and uses `previousValue` against `value` to fire only on the signed-out → signed-in transition rather than on every change. Initial State fills gaps without overwriting live state, so Header remounting cannot reset a store Sign In is already using.

## Related nodes

[Global Store](./net-noodl-global-store.md), [Subscribe to Store](./net-noodl-global-store-subscribe.md), [Set Variable](./set-variable.md), [Set Object Properties](./set-model-properties.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
