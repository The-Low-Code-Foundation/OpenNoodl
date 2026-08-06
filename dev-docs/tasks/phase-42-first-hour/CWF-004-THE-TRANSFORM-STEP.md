# CWF-004 — Declarative data steps: reshaping a payload is workflow work

**From:** [TALK-001](TALK-001-THE-CLOUD-WORKFLOW-AUDIT.md) Q1(b), **re-argued and confirmed
2026-08-05** after the orchestrate/compute distinction was properly understood. The original
justification ("avoid a round trip through a second canvas") was weak and partly wrong. The real one
is Richard's:

> *"Incoming webhook data from an outside supplier can be annoyingly formatted, for example nested
> arrays and data when you only need one object for the cloud function, so being able to do a kind
> of `'paymentObject': 'previous.user.order.payment'` transformation lightens the load of the cloud
> function."*

**Status:** **SLICE 1 SHIPPED** 2026-08-06 — the `transform` step alone (S1–S5). The wider family
(Validate, Filter, Split, Sort, Dedupe, Parse JSON) and **S6**, the "new function from this step"
gesture, are still open. CWF-001 landed first and its `WorkflowValueInput` is reused for every
operand, so no second value editor exists.

## ⚠️ CORRECTIONS, 2026-08-06 — what this doc got wrong, and the three questions answered

**Two of this page's cited mechanisms were wrong, and both would have been discovered mid-build:**

