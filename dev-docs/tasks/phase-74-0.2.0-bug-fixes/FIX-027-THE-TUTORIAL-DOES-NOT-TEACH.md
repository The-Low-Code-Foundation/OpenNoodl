# FIX-027 — the tutorials do not teach, and one of them cannot be finished at all

**Filed:** 2026-08-21, from Richard, using *Log a thing*, *State on a page* and the learner path.
**Researched, not yet fixed.** Nine reports; **three of them are one root cause**, and that root
cause makes a shipped lesson impossible to complete. Two more (21, 22) came from the path.

Sibling of `FIX-025-THE-LAUNCH-LIST.md`, which fixed thirteen. This is the batch after it, and it
is the same shape as FIX-025's 11a: **a lesson that was shipped and never completed by anybody.**

**Closed so far: 21 (fixed); 17, 19 and 20 (fixed and driven, 2026-08-25); 18 partly.**

---

## 🔴 The headline: *Log a thing* is unfinishable, and the editor tells you to use a panel it disabled

Richard, on the first task step: *"I try to click the 'Data' tab … but it's not clickable. I can
click all left menu items except Backend Services, Execution History and Workflows."*

Follow it through:

1. **Step 1 of *Log a thing* is *"Make somewhere to put them"***, and its prose is *"Open the
   **Data** panel and create a collection called `LogEntries`, with one text column called
   `title`."* Its `completeWhen` is `collectionExists` — a **database** condition.
2. **The Data surface is real**, but it is transient: `backendSurfaces.tsx:102` registers
   `{ kind: 'data', name: 'Data' }`, and the module note says these *"take no rail slot — they are
   opened from a local backend's card"*. That card lives in **Backend Services**.
3. **Backend Services is disabled *because this is a lesson*** — `router.setup.ts:339`,
   `isDisabled: isLesson === true`. Same line at `:361` (Execution History) and `:376`
   (Workflows). `isLesson` is `ProjectModel.instance.isLesson()`, passed from
   `EditorPage.tsx:64`.
4. **A disabled rail button's click is a no-op** — `SideNavigation.tsx:53`,
   `!isDisabled && onClick && onClick()`.
5. **No lesson action can open a panel.** The whole vocabulary is
   `{ selectNode } | { navigatePreview } | { selectComponent }` (`lessonformat.ts:82`).

So there is **no route**, and the first task of the lesson can never be satisfied. Measured: **2 of
its 6 graded steps are database-dependent — step 1 and step 6** — and step 1 is the gate.

🔴 **And the refusal message points at the locked door.** When a lesson grades a database that is
bound elsewhere, `databaseRefusal` says: *"point the project at its built-in backend in **Backend
Services** to continue"* (`lessonevalconditions.ts:317-322`). It names, as the remedy, the one
panel a lesson switches off. Richard saw the sibling message — the `unavailable` arm at `:324`:
*"This step grades against the built-in database, which could not be read: this project is not
bound to a backend, so there is no built-in database to read."*

⚠️ **Do not "fix" this by deleting `isDisabled: isLesson`** until someone says what it was for.
The line beside `Settings` (`router.setup.ts:454`) shows the author reasoning case-by-case —
*"hiding those in a lesson would be a functional loss"* — so the three disables are a decision,
not an oversight. The question to answer is narrower: **a lesson that teaches the database must be
able to reach the database.** Options: unlock Backend Services whenever any step carries a
collection condition; unlock it always and keep the other two disabled; or give the lesson format
an `openPanel` action and unlock on demand. **Pick one deliberately.**

---

## The nine

| # | Report | Where it lives | Root |
|---|---|---|---|
| 14 | *Log a thing* cannot be completed — its first task needs a panel the lesson disables | `router.setup.ts:339` | **A** |
| 15 | A disabled rail item does not say why it is disabled | `SideNavigation.tsx:70` | **A** |
| 16 | The lesson says *"the Data panel"*; the rail says *Backend Services*, and Data is inside it | `log-a-thing/lesson.json` step 1 | **A** |
| 17 | A task step never shows its instructions until you click it | `LessonLayerView.jsx:83` | B — ✅ **FIXED + DRIVEN 08-25** |
| 18 | 🟡 **PARTLY FIXED** — the count was a cap artefact and the sentence blamed the learner; both fixed. ✅ **The gate now exists** (`lessons:check`, self-tested, in CI). 🔴 **The `state-on-a-page` bundle is still open** — it ships from nowhere either checkout can see | shipped bundle + `lessoncheck.ts:346` | C |
| 19 | No completion moment at all when the last step is a graded card | `lessonlayer2.ts:441` | D — ✅ **FIXED + DRIVEN 08-25** |
| 20 | When there *is* a completion popup, its only action is EXIT LESSON — no reset | `lessonlayer2.ts:450` | D — ✅ **FIXED + DRIVEN 08-25** |
| 21 | ✅ **FIXED** — *"Explain this for me"* 404s every time; it has never worked for anybody | `me/path/project/route.ts:54` + `useLearnerPath.ts` | E |
| 22 | Answering the three intake questions barely changes the path | `curriculum.json` + `pathing.ts` | E |

