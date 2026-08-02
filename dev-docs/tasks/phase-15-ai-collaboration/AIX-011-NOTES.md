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

---

## The two live residuals, closed (2026-08-02)

`claude-sonnet-5`, effort `low`. Artifacts under
`measurements/live/`: `update.jsonl` and `update/app-start-page.*` (the fixed
runs), `update-app-before-fix.jsonl` (the failure, reproduced deliberately),
`plan-docs.jsonl` + `plan-docs/` and `plan-docs-run2.jsonl` + `plan-docs-run2/`
(the plans, every candidate, and both halves of each authored document).
**$2.64 of API spend**, itemised at the bottom.

Both residuals turned out to be the same defect wearing two masks: **an update
session was judged against a standard its own subject does not meet.** Neither
is about the model.

### 1. `update /App` — the mechanism, not a hypothesis

`/App` is the one component of the corpus project's 44 whose `project.json`
entry has **no `id`**. `buildComponentV2Files` copies `component.id` through
verbatim, so the base's `component.json` has no id either; `buildCandidate`
then spread that base through `JSON.parse(JSON.stringify(…))`, which drops an
`undefined` key entirely. Every candidate therefore failed the *structural*
check on

```
SCHEMA component.json /: must have required property 'id'
```

— a field `submit_component` does not have and the agent cannot supply. Four
submissions, four identical rejections, `exhausted`. It could never have
converged, and no amount of re-running would have looked any different.

Reproduced deterministically before spending anything: a **perfect
resubmission** — the candidate a model produces by copying the component back
verbatim — fails the same way. If that cannot pass, nothing can.

Then reproduced live, with the fix backed out, to see it end to end:

```
✗ submit rejected (1 problem(s))
    SCHEMA component.json /: must have required property 'id'
    … ×4
[authoring] /App → exhausted — 4 turns, 4 submits          $0.16
```

which is the live pass's "exhausted after four submits", exactly.

**Fix:** `buildCandidate` backfills `component.id` from the id it already mints
for the nodes/connections files, so the candidate is self-consistent. The
component's identity was never the agent's to supply.

**After (three consecutive runs, `--mode=update --only=app-start-page`):**
`authored` 3/3, **first attempt every time**, 14/14 base node ids kept,
$0.045 / $0.037 / $0.037. The candidate changed exactly one parameter on
exactly one node: the Router's `pages.startPage`. `pages.routes` — the routing
"the agent cannot see" the residual worried about — came back intact.

Two notes for whoever touches this next:

- The id-less component is **legacy-shaped, not exotic**: `ComponentModel` only
  mints an id on import (`rekeyAllIds`), and 19 of the repo's test-fixture
  projects have components without one. Applying an AI update to such a
  component now writes an id into `project.json`, which is a repair, not a
  side effect — but it is a write that was not there before.
- `buildComponentV2Files` still exports an id-less component to an
  id-less `component.json`. That is the exporter's problem rather than the
  authoring loop's, and it is untouched here. Filed, not fixed.

### 2. The defect the /App hunt found: silent retyping of module nodes

Running the same question against the *other* update in both live plans turned
up something worse than a failed session. `/Visual Components/Article/Article`
holds four module-provided nodes — three `Markdown`, one `module.inlineHtml` —
whose types the catalog does not carry. Strict validation reported all four as
`unknown-node-type` **errors on the agent's candidate**, and the agent, told to
take diagnostics literally and never argue with one, did the only thing that
satisfies them:

```
RETYPED de810a44… module.inlineHtml -> Text
RETYPED 4d325072… Markdown          -> Text
RETYPED 1f7b0595… Markdown          -> Text
RETYPED b22047aa… Markdown          -> Text
```

Both live plan runs did it, identically. And because the ids were kept, this
scored as a **100%-ids-kept clean revision** and renders in the diff as four
*modified* nodes rather than four deletions. The metric that was supposed to
prove an update is reviewable was the thing hiding it.

**Fix:** `validateCandidateComponent` takes an optional `baseline` (update mode
passes the base files). Error-severity diagnostics whose `code | nodeId | port |
message` is *identical* to one the base already produces move from `errors` to
`preExisting`: reported to the agent and to the reviewer, never charged. A NEW
unknown type on a new node still blocks — spec-asserted, because a blanket
amnesty per component would be a different and much worse change. The update
prompt now also says these types are real and must come back verbatim.

**After, live:** `Article` in the plan-docs run came back 29/29 ids kept, **0
retyped**, all three `Markdown` and the `module.inlineHtml` intact, with three
new nodes for the save control.

Both accept paths (`AiAuthoringPanel.acceptFiles`, `ProjectAuthoringView`'s
pre-apply re-validation) pass the same baseline. Without that, a candidate the
loop accepted would have been refused at apply — the fix would have moved the
failure rather than removed it.

### 3. Criterion 7's doc turn — why there was never a sample

Not editorial. **Mechanical.** The planning system prompt permits a doc
operation "only when the project's docs are listed in the overview material" —
and nothing ever listed them: `PlanningSession` built its context builder with
no docs at all, and `projectOverview()` names components and nothing else. The
condition for planning a doc operation was one the product could not satisfy,
in the harness *and in the editor panel*. The panel's write path, baseline
reader and `includeDocs` plumbing were all already correct; the planner simply
never asked.

