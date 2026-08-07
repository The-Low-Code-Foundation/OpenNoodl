---
title: "Create New Array"
---
Create New Array: makes a fresh array with a generated id when Do fires, optionally copying an input array's contents into it.

On the `new` (Do) signal, creates a brand-new shared array under a freshly generated unique id. If an array is connected to `items`, its current contents are copied into the new array once, at creation time — later changes to the source are not tracked, so the result is a snapshot. After creation, `id` outputs the new array's id and `done` (Done) fires, followed by `completed` (Completed). There is no Failure or Unchanged port: the node builds its own array, so it can neither fail to find one nor do nothing. Each trigger of Do creates another new array.

## When to use it

When you need an anonymous or per-instance array instead of one fixed well-known id — e.g. snapshotting a live array before batch-processing it, or creating a sub-array whose id you store on an object. If one well-known shared array is enough, just use Array (Collection2) with a fixed id.

## At a glance

| | |
|---|---|
| Category | Data |
| Type name | `CollectionNew` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `items` | Array | — | Contents to copy into the new array when Do fires; leave unconnected to start empty |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `new` | Signal | — | Creates a fresh array with a generated id and copies Items into it |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `id` | String | — | Id of the array made by the last Do — give it to an Array node or a mutator to reach the same array; empty until Do has fired |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation. This node has no other outcome — no Unchanged and no Failure — so it always fires together with Done, and wiring either one does the same thing. It is here on every action so that reaching for it is never a per-node decision |
| `done` | Signal | — | Fires once the new array exists and Id is up to date |

## Patterns

- `id` → Collection2 `collectionId`: bind an Array node to the newly created array to read it.
- Snapshot before a batch: source `items` → this `items`, Do on the user action, `created` → Run Tasks `run`.

## Examples

**Run Tasks: batch-process an array with a worker component**

Run Tasks executes its `taskTemplate` component once per element of `items`, up to `maxRunningTasks` at a time, and fires `completed` when the whole batch has finished, whatever the outcome — `done` is the narrower signal that the run finished having done its work. The worker is a plain component: it receives the item's properties through Component Inputs and reports completion through Component Outputs signals (success/failure), which Run Tasks consumes to schedule the next task. Here a fresh array is assembled with New Array and processed on click.

## Related nodes

[Array](./collection2.md), [Insert Object Into Array](./collection-insert.md), [Clear Array](./collection-clear.md), [Run Tasks](./run-tasks.md), [Create New Object](./new-model.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