### 17 — the steps that tell you what to do are exactly the ones that stay silent

Richard: *"The first 'task' step doesn't show its tooltip, so I have to manually click it to know
what to do next… initially it should show up automatically when you enter the tutorial, or when
you have just completed a previous step, so the user always sees what they should do next."*

✅ **The mechanism already exists and is simply pointed the wrong way.** `LessonItem` takes
`showPopupWhenSelected` and honours it (`LessonItem.jsx:26`). `LessonLayerView` passes
**`showPopupWhenSelected={hasConditions === false}`** (`:83`) — so a step auto-opens its
instructions **only when it has nothing to grade**. Every *task* has conditions, so no task ever
shows its own instructions.

🔴 **Do NOT just invert the flag.** `refresh()` re-renders on every `Model.*` event, and the
`LessonItem` effect's dependency array is `[isSelected, popupContent]` — `loadSteps` rebuilds
`popupContent` on every lesson reload. An unconditional flip risks a popup that reopens while the
learner is working, which is worse than one that never opens. **The trigger is a step
*transition*, not a render**, and a dismissal must stick for that step. Richard asked for exactly
that: *"You should be able to dismiss the tooltip, but initially it should show up
automatically."*

⚠️ Dismissal itself already works for a task step: `manualClose: hasNextButton`
(`LessonItem.jsx:71`) is false there, so the popout closes on an outside click.

#### ✅ FIXED AND DRIVEN 2026-08-25

The flag is **gone, not inverted**. `LessonItem` now asks a pure function —
`views/lessons/lessoninstructionopen.ts`, in its own module for the same reason
`lessonstepflow.ts` is: `LessonItem.jsx` reaches `PopupLayer`, `ipcRenderer` and the DOM, so
nothing in it is gradeable, while the rule that was wrong is a decision over four booleans.

The rule: open on the **edge** into a step — `isSelected && !wasSelected` — on a step that has
instructions and that the learner has not dismissed. `instructionDismissed` records a closing and
deliberately leaves `wasSelected` alone, because dismissing is not leaving: clearing it would make
the very next render look like a fresh entry and re-open what was just closed.

**Driven in the installed *Log a thing*, all three halves of acceptance criterion 4:**

| | what was done | reading |
|---|---|---|
| opens | opened the lesson from the launcher | step 1 *Add the Visual Function* — a **task**, so silent before — opened its own instructions, *"Add a Visual Function node to the canvas and rename it to Check the entry…"* |
| dismisses | clicked outside the popout | closed |
| **stays** dismissed | three real `setParameter` writes | **`refresh()` ran 7 times** and it did not come back |
| next step | `model.next()` | step index 1 → 2, *Teach it to decide*, and **its** instructions opened by themselves |

🔴 **The `refresh()` count is the point of that third row.** "The popup stayed closed" and "nothing
re-rendered" are the same observation, and only one of them means the fix works. `refresh` was
wrapped and counted, so the silence is measured against a signal known to have fired **seven
times** — which is exactly the path the naive flag-flip would have re-opened on.

⚠️ **And nothing but running the app could have checked the wiring.** `LessonItem.jsx` and
`LessonLayerView.jsx` are `.jsx`; `packages/noodl-editor/tsconfig.json` does not set `allowJs`, so
**no typecheck gate compiles either file**, and the jasmine suite's `tests/lessons/` covers
`lessonevalconditions`, `lessonformat` and `worked-lesson` — not the views. Webpack is the only
thing that reads them. A broken `require('./lessoninstructionopen')` would have passed every gate
in this repo and failed for the learner.

