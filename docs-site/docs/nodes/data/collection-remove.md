---
title: "Remove Object From Array"
---
Remove Object From Array: removes an object, referenced by its id, from a shared array when Do fires.

When `remove` (Do) fires, resolves `collectionId` (Array Id) to the shared array and `modifyId` (Object Id) to the shared object, removes that object from the array, and reports one outcome: `done` (Done) when the object was removed, or `unchanged` (Unchanged) when it was not in this array. An Object Id naming a record nothing has loaded is `failure` (Failure) instead — that removal is impossible rather than redundant — as is an unset id. `completed` (Completed) fires after all three. Only the array membership changes — the object itself continues to exist and can still be reached by its id. Every Array node and Repeater bound to the same Array Id updates immediately.

## When to use it

Per-item delete actions in local lists. Inside a Repeater's item component, feed `modifyId` from Repeater Item's `itemId` — that is the idiomatic 'remove this row'. For clearing everything use Clear Array; for cloud records use Delete Record.

## At a glance

| | |
|---|---|
| Category | Data |
| Type name | `CollectionRemove` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `collectionId` | String (CollectionName id) | — | Id of the array to remove from; clearing it unbinds the node, and the next Do then fails rather than acting on a throwaway array |
| `modifyId` | String | — | Id of the object to remove; the record must already have been loaded, or the removal is refused instead of quietly doing nothing |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `remove` | Signal | — | Removes the object named by Object Id from the array, or fires Failure if either cannot be resolved |

## Outputs

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once the object has been removed from the array |
| `unchanged` | Signal | — | Fires when the object was not in the array, so nothing was removed |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the last attempt changed nothing, in one sentence; empty until something fails |
| `failure` | Signal | — | Fires when the array or the object could not be resolved, so nothing was changed |

## Patterns

- Repeater Item `itemId` → `modifyId`, delete button `onClick` → `remove`, with the list's Array Id on `collectionId`: a per-row delete button.

## Examples

**Named shared array with insert, remove and clear**

A client-side list without a backend: an Array node (Collection2) binds to the named shared array 'todos' and feeds a Repeater. Add Item (CollectionInsert), Remove Item (CollectionRemove) and Clear (CollectionClear) mutate the same array by its `collectionId`; every node bound to that id — including the Array feeding the list — sees the change immediately. Ids on wires tie the writers to the store.

## Related nodes

[Array](./collection2.md), [Insert Object Into Array](./collection-insert.md), [Clear Array](./collection-clear.md), [Repeater Item](./for-each-actions.md), [Repeater](../visual/for-each.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
