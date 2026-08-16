# Phase 67 — next session prompt

Paste the block below into a fresh session.

---

Continue phase 67 (NodeGX Community), `dev-docs/tasks/phase-67-nodegx-university/`.

**Read first, in this order:** `RULINGS.md` — the register, **now D15/D16/D17 open**, plus the
tool-surface entry's **two** corrections (2026-08-16 morning and evening; the second corrects the
first). Then `UNI-007-THE-LESSON-BEAMED-INTO-THE-EDITOR.md` §"the tutor lesson-context overlay",
then `UNI-012-F4-ON-A-PACKAGED-INSTALL.md` (scoped, still unbuilt), then
`UNI-010-CRITERION-3-RUN.md` §8 and §12, then `TASKS.md`.
`PRIOR-ART-RECONCILIATION.md` if you have not read it before.

**🔴 The rulings queue holds D15, D16 and D17.** None blocks building; all three block shipping or
distribution. Do not re-litigate D1–D14. The four to keep in your head:

- **D2** — the platform is **NodeGX Community**; University is its learning wing. Editor button:
  **"Sign in to NodeGX"**. ⚠️ `community.nodegx.dev` is *not registered* — a choice, not a fact.
- **D5** — the Learning folder is a **visible launcher section, platform-managed**. 🔴 **The editor
  process writes it** — never a sidecar, never the platform.
- **D9** — ruled *against* the recommendation: a record-capped backend means UNI-008 holds end-user
  data. Five obligations; effort raised; still last.
- **D14** — the web is canonical, the **editor mirrors it via one API**. Bridge **editor-outbound
  only**.

## What happened on 2026-08-16 (thirteenth session)

Two commits: **`bc261f75`** (the disclosure hole) and **`51cff411`** (UNI-007's tutor overlay,
D17, and the CURRICULUM-DESIGN correction).

### ✅ The disclosure hole — the previous handover's item 1, and it closed in an hour

`toolDisclosure.test.ts` now carries **"no deferred group reaches `tools/list`, derived from the
manifest"**: every non-resident group's tools asserted absent in both write modes, plus the mirror
(every resident tool that *exists* in that mode is advertised) so it cannot pass by the surface
collapsing.

🔴 **The control bit — and corrected the premise it was written from.** Moving
`registerLessonTools` after `applyPolicy` fails the new spec naming all four lesson tools, while
**the hand-listed test still passes** (which is what makes the gap one of *class*, not coverage).
But **the budget test fails too, at 9,256 tokens** — and so does one escaped `get_import_report`, at
**8,487**.

⚠️ **The arithmetic, measured:** the bar has **57 tokens** of headroom and the **smallest of the 75
deferred tools is `seed_project_docs` at 86**. Nothing is under 57. **So today every escapee breaches
the budget**, and the old warning's *"unless it is big enough to breach the bar on its own"* is true
in form and empty in fact. The new assertion still earns its place: the budget catches it
**anonymously** (`{tokens: 8487, tools: 21}` names nothing), and the sanctioned `$ref` fix frees far
more than 86 tokens and ends the incidental catch.

⚠️ **A third control was discarded rather than counted** — escaping the `theme` group also fails the
hand-listed test, because `set_project_tokens` is one of the five names it already lists. **A probe
has to be outside the thing whose reach it is testing.**

### ✅ UNI-007's tutor lesson-context overlay — owed since 2026-07-25, built

CURRICULUM-DESIGN §9.1, *"required before L2 testing"*, specified in TUTOR-BOUNDARY §4 the whole
time and mentioned nowhere in phase 67. When the open project is a lesson, `ExplainSession` appends
the overlay to the explain system prompt.

New **import-free** `explain/tutor.ts`, added to `tsconfig.tests-main.json` beside `portCopy.ts`, so
the *pedagogy* is graded in the plain-Node runner rather than by starting Electron and reading it.
**25 specs.**

🔴 **Three decisions not obvious from the diff:**

1. **A lesson being OPEN arms the boundary — not knowing the step.** With unreadable step text (a
   legacy `<!-- # -->` lesson) the overlay is still appended and still forbids completion; only the
   task line degrades to saying so. The other way round drops the boundary for exactly the lessons
   whose text is hardest to read.
2. **`CompiledLesson` carries the authored step title/body** beside the compiled HTML. Un-rendering
   the HTML to recover them would be a second reader of a format `LessonModel`'s own header says
   must have exactly one.
3. **`deep` is clamped in the session, not just hidden in the menu.** Its own instruction is *"walk
   the data flow step by step"*, which over a half-built lesson graph is §5.4's oracle extraction
   from a dropdown. A hidden menu item protects the panel; a clamp protects every caller.