✅ Graded by `tests-unit/fix-027/instructions-open-on-entry.test.ts` — 9 specs, **mutation-checked
three ways**: drop the transition edge (the naive flip) → the re-render row fails; drop the
`dismissed` check → the come-back row fails; clear `wasSelected` on dismissal → its own row fails.
Each restores byte-identical. The come-back assertion carries a **control** proving re-entry still
opens an *undismissed* step, so "stays shut on return" cannot quietly mean "never opens on return".

⚠️ **Driven against Richard's own installed lesson**, because that is the only place either lesson
exists. `~/Library/Application Support/NodeGX/Learning` was copied first and restored after —
**57 files, checksum `c346394c…` before and after**, so his progress and the lesson's project files
are exactly as he left them. Anyone driving a lesson again should do the same; opening one writes
to it, and `model.next()` advances his progress for real.

### 18 — the 21 problems are in the lesson we shipped, not in the learner's work

Richard: *"the check my work bit said 3 out of 3 tasks were complete, but the app had 21 errors …
It makes you feel like you're not done."*

✅ **Measured, by running the validator over the installed bundles** (`SemanticValidator` +
`loadV2Project`, the same pair `scripts/library/check.ts` uses):

| lesson | diagnostics |
|---|---|
| `state-on-a-page` | **26** — 12 `unknown-parameter`, 7 `invalid-parameter-value` (**6 of them errors**), 3 `inert-dimension`, 3 `unitless-dimension`, 1 `inactive-conditional-parameter` |
| `log-a-thing` | **0** |

Almost all of them are dead parameters on one `net.noodl.controls.button`, e.g. *"has no input
port `cursor`, so this parameter is never read"*. 🔴 **The learner did not create these and cannot
fix them from the lesson.** Every learner who completes *State on a page* is told their app has
problems. This is the run-the-checker-over-the-corpus-that-exists shape for the third time.

⚠️ **The grade said 21; the validator says 26, and the difference is NOT explained.** Do not
assume they are the same set — find the filter (`wholeSolution.findings` in the grading adapter)
before quoting either number as "the" count.

Two separate fixes, and both are wanted: **clean the shipped bundle** (and gate it, so a lesson
cannot ship with validator errors again), and **soften the sentence** so a whole-project
observation cannot read as a failed lesson when every step passed.

#### PARTLY FIXED 2026-08-21 — the number was never a count, and the sentence no longer blames the learner

**Commit: see below. `21` is not "21 problems". It is `min(N, 20) + 1`, and it is the largest
number that sentence could ever print.**

The flagged discrepancy is resolved, and neither of the two obvious readings was right.
`capFindingLines` keeps `MAX_FINDING_LINES = 20` lines and **appends one more announcing the
overflow** — and that announcement line is itself in the array. So `findings.length` saturates:

| real problems | `findings.length` — what the sentence printed |
|---|---|
| 20 | 20 |
| 21 | 21 |
| 26 | **21** |
| 1,000 | **21** |

Measured by running the real `capFindingLines` from source, not by reading it.

**The `info` filter was a red herring.** Re-running `SemanticValidator` over both installed
bundles: `state-on-a-page` has **26 diagnostics, of which 26 are non-`info`** (20 warnings,
6 errors — `errors: 6` is what makes `valid: false`). The `severity !== 'info'` filter drops
**zero** of them. So 21 was not "26 minus 5 infos"; it was the cap, and only the cap.
`log-a-thing` is **0 diagnostics**, in-repo and as installed.

⚠️ **Re-measured after `dae76da8`: it is now 25, not 26** — 12 `unknown-parameter`, **6
`invalid-parameter-value` errors**, 3 `inert-dimension`, 3 `unitless-dimension`, 1
`inactive-conditional-parameter`. The one that went was the lone `invalid-parameter-value`
**warning**: `dae76da8` stopped the validator reading the shipped `fx` expression form as invalid,
which was one of the floor's ten failures and a real bug. **The six errors are untouched**, so
nothing above changes as an argument — 21 was still the cap and not a count, and the bundle still
ships dirty. Recorded because the arithmetic in this section (20 + 6 = 26) is now one out, and
because it is a worked example of the thing this file keeps running into: **a corpus measurement
inherits the defects of the instrument that took it.** If the remaining 25 are re-triaged, do it
on a tree at or after `dae76da8`.

