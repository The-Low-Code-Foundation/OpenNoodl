# AIX-011 — As-Built Notes

_Executor: Fable 5, parallel worktree, 2026-07-27. One slice: the whole task,
minus the deliberately deferred criterion 7 tail._

_Second slice, 2026-07-27: **criterion 7 closed** — the doc-authoring turn, the
graph-restatement lint, the fan-out's second pass, the reviewed diff, and both
write paths. See "Criterion 7 — closed" below._

## What shipped

All in `packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/`
unless noted:

| Piece | Where | Role |
|---|---|---|
| Plan model | `plan.ts` | THE one plan vocabulary: operation types, `validatePlan`, `orderPlanOperations`, cross-op `requires` + closures, `renderPlanContext`, `graphComponentFromFiles`. Pure/Electron-free — shared verbatim with noodl-mcp |
| Planning session | `PlanningSession.ts` + `prompts/planning.ts` | request → validated, ordered `AuthoringPlan` via one `submit_plan` tool; bounded repair on plan-validation errors; prose without a plan = `declined`, a legitimate outcome |
| Orchestrator | `PlanRun.ts` | Fans the plan through the EXISTING `AuthoringSession` (unchanged prompts/gate/repair); publishes composite state; extends a *working copy* of the ExplainGraph with each staged candidate so later ops can instantiate earlier creates; `acceptedOperations()` closes exclusions over the op-level dependency edges |
| Transaction | `planStaging.ts` | `applyAuthoredPlan`: preflight-then-one-`UndoActionGroup`; the ONLY plan write path; `PlanDocWriter` seam for AIX-009 |
| Staging primitives | `staging.ts` | `addAuthoredComponentToGroup` / `updateAuthoredComponentInGroup` extracted so N operations record into one caller-owned group; `updateAuthoredComponent` now a thin wrapper — behaviour unchanged |
| Panel | `views/panels/AiAuthoringPanel/ProjectAuthoringView.tsx` + a scope toggle in `AiAuthoringPanel.tsx` | This component / Project toggle (component scope default and untouched); plan preview with per-op Drop; live fan-out feed; per-op Review / Exclude with closure; explicit "Apply N of M"; Abandon |
| Plan context plumbing | `ContextBuilder.planContext()` (one additive method) + `planContext` option on `AuthoringSession` + optional `planContext` tail param on the two opening-turn builders | Sibling *intents* reach each op's session, charged and logged like any handout |
| MCP parity | `packages/noodl-mcp/src/tools/planTools.ts` (+2 additive lines in `server.ts`) | `create_plan` / `stage_plan_operation` / `apply_plan` / `discard_plan` — staged in memory, validated against the project + the plan's other staged ops, all-or-nothing on apply |

Specs: `tests/ai/authoring-plan.test.ts` (+11), `tests/ai/authoring-plan-staging.test.ts`
(+5) registered in `tests/ai/index.ts`; `noodl-mcp/tests/planTools.test.ts` (+6, jest).

## The property that must not break — how it is enforced structurally

- **No per-operation apply exists.** `PlanRun` never imports staging and holds
  no `ProjectModel`; it produces plain data. `applyAuthoredPlan` is the only
  plan write path and takes the *complete* accepted set in one call —
  `AppliedPlanComponentOperation.files` is non-optional, and staged files only
  exist for candidates that passed the gate. "Apply op 1 before op 3
  validates" has no expressible code path.
- **Preflight before any mutation.** Every refusal (collision, vanished
  target, duplicate target, doc-op-without-writer, empty set) throws
  `StagingError` before the first `ProjectModel` call.
- **One `UndoActionGroup`, pushed once.** Creates/updates record into a
  caller-owned group via the extracted staging primitives; per-update
  settle-order discipline (undo half first, do half last) survives
  concatenation because group undo runs the whole list in reverse.