### 🔴 What UNI-007 does NOT close, and it is the acceptance

**TUTOR-BOUNDARY §5's six adversarial attacks have not been run** — direct ask, persistence, reframe,
oracle extraction, helpful-refusal scoring, false-positive check. Every one needs a **live provider**.
What is graded is that the overlay *says* the right things and *reaches* the prompt. **Whether a
model obeys it is unmeasured. Built ≠ verified.**

⚠️ The `ExplainSession` and `ExplainPanel` wiring is **not spec-covered** — both reach the AI client
and `ProjectModel`, so neither is reachable from the plain-Node runner. **A drive is owed**, and it
belongs with the §5 run, which needs a lesson open in a real editor anyway.

### 🔴 The D7 spec that could not fail, and only measuring found it

`SIGNAL_SENTENCE` is now exported and the tutor glossary **derives** its Signal line from it, making
CURRICULUM-DESIGN §6's prose obligation (*"if `portCopy.ts` changes, this line changes with it"*)
mechanical. My spec asserting that derivation was commented *"reword the lead and this fails"*.

**It does not.** Rewording it to *"Signal — a pulse, not a number."* left **all 25 specs green** —
both sides of the comparison move together. ✅ The same reword **fails two specs in
`tests-unit/connection-popup/portCopy.test.ts`**, which pin the sentence verbatim. So the system is
sound, the wording is guarded once where phase 60 owns it, and the tutor follows by construction —
but the comment claimed the wrong thing and now says so.

🔴 **The general rule, worth carrying: a constraint discharged BY CONSTRUCTION needs no check, and
any check you write for it will be vacuous — so go and find where the VALUE is pinned.** If the
answer is "nowhere", the derivation has propagated an unguarded value everywhere.

### 🟡 D17 — curriculum hosting, the other owed item, now has an owner

Not built, because it is a decision. CURRICULUM-DESIGN §9.3 recorded it as *"decision owed by
LEARN-002"* — which never ruled it, so it sat unowned for a week. Now in the register with its
**D2 / D9 / D14 intersections** written down and a recommendation (platform API under D14, GitHub
Pages as v0).

⚠️ **It is less urgent than it reads:** UNI-007 made the lesson reader **injectable**, so a lesson
already installs from a local directory with no origin to fetch from at all. It blocks
**distribution, not authoring**, and not UNI-010.

## What to do next — in the order I'd pick

**1. UNI-012, with a packaged build budgeted.** It was skipped twice now, and the reason is stated in
its own §5: it wants a checkout nobody is mid-drive on. ⚠️ **On 2026-08-16 there were 18 live peer
sessions and one running `noodl-preview`**, so it was not attempted. ✅ **Two packaged apps exist to
inspect for the layout**: `/Applications/NodeGX.app` and
`packages/noodl-editor/dist/mac-arm64/NodeGX.app` — 🔴 **both dated Aug 13, so both predate CN-001
and CN-003**; they show the `extraResources` *pattern*, never today's code.

**2. TUTOR-BOUNDARY §5's adversarial run** — the acceptance the overlay does not have. Needs a
provider and a lesson open in a real editor. §6 also asks for AIX-004's deferred register/accuracy
tuning to be done *with the overlay in place*, so the two are one session.

**3. UNI-011**, once D15/D16 are ruled. Building is unblocked; shipping is not.

**4. Platform work (UNI-001 + UNI-009 minimal cut)** — bigger, and a different repo.

## Gates (2026-08-16, this session)

Run and quoted rather than claimed.

- **`noodl-mcp` — 45 suites / 530 specs, all pass.** Baseline 45/529 re-measured at HEAD:
  **+1 spec, no new suite.**
- **`test:main` — 212 suites / 3312 tests, 3 FAILING.** 🔴 **The three are a peer's in-flight work**
  — `fix-004/fe.spec.ts`, `fix-004/object-data.spec.ts`, `vfn-012/browser-blocks.spec.ts`, all
  Blockly — and none imports anything this session touched. ⚠️ `fe.spec.ts` **vanished between two
  runs ten minutes apart**, so that tree was moving under me. **Re-measure before quoting this.**
- **`tests-unit/uni-007` + `tests-unit/connection-popup` — 275 pass.**
- **`typecheck:editor` — clean.** `eslint` — clean on all changed files.
- ⚠️ **`tsc -p tsconfig.tests-main.json` reports 31 errors, all pre-existing** — measured **both with
  and without** this session's `include` additions, identical count. None is in a file touched here.
  They live in `Icon.tsx`, `NodeGraphContext.tsx`, `UseCanvasView.ts`, `nodegrapheditor.ts` and
  `erg-005/componentContract.pending.ts`.
