# CWF-004 — Declarative data steps: reshaping a payload is workflow work

**From:** [TALK-001](TALK-001-THE-CLOUD-WORKFLOW-AUDIT.md) Q1(b), **re-argued and confirmed
2026-08-05** after the orchestrate/compute distinction was properly understood. The original
justification ("avoid a round trip through a second canvas") was weak and partly wrong. The real one
is Richard's:

> *"Incoming webhook data from an outside supplier can be annoyingly formatted, for example nested
> arrays and data when you only need one object for the cloud function, so being able to do a kind
> of `'paymentObject': 'previous.user.order.payment'` transformation lightens the load of the cloud
> function."*

**Status:** open, unowned. **Blocked on [CWF-001](CWF-001-CALL-FUNCTION-PARAMS.md)** — same value
editor; building it first would manufacture a twin.

## Why this belongs at the workflow level, and isn't a doctrine breach

Reshaping JSON is **referencing, not computing**. It reads paths and rebuilds an object; it never
evaluates a string. That is precisely the line
[BACKEND-AUTHORING-MODEL.md](../../reference/BACKEND-AUTHORING-MODEL.md) draws, and this falls on
the workflow side of it.

The alternative is worse, and it's the argument that settles it: **without this, every function
carries its caller's mess.** A supplier's webhook shape leaks into the function that processes it,
so the function is no longer a clean unit of work — it's a unit of work welded to one caller's
payload format. Reshape at the workflow level and the function keeps a stable input contract, which
is exactly what makes it reusable from the app *and* from three different workflows.

The positioning, in Richard's words: *"n8n v2++ — we're separating pure JSON workflow from real
cloud compute, whereas an n8n flow mixes everything together in one melting pot."* Declarative data
steps are what make that separation liveable rather than merely principled.

## The shape

A step kind `transform`, `invokesFunction: false`, one `raw` param `output`: an object whose values
are value specs, plus **operation specs** from a closed, backend-served vocabulary.

```json
{ "paymentObject": { "$path": "previous.user.order.payment" },
  "fullName":      { "$concat": [{"$path": "trigger.body.first"}, " ", {"$path": "trigger.body.last"}] },
  "email":         { "$lower":  {"$path": "trigger.body.customer.email"} } }
```

The step's output is that object. No eval, no string interpolation syntax, no user-supplied function
bodies — every `$op` is a name in a served table with a fixed arity, the same trick the 19-operator
condition language already uses so the editor can never offer an operation the backend can't
perform.

## The wider family — "helpful nodes in the workflow chain"

Richard asked for more than one step, within the discipline. Candidates that are all
reference-or-route, never compute. **Slice 1 is Transform alone**; the rest are a menu to pick from
once it lands:

| Step | What it does | Verdict |
|---|---|---|
| **Transform** | Reshape into a new object using paths + a small op vocabulary | **Build first** — the case above |
| **Validate** | Assert the incoming shape (required paths, types); fail the run loudly with a readable message | Strong — webhooks from third parties are exactly where a silent `undefined` ruins an afternoon |
| **Filter** | Drop array items not matching a declarative condition | Strong — `for-each` already has a `filter` param, so this is mostly surfacing an existing capability |
| **Split / Batch** | Chunk an array into groups of N | Useful with `for-each` concurrency and rate-limited APIs |
| **Sort** | Order an array by a path | Cheap, declarative |
| **Deduplicate** | Drop repeats by a path | Cheap, declarative |
| **Aggregate** | count / sum / min / max / group-by over an array | Borderline — declarative, but it *is* computing. Decide deliberately |
| **Parse / Stringify JSON** | A string field that is really JSON (suppliers do this constantly) | Useful, and pure |

## On a free Function step at workflow level — my advice: **no**

Richard: *"I'm still wondering about free function nodes, but it seems like that runs against the
principles and distinction of workflow vs cloud function. I'll leave you to advise me here."*

Don't build it. Three reasons, in order of weight:

