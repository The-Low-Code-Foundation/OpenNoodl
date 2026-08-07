---
title: "Clear Array"
---
Clear Array: empties a shared array (removes all items) when Do fires.

When `clear` (Do) fires, resolves `collectionId` (Array Id) to the shared array, replaces its contents with an empty list and fires `done` (Done), or `unchanged` (Unchanged) when the array was already empty. `failure` (Failure) fires when no array is bound. `completed` (Completed) fires after all three. The Array Id must be set before the signal arrives. The objects that were in the array are not destroyed — only the array is emptied — and every node bound to the same Array Id sees the empty array immediately.

## When to use it

Reset-style actions on local shared arrays ('clear the list', 'empty the cart'). To remove a single item use Remove Object From Array; this node is all-or-nothing.

## At a glance

| | |
|---|---|
| Category | Data |
| Type name | `CollectionClear` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `collectionId` | String (CollectionName id) | — | Id of the array to empty; clearing it unbinds the node, and the next Do then fails rather than emptying a throwaway array |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `clear` | Signal | — | Removes every item from the array, or fires Failure if no array is bound |

## Outputs

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once the array has been emptied |
| `unchanged` | Signal | — | Fires when the array was already empty, so nothing was removed |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the last attempt changed nothing, in one sentence; empty until something fails |
| `failure` | Signal | — | Fires when no array is bound, so nothing was changed |

## Examples

**Named shared array with insert, remove and clear**

A client-side list without a backend: an Array node (Collection2) binds to the named shared array 'todos' and feeds a Repeater. Add Item (CollectionInsert), Remove Item (CollectionRemove) and Clear (CollectionClear) mutate the same array by its `collectionId`; every node bound to that id — including the Array feeding the list — sees the change immediately. Ids on wires tie the writers to the store.

## Related nodes

[Array](./collection2.md), [Insert Object Into Array](./collection-insert.md), [Remove Object From Array](./collection-remove.md), [Create New Array](./collection-new.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
