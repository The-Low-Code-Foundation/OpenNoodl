# AIX-010 — As-Built Notes

_Executor: Opus 5, parallel worktree, 2026-07-27. One slice: the whole spec._

Point the assistant at a project someone built by hand, have it read what it can
afford, and draft the AIX-009 `docs/` set for review. The plumbing was the easy
half; the notes below are mostly about the parts where the obvious
implementation would have produced a deliverable that is worse than nothing.

---

## What shipped

All under `packages/noodl-editor/src/editor/src/models/AiAssistant/review/`
unless noted.

| Piece | Where | Role |
|---|---|---|
| Types | `types.ts` | Plain data. `ProjectReviewCoverage` is the one worth reading: it is rendered for the **model** (so it hedges) and for the **user** (so they know what the draft is worth) from one object, so the two cannot be told different stories |
| Page map | `pageMap.ts` | The page graph from what the project actually declares — Router `pages`, Page `title`/`urlPath`, navigate `target` — with per-fact provenance. See "the spec's routes premise" below |
| Selection | `selection.ts` | Which components get read in full: root → start page → pages → inbound reference count → size. A **total order**, so the same project always produces the same reads and a spec can pin them |
| Component reads | `componentReads.ts` | AIX-004's bounded read with the node-type block pulled out. The measurement that forced this is below |
| Assembly | `assembleProject.ts` | The five blocks, cheapest first, charged through `AuthoringContextBuilder`; plus the coverage record and its two renderings |
| Prompts | `prompts.ts` | Per-document job + anti-goal, the `> TODO:` requirement, and the TODO advisory. The file where this task succeeds or fails |
| Drafting turn | `ReviewDocSession.ts` | One bounded conversation per document. Reuses AIX-011's `submit_doc` tool, repair and graph-restatement advisory verbatim |
| Run | `ProjectReviewRun.ts` | Assemble once, draft three sequentially, publish progress. Holds no `ProjectModel` and writes nothing |
| Store | `ProjectReviewStore.ts` | The singleton both panels read; carries the coverage past the end of the run, and the one-shot cross-panel review request |
| Editor-side collection | `collectSources.ts` | The only module here that touches `ProjectModel`, `BackendServices` or the schema handler. Everything best-effort; nothing throws |
| Entry points | `startProjectReview.ts` | `startProjectReview` (draft) and `stageReviewDrafts` (propose). Two calls on purpose — see criterion 7 |
| Banner memory | `bannerDismissal.ts` | Per-project, permanent, in **editor** settings under `ProjectModel.id` |
| Banner | `views/panels/AiAuthoringPanel/ProjectReviewBanner.tsx` (+ `.module.scss`) | The recommendation surface, used by both panels |
| Review UI | `views/panels/AiAuthoringPanel/ProjectReviewView.tsx` | Run, progress, and the coverage summary; `ReviewCoverageSummary` is exported and reused by the Docs panel |
| MCP parity | `packages/noodl-mcp/src/tools/review.ts` | `review_project` — context, not prose |

Specs: `packages/noodl-editor/tests/ai/project-review.test.ts` (+40, registered
in `tests/ai/index.ts` — the spec-barrel trap), `noodl-mcp/tests/reviewTools.test.ts` (+8).

---

## Two places the spec's "Current state" was stale

### 1. `nodegx.routes.json` is not the page graph, and no real project has it

The spec's proposed assembly step 2 was "Routes (`nodegx.routes.json`) — the page
graph **as declared**, not inferred". The file exists and has a schema, but:

- `buildRoutesV2File` returns `null` unless `project.metadata.routes` is
  array-shaped, and it is a pure serialisation of that metadata;
- **nothing in the runtime reads it**;
- `project-examples/agent-chat` — the spec's own acceptance corpus — has
  `metadata` of exactly `{title, description}`. No routes. Neither does any other
  project in the repo.

Keying the retrofit on it would have produced an empty page map for precisely the
projects this task exists to serve. What a real project *does* declare is
authored as node parameters, and it is every bit as declarative:

```
Router     → { name, pages: { startPage, routes: [componentName…] } }
Page       → { title, urlPath }        (in the page component itself)
RouterNavigate / PageStackNavigate → { router, target }
```

