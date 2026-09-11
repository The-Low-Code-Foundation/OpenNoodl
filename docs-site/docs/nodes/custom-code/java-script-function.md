---
title: "Function"
---
Function: runs multi-line JavaScript; `Inputs.x` mints the port `in-x`, `Outputs.y` the port `out-y` — wire the prefixed name.

The Function node executes the JavaScript in `functionScript`. The script's surface *is* its port list, but the connectable port **name** is prefixed and the script name is not: reading `Inputs.name` creates an input port called **`in-name`**, assigning `Outputs.name = value` creates a value output called **`out-name`**, and calling `Outputs.name()` creates and fires a signal output called **`out-name`** (conventionally `Outputs.Success()` / `Outputs.Failure()`). The property panel labels each of these with its unprefixed display name, so what you read on the node (`name`) is not what a connection must be written to (`in-name`) — wire to the prefixed name. The node's own static ports (`run`, `done`, `success`, `failure`, `completed`, `unchanged`, `error`) are never prefixed, which is exactly why the prefix exists: a script calling `Outputs.done()` gets `out-done`, distinct from the built-in `done`. The script runs whenever a ticked input changes, and additionally when the `run` signal fires — connecting `run` takes nothing away; untick an input under Run On Value Change to stop that one triggering a run. A `run` you triggered reports `done` once the script has finished (awaiting an async body first), `failure` if it threw or would not compile, and `unchanged` when there is no script written yet. Scripts may be async and use `await` — fire a signal output when done to sequence downstream work.

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

This is the Function node. Input and output ports are discovered from the user script in the "functionScript" parameter, and the connectable port NAME carries a prefix the script does not: reading "Inputs.xyz" creates the input port "in-xyz", assigning "Outputs.xyz" creates the output port "out-xyz", and calling "Outputs.xyz()" creates the signal output "out-xyz". The property panel and the port list show the unprefixed display name ("xyz"), so connect to "in-xyz"/"out-xyz" — a connection written to the bare script name silently targets a port that does not exist. The node's own static ports ("run", "done", "success", "failure", "completed", "unchanged", "error") are never prefixed, so "Outputs.done()" is the separate port "out-done". The Script node ("Javascript2") does NOT prefix; that convention belongs to this node alone.

## Ports at runtime

All data/signal ports are runtime-discovered from the script source: the parser (JavascriptNodeParser) mines `Inputs.x` / `Outputs.y` references and registers a port whose `name` is `in-x` / `out-y` and whose `displayName` is the bare `x` / `y`. An authoring tool must write the script first and then wire to the **prefixed** names — `toProperty: "in-x"`, `fromProperty: "out-y"` — never to the bare name the script uses, which is a display label only. Signal outputs follow the same rule and are the calls (`Outputs.y()`), not the assignments. A connection written to the bare name is accepted by every write path and every static validator (this type's ports are runtime-discovered, so the port-existence gate deliberately does not fire) and then fails on the canvas as "Target port doesn't exist". The node's own static ports — `run`, `done`, `success`, `failure`, `completed`, `unchanged`, `error` — are declared, not mined, and are wired unprefixed. The Script node (`Javascript2`) declares its ports and does not prefix them; the two conventions differ.

## Patterns

- Async action: `run` from a click → `await fetch(...)` → set value outputs → `Outputs.Success()`; wire Success onward for sequencing.
- Transform between nodes: array in, reshaped array out, feeding a Repeater.

## Watch out for

- Wiring to the bare script name — `toProperty: "amount"` for a script reading `Inputs.amount`. The port is `in-amount`; the bare name is only its display label, and the mistake survives every validator to fail on the canvas.
- Rebuilding what a dedicated node already does (querying cloud data, navigation) — you lose live updates and editor insight.
- Relying on auto-run while also connecting `run`; once `run` is connected, only the signal executes the script.

## Examples

**Function node: custom JavaScript with discovered ports**

The Function node (JavaScriptFunction) runs the JavaScript in `functionScript`. Its data ports do not exist until the script mentions them, and they are named with a prefix the script does not use: reading `Inputs.amount` creates the port `in-amount`, assigning `Outputs.formatted = …` creates the port `out-formatted`, and calling `Outputs.done()` creates the signal output `out-done` — this is why the catalog marks them runtime-determined. Note the connections below: they use `in-amount` and `out-formatted`, not the bare names in the script, which are display labels only. The node's own `run` signal is a declared port and stays unprefixed. The script runs when `run` is triggered (or when connected inputs change, if `run` is unconnected). Here a button converts a text amount to a formatted price.

**Turn rows into a file the browser downloads**

Two `JavaScriptFunction` nodes in series and no backend anywhere: the first folds an array of objects into CSV text, the second wraps that text in a `Blob` and hands `URL.createObjectURL` the result, and `External Link` opens it. That URL is the whole trick — it is a real, fetchable address that exists only inside this tab, so the download never leaves the browser and nothing has to be uploaded first. ⚠️ Compare it with `net.noodl.ToCSV` before reusing the conversion half: the built-in node handles quoting and embedded delimiters, which hand-rolled CSV usually does not. The half worth copying is the object-URL download.

**Set the meta tags a link preview reads**

Seventeen nodes that exist because the runtime writes no `<meta>` tags for you: a `JavaScriptFunction` reaches `document.head` and sets title, description, canonical URL, robots, the Open Graph set and the Twitter card, each fed from its own `String` or `States` node so a page can override one without restating the rest. The `Expression` defaulting the URL to `location.href` is what stops a forgotten `og:url` pointing at the wrong page. ⚠️ Nothing here needs a node that does not exist — but nothing here is done for you either, so budget the seventeen nodes.

## Related nodes

[Expression](./expression.md), [Script](./javascript2.md), [REST](../data/rest2.md), [Run Tasks](../data/run-tasks.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