🔴 **The same saturated number reached the platform.** `buildLessonEvidence` set
`findingCount: grade.wholeSolution.findings.length` — so the *stored* evidence row carried 21 for
a 26-problem project too. This was a data defect, not only a display one.

✅ **Fixed:** `WholeSolutionResult` gains `findingTotal`, counted **before** the cap in both
adapters (editor and sidecar — they must agree, which is why they already cap at one number).
`findingTotalOf()` owns the read and falls back to the list length for an adapter that reports
none: absent means *not reported*, never *none found*, so under-reporting beats reporting a
broken project as clean. `normaliseWholeSolutionResult` bumps the tally when it adds the
empty-page finding, and deliberately does **not** invent one when the adapter was silent.

✅ **The sentence.** When every checked step is done it now reads *"Your app renders. The
validator reports 26 problems in the project — worth a look, though none of it is a step you were
asked to do."* A learner with a step outstanding still gets the plain sentence. 🔴 **The findings
are still counted and still listed** — softening the verdict, never the finding.

**Graded by mutation, six ways** (drop `findingTotal` from either adapter; count the capped list
in the sentence; count it in the evidence; stop bumping in `normalise`; remove the softened
branch) — each goes red, restores byte-identical. `test:main` **300 suites / 4884 tests / 0
failures** (floor 4871 + 13 new); mcp **55 suites / 651 tests**; all four typechecks exit 0.

#### 🔴 STILL OPEN — the bundle itself, and the gate

- **The 26 diagnostics are still in `state-on-a-page`, and cannot be cleaned from this repo.**
  The lesson **is not in either checkout** — `project-examples/lessons/` holds only
  `log-a-thing`, and the community repo mentions the slug only in a test. Per FIX-026 its
  `entry.source.path` is a `/tmp` path that is gone. ⚠️ The copy under
  `~/Library/Application Support/NodeGX/Learning/state-on-a-page` is the **learner's working
  copy** — Richard's, mtime today — and is not a source to clean. **Where this lesson ships from
  is the question to answer before anything can be fixed in it.**
- ✅ **THE GATE EXISTS — `npm run lessons:check`, 2026-08-21.**
  `scripts/check-lesson-bundles.ts`, run by its own `Lesson bundles (FIX-027)` job in `pr.yml`.
  Every bundle under `project-examples/lessons/<slug>/` is checked three ways: `lesson.json`
  parses and verifies against the node catalog (`verifyLessonManifest`), and **both** projects —
  the starter at the bundle root and `solution/` — load and validate clean.

  **Measured, not assumed:** `log-a-thing` is **0 manifest findings, 0 diagnostics** across
  `starter 3c/12n` and `solution 3c/16n`. The gate prints that cardinality on every run, because
  a checker reporting "clean" over an empty read scores identically to one over a perfect bundle.

  🔴 **Warnings fail this gate, unlike `library:check`, and that is the whole point.** An unknown
  node type arrives as `severity: warning` — which is exactly how the sibling gate reported
  **58/58 clean** while nine shipped prefabs had no type at all. Gating on errors alone would have
  left a hole shaped precisely like bug 18. The strict bar is affordable because the corpus
  already meets it.

  ✅ **The gate is graded by mutation — `npm run lessons:check:self-test`, also in CI.** It copies
  the real bundle, breaks it seven ways and requires each break to be caught **in the arm it
  names**, not merely to exit non-zero: a harness that threw would exit non-zero too. Verified by
  meta-mutation — pointing one expectation at an arm it cannot match reports `WRONG REASON` and
  fails. Control green first; the shipped corpus is never written to (git-clean after every run).

  ⚠️ **It does NOT cover `state-on-a-page`**, which is the bundle bug 18 was actually about and is
  still in neither checkout — see the item above. This gate covers the corpus that exists, and
  will cover that lesson the day it ships from here.

  🔴 **`knownCollections` is deliberately not supplied.** `verifyLessonManifest` can also check
  that every collection a condition names is one the bundle creates, but only when the caller
  hands it the population — and omitted is not the same answer as supplied-and-empty. Passing `[]`
  would fire `unreachable-collection` against every correct data lesson, `log-a-thing` first.
  Deriving the real list is **TUT-002 AC3**, which is open and carries its own recorded trap
  (`BackendManager.getRecordCount` ends `return result.count || 0`, so an unreadable table reads
  as zero rows). This script is the caller to wire it into when AC3 lands.

