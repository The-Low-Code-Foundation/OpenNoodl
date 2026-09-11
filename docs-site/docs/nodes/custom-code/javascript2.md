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

This is the Script node. Ports are declared by the user script in the "code" parameter via "node.addInputProps"/"setOutputs" style APIs; the port set is whatever the script defines. Port names are exactly as declared — unlike the Function node ("JavaScriptFunction"), the Script node adds no "in-"/"out-" prefix.

| Condition | Inputs shown | Outputs shown |
|---|---|---|
| useExternalFile = no OR useExternalFile NOT SET | `code` | — |
| useExternalFile = yes | `externalFile` | — |

## Ports at runtime

All data and signal ports are runtime-discovered by parsing the script (JavascriptNodeParser): the keys of the declared `inputs`/`outputs` maps become ports with the declared types, each `signals` entry (or top-level handler function named like a signal input) becomes a signal input, and entries in the `scriptInputs`/`scriptOutputs` proplist parameters add further typed ports. Nothing about the port set is static — an authoring tool must write the script first and wire only names the script (or the proplists) declares. Those names are used verbatim: unlike the Function node (`JavaScriptFunction`), whose mined ports are named `in-x` / `out-y`, the Script node adds no prefix, so a declared input `price` is wired as `toProperty: "price"`. When `useExternalFile` is `yes` the ports come from the downloaded file, so they are unknowable until it loads.

## Patterns

- Wrap a stateful browser library: instantiate it in `setup`, feed it from `changed` handlers, dispose it in `destroy`.
- Declare `mySignal: function (inputs, outputs) {...}` and wire a Button `onClick` to the `mySignal` input for an explicit, named action entry point.

## Watch out for

- Using Script for a simple transform that reruns on input change — the Function node does that with less ceremony.
- Assigning outputs without the declared `outputs` entry: undeclared names never become ports.

## Examples

**HTTP Request with scripted post-processing and error display**

HTTP Request (net.noodl.HTTP) fetches the `url` when `fetch` fires and delivers `response` (parsed body), `statusCode`, and either `done` or `failure` with `error` — plus `completed` after either, to carry on regardless. The response is post-processed by a Script node (Javascript2), whose input/output ports are declared by its own code — here it reads `Inputs.response` and produces a `headline` output. Errors surface as a level: `failure` evaluates a Condition whose `result` shows the error text.

**Mount a third-party grid, and unmount it again**

The smallest complete statement of the lifecycle pair: a `Javascript2` node that reaches a DOM element belonging to a `Group`, hands it to a library that is not Noodl's, and — the half that is almost always missing — tears that library down again on `Node.Signals.WillUnmount`. Only two nodes, and the pattern generalises to every grid, chart, map and editor in the ecosystem. ⚠️ The community wrote this against AG Grid loaded separately; the graph does not bundle it, and neither the script's CDN tag nor the licence AG Grid asks for is part of what lands here. Read it for the mount/unmount shape, not as a working grid.

**Drag a file onto the page, or click to browse**

A drop target built the way the browser actually requires: a `Javascript2` node adds `dragover`/`drop` listeners to the element on `Node.Signals.DidMount` and removes them on `WillUnmount`, because a listener attached without a matching removal survives the component and fires against a node that is gone. `Component Children` means the drop zone wraps whatever you put inside it rather than dictating its own appearance, and `Open File Picker` gives the same component a click-to-browse path, so one part answers both ways a person supplies a file. ⚠️ One wire in the original had to be re-pointed to land here: it named an `Open File Picker` output called `success`, which was real when this was written and is now called `done`.

**Blink a button, and stop cleanly**

A strobe is a good miniature of a hard problem: something that keeps running after the signal that started it, and therefore has to be stopped by something other than the thing that started it. A `Javascript2` node owns the interval, a `Switch` turns it on and off, a `States` node carries the two appearances, and a `Number` makes the period an input instead of a literal. ⚠️ The half people leave out is the reset — stopping an interval without restoring the state leaves the button frozen in whichever half of the blink it happened to be in, which looks like a different bug entirely. This one restores it.

**Load a rich-text editor from a CDN at runtime**

The interesting node here is the one that loads nothing visual: a `JavaScriptFunction` that injects a `<script>` tag and resolves once it has loaded, so the editor library arrives at run time rather than being bundled. That is the pattern to take away — it is how any large third-party library gets into a NodeGX app without inflating the build. The `Javascript2` node then mounts TinyMCE onto a `Group`'s element, a `CSS Definition` reconciles the editor's chrome with the project's tokens, and `Cloud File` plus `NewDbModelProperties` give pasted images somewhere to live. ⚠️ `tinymce-api-key` is a `String` node holding an empty value — TinyMCE's CDN build wants your own key, and this graph deliberately does not carry one.

**Record video from the camera and store the result**

The same shape as the audio recorder and worth reading beside it, because what the two have in common is the part that generalises: ask for the device, gate every control on the answer, let one `Javascript2` node own the `MediaRecorder`, and convert the finished `Blob` before anything tries to store it. Video adds the preview problem — you need a live `<video>` element while recording and a playable one afterwards — which is why a Custom HTML node holds the player rather than an `Image`. ⚠️ `getUserMedia` requires a secure origin: this works on `localhost` and over HTTPS and fails on a plain-HTTP deploy, which is a deployment fault that presents as a permission one.

## Related nodes

[Function](./java-script-function.md), [Expression](./expression.md), [Visual Function](./logic-builder.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