`buildPageMap` reads those, uses `metadata.routes` when it happens to exist, and
records **which source each fact came from**. A page known only because its name
contains `pages/` is marked inferred and the prompt is told so, because "we
guessed from the folder name" and "the Router mounts it" deserve different
amounts of trust in a document a human is about to sign off. Run against
agent-chat it recovers all four pages, the start page, both titles and URLs, and
reports the source as declared.

### 2. Minor: the corpus has 26 node types, not 15

The spec's criterion 1 says "262 nodes, 15 node types". The node count is right;
the distinct-type count is 26.

### 3. Not fixed, worth someone's attention

`inferComponentType` (`io/ProjectExporter.ts`) classifies a page only from
`/pages/` or `%rootcomponent`. agent-chat's pages are named `/#__page__/Chat`,
so the exporter classifies all four as `visual`. Not this task's file, and the
review does not depend on it (the page map reads the graph), but anything else
relying on `inferComponentType` for page-ness is wrong on this project shape.

---

## The measurement that changed the design

The first working version called `ContextBuilder.componentContext` per selected
component — AIX-004's bounded component read, which is the right read for an
authoring turn. Against agent-chat (7 components, 262 nodes) it produced
**150,749 characters of context**, for a project small enough to read in an
afternoon. Measuring where it went:

```
component shape, nodes and connections   55,631 chars
node TYPE documentation                  94,249 chars   (63%)
```

Two things were wrong with that, and only the first is about cost:

1. The type block is re-rendered per component, so `Group` and `Text` are
   documented seven times. Hoisting and deduplicating saves ~38k.
2. **The bulk of each entry is port descriptions** — correct for an authoring
   turn, which is about to wire something up. But a review is *forbidden* from
   writing about ports, connections or node structure; that is the anti-goal the
   whole task turns on. Spending 63% of the context on the exact vocabulary the
   output must not contain is not merely wasteful, it is priming the failure.

So a review read is the same bounded assembly with the type block pulled out
(`componentReads.ts`), plus one project-level vocabulary block carrying names,
categories and summaries and **no ports at all** — "Server-Sent Events: consumes
a streaming HTTP endpoint" tells a drafter the page streams; the `messages`
port's description does not help it write a sentence about intent.

Same corpus, same selection: **150,749 → 60,791 characters**, of which the whole
node vocabulary is 4,291. And the material is now shaped like what the document
is allowed to say.

---

## Decisions worth keeping

- **A sibling assembler, not `ExplainScope = 'project'`.** `assembleContext` is a
  bounded expansion *outward from a selection* — roles, neighbour depth,
  per-node parameter caps. A project review has no selection and no centre; its
  bound is "which whole components can I afford". Same word, different algorithm;
  merging them makes a function whose options are half-meaningless in either
  mode. What *is* reused is the code that matters: every handout goes through
  `AuthoringContextBuilder`, so a review is charged, capped and logged by the
  same object an authoring turn is. There is no second budget to drift.

- **A sibling drafting session, not `DocSession`.** AIX-011's doc turn is built
  entirely around "a plan whose components have already been built", and requires
  a `PlanOutcomeEntry[]`. A retrofit has no plan and no outcome. Handing it a
  synthetic empty plan to reuse the loop would have made one function that lies
  about half its callers. The *tool* is reused verbatim (`DOC_TOOLS`,
  `SUBMIT_DOC`, `docRepairMessage`, `docAdvisoryMessage`, `docLint`) so the
  submission contract and the graph-restatement line are single-sourced. The two
  loops are now structurally similar and should converge; deferred because
  `authoring/` is another task's territory this wave.

- **Two advisory passes, neither of which can fail a usable document.** The
  AIX-006 style-advisory rule, applied twice: the graph-restatement lint, and a
  new **missing-TODO** advisory (criterion 3). A draft written from a partial
  read that is certain about everything has smoothed its guesses into facts, so
  it is asked once — and told, in the same message, exactly how much of the
  project it did not see. If the rewrite never lands, the first submission
  stands. Restatement is checked before TODOs because it is the more likely
  failure and the rewrite may add hedges anyway.

- **The coverage block goes into the prompt, not just the panel.** This is what
  makes criterion 3 achievable rather than hoped for. A model that believes it
  has seen the project writes confident prose; a model told "you read 8 of 55,
  here are the 47 you did not" writes `> TODO:`. Criteria 3 and 4 are the same
  mechanism seen from two ends.

