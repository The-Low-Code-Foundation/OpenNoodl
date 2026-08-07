---
title: "Function"
---
Function: runs multi-line JavaScript; Inputs.* reads create input ports, Outputs.* writes create output ports, Outputs.fn() fires signals.

The Function node executes the JavaScript in `functionScript`. The script's surface *is* its port list: reading `Inputs.name` creates an input port `name`, assigning `Outputs.name = value` creates a value output, and calling `Outputs.name()` creates and fires a signal output (conventionally `Outputs.Success()` / `Outputs.Failure()`). The script runs whenever a ticked input changes, and additionally when the `run` signal fires — connecting `run` takes nothing away; untick an input under Run On Value Change to stop that one triggering a run. A `run` you triggered reports `done` once the script has finished (awaiting an async body first), `failure` if it threw or would not compile, and `unchanged` when there is no script written yet. Scripts may be async and use `await` — fire a signal output when done to sequence downstream work.

## When to use it

Anything beyond a one-liner: data transformation, calling browser APIs or fetch, orchestrating async steps. Prefer Expression for simple pure computations and dedicated nodes (Query Records, REST2) where they exist — graphs stay more inspectable than scripts.

## At a glance

| | |
|---|---|
| Category | CustomCode |
| Type name | `JavaScriptFunction` |
| Available in | browser, cloud |
| SSR compatibility | partial — Runs user code server-side; code touching window/document fails there (error logged, outputs unchanged). |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `functionScript` | String | — | JavaScript run when Run fires, reading Inputs.name and writing Outputs.name |
| `scriptInputs` | Proplist | — | Names of the values the script reads from Inputs, each becoming an input port |
| `scriptOutputs` | Proplist | — | Names of the values the script writes to Outputs, each becoming an output port |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `run` | Signal | — | Runs the script now. This is additional to the inputs that re-run it; untick an input under Run On Value Change to stop that one triggering a run |

## Outputs

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once a Run you triggered has finished, waiting for an async script to resolve first |
| `success` | Signal | — | Fires once the script has finished, waiting for an async script to resolve first |
| `unchanged` | Signal | — | Fires when there is no script to run yet, which is what a freshly dropped Function looks like |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | What the script went wrong with, in JavaScript's own words |
| `failure` | Signal | — | Fires when the script threw while running, or could not be compiled at all |

## Dynamic ports

_This node's port list changes at runtime (runtime-discovered); the tables above may be incomplete for a given instance._

This is the Function node. Input and output ports are discovered from the user script in the "functionScript" parameter: reading "Inputs.xyz" creates input port "xyz", assigning "Outputs.xyz" creates output port "xyz". Signal outputs are created by calling "Outputs.xyz()".

## Ports at runtime

All data/signal ports are runtime-discovered from the script source: the editor parses `Inputs.x` / `Outputs.y` references (JavascriptNodeParser) and registers matching ports; nothing about them is static. An authoring tool must write the script first and then wire to exactly the names the script uses — including signal outputs, which are the calls, not assignments.

## Patterns

- Async action: `run` from a click → `await fetch(...)` → set value outputs → `Outputs.Success()`; wire Success onward for sequencing.
- Transform between nodes: array in, reshaped array out, feeding a Repeater.

## Watch out for

- Rebuilding what a dedicated node already does (querying cloud data, navigation) — you lose live updates and editor insight.
- Relying on auto-run while also connecting `run`; once `run` is connected, only the signal executes the script.

## Examples

**Function node: custom JavaScript with discovered ports**

The Function node (JavaScriptFunction) runs the JavaScript in `functionScript`. Its data ports do not exist until the script mentions them: reading `Inputs.x` creates an input named x, assigning `Outputs.y = …` creates an output named y, and calling `Outputs.done()` fires a signal output — this is why the catalog marks them runtime-determined. The script runs when `run` is triggered (or when connected inputs change, if `run` is unconnected). Here a button converts a text amount to a formatted price.

## Related nodes

[Expression](./expression.md), [Script](./javascript2.md), [REST](../data/rest2.md), [Run Tasks](../data/run-tasks.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