- **Criterion 4 is tested on real files**: corpus → real `ProjectModel` →
  `project.toDirectory` (the product's own save path) to a temp dir → apply
  3-component plan → assert ONE undo-stack entry → undo once →
  `toDirectory` again → `Buffer.equals` on the two `project.json`s.
- **Reject/abandon is still the absence of a call**, at both levels: a plan
  never handed to `PlanRun` costs zero authoring turns (criterion 2); a run
  never handed to `applyAuthoredPlan` touches nothing (criterion 5).

## Decisions worth keeping

- **Ordering is creates → updates → docs, not parsed dependencies.** Intents
  are prose; "which update references which create" is unknowable at plan
  time. Creates-first makes every legal reference orderable without parsing,
  and `validatePlan` rejects at plan time exactly the plans that could not be
  ordered (update of a component nothing provides, create of an existing one,
  two ops on one component).
- **Cross-op dependencies are computed from staged files, not intents**:
  op B requires op A iff A creates a component B's candidate instantiates
  (`componentRefTargets`). Same closure algebra as AIX-003, one level up;
  `apply_plan`'s skip and the panel's Exclude both refuse un-closed subsets.
  Known limit: a reference that lives in a string *parameter* (e.g. a route
  path) is invisible to this scan — validation still catches the hard cases
  (unknown component type), but a param-only coupling can be dropped apart.
- **Later ops see earlier ops through a working-copy ExplainGraph** (staged,
  never applied). This is also why op-2-instantiates-op-1's-component passes
  the unchanged gate — spec-asserted.
- **The plan block lives after the AIX-007 cache boundary.** Sibling intents
  are per-plan data; a spec asserts the stable prefix is byte-identical with
  and without a plan, and standalone sessions build the exact same messages
  as before (no plan → no block, no extra charge).
- **MCP plan staging is in-memory per server process.** Plans die with the
  process; that is the right scope for "stage, then commit once" and needs no
  files. Residual honesty: after apply-time revalidation, the sequential
  `writeComponent` calls are not atomic across ops — a mid-sequence *disk*
  failure (not a validation failure; those all happen first) could leave a
  partial write. Same class of residual as every other multi-file write in
  the store.
- **Editor and MCP share the model, not the executor.** The editor's executor
  is LLM sessions; MCP's caller *is* the agent and stages payloads itself.
  What must not drift — the plan vocabulary, validation, ordering, closure —
  is one module (`authoring/plan.ts`, imported by relative path per the
  `editor-deps` pattern).

## Criterion 7 — closed 2026-07-27, and the gap was not where the hand-off said

The first pass described this as "wire a seam". It was not. A `doc` plan
operation carries `{target, intent}` and nothing else, and `PlanRun` skipped
doc operations in the fan-out entirely — so **no step ever authored the doc
body**, and `docs.write(path, proposed)` had no `proposed` to be handed. The
seams refused loudly rather than fake-succeeding, so nothing was unsafe; what
was missing was a producer.

What closes it:

| Piece | Where | Role |
|---|---|---|
| Doc-authoring turn | `DocSession.ts` + `prompts/docAuthoring.ts` | One bounded conversation, shaped like `PlanningSession`: one `submit_doc` tool taking the WHOLE file. Sees the current document, the plan's request, its own intent, and what the fan-out actually built. Writes nothing |
| Graph-restatement lint | `docLint.ts` | The mechanical half of AIX-009's "docs never describe the graph". Advisory only — one rewrite pass, the AIX-006 style-advisory shape |
| Fan-out second pass | `PlanRun.runDocOperation` | Doc ops author **after** every component op, in their own pass; the body is staged in memory with the baseline it was written against |
| Plan outcome | `plan.ts` — `renderPlanOutcome` | What the plan *achieved*, per component op, including what it failed to build and an instruction not to document it |
| Write path | `models/ProjectDocs/PlanDocWriter.ts` | `createPlanDocWriter(docs)`: optimistic-concurrency preflight + `push`-recorded inverse into the caller's group |
| Review | `views/panels/AiAuthoringPanel/PlanDocReviewDialog.tsx` | The proposal as a `CodeDiffView` diff, in the plan, with Keep / Drop-from-plan |
| MCP parity | `planTools.ts` | Doc ops stage `content` and are written by the same `apply_plan`; `writeProjectDocFile` extracted from `docsTools.ts` so there is one doc write path, not two |

Four decisions worth keeping:

- **The doc turn runs in a second pass, not interleaved.** `orderPlanOperations`
  already sorts docs last, but relying on that would make the doc turn's
  context depend on how the caller happened to sort the plan. A separate pass
  makes "the doc sees the finished work" true by construction — and the outcome
  it is given names failures explicitly, because a doc that records a component
  the plan failed to build is worse than no doc.
- **A declined doc is `skipped`, not `failed`.** "ARCHITECTURE.md already says
  this" is the right answer often enough that flagging it red would teach users
  to ignore the row. A submission byte-identical to the baseline is treated the
  same way — an empty diff is not a review.
- **The editor writes docs FIRST inside the apply; MCP writes them last.** They
  optimise for opposite failures on purpose. The editor has an undo group it
  can roll back, so it does the only fallible thing (disk I/O) first and rolls
  back everything if a later step throws. MCP has no rollback, so it leaves the
  doc — which names components — until those components are actually on disk.
- **`applyAuthoredPlan` is now `async`.** The doc write is real I/O and its
  drift check has to happen in preflight, before any component mutation; making
  the whole transaction async was cheaper and more honest than pretending the
  filesystem is synchronous. Component mutations remain synchronous.

**A defect this found in `docLint` itself, by running it:** the lint keyed on
catalog `typeName`s, but the editor shows `displayName`s and a model writes what
a human sees. The node the picker calls "Repeater" has the type name `For
Each`; "Array" is `Collection2`. So the first version was blind to every
restatement written in the vocabulary of the actual UI — which is all of them.
It now unions both names (179 distinctive names, verified to produce no hits on
the honest-prose fixtures).

## Traps hit

- **The editor's Electron suite runs on jasmine, and `tsc --noEmit` will not
  tell you.** `toHaveLength`, `toMatchObject` and `expect(...).rejects` all
  type-check under the root `tsc` (jest types are in scope there) and then fail
  the test-CI webpack build with `TS2339`. The gate for editor specs is
  `webpack.test-ci.js`, not `tsc`. `expectRejection` now lives in
  `tests/ai/helpers.ts` — a bare try/catch passes silently when the call
  *resolves*, which is the exact failure a "this must refuse" spec exists to
  catch.
- **The catalog's `typeName` is not what anyone writes.** The node picker shows
  `displayName`, and they differ often: "Repeater" is `For Each`, "Array" is
  `Collection2`. Any check that reads model-written prose for node names must
  union both, or it is blind to the only vocabulary a model would use.
- The noodl-mcp `tsc --noEmit` was already red on the base: 18 errors in
  `tests/*.test.ts` (jest matchers vs leaked jasmine types — `toHaveLength`,
  `objectContaining` etc.), verified by stashing this diff and re-running.
  Not introduced and not fixed here; `src/` is clean with this diff.
- A full-replacement update inherits the baseline's **connections** on the
  MCP `set` path — drop nodes without passing `connections` and the gate
  correctly rejects the now-dangling wire. The plan-tools spec documents it.
- `ToolError` codes are a closed union; there is no `unsupported` — the doc
  refusal uses `invalid-argument`.

## Verified

- `npx tsc --noEmit`: **clean** in noodl-editor; noodl-mcp `src/` clean
  (18 pre-existing test-file errors unchanged, see traps).
- `noodl-mcp` jest: **6/6 new plan specs**, full suite 45 passed / 29
  env-gated skips, 0 failures; `node build.mjs` bundle green.
- Editor Electron suite (`npm run test:ci` run directly in this worktree's
  package, not via lerna): see the CHANGELOG entry / report for the result of
  the run including the 16 new specs — criterion 4's byte-for-byte file
  comparison runs there against the real save path.

### Criterion 7 slice (2026-07-27)

- `npx tsc --noEmit`: clean in noodl-editor and in noodl-mcp `src/`.
- `noodl-mcp` jest under **node 22**: **87 passed / 0 failures** (was 84 —
  +3 plan-doc specs). Node 20 still fails the backend specs by design (RUN-004's
  loud failure); the plan and docs suites pass on both.
- Editor Electron suite: **1573 specs / 0 failures** (seed 31729). The first run
  of the same bundle showed 1 failure in `Git local tests … merge with conflicts
  in project.json` — the known seed-dependent flake, in code this slice does not
  touch, green on the re-run.
- +27 specs: `tests/ai/authoring-doc-session.test.ts` (the turn, the lint, and
  doc ops in the fan-out), `tests/ai/plan-doc-writer.test.ts` (the write path on
  **real files**: bytes land, undo restores the previous bytes, undo of a
  created doc deletes it, drift refuses, containment refuses), and three more in
  `authoring-plan-staging.test.ts` (drift refusal before any mutation, rollback
  on a failed doc write, documentation-only plans). Both new files registered in
  `tests/ai/index.ts` — the spec-barrel trap.

## Not done / for the merger

1. ~~**Criterion 7 end-to-end**~~ — **closed 2026-07-27**, see the section
   above. Residual: the doc turn has never run against a live provider, so the
   *quality* of what it writes (and how often the graph-restatement advisory
   actually fires on a real model) is unmeasured.
2. **Criterion 1 and general plan *quality*** — needs a live provider run
   (does "wire Checkout in" plan the Cart/route updates?). The planning
   prompt targets exactly this failure mode; unverified against a real model.
3. **Criterion 6 cost-corpus re-run** — needs live keys. Nothing on the
   measured path changed for standalone sessions (spec-asserted byte-stable
   opening prefix), but the numbers should be re-earned:
   `node packages/noodl-editor/scripts/aix002-measure/build.mjs && node
   packages/noodl-editor/scripts/aix002-measure/dist/aix002-harness.cjs
   --provider=anthropic --model=claude-sonnet-5`. Pre-existing baseline
   (AIX-007 notes): 8/8 first-attempt, ~$0.0352/component, 2.25 turns,
   ~16 s at effort `low`.
4. **Live editor smoke** of the panel flow (toggle → plan → prune → author →
   review → apply → single undo) — worktree agents cannot drive the editor
   meaningfully (lerna runs the main checkout); one CDP session post-merge.
5. **Plan-scope telemetry** — deliberately not added; the AIX-002 telemetry
   event vocabulary is enum-frozen and extending it deserves its own thought.
6. Switching the panel's scope toggle mid-run disposes an in-flight `PlanRun`
   (unmount cleanup) — acceptable v1 behaviour, worth a second look with UX
   eyes.
