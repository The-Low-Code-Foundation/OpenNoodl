---
title: "Run Tasks"
---
Run Tasks: runs a worker component once per array element with bounded concurrency, reporting an outcome and completed when the batch ends.

Run Tasks is batch processing without visuals: for each element of `items` it instantiates `taskTemplate` (a component, not rendered), feeds the element's properties to the worker's Component Inputs, and waits for the worker to signal success or failure through its Component Outputs before scheduling the next, keeping at most `maxRunningTasks` in flight. `stopOnFailure` abandons the rest after the first failure, and `abort` stops the batch mid-run. Both `run` and `abort` are actions and each reports its own outcome: `done` when the run ended having done its work — including an empty `items` list, which is a completed run and not a no-op — `unchanged` for a `run` that arrives while a run is already in progress or an `abort` with nothing to abort, and `failure` when a task failed or the run could not start. `completed` fires after every one of those. `aborted` fires alongside the outcome whenever a run ended early, which is what distinguishes an honoured `abort` (reported `done`, because stopping when told to is the graph working) from an ordinary completion.

## When to use it

Sequenced bulk work: importing rows, uploading a list of files, migrating records. For rendering a list use the Repeater; for one async action a Function node suffices.

## At a glance

| | |
|---|---|
| Category | Data |
| Type name | `RunTasks` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `items` | Array | — | The list to run the template once for; each entry becomes one task and is passed to it as a record |
| `maxRunningTasks` | Number | `10` | How many tasks may run at the same time; must be at least 1 or the run fails rather than starting |
| `taskStartInput` | String | `Do` | Name of the template's signal input to pulse when a task begins |
| `taskSuccessOutput` | String | `Success` | Name of the template's signal output that means one task finished successfully |
| `taskTemplate` | Component | — | The component to run once per item, which must expose the ports named under Template Contract |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `abort` | Signal | — | Stops starting new tasks and ends the run once those already running finish; reports Unchanged when no run is in progress |
| `run` | Signal | — | Starts a run over Items; a Do while a run is already in progress reports Unchanged rather than queueing |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `stopOnFailure` | Boolean | `false` | Abandons the remaining items as soon as one task fails, rather than running the whole list |
| `taskErrorOutput` | String | `Error` | Name of an optional value output on the template carrying why a task failed; leave blank if it cannot say |
| `taskFailureOutput` | String | `Failure` | Name of the template's signal output that means one task failed |

## Outputs

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `aborted` | Signal | — | Fires when a run ended early, either from Abort or because Stop On Failure caught a failure |
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires when the run ended having done its work: every task completed without failing, the Items list was empty, or an Abort was honoured — Aborted fires alongside it when the run ended early |
| `unchanged` | Signal | — | Fires when there was nothing to do: a Do while a run is already in progress, or an Abort with no run in progress |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `failure` | Signal | — | Fires when at least one task failed, or when the run could not start at all; which item failed is reported on the error channel |

## Patterns

- Build the batch with New Array/Array, then `created` → `run`: data assembly and execution stay separate.

## Watch out for

- Using a Repeater with invisible items as a work queue — Run Tasks exists precisely so batch work needs no render tree.

## Examples

**Run Tasks: batch-process an array with a worker component**

Run Tasks executes its `taskTemplate` component once per element of `items`, up to `maxRunningTasks` at a time, and fires `completed` when the whole batch has finished, whatever the outcome — `done` is the narrower signal that the run finished having done its work. The worker is a plain component: it receives the item's properties through Component Inputs and reports completion through Component Outputs signals (success/failure), which Run Tasks consumes to schedule the next task. Here a fresh array is assembled with New Array and processed on click.

## Related nodes

[Repeater](../visual/for-each.md), [Component Inputs](../component-utilities/component-inputs.md), [Component Outputs](../component-utilities/component-outputs.md), [Function](../custom-code/java-script-function.md), [Create New Array](./collection-new.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