- **Reading stops at the first refusal rather than back-filling cheap
  components.** When the budget bites part-way down the ranking, the remaining
  components are all recorded as not read, even ones that would have fitted.
  Back-filling would read cheap low-signal components while skipping expensive
  high-signal ones, producing a document weighted toward trivia. The recorded
  reason says so.

- **Drafting and staging are two calls** (`startProjectReview`,
  `stageReviewDrafts`). Criterion 7 is then a property of the code rather than of
  the prompt: producing drafts touches nothing, and staging still writes nothing
  because AIX-009's `DocProposalStore` holds proposals in memory. Rejecting is
  the absence of an accept call, at both levels.

- **Three sequential drafts, each told what the earlier ones covered.** Three
  parallel turns from one context write the same paragraph three times and the
  user reviews the same claim in three diffs. Sequential costs latency and buys a
  set of documents that behaves like a set.

- **`review_project` returns the editor's own prompt, not a copy of it.** The
  spec asked for context rather than prose so the two consumers cannot drift.
  Returning nothing at all about the anti-goals would have let an external agent
  cheerfully write a node inventory, so the tool calls `reviewSystemPrompt(kind)`
  and returns its output verbatim. If the editor's anti-goals change, the tool's
  guidance changes in the same commit.

- **The banner's dismissal is a preference, not a project fact.** Editor settings
  under `ProjectModel.id`, the same namespace side-panel widths use. Dismissing
  it does not decide for a colleague who clones the repo. Neutral accent styling,
  never amber — phase 23's palette law, and a project without docs is not in
  trouble. Accepting the drafted CONVENTIONS.md retires the banner on its own,
  because visibility keys off `hasDocs()`.

- **The banner never auto-runs, and there is exactly one path to a review nobody
  asked for: none.** `ProjectReviewView` takes `startImmediately`, set only when
  a banner click routed the user there — that click *is* the start. It is
  consumed once and guarded on no run being in flight.

---

## A defect found in someone else's code — fixed here, because it was in my path

`explain/graph.ts` opened with:

```ts
import type { ComponentModel } from '@noodl-models/componentmodel';
import type { NodeGraphNode } from '@noodl-models/nodegraphmodel';
```

Both erase at build time, so nothing was wrong with any bundle. But `tsc`
resolves them, which makes **every consumer of `explain/graph` a consumer of
`componentmodel.ts`, and through it of the entire editor and `noodl-core-ui`**.
That is invisible until something outside the editor typechecks the file: adding
the AIX-010 assembler to `noodl-mcp`'s `editor-deps` took that package from its
18 pre-existing test-file errors to **1,985**, essentially all in editor and
core-ui sources the MCP server never runs.

The adapters read six fields between them, so they are now typed structurally
against local interfaces. `ComponentModel` and `NodeGraphNode` still satisfy
them and every call site is unchanged. `noodl-mcp` is back to its 18 pre-existing
errors. This is in AIX-010's exclusive territory (`explain/**`), which is the
only reason it was fixed here rather than reported.

---

## Traps hit

- **⚠️ `npm run test:ci` exits 0 after running a fraction of the suite, in a
  worktree.** The runner reported success having started **300 of 2033
  specs**. It dies partway through the Git specs with `Error: Git could not be
  found at the expected path: <worktree>/packages/node_modules/dugite/git/bin/git`
  — `packages/node_modules` is not a git-tracked directory, so a fresh
  worktree does not have it, and dugite resolves its bundled binary relative to
  the worktree rather than to the checkout the modules were installed in. The
  Electron runner then tears down and **the shell still sees exit 0**.

  Everything after the Git specs is skipped, silently. If your new specs happen
  to sort after them, "the suite passed" means your specs never ran.

  **The remedy is one symlink**, and it belongs in worktree setup:

  ```sh
  ln -s <primary-checkout>/packages/node_modules <worktree>/packages/node_modules
  ```

  It is already in `.git/info/exclude`, so it will not show up as an untracked
  file. With it in place the same command runs the whole suite.

  **The rule: a green exit code from this suite proves nothing on its own.**
  Check the spec count, and check your own specs by name:

  ```sh
  npm run test:ci > run.log 2>&1
  grep -E "Jasmine: [0-9]+ specs, [0-9]+ failures" run.log   # expect ~2000+, 0 failures
  grep -c "spec-start" run.log
  grep "<the name of a spec you just added>" run.log
  ```

  Two things make this expensive to discover the hard way: piping the run
  through `tail` (`npm run test:ci | tail -40`) both hides the count *and*
  makes `$?` the exit code of `tail`, and the failure looks exactly like a
  slow-but-fine run right up until you count.

