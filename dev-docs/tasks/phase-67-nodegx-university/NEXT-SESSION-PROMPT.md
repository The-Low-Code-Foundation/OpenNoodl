# Phase 67 — next session prompt

Paste the block below into a fresh session.

---

Continue phase 67 (NodeGX Community), `dev-docs/tasks/phase-67-nodegx-university/`.

**Read first, in this order:** `RULINGS.md` — the register, **D15/D16/D17 open**, and the
tool-surface entry's **two** corrections (the second corrects the first). Then §"THE SHAPE OF WHAT IS
LEFT" below, then `TASKS.md`'s task table, then whichever task file you pick.
`PRIOR-ART-RECONCILIATION.md` if you have not read it before.

---

# 🔴 THE SHAPE OF WHAT IS LEFT — read this before choosing a task

**Measured 2026-08-16, not remembered.** Phase 67 is twelve tasks. They are not twelve equal tasks,
and the phase's real bottleneck is not where the last six sessions have been working.

| Track | Tasks | State |
|---|---|---|
| **Editor / MCP** | UNI-007, UNI-010, UNI-012 | **Nearly done.** UNI-007 slices 1–5 + the tutor overlay; UNI-010 all five slices, criterion 3 run, **KEEP**; UNI-012 scoped |
| **Platform** | UNI-001, 002, 003, 004, 005, 006, 008, 009 | 🔴 **Eight tasks. ZERO commits.** |
| **Editor + bridge, needs platform** | UNI-011 | Buildable now, ships after D15/D16 |

🔴 **`The-Low-Code-Foundation/nodegx-community` has `size: 0` and no commits since it was created on
2026-08-14.** Checked with `gh api` today, not assumed. Two thirds of this phase is in a repo that
does not yet contain a single file, and **every session so far has been in the editor**, because the
editor is where the tooling and the muscle memory are.

**That is the honest read of the phase, and it is the thing to decide about.** Either the platform
track starts, or phase 67 finishes the third of itself that lives in this repo and stalls.

## ✅ Three cheap things, all measured, none of them a sitting's work

1. ✅ **The D2 repo rename DID happen** — the repo is `nodegx-community`, and **`has_pages: false`**,
   so the time-critical window (GitHub Pages does not follow a rename) is **still open and still
   safe**. Two handovers carried this as an outstanding action; it is done.
2. 🔴 **…but only half of it.** The repo **description still reads *"NodeGX University — the community
   platform…"***. D2 ruled the site is **NodeGX Community** and University is one wing of it. This is
   the phase's own recurring failure — the name moved, the sentence about the name did not — sitting
   in the one place every future contributor reads first. **One `gh repo edit` fixes it.**
3. ⚠️ **`community.nodegx.dev` is still not registered.** D2 records it as *a choice this ruling
   makes, not a fact it records*. It blocks nothing today and it blocks **UNI-001's OAuth callback
   URLs** the moment that starts. Richard's, not a session's.

## The rulings that need Richard, and they are one sitting for three

- **D15** — is the community surface shown at all to org-owned minor accounts? Recommendation on
  file: default **off**, org admin may enable **read-only**. Blocks UNI-011 shipping to an org tenant.
- **D16** — the never-empty threshold before the editor surfaces the community. Recommendation on
  file: **30 threads, three consecutive weeks with a call held, median first reply < 24h**.
- **D17** — curriculum hosting (new 2026-08-16). Recommendation on file: **part of the platform API
  under D14, GitHub Pages as v0**. Blocks distribution, not authoring.

🔴 **None of the three blocks building.** Do not wait on them to start work; do put them in front of
Richard, because D15 and D16 decide what UNI-011 is allowed to *ship*, and finding that out after
building it is the expensive order.

---

# What to do next — pick a lane and say which

