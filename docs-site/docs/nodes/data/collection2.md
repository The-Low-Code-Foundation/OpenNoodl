---
title: "Array"
---
Array: binds to a shared client-side array by id — read its items and count, seed its contents, and react to changes made anywhere.

Client-side arrays live in a global registry keyed by id: every node that names the same id — this node, Insert/Remove/Clear Array nodes, other components — reads and mutates the same underlying array. Collection2 binds to the array named on `collectionId` (Id) and exposes it on `items` (the live array), plus `count`, `firstItemId` and `id`. Whenever the array's contents change — from any node or code, anywhere in the app — `changed` fires and `count`/`firstItemId` update. Connecting an array to the `items` input copies that source array's contents into this array, and keeps re-copying while the source changes. If `fetch` (signal) is connected the node defers: a new `collectionId` only takes effect when `fetch` fires (then `fetched` fires), and automatic `changed` events are suppressed.

## When to use it

Local list state shared across components without any wiring between them: give every interested node the same Array Id. For server data use DbCollection2 (Query Records); for a single object use Model2 (Object); to mutate the array use Insert/Remove/Clear Array nodes rather than manipulating `items` in code.

## At a glance

| | |
|---|---|
| Category | Data |
| Type name | `Collection2` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `collectionId` | String (CollectionName id) | — | Id of the shared array to bind to; the first node to use an id creates the array, and every later node naming it reaches the same one |
| `items` | Array | — | undefined leaves this Array's current collection alone (no opinion supplied). null clears it — every item is removed and Changed fires once, the same as connecting an empty collection. |
| `runOnChange-array` | Boolean | `true` | Whether a new value on Array contents re-runs this node. On by default; untick to make this input passive so only the control signal runs it |
| `runOnChange-collectionId` | Boolean | `true` | Whether a new value on Id re-runs this node. On by default; untick to make this input passive so only the control signal runs it |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `fetch` | Signal | — | Re-reads the array named by Id and rebinds this node to it. This is additional to Id rebinding on change and to array changes being announced; untick either under Run On Value Change to stop it |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `count` | Number | — | How many objects the bound array holds |
| `firstItemId` | String | — | Id of the first object in the array, or empty while the array holds nothing |
| `id` | String | — | Id of the array this node is currently bound to |
| `items` | Array | — | The bound array itself, for a Repeater or another Array node to read |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `changed` | Signal | — | Fires when the bound array gains or loses items; suppressed while Fetch is connected |
| `completed` | Signal | — | Fires after every invocation. This node has no other outcome — no Unchanged and no Failure — so it always fires together with Done, and wiring either one does the same thing. It is here on every action so that reaching for it is never a per-node decision |
| `done` | Signal | — | Fires when a Fetch finished and the outputs are up to date |
| `fetched` | Signal | — | Fires once Fetch has rebound this node and the outputs are up to date |

## Patterns

- Same `collectionId` in many components: a list page shows the array while a form elsewhere inserts into it — no connections needed between them.
- `items` → For Each `items`: the canonical local list.
- Feed `collectionId` from Create New Array `id` to bind to a dynamically created array.

## Watch out for

- Using it for cloud data — it is purely client-side, nothing is persisted; use DbCollection2 (Query Records) instead.

## Examples

**Named shared array with insert, remove and clear**

A client-side list without a backend: an Array node (Collection2) binds to the named shared array 'todos' and feeds a Repeater. Add Item (CollectionInsert), Remove Item (CollectionRemove) and Clear (CollectionClear) mutate the same array by its `collectionId`; every node bound to that id — including the Array feeding the list — sees the change immediately. Ids on wires tie the writers to the store. Remove is the row’s to raise: `/Todo Row` publishes a `remove` signal on its `Component Outputs`, and the Repeater re-publishes it as `itemOutputSignal-remove` while setting `itemActionItemId` to the row that fired — the trigger and the id both leave the Repeater, so they always describe the same row.

**Run Tasks: batch-process an array with a worker component**

Run Tasks executes its `taskTemplate` component once per element of `items`, up to `maxRunningTasks` at a time, and fires `completed` when the whole batch has finished, whatever the outcome — `done` is the narrower signal that the run finished having done its work. The worker is a plain component: it receives the item's properties through Component Inputs and reports completion through Component Outputs signals (success/failure), which Run Tasks consumes to schedule the next task. Here a fresh array is assembled with New Array and processed on click.

## Related nodes

[Create New Array](./collection-new.md), [Insert Object Into Array](./collection-insert.md), [Remove Object From Array](./collection-remove.md), [Clear Array](./collection-clear.md), [Array Filter](./filter-collection.md), [Array Map](./map-collection.md), [Repeater](../visual/for-each.md), [Object](./model2.md), [Query Records](../cloud-services/db-collection2.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
