# Phase 67 — next session prompt

Paste the block below into a fresh session.

---

Continue phase 67 (NodeGX Community), `dev-docs/tasks/phase-67-nodegx-university/`.

**Read first, in this order:** `RULINGS.md` (thirteen rulings, **and Blocker 1's two amendments** —
the second one is from 2026-08-15 and changes what "the vocabulary rule is closed" means), then
`UNI-007-THE-LESSON-BEAMED-INTO-THE-EDITOR.md` (its header records what is built), then `TASKS.md`.
`PRIOR-ART-RECONCILIATION.md` if you have not read it before.

**🔴 The rulings queue is EMPTY. Nothing is blocked on a decision.** Do not re-litigate D1–D13 — if
one is wrong, amend `RULINGS.md` with a date and a reason. The four to keep in your head:

- **D2** — the platform is **NodeGX Community**; **NodeGX University is its learning wing**. Editor
  button: **"Sign in to NodeGX"**. ⚠️ `community.nodegx.dev` is *not registered* — a choice, not a fact.
- **D5** — the Learning folder is a **visible launcher section, platform-managed**: edit freely,
  can't rename/detach/delete, reset = re-pull. 🔴 **The editor process writes it.** ✅ **Built and
  driven 2026-08-15.**
- **D9** — 🔴 ruled *against* the recommendation: a record-capped backend means UNI-008 holds
  end-user data. Five obligations; effort raised; still last.
- **D13** — coaching delivery (**LearnBook**) is **phase 68**, platform stack, after Tier 1 + UNI-004.

## What is built (UNI-007 slices 1–3)

| Slice | What | Where |
|---|---|---|
| 1 | static two-vocabulary check | `noodl-editor/src/editor/src/models/lessonverify.ts` |
| 1 | grading runner, two engines | `.../models/lessongrading.ts` |
| 2 | engine 2's **MCP** adapter | `noodl-mcp/src/lessons/wholeSolutionGrader.ts` |
| 3a | **the Learning folder register** | `.../models/learningfolder.ts` |
| 3b | **the launcher's Learning section** | `noodl-core-ui/.../components/LearningSection/` + `.../views/projectsview.learningstate.ts` + `ProjectsPage.tsx` |

**110 tests** in `noodl-editor/tests-unit/uni-007/` (jest / `test:main`), 21 in `noodl-mcp`.
Commits: `15763dd7`, `b9664822`, **`e3aec6b6`**, **`a89ec153`**, **`6d6d067e`**, **`d2e4f91c`**.

**Criteria 2, 3 and 4 are met.** Criterion 2 was **driven in the real editor** — install refused a
bad bundle, install accepted a good one, the card appeared with no reload, reset re-pulled and
cleared the grade, and opening the lesson **did not grow the recents list** (the D5 guarantee that
would have failed silently had the opener used `LocalProjectsModel.openProjectFromFolder`).

## 🔴 This session's job — "check my work", and it is the last editor slice

**Nothing calls the grading runner. This is not an assumption — it was measured.**
`__webpack_require__` in the running renderer answers *"Cannot find module
`./src/editor/src/models/lessongrading.ts`"*: the runner is **not in the bundle at all**, because no
editor module imports it. Slice 3 gave the *register* a caller. The runner still has none.

What the slice needs:

1. **A button, in the lesson layer** (`views/lessonlayer2.ts` / `views/lessons/`), shown while a
   Learning-folder lesson is open. It runs `gradeLesson(manifest, liveLessonEvalContext(), …)`.
2. **A second, editor-side `WholeSolutionGrader` adapter.** ⚠️ `noodl-editor` has **no `@noodl/mcp`
   dependency** (verified), so the editor cannot call `noodl-mcp`'s adapter. The editor holds its
   own `SemanticValidator` and can spawn the same render CLI. **One port, one adapter per process
   that owns the machinery** — do not add the dependency.
3. **Write the grade back**: `LearningFolderModel.instance.recordGrade(id, buildLessonEvidence(…))`.
   That method works and is driven; only a test harness has ever called it.
   ⚠️ The lesson's id is on the project already — the opener sets `project.id = entry.id`.
4. 🔴 **The adapter must report `drawnElementCount`, including zero.** An adapter that stays silent
   opts itself out of the empty-page check. The count is the render harness's own blank rule —
   `text.elements + images.total`, aggregated across viewports with **`min`, not `sum`**.

Then: **UNI-010** is genuinely runnable end to end with no account, and it is cheap.

## 🔴 The finding that should change how you check things

Blocker 1 has now been amended **twice**, and the two amendments were found by different methods.

- **First** (08-14): the recorded "nine divergences" was **103 plain, 4 ambiguous, and a class of 6
  nobody had written down** — *shadowed* names like `Variable`, where the string IS a real type so
  `hasType()` passes, but it names the **deprecated** node. Found by **re-deriving from the catalog
  instead of re-verifying the list**.