**LANE A — start the platform.** The biggest lever in the phase, and the one nothing else can
substitute for. `TASKS.md`'s suggested order is already ruled: **UNI-001 + UNI-009 (minimal cut) land
together**, because *"a login with nothing behind it is a broken promise"* — the account must open
onto replays, a tutorials index, and a forum on day one, and Discourse-with-SSO is **bought, not
built**. D1 fixes the stack: **Next.js + Postgres + Drizzle, Docker on Hetzner**. ⚠️ Different repo,
so none of this checkout's gates or traps apply — and the two binding principles are acceptance
criteria in every task: **the login gates nothing in the editor, ever**; **monetisation is
services/convenience/matchmaking, never features**.

**LANE B — finish the editor track.** Three items, all in this repo:

1. **UNI-012**, with a packaged build budgeted. Skipped twice now for a stated reason: its own §5
   wants a checkout nobody is mid-drive on, and **2026-08-16 had 18 live peer sessions** plus a
   running `noodl-preview`. ✅ Two packaged apps exist to read the `extraResources` layout from —
   `/Applications/NodeGX.app` and `packages/noodl-editor/dist/mac-arm64/NodeGX.app` — 🔴 **both dated
   Aug 13, so both predate CN-001 and CN-003**: they show the pattern, never today's code.
2. **TUTOR-BOUNDARY §5's adversarial run** — the acceptance the tutor overlay does not have. Six
   attacks, all needing a **live provider**. §6 also asks for AIX-004's deferred register/accuracy
   tuning to be done *with the overlay in place*, so the two are one sitting.
3. **UNI-011's build** — unblocked, ships after D15/D16. 🔴 The renderer is `nodeIntegration: true`
   **and so is the launcher** (same `BrowserWindow`): **no post body may render as HTML in it**. Pick
   the `<webview>` island or raw-markdown-plus-sanitiser and **prove the boundary with a known-BAD
   corpus**, not a clean one.

**My recommendation: A, and put D15/D16/D17 in front of Richard in the same message.** Lane B is
three sittings of real work that leaves the phase exactly as blocked as it is now. The empty repo is
the phase.

---

## What happened on 2026-08-16 (thirteenth session)