### 19 and 20 — there is no "well done"

`loadSteps` adds a popup button only when `shouldButtonRender = !step.conditions`
(`lessonlayer2.ts:432`), i.e. only on a step with nothing to grade. On the last such step the
button is `EXIT LESSON` → `App.instance.exitProject()` (`:450`).

- **19**: *State on a page*'s last step is a **graded card**, so it gets no popup button and there
  is **no completion moment whatsoever**. (Until FIX-025's bug 13 it was worse — the whole bar
  went blank.)
- **20**: *Log a thing* ends on a popup step, so it gets the button — and **exit is the only
  thing offered**. Reset exists (`LearningFolderModel.reset`, and the launcher card has a *Reset*
  button) but is not reachable from the moment a learner has just finished and might want another
  go.

⚠️ **`reset()` is destructive and refuses in two cases** — a platform lesson, and a local one
whose source bundle has gone. See `FIX-026-PUT-IT-BACK.md`: for *State on a page* the source is a
`/tmp` path. **A "Reset" button offered at the completion moment must handle the refusal**, or it
will fail in front of the learner at the worst moment.

#### ✅ FIXED AND DRIVEN 2026-08-25

**The moment is decided, not authored.** `isLessonFinished` (`views/lessons/lessonstepflow.ts`)
sits beside `stepFlowAction` and takes the same `StepFlowInput`, so the two cannot disagree about
which step is last. 🔴 **The two lesson shapes finish by opposite rules and collapsing them is
the bug this replaces**: a graded last step finishes when its conditions hold, a narrative one
finishes on arrival — and `refresh()` sets `isComplete = false` on every conditionless step, so a
rule that simply asked `isComplete` would report *Log a thing* unfinished forever while looking
correct against the graded lesson, which is the one anybody would check.

**Two surfaces, because the two lessons end differently and neither covers the other.**

| lesson | last step | surface | driven |
|---|---|---|---|
| *State on a page* | graded card, **0 popup buttons** | the bar's completion banner | ✅ |
| *Log a thing* | narrative, shown as a screen-centre **modal** | `START AGAIN` beside `EXIT LESSON` in the modal | ✅ |

🔴 **The modal is why the banner alone was not enough, and it was measured, not assumed.** On
*Log a thing*, `document.elementFromPoint` over the banner's *Start again* returned
`popup-layer dim` and the modal's own buttons were exactly `['EXIT LESSON']` — §20's defect
verbatim. A banner behind a dimmer is not an offer.

**The refusal.** `LearningFolderModel.canReset` is the one statement of "would reset run", and
`reset()` is its first caller — a second copy of "local source, and the path is still there" at
the call site is the drift FIX-026 warns about. Driven on *State on a page*, whose `/tmp` bundle
is **gone on this machine today**: the control renders disabled, with no click handler, and the
reason as **visible text** beside it. ⚠️ Text rather than a `title` attribute on purpose — a
disabled button suppresses pointer events, so a native tooltip there is a message that may never
arrive, which is precisely the failure this section exists to prevent.

**`Start again` closes the project before it resets, and that is load-bearing.** `repairFrom`
deletes `Learning/<slug>/` and copies a fresh bundle over it, and at the completion moment that
directory **is the open project** — a live `ProjectModel` would write its graph back over the
fresh copy. So the id is stashed (`launcherHandoff.stashLessonReset`), `leaveForLauncher` closes
and routes, and `ProjectsPage` performs the reset on mount, sharing one `performLessonReset` body
with the launcher card's own Reset button. Consumed on read, so React 18's double-invoked effect
cannot reset twice.

**Driven end to end on *Log a thing*** (its bundle still exists, so this is the *available* arm):
confirm → project closed → landed on Learning → **progress `{stepIndex: 3}` → cleared**,
directory checksum `37b065ce…` → `ec79c31d…`, project identity `log-a-thing` **kept** through
`repairFrom`, and the card's own button changed from *Continue* to *Start*. The cancel path was
driven first on both surfaces: the confirm names both consequences and nothing changes.

#### 🔴 What driving found that reading could not: the completion moment was behind a BLOCKER

`PopupLayer` puts a full-screen dimmer behind every popout. §17 opens a step's instructions on
the edge into it — so on a graded last step the learner finished with those instructions still
open, and `document.elementFromPoint` at the middle of the banner returned **`popup-layer-blocker`**:
the banner was dimmed and both its buttons were unclickable.

