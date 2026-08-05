# CWF-004 — A Transform step: reshaping JSON without a second canvas

**From:** [TALK-001](TALK-001-THE-CLOUD-WORKFLOW-AUDIT.md) **Q1, decided 2026-08-05**: keep the
orchestrate/compute split **and** soften its cost with a compute step that is still data, not code.
**Status:** open, unowned. **Blocked on [CWF-001](CWF-001-CALL-FUNCTION-PARAMS.md)** — it reuses
the same value-mapping editor, and building it first would manufacture a twin.

## Why this exists

The doctrine ("workflows orchestrate, cloud functions compute") is correct and stays. Its cost is
that *every* reshape between two calls — renaming a field, concatenating a name, picking three keys
out of forty — is a round trip through a second canvas. Q1's answer: give the workflow level a step
that can **reference and restructure** values without ever **evaluating** a string.

The constraint is written into the value language's own module doc and is not negotiable:

> a workflow definition is a persisted, deployable, agent-authored JSON file, so an `eval`'d string
> inside one is a remote-code-execution surface with an admin credential in front of it. This
> language makes *referencing* values possible, never *computing* them.
> — [values.ts](../../../packages/nodegx-backend/src/workflow/steps/values.ts)

Transform must not break that sentence. It extends *referencing* with a closed, enumerated set of
pure operations the backend serves to the editor — the same trick the 19-operator condition
language already uses, so the editor can never offer an operation the backend can't perform.

## The shape

A step kind `transform`, `invokesFunction: false`, one `raw` param `output`: an object whose values
are value specs — plus, and this is the new part, **operation specs**:

```json
{ "fullName": { "$concat": [{"$path": "previous.first"}, " ", {"$path": "previous.last"}] },
  "total":    { "$sum":    {"$path": "previous.lines.*.amount"} },
  "email":    { "$lower":  {"$path": "trigger.body.email"} } }
```

Step output is that object. No eval, no string interpolation syntax, no user-supplied function
bodies — every `$op` is a name in a served vocabulary with a fixed arity.

**Open design questions to settle before building** (these are the doc's job, not the coder's):

1. **The vocabulary's first cut.** My proposal, deliberately small: `$concat`, `$lower`, `$upper`,
   `$trim`, `$number`, `$string`, `$default` (null-coalesce), `$add`/`$subtract`/`$multiply`/
   `$divide`, `$length`, `$join`, `$get` (index/key), `$pick` (subset of keys). Nothing that
   branches — `branch` exists. Nothing that iterates — `for-each` exists.
2. **Wildcards in paths.** `lines.*.amount` is genuinely useful and is a **change to `getPath`**
   ([values.ts](../../../packages/nodegx-backend/src/workflow/steps/values.ts)), which `conditions`
   shares. Either do it there for both, or leave it out of v1. Do not fork the resolver — the module
   exists precisely because a second path implementation would disagree at the edges.
3. **Does `$op` belong in `values.ts` or beside it?** Conditions resolve operands with the same
   resolver; if operations live in the shared resolver, a condition can suddenly compute. Decide
   whether that is wanted (it is a real expressiveness gain) or forbidden (it widens the surface
   conditions were narrowed to avoid).

## Slices

**S1** — Settle the three questions above, in this doc, with Richard.
**S2** — Backend: the op vocabulary as a served table (mirroring `conditionLanguage` in the catalog
so the editor reads it off the wire), the resolver, validation, catalog entry, version bump.
**S3** — Editor: the ops ride on the port type the way `conditionOps` does
([workflowNodeLibrary.ts:150-152](../../../packages/noodl-editor/src/editor/src/models/workflow/workflowNodeLibrary.ts#L150-L152));
the editor is CWF-001's rows editor plus an op picker per row.
**S4** — MCP: the agent must be told the vocabulary, or it will invent operations.
**S5** — Docs + one worked example in `WORKFLOW-NODES.md`.

## Done when

- A three-step workflow — call, transform, call — passes a reshaped object into the second function
  with no cloud function in between, driven live.
- An unknown `$op` is a **loud validation failure at write time**, not a silent passthrough.
- The served vocabulary is the only source: removing an op from the backend removes it from the
  editor picker without an editor change.

## Traps

- ⚠️ `MAX_VALUE_DEPTH` (32) and `validateParamDepth` bound how deep specs resolve
  ([WorkflowEngine.ts:212-234](../../../packages/nodegx-backend/src/workflow/WorkflowEngine.ts#L212-L234)).
  Nested ops eat depth fast — check the limit still holds for a realistic transform.
- ⚠️ Division by zero, `$number` on a non-numeric string, `$get` past the end: decide *loud failure
  vs undefined* once and apply it to every op. A condition that "cannot be evaluated" is already a
  loud step failure ([kinds.ts branch notes](../../../packages/nodegx-backend/src/workflow/steps/kinds.ts));
  match it.
- A step's params resolve against a scope that **excludes the step's own params** — so a transform
  cannot reference an earlier key in the same transform. Either document it or make `output` an
  ordered pipeline; do not leave it implicit.
