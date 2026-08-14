# FIX-007 — The connector the AI cannot draw

**Report 4 (c)** · Tier 1 · Effort **S + M**

> *"It said 'target port doesn't exist' from the component input to the function node port, and
> when I deleted the connection and redid the exact same connection, it was fine."*

## Mechanism — pinned, with a lead suspect and a discriminator

The error is `NodeGraphModel.ts:659` (`con-no-target-port`) — a **canvas health warning**, not a
write-time rejection. The connection was accepted and written. Two mechanisms produce it; one grep
on the artefact distinguishes them.

### 🔴 Lead: the `in-` / `out-` prefix — the AI's own reference is wrong

A Function node's connectable port name is **not** the name in the script.
`simplejavascript.ts:736-739` mints ports with `inputPrefix: 'in-'`, `outputPrefix: 'out-'` — so
`Inputs.value` becomes port **`in-value`** with *display name* `value` (confirmed in a real
artefact: the sendgrid prefab wires `"toProperty": "in-Text"`). But:

- `node-catalog.json` → `JavaScriptFunction.dynamicPorts.description`: *"reading `Inputs.xyz`
  creates input port `xyz`"* — **wrong by a prefix**.
- `node-catalog-enriched.json` → `runtimeBehavior`: *"wire to exactly the names the script uses"*
  — wrong in the most actively misleading way possible; it is an instruction aimed at precisely
  this caller.
- The Script node (`Javascript2`) uses **unprefixed** names — the docs describe the Script
  convention on the Function page.

A connection written `toProperty: "value"` passes MCP zod (four plain strings), passes the
semantic validator **by design** (`nonexistentPort.ts:73-93` skips `dynamicPorts` types;
`CatalogIndex.ts:35-40` lists `runtime-discovered` as never-error), lands red on the canvas — and
the user "redrawing the identical connection" from a port the panel labels `value` actually
creates `in-value`, which works. Everything in the report is explained.

### Secondary: the viewer round-trip and the 2-second health lag

Function ports are minted by the **running viewer** and pushed back (`sendDynamicPorts`,
`simplejavascript.ts:884-887` → `ViewerConnection.ts:199-204` → `setDynamicPorts`). Between
staging and the round-trip, `getPort('in-value')` is `undefined` and the warning fires; it should
clear via `instancePortsChanged` → `scheduleUpdateTypes` (1 ms) → `scheduleEvaluateHealth`
(**2000 ms**, `NodeGraphModel.ts:604-614`). Unreliable when: no viewer running (**no ports ever**),
or the memoised port cache goes stale (`NodeGraphNode.ts:504, 529-547` — the R8 comment documents
this cache biting before).

### The gate asymmetry underneath both

The manual drag passes `getConnectionStatus` (`NodeGraphModel.ts:527+`) which checks the port
exists and is compatible **before** creating. The AI/editor path (`staging.ts` → `fromJSON` →
bare `addConnection` loop, `NodeGraphModel.ts:95-97, 421-441`) and the MCP path
(`graph.ts:292-309`, checks node ids only) **never consult ports at all**.

## Fix direction — in structure > gate > docs order

1. **Docs, one line, highest value (S):** correct `dynamicPorts.description` and
   `runtimeBehavior` for `JavaScriptFunction` to state the `in-`/`out-` prefix with a worked
   example, and state that `Javascript2` does **not** prefix. Add the same sentence to
   `WIRE_FORMAT_LEGEND` (`parameterValues.ts:405`) so both clients carry it unconditionally.
2. **Gate (M):** give `nonexistentPort` a narrow non-skip branch for `JavaScriptFunction`: run
   `parseAndAddPortsFromScript` over the node's own `functionScript` parameter and check endpoints
   against the result, suggesting `in-<name>` when the unprefixed name matches. This family's ports
   are statically derivable from a parameter in the same file, so the general dynamic-port skip is
   not weakened. Requires lifting the parser's regex families into a pure helper shared by
   validator + runtime (they agree only by hand today).