⚠️ **Two orderings, two fixes, and neither covers the other.**

- Finishing *in place*: the popout is already open, so the layer closes it on the **edge** into
  completion (`_clearTheWayForCompletion`). Driven: 1 popout → 0, blocker cleared, and
  `elementFromPoint` at the button then returned the button.
- **Re-entering a lesson already finished**: the banner is drawn first and §17's entry edge would
  open instructions over it a moment later. The close cannot reach a popout that does not exist
  yet, so `instructionOpenDecision` gained `lessonFinished` and suppresses the open. Driven from
  a cold launcher: **0 popouts, no `has-popouts`**, banner topmost at all three points.
- ⚠️ **On the edge, never on every refresh.** `refresh()` runs on every `Model.*` event; closing
  popouts from all of them would shut instructions the learner deliberately re-opened — §17's own
  lesson pointed the other way.
- ⚠️ **Still open, and inherent to popouts rather than to this banner:** if the learner *manually*
  re-opens a finished step's instructions, the blocker covers the banner again until they dismiss
  it. Measured. That is how every popout in the editor behaves, and one click clears it.

#### 🔴 And a contrast failure I introduced by reading a token NAME

The banner was `--theme-color-secondary-dim`, chosen because the one moment a lesson
congratulates someone should not look like the eight steps before it. Measured live, that token
is **`rgb(139,149,161)` — a *light* grey**: headline **3.04:1**, and the refusal sentence
**1.91:1**. The sentence explaining why *Start again* was switched off was the least readable
thing on the bar. Moved to `--theme-color-bg-3`, the tone the fg tokens are designed against, with
the state signal on a primary rule along the top. Re-measured in **both themes** — dark
10.84 / 6.81 / 5.85 / 6.94, light 13.33 / 5.07 / 4.61 / 4.57. **A token name is not a colour.**

---

## Acceptance

1. *Log a thing* can be completed end-to-end by a learner who starts from a fresh install — 🔴
   **driven, all eight steps**, not reasoned about.
2. A rail item that is disabled says why, on hover.
3. Lesson prose names surfaces as the UI names them, and there is a check that fails when it does
   not. (The prose is authored text; a spelling of "Data panel" that no rail carries is exactly
   what `lessonbundleverify` exists to catch.)
4. ✅ **MET, driven 2026-08-25.** Entering a lesson, and completing a step, shows the next step's
   instructions **once**, and they can be dismissed and stay dismissed. See §17 — the dismissal
   half was measured against a `refresh()` count of 7, not against a quiet screen.
5. `state-on-a-page` validates clean, and a lesson bundle carrying validator **errors** cannot
   ship.
6. ✅ **MET, driven 2026-08-25.** Finishing a lesson says so, and offers both *reset* and *exit* —
   with reset refusing gracefully when it cannot run. Both lesson shapes, both arms of the
   refusal, and the reset round-trip verified on disk. See §19/§20 above, including the blocker
   and the contrast failure the drive found.
7. *"Explain this for me"* returns a projection for a step on the learner's own path — 🔴 **driven
   against production once**, because it has never succeeded and a spec would only prove the two
   sides agree with each other. And a refusal says something to the learner instead of only to the
   console.
8. The intake either changes the path visibly, or the surface stops implying that it will. This is
   a **product decision for Richard**, not a defect to patch: the honest options are to give
   `experience` real branching, to drop it to two questions, or to say plainly what the three
   questions do.

🔴 **Every one of these is a drive, not a diff.** FIX-025's thirteenth bug was created by fixing
its eleventh and was invisible in source. See [[fixing-a-grader-makes-new-states-reachable]].

---

## 21 — *"Explain this for me"* sends the wrong field, and always has

Richard: *"if I click on 'explain this for me' nothing happens and I get an error …
`POST https://community.nodegx.io/api/v1/me/path/project 404 (Not Found)`."*

✅ **The route is deployed and healthy.** Probed from the host with a known-firing control:
`POST /api/v1/me/intake` → **401**, `/api/v1/me/path` → **405** (it is GET-only),
`/api/v1/me/path/project` → **401**. All three answer; none is missing. So the 404 is raised
*inside* the handler.

🔴 **The bug is a field-name mismatch across the seam.**

