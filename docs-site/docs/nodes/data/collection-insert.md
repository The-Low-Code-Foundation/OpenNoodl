---
title: "Insert Object Into Array"
---
Insert Object Into Array: appends an existing object, referenced by its id, to a shared array when Do fires.

When `add` (Do) fires, resolves `collectionId` (Array Id) to the shared array and `modifyId` (Object Id) to the shared object, appends the object to the end of the array, and reports one outcome: `done` (Done) when the object was added, or `unchanged` (Unchanged) when the array already held it — arrays hold each object once, so a repeat insert changes nothing. `failure` (Failure) fires when either id is unset. `completed` (Completed) fires after all three. Because arrays are shared by id, every Array node and Repeater bound to the same Array Id sees the new item immediately.

## When to use it

Adding items to a local shared array — typically right after Create New Object has created the object to add. For removing use Remove Object From Array; for cloud data use the record nodes instead (nothing here is persisted).

## At a glance

| | |
|---|---|
| Category | Data |
| Type name | `CollectionInsert` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `collectionId` | String (CollectionName id) | — | Id of the array to insert into; clearing it unbinds the node, and the next Do then fails rather than writing to a throwaway array |
| `modifyId` | String | — | Id of the object to insert; a record with this id is created if none has been loaded yet |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `add` | Signal | — | Adds the object named by Object Id to the array, or fires Failure if either cannot be resolved |

## Outputs

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once the object has been added to the array |
| `unchanged` | Signal | — | Fires when the object was already in the array, so nothing was added |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the last attempt changed nothing, in one sentence; empty until something fails |
| `failure` | Signal | — | Fires when the array or the object could not be resolved, so nothing was changed |

## Patterns

- Create New Object `created` → `add` and `id` → `modifyId`: the canonical create-then-insert flow.

## Watch out for

- Trying to insert a raw value or JS object — `modifyId` takes an object id, not the data itself; create an object first with Create New Object.

## Examples

**Named shared array with insert, remove and clear**

A client-side list without a backend: an Array node (Collection2) binds to the named shared array 'todos' and feeds a Repeater. Add Item (CollectionInsert), Remove Item (CollectionRemove) and Clear (CollectionClear) mutate the same array by its `collectionId`; every node bound to that id — including the Array feeding the list — sees the change immediately. Ids on wires tie the writers to the store.

## Related nodes

[Array](./collection2.md), [Remove Object From Array](./collection-remove.md), [Clear Array](./collection-clear.md), [Create New Array](./collection-new.md), [Create New Object](./new-model.md), [Object](./model2.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
