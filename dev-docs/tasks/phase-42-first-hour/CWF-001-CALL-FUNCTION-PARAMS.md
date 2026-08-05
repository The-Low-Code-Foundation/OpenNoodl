# CWF-001 — You cannot pass data into a cloud function

**From:** [TALK-001](TALK-001-THE-CLOUD-WORKFLOW-AUDIT.md) Pile 1.1 — the largest hole in the
cloud-workflow surface, and the gate on everything else in the track.
**Status:** open, unowned.

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