- **Second** (08-15): the shipped check had a hole. `typeNamesInPath` correctly drops the first path
  segment, because it is a **component name** — so a path written `%Group` contained *nothing the
  check looked at* and passed in silence, while never matching at runtime. Same silent failure, a
  different route in. And separately, a lesson body naming `javascript:` compiled into a live anchor
  inside a **node-integrated renderer**. Found by **building the check's caller.**

**The method, because it is now three for three: a check read on its own terms looks complete. Give
it a caller, or re-derive it from source, and it shows you what it does not do.**

## Standing constraints

- Editor work on `cline-dev`. 🔴 **Never `git stash`**; `cd` to the repo root in every git call;
  **explicit pathspecs**.
- 🔴 **Check for a sibling before any suite or editor run:**
  `ps aux | grep -e electron -e run-electron-tests`. Three long-lived `noodl-mcp.cjs` Electron
  processes are Richard's MCP servers, not a test run — don't kill them.
  ⚠️ **Coordinate over `SendMessage`** — a phase-66 session was live in worktrees all through
  2026-08-15 and the protocol (announce before `test:main` / `test:ci` / an editor launch, and
  again after) worked well. `ListAgents` finds them.
- Gates: `npx tsc -p tsconfig.json --noEmit` (**never** without `--noEmit`), `test:main`, `test:ci`
  (read `tests/test-results.json`, **check its mtime**), `npm run lint:ci`, `cloud-library:check`.
- ⚠️ `npx tsc -p packages/noodl-core-ui --noEmit` is **44 errors and known-red** — all path-alias
  failures in *editor* files, none in core-ui itself. Two sessions read 44 independently on 08-15.
  It is not a gate. Nor is eslint on core-ui: `npm run lint` covers `packages/noodl-editor/src`
  only, and core-ui's own eslint config **cannot even load** (`react-app` missing).
- A new **electron-suite** spec not exported from `tests/.../index.ts` never runs. A **`tests-unit/`**
  spec needs no barrel — jest finds it by `testMatch`.

## Driving the launcher — recipes that worked on 08-15

- Reach any editor module over CDP:
  ```js
  window.webpackChunknoodl_editor.push([['probe'], {}, (req) => { window.__wreq = req; }]);
  window.__wreq('./src/editor/src/models/learningfolder.ts')
  ```
  Module ids are **source paths**. ⚠️ A module nothing imports is **not in the bundle** and this
  throws — which is itself a useful measurement, and how "nothing calls the runner" was established.
- 🔴 **A React state change is invisible in the SAME eval.** Writing to the register and reading the
  card back in one `eval` returned the **old** DOM; a second eval showed the new one. Already
  recorded for theme flips and `selectNode` — it is general to *any* React state write, not a
  dialog quirk.
- `window.confirm` blocks the renderer. Stub it (`window.confirm = () => true`) before clicking
  anything destructive.
- The launcher's own test hooks: `[data-test=launcher-learning-section]`,
  `learning-card-<id>`, `learning-open`, `learning-reset`, `learning-install`, `learning-score`,
  `learning-check-unavailable`, `learning-empty`, `learning-missing`.

---

## Where this session left things (2026-08-15, sixth session)

Three commits on `cline-dev`, all gated.

| Gate | Result |
|---|---|
| `npx tsc -p tsconfig.json --noEmit` (editor) | ✅ exit 0 |
| `npm run test:main` | ✅ **193 suites / 2990 tests, zero failures** (was 190/2932) |
| `npm run lint:ci` | ✅ 877 vs a 3916 baseline — **unmoved** |
| `npx eslint` (every touched editor file) | ✅ 0 |
| **live drive** of the Learning section | ✅ install-refuse, install, card, grade, reset, open, recents-unchanged |
| `npm run test:ci` | ⚠️ **NOT RUN — see below** |

🔴 **`test:ci` was not run *by this session*, deliberately** — a phase-66 session was building three
lanes in worktrees all day and needed the primary checkout settled for its own run; two concurrent
runs would have manufactured failures for both.

⚠️ **A run was IN FLIGHT when this was written, and this document does not know how it ended.**
Phase 66 merged FIX-002 + FIX-003 to `cline-dev` as **`4bb692a8`**, on top of this session's
`481454be`, and started `test:ci` on that settled tree. Because `test:ci` webpacks from the working
tree, **that run covers this session's six commits as well as their two lanes.**

🔴 **The first of those runs graded NOTHING, and it is the most convincing false pass this repo has
produced.** Recorded in full because every heuristic we had failed:

> `test:ci` exited **0**. `test-results.json` said `totalCount: 2779`, `failedCount: 6`, **the exact
> six floor names**, `seed 81235`. Count, names *and* seed all agreed it was a clean baseline run.
> **The mtime was still Aug 14 23:19** — it was the previous run's file, untouched. The suite never
> started, because `test:ci` is `webpack && run-electron-tests` and **the webpack step failed**
> (a `{/* comment */}` placed between `return (` and the root element parses as an object literal).
> Fixed as `fb936f6d`.

⚠️ **So "compare the names, not the count" is not sufficient advice, and neither is the seed.** Those
are checks on the file's *content*, and the content was a real, correct, previous measurement — of
the floor, which is exactly the thing most likely to be sitting there. 🔴 **Only freshness dissents.**

