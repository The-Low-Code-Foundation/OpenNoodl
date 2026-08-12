---
title: "Visual Function"
---
Block-based (Blockly) logic: blocks compile to JavaScript that runs when a signal fires and writes the node's output ports.

Logic Builder stores a visual block program (Google Blockly) in its `workspace` parameter; the editor generates plain JavaScript from the blocks into the `generatedCode` parameter, and the runtime compiles and executes that code. Execution is strictly signal-driven: the logic runs when the `run` signal input (or a block-defined signal input) fires — changing an input value alone never executes it. The generated code runs with `Inputs`, `Outputs`, `Noodl`, `Variables`, `Objects`, `Arrays`, `sendSignalOnOutput` and `__triggerSignal__` in scope, so blocks can read and write global Noodl Variables/Objects/Arrays as well as the node's own ports, and a program with several signal inputs can branch on which one started the run. Every run ends on a signal: `success` and `done` when the program ran through, `unchanged` when there are no blocks yet, `failure` when it threw or would not compile, with the message on the `error` string output — which clears on the next successful run. The block set covers the Noodl seam (ports, signals, Variables/Objects/Arrays) plus stock Blockly logic, loops, math, text, lists, workspace variables and user-defined functions.

## When to use it

Reach for it when logic must be authorable without writing JavaScript, or when the imperative shape of the logic — a sequence, a loop, a local variable — is the point. For anything beyond what the block set expresses — async work, API calls, library use — use JavaScriptFunction (Function); for a one-line computation use Expression.

## At a glance

| | |
|---|---|
| Category | CustomCode |
| Type name | `Logic Builder` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `generatedCode` | String | — | The JavaScript the block editor writes out of Logic Blocks and the runtime actually executes; it is overwritten on every block edit, so hand edits do not survive |
| `workspace` | String | — | The block program itself, authored in the block editor — it decides which ports this node has, so editing it adds and removes ports |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `run` | Signal | — | Runs the block program once; the blocks never run on their own, so a value arriving at an input changes nothing until this fires |

## Outputs

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once a run you triggered has finished, after Success and after every output the program wrote |
| `success` | Signal | — | Fires once the block program has run through without throwing and every output it wrote is up to date |
| `unchanged` | Signal | — | Fires when there are no blocks to run yet, which is what a freshly dropped Visual Function looks like |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | What the last run went wrong with, in JavaScript's own words; empty once a run succeeds |
| `failure` | Signal | — | Fires when the block program threw while running, or could not be compiled at all |

## Dynamic ports

_This node's port list changes at runtime (runtime-discovered); the tables above may be incomplete for a given instance._

Ports are generated from the visual logic program stored in the node parameters; each program variable/event becomes a port.

## Ports at runtime

Ports are determined from the `workspace` parameter, not from the generated code. The editor parses the saved blocks and publishes: a value input per `Define input`/`get input` name (carrying the declared type, `*` when only used), a value output per `Define output`/`set output` name, a signal input per `Define signal input`, and a signal output per `Define signal output`/`send signal`. Ports are republished on every `workspace` change, including retraction when blocks are deleted. The runtime registers each port on demand as connections are made, using the same parse to decide signal versus value. Block-declared names are registered verbatim, not prefixed, so six names are reserved for the node's own ports and a block that uses one is dropped from the published set: `workspace`, `generatedCode` and `run` on the input side, `error`, `success` and `failure` on the output side. A program that writes to a reserved output name raises `logic-builder/reserved-port-name` rather than losing the value silently. An authoring tool should treat `workspace` and `generatedCode` as an editor-managed pair — never write one without the other, and never hand-edit either — wire execution to `run` or a block-declared signal input, sequence downstream work on `success`, and read the port names the blocks declare.

## Patterns

- Button `onClick` → `run`, a value into a block-declared input, and a block-declared output wired to a Text — the minimal block-program shape.
- `send signal` blocks to fan out to different downstream nodes depending on what the program decided.
- Blocks read and write `Noodl.Variables` to exchange state with the rest of the app when a port would be awkward.

## Watch out for

- Expecting the logic to re-run when connected values change — nothing executes until a signal fires.
- Hand-editing `generatedCode`; the block editor overwrites it from `workspace`.
- Writing a `workspace` string without the matching `generatedCode` (or the reverse) — the first decides the ports, the second decides what runs, and they must come from the same block program.

## Examples

**Logic Builder: block-built logic with generated ports**

Logic Builder holds a visual block workspace (`workspace`) from which the editor generates JavaScript (`generatedCode`); the inputs, outputs and signals the blocks declare or use become the node's ports. Here the block program turns a name into a greeting: the text input feeds the block-declared `name` input, `run` executes the program, and the block-declared `greeting` output lands in a Text. Both parameters are editor-managed — author the blocks, never hand-write either string. Use Logic Builder where non-programmers must be able to read and edit the logic; use Function for anything a programmer maintains.

## Related nodes

[Function](./java-script-function.md), [Script](./javascript2.md), [Expression](./expression.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