3. **Structure (M):** `NodeGraphModel.addConnection` optionally runs `getConnectionStatus`; the
   staging path passes it. Must be a **report, not a refusal** — legitimately runtime-discovered
   ports are absent at import time.
4. **Ergonomic (S):** force `evaluateHealth()` on `instanceports` receipt (or shorten the 2 s
   debounce) so a genuinely-fine wire stops flashing red after ports arrive.

## First step — the discriminator

🔴 **Reproduce before building:** grep the affected artefact. `"toProperty": "value"` = prefix bug
(fix 1+2 lead). `"toProperty": "in-value"` = timing/cache (fix 4 leads, and check whether a viewer
was running at staging). Also note the ⚠️ from the same lane: the MCP **operations-door**
`add_connection` still rebuilds a wire from four fields and drops `label`/`labelT`/`route`
(`carryConnectionPresentation` is applied only on the `set` door) — file it here or as a rider.

## ✅ BUILT 2026-08-14 — the discriminator came back "prefix bug", and worse

**The reproduce-first step answered the lead hypothesis and then found the source.** The grep over
real artefacts: **80 correctly-prefixed endpoints** (hand-drawn and prefab wires) against **12
unprefixed ones, every one in a graph an agent wrote**. The mechanism predicts exactly that split —
a drag reads the port, only a writer reads the label.

🔴 **All three shipped worked examples wired the label**, including
`data-run-tasks-batch`'s `Component Inputs → Function` — *the user's reported scenario, blessed in
the corpus the AI reads*. The docs were not merely wrong; the examples taught the mistake.

Canonical corpus hit, in Richard's own project: `Puppy test 3` → `Pages/Admin` → "Format Puppy
List", script reads `Inputs.items` and writes `Outputs.text`, wired `items` → `text`, `ports: []`.
Both wires dead, page's list never rendered, report clean.

**Fix 1 (docs) — shipped.** `dynamic-port-notes.js` (Function + the Script contrast),
`enrichment/javascriptfunction.json` (summary/description/runtimeBehavior/ports/antiPatterns),
`enrichment/javascript2.json`, **all three examples corrected**, and `WIRE_FORMAT_LEGEND`.
Both catalogs and the docs site regenerated; `catalog:check`, `catalog:merge:check`,
`catalog:examples` (62/62) and `docs:nodes:check` all green.

**Fix 2 (gate) — shipped, and moved.** Not a `nonexistentPort` branch: that rule is right to skip
`runtime-discovered` types and its `NormNode` carries no parameters. It went to the
**authored-candidate layer** instead (`validation/functionPorts.ts` → `authoredPreconditionDiagnostics`),
which is shared by the editor's `submit_component` and MCP's `create_component`, sees `parameters`,
and **blocks at write time** rather than warning on canvas an hour later. New code
`UnprefixedFunctionPort`, error severity. It speaks only when the mined set proves intent, and
excludes names that are also declared ports — `done` beside `Outputs.done()` — which is what holds
it at zero false positives.

`tests-unit/fix-007/function-ports.test.ts`, 17 specs, includes an **agreement gate that runs the
real runtime parser** over a corpus and diffs it against our copied regexes, so the duplication
cannot drift silently.

⚠️ **One thing deliberately NOT shipped:** the prefix sentence in the `fromProperty`/`toProperty`
schema descriptions. It cost ~87 tokens across the connection schema's three renderings and broke
`toolDisclosure`'s 8,200-token surface budget, whose header asks each new cost to argue for itself.
It does not have to: the blocking rejection now names the exact replacement, and this repo has
measured suggestion-carrying rejections as self-corrected at ~100%. Reverted with the reasoning
recorded in `authoringVocabulary.ts`.

## 🔴 DRIVEN 2026-08-14 — and the drive found the gate was not reaching MCP at all

### The finding that mattered more than the drive: a stale sidecar

The gate is compiled into the **editor** by the dev webpack, so it was live there. But the MCP door
runs `packages/noodl-mcp/bin/noodl-mcp.js`, which is one line — `require('../dist/noodl-mcp.cjs')` —
and that bundle was dated **Aug 12, two days before FIX-007 was built**. `grep` for
`unprefixed-function-port` in `dist/` returned nothing.

