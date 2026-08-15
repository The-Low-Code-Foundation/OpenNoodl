# Phase 67 — next session prompt

Paste the block below into a fresh session.

---

Continue phase 67 (NodeGX Community), `dev-docs/tasks/phase-67-nodegx-university/`.

**Read first, in this order:** `RULINGS.md` (thirteen rulings, **and Blocker 1's three amendments** —
the third is from 2026-08-15 and is about *drives*, not about the vocabulary rule), then
`UNI-007-THE-LESSON-BEAMED-INTO-THE-EDITOR.md` (its header records what is built **and driven**),
then `TASKS.md`. `PRIOR-ART-RECONCILIATION.md` if you have not read it before.

**🔴 The rulings queue is EMPTY. Nothing is blocked on a decision.** Do not re-litigate D1–D13 — if
one is wrong, amend `RULINGS.md` with a date and a reason. The four to keep in your head:

- **D2** — the platform is **NodeGX Community**; **NodeGX University is its learning wing**. Editor
  button: **"Sign in to NodeGX"**. ⚠️ `community.nodegx.dev` is *not registered* — a choice, not a fact.
- **D5** — the Learning folder is a **visible launcher section, platform-managed**: edit freely,
  can't rename/detach/delete, reset = re-pull. 🔴 **The editor process writes it.**
- **D9** — 🔴 ruled *against* the recommendation: a record-capped backend means UNI-008 holds
  end-user data. Five obligations; effort raised; still last.
- **D13** — coaching delivery (**LearnBook**) is **phase 68**, platform stack, after Tier 1 + UNI-004.

## 🎉 UNI-007's editor arc is COMPLETE — slices 1–4 built and driven

| Slice | What | Where |
|---|---|---|
| 1 | static two-vocabulary check + the grading runner (two engines) | `models/lessonverify.ts`, `models/lessongrading.ts` |
| 2 | engine 2's **MCP/sidecar** adapter | `noodl-mcp/src/lessons/wholeSolutionGrader.ts` |
| 3 | the **Learning folder** register + the launcher's Learning section | `models/learningfolder.ts`, `noodl-core-ui/.../LearningSection/` |
| 4 | **"check my work"**, engine 2's **editor** adapter, and the lesson layer that was never attached | `models/lessoncheck.ts`, `models/lessonwholesolution{,.live}.ts`, `models/lessondrawncount.ts`, `models/learninglesson.ts` |

**162 tests** in `noodl-editor/tests-unit/uni-007/` (jest / `test:main`), 21 in `noodl-mcp`.
Slice-4 commits: `61d4a6d7`, `c0d04bba`, `c38fcb7b`, `47fa6040`, `393ec7bf`, docs `efa93693`, `06808c67`.

**Criteria 2, 3 and 4 are met and DRIVEN.** Criterion 5 (the full loop through UNI-002's points
event) needs the platform. Criterion 1 (intake → path) is platform work and not started.

## 🔴 What slice 4 found, because it is the thing to carry forward

**A Learning-folder lesson had no lesson layer at all.** `EditorPage` attaches one only when
`ProjectModel.instance.isLesson()` — `project.lesson !== undefined` — and the only code that had
ever set that field is the hosted-zip path. So every lesson slice 3 installed opened as an ordinary
project: no steps, no instructions, nothing to grade against.

**Slice 3's live drive had passed over it**, because it verified that the project opened and that
recents did not grow — both true, both what it set out to check, neither of them *"can this lesson
be taught"*. Hence the rule now in `RULINGS.md`:

> **A drive proves what it measured, and what it measured is a choice you made before you knew what
> was broken.** Write the consequence list *first*, and if a sentence could also be true of a broken
> feature, it is the wrong sentence.

✅ **Applied forward the same day, and it paid.** Slice 4 drove ten consequences. **Nine held; one
failed** — *"reopen and it resumes on the step you left"* was true of the code and false through the
UI, because the index rode on `ProjectModel.toJSON`, which persists **only on save**, and a learner
reading instructions never saves. Fixed to read the register (`393ec7bf`) and re-driven.
🔴 **It was the cheapest-looking line on the list.** *The criterion you would drop is the one
carrying the assumption.*