- **`git stash` is shared across worktrees, and concurrent agents race on it.**
  This cost real time and nearly cost another agent's work. `git stash pop` in
  this worktree returned **AIX-012's** stash, because their agent pushed one
  between my push and my pop; a later `git stash pop stash@{2}` hit a third
  agent's `cline-dev` WIP for the same reason. Recovery: `git stash store <sha>`
  restores a dropped entry byte-identically from its still-dangling commit, and
  **`git stash apply <sha>` is race-proof where any index is not**. The rule for
  the next agent: in a shared checkout, never address a stash by index, and
  prefer a scratch commit on your own branch to stashing at all.
- **eslint lints nothing in a worktree under `.claude/`.** Files inside a
  dot-directory are "ignored by default", so `npm run lint:ci` reports
  `0 errors across 0 files` and looks green while checking nothing. `--no-ignore`
  is needed. (Independently, the ratchet's `eslint packages/noodl-editor/src`
  matches only `.js` by default, and that tree is now all TypeScript — so the
  ratchet lints nothing anywhere. Pre-existing, not this task's to fix, but it
  means the lint gate currently has no teeth.)
- **`LOCAL_GIT_DIRECTORY` must point at the *main* checkout.** A worktree has no
  `node_modules`, so pointing it at the worktree root makes every git spec fail
  with "Git could not be found at the expected path".
- The `noodl-mcp` test helper's `call()` takes the **session**, not
  `session.client`.
- The editor suite is jasmine: no `toHaveLength`, no `toMatchObject`, no
  `expect(...).rejects`. These specs use `toBe`/`toEqual`/`toContain` only.

---

## Gates