1. **`validateParamDepth` does not exist**, and never has (§Traps cites it at
   `WorkflowEngine.ts:212-234`). The function is **`validateValueReferences`**, now at
   [WorkflowEngine.ts:217-255](../../../packages/nodegx-backend/src/workflow/WorkflowEngine.ts#L217-L255);
   the depth check inside it is `exceedsValueDepth` from `values.ts`. CWF-001's own correction block
   recorded this a day earlier and the comment in `values.ts` says it named a non-existent function
   for a year. The trap it describes is real, and the answer is measured rather than feared: a
   *deeply* nested realistic supplier reshape — a nested object holding a `$concat` of a `$trim` and
   an `$upper`, and a `$default` wrapping a `$lower` wrapping a `$trim` — reaches depth **5 of 32**
   on the write-time walk, which is the stricter of the two (the run-time walk starts one shallower).
   Nested ops do not eat depth fast. Pinned by a spec, so the claim stays true.
2. **§Traps' last bullet is right about the scope but wrong about which one.** "A step's params
   resolve against a scope that excludes that step's own params" is true of *non-raw* params
   ([WorkflowEngine.ts:497-502](../../../packages/nodegx-backend/src/workflow/WorkflowEngine.ts#L497-L502)),
   and `output` is `raw` — so it is not resolved there at all. The conclusion still holds and for a
   *better* reason: the executor resolves the whole `output` object **in one pass against one
   scope**, so no field can see another whatever the ordering. It is documented in three places
   rather than left implicit, and `output` is deliberately **not** an ordered pipeline: one pass
   keeps it diffable, order-independent and safe for an agent to write. Chain two steps instead.

**The three open design questions, decided:**

1. **Vocabulary — the proposal minus arithmetic.** Shipped: `$concat`, `$join`, `$split`, `$lower`,
   `$upper`, `$trim`, `$string`, `$number`, `$default`, `$length`, `$get`, `$pick`.
   `$add`/`$subtract`/`$multiply`/`$divide` are **out of the first cut**, and the argument is
   concrete rather than doctrinal: `VALUE_LANGUAGE.limits` already **serves** the sentence *"No
   arithmetic, string interpolation or function calls. Compute in a cloud function"* to every
   client, and the docs page says it twice more. Shipping `$add` would have falsified a served
   string before anyone argued for it. Adding an op later is additive and served; removing one is
   not. `$split` was added to the proposal's list because a comma-separated supplier field is
   Richard's own scenario and it is the exact inverse of `$join`, which was already in.
2. **Wildcards — out of v1, whole.** `lines.*.amount` is a change to `getPath`, which conditions
   share. One change for both languages or none; a second walker for transforms is the one thing
   this page rules out by name.
3. **Ops in the shared resolver — NO, and it is enforced by the type system rather than by a
   comment.** `resolveValueDeep(spec, scope, depth, ops?)` takes the table as a **parameter with no
   default**. Conditions and ordinary step params never pass one, so a condition still cannot
   compute, and it cannot start computing because someone widened a list it happens to share. Two
   specs pin exactly that (`workflow-transform.test.ts` → *"the shared resolver did NOT gain the
   ability to compute"*).

**One thing this page did get exactly right, against the adjacent trap:** `raw: true` on `output` is
correct, where CWF-001's proposed `raw` param would have broken that feature. The difference is who
owns the walk — only the transform executor holds the op table, so the engine must leave `output`
alone, which is precisely what `rawParamNames` is for.

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

## What shipped (slice 1)

| Layer | What |
|---|---|
| Vocabulary | [`steps/transform.ts`](../../../packages/nodegx-backend/src/workflow/steps/transform.ts) — 12 ops with fixed arity, `TRANSFORM_LANGUAGE`, `validateTransformOutput`, `TransformStepExecutor` |
| Resolver hook | `resolveValueDeep`'s optional `ops` table + `ValueOp` / `ValueOpTable` / `ValueOpError` in `values.ts`. **One walker, one set of `$literal`/depth semantics**, and conditions cannot reach it |
| Catalog | `transform` kind (category `Workflow Data`), `transformLanguage` served, `STEP_KIND_CATALOG_VERSION` → **`1.6.0`** |
| Editor | `PORT_TYPE_TRANSFORM` / `CONTROL_TRANSFORM_OUTPUT`, `WorkflowTransformType`, `TransformOutputEditor.tsx` — rows plus an op picker, every operand a `WorkflowValueInput` |
| MCP | `list_backend_step_kinds` and the step schema now name `transform` and `return` (both prose lists were stale) and tell an agent the op set is **served and closed** |
| Docs | `docs/runtime/WORKFLOW-NODES.md` §`transform`, gated by the coverage suite — every served op must appear on the page |

**Done-when, checked:** an unknown `$op` is a loud 400 at write time *and* a loud step failure at run
time (asserted from both ends); removing an op from the backend removes it from the editor picker
with no editor change (the picker is built from the served list, pinned by a spec). **Not done:** the
live drive against a real POST — asserted end-to-end through the real engine instead.

## Slices

**S1** — ~~Settle the op vocabulary, the wildcard question, and where ops live (below), with
Richard.~~ Decided in the corrections block above; the reasoning is in the code, so reopening any of
the three is a deliberate act with a stated cost.
**S2** — Backend: served op table (mirroring `conditionLanguage` in the catalog), resolver,
validation, catalog entry, version bump.
**S3** — Editor: ops ride on the port type the way `conditionOps` does
([workflowNodeLibrary.ts:150-152](../../../packages/noodl-editor/src/editor/src/models/workflow/workflowNodeLibrary.ts#L150-L152));
the editor is CWF-001's rows editor plus an op picker per row.
**S4** — MCP: the agent must be served the vocabulary or it will invent operations.
**S5** — Docs + one worked webhook-reshaping example.
**S6** — The "new function from this step" gesture (see above).

## The three open design questions — ALL THREE DECIDED, see the corrections block at the top

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

- ⚠️ ~~`MAX_VALUE_DEPTH` (32) and `validateParamDepth`~~ — **the function is
  `validateValueReferences`; `validateParamDepth` has never existed.** Measured rather than feared:
  a deeply nested realistic reshape reaches depth 6 of 32. Pinned by a spec.
- ⚠️ ~~Decide *loud failure vs undefined* once~~ — **decided: loud, matching conditions.** Every op
  that cannot be performed throws a step failure an `onError` edge can route. The single exception
  is **absence**, which is not a failure anywhere in this language (a missing `$path` is `undefined`,
  and so is `$get` past the end) — `$default` is how a field is declared optional, and it is named
  in the failure message of every string op for exactly that reason.
- ~~A step's params resolve against a scope that excludes that step's own params~~ — **the trap is
  real, the mechanism was not.** `output` is `raw`, so it is not resolved there at all; the executor
  resolves it in one pass against one scope, which is a stronger guarantee. Documented in the served
  catalog, the docs page and the editor's own footer rather than left implicit. **Not** an ordered
  pipeline, deliberately: chain two transform steps.
