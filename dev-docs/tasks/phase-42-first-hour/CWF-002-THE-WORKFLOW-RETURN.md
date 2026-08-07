# CWF-002 — The workflow computes an output and throws it away

**From:** [TALK-001](TALK-001-THE-CLOUD-WORKFLOW-AUDIT.md) Pile 1.2 + **Q3, decided 2026-08-05**:
do *both* layers — the dispatcher fix **and** a visible Return step.
**Status:** **CLOSED 2026-08-06.** S1, S2 and S4 shipped; S3 deferred (below). Four of this doc's
own stated mechanisms were wrong and are corrected in place, each marked **CORRECTION**.

## The mechanism, exactly

The engine computes an output and the transport drops it.

- `WorkflowEngine` tracks `lastOutput` across the run and puts it on the result:
  `output: lastOutput` ([WorkflowEngine.ts:425, 523, 632](../../../packages/nodegx-backend/src/workflow/WorkflowEngine.ts#L632)).
- The webhook dispatcher then answers
  `body: JSON.stringify({ executionId: runResult.executionId, status: runResult.status })`
  ([dispatcher.ts:205-218](../../../packages/nodegx-backend/src/triggers/dispatcher.ts#L205-L218)).
  The output is never serialised. Only the editor's admin route ever sees it.

So "what does the caller get back from a workflow?" has the answer **nothing** — for every caller
outside the editor.

> **CORRECTION (2026-08-06).** Both line references above are exact. But "only the editor's admin
> route ever sees it" was half true: `POST /admin/workflow-defs/:id/run` did return `run.output`,
> and the editor's **Test fire** did not — `admin-triggers.ts:181` answered
> `response: { statusCode }` and dropped the body. So the one surface an author would use to ask
> "what does my workflow answer with?" could not tell them either. Fixed here (`response.body`).

There is a second, quieter problem: `lastOutput` is *whichever step finished last*. With a branch,
or a `for-each` with concurrency, which step that is is not something an author can read off the
canvas. That is the argument for an explicit Return step rather than only fixing the transport.

Cloud functions already have the right shape: the **Response** node
([noodl-viewer-cloud/src/nodes/cloud/response](../../../packages/noodl-viewer-cloud/src/nodes/cloud/)).
The workflow level should rhyme with it, not invent a second vocabulary.

## Slices

**S1 — The transport (small, ships alone).** ✅ **SHIPPED.** A per-trigger
`responseMode: 'sync' | 'async'`.
- `sync` — the dispatcher waits for the run and returns the workflow output as the body.
- `async` — today's behaviour, `{executionId, status}`, unchanged and still the default for
  schedule/event triggers where there is no caller to answer.
Add it to the trigger definition, the Triggers panel UI, and the served catalog. ⚠️ Sync mode
inherits the workflow timeout — a `wait` step in a sync workflow holds an HTTP connection open.
Cap it, and say so in the field's description rather than discovering it in production.

> **CORRECTION (2026-08-06) — the biggest one in this doc. `sync` does not make the dispatcher
> wait. It already waits, and always has.** `fireWorkflow` awaits `workflows.run()`
> ([dispatcher.ts:187](../../../packages/nodegx-backend/src/triggers/dispatcher.ts#L187)) and
> `handleWebhook` awaits `dispatcher.fire()`
> ([HttpServer.ts:1973](../../../packages/nodegx-backend/src/server/HttpServer.ts#L1973)). A webhook
> pointed at a workflow with a ten-minute `wait` step has been holding an HTTP connection for ten
> minutes since WF-005 shipped — in the mode this doc calls "async".
>
> Two consequences:
> 1. The ⚠️ above describes **today's async behaviour**, not a risk sync introduces. `sync` is the
>    only mode with a bound: `responseTimeoutMs` (default 30 s, ceiling 5 min) → `504` with the run
>    left running. Opting *in* to sync makes a trigger's wait shorter, never longer.
> 2. The deepest unbounded await is not in `dispatcher.ts` at all. `WorkflowEngine.run` acquires a
>    per-workflow concurrency slot **before** the run starts
>    ([WorkflowEngine.ts `acquire`](../../../packages/nodegx-backend/src/workflow/WorkflowEngine.ts)),
>    and with the default `concurrency: 1` a second webhook queues behind the first for as long as
>    that one takes. A genuine fire-and-forget `async` (answer `202` immediately, never await) is a
>    real and separate change — **not** what this task shipped, because this doc's own definition of
>    `async` is "today's behaviour, unchanged", and it is.

**S2 — The Return step.** ✅ **SHIPPED** as `return`. A new step kind `return` (name it to match the Response node's language;
"Respond" reads better if the trigger is a webhook, "Return" if it is called). Params: one `value`
of type `any` — so it gets `WorkflowValueInput` for free and can be a literal or a `$path` into any
predecessor. Routes: none; it terminates its path like `stop`. The engine sets the run output from
the Return step that ran, and `lastOutput` becomes the fallback for workflows that have none.
⚠️ Two Return steps on two branches is **legal and normal** (success path, error path) — do not
validate it as an error. Two Return steps that both *run* (parallel merge) is the case to define:
first-wins, recorded in the execution record, is the least surprising.

**S3 — Make it visible.** ⏳ **DEFERRED, and it is the one thing left.** The canvas should show, on
the entry card or the header, what the caller gets: nothing (async), the last step's output, or the
named Return step. Deferred because the entry/trigger card is `workflowTriggerNodes.ts`, which
[CWF-006](CWF-006-TRIGGERS-AND-THE-ENTRY-STEP.md) is about to rework wholesale — putting a
`responseMode` line on a card that is being redrawn would be written twice. The fact it needs is
already served: `TriggerDef.responseMode` reaches the editor, and the Triggers panel shows and edits
it today. **Do this inside CWF-006.**

> **CORRECTION (2026-08-06).** S3's "the canvas" is more than one surface, and the trap at the foot
> of this doc points at the wrong one — see the third correction below.

**S4 — Docs.** ✅ **SHIPPED.** `docs/runtime/WORKFLOW-NODES.md` (`### return`, the Response↔Return
rhyme, a "who actually receives it" table, and the two-Returns rule) plus a new
**Answering the caller (`responseMode`)** section in `docs/runtime/TRIGGERS.md` — because the
setting lives on a trigger and an author reading about webhooks would never have found it on the
step-kinds page.

## Done when

- A webhook-triggered workflow with a Return step, fired with `curl`, answers with the returned
  value — driven live, output pasted into the handover. ✅
- An async trigger still answers `{executionId, status}` — the existing behaviour has a test that
  still passes. ✅
- A workflow with no Return step behaves exactly as it does today. ✅

All three, plus the cap, the two-Returns rule and the registry's refusals, are driven over a real
socket in
[`tests/workflow-return.test.ts`](../../../packages/nodegx-backend/tests/workflow-return.test.ts) —
13 specs. The suite's own docblock states why every assertion is on a response body and none on the
engine: the value was **always** computed correctly, so an engine-level test is exactly the test
that was green throughout the defect.

### What an existing trigger does after this change

Nothing different. `responseMode` is **absent** from every stored trigger, absence means `async`,
and the `async` branch of `fireWorkflow` is the same `await` and the same `JSON.stringify` it was
before — including holding the connection for the whole run, which it already did. The registry
writes the key only when it is `sync`, so `triggers.json` does not change for a trigger nobody
edited, and a diff shows a decision rather than a default. A function-target trigger cannot even
express the setting: it is refused at write time, because a function target already relays its own
response and the flag would be stored by the registry and read by nothing.

## Traps

- ⚠️ `dispatcher.ts` also has the **refused-fire** and **404/503** paths
  ([dispatcher.ts:115, 130, 184, 202](../../../packages/nodegx-backend/src/triggers/dispatcher.ts#L115)) —
  those bodies are error envelopes and must not be reshaped by a sync-mode change.
- The dispatcher's own header comment claims "never a silent drop" ([dispatcher.ts:9-12](../../../packages/nodegx-backend/src/triggers/dispatcher.ts#L9-L12)).
  It means execution records, but it reads as a promise this task is making true. Update it.
- ~~A step kind added to the catalog is a **catalog version bump**~~ — **CORRECTION: it is not.**
  `STEP_KIND_CATALOG_VERSION`'s own docblock says "bumped when the spec table's SHAPE changes (**not**
  when a kind is added)"
  ([kinds.ts:49-50](../../../packages/nodegx-backend/src/workflow/steps/kinds.ts#L49)). `return`
  shipped without touching it. (It did move to 1.3.0 in the same wave — that was CWF-001 adding
  fields to `StepParamSpec`, which is a shape change.)
- **CORRECTION: `workflowNodeLibrary.ts:98` is not the picker's category grouping.** It is
  `CATEGORY_COLOR`, a category→canvas-colour map; the picker's grouping is `byCategory` ~350 lines
  further down. Both matter, and a **third** thing matters more: `KNOWN_CATEGORIES` in
  [`nodegx-backend/tests/workflow-canvas-contract.test.ts`](../../../packages/nodegx-backend/tests/workflow-canvas-contract.test.ts)
  is a real gate that fails the build on a served category the canvas has no colour for. That is
  what actually caught the new category, not a code reading. `return` uses `Workflow Result` →
  `logic` — deliberately not the `Workflow` bucket, whose colour is `component` ("it schedules a
  function"), which a Return does not.
- **Not fixed, filed here:** `fireWorkflow` never calls `recordTriggerFire`, so a workflow-target
  fire is missing from the trigger metrics counter that the function path increments
  ([dispatcher.ts, end of `fire()`](../../../packages/nodegx-backend/src/triggers/dispatcher.ts)).
  Pre-existing and untouched — it is a metrics change with its own tests, not a return change.