| Gate | Result |
|---|---|
| `tsc -p packages/noodl-editor/tsconfig.json --noEmit` | **clean** |
| `tsc -p packages/noodl-editor/tsconfig.tests.json --noEmit` | **clean** |
| `noodl-mcp` `tsc --noEmit` | `src/` **clean**; 18 pre-existing test-file errors unchanged (verified by stashing this diff and re-running: 18 at the base too) |
| `noodl-mcp` `node build.mjs` | green, 3.8 MB |
| `noodl-mcp` jest, **node 22.22** | **66 passed / 0 failed**, 29 skipped. The 29 are `backendTools.test.ts`, gated on a built nodegx-backend CLI bundle that is absent here (`const describeOrSkip = haveBundle ? describe : describe.skip`) — environmental, identical at the base |
| Editor Electron suite (`webpack.test-ci.js` + `run-electron-tests.js --ci`, run in this worktree's package) | **1,613 specs, 14 failures** |
| eslint on the touched files (`--no-ignore --ext .ts,.tsx`) | clean |

**On the 14 editor failures: all 14 are pre-existing.** The base commit
(`4d1d1294`, this diff stashed, bundle rebuilt) produces **1,573 specs and the
same 14 failures**, name for name:

- 6 × `LIB-005 import apply path …` — `TypeError: invalid options argument`
- 4 × `Project import and export unit tests …` — same TypeError
- 4 × Git suites (`Git remote tests` ×2, `Git local tests` ×1, `Git tests - misc`
  ×1) — dugite/environment, including the known seed-dependent
  `merge with conflicts in project.json` flake

So this branch is **+40 specs, +0 failures**. The first ten look like a
node-version/`fs` options incompatibility in this environment rather than a code
defect; they are not in anything this task touches, and they are not mine to fix,
but someone should look — a suite that has been red at the base for a while is a
gate nobody can read.

---

## Criteria

| # | Criterion | Status |
|---|---|---|
| 1 | Three drafts from agent-chat; ARCHITECTURE identifies the streaming/state architecture without listing nodes | **Partly — needs a live provider.** The assembly is verified against the corpus (page map, ranking, 60,791 chars) and the graph-restatement half is enforced mechanically and spec-asserted. What the model actually writes is unmeasured |
| 2 | Backend project names real collections/fields from the extractor | **Met structurally, unverified live.** Spec-asserted that a read schema renders names and types verbatim with "do not invent fields", and that an unreadable one says so rather than "no collections". Needs a project with a live backend |
| 3 | Every uncertain claim carries `> TODO:` | **Met as far as offline can go.** Required in all three system prompts by name and example; enforced by a one-shot advisory that quotes the coverage; counted per draft and shown in the panel. Whether a real model complies is unmeasured |
| 4 | The context log shows what was read and refused, and the review UI shows it before accepting | **Met.** One `ProjectReviewCoverage` renders for both audiences; shown in the Build panel during and after the run, and **above the diff** in the Docs panel for any review proposal. Spec-asserted that a bitten budget produces recorded refusals |
| 5 | Re-running on a documented project proposes a diff, never a blind overwrite | **Met, spec-asserted on real files.** Existing bodies are fed in as baselines, the prompt frames it as an edit, and `proposeDocChange` re-reads the baseline from disk at propose time so the diff is against the real current file |
| 6 | Banner appears only without `docs/CONVENTIONS.md`, only on two surfaces, dismisses per-project across restarts | **Met in code; needs a running editor to confirm.** Keys off `hasDocs()`; rendered only in `AiAuthoringPanel` and `DocsPanel`; dismissal in `EditorSettings` under the project id, which is disk-backed |
| 7 | Rejecting all three drafts leaves the project byte-identical | **Met, mechanically, on real files.** Corpus → real `ProjectModel` → `toDirectory` → a `docs/ARCHITECTURE.md` written by a "human" → snapshot every file's bytes → run → stage → reject all → snapshot again → assert equal. Asserted at all three stages (after drafting, after staging, after rejecting) |

---

## Residuals

1. **No live-provider run.** Criteria 1, 2 and the quality half of 3 need real
   keys. Specifically unmeasured: whether the drafts avoid graph restatement
   without the advisory firing constantly, how many `> TODO:` lines a real model
   emits, and whether ARCHITECTURE.md gets the streaming/state story right on
   agent-chat. This is the same gap AIX-004 and AIX-011 recorded; it is now the
   gap for three tasks and deserves one session with keys covering all of them.
2. **No live editor pass.** A worktree agent cannot drive the editor (`lerna`
   runs the main checkout). Unverified in a running app: the banner appearing and
   dismissing across a restart (criterion 6), the Docs-panel banner's hop to the
   Build panel via `SidebarModel.switch` + the one-shot request, the coverage
   summary's layout in a 240px panel, and the three diffs in the Docs panel.
3. **Backend collection**: `collectBackendSummary` has never run against a real
   configured backend. `extractDatabaseSchemaJSON` swallows its own fetch
   failures and returns an empty list, which is why the collector downgrades
   "empty schema **and** a backend configured" to unavailable — that heuristic is
   reasoned, not observed.
4. **`ReviewDocSession` and `DocSession` should converge.** They are now two
   ~200-line loops with the same skeleton and different prompts. Not done because
   `authoring/` was another task's territory this wave; the right shape is one
   loop taking `{systemPrompt, userMessage, advisories}`.
5. **No telemetry.** Deliberately, for AIX-011's reason: the AIX-002 event
   vocabulary is enum-frozen and extending it deserves its own thought.
6. **`stash@{0}` may hold a duplicate of AIX-012's WIP** — see the stash trap
   above. Their agent appears to have popped an identical copy I created, so the
   entry I restored is probably redundant. It is byte-identical to what they had;
   worth someone confirming before it is dropped.

## Files touched outside AIX-010's exclusive territory

- `models/AiAssistant/authoring/ContextBuilder.ts` — **one method appended at the
  end of the class** (`reviewSource`), no reordering, no existing method changed.
  Explicitly permitted by the territory rules. It is never called by any
  authoring or planning path, so no cached prefix can shift.
- `models/AiAssistant/explain/graph.ts` — in my territory, but a shipped
  AIX-004 module; see the defect section.
- `packages/noodl-mcp/src/server.ts` — one import at the end of the import block,
  one registration line. Additive.
- `packages/noodl-mcp/src/editor-deps.ts` — one appended export section. Not
  named in the territory grant either way; treated as shared-additive and
  appended at the end. It also now exports `graphComponentFromFiles`, which
  `planTools.ts` currently imports by relative path — that import was left alone.
- `packages/noodl-editor/tests/ai/index.ts` — one appended `export *`.