**So the door this fix was written for was still shipping the old code.** `dist/` is gitignored and
regenerated by `build:sidecars`, so the *packaged* product was never at risk — but every locally
running MCP server was, and a drive through Richard's live server would have reported the gate
missing and been believed. Rebuilt with `npm --prefix packages/noodl-mcp run build` (151 ms); the
string is in the bundle now. ⚠️ **A running server keeps its loaded copy — Richard's MCP servers
need a restart to pick this up.** Same shape as the recorded stale-`dist` trap, on a different field.

### Criterion 2 ✅ — driven end to end, both controls

Spawned the freshly built sidecar over stdio against a **scratch copy** of a project (never Richard's),
and called `create_component` with the canonical corpus shape: `Component Inputs → JavaScriptFunction
→ Component Outputs`, script reading `Inputs.items` and writing `Outputs.text`.

**Negative control — rejected, and nothing was written:**

> `create_component "Logic/Fix007Probe" rejected — nothing was written.`
> `ERROR [unprefixed-function-port] … input "items": … but that port is named "in-items".`
> `→ did you mean` **`Write toProperty: "in-items"`**`. The node's own declared ports — run, done,`
> `success, failure, completed, unchanged, error — are not prefixed; only the ports mined from the`
> `script are.`

Both endpoints tripped — the input as `in-items` and the output as `out-text`. The suggestion carries
the exclusion that keeps the rule at zero false positives, in the rejection text itself.

**Positive control — accepted:** the identical component with `in-items`/`out-text` wrote cleanly,
`errors: 0, warnings: 0`. The rule speaks only to the wire that is actually wrong.

### Criterion 1 — MCP half ✅, internal-AI half not driven

The positive control above *is* the MCP half: a `Component Inputs → Function` input wire, written
through the AI's own door, accepted and persisted with zero diagnostics. The **internal AI** half is
not driven — this editor has a real Anthropic provider configured and the request costs money, so it
is left for Richard to authorise rather than spent unasked.

### Criterion 3 ✅

`catalog:check` (175 node types), `catalog:merge:check` (175/175 documented, 62 examples),
`cloud-library:check` (84 node types) all re-run green and up to date. MCP suite **41 suites / 458
tests**, `tests-unit/fix-007/function-ports.test.ts` **17/17**.

### Criterion 4 🔴 — cannot pass yet, and this is not a drive failure

It is gated on **fix 4, which is not built**. `ProjectModel.scheduleEvaluateHealth`
(`projectmodel.ts:1374-1384`) still hard-codes a `2000` ms `setTimeout` and there is still no forced
`evaluateHealth()` on `instanceports` receipt. Verified in source rather than guessed at. Criterion 4
should be re-driven when fix 4 lands, not before — a drive now would only re-measure the 2 s debounce.

**Still open:** fix 3 (structural — `addConnection` optionally running `getConnectionStatus`), fix 4
(force `evaluateHealth()` on `instanceports` receipt), the ⚠️ rider about `add_connection` dropping
`label`/`labelT`/`route`, criterion 1's internal-AI half (paid), and criterion 4 (blocked on fix 4).

## Acceptance criteria

1. 🟡 Asking the internal AI (and the MCP path) to wire a Component Input to a Function-node input
   produces a working connection with no `con-no-target-port` warning — driven end to end.
   **MCP path ✅ driven; internal-AI half needs Richard's go-ahead (paid).**
2. ✅ A connection deliberately written unprefixed trips the new validator suggestion naming
   `in-<name>` (negative control: a correct `in-` wire does not).
3. ✅ The corrected catalog text ships in both `node-catalog.json` and the enriched catalog; the
   catalog gates (`catalog:check`, `cloud-library:check`, `catalog:merge:check`) re-run green.
4. 🔴 With a viewer running, a staged Function connection shows no red flash longer than ~100 ms
   after `instanceports` arrives. **Blocked on fix 4, which is not built.**
