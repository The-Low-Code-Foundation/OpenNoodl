---
title: "Script"
---
Script: runs JavaScript that declares its own typed inputs/outputs, named signal handlers and lifecycle (setup/run/destroy) methods.

The Script node executes the JavaScript in its `code` parameter (or, when `useExternalFile` is `yes`, a file fetched from `externalFile`). Unlike the Function node, the script declares its ports explicitly and gets a lifecycle: `define({ inputs: { price: 'number' }, outputs: { total: 'number' }, setup: fn, run: fn, destroy: fn, mySignal: fn })` creates typed input/output ports from the `inputs`/`outputs` maps, runs `setup` once after the code is parsed, runs `run` (alias `change`) each time any value input changes (it receives `(inputs, outputs, changedInputs)`), runs a function named after a signal input when that signal fires, and runs `destroy` when the node is removed. A newer `script({...})` form adds `signals: {}`, `changed: {}` (per-input change handlers) and `methods: {}` sections. Inside handlers, `this.flagOutputDirty(name)` and `this.sendSignalOnOutput(name)` push results out. Typed ports can also be added from the editor panel via the `scriptInputs`/`scriptOutputs` lists.

## When to use it

Use Script when code needs a real lifecycle — initialize a library or subscription in `setup`, tear it down in `destroy` — or several distinct signal entry points with typed ports. For ordinary run-once logic and async calls, prefer JavaScriptFunction (Function): its implicit `Inputs.x`/`Outputs.y` ports and single `run` signal are simpler. For pure one-liners use Expression.

## At a glance

| | |
|---|---|
| Category | CustomCode |
| Type name | `Javascript2` |
| Available in | browser |
| SSR compatibility | partial — Runs user code server-side; code touching window/document fails there (error logged, outputs unchanged). |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `code` | String | `` | The script, which declares its own ports through the define API |
| `externalFile` | Source | — | Where to load the script from; used only when Use External File is Yes |
| `scriptInputs` | Proplist | — | Names of the values the script reads, each becoming an input port |
| `scriptOutputs` | Proplist | — | Names of the values the script writes, each becoming an output port |
| `useExternalFile` | Enum (`yes`, `no`) | `no` | Whether the code is loaded from File Path instead of being typed into Code |

## Dynamic ports

_This node's port list changes at runtime (declared-port-groups, runtime-discovered); the tables above may be incomplete for a given instance._

This is the Script node. Ports are declared by the user script in the "code" parameter via "node.addInputProps"/"setOutputs" style APIs; the port set is whatever the script defines.

| Condition | Inputs shown | Outputs shown |
|---|---|---|
| useExternalFile = no OR useExternalFile NOT SET | `code` | — |
| useExternalFile = yes | `externalFile` | — |

## Ports at runtime

All data and signal ports are runtime-discovered by parsing the script (JavascriptNodeParser): the keys of the declared `inputs`/`outputs` maps become ports with the declared types, each `signals` entry (or top-level handler function named like a signal input) becomes a signal input, and entries in the `scriptInputs`/`scriptOutputs` proplist parameters add further typed ports. Nothing about the port set is static — an authoring tool must write the script first and wire only names the script (or the proplists) declares. When `useExternalFile` is `yes` the ports come from the downloaded file, so they are unknowable until it loads.

## Patterns

- Wrap a stateful browser library: instantiate it in `setup`, feed it from `changed` handlers, dispose it in `destroy`.
- Declare `mySignal: function (inputs, outputs) {...}` and wire a Button `onClick` to the `mySignal` input for an explicit, named action entry point.

## Watch out for

- Using Script for a simple transform that reruns on input change — the Function node does that with less ceremony.
- Assigning outputs without the declared `outputs` entry: undeclared names never become ports.

## Examples

**HTTP Request with scripted post-processing and error display**

HTTP Request (net.noodl.HTTP) fetches the `url` when `fetch` fires and delivers `response` (parsed body), `statusCode`, and either `done` or `failure` with `error` — plus `completed` after either, to carry on regardless. The response is post-processed by a Script node (Javascript2), whose input/output ports are declared by its own code — here it reads `Inputs.response` and produces a `headline` output. Errors surface as a level: `failure` evaluates a Condition whose `result` shows the error text.

## Related nodes

[Function](./java-script-function.md), [Expression](./expression.md), [Visual Function](./logic-builder.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
