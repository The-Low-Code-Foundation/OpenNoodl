# WFA-003 — Step Data Mapping & One Payload Shape: implementation notes

**Status:** ✅ Complete — 2026-07-28
**Spec:** [WFA-003-STEP-DATA-MAPPING.md](./WFA-003-STEP-DATA-MAPPING.md)
**Scope:** `packages/nodegx-backend` only, plus two docs pages and two MCP tool descriptions.
No editor work, as the spec predicted.

---

## What shipped

A workflow step can now **read values from the run and from earlier steps**, and all
**five** entry points deliver one payload shape.

```jsonc
{
  "id": "charge",
  "kind": "call-function",
  "ref": "chargeCard",
  "params": {
    "amount":   { "$path": "previous.result.total" },
    "orderId":  { "$path": "upstream.save.result.orderId" },
    "currency": "GBP",
    "note":     { "$literal": { "$path": "not a path" } }
  }
}
```

Before this, `step.params` were static literals merged verbatim (F11): there was no way
to feed one step's output into the next step's function input, so every function carried
adapter code to dig its input out of wherever it happened to be (F14). And the same
definition received a different object depending on how it was started (F12), which
phase 27 had already watched break a live run (F13).

### The pieces

| Where | What |
|---|---|
| `workflow/steps/values.ts` (new) | The value language, **extracted** from `conditions.ts` — `getPath`, `resolveValue`, plus `resolveValueDeep` / `resolveStepParams` / `collectValuePaths` / `exceedsValueDepth` and the served `VALUE_LANGUAGE` spec |
| `workflow/steps/conditions.ts` | Re-exports `getPath` / `resolveValue`, so its surface and its suite are unchanged |
| `workflow/runPayload.ts` (new) | `buildRunPayload` — the one place any entry point constructs a payload |
| `workflow/WorkflowEngine.ts` | Resolves params before the step runs; builds the run *scope*; validates `upstream.<stepId>` references against the graph |
| `workflow/StepExecutor.ts` | `StepExecContext.scope` — what a lazy value resolves against |
| `workflow/steps/{logic,timing}.ts` | Resolve against `ctx.scope`, not `ctx.input` |
| `workflow/steps/kinds.ts` | `raw` on a param spec; `valueLanguage` in the served catalog; version `1.0.0` → `1.1.0`; `wait.duration` may be a reference |
| Five call sites | `HttpServer` (webhook), `scheduler`, `dbchange`, `admin-triggers` (manual fire), `admin-workflows` (admin run) |

---

## Decisions worth keeping

### 1. `input` is what the function gets; `scope` is what a `$path` resolves against

Two different jobs were sharing one object. A step's `input` is the cloud function's
request body and the `inputData` on its execution record — it should be no larger than it
needs to be. But `$path` needs to reach `upstream.<stepId>`, which is per-run bookkeeping
nobody wants copied into every function body and every recorded row.

So the engine builds both: `input` (payload + resolved params + `previous`) and
`scope` (`input` + `upstream`). `StepExecContext` carries both, and everything that
resolves lazily — conditions, a `wait` duration, a `for-each`'s `items` — moved to
`ctx.scope`. The alternative, merging `upstream` into `input`, would have made
`{"$path": "upstream.save.x"}` work in a param but not in a `branch` condition, or worked
everywhere at the cost of duplicating every predecessor's output into every step record.
Two dialects of one syntax is exactly the trap the spec warned about.

### 2. `scope.upstream` is broader than `ctx.upstream`, deliberately

`ctx.upstream` (WF-002) is the **immediate** predecessors that took an edge here.
`merge` mode `"all"` decides whether a declared branch arrived by asking whether it is a
key in that map, so widening it would make a half-merge report as complete. It could not
move.

But the author-facing `upstream.<stepId>` has to reach further than one step: the
motivating example — "take the order id from the save step and pass it to the charge
step" — has a `branch` in between, where `previous` is the branch's own
`{result, isfalse}` and useless as data. So the **scope's** `upstream` is every earlier
step that produced output.

That map is permissive at run time (it also contains steps that are not ancestors, merely
earlier in topological order). **Write-time validation is the gate that keeps it honest**:
a `$path` may only name a step that is genuinely upstream in the graph, so an author
cannot write the loose case in the first place.

### 3. Conditions, filters and `switch` cases are **not** value-resolved

They are DSL structures whose own operands use this language, evaluated when the step
runs. Resolving them eagerly would rewrite the authored condition into its own answer in
the execution record — a run inspector showing `condition: {left: 120, op: "gt",
right: 100}` where the author wrote `{"$path": "previous.total"}` reads as if the step had
been handed a boolean.

They are marked `raw: true` in the catalog rather than special-cased in the engine, so
WFA-004's property editor learns from the served spec that these three want their own
editor (three dropdowns) rather than a value/binding control. A test pins the set to
exactly `branch.condition`, `for-each.filter`, `switch.cases`.

### 4. There are **five** entry points, not four

F12's table lists webhook, schedule, manual fire and admin run. **db-change is the
fifth** and delivered a fifth shape (`{trigger:'db-change', triggerId, action, collection,
id, record}`). Filed as **F38** and unified with the others: the changed record is the
run's `body`, and `collection` / `action` / `recordId` moved onto `trigger`.

### 5. `trigger` is the one key backwards compatibility could not keep

Every entry point still spreads the top-level keys it used to deliver, deprecated, for one
release — and `buildRunPayload` spreads that legacy bag **first**, so a canonical key
always wins a collision. That precedence is decided in one place rather than left to
object-spread order, and it is tested: a caller whose own data contains a `body` key gets
the canonical wrapper at `body` and their value at `body.body`.

`trigger` is the exception, because it **was** the trigger type as a string and the new
shape needs it to be the metadata object. One key cannot hold both.

