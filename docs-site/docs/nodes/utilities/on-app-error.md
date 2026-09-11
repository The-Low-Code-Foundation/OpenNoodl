---
title: "On App Error"
---
App-wide error boundary: fires whenever any node reports a failure, with the code, message and the node it came from.

The catch-all half of the Failure Contract. Per-node `Failure` outputs cover the errors an author expects and wants to branch on where they happen; this node covers everything else, which is most of them — the library will never carry complete failure ports on all 155 node types, and without a boundary the only record of an unwired error is a console line nobody sees in a deployed app. It subscribes as soon as it is created, so errors raised while the graph is still starting up are caught too. `Filter` narrows it by code prefix: blank catches everything, `run-tasks` catches every failure Run Tasks can report, `run-tasks/no-completion-output` catches exactly one. Several instances can coexist and all of them fire — this is a boundary, not a handler chain, so one node logging every error never stops another from showing a toast for the subset it cares about.

## When to use it

Put one in the app's root component to make failures visible at all — log them, show a message, or forward `Error Object` to an error-reporting service. Add narrower ones with a `Filter` where a particular area needs its own handling. Use a node's own `Failure` output instead when you want to branch on an error at the point it happens.

## At a glance

| | |
|---|---|
| Category | Utilities |
| Type name | `On App Error` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `filter` | String | — | Only errors whose Code starts with this text are reported; leave blank to catch every error in the app |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `code` | String | — | Stable kebab-case identifier for this kind of error, namespaced by node type, as in run-tasks/task-failed |
| `componentName` | String | — | Component the failing node sits in, or <runtime> when the error was raised outside any node |
| `message` | String | — | Human-readable account of what went wrong, safe to reword between releases — match on Code instead |
| `nodeId` | String | — | Graph id of the node that raised the error, or <runtime> when it was raised outside any node |
| `nodeType` | String | — | Kind of node that raised the error, or <runtime> when it was raised outside any node |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | Signal | — | Fires when an error passes the Filter, after every value output below has been updated to describe it |
| `errorObject` | Object | — | The whole error event as one record, for logging it or sending it to an error-reporting service |

## Patterns

- One unfiltered On App Error in the root component, with `Message` into a Text and `Error` showing a popup — the minimum that makes a deployed app's failures visible.
- `Error Object` into an HTTP Request body to forward failures to an error-reporting service.
- A second, `Filter`ed instance beside a specific feature, handling that area's errors without stopping the app-wide one from logging them.

## Watch out for

- Matching on `Message` — it is free to be reworded between releases; match on `Code`.
- Expecting one instance to consume an error so another does not see it; every instance whose Filter matches fires.
- Using it in place of a node's own `Failure` output when the error is expected and the graph should branch on it where it happens.

## Examples

**Catch the errors nobody wired a Failure port for**

Per-node `Failure` outputs cover the errors an author expected and wanted to branch on where they happen. This node covers everything else, which in a real app is most of them — no library will ever carry complete failure ports on every node type, and without a boundary the only record of an unwired error is a console line nobody reads in a deployed app. It subscribes as soon as it is created, so errors raised while the graph is still starting are caught rather than missed during setup, which is exactly the window where a misconfigured backend or a missing secret shows up. The ordering guarantee is what makes it usable: the value outputs — Message, Code, Node Type, Node Id, Component Name — are updated BEFORE the `error` signal fires, so reading them on the pulse always describes this error rather than the previous one. Filter is blank here, and blank is the right default for a boundary; a code prefix narrows it to one node type or one specific error, which is what you want for a second, more specific handler rather than for the catch-all. Error Object wires straight into a string input and renders as JSON, which is what to send to a logging service. Put one of these at the root of the app, not one per page: a boundary that only exists on the screen where you were debugging catches nothing on the screen where the bug actually reaches a user.

## Related nodes

[Run Tasks](../data/run-tasks.md), [Expression](../custom-code/expression.md), [Function](../custom-code/java-script-function.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
