# CWF-004 — Declarative data steps: reshaping a payload is workflow work

**From:** [TALK-001](TALK-001-THE-CLOUD-WORKFLOW-AUDIT.md) Q1(b), **re-argued and confirmed
2026-08-05** after the orchestrate/compute distinction was properly understood. The original
justification ("avoid a round trip through a second canvas") was weak and partly wrong. The real one
is Richard's:

> *"Incoming webhook data from an outside supplier can be annoyingly formatted, for example nested
> arrays and data when you only need one object for the cloud function, so being able to do a kind
> of `'paymentObject': 'previous.user.order.payment'` transformation lightens the load of the cloud
> function."*

**Status:** **SLICES 1 AND 2 SHIPPED** 2026-08-06. Slice 1 was the `transform` step alone (S1–S5);
slice 2 is the rest of the declarative data family — **Validate, Filter, Sort, Deduplicate, Split**
as step kinds, and **Parse / Stringify JSON as two transform OPERATIONS** rather than a step (the
reasoning is below, and it is a departure from this page's own table). **Aggregate is deliberately
unbuilt and is Richard's decision** — the input he asked for is in the table below. **S6**, the "new
function from this step" gesture, is still open and is being sequenced separately on the workflow
canvas. CWF-001 landed first and its `WorkflowValueInput` is reused for every operand, so no second
value editor exists.

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
reference-or-route, never compute.

| Step | What it does | Verdict → outcome |
|---|---|---|
| **Transform** | Reshape into a new object using paths + a small op vocabulary | **SHIPPED, slice 1** — the case above |
| **Validate** | Assert the incoming shape (required paths, types); fail the run loudly with a readable message | **SHIPPED, slice 2** — two rule forms, a served closed type list, no `invalid` route (`onError` already is one) |
| **Filter** | Drop array items not matching a declarative condition | **SHIPPED, slice 2** — and it turned out to be more than surfacing `for-each`'s param: as a step the filtered list is an *output*, so it is recorded, readable downstream and usable for something other than a per-item call |
| **Split / Batch** | Chunk an array into groups of N | **SHIPPED, slice 2** as `split`; the cap is a failure, not a truncation |
| **Sort** | Order an array by a path | **SHIPPED, slice 2** — reusing the *condition language's* ordering, so a sort and a `gt` can never disagree |
| **Deduplicate** | Drop repeats by a path | **SHIPPED, slice 2** — a key-less item is always kept, because absence is not a value here |
| **Aggregate** | count / sum / min / max / group-by over an array | **NOT BUILT — Richard's call.** See below |
| **Parse / Stringify JSON** | A string field that is really JSON (suppliers do this constantly) | **SHIPPED, slice 2, but as two OPERATIONS** (`$parseJson` / `$stringifyJson`) rather than a step kind. See below |

### Why Parse/Stringify JSON is an operation and not a step

A departure from the table above, decided during slice 2 and worth stating rather than absorbing.
The case is Richard's — *"a string field that is really JSON"* — and the word doing the work is
**field**. A step parses one whole value and hands it on, so reading anything out of it takes a
second step; as an operation it composes with `$get` and the rest of the table inside one reshape,
which is where the problem actually is:

```jsonc
{ "orderId": { "$get": [{ "$parseJson": { "$path": "body.payload" } }, "order.id"] } }
```

Nothing is lost. `{"order": {"$parseJson": {"$path": "body.raw"}}}` is the whole-payload case,
written as one field. And nothing served is falsified: parsing is not arithmetic, not string
interpolation and not a function call. It is the one operation in the vocabulary that can look
*inside* data a supplier flattened. `stringish()` in `transform.ts` had already anticipated it by
name — it refuses objects "because that is the Parse / Stringify JSON step of the wider family".

### Aggregate — the input Richard asked for, not a decision

The table says *"declarative, but it* is *computing. Decide deliberately"*, and slice 2 deliberately
did **not** decide. Three things it clarified, offered as input:

1. **The doctrine test it fails is a real one, and it is the only entry in the table that fails
   it.** Every kind shipped in slice 2 can be described as "the data you already had, minus some of
   it or in a different order". `count` is the boundary — it is one number the data did not contain —
   and `sum` / `min` / `max` are unambiguously past it. `$length` already ships in the transform
   vocabulary and is exactly `count` under another name, so the line is not where it looks: it is
   between *"how many"* and *"how much"*.
2. **The served sentence is the concrete cost, exactly as it was for `$add`.** `VALUE_LANGUAGE.limits`
   serves *"No arithmetic, string interpolation or function calls. Compute in a cloud function"*, and
   `docs/runtime/WORKFLOW-NODES.md` says it twice more. `sum` is arithmetic by any reading. Shipping
   it means editing that sentence in three served places first, which is a fine thing to do
   deliberately and a terrible thing to do as a side effect.
3. **The alternative is now cheaper than it was.** A one-node cloud function reached from a
   `call-function` step is the answer, and after slice 2 the workflow can hand that function a
   guarded, filtered, sorted, batched list — so the function it calls is a three-line `reduce` with
   a stable input contract rather than a payload-parsing chore. That is the case *for* leaving
   aggregation where compute lives; it is not an argument that nobody will want the step.

**If it is built**, the shape that costs least is `{ over: <items>, as: { total: {"$sum": "amount"} } }` —
one step, an output object like `transform`'s, a closed function table with fixed arity, and
`groupBy` as a separate param. Not built here.

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

## What shipped (slice 2)

| Layer | What |
|---|---|
| Vocabulary | [`steps/validate.ts`](../../../packages/nodegx-backend/src/workflow/steps/validate.ts) — `VALIDATE_TYPES` (5 closed types), `VALIDATE_LANGUAGE`, `validateValidateRules`, `ValidateStepExecutor`. [`steps/data.ts`](../../../packages/nodegx-backend/src/workflow/steps/data.ts) — `Filter` / `Sort` / `Deduplicate` / `Split` executors, sharing one `resolveItems`. **Neither introduces a language of its own**: `filter` borrows the condition language whole, and `sort` borrows its ORDERING |
| Shared order | `compareOrdered` exported from `conditions.ts`. One order for the layer, or `"10" > "9"` under `gt` and `"10"` before `"9"` under `sort` — the same data, two answers |
| Transform | `$parseJson` / `$stringifyJson` added to the closed table (14 ops), taking the family table's last row as operations rather than a step |
| Catalog | Five kinds in category `Workflow Data`; `validateLanguage` served; `STEP_KIND_CATALOG_VERSION` → **`1.7.0`**. Four of the five needed no shape change at all |
| Editor | `PORT_TYPE_VALIDATE` / `CONTROL_VALIDATE_RULES`, `WorkflowValidateType`, `ValidateRulesEditor.tsx` — the ONE new control. `filter`/`sort`/`deduplicate`/`split` needed no editor work: a `condition` is a condition wherever it appears, `items` is a value, and the rest are enums, strings and numbers |
| MCP | `list_backend_step_kinds` and the step schema name the five kinds and `validateLanguage`, and tell an agent the type list is served and closed — *anything richer than a JSON type is a `when` rule, not a new type* |
| Docs | `docs/runtime/WORKFLOW-NODES.md` §§ `validate` / `filter` / `sort` / `deduplicate` / `split`, plus the two JSON ops. Gated by the same coverage suite, now extended to every served **validate type and rule form** |

**Done-when, checked (slice 2):** an unknown validate `type` is a loud 400 at write time *and* a loud
step failure at run time (asserted from both ends); removing a type from the backend removes it from
the editor's dropdown with no editor change (the dropdown is built from the served list, and a spec
pins that the served list is generated from the one table that implements it). **Not done:** the live
drive — asserted end to end through the real engine instead, with a five-step supplier intake
(guard → filter → dedupe → sort → batch → call).

**One design departure from this page, stated rather than absorbed:** Parse/Stringify JSON is two
transform operations, not a step kind. The argument is in "The wider family" above.

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
**S6** — The "new function from this step" gesture (see above). **STILL OPEN** — it lands on the
workflow canvas and is sequenced separately; slice 2 deliberately did not touch it.

⚠️ **A third mechanism this page named turned out to be stale, in the page it points AT.**
`BACKEND-AUTHORING-MODEL.md`'s two-surface table said *"9 step kinds: … Retry …"* — wrong since
CWF-005 folded `retry` into `call-function`, and wrong again after CWF-002's `return` and CWF-004's
`transform`. Fixed, with a warning on the row: the vocabulary is **served**, so a prose list of it is
a copy and copies drift. That is the same argument this task makes about the operator list, applied
to the doc that states the doctrine.

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
