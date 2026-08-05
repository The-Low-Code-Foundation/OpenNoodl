# CWF-002 — The workflow computes an output and throws it away

**From:** [TALK-001](TALK-001-THE-CLOUD-WORKFLOW-AUDIT.md) Pile 1.2 + **Q3, decided 2026-08-05**:
do *both* layers — the dispatcher fix **and** a visible Return step.
**Status:** open, unowned. Depends on nothing; sequence after CWF-001.

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

There is a second, quieter problem: `lastOutput` is *whichever step finished last*. With a branch,
or a `for-each` with concurrency, which step that is is not something an author can read off the
canvas. That is the argument for an explicit Return step rather than only fixing the transport.

Cloud functions already have the right shape: the **Response** node
([noodl-viewer-cloud/src/nodes/cloud/response](../../../packages/noodl-viewer-cloud/src/nodes/cloud/)).
The workflow level should rhyme with it, not invent a second vocabulary.

## Slices

**S1 — The transport (small, ships alone).** A per-trigger `responseMode: 'sync' | 'async'`.
- `sync` — the dispatcher waits for the run and returns the workflow output as the body.
- `async` — today's behaviour, `{executionId, status}`, unchanged and still the default for
  schedule/event triggers where there is no caller to answer.
Add it to the trigger definition, the Triggers panel UI, and the served catalog. ⚠️ Sync mode
inherits the workflow timeout — a `wait` step in a sync workflow holds an HTTP connection open.
Cap it, and say so in the field's description rather than discovering it in production.

**S2 — The Return step.** A new step kind `return` (name it to match the Response node's language;
"Respond" reads better if the trigger is a webhook, "Return" if it is called). Params: one `value`
of type `any` — so it gets `WorkflowValueInput` for free and can be a literal or a `$path` into any
predecessor. Routes: none; it terminates its path like `stop`. The engine sets the run output from
the Return step that ran, and `lastOutput` becomes the fallback for workflows that have none.
⚠️ Two Return steps on two branches is **legal and normal** (success path, error path) — do not
validate it as an error. Two Return steps that both *run* (parallel merge) is the case to define:
first-wins, recorded in the execution record, is the least surprising.

**S3 — Make it visible.** The canvas should show, on the entry card or the header, what the caller
gets: nothing (async), the last step's output, or the named Return step.

**S4 — Docs.** `docs/runtime/WORKFLOW-NODES.md`; the Response↔Return rhyme stated explicitly.

## Done when

- A webhook-triggered workflow with a Return step, fired with `curl`, answers with the returned
  value — driven live, output pasted into the handover.
- An async trigger still answers `{executionId, status}` — the existing behaviour has a test that
  still passes.
- A workflow with no Return step behaves exactly as it does today.

## Traps

- ⚠️ `dispatcher.ts` also has the **refused-fire** and **404/503** paths
  ([dispatcher.ts:115, 130, 184, 202](../../../packages/nodegx-backend/src/triggers/dispatcher.ts#L115)) —
  those bodies are error envelopes and must not be reshaped by a sync-mode change.
- The dispatcher's own header comment claims "never a silent drop" ([dispatcher.ts:9-12](../../../packages/nodegx-backend/src/triggers/dispatcher.ts#L9-L12)).
  It means execution records, but it reads as a promise this task is making true. Update it.
- A step kind added to the catalog is a **catalog version bump** and appears in the editor picker
  automatically — check the picker's category grouping ([workflowNodeLibrary.ts:98](../../../packages/noodl-editor/src/editor/src/models/workflow/workflowNodeLibrary.ts#L98))
  so `return` lands somewhere sensible rather than in the default bucket.
