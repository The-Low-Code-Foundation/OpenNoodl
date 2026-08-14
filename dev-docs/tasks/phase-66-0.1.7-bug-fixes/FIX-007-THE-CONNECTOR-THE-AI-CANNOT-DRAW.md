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

## ✅ BUILT 2026-08-14 (session 5) — fix 4, and two premises that did not survive checking

### Fix 4 — shipped. The urgent health lane

`NodeGraphModel.scheduleEvaluateHealth` now takes `{ urgent?: boolean }`: **50 ms** instead of
2000 ms. `bindModels` subscribes to `Model.instancePortsChanged` and takes the fast lane when the
node whose ports just arrived belongs to *this* graph and its own wires carry a stale
unresolved-port warning.

Three things had to be right, and each has a spec
(`tests/nodegraph/urgent-health-pass.spec.ts`, **12 specs**, exported from the nodegraph barrel):

1. 🔴 **The urgent request has to pre-empt a lazy pass already in flight.** The old
   `if (this.evaluatehealthScheduled) return` **swallowed it** — and the graph is almost always
   mid-debounce during load, which is exactly when ports arrive. So the boolean became a tracked
   timer plus a deadline, and `scheduleEvaluateHealth` now compares deadlines rather than asking
   "is one scheduled". Without this the fix would have been dead code in the only situation it is
   for. That spec is the load-bearing one.
2. **The fast lane is gated** on `hasUnresolvedPortWarning(nodeId)` — a wire touching that node
   carrying `con-no-source-port` or `con-no-target-port`. Deliberately **not** the `-type` or
   `con-type-mismatch` keys: a port appearing does not make a type verdict stale, and without that
   distinction the gate degrades into "does this node have any warning", which is nearly always
   true on a graph the user is fixing. A viewer pushing ports for a hundred healthy nodes now
   schedules **nothing**.
3. **Scoped to the owning graph.** `Model.instancePortsChanged` is global; without
   `node.owner === this`, one Function node's ports would start a health pass in every open
   component.

Also: `dispose()` now cancels a pending pass. Nothing held the handle before, so a disposed graph's
timer still walked nodes whose component was gone.

### 🔴 Fix 3 — NOT built, because its premise is false twice over

The task says *"the manual drag passes `getConnectionStatus` … which checks the port exists and is
compatible before creating"*, and proposes reusing it from `addConnection`. Checked in source:

1. **`getConnectionStatus` does not check port existence.** `NodeGraphModel.ts:527-581` reads
   `sourcePort`/`targetPort` and then guards *every* branch on `sourcePort && targetPort` — a
   missing port skips the type check and the duplicate check and returns `{ connectable: true }`.
   It never needed the check: its only two callers (`ConnectionPopups.ts:246`,
   `ConnectionBar.tsx:208`) pass port names drawn from an **enumerated port list**, so by
   construction the ports exist. Wiring it into `addConnection` would therefore report **nothing**
   for the reported defect.
2. **The gap it was meant to close is already closed, at a better layer.** The mechanism section's
   *"no AI/MCP write path ever consults ports at all"* is true of the **model** layer and false of
   the **validator** layer: `rules/nonexistentPort.ts:55-110` walks both endpoints of every
   connection, and for a fully static node type emits a `NonexistentPort` **error** with a
   suggestion and the available alternatives. It abstains only on dynamic-port types — correctly —
   and that abstention is exactly what shipped **fix 2** closed for Function nodes.

So fix 3 would add nothing for static types (already an error, at the door, with suggestions),
nothing for dynamic types (`getConnectionStatus` cannot judge them either), and would sit in the
one place that cannot safely ask the question: `NodeGraphModel.fromJSON:95-97` runs `addConnection`
in a bulk loop **during project load, before the node library has arrived**, when
`NodeGraphNode.getPorts()` returns `[]` for every unknown type — the trap
`tests/models/NodeGraphNodePortCache.test.ts` already documents. A naive port check there reports
every connection in the project as broken.

**Recommendation: strike fix 3.** If the residue ever matters, the honest version is an eleventh
check in `authoredPreconditionDiagnostics` (fix 2's proven layer, which has `catalog` and needs no
loaded NodeLibrary) — not a report in `addConnection`. The one true statement inside fix 3 is that
`getConnectionStatus` is documented to check existence and does not; that is cosmetic today and
deliberately left rather than shipped as a branch no caller can reach.