Three commits: **`bc261f75`** (the disclosure hole), **`51cff411`** (UNI-007's tutor overlay + D17 +
the CURRICULUM-DESIGN correction), **`afc29513`** (this handover's first version).

### ✅ The disclosure hole — the previous handover's item 1, closed in an hour

`toolDisclosure.test.ts` now carries **"no deferred group reaches `tools/list`, derived from the
manifest"**: every non-resident group's tools asserted absent in both write modes, plus the mirror
(every resident tool that *exists* in that mode is advertised) so it cannot pass by the surface
collapsing.

🔴 **The control bit — and corrected the premise it was written from.** Moving `registerLessonTools`
after `applyPolicy` fails the new spec naming all four lesson tools, while **the hand-listed test
still passes** (which is what makes the gap one of *class*, not coverage). But **the budget test
fails too, at 9,256 tokens** — and so does one escaped `get_import_report`, at **8,487**.

⚠️ **The arithmetic, measured:** the bar has **57 tokens** of headroom and the **smallest of the 75
deferred tools is `seed_project_docs` at 86**. Nothing is under 57. **So today every escapee breaches
the budget**, and the old *"unless it is big enough to breach the bar on its own"* is true in form and
empty in fact. The new assertion still earns its place: the budget catches it **anonymously**
(`{tokens: 8487, tools: 21}` names nothing), and the sanctioned `$ref` fix frees far more than 86
tokens and ends the incidental catch.

⚠️ **A third control was discarded rather than counted** — escaping the `theme` group also fails the
hand-listed test, because `set_project_tokens` is one of the five names it already lists. **A probe
has to be outside the thing whose reach it is testing.**

### ✅ UNI-007's tutor lesson-context overlay — owed since 2026-07-25, built

CURRICULUM-DESIGN §9.1, *"required before L2 testing"*, specified in TUTOR-BOUNDARY §4 the whole time
and mentioned nowhere in phase 67. When the open project is a lesson, `ExplainSession` appends the
overlay to the explain system prompt. New **import-free** `explain/tutor.ts`, added to
`tsconfig.tests-main.json` beside `portCopy.ts`, so the *pedagogy* is graded in the plain-Node runner
rather than by starting Electron and reading it. **25 specs.**

🔴 **Three decisions not obvious from the diff:**

1. **A lesson being OPEN arms the boundary — not knowing the step.** With unreadable step text (a
   legacy `<!-- # -->` lesson) the overlay is still appended and still forbids completion; only the
   task line degrades. The other way round drops the boundary for exactly the lessons whose text is
   hardest to read.
2. **`CompiledLesson` carries the authored step title/body** beside the compiled HTML. Un-rendering
   the HTML to recover them would be a second reader of a format `LessonModel`'s own header says must
   have exactly one.
3. **`deep` is clamped in the session, not just hidden in the menu.** Its own instruction is *"walk
   the data flow step by step"*, which over a half-built lesson graph is §5.4's oracle extraction from
   a dropdown. A hidden menu item protects the panel; a clamp protects every caller.

🔴 **What it does NOT close, and it is the acceptance:** §5's six adversarial attacks need a live
provider and were not run. What is graded is that the overlay *says* the right things and *reaches*
the prompt. **Whether a model obeys it is unmeasured. Built ≠ verified.** ⚠️ The `ExplainSession` and
`ExplainPanel` wiring is not spec-covered either — both reach the AI client and `ProjectModel`. **A
drive is owed**, with the §5 run.

### 🔴 The D7 spec that could not fail, and only measuring found it

`SIGNAL_SENTENCE` is now exported and the tutor glossary **derives** its Signal line from it, making
CURRICULUM-DESIGN §6's prose obligation (*"if `portCopy.ts` changes, this line changes with it"*)
mechanical. My spec asserting that derivation was commented *"reword the lead and this fails"*.

**It does not.** Rewording it to *"Signal — a pulse, not a number."* left **all 25 specs green** —
both sides of the comparison move together. ✅ The same reword **fails two specs in
`tests-unit/connection-popup/portCopy.test.ts`**, which pin the sentence verbatim. So the system is
sound and the wording is guarded once where phase 60 owns it — but the comment claimed the wrong
thing and now says so.

🔴 **The general rule: a constraint discharged BY CONSTRUCTION needs no check, and any check you write
for it will be vacuous — so go and find where the VALUE is pinned.** If the answer is "nowhere", the
derivation has propagated an unguarded value everywhere.

## Gates (2026-08-16, this session)

- **`noodl-mcp` — 45 suites / 530 specs, all pass.** Baseline 45/529 re-measured at HEAD: **+1 spec.**
- **`test:main` — 212 suites / 3312 tests, 3 FAILING.** 🔴 **All three are a peer's in-flight work** —
  `fix-004/fe.spec.ts`, `fix-004/object-data.spec.ts`, `vfn-012/browser-blocks.spec.ts`, all Blockly —
  and none imports anything this session touched. ⚠️ `fe.spec.ts` **vanished between two runs ten
  minutes apart**. **Re-measure before quoting this.**
- **`tests-unit/uni-007` + `tests-unit/connection-popup` — 275 pass.**
- **`typecheck:editor` clean; `eslint` clean on all changed files.**
- ⚠️ **`tsc -p tsconfig.tests-main.json`: 31 errors, all pre-existing** — measured **both with and
  without** this session's `include` additions, identical count. None in a file touched here.
- ⚠️ **`packages/noodl-mcp` `tsc --noEmit`: 8 pre-existing errors, not the 9 the last handover
  quoted.**
- **`test:ci` NOT run.** Floor if you do: **6 failures by NAME** (4 × `AIX-006 style vocabulary`,
  2 × `AI model registry`) — never by count. 🔴 Delete `packages/noodl-editor/tests/test-results.json`
  before a run and `stat` it after.

## ⚠️ Owed, small, and honest about it

- 🔴 **The D5 recents measurement is STILL spoiled and still owed.** A session restored
  `recently_opened_project.json` before diffing the entry ids. **Next drive: diff the ids before
  restoring.** Untouched this session — everything was headless.
- ⚠️ **The five lesson bundles are still in a dead session's scratchpad.** Reproducible from
  `UNI-010-CRITERION-3-RUN.md` §2 and §7.
- ⚠️ `dev-docs/tasks/phase-65-the-library/` is **still untracked** and `MEMORY.md` links into it. One
  `git clean` from gone. Unchanged for a third session.
- ⚠️ A **`stash@{0}`** exists (`WIP on cline-dev: ff74bcc9`) belonging to no known session. 🔴 Never
  `git stash`/`pop` here. Identify it with Richard before assuming it is droppable.

## Standing constraints

- Editor work on `cline-dev`. 🔴 **Never `git stash`**; `cd` to the repo root in every git call.
  ✅ **Commit with `git commit <pathspecs>` and never stage.** ⚠️ **An untracked file is the one case
  that needs `git add`** — put the add and the commit in **one chain** with the message **already
  written to a file**. Both code commits this session did that; neither was swept.
- ⚠️ **`cd` persists between tool calls and will bite you.** A `cd` to the repo root left a later
  `npx jest` running the *root* config against `packages/noodl-editor/tests-unit/…`, failing 14 suites
  with "Cannot use import statement outside a module" — which looks exactly like a real break.
  **Put the `cd` in the same command as the run.**
- 🔴 **This checkout is SHARED and was busy** — 18 peer sessions, with active edits to
  `packages/noodl-mcp/src/server.ts` and the whole `BlocklyEditor/` directory *during* this session.
  Peer messages are for **blocking or hazardous** things only — Richard's *"curb its enthusiasm"*.
  Findings go in the task file. `test:main` and `npx jest` are plain Node and collide only with each
  other; an **editor launch** or `test:ci` still wants the announcement.
- 🔴 **`pkill -f "OpenNoodl/node_modules/electron/dist"` is NOT a way to clear a stale editor** — it
  matches MCP servers, not editors, and bypasses `sweep()`. Long-lived `noodl-mcp.cjs` Electron
  processes are **Richard's MCP servers** — never kill. Measured **39** this session.

## Things the next person will otherwise re-derive

- 🔴 **A tool registered after `disclosure.applyPolicy()` is silently resident** — now asserted, but
  registration order inside `registerLessonTools` is still load-bearing.
- 🔴 **`portCopy.ts` is import-free and now EXPORTS `SIGNAL_SENTENCE`.** Phase 60 owns that wording;
  the tutor glossary derives from it. Reword it and `portCopy.test.ts` fails — correct, and where the
  guard belongs.
- 🔴 **`tsconfig.tests-main.json`'s `include` list is the gate for the plain-Node runner.** A pure
  module not named there is not typechecked by it. Three were added this session at **zero** cost to
  its 31 pre-existing errors.
- 🔴 **`ports`, not `dynamicports`, is how a `Component Inputs` node declares its interface.**
- 🔴 **A path segment matches only at *its* level**, and the first segment is the component's **legacy
  name** (`components/__page__/Home` is named `/#__page__/Home`).
- 🔴 **`routerLists` is the ONE verb whose value is not a node path.**
- 🔴 **`forEachNode` STOPS on a truthy return.** Use a block body.
- 🔴 **`/usr/bin/grep -a`, always.** Plain `grep` here is ugrep and silently skips `.ts` as binary.
- 🔴 **The `lesson` group is DEFERRED** — first `tools/list` returns 20 tools and reveals four. A
  server spawned from the checkout
  (`node packages/noodl-mcp/dist/noodl-mcp.cjs <project> --allow-writes`) is peer-safe.
- 🔴 **A peer's source edit triggers HMR, which WIPES everything you injected over CDP.**
- `suggestedNodes` is still **dead** — no callers.