- **The object wins.** It is what the spec's desired state, the served `valueLanguage`,
  the MCP tools and WFA-004's property editor are written against.
- **The string is preserved beside it as `triggerType`**, so switching on the entry point
  stays a one-liner: `{"$path": "triggerType"}`.
- Checked before deciding: **nothing in this repository read `payload.trigger`.**
  `docs/runtime/TRIGGERS.md` documented the string form, and now documents the change with
  the migration.

### 6. `wait.duration` may be a reference — a pre-existing gap, closed on the way past

`WaitStepExecutor` has called `resolveValue(p.duration, …)` since WF-002, but
`validateStepShape` demanded a literal number, so a `{"$path"}` duration was rejected at
write time and the executor's own resolution was unreachable from a saved definition.
Validation now defers the numeric and 24-hour-cap checks to the executor when the value is
a reference — the executor already fails loudly on both. A literal is still range-checked
at write time.

---

## Write-time validation, and the boot-refusal risk

Two new rejection cases, both typos-only:

- a `$path` naming a step that **does not exist** → 400 naming it;
- a `$path` naming a step that is **not upstream** of the referencing step → 400, because
  topological order means it cannot have produced output.

A path *into* an upstream output is allowed silently: the engine cannot know what shape a
cloud function returns.

**The risk the spec flagged is real and accepted.** Validation runs on load too, so a new
400 case means a definition valid yesterday could stop a backend booting today. Assessed:
`upstream` was never in scope for anything before this task, so the only definition that
could trip the new checks is one containing an `upstream.…` path in a *condition* — which
has always resolved to `undefined` and is therefore already broken. The load error names
the step and the param. Kept strict, consistent with the registry's existing doctrine.

The depth rule (`MAX_VALUE_DEPTH = 32`) is checked **per param, at the same starting depth
the resolver uses**, so "rejected at write time" and "resolved at run time" agree exactly
rather than differing by one level for the params object itself. At run time a subtree past
the cap is left verbatim rather than throwing mid-run, because a resolution error thrown
before `startNode` would have no step record to land on.

---

## Evidence

**`packages/nodegx-backend`: 64 suites, 670 passed / 10 skipped, 0 failures** — up from
62 suites and 622 passed on a stashed tree, so **48 new assertions' worth of tests** with
nothing regressed. `npx tsc --noEmit` clean; `npm run build` clean.

| Claim | Where |
|---|---|
| A value from one function's output reaches the next function's named parameter, **proven by that function's own response body** | `workflow-data-mapping.test.ts` — real `BackendService`, real CloudRunner Request→Response graphs, nothing stubbed |
| `upstream.<stepId>` resolves for a diamond where `previous` is ambiguous | same, plus a case reaching back **past a branch** |
| All entry points deliver the caller's data under `body`; a schedule delivers `body: {}` | admin run + manual fire + webhook live in `workflow-data-mapping.test.ts`; schedule and db-change at their real call sites in `scheduler.test.ts` / `dbchange.test.ts` |
| One definition branches identically whether an admin run or a webhook started it | `workflow-data-mapping.test.ts` — this is F13 closed |
| A definition written against today's payload shapes still runs | `workflow-data-mapping.test.ts`, plus **the whole WF-002 suite passing unedited** (its `order-pipeline` reads top-level payload keys) |
| `$literal` escaping works for params | unit + live (the function echoes back an object that really has a `$path` key) |
| Condition behaviour is unchanged | `workflow-conditions.test.ts` passes **without edits** — the point of extracting rather than copying |
| Ordering / cancel / timeout semantics did not move | `workflow-engine.test.ts` (WF-001's suite) passes unedited |
| The served spec describes the value language, version bumped, coverage-gated | `workflow-steps-catalog.test.ts` (spec ≡ docs) + `workflow-steps-http.test.ts` (over the wire from a running backend) |

**Not verified live in the editor** — there is nothing in the editor to verify. The
surface this task feeds is WFA-004's, which does not exist yet.

**Pre-existing failure, unrelated and untouched:** `noodl-mcp`'s
`tools.test.ts › create_component validates, writes and updates the registry` fails on
`validate_project` reporting 3 errors. Confirmed pre-existing by stashing the whole
change; it involves no workflow, backend or payload code.

---

## What the spec asked for that was not done exactly as written

**"Take the phase-19 test workflow definition verbatim."** That definition is not checked
into the repository — it was driven ad hoc against a live backend, and findings F11–F14
are what survive of it. The compatibility test is therefore written in its **idiom**
(`{"$path": "total"}` straight into top-level payload keys, static literal params, the
recorded `save` / `decide` / `charge` / `logfail` step ids) rather than its bytes, and the
deviation is recorded here rather than glossed. The F14 adapter code lives *inside*
functions and is unaffected either way: a function's declared parameters are unchanged by
this task.

---

## Traps for whoever is next

- **A param cannot reference another param of the same step.** Params resolve against a
  scope that deliberately excludes them, because defining a resolution order between
  params is a cost with no demand behind it. Stated in the served spec and the docs.
- **A payload key named `upstream` is shadowed** inside conditions, because the scope adds
  its own. Same class as `previous`, which has always shadowed.
- **`for-each` now passes the RESOLVED `items` array into each per-item function**, where
  it used to pass the unresolved `{"$path": …}` spec. Strictly better, but it is a change
  in what those functions receive.
- **`STEP_KIND_CATALOG_VERSION` is pinned in a test** (`1.1.0`). That is deliberate: the
  catalog's `version` field only means something if bumping it is an act rather than an
  accident.
- **`ExecutionLogger` still records nothing for cloud function runs** (F32, WFA-002). This
  task changes what a step's `inputData` contains, not whether function runs have steps.