### ✅ The ⚠️ rider — closed, also false

*"`add_connection` still rebuilds a wire from four fields and drops `label`/`labelT`/`route`."*
It rebuilds from four fields (`graph.ts:300-305`) — but it **refuses duplicates** (`:297-299`), so
it can only ever append a wire that does not exist yet, and a wire that does not exist has no label
to drop. Untouched wires survive because `applyOperations` mutates a **copy of the baseline**.

This was already known and already pinned: `packages/noodl-mcp/tests/operationsWritePath.test.ts`
→ *"SIG-007 R3 — the operations door keeps what it did not author"*, whose own comment says the
door "was never broken" and that the spec is a **guard**, not a defect proof. `set` is the door
that needed `carryConnectionPresentation` (`tools/author.ts:281`), and it has it. **Nothing to
file.** The only residue is remove-then-add on the same endpoints in one batch, which loses the
label — and that is correct semantics, not a defect.

⚠️ **Tooling note that cost time here:** this repo's `grep` is **ugrep**, which classified
`packages/noodl-mcp/src/tools/author.ts` as *binary* and silently skipped it — so
`grep -rn carryConnectionPresentation src/` returned **nothing** for a function defined in that
file at line 281. Use `/usr/bin/grep -a` before concluding a symbol does not exist.

## ✅ DRIVEN 2026-08-14 (session 5) — criterion 4 measured, and its own control came free

Fixture: **`fix007-c4-drive`**, a scratch copy of `leg003-drive` (source verified untouched by
mtime afterwards). Its `/Filters` component is the criterion's exact shape and was already correct
on disk — `Component Inputs → JavaScriptFunction` on **`in-Filters`** and **`in-FilterValues`**,
and `out-FiltersChanged` / `out-FilterValuesChanged` back out to `Component Outputs`, with
`ports: []`. Four wires onto runtime-discovered ports, all healthy at rest.

Opened through the **launcher card** (the Launcher is the landing page now, so the phase-59
`props.route.router` fiber recipe no longer resolves — see the trap below), and confirmed by
reading back `ProjectModel.instance._retainedProjectDirectory` rather than trusting the click.

The port change was driven through **`node.setDynamicPorts(...)`** — the single line
`ViewerConnection.ts:203` calls on `instanceports` receipt — so the whole chain under test is the
real one: `setDynamicPorts` → `instancePortsChanged` → the gate → the urgent lane → `evaluateHealth`
→ `WarningsModel`. Warning presence was polled at 10 ms, finer than the 50 ms lane being measured.

| Run | ports **removed** → wires go red | ports **restored** → red clears |
|---|---|---|
| 1 | **2026 ms** | ✅ **76 ms** |
| 2 | **2015 ms** | ✅ **76 ms** |
| 3 | **2017 ms** | ✅ **78 ms** |

✅ **Criterion 4 passes: 76–78 ms, against a "~100 ms" bar.**

🔴 **The left-hand column is the control, and it came free.** Both columns are the same graph, the
same node, the same function, the same global event — the *only* difference is whether a stale
unresolved-port warning existed at that moment. Removing ports happens when the wires are healthy,
so the gate correctly **declines** the fast lane and the change lands on the ordinary 2 s pass
(2015–2026 ms — the "before" number, measured rather than asserted). Restoring ports happens when
the warning exists, so the fast lane is taken (76 ms). One run demonstrates both that the lane is
fast and that the gate is selective; had the gate been decoration, the left column would read ~50 ms
too.

Final state verified clean: all four wires back to zero warnings, all seven ports present.

⚠️ **Trap for the next drive: the fiber-walk recipe for the router is stale.** The editor now lands
on the **Launcher** (`Launcher-module__Root`), not `ProjectsPage`, and `props.route.router` exists
on the latter only — a fiber walk to depth 40 across every `memoizedProps` found **zero** routers.
Open by clicking the launcher card instead (scroll it into view first — the card was at `y=3102`,
far below the fold — then tag it and click the tag). Also: **`LocalProjectsModel.loadProject`
returns a Promise and is not callback-based**; `new Promise(res => loadProject(entry, res))` hangs
forever and reads as a dead CDP connection.

## Acceptance criteria

