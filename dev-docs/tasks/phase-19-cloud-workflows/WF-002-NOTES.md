# WF-002 — Implementation Notes

**Status:** complete (2026-07-26). Nine step kinds, all typed, all specced,
all documented, all tested against the real engine and — for the ones that do
real work — against real CloudRunner cloud functions.

This document records what was implemented, where WF-001's shipped semantics
overrode the phase-11 specs, what was deferred and why, and every residual.

---

## 1. What shipped

| Kind | Spec | Notes |
|---|---|---|
| `branch` | CF11-001 (IF) | Declarative condition → `ontrue` / `onfalse` routes |
| `switch` | CF11-001 | Ordered labelled cases + `default`; first match wins |
| `for-each` | CF11-001 | Invokes a cloud function per item; filter, cap, concurrency, error policy |
| `merge` | CF11-001 | Combines converging branches; `all`/`any`, three strategies |
| `retry` | CF11-002 | Exponential backoff, jitter, selective `retryOnStatus`, cancellable waits |
| `stop` | CF11-002 | Fail loudly with a message, or end the path quietly |
| `wait` | CF11-003 | Duration + unit, cancellable, 24h cap |
| `wait-until` | CF11-003 | ISO/epoch target → `done` / `skipped` routes |

`call-function` (WF-001's original) is unchanged.

**Files.** `packages/nodegx-backend/src/workflow/steps/` — `conditions.ts`
(shared declarative condition language), `kinds.ts` (the step-kind catalog and
write-time validation), `logic.ts`, `errors.ts`, `timing.ts`, `sleep.ts`,
`CompositeStepExecutor.ts`. Engine changes are confined to `types.ts`,
`StepExecutor.ts` and `WorkflowEngine.ts`.

**Tests.** 68 new specs across four files; full package suite **327/327**,
build green, `catalog:check` and `catalog:merge:check` green, `noodl-mcp`
50/50.

---

## 2. The structural decision: step kinds, not viewer nodes

CF11-001/002/003 all specify files under
`packages/noodl-viewer-cloud/src/nodes/logic/` with signal ports,
`triggerOutput`, `triggerOutputAndWait` and per-instance mutable state — i.e.
browser-runtime nodes.

WF-001-SEMANTICS overrides this, explicitly and by name:

> WF-002's Series-1 workflow nodes plug into the same `StepExecutor` seam as
> additional step kinds; none of the semantics below change when they arrive.

So they are step kinds. This is not a technicality — the two models are
genuinely incompatible:

- **There are no signals.** WF-001's ordering is edge-driven: a step runs
  because a predecessor's edge selected it. `triggerOutput('onTrue')` has no
  referent; the equivalent is *selecting a route*.
- **There is no `triggerOutputAndWait`.** Nothing can "trigger downstream and
  await its result" because the engine, not the node, owns scheduling.
- **There is no per-instance state across invocations.** A step runs once per
  run, and runs are in memory (WF-001-SEMANTICS §5).

Translation table:

| CF11-00x mechanism | WF-002 equivalent |
|---|---|
| `triggerOutput('onTrue')` | select the `ontrue` route |
| dynamic `case_0..n` output ports | `routes` keyed by case label |
| `triggerOutputAndWait` per item | a cloud-function invocation per item |
| branch-arrival tracking + reset (`merge`) | read predecessors' outputs; topological order already guarantees they finished |
| `context._debounceTimer` | (deferred — see §5) |

**Port names follow the real client nodes, not the CF11 sketches.** The sketch
wrote `onTrue`/`onFalse`; the shipped client `Condition` node's ports are
`ontrue`/`onfalse`/`result`/`isfalse`, so those are what `branch` uses. WF-002's
brief asks that a user who knows the client node not have to relearn it, and the
node is the authority on its own port names.

---

## 3. Where WF-001 overrode the phase-11 specs

Recorded rather than silently resolved, as the brief requires.

### 3.1 Try/Catch is not a step kind — `onError` edges already are it

CF11-002's third node was Try/Catch (`try`/`catch`/`finally`/`error`/`success`).
WF-001 shipped that capability as graph structure: §2 says errors are "routed,
not merely thrown … supporting CF11-002's catch/retry designs".

A Try/Catch step kind on top would be a second way to express one thing, and the
node version could not actually wrap anything — a step has no body to guard; its
"block" is its successor steps, which the engine already schedules. Mapping:

| CF11-002 Try/Catch | WF-001 equivalent |
|---|---|
| `try` output | the step's own `next` edges |
| `catch` output | the step's `onError` edges |
| `error` object | `previous.error` on the handler step |
| `finally` output | a `merge` step (`mode: "any"`) fed by both paths |
| `success` boolean | which edge was taken (also in the step record) |

This is in `steps/errors.ts`'s module docblock and in the author docs, so
someone looking for the node finds the answer rather than concluding it was
forgotten.

### 3.2 Conditions are declarative, not expression strings

CF11-001's IF node takes a "boolean expression" with a visual expression
builder. On the server that means shipping an evaluator (`new Function`/`eval`)
or a parser.

A workflow definition is a **persisted, deployable, MCP-authored JSON file**. An
`eval`'d string inside one is a remote-code-execution surface with an admin
credential in front of it — and PLAT-003 and LEARN-001 both spent effort
*removing* `eval` from this codebase. So conditions are a closed operator set
(19 operators, `all`/`any`/`not`, `$path` value refs), which is total,
serialisable, diffable (SUB-007), statically validatable at write time, and
trivially describable to an authoring agent.

Cost, stated honestly: arithmetic in a condition (`total * 0.2 > threshold`) is
not expressible. Compute it in a cloud function and branch on the result. If
that proves too limiting a **sandboxed** expression evaluator is the follow-up —
not `eval`.

### 3.3 `for-each` iterates a function, not a sub-graph

CF11-001's ForEach `await`s `triggerOutputAndWait('iteration')` per item — i.e.
it runs an arbitrary downstream sub-graph per item. WF-001 has no signal ports
and no nested scheduler, and adding one would be a second scheduling engine.

The per-item unit is therefore a **cloud-function invocation**, which is the
same unit `call-function` uses and keeps "a workflow node is a node" true:
what runs per item is a real graph of real, catalogued, typed nodes. Iterating an
arbitrary sub-DAG is deferred (§5).

### 3.4 `merge` does not wait, and does not track arrivals

CF11-001's Merge tracks which branches have signalled and fires when all have
arrived, then resets. Under WF-001 that machinery is unnecessary and would be
misleading: steps run in topological order, so **every predecessor of a merge
step has already finished when it runs**. The kind reads their outputs directly.

The useful part of CF11-001's design — "did all the branches I expect actually
happen?" — survives as `mode: "all"`, which fails loudly when a declared source
did not arrive.

### 3.5 Wait/delay is not frame-scheduled, and that has consequences

CF11-003's nodes assume browser timers. Server-side, a wait holds a real process
and one of the workflow's `concurrency` slots, does not survive a restart
(WF-001-SEMANTICS §5), and is billed occupancy on a metered host. The brief
asked that this be explicit in the node's own documentation rather than assumed;
`docs/runtime/WORKFLOW-NODES.md` has a dedicated section, and a test asserts it
is still there.

Concretely: a **24-hour hard cap**, enforced at *write* time so the rejection
lands on the author rather than in production, with the docs pointing at WF-005
schedule triggers for anything longer (persisted cron costs nothing while it
waits and survives a restart).

### 3.6 Debounce is deferred (§5)

---

## 4. Engine changes, and why they do not contradict WF-001

WF-002's brief says to fix inadequate runtime error routing *in the runtime*
rather than working around it in nodes. Four additive changes; the WF-001
semantics suite passes unchanged (21 specs), which is the evidence that nothing
documented moved.

**4.1 `WorkflowStep.routes` — named conditional edges.** Route targets are
validated for existence and folded into the acyclicity check exactly like
`next`/`onError`. WF-001-SEMANTICS §1 already defines a step as eligible "only
when its incoming edge has been *taken* by a completed predecessor"; selective
taking is that rule, used.

**4.2 `stepResult(output, {select, halt})`.** An executor may return a routing
result instead of a bare output object. A bare object still means "take all
`next` edges", so `FunctionStepExecutor` is untouched. The discriminant is a
`Symbol.for` brand, not a `__field`, because a step's output is arbitrary user
JSON from a function response and any string key could collide.

**4.3 `StepExecContext.upstream`.** Outputs of *every* predecessor that took an
edge into the step (WF-001 tracked only the first, for `previous`). Needed by
`merge`.

**4.4 A failed step's outcome now carries `{ error: {...} }`.** This is the one
that CF11-002 genuinely required: before it, a handler reached via `onError`
received `previous: undefined` and could see *that* something failed but not
*what*. It is additive — the step is still recorded `error`, the run disposition
is unchanged, and nothing is softened.

**One deliberate semantic addition:** `halt` (take no outgoing edges at all),
used only by `stop` with `isError: false`. Its effect is visible — everything
downstream is recorded `skipped`, not silently absent.

---

## 5. Deferred, with reasons

**Debounce (CF11-003).** Debounce is inherently about *repeated invocations over
time within one persistent node instance*: cancel the pending timer, restart it,
fire once when the noise stops. WF-001 has no such instance — a step runs once
per run, and runs are in-memory with no cross-restart state (§5). Implementing
it would mean inventing cross-run persistent state that the durability policy
explicitly does not have, and it would be silently wrong after any restart.

The problems debounce solves already have honest answers here: the per-workflow
`concurrency` cap serialises overlapping runs, and rate limiting belongs at the
trigger (WF-005) where the noise actually arrives. Building it properly is a
v2 item alongside checkpoint/resume, not something to fake now.

**Iterating an arbitrary sub-DAG in `for-each`.** Needs a nested scheduler —
i.e. a second execution engine — and interacts with cancellation, per-step
timeouts and execution-record shape in ways that deserve their own design pass.
Related to WF-001's own parallel-fan-out residual (§7 of the semantics doc).

**Series 2–5 nodes.** Out of scope per the phase PROGRESS notes.

**A visual expression builder** (CF11-001's out-of-scope item, still out of
scope). The condition language is authored as JSON today.

---

## 6. Catalog: the argument

**Step kinds are not in `node-catalog.json`, and cannot be.** That artifact is
generated by *running* the browser (`noodl-viewer-react`) and cloud
(`noodl-viewer-cloud`) node registers and serialising what registered;
`catalog:check` regenerates and fails on any drift, so a hand-written entry
would be deleted by the next generation. A step kind registers in neither
register, because it is a `kind` field in a step DAG, not a node with ports on a
canvas. There is direct precedent: library **module** nodes are documented as
out of catalog scope for the same structural reason (`library/modules/AUDIT.md`).

**This is not the WF-005 exemption, and it is not a skipped catalog entry.**
WF-005 shipped with no catalog *and no equivalent* — correctly, because a trigger
targets an existing function and adds no vocabulary. WF-002 adds nine new things
an author must know about, so what the catalog requirement actually buys —
discoverability by the validator and the AI authoring loop — is delivered in the
form the artifact has:

- **`STEP_KIND_SPECS`** (`steps/kinds.ts`) — a versioned spec table with
  `params`, `routes`, `output`, `summary`, `whenToUse`, `clientEquivalent` and
  `notes` per kind. Deliberately shaped like a SUB-005 enrichment entry.
- **`GET /admin/workflow-step-kinds`** — served by the running backend, so the
  vocabulary can never drift from what that backend actually executes. Not gated
  on the engine being ready: "what can I author?" must be answerable at startup.
- **MCP `list_backend_step_kinds`**, described so an agent calls it *before*
  authoring, plus `create/update_backend_workflow`'s step schema extended to all
  nine kinds and the `routes` field.
- **The same table drives write-time validation**, so an unknown kind, a missing
  required param, a malformed condition or a bad route name is rejected with a
  400 naming the problem and refuses to load from disk.
- **`tests/workflow-steps-catalog.test.ts`** — the local equivalent of
  `catalog:merge:check --require-coverage`: it fails if the spec table, the
  `StepKind` union and the executor table diverge, or if a kind is not documented
  under its own heading in `docs/runtime/WORKFLOW-NODES.md` with all its params
  and routes. A kind cannot ship invisible.

**What is genuinely not covered:** SUB-006's semantic validator does not check
workflow definitions. It validates *project graphs* against the node catalog;
workflow definitions are backend-side JSON it never sees. Their validation is
the engine's own `validateWorkflowDefinition`, which is stricter about what it
does cover (it rejects on write and refuses to start on load). Extending the
editor-side validator to workflow definitions is a real, unowned follow-up if
workflows ever get a canvas.

---

## 7. Residuals — the honest list

1. **No live-editor verification.** `lerna exec` resolves to the main checkout,
   not this worktree, so the editor cannot be run from here. Nothing was dropped
   on a canvas and looked at. There is also currently **no editor UI for
   authoring WF-001 workflows** — they are authored over MCP and the admin
   routes — so "appears in the node picker" (a WF-002 success criterion written
   before WF-001 chose the step-DAG model) has no referent to satisfy.

2. **History Panel / canvas overlay not re-smoke-tested.** The per-step records
   are asserted end-to-end (statuses, `inputData`, `outputData`, `nodeType`,
   `errorMessage`) through the real store and HTTP surface, so the data is
   provably right. That the panel *renders* it was already WF-001's own
   `⚠️ engine-side proven` residual and is unchanged here.

3. **`nodeType` for the new kinds is new vocabulary for the overlay.** Steps now
   report `branch`, `wait`, `for-each:perItem` and so on where WF-001 only ever
   emitted `function:<name>`. Nothing asserts how the overlay renders an unknown
   node type. Worth 10 minutes of looking when someone next has the editor open.

4. **Concurrency inside `for-each` is untested above 1.** The parameter works
   and is validated, and the sequential path is covered; `concurrency > 4`
   against a real backend under load has not been exercised. Results stay
   correctly ordered by construction (a pre-assigned slot per item), but
   throughput and CloudRunner behaviour under parallel invocation are unmeasured.

5. **`retry` jitter is unseeded randomness.** Deliberate (it exists to
   de-synchronise retry storms) and therefore not asserted beyond "the delay
   stays within bounds". If it ever needs to be deterministic, inject a clock.

6. **No load or long-running soak.** The 24-hour wait cap is enforced but has
   obviously never been exercised end to end; the longest real wait in the tests
   is 300ms.

7. **`packages/noodl-mcp/src/tools/backendTools.ts` was edited** (step schema +
   one new tool). It is outside the nodegx-backend package and a concurrent
   agent could plausibly touch it; the change is additive and localised to the
   workflow section.

8. **Route-table and package touches** were kept additive for the concurrent
   BAK-005 merge: one route added to `HttpServer.ts`, no `package.json` change
   at all (no new dependencies — the condition evaluator, cron-free sleep and
   catalog are all hand-rolled, consistent with this package's no-runtime-deps
   posture).

---

## 8. Success-criteria map

| Criterion (WF-002) | Status | Evidence |
|---|---|---|
| All CF11-001/002/003 nodes implemented | ✅ except Debounce (§5, argued) | 8 new kinds |
| Behaviour matches client equivalents, differences documented | ✅ | `branch` uses the real `Condition` port names; `clientEquivalent` field per kind; docs section per kind |
| Error routing works per CF11-002's design | ✅ | `onError` = try/catch (§3.1) + the `previous.error` engine fix; retry/stop suites |
| Wait/delay semantics documented and correct, incl. cancellation | ✅ | cost section in the docs + cancellation and per-step-timeout specs |
| All nodes appear in the catalog and pass semantic validation | ⚠️ **reinterpreted** | Cannot enter `node-catalog.json` (§6). Delivered as a served spec table + MCP tool + coverage gate; SUB-006 does not validate workflow definitions |
| Example workflow runs end to end | ✅ | `order-pipeline` in `workflow-steps-http.test.ts`, over real CloudRunner functions |
| …and displays correctly in the existing UI | ⚠️ | records asserted; panel render not re-smoke-tested (residual 2) |
| Author documentation published | ✅ | `docs/runtime/WORKFLOW-NODES.md` |
| TypeScript, not new untyped JavaScript | ✅ | all new files `.ts`; package typecheck clean |