## What to do next — three options, in the order I'd pick them

**1. UNI-010 (the experiment) — cheapest, and everything it needs now exists.** The user's own Claude
authors a bundle, it installs with no account, opens with a lesson layer, and grades. The whole arc
is real today. Its verifier is shared, its criteria are pre-registered, and it needs no platform.

**2. The two owed items UNI-007 still does not carry**, both CURRICULUM-DESIGN §11: **curriculum
hosting** (§9.3 — now partly a D2/D9 question) and the **tutor lesson-context overlay**
(§9.1, *"required before L2 testing"*).

**3. Platform work (UNI-001 + UNI-009 minimal cut)** — the account and something behind it. Bigger,
and it is a different repo.

## ⚠️ Owed, small, and honest about it

- ✅ **`test:ci` is DISCHARGED, decisively — 6 at a pinned seed.** Nothing is owed.
  ✅ **You can pin the seed: `NOODL_SPEC_SEED=39393 npm run test:ci`** (`tests/SpecRunner.html:41-42`).
  On this tree that returns **6 failures, the exact floor names, zero `BEN-001`** — so slice 4
  perturbs nothing. The same four commits gave **9** at seeds 50405 and 73375, with **different**
  `BEN-001` members each time, which is the documented order-dependent cluster.
- **`noodl-mcp/dist` was rebuilt** (gitignored) but 🔴 **Richard's four live `noodl-mcp.cjs` servers
  still run the old build** — restarting them is his call, not a session's. Note also that a running
  server may load `/Applications/…` rather than the checkout, in which case reaching it needs a
  **repackage**, not `npm run build`.
- ⚠️ `dev-docs/tasks/phase-65-the-library/` is **still untracked** and `MEMORY.md` links into it.
  One `git clean` from gone. Somebody should commit it.
- ⚠️ A **`stash@{0}`** exists in this checkout (`WIP on cline-dev: ff74bcc9`) that belongs to no
  session in today's conversations. 🔴 Never `git stash`/`pop` here. It should be identified with
  Richard before anyone assumes it is droppable.
- ⚠️ `MEMORY.md` is at the edge of its read limit and **several sessions append to it concurrently**
  — a compaction pass will race unless you check for live peers first.

## Gates as they stand

| Gate | Result |
|---|---|
| `npx tsc -p tsconfig.json --noEmit` (editor) | ✅ exit 0 |
| `npx tsc --noEmit` (`noodl-mcp`) | ✅ clean in `src/` (its `tests/` has 7 **pre-existing** errors) |
| `npm run test:main` | ✅ **199 suites / 3072 tests, 0 failures** — 🔴 **new floor** |
| `npm run lint:ci` | ✅ **877** vs a 3916 baseline — unmoved |
| `npx jest` in `noodl-mcp` | ✅ 21/21 on the engine-2 adapter after the shared-rule refactor |
| **live drive** | ✅ 10 consequences, 1 failed → fixed → re-driven |
| `npm run test:ci` | ✅ **6 failures at pinned seed 39393** — the floor, by name, zero `BEN-001` |

### The `test:ci` readings, in full — three runs, and the third settles it

All on `393ec7bf`, results file **deleted before each**, so freshness is *proved* rather than inferred.

| | Run 1 | Run 2 | **Run 3 — the control** |
|---|---|---|---|
| deleted → mtime | 10:16:30 → 10:28:45 | 10:49:04 → 11:00:56 | 11:05:15 → **11:16:55** |
| seed | 50405 | 73375 | **39393, PINNED** |
| result | 2779 / 9 | 2779 / 9 | **2788 / 6** |
| the 6 floor names | ✅ | ✅ | ✅ **and nothing else** |
| the extra 3 | `BEN-001 the component interface…` ×3 | `BEN-001 **the harness export**` ×3 | **none** |

