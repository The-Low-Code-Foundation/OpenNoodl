---
title: "Repeater Item"
---
Repeater Item: inside a repeater's item component, exposes this row's item id and its add/remove lifecycle.

Repeater Item gives an item component access to its own position in the enclosing Repeater. `itemId` outputs the id of the object this instance renders — the key that lets row-level actions target row-level data. `added` fires when the instance enters the list; `tryRemove` initiates this row's removal, with `removeCompleted` letting an exit animation finish before the instance is destroyed.

## When to use it

Any per-row behaviour in a repeated component: writing back to the row's object, removal buttons, staggered entrance/exit animation. Outside a repeater item component the node has nothing to bind to.

## At a glance

| | |
|---|---|
| Category | Data |
| Type name | `For Each Actions` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Inputs

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `removeCompleted` | Signal | — | Tells the Repeater the exit work is finished and this item may now be destroyed; needed only when Try Remove is connected |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `itemId` | String | — | Id of the record this repeated item was created for |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `added` | Signal | — | Fires once this repeated item has been created and Item Id is available |
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires when a removal really was waiting on this handshake and has now been released |
| `tryRemove` | Signal | — | Fires before the Repeater destroys this item, and holds the removal until Remove Completed is pulsed — connect it only if something must run first |
| `unchanged` | Signal | — | Fires when no removal was waiting — Try Remove had not been raised, or this handshake was already completed |

## Patterns

- `itemId` → Set Object Properties `modelId`: row edits write to exactly this row (27 occurrences in the real-project corpus).

## Examples

**Repeater item writes back to its own record object**

Inside a Repeater item component, Repeater Item (For Each Actions) exposes `itemId` — the id of this row's object. Wiring it into Set Object Properties (SetModelProperties) `modelId` makes the write target exactly this row: toggling the checkbox stores `done` on the row's object, and every other node bound to that object updates. The row never needs to know which list it belongs to.

## Related nodes

[Repeater](../visual/for-each.md), [Object](./model2.md), [Set Object Properties](./set-model-properties.md), [Remove Object From Array](./collection-remove.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
