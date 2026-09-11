# LAS-001 — The interface gate

**Status:** ✅ **DONE** 2026-08-08 (session 2) · **Track 1 (gates)** · ⭐ highest-value task in the
phase · fixes audit **F2**
**Blocks:** LAS-006 §3 (plan-as-contract), LAS-007 §1 (attach the recipe to this rejection), LAS-011

## The defect, measured

Haiku's cold replay (AUDIT-SESSION-1 §A) produced the architecturally ideal shape — ProductCard
instantiated ×4 with per-instance parameters (`image`, `name`, `description`, `price`…) — and
every card rendered as literal "Text" placeholders, because ProductCard exposes **no
`Component Inputs` node**. The parameters landed on ports that do not exist. `validate:project`:
**0 errors.** Nothing in the validator, the write gate, or the plan gate looks at instance
parameters against the target component's actual interface.

The evidence is preserved: `NodeGX test projects/phase55-replay-haiku`, components
`Components/ProductCard` + `Components/FeaturedProducts`, and
[measurements/haiku-full.png](measurements/haiku-full.png).

This is AIB-010's family (a name-typed parameter never checked for resolving), applied to the
single most load-bearing mechanism in the architecture doctrine: the component interface is what
makes "one card, four instances" work at all.

## Mechanism to verify before building (in this order)

1. **How an instance node is recognised.** A node instantiating a project component uses the
   component's legacyName as its node type (`/Components/ProductCard`). The validator's normalized
   project model (`normalizeV2Component`, `buildComponentRefs` — re-exported through
   `packages/noodl-mcp/src/editor-deps.ts`) already resolves component refs; find where
   `unresolvedComponentRef` does its lookup and hang the new rule beside it.