✅ **Run 3 is the decisive one.** `NOODL_SPEC_SEED` pins jasmine's order, so this is the same seed
that produced 6 on a pre-slice-4 tree, run *with* slice 4 in it: **the four commits perturb nothing.**
Runs 1 and 2 support it independently — the `BEN-001` members **changed on identical code**, and a
real regression breaks the same specs every time.

🔴 **`totalCount` reads 2788, not 2779, and that is a sibling's uncommitted work, not mine.** A
phase-66 session had `tests/utils/keyboardhandler.spec.ts` (+9 specs) in the shared working tree, and
`test:ci` webpacks **the tree, not HEAD**. The committed baseline is still **2779**. Record the tree
state beside any total you quote.

⚠️ **I first reported that the runner had no seed control, and that was wrong** — see the surface
trap below.
- ⚠️ `totalCount` did not move, and that is **correct** — everything slice 4 added is in
  `tests-unit/`, which `test:main` grades and the electron suite never sees.

🔴 **Before believing any `test:ci` number: delete the results file first, or `stat` it.** Exit 0
with an unchanged mtime is what a broken **webpack** looks like here — a stale file reproduces the
floor count, the floor **names** *and* the seed, because all three check *content*.

## Standing constraints

- Editor work on `cline-dev`. 🔴 **Never `git stash`**; `cd` to the repo root in every git call
  (the Bash cwd persists and will bite you); **explicit pathspecs**.
- 🔴 **This checkout is SHARED and today had up to eight sessions live on it.** Announce over
  `SendMessage` before `test:main`, `test:ci` or an editor launch, and again after. `ListAgents`
  finds peers. The protocol caught three real cross-lane problems on 2026-08-15.
  ⚠️ **`git log` authorship separates nobody** — everyone commits as Richard. Use `ListAgents`,
  file mtimes, and process argv.
- 🔴 **`dev:stop` kills by *checkout*, so on this one it kills a peer's editor too.** Only run it
  for your own stack, and only when no peer is driving.
- ⚠️ **A different `NOODL_REMOTE_DEBUG_PORT` does not let two editors coexist** — the app takes a
  single-instance lock that ignores the port, and 8080/8574/8577 are fixed.
- Three-plus long-lived `noodl-mcp.cjs` Electron processes are **Richard's MCP servers** — never
  kill them.

## Driving recipes that worked on 2026-08-15

- Reach any editor module:
  ```js
  window.webpackChunknoodl_editor.push([['probe'], {}, (req) => { window.__wreq = req; }]);
  window.__wreq('./src/editor/src/models/lessoncheck.ts')
  ```
  Module ids are source paths. ⚠️ Re-push after a `cdp reload`. A module nothing imports is **not in
  the bundle** and this throws — which is a useful measurement in itself.
- ⚠️ `cdp eval` wraps nothing: `const x = …` twice in one session throws *"already declared"*. Wrap
  in `(()=>{ … })()`.
- 🔴 **A click CDP reports as delivered can do nothing.** `cdp click` printed
  `clicked [data-test=lesson-check-run] at 1166,715` while a `PopupLayer` modal ate it. Check
  `document.elementFromPoint(x, y)` — if it is not your element, dismiss the modal first.
- 🔴 **Keys need `Emulation.setFocusEmulationEnabled` on the *same* CDP connection**, so
  `cdp eval`/`cdp click` (one connection per command) cannot carry it. `cdp type` works regardless
  because `Input.insertText` bypasses that path — which is the trap.
- 🔴 **A React state write is invisible in the same eval.** Always read back in a second one.
- `window.confirm` blocks the renderer — stub it (`window.confirm = () => true`) before reset.
- Install a lesson without the native dialog:
  ```js
  window.__wreq('./src/editor/src/models/learningfolder.ts')
    .LearningFolderModel.instance.install({ bundleDir: '…', provenance: 'local' })
  ```
