# CWF-001 — You cannot AUTHOR what a step passes a cloud function

**From:** [TALK-001](TALK-001-THE-CLOUD-WORKFLOW-AUDIT.md) Pile 1.1 — the largest hole in the
cloud-workflow surface, and the gate on everything else in the track.
**Status:** **SHIPPED** 2026-08-06 (`97b3fc0e`, with the backend/editor-model halves swept into
`d3b7f159` by a concurrent session's path-limited commit). Retitled: the original title said "you
cannot pass data into a cloud function", and that was false — see below.

## ⚠️ CORRECTIONS, 2026-08-06 — three premises in this doc were wrong

1. **The mapping already worked.** A step's params have been merged into its input BY NAME since
   WFA-003 ([WorkflowEngine.ts:496-508](../../../packages/nodegx-backend/src/workflow/WorkflowEngine.ts#L496-L508)),
   and [`workflow-data-mapping.test.ts`](../../../packages/nodegx-backend/tests/workflow-data-mapping.test.ts)
   has proved end-to-end since then that `{"amount": {"$path": "previous.result.total"}}` on a
   `call-function` step reaches the function as `body.amount`. The §Refinement below says
   `resolvedParams` is "always empty today" — it is not, and never was. What was missing was the
   **declaration**, so the property editor (one row per DECLARED param) had nothing to draw.
2. **S1's `raw: true` would have broken the feature.** `raw` is consumed by `rawParamNames()`, which
   is exactly what tells the engine NOT to resolve a param
   ([kinds.ts `rawParamNames`](../../../packages/nodegx-backend/src/workflow/steps/kinds.ts)) — so a
   `raw` mapping would never have resolved. And a `params` param would have put the mapping at
   `step.params.params`, a SECOND on-disk form for something that already had one. Shipped instead
   as `paramMapping` on the KIND (catalog `1.3.0`) plus one synthetic editor port; the on-disk form
   is unchanged and there is exactly one of it.
3. **S2's reserved list was too strict.** Refusing every run-payload root broke a shipped spec that
   maps `{ body: {"$path": "body"} }` on purpose. Params merge AFTER the payload, so the author's
   value WINS — an override, not a loss. Exactly one name is refused: **`previous`**, which the
   engine writes after the params and would silently discard. The rest are served as
   `paramMapping.shadows` and get a note in the panel, not an error.

Also corrected in the code: `values.ts` cited a write-time check called `validateParamDepth`. No
such function has ever existed — it is `validateValueReferences` in `WorkflowEngine.ts`.

**Where the line numbers drifted:** `WorkflowEngine.ts:212-234` below is `validateValueReferences`
at 217-255, and `kinds.ts:669-683` (CWF-005) is 670-683. Everything else cited checked out.

## What shipped

- `StepParamMappingSpec` + `StepKindSpec.paramMapping` in the catalog, served at
  `GET /admin/workflow-step-kinds`, version `1.3.0`.
- `RESERVED_STEP_INPUT_KEYS` (`previous`) and `SHADOWED_STEP_INPUT_KEYS`, with a real
  `case 'call-function'` in the validator where there was `default: break`.
- `PORT_PARAM_MAPPING` — the one synthetic port on a step card — and `WorkflowParamsType` /
  `WorkflowParamsEditor`, which edit the node's UNDECLARED parameters as siblings, in one undo
  group, with the declared/reserved/shadow lists riding on the port type.
- `docs/runtime/WORKFLOW-NODES.md` §Authoring the mapping on the canvas; the MCP step schema tells
  an agent to name params for the FUNCTION, not for wherever the value sits today.

## The mechanism, exactly

Every layer of param mapping exists **except the declaration that makes it authorable**.

- **The engine resolves params already, generically.** `WorkflowEngine` resolves each step's params
  against the run scope before the step executes and folds them into `input`
  ([WorkflowEngine.ts:484-496](../../../packages/nodegx-backend/src/workflow/WorkflowEngine.ts#L484-L496)).
  `resolveStepParams` walks objects and arrays recursively, so
  `{"order": {"id": {"$path": "previous.result.id"}}}` resolves at depth
  ([values.ts](../../../packages/nodegx-backend/src/workflow/steps/values.ts), `MAX_VALUE_DEPTH` 32).
- **Validation does not reject them.** Per-kind validation is a `switch`, and `call-function` falls
  through to `default: break`
  ([kinds.ts:726-728](../../../packages/nodegx-backend/src/workflow/steps/kinds.ts#L726-L728)) —
  an undeclared params object on a call-function step is legal today. `validateParamDepth` still
  checks every `$path` in it ([WorkflowEngine.ts:212-234](../../../packages/nodegx-backend/src/workflow/WorkflowEngine.ts#L212-L234)).
- **The value control is built.** `WorkflowValueInput` renders a literal/`$path` toggle with a
  reachable-predecessor picker
  ([WorkflowValueInput.tsx](../../../packages/noodl-editor/src/editor/src/views/panels/propertyeditor/components/WorkflowCondition/WorkflowValueInput.tsx)),
  and `workflow-value` / `workflow-path` both dispatch to it
  ([Ports.ts:511](../../../packages/noodl-editor/src/editor/src/views/panels/propertyeditor/DataTypes/Ports.ts#L511)).
- **And the catalog declares nothing.** `'call-function'.params` is `[REF_PARAM]` — the function
  name ([kinds.ts:119-133](../../../packages/nodegx-backend/src/workflow/steps/kinds.ts#L119-L133)).
  The editor builds one input port per declared param
  ([workflowNodeLibrary.ts:224-238](../../../packages/noodl-editor/src/editor/src/models/workflow/workflowNodeLibrary.ts#L224-L238)),
  so a step with no params param has no row to author, and the `$path` picker is **reachable by no
  route in the product**.

## ⚠️ Refinement, 2026-08-05 — data DOES reach the function; *mapping* doesn't

Traced while writing the use-case walkthrough, and it narrows this task rather than changing it.
A step's input is

```ts
const input = { ...basePayload, ...resolvedParams, ...(previous ? { previous } : {}) };
```
([WorkflowEngine.ts:496-501](../../../packages/nodegx-backend/src/workflow/WorkflowEngine.ts#L496-L501))

and `invokeCloudFunction` sends it as the request body
([StepExecutor.ts:187-190](../../../packages/nodegx-backend/src/workflow/StepExecutor.ts#L187-L190)).
The Request node pulls named keys out of that body into outputs
([request.ts:75-80, 145-147](../../../packages/noodl-viewer-cloud/src/nodes/cloud/request.ts#L145-L147)).

So **today**, without this task: the trigger payload reaches every function, and a function can
declare a param literally named `previous` to receive the whole previous step's output. What is
impossible is *selecting or renaming* — you cannot pass `previous.result.total` as `amount`, and a
function cannot be written against a stable input shape independent of its position in the graph.
That is what `resolvedParams` (always empty today) exists for, and what this task delivers.

State it that way in the docs too — "you can't pass data into a function" is not quite true, and an
author who discovers `previous` on their own will conclude the docs lie.

**The shape problem to solve.** Every other param is a fixed name with one value. A param *mapping*
is a dictionary of **author-chosen keys** → value specs. One-port-per-declared-param cannot express
it. The precedent is `switch`'s `cases`: a `raw` param with its own port type
(`PORT_TYPE_CASES`) and its own editor (`SwitchCasesEditor`), dispatched at
[Ports.ts:506](../../../packages/noodl-editor/src/editor/src/views/panels/propertyeditor/DataTypes/Ports.ts#L506).
Follow it exactly.

## Slices

**S1 — Declare the param (backend).** Add to `call-function`'s spec a param
`{ name: 'params', type: 'object', raw: true, description: … }`. `raw: true` is load-bearing: it
tells the editor "this is a DSL structure, give it its own editor, do not value-resolve the param
itself" ([kinds.ts:69-78](../../../packages/nodegx-backend/src/workflow/steps/kinds.ts#L69-L78)).
⚠️ But the engine **must still resolve inside it** — this is the one `raw` param whose contents are
values rather than a condition. Decide deliberately: either exclude it from `rawParamNames()`
(`raw` then means only "bespoke editor"), or resolve it explicitly in the call-function executor.
Whichever you choose, write the reason in the code, because the next reader will assume the other.
Bump `STEP_KIND_CATALOG_VERSION` (currently `1.2.0`).

**S2 — Validate it.** Give `call-function` a real `case` in the validator: params must be a plain
object, keys must be non-empty strings, and a key that collides with a reserved input name
(whatever `input` already carries — check `WorkflowEngine.ts:496-507`) is a loud error, not a
silent shadow.

**S3 — The port type + editor (editor).** `PORT_TYPE_PARAMS = 'workflow-params'` in
`workflowPorts.ts`; `portTypeForRawParam` returns it for `param.name === 'params'`
([workflowNodeLibrary.ts:168-176](../../../packages/noodl-editor/src/editor/src/models/workflow/workflowNodeLibrary.ts#L168-L176));
a `WorkflowParamsType` view in `WorkflowTypes.ts` and a dispatch line in `Ports.ts` beside the other
four. The editor itself is a row list — key text field + `WorkflowValueInput` — modelled on
`SwitchCasesEditor`, passing `graph`/`stepId` through so the predecessor picker works.

**S4 — MCP + round-trip.** Confirm the MCP write path accepts a params object on call-function and
that a definition round-trips (write → read → write) byte-identically. The suite is a gate; see the
noodl-mcp notes.

**S5 — Docs.** `docs/runtime/WORKFLOW-NODES.md` gains the param-mapping section; the doctrine
sentence ("params are data, not code") goes next to it.

## Done when

- On a fresh workflow, selecting a Call Function step shows a **Params** section where you can add
  `amount` → `previous.result.total` with the picker, and the function receives it.
- Live-driven, not asserted: a two-step workflow where step 2's function reads a value produced by
  step 1, run from the editor, with the value visible in the execution record.
- The catalog version bumped, and an editor talking to a **pre-bump backend** degrades quietly
  (`conditionOps` already models this — an older backend serves no such param, so no row appears).
- `noodl-mcp` suite green (it is a gate).

## Traps

- ⚠️ **A declared `default` never runs its setter** — the repo's most-repeated trap. Do not give the
  `params` param a `default: {}` and expect the step to receive one.
- ⚠️ The scope params resolve against **deliberately excludes the params themselves**
  ([WorkflowEngine.ts:484-494](../../../packages/nodegx-backend/src/workflow/WorkflowEngine.ts#L484-L494)) —
  a param cannot reference a sibling param. Say so in the editor's empty state, or authors will try.
- ⚠️ `ref` is filtered out of the port loop by name
  ([workflowNodeLibrary.ts:227](../../../packages/noodl-editor/src/editor/src/models/workflow/workflowNodeLibrary.ts#L227)).
  Anything keying on "the first param" will get this wrong.
- The editor's catalog is **served by the backend at runtime** — a param added only to the editor's
  copy of the types will silently never appear.