2. **Where a component's interface lives.** On its `Component Inputs` / `Component Outputs`
   *nodes* — the ports must be lifted to component level (the disk renderer had to reverse-engineer
   exactly this; see the header of `scripts/devtools/render-from-disk.js`). Determine how ports are
   declared on those nodes in the v2 format (the `ports` array on the node? `parameters`? read a
   real component — `phase55-replay-sonnet`'s `Cards/Product Card` has a correct one).
3. **The built-in ports every instance carries** regardless of interface (`mounted` at minimum —
   enumerate from source, likely the component-instance node factory in the runtime or the
   catalog's component-ref handling; do NOT hardcode a guessed list).
4. **Existing rule anatomy:** `validation/rules/repeatedSiblingSubtree.ts` +
   `validation/rules/index.ts` registration + its spec, as the template.

## Build

One new rule file, `validation/rules/instanceParameterInterface.ts` (name negotiable), two checks
over one shared interface index:

1. **`InstanceUnknownParameter`** (working name): a parameter set on a component-instance node
   whose name matches neither the target component's declared inputs nor the built-in instance
   ports. Diagnostic message carries: the parameter, the component, and **the component's actual
   input list** (or "this component declares no inputs") — the "did you mean" shape that measured
   a 100% self-correction rate in the replays. Location: the instance node, the offending
   parameter.
2. **`InterfacelessVariance`**: ≥2 instances of the same component (project-wide within the
   validated scope) whose parameter sets differ, where the component exposes no
   `Component Inputs` at all → one diagnostic on the *component* ("N instances vary but nothing
   can receive the variance — add Component Inputs whose names match the parameters").

Both halves must see **the plan overlay**: a component staged in the same plan counts as existing
with its staged interface (the `overlayProject` path in
[planTools.ts:125](../../../packages/noodl-mcp/src/tools/planTools.ts#L125) already builds this
view — the rule must read interfaces from it, not from disk).

**Severity decision, in this order:**

1. Run the rule over the corpus (`npm run validate:project` against the ~95 projects in
   `NodeGX test projects/` — the `repeated-sibling-subtree` calibration precedent: 17/95 hits →
   warning). Record the counts in the register below.
2. Expected outcome: `InstanceUnknownParameter` joins `AUTHORED_BLOCKING_WARNINGS`
   ([authoredCandidate.ts:149](../../../packages/noodl-editor/src/editor/src/validation/authoredCandidate.ts#L149))
   — the `PageWithoutPageNode` precedent, including its lesson: **fixtures teaching the broken
   shape get corrected, not the gate weakened.** Sweep the AI-suite fixtures for instance
   parameters with no interface before promoting.
3. `InterfacelessVariance` likely stays warning-severity project-wide; decide authored-blocking
   from the corpus numbers, not from enthusiasm.

## Acceptance

- Re-stage haiku's exact `ProductCard` + `FeaturedProducts` candidates → rejected, and the
  diagnostic names `image`/`name`/`price` and says the component declares no inputs.
- Sonnet's `Cards/Product Card` (a *correct* interface) passes untouched.
- Jest specs: both halves, the plan-overlay case (instance of a sibling staged create), the
  built-in-port allowance, and the update-baseline case (pre-existing violations in an `update`
  stay editable — the `validateStaged` baseline-subtraction contract in
  [planTools.ts:200](../../../packages/noodl-mcp/src/tools/planTools.ts#L200)).
- Corpus run documented. All standard gates green (see TASKS.md §Gates).

## What was built

`validation/componentInterface.ts` — a **precondition check**, not a `rules/` rule. The task file
proposed `validation/rules/`; the type system settled it, exactly as the handover predicted:
`NormNode` carries no `parameters`, and the check also needs a project-wide interface index, so no
rule could ask the question at all. It composes into `authoredPreconditionDiagnostics` as the sixth
and seventh checks, which means all three doors (editor loop, MCP write gate, MCP plan gate) get it
from one definition — `preconditionDiagnostics` in `noodl-mcp/src/validate.ts` is shared by the
write gate *and* `validateStaged`, so the plan overlay came for free.

`ComponentNodesView` gained an optional `ports`, and `componentInterfaces(views)` builds the index
from the **same** view list `declaredUrlPaths` already reads — so a component a plan is about to
create resolves as an interface exactly when it resolves as a navigation target.

`ExplainGraph`'s `GraphNode` gained an optional `ports` carrying the **plug**. `instancePorts` is
names-only, and the plug is the whole answer (see F8 below); all three adapters
(`fromEditorNode`, `fromSerialisedNode`, `graphComponentFromFiles`) now supply it.

Three diagnostics, all warning-severity project-wide and all in `AUTHORED_BLOCKING_WARNINGS`:

| Code | Fires when |
|---|---|
| `interfaceless-instance` | the target declares **no** `Component Inputs` and instances set parameters — **one** diagnostic per target component, not one per parameter per instance |
| `instance-unknown-parameter` | the target has an interface and a parameter names none of it; carries the actual input list as `alternatives` and the nearest name as `suggestion` |
| `component-port-direction` | a `Component Inputs` port not plugged `output` (or `Component Outputs` not plugged `input`) — F8 |

**Deviation from the task text, with the measurement behind it.** LAS-001 §2 specified
`InterfacelessVariance` as "≥2 instances whose parameter **sets** differ". Haiku's four cards carry
*identical* parameter names and four different products, so that predicate scores 0 and misses the
exact case the task was written for. The shipped predicate is "≥1 instance of an inputs-less target
carrying any parameter", which the corpus says costs nothing: **2 hits, both haiku's replay.**

## Corpus calibration

`measurements/scan-interfaces.js`, run 2026-08-08 over **both** corpora — 107 legacy `project.json`
+ 12 v2 projects, 730 component instances carrying 810 parameters.

| Finding | Hits | Where |
|---|---|---|
| `interfaceless-instance` | **2** | both `phase55-replay-haiku`. Zero legacy, zero prefabs, zero fixtures |
| `instance-unknown-parameter` | **65** | 58 `tests/testfs/big-merge-test-mine` (a real app carrying stale parameters for renamed inputs) · 6 `phase55-replay-sonnet` · 1 `library/prefabs/supabase` |
| `component-port-direction` | **22** | `ecommerce-example` (11) + its copy `ecom-responsive-probe` (11) — see F8 |
| ports on a `Component Inputs` node plugged `output` | **920 of 942** | the other 22 are F8 |
| unknown parameters covered by an instance-declared port | **0** | so honouring instance ports costs nothing and is kept for safety |

`interfaceless-instance` is a cleaner population than `PageWithoutPageNode` (6 hits) was when it was
promoted, and `instance-unknown-parameter`'s 58-hit legacy population is the same argument
`UnknownParameter` was given: real, not authored, and warnings do not fail `validate:project`.

## Register

| # | Finding | State |
|---|---|---|
| F8 | **`ecommerce-example` — phase 54's reference build — does not actually work.** All 11 of `/Components/ProductCard`'s "inputs" are declared `plug: "input"` on its `Component Inputs` node. `componentmodel.getPorts()` reads `getPorts('output')` there and republishes those as the component's **inputs**, so plugged `"input"` they become component *outputs*: no instance can set them, and the 12 connections drawn out of that node name an output port `getPorts('output')` does not return, which `utils/exporter/util.ts` drops as unhealthy. It renders only in `scripts/devtools/render-from-disk.js`, which rewrites every Component Inputs port to `plug: 'input'` before handing the project to the viewer — **the measuring instrument disagrees with the thing it measures.** Nothing reported it: `PortWithoutPlug` asks whether a port has a direction, not whether it has the right one, and `nonexistentPort` accepts any name in `instancePorts`, which are collected plug-blind. | ✅ gated by `component-port-direction`; **the project itself is still broken and the renderer still lies** — see F9/F10 |
| F9 | `scripts/devtools/render-from-disk.js` forces `plug: 'input'` on every `Component Inputs` port, so it will render a project the editor cannot. LAS-005 promotes this script to the `render_report` tool — **fix the derivation there**, or the render report will keep certifying pages that are dead in the editor. | 🔴 OPEN → **LAS-005** |
| F10 | `explain/graph.ts::componentPorts` has the same plug-blind derivation and is a second reader of the same fact. Not corrected here because its consumers *describe* a graph to a model rather than gate a write, and changing it changes what every explanation says. | 🔴 OPEN, filed |
| F14 | **`validate:project` runs rules only** — it has never applied the precondition checks, so all three codes here are invisible to `validate_project`/`review_project`/the CLI and appear only at the three authoring doors. Filed with its reasoning in LAS-004's register. | 🔴 OPEN, filed |
| F11 | **A component instance carries no built-in ports at all.** The task file said to enumerate "the built-ins every instance carries — `mounted` etc." from source; there are none. `ComponentInstanceNode` extends `Node`, not a visual node, and `componentmodel.getPorts()` is the whole of its port list — so `width`/`minWidth` on a card instance (sonnet's real mistake, 6 corpus hits) is discarded exactly like a misspelling. | ✅ verified, no allow-list needed |

## Gates at close

`catalog:examples` 57/57 · `catalog:check` · `catalog:merge:check` 175/175 · `typecheck:editor`
clean · editor jest **75 suites / 1021 specs** (was 74/1001) · noodl-mcp jest **20 suites / 207
specs** (was 19/200).