- The button sends the **slug**: `onClick={() => onProject(step.slug)}`
  (`LearnerPathSection.tsx:263`), which becomes `{ concept: step.slug }`.
- The route matches on **`teaches`**:
  `pathFor(intake).steps.find((candidate) => candidate.teaches === concept)`, and
  `if (!step) return notFound()` (`me/path/project/route.ts:44`).

✅ **Measured: `slug === teaches` for 0 of the 15 curriculum lessons.** They are different kinds
of string — `slug` is an identifier (`your-creature-on-screen`), `teaches` is prose
(`elements, hierarchy, properties`). So **every** click 404s, for every learner, for every step.
The feature has never once run.

⚠️ **Decide which side is wrong before patching.** The route passes `step.teaches` to the model as
the concept, so the prose is what the projection actually needs — but a request body keyed by a
prose phrase is a poor API, and the editor's `LearnerPathStep` type already carries **both**
`slug` and `teaches` (`communityapi.ts:903-906`). Recommend: **match on `slug` server-side** and
keep passing `teaches` to the model. That keeps identifiers in the protocol and prose in the
prompt, and it does not require the client to learn the curriculum's wording.

🔴 **And nothing surfaced the failure to the learner** — Richard saw a console error and *"nothing
happens"*. A 404 from this route is `absent` in the client's `Write` union; whatever the path
section does with that, it is not telling anyone.

### ✅ FIXED 2026-08-21 — both halves, and the second was the one worth having

**Half one, the platform.** `me/path/project/route.ts` now matches `candidate.slug`. The prose
did not stop mattering, it stopped being the *key*: `step.teaches` is still what reaches the
model, so identifiers travel over the wire and prose goes to the prompt. Re-measured
independently before touching anything — **`slug === teaches` for 0 of 15**, and the exact
`VISUAL` fixture confirmed on three controls: the code lesson is genuinely off that path, the
state lesson is genuinely on it, and `variables, state` matches no slug at all. That third one
is why the spec *had* to change rather than merely could.

🔴 **The existing spec ratified the bug, and changing it carelessly would have destroyed its
coverage.** `uni007`'s known-good arm sent `'variables, state'` — the route's own spelling — so
it passed just as happily against a route matching the wrong field. Its "not on your path" arm
sent prose too, and after the fix would have gone on returning 404 **for the wrong reason**
(not a slug at all), silently testing nothing. Both arms are now slugs, the not-yours arm
asserts its own precondition rather than trusting it, and two arms were **added**: the prose is
now required to be *refused*, and every step on the learner's real path is required to accept
its slug — the property that was false for all fifteen and that nothing checked.

