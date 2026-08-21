# FIX-027 — the tutorials do not teach, and one of them cannot be finished at all

**Filed:** 2026-08-21, from Richard, using *Log a thing*, *State on a page* and the learner path.
**Researched, not yet fixed.** Nine reports; **three of them are one root cause**, and that root
cause makes a shipped lesson impossible to complete. Two more (21, 22) came from the path.

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

## The nine

| # | Report | Where it lives | Root |
|---|---|---|---|
| 14 | *Log a thing* cannot be completed — its first task needs a panel the lesson disables | `router.setup.ts:339` | **A** |
| 15 | A disabled rail item does not say why it is disabled | `SideNavigation.tsx:70` | **A** |
| 16 | The lesson says *"the Data panel"*; the rail says *Backend Services*, and Data is inside it | `log-a-thing/lesson.json` step 1 | **A** |
| 17 | A task step never shows its instructions until you click it | `LessonLayerView.jsx:83` | B |
| 18 | "All 3 checked steps are done" arrives with "the project has problems (21 reported)" | shipped bundle + `lessoncheck.ts:346` | C |
| 19 | No completion moment at all when the last step is a graded card | `lessonlayer2.ts:441` | D |
| 20 | When there *is* a completion popup, its only action is EXIT LESSON — no reset | `lessonlayer2.ts:450` | D |
| 21 | *"Explain this for me"* 404s every time — it has never worked for anybody | `LearnerPathSection.tsx:263` | E |
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