`PlanningSession` now takes `projectDocs` (defaulting to the same installed
provider `AuthoringSession` uses, so the panel needed no change) and
`ContextBuilder.docsOverview()` lists the docs the project actually has —
paths and purposes, never bodies.

**Result — two runs, two plans, a doc operation in both.** New harness mode
`--mode=plan-docs`: same plan path, against a project treated as having a
human-written `docs/ARCHITECTURE.md`.

| Run | Ops | Component ops staged | Doc | Cost |
| --- | --- | --- | --- | --- |
| 1 | 7 (1 doc) | 6/6 | `docs/ARCHITECTURE.md`, 1690 chars | $0.83 |
| 2 | 6 (1 doc) | 4/5 (`Pages/Saved` exhausted — see §4) | `docs/ARCHITECTURE.md`, 1862 chars | $1.53 |

**Is what it writes any good?** Yes, and specifically in the way the design
line asks for. Both revisions are **pure additions** — every line of the
human's prose survives byte-identical, including the rejected alternative about
caching Contentful articles. Neither restates the graph: no node types, no
wiring, no counts. What they add is the decision the user asked to have written
down:

> The Contentful `articleId` is the one and only identifier used to relate
> reader-generated records to an article — ratings, comments, and now
> `SavedArticle` (keyed by `userId` + `articleId`) all reuse it. Do not
> introduce a second way of identifying an article […]

Run 2 did something a fixture could not have: `Pages/Saved` failed its session,
and the doc **recorded the failure** rather than describing the app it was
asked for —

> A nav entry to a "Saved" page has been added, gated by `Is user logged in?`,
> but the page itself does not exist yet — the entry currently has nowhere to
> route to.

That is `PlanRun`'s "the doc turn sees what the fan-out actually built,
including what it failed to build", working against a real model. Measured
rather than eyeballed: run 2's revision kept **22 of 22** non-blank baseline
lines.

**`docLint` on real output: no false positives, and no true positive either.**
Zero findings on both authored docs — and zero across **all 20** live-authored
markdown files in `measurements/live/` (the AIX-010 review's three drafts, the
scoping documents, the Explain answers). Reading them, that is the right
answer: none of them contains a restating sentence. The lint's positive path is
spec-covered (`authoring-doc-session.test.ts`) but has still never fired on
live output, so "the advisory works in anger" remains unverified — it is now
unverified for the encouraging reason rather than the alarming one.

### 4. Recorded, not fixed: a create session that reads until it cannot build

`plan-docs` run 2's `Pages/Saved` operation went **11 turns, 0 submissions**,
`exhausted`, at **117,167 of the 120,000-character context budget** — and cost
most of that run's $1.51. It never submitted anything at all; it spent the
whole round reading. The same operation in run 1 authored on its first
submission at 109k chars, so this is the same session shape landing either side
of a line.

Two things follow, neither of them addressed here:

- A page created inside a plan is the most context-hungry operation there is —
  it carries the plan block, the catalog, the style vocabulary and several
  component reads — and the budget refusal (`BUDGET_REFUSAL`) arrives as prose
  in a tool result rather than as anything that changes the model's strategy.
- A single operation can therefore cost more than the other five put together
  while producing nothing. The panel still says nothing about what a plan will
  cost; the live pass's "a five-operation plan is a ~$0.90 action" is now
  better read as "$0.8–$1.5, with the variance concentrated in the sessions
  that fail".

### Gates

- `npx tsc --noEmit` in `packages/noodl-editor`: clean.
- `webpack.test-ci.js`: compiled successfully.
- Editor Electron suite: **2024 specs / 0 failures** (seed 18722), all seven
  new specs among them.
- +5 specs `tests/ai/authoring-update-baseline.test.ts` (registered in
  `tests/ai/index.ts` — the spec-barrel trap), +2 in `authoring-plan.test.ts`
  for the planner's docs block.

Two environment traps cost real time and are worth writing down for the next
worktree agent:

- **`packages/node_modules/dugite` does not exist in a fresh worktree**, so
  every Git spec dies on "Git could not be found at the expected path". A
  symlink to the primary checkout's copy fixes it; without it the suite is not
  a gate, it is a partial.
- **A sibling session's cleanup can kill your gate.** Another agent was running
  `pkill -f "webpack-cli --config=webpackconfigs/webpack.test-ci.js"` and
  `pkill -f run-electron-tests`, which matches *any* worktree's processes, not
  just its own. Three of my runs died at exit 144 mid-suite and looked like
  crashes. Invoking the build through a differently-named config, and launching
  `Electron test.js --ci` directly rather than through `run-electron-tests.js`,
  dodges both patterns.

### Spend

| Run | $ |
| --- | --- |
| `update /App` ×3 (after the fix) | 0.12 |
| `update /App` ×1 (fix backed out, to see the failure end to end) | 0.16 |
| `plan-docs` run 1 | 0.83 |
| `plan-docs` run 2 | 1.53 |
| **Total** | **$2.64** |

### One stale line in the reproduce instructions

`LIVE-PROVIDER-PASS.md` documents

```bash
node packages/noodl-editor/scripts/aix15-live/dist/aix15-harness.cjs --mode=plan
```

Without `--model=`, that errors immediately with *"No model specified for the
Anthropic provider"*: the registry default resolves through `EditorSettings`,
which the harness bundle stubs. Every run in this pass passed
`--model=claude-sonnet-5` explicitly. Costs nothing but a confusing minute.