1. **It reintroduces the RCE surface the whole design avoids.** A workflow definition is persisted,
   deployable, agent-authored JSON executing with admin authority. An eval'd string in it is remote
   code execution behind an admin credential. Everything declarative about the workflow layer exists
   to prevent that.
2. **It collapses the thing that makes us better than n8n.** The moment a workflow can hold code,
   every workflow *will* hold code, and the layer stops being inspectable, diffable and
   agent-writable. The separation only survives if it is absolute — a "small" code step is still a
   melting pot, just a slower one.
3. **It already exists, one level down.** A free function step *is* a one-node cloud function. The
   honest answer to "sometimes I just need a bit of code here" is not to move code up; it is to
   make reaching down frictionless.

**So the deliverable that replaces it** — and this should be built alongside the Transform step, not
instead of it: a **"New function from this step"** gesture. From a `call-function` step with no
target, create a cloud function, pre-declare its Request parameters from the step's resolved input,
and descend into it (WFA-006 already built the descent half). If that takes one gesture and two
seconds, nobody will ever ask for an eval step again — and if they do, the answer has a reason
behind it rather than a rule.

## Slices

**S1** — Settle the op vocabulary, the wildcard question, and where ops live (below), with Richard.
**S2** — Backend: served op table (mirroring `conditionLanguage` in the catalog), resolver,
validation, catalog entry, version bump.
**S3** — Editor: ops ride on the port type the way `conditionOps` does
([workflowNodeLibrary.ts:150-152](../../../packages/noodl-editor/src/editor/src/models/workflow/workflowNodeLibrary.ts#L150-L152));
the editor is CWF-001's rows editor plus an op picker per row.
**S4** — MCP: the agent must be served the vocabulary or it will invent operations.
**S5** — Docs + one worked webhook-reshaping example.
**S6** — The "new function from this step" gesture (see above).

## The three open design questions

1. **First-cut vocabulary.** Proposed, deliberately small: `$concat`, `$lower`, `$upper`, `$trim`,
   `$number`, `$string`, `$default` (null-coalesce), `$add`/`$subtract`/`$multiply`/`$divide`,
   `$length`, `$join`, `$get`, `$pick`. Nothing that branches (`branch` exists); nothing that
   iterates (`for-each` exists).
2. **Wildcards in paths.** `lines.*.amount` is genuinely useful for the nested-array case Richard
   describes, and it is a change to `getPath`
   ([values.ts](../../../packages/nodegx-backend/src/workflow/steps/values.ts)) which `conditions`
   shares. Do it there for both or leave it out of v1 — **do not fork the resolver**; that module
   exists precisely because a second path implementation would disagree at the edges.
3. **Do ops belong in the shared resolver?** If they do, a *condition* can suddenly compute. Decide
   whether that's a gain or a widening of the surface conditions were narrowed to avoid.

## Done when

- A webhook workflow reshapes a genuinely awkward supplier payload — nested arrays, a wrapper
  object — into a flat object a cloud function accepts, with no intermediate function. Driven live
  against a real POST.
- An unknown `$op` is a **loud validation failure at write time**, never a silent passthrough.
- Removing an op from the backend removes it from the editor picker with no editor change.

## Traps

- ⚠️ `MAX_VALUE_DEPTH` (32) and `validateParamDepth` bound resolution depth
  ([WorkflowEngine.ts:212-234](../../../packages/nodegx-backend/src/workflow/WorkflowEngine.ts#L212-L234)).
  Nested ops eat depth fast — check the limit holds for a realistic supplier payload.
- ⚠️ Decide *loud failure vs undefined* once, for every op — division by zero, `$number` on
  nonsense, `$get` past the end — and match conditions, where an unevaluable condition is already a
  loud step failure.
- A step's params resolve against a scope that **excludes that step's own params**, so a transform
  cannot reference an earlier key in the same transform. Document it or make `output` an ordered
  pipeline; do not leave it implicit.