**Before believing any `test:ci` number: delete `packages/noodl-editor/tests/test-results.json`
first, or `stat` it and note the mtime. Exit 0 with an unchanged mtime is what a broken BUILD looks
like here — not what a pass looks like.** Then, and only then:

- **Floor** = `totalCount` 2779, 6 failures, names 4 × `AIX-006 style vocabulary` + 2 ×
  `AI model registry`. A count of 6 with a *different* name is a regression wearing the baseline's
  clothes.
- If a failing spec name greps to **nothing** in `packages/noodl-editor/tests/`, you measured a
  **stale bundle** — a different failure from the seed-order `BEN-001` cluster, and re-running does
  not fix it.

⚠️ **And the reason nothing else caught it is worth carrying:** a **`.jsx`** file is read by no
typecheck (`tsc` skips it) and by no jest run unless a spec imports it. `test:ci`'s webpack is its
only gate. After editing a `.jsx`, a green `test:main` and a clean `tsc` prove nothing at all.

✅ **The `user-select` question is closed.** FIX-003's opt-out originally enumerated the *projects*
grid only, which would have left the two card grids disagreeing about text selection. Phase 66 added
the line to `LearningSection.module.scss`'s `.Grid` in the merge (`f2d7d2d4`), **per grid rather than
hoisted to `Projects.module.scss`'s `.Main`** — because `.Main` also wraps the welcome copy and the
no-results message, and a container-level `user-select: none` there would re-break exactly the prose
FIX-003 exists to liberate. 🔴 **A new card section must opt its own grid out**, and must never write
`div { user-select: text }`, which punches through every container-level `none`.

⚠️ Their pre-merge reading of editor jest on the merged tree was **195 suites / 3005 tests**
(+2 suites / +15 tests over this session's 193/2990). If a later run comes in *below* that, tests
vanished rather than passed.

### What was built, in one paragraph each

**`learningfolder.ts`** is the register: install, reset, `recordProgress`, `recordGrade`, `list`.
It is a **second store**, not a flag on `recentProjects`, because a flag would have put lesson
projects where `renameProject` and `removeProject` already exist and are already wired to the card
menu — every one of those sites would need a guard, and a rule enforced at N sites is broken at N+1.
The verifier is the **install gate** (warnings do not block). 🔴 **Reset checks the source before it
deletes anything** — delete-then-fail loses the learner's work *and* the lesson, which is strictly
worse than what reset was pressed to repair. Ports are injected behind a lazy `require`, so it
imports in a plain-Node runner.

**The launcher section** renders on the Projects page (POL-002 removed the Learn tab, so there is no
other visible surface). No rename, no delete, no kebab. Progress and score are **two numbers** — you
can be on the last step and failing three graded ones. 🔴 **A recorded grade decides completion and
step progress never does**; a card inferring "Completed" from 100% progress would be a second,
weaker completion rule beside `buildLessonEvidence().complete`. "The check didn't run" is its own
state and never a failure.

**Provenance is the caller's word, never the manifest's** — a bundle declaring itself `curated`
would be believed, and this format explicitly invites an agent on the user's own machine as a
producer. Hence the fourth value **`local`**: "installed from a folder you pointed us at".

### Two decisions that were reversed on purpose, so they are not re-reversed

1. **The empty section renders.** "Never show an empty shelf" is right for a shelf only a sign-in
   can fill. It is **wrong** once a lesson installs from a folder with no account, because then the
   empty state is the only place that route is discoverable. The test is the presence of an install
   handler, not the count, and the copy names no platform.
2. **`unavailable` does not force `rendered: false`** (inherited from slice 2, still load-bearing).
   Observation fields report what their own half saw; the safety property is enforced **once**, on
   the decision that consumes them.

### Small things worth one line each

- ⚠️ **A lesson's title and its project's name can disagree** — the card said "State on a page", the
  editor titlebar said the project's own name. The opener sets `project.name` only when the project
  has none, deliberately: forcing it would write into the learner's project on open. The right fix
  is the lesson layer showing the lesson title.
- ⚠️ **The static check cannot catch path *depth*.** The drive's own lesson said
  `/#__page__/Home:%Text` where the `Text` sits under a `Page`; well-formed, well-spelt, and false.
  The verifier has no project. That is engine 1's job to reveal.
- `suggestedNodes` is still **dead** — `LessonModel.getCurrentSuggestedNodes()` has no callers, and
  the verifier deliberately does not check it. Whoever wires it to the node picker decides which
  vocabulary it wants and adds it to the check in the same change.
- ⚠️ **Two owed items phase 67 still does not carry**, both CURRICULUM-DESIGN §11 and both landing
  on UNI-007: **curriculum hosting** (§9.3) and the **tutor lesson-context overlay** (§9.1,
  *"required before L2 testing"*).

### 🔴 Uncommitted / untracked when this was written

- `dev-docs/tasks/phase-65-the-library/` is **untracked** and `MEMORY.md` links into it. It is not
  this phase's and was left alone — **but an untracked directory a memory index points at is one
  `git clean` from gone.** Somebody should commit it.