1. ✅ Asking the internal AI (and the MCP path) to wire a Component Input to a Function-node input
   produces a working connection with no `con-no-target-port` warning — driven end to end.
   **Both halves driven**: MCP path 2026-08-14 (session 4); internal AI 2026-08-14 (session 5,
   paid) — `in-items` / `out-text`, zero warnings, right the first time.
2. ✅ A connection deliberately written unprefixed trips the new validator suggestion naming
   `in-<name>` (negative control: a correct `in-` wire does not).
3. ✅ The corrected catalog text ships in both `node-catalog.json` and the enriched catalog; the
   catalog gates (`catalog:check`, `cloud-library:check`, `catalog:merge:check`) re-run green.
4. ✅ With a viewer running, a staged Function connection shows no red flash longer than ~100 ms
   after `instanceports` arrives. **Driven 2026-08-14: 76 / 76 / 78 ms**, against a measured
   2015–2026 ms on the lazy lane in the same run.

## ✅ DRIVEN 2026-08-14 (session 5, **paid**) — criterion 1's internal-AI half. The docs alone were enough.

Richard authorised the spend. One send, against the **real Anthropic provider**
(`editorSettings.json`: `ai.provider = anthropic`, `hasKey`/`verified` both true — verified before
sending, per the recorded trap that `localStorage` reports "no provider" and is wrong).

Fixture: **`fix007-ai-drive`**, a fresh copy of the 2-component v2 project `test1`, opened on a
**freshly launched editor** so the Build thread provably started empty. The project-docs interview
was declined so the run went straight to authoring.

**The prompt deliberately never mentions ports, prefixes, or `in-`/`out-`** — otherwise the test
proves nothing:

> *"Create a component called Logic/FormatList. It should take a component input named items (an
> array of strings), feed that into a Function node whose script joins the array into a
> comma-separated string, and send the result out through a component output named text."*

**What the AI wrote** — read off disk after accepting, not off the panel:

```
nodes:        in :: Component Inputs · fn :: JavaScriptFunction · out :: Component Outputs
connections:  in . items     ->  fn . in-items      ✅
              fn . out-text  ->  out . text         ✅
script:       Outputs.text = (Inputs.items || []).join(', ');
```

✅ **Both endpoints correctly prefixed, and the script's `Inputs.items` / `Outputs.text` agree with
the wires.** This is the exact shape that was dead in the corpus — `data-run-tasks-batch`'s
`Component Inputs → Function`, and Richard's own `Puppy test 3` → "Format Puppy List".

✅ **Zero warnings on either connection** (`evaluateHealth()` forced, then re-read): no
`con-no-target-port`. All three nodes present — `roots` and `nodeMap` both 3.

🔴 **The most informative detail: the panel reported "1 step · validated once".** One validation
pass, no rejection, no resubmit. **The AI got the prefix right the first time, from the corrected
catalog — fix 2's gate never had to fire.** So fix 1 (docs) is doing the work here and fix 2 is the
backstop, which is the right order and was not knowable before this drive: criterion 2 proved the
gate *can* catch it, and this proves the docs mean it usually will not have to.

⚠️ **Trap found while measuring, worth carrying:** `NodeGraphModel.forEachNode` is typed
`(node) => boolean | void` and **stops on a truthy return** — it is `Array.some`, not
`Array.forEach`, despite the name. A probe written as `forEachNode(n => nodes.push(n))` reads
**only the first node**, because `push` returns the new length. That reported a 3-node graph as a
1-node graph and looked exactly like the recorded "a typeless node emptied the graph" defect. Use
`forEachNode(n => { nodes.push(n); })`.

## Status — ✅ FIX-007 IS CLOSED

| | |
|---|---|
| Fix 1 (docs) | ✅ shipped + driven — **and doing the work; the AI needed no correction** |
| Fix 2 (write-time gate) | ✅ shipped + driven — the backstop, which did not have to fire |
| Fix 3 (structural) | 🔴 **struck** — premise false twice over, see above |
| Fix 4 (ergonomic) | ✅ shipped + driven — 76 ms vs 2017 ms |
| Rider (`add_connection` presentation) | ✅ **closed** — not a defect, already guarded |

**All four acceptance criteria are met and driven. FIX-007 is CLOSED.**

The whole report-4(c) chain is now proved end to end: the catalog tells the truth, both write doors
reject the wrong wire with the exact replacement, the internal AI writes the right one unprompted,
and a wire that is briefly unresolvable stops flashing red in 76 ms instead of two seconds.