- Test hooks: `launcher-learning-section`, `learning-card-<id>`, `learning-open`, `learning-reset`,
  `learning-install`, `learning-score`, and in the lesson layer `lesson-check`, `lesson-check-run`,
  `lesson-check-summary`.
- **Drive bundles are staged** at `/tmp/claude-501/uni-007-drive-bundles/` — `bundle-good` (a real
  v2 project + a 4-step lesson, deliberately part-satisfiable: 1 pass / 2 fail / 1 ungraded) and
  `bundle-bad` (trips `shadowed-by-deprecated` **and** `unmatchable-node-path`). ⚠️ `/tmp` is not
  forever; if they are gone, `bundle-good` is a copy of any v2 project plus a `lesson.json`.
- The register lives at `~/Library/Application Support/NodeGX/learning_folder.json`, and the
  installed lessons at `…/NodeGX/Learning/<id>/`.

## Things the next person will otherwise re-derive

- 🔴 **`scripts/` is not in `package.json`'s `build.files`.** Every `scripts/devtools/*` harness is
  absent from a packaged editor, so editor code that spawns one works for everyone who tests it and
  is **dead for real users**. No gate catches this — they all run from the checkout. It is why
  engine 2's editor adapter drives BLD-014's CDP capture instead of `measure-from-disk.js`.
- 🔴 **A `.jsx` file is invisible to `tsc`, to jest *and* to `eslint <dir>`** (which does not resolve
  the extension), so `lint:ci` never counts it. `test:ci`'s webpack is the only gate that reads one.
  The check control's markup adds ~11 uncounted `react/prop-types` errors.
- 🔴 **Grep the right SURFACE, not just the right string.** I grepped `scripts/run-electron-tests.js`
  for a seed flag, found none, and told two sessions and this handover that no seed control existed.
  It does — **`NOODL_SPEC_SEED`, read one layer down in `tests/SpecRunner.html:41-42`**, documented
  since 2026-07-25. The grep was correct and the conclusion was wrong. Same shape as the
  `dev:stop --list` misread the same morning: right observation, plausible inference, no look at the
  layer beneath. **Two sessions reached "no seed control exists" independently**, so it is a trap in
  the codebase's shape rather than one person's lapse.
- ⚠️ **A running `test:ci` is indistinguishable from a booting editor** in a bare `ps` grep — it *is*
  Electron running the same app. Two sessions misread this suite's host as a fourth party today.
  Discriminate on argv: `Electron test.js --ci` under `run-electron-tests.js` is a suite;
  `Electron . --dev` under `start.ts` is a stack.
- ⚠️ **Lesson prose must use explicit markdown links** — `linkify` is off in both Remarkable
  instances, so a bare URL never becomes an anchor. Safe direction, but UNI-010's producer is a model.
- 🔴 **⌘C over any panel prose copies the selected canvas NODE instead**, found by phase-66 on
  2026-08-15. The keybinding at `EditorDocument.tsx:562` runs `nodeGraph.copy()`, and
  `keyboardhandler.ts:165` guards on *focus* with `TEXT_ENTRY_TAGS = {INPUT, TEXTAREA, SELECT}` — a
  selection inside a `<div>` classifies as `'none'`, so the canvas command wins. **The lesson layer's
  check summary is exactly such a `<div>`**, so a learner who selects the feedback and hits ⌘C with a
  node selected gets `{"nodes":[…]}`. Not this phase's to fix; do not "fix" it locally either — the
  binding is global and the repair belongs with the guard.
- ⚠️ **A lesson's title and its project's name can still disagree.** The opener sets `project.name`
  only when the project has none, deliberately — forcing it would write into the learner's project.
  The lesson layer showing the lesson title is the right fix and is not built.
- `suggestedNodes` is still **dead** — `LessonModel.getCurrentSuggestedNodes()` has no callers, and
  the verifier deliberately does not check it. Whoever wires it to the node picker decides which
  vocabulary it wants and adds it to the check in the same change.