- ⚠️ **`packages/noodl-mcp` `tsc --noEmit` reports 8 pre-existing errors, not the 9 the last handover
  quoted.** Measured today; none in the file this session changed.
- **`test:ci` was NOT run.** Floor if you do: **6 failures by NAME** (4 × `AIX-006 style
  vocabulary`, 2 × `AI model registry`) — never by count. 🔴 Delete
  `packages/noodl-editor/tests/test-results.json` before a run and `stat` it after.

## ⚠️ Owed, small, and honest about it

- 🔴 **The D5 recents measurement is STILL spoiled and still owed.** A session restored
  `recently_opened_project.json` before diffing the entry ids. **Next drive: diff the ids before
  restoring.** Untouched this session — everything here was headless.
- ⚠️ **The five lesson bundles are still in a dead session's scratchpad.** Reproducible from
  `UNI-010-CRITERION-3-RUN.md` §2 and §7.
- ⚠️ `dev-docs/tasks/phase-65-the-library/` is **still untracked** and `MEMORY.md` links into it.
  One `git clean` from gone. Unchanged for a third session.
- ⚠️ A **`stash@{0}`** exists (`WIP on cline-dev: ff74bcc9`) belonging to no known session.
  🔴 Never `git stash`/`pop` here. Identify it with Richard before assuming it is droppable.

## Standing constraints

- Editor work on `cline-dev`. 🔴 **Never `git stash`**; `cd` to the repo root in every git call.
  ✅ **Commit with `git commit <pathspecs>` and never stage.** ⚠️ **An untracked file is the one case
  that needs `git add`** — put the add and the commit in **one chain** with the message **already
  written to a file**. Both commits this session did that and neither was swept.
- ⚠️ **`cd` does not persist the way you expect between tool calls.** A `cd` to the repo root left a
  later `npx jest` running the *root* config against `packages/noodl-editor/tests-unit/…`, which
  failed 14 suites with "Cannot use import statement outside a module" and looked like a real break.
  **Put the `cd` in the same command as the run.**
- 🔴 **This checkout is SHARED and was busy** — 18 peer sessions on 2026-08-16, with active edits to
  `packages/noodl-mcp/src/server.ts` and the whole `BlocklyEditor/` directory *during* this session.
  Peer messages are for **blocking or hazardous** things only — Richard's *"curb its enthusiasm"*.
  Findings go in the task file. `test:main` and `npx jest` are plain Node and collide only with each
  other; an **editor launch** or `test:ci` still wants the announcement.
- 🔴 **`pkill -f "OpenNoodl/node_modules/electron/dist"` is NOT a way to clear a stale editor** —
  it matches MCP servers, not editors, and bypasses `sweep()`. Long-lived `noodl-mcp.cjs` Electron
  processes are **Richard's MCP servers** — never kill. Measured **39** of them this session.

## Things the next person will otherwise re-derive

- 🔴 **A tool registered after `disclosure.applyPolicy()` is silently resident**, whatever the
  manifest says — now asserted, but registration order inside `registerLessonTools` is still
  load-bearing.
- 🔴 **`portCopy.ts` is import-free and now EXPORTS `SIGNAL_SENTENCE`.** Phase 60 owns that wording;
  the tutor glossary derives from it. Reword it and `portCopy.test.ts` fails — which is correct and
  is where the guard belongs.
- 🔴 **`tsconfig.tests-main.json`'s `include` list is the gate for the plain-Node runner.** A pure
  module not named there is not typechecked by it. Three were added this session
  (`explain/tutor.ts`, `explain/prompts.ts`, `explain/types.ts`) at **zero** cost to its 31
  pre-existing errors.
- 🔴 **`ports`, not `dynamicports`, is how a `Component Inputs` node declares its interface.**
- 🔴 **A path segment matches only at *its* level**, and the first segment is the component's
  **legacy name** (`components/__page__/Home` is named `/#__page__/Home`).
- 🔴 **`routerLists` is the ONE verb whose value is not a node path.**
- 🔴 **`forEachNode` STOPS on a truthy return.** Use a block body.
- 🔴 **`/usr/bin/grep -a`, always.** Plain `grep` here is ugrep and silently skips `.ts` as binary.
- 🔴 **The `lesson` group is DEFERRED** — first `tools/list` returns 20 tools and reveals four.
  A server spawned from the checkout
  (`node packages/noodl-mcp/dist/noodl-mcp.cjs <project> --allow-writes`) is peer-safe.
- 🔴 **A peer's source edit triggers HMR, which WIPES everything you injected over CDP.**
- `suggestedNodes` is still **dead** — no callers.
