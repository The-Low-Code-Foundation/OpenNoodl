# FIX-027 — the tutorials do not teach, and one of them cannot be finished at all

**Filed:** 2026-08-21, from Richard, using *Log a thing* and *State on a page*. **Researched, not
yet fixed.** Seven reports; **three of them are one root cause**, and that root cause makes a
shipped lesson impossible to complete.

Sibling of `FIX-025-THE-LAUNCH-LIST.md`, which fixed thirteen. This is the batch after it, and it
is the same shape as FIX-025's 11a: **a lesson that was shipped and never completed by anybody.**

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

## The seven

| # | Report | Where it lives | Root |
|---|---|---|---|
| 14 | *Log a thing* cannot be completed — its first task needs a panel the lesson disables | `router.setup.ts:339` | **A** |
| 15 | A disabled rail item does not say why it is disabled | `SideNavigation.tsx:70` | **A** |
| 16 | The lesson says *"the Data panel"*; the rail says *Backend Services*, and Data is inside it | `log-a-thing/lesson.json` step 1 | **A** |
| 17 | A task step never shows its instructions until you click it | `LessonLayerView.jsx:83` | B |
| 18 | "All 3 checked steps are done" arrives with "the project has problems (21 reported)" | shipped bundle + `lessoncheck.ts:346` | C |
| 19 | No completion moment at all when the last step is a graded card | `lessonlayer2.ts:441` | D |
| 20 | When there *is* a completion popup, its only action is EXIT LESSON — no reset | `lessonlayer2.ts:450` | D |

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

---

## Acceptance

1. *Log a thing* can be completed end-to-end by a learner who starts from a fresh install — 🔴
   **driven, all eight steps**, not reasoned about.
2. A rail item that is disabled says why, on hover.
3. Lesson prose names surfaces as the UI names them, and there is a check that fails when it does
   not. (The prose is authored text; a spelling of "Data panel" that no rail carries is exactly
   what `lessonbundleverify` exists to catch.)
4. Entering a lesson, and completing a step, shows the next step's instructions **once**, and they
   can be dismissed and stay dismissed.
5. `state-on-a-page` validates clean, and a lesson bundle carrying validator **errors** cannot
   ship.
6. Finishing a lesson says so, and offers both *reset* and *exit* — with reset refusing gracefully
   when it cannot run.

🔴 **Every one of these is a drive, not a diff.** FIX-025's thirteenth bug was created by fixing
its eleventh and was invisible in source. See [[fixing-a-grader-makes-new-states-reachable]].