✅ **Graded by mutation, not by a green tick.** Reverted to `teaches` and the two arms disagree:
`your-creature-on-screen` → 404 (Richard's bug, reproduced as a test) and the prose → 200. 31/31
with the fix, 2 failed without it.

**Half two, the editor — and this is the half that generalises.** `useLearnerPath` surfaced only
`refused` and dropped `absent`, `unauthenticated` and `unreachable` on the floor, which is why
Richard saw a console 404 and *nothing on screen*. 🔴 **A client that says nothing when a write
fails would have hidden the NEXT cause just as completely** — the field mismatch was only
findable from the console. `projectionFailure` now words all four, distinctly.

⚠️ **Two things the fix corrected that were not in the report.** The hook's comment claimed a
refusal is *"worded by the platform and shown as-is"* — it was not: it was routed into
`{ kind: 'failed' }`, whose note is a fixed *"could not be written, and it will not be
retried"*. Wrong twice for a 409 the learner can fix and retry themselves. And `absent` **is**
narrated here, deliberately: D15's silence protects a surface the viewer must not learn exists,
and this one is already on their screen with a button on it, so silence is not privacy, it is a
dead control.

🔴 **UNI-001 AC4 caught the first placement, and the boundary was right.** `projectionFailure`
went into `learnerpathview.ts` first, beside `projectionNote`, because that module is tested —
and AC4 asserts *"the module that decides what is DRAWN never sees a session at all"* as a
substring over stripped source, which the `unauthenticated` sentence trips. **The answer was the
boundary, not a reword**: `projectionNote` maps the five outcome *kinds* inside a 200 and is a
drawing decision; this maps the *transport* outcomes of a write and knows about credentials. It
lives in the hook and is exported for the spec.

🔴 **AND A THIRD DEFECT, FOUND WHILE PREPARING THE DRIVE: PRODUCTION HAS NO PROJECTOR KEY.**
`/etc/nodegx-community/nodegx-community.env` on nexus-1 carries `BREVO_API_KEY`, `DATABASE_URL`,
the GitHub OAuth pair, `NOTIFICATION_LINK_SECRET` and `SITE_ORIGIN` — **no `ANTHROPIC_API_KEY`**.
`defaultProjector()` therefore returns `UnconfiguredProjector`
([`anthropic.ts:101-104`](../../../../nodegx-community/src/lib/projection/anthropic.ts)) and
`projectConcept` answers `unavailable` at
[`projector.ts:188`](../../../../nodegx-community/src/lib/projection/projector.ts) — **before the
insert**, whose own comment reads *"Never claims a row, so configuring one later still works."*

✅ **Three consequences, and two of them are good news.**
1. **The drive is free and consequence-free.** No model call, no money, no row claimed, so the
   `(learner, concept)` pair is not burnt and a later configured attempt still works. The hazard
   that made session 48 refuse to drive bug 6 **does not apply to this button as deployed.**
2. **The before/after is unambiguous anyway.** Before: 404 → the editor drew *nothing*. After:
   200 `unavailable` → *"Tailored explanations are not switched on for this community yet."*
   Silence becoming an honest sentence is exactly what both halves of this fix were for.
3. 🔴 **But the button still cannot explain anything.** The field mismatch is fixed and the
   silence is fixed; the feature is **inert until a key is configured on nexus-1**. That is a
   spend decision and it is Richard's, not a defect to patch.

⚠️ **`concept_projections = 0` does NOT by itself prove the 404.** An unconfigured call leaves
zero rows too, so the row count cannot tell "never reached the projector" from "reached it and
found no key". **The 0-of-15 slug/teaches measurement is what proves the 404** — the row count
only confirms no projection was ever stored. Do not quote it as evidence of the mismatch.

⚠️ **Still not driven.** Both halves are specced and the platform half needs a **deploy** before
any click changes. `COMMUNITY_URL` is hard-coded to production, so the editor cannot be pointed
at an undeployed platform to prove it — see §4 of the next-session prompt.

⚠️ **`submitFailure` is the same shape and is still untestable** — same file, neither exported
nor covered, and it words the intake's failures. Left alone as out of scope; worth the same
treatment next time that path is touched.

## 22 — one of the three questions changes nothing a learner can see

Richard: *"it's given me 11 steps, only leaving one off, so it makes you wonder what the point in
answering the 3 questions was."*

✅ **Measured with the real `pathFor` over all 18 answer combinations:**

| | |
|---|---|
| distinct paths | **6 of 18 combinations** |
| `experience` (none / some / fluent) | **changes the path not at all** — all three produce byte-identical step lists |
| `logic` (visual / code) | ±1 lesson (`the-same-ideas-in-code`) — this is the *"only leaving one off"* Richard saw |
| `building` | interactive +0, custom-nodes +1, data-app +2 |

So the widest spread the intake can produce is **11 to 14 steps out of a 15-lesson curriculum**.

⚠️ **The suite already knows and says so.** `tests/uni007-intake-and-pathing.test.ts` asserts
*"every intake question changes something"* — but the check is deliberately **"path OR prompt"**,
and its comment records that `experience` *"deliberately only does the second"*. So `experience`
changes only the **projection prompt**.

🔴 **Which is bug 21.** The single consequence of question 1 is routed entirely through the one
feature that 404s every time. Fix 21 and question 1 becomes observable for the first time;
until then it is decorative, and Richard's instinct that the questions did nothing is **correct
as a description of the shipped product**.

⚠️ **And the deeper answer to *"what point does the path have?"*: today, none you can act on.**
`pathing.ts`'s own header says every lesson in the curriculum is `in-writing` — **all fifteen** —
so a path is a reading list of lessons that cannot be installed. The module computes `ready/total`
and a `truth` string precisely so the surface cannot pretend otherwise. Richard expected *"a bunch
of tutorials"*; there are two installable lessons in the product and neither is on the path.
**That is D17's fifteen unwritten lessons, and it is a content wall, not a bug** — but the path
surface should say it in a way that survives a learner reading it, because right now it reads as
a broken feature rather than an honest empty state.
