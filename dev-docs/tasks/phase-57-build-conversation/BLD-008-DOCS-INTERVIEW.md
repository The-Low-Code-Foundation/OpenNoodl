# BLD-008 — Docs are a conversation

**Status:** ✅ built **and driven** · **Track A** · ⭐ · after BLD-001, BLD-007 · closes **D8**

> **Driven 2026-08-09 (session 13) against `nodegx-qa-fixture` — 24 components, no `docs/`, which
> is acceptance criterion 1's exact case.** Two provider calls, both real, both `claude-sonnet-5`:
> `plan` **$0.015467** (routing) + `design` **$0.043346** (the interview) = **$0.058813**. That
> second line is R5 confirmed live rather than by reading. Seven questions, R7 exactly, and the
> `brief`×3 / `architecture`×3 / `conventions`×1 split read off the sidecar on disk.
>
> The drive found **three defects, all fixed**, and the interesting one is not the contrast failure
> — it is that the panel's single blocking decision was the one thing the thread would not scroll
> to. See R11, R12, R13.

## The defect, measured

Docs are click-and-pray. One button
([ProjectReviewView.tsx:236-244](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/ProjectReviewView.tsx#L236))
runs a retrofit that reads what it can afford, drafts three files, marks what it could not know as
TODO — and **the panel displays the TODO count as a feature**:

```ts
const todos = `${draft.todoCount} TODO${draft.todoCount === 1 ? '' : 's'} for you to confirm`;
```
— [ProjectReviewView.tsx:132](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/ProjectReviewView.tsx#L132)

**The agent never asks a question.** Then it hands off to a different panel to accept diffs
([:201-216](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/ProjectReviewView.tsx#L201)).

The templates already diagnose this, in their own module header
([templates.ts:3-9](../../../packages/noodl-editor/src/editor/src/models/ProjectDocs/templates.ts#L3)):

> *"These are prompts to a human, not content. **Every heading asks a question the graph cannot
> answer for itself:** why this shape, what the third-party API guarantees, what was rejected."*

So the system knows the information is only obtainable from the human, and then obtains it by
guessing and asking the human to proofread. **A question asked before drafting costs one exchange
and removes the TODO.**

## What is right today and must survive

`ReviewCoverageSummary` is the best thing in the current panel — it tells the user the drafts were
written from 8 of their 55 components *before* they can accept anything, and says outright that
anything about the rest is inference
([ProjectReviewView.tsx:62-110](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/ProjectReviewView.tsx#L62)).
**Keep it, unchanged in spirit.** It becomes the first thing the interview reports.

## What was built, and where

| Module | What it is |
|---|---|
| `review/interviewQuestions.ts` | Pure. Parses the `##` headings out of `DOC_TEMPLATES` and decides, per heading, whether the graph can answer it. **The set has nowhere else to come from** — that is criterion 4. An unclassified heading is *asked*, and a spec makes it red as well. |
| `review/interviewState.ts` | Pure. The answer record, the resume rule, `insertSkipTodos`, and `interviewActivities` — the author BLD-002 reserved the `question` kind for. |
| `review/interviewPrompts.ts` | The asking prompt and `answersBlock`, which hands the answers to the drafting turn as facts and forbids `> TODO:` on that path. |
| `review/InterviewSession.ts` | One turn, one tool, `design` role. Degrades to the plain questions rather than failing the pass. |
| `review/InterviewSidecar.ts` | `.nodegx/review/interview.json`, debounced + queued, on the `flushAiSidecars` quit handshake **from the day it was written**. |
| `review/ProjectReviewRun.ts` | Two calls now: `run()` assembles and asks; `draft()` writes. The gap between them is a person. |
| `AiAuthoringPanel/InterviewCard.tsx` | The controls. Draws **no question text** — the thread does that. |

Everything else is edits: `docsTurns` emits the questions, `ProjectReviewStore` owns the run,
`prompts.ts` gained the answers block and a `proposed` brief, `ProjectReviewView` lost a ref that was
never filled.

## Build

1. **Invert the flow: read → ask → draft.** The assemble step already exists and produces coverage;
   after it, the run produces **questions**, not drafts.
2. **Questions are generated from the template headings the graph cannot fill.** One question per
   heading that has no graph-derivable answer. This gives a property worth protecting: **the
   question set and the document structure come from one source and cannot drift.** Derive them
   from `templates.ts`, do not hand-write a parallel list.
3. **A `question` message kind** (the fifth kind reserved in BLD-002), rendered as the loudest thing
   in the thread — a question that goes unnoticed is worse than no question. Each carries:
   - the question, in the user's vocabulary;
   - **why it is being asked**, tied to what the agent saw (*"the graph shows a sign-in page, so
     there are accounts — it can't tell me whether these are shoppers or staff"*);
   - **the agent's own best guess, pre-filled and editable** — answering by correcting is far
     cheaper than answering from blank;
   - "That's right" / "Let me rewrite it" / "Skip".
4. **Then draft, from the answers.** A skipped question becomes a TODO — which is now a *real*
   signal, because it means the human declined to answer rather than the machine failed to ask.
5. **Resumable.** Six questions is a sit-down. Persist the interview the way BLD-006 persists a
   thread; leaving and returning must not restart it.
   - **Q3 is open** (README). Assumed: the interview **blocks** drafting. The alternative — draft
     immediately, revise as answers arrive — feels faster and reproduces exactly the
     confident-guess problem this task exists to remove.
6. **Drafts become outcome cards in the thread** (BLD-003), not a hand-off to the Docs panel. "See
   the diff" still opens the Docs panel's diff view; the decision is made in the thread.
7. **The recommendation banner becomes a suggestion chip.** The two-button interrupt at the top of
   the panel goes; "Write the project docs" is one of the empty-state suggestions.
8. **The interview can propose a doc that is not one of the three** — now that BLD-007 exists.
   *"You've mentioned VAT three times; want a `docs/uk-vat.md` I can read on future builds?"* This is
   where the two docs tasks pay off together.

## Acceptance

- [x] A project with no docs → the agent reports coverage, then asks ≥ 4 questions before writing a
      single character of draft. — **7 questions**; pinned by
      `tests/ai/project-review.test.ts` *"stops at the questions, having drafted nothing"*, which also
      asserts exactly one provider call has happened and it was the interview.
- [x] Answering every question produces drafts with **zero** TODOs; skipping three produces exactly
      three, each naming the skipped question. — both halves pinned. ⚠️ See R3: the zero is a
      property of the code *plus* a prompt prohibition, and the one way it can be exceeded has its
      own spec.
- [x] Leaving the panel mid-interview and returning resumes at the same question with prior answers
      intact. — the store gives this on its own (it outlives the panel); `.nodegx/review/interview.json`
      extends it across a restart, and resumes **without a second billed call**. ⚠️ **Half driven.**
      The sidecar was verified *written* during the drive — correct `version`, `projectId`, the seven
      questions, and the answers appearing one per settled question. The **restart** half was not
      exercised, because re-entering a docs run costs another routing turn; `resumeInterview`
      replacing the model turn is still read, not measured.
- [x] The question set changes when `templates.ts` changes — proving they share a source. Pinned by
      `tests-unit/bld-008/interviewQuestions.test.ts`, in both directions: an unclassified heading is
      red, and so is a rule for a heading that no longer exists.
- [x] Rejecting every draft leaves the project byte-identical — pinned again **on the interview
      path**, with a skipped question and an invented fourth document, because that path rewrites
      draft content and adds a model-supplied file name.
- [x] The Docs panel is never *required* to complete a docs run. — already true after BLD-003; each
      draft carries its own Accept / Review changes / Discard in the thread. Verified by reading, not
      driven.

## Register

| # | Finding | State |
|---|---|---|
| R1 | ⚠️ **`ProjectReviewView`'s run ref was never filled, so its Stop button has done nothing since BLD-001.** `start()` sets the ref; `start()` is reachable only from the `!isEmbedded` button and `startImmediately`; the sole mount since BLD-001 is `renderOutcome`'s embedded one, started by `AiAuthoringPanel`. `Stop` was calling `null?.cancel()`. Found because the interview's controls need the same reference. The run now lives on `ProjectReviewStore` beside the state it produces. | ✅ fixed |
| R2 | ⚠️ **A busy flag guarded the work instead of the door.** `run()` publishes `busy: true`, then the no-interview path delegated to `draft()`, whose guard saw its own caller's flag and returned at once — `phase: 'assembling'`, three pending drafts. **Every pre-BLD-008 run spec failed on it**, which is what a suite written against the old flow is for. Guard moved to the public entry point; the loop is a private `runDrafts()`. | ✅ fixed |
| R3 | ⚠️ **The TODO advisory was a mechanism inside the feature arguing against it.** `todoAdvisoryMessage` is sent when a draft carries *no* TODO lines and asks the model to add some. On a fully answered interview "no TODO lines" is acceptance criterion 2's first half, so the advisory is switched off whenever nothing was declined. The residual: a model that ignores the prohibition can still add a line, and the count then exceeds the number of skips. Pinned as a spec rather than fixed — the only fix is deleting the model's own words. | 🟡 stated |
| R4 | ⚠️ **`ReviewDocKind` gained a member and two lookup tables had to be narrowed to stay honest.** `REVIEW_DOC_PATHS` and `DOC_TEMPLATES` are `Record<KnownDocKind, …>`, not `Record<ReviewDocKind, …>`, so indexing them with `proposed` is a compile error rather than an `undefined` that becomes the string `"undefined"` in a file path. A proposed document's path is carried on the draft. | ✅ built |
| R5 | **The interview is the `design` role; the drafting turns stay global.** Deciding what to ask a person about their own product is the act `ScopingSession` performs, and it sets the ceiling on all three documents. `tests-unit/phase-55/roleModels.test.ts` is what caught the new call site — a gate worth knowing about before adding an AI session. | ✅ built |
| R6 | ⚠️ **Sending a new request while an interview is open retires it**, because `retire()` calls `ProjectReviewStore.clear()` and that is AIB-003's contract (a new request *is* the user saying so). The answers are not lost — the sidecar file survives and the next docs request resumes it — but nothing on screen says so at the moment of the send. Worth a sentence in the switcher's vocabulary. | 📋 filed |
| R7 | **The question set is seven, not the task's estimated six.** Three from BRIEF (all of it), three from ARCHITECTURE (data model *why*, backend contracts, decisions), one from CONVENTIONS (what not to do). Pinned exactly rather than as a range, so growth is a decision rather than a drift. | ✅ built |
| R9 | 🔴 **The first cut of the question did not follow the approved mockup, and nobody would have noticed.** It split the question (a `question` activity in the thread) from its controls (a bare box beneath) — which kept the no-duplication property and lost the mockup's `.qcard`: one card holding the eyebrow, the question, its evidence, the guess in an inset well and the answers in a footer band. Rebuilt to the mockup. ⚠️ **The general version is [BLD-017](BLD-017-MOCKUP-FIDELITY.md)** — eight more surfaces where nine tasks were built against the mockup's *structure* without anyone diffing its *CSS*. Raised by Richard, not by a gate. | ✅ fixed |
| R10 | ⚠️ **BLD-002's reservation for `question` was right about its old subject** — "the loudest thing in the thread, because it is the only activity that blocks", written when a question was assumed to be one line of text. Once the controls need a card, the loud treatment belongs to the card and the activity becomes the **transcript** of settled exchanges. `.Question` is now a quiet accent rule; seven accent-ringed boxes stacked would be noise. The phase's recurring shape, for the sixth time. | ✅ built |
| R8 | ✅ **Driven, session 13, $0.0588.** Each of the four things this row said was unmeasured, measured. **Phrasing and guess quality: good** — question 1 asked whether the fixture was a real product or a QA harness, evidenced by *"`/erg-rig` and the unreferenced `erg001-cloud` are pure signal/counter test rigs… with no relation to the Home/Catalog/Settings pages"*, and guessed correctly. **The sit-down at 400px: one question is 501px tall in a 419px viewport** (877px at 248px; 334px at 607px) — a question does not fit on screen at any width this panel ships at, which is what made R11 severe rather than cosmetic. **Contrast: one failure, R12.** ⚠️ Two things remain undriven and are stated rather than claimed: **the drafting turns were deliberately not run** (Richard scoped this drive to routing + interview), so criteria 2 and 5 are still specs; and **resume-across-restart** was not exercised, because re-triggering a docs run costs another routing turn. | ✅ driven |
| R11 | 🔴 **The one card in this panel that blocks arrived below the fold, and the cause was two correct decisions meeting.** Measured at the shipped 400px: when the questions land the thread sits at `scrollTop: 26` of a possible `547` — the eyebrow and the first line of the question visible, `why`, the guess and **all three answer buttons** not. `BuildThread`'s follow-the-tail effect is guarded `if (!anchor || !busy) return`, which is right (scrolling up to read must not be undone by the next token); and `docsTurns` marks the interviewing phase **neither `busy` nor finished**, which is also right (it is waiting on a person, and `busy` would put a heartbeat on a turn that is not working — pinned at `docsTurns.test.ts:79`). So the sole blocking state is the sole state the follow rule declines to follow. Fixed in `InterviewCard`, not `BuildThread`, because only it knows which element is the question — and with `block: 'start'`, the opposite end from the thread's, since the card is taller than the viewport and anchoring its bottom would scroll the question off the top. Verified: `scrollTop` 0 → 1291 unprompted, card top exactly at the viewport top, eyebrow/question/why/guess **100%** visible, the action band 13% — a peeking control, which is the affordance, not the defect. | ✅ fixed |
| R12 | 🔴 **`.Tag` failed AA in light at 3.85:1, and the accent wash is why.** The card lays `--theme-color-primary-bg` over `bg-2`; tinting a surface with the accent moves the surface *toward* the accent, so the accent is the colour that pays most to sit on it. Measured in the running editor, dark / light: `primary` **6.45 / 4.33** on plain bg-2 → **5.23 / 3.85** on the washed card; `fg-default-shy` **5.57 / 5.06** → **4.52 / 4.51**. Light `primary` was already at **4.33** on bg-2 — the same figure `Ghost` is on the design-system list for — so the wash had 0.33 of margin to eat and ate 0.48. Fixed to `--theme-color-primary-highlight`, the ramp's more-contrasting azure in *both* themes: **6.56 / 4.97**. ⚠️ **`.Why` now passes by 0.01** (4.51 light / 4.52 dark) and is left alone deliberately — `fg-default` is what `.Guess` uses, so darkening the evidence would collide two roles the mockup drew apart. **This card has no margin left; anything further laid over it must be re-measured, not reasoned about.** | ✅ fixed |
| R13 | 🔴 **The panel announced three documents, two of which it never writes — and the spec that should have caught it enshrined the bug instead.** On the drive the first sentence read *"I'll draft 3 project documents — docs/ARCHITECTURE.md, docs/COMPONENTS.md, docs/PAGES.md"*, and the review then wrote BRIEF / ARCHITECTURE / CONVENTIONS. Not a model fluke: `decideIntent`'s docs branch built the sentence from `plan.operations[].target`, and `routePlan`'s docs case calls `startProjectReview(project)` and **never reads the plan again**. A sentence derived from a discarded plan is free to disagree with what happens. ⚠️ It carried a *second* falsehood from the same root — "I'll draft", when BLD-008 inverted this route to read → **ask** → draft. `decideIntent`'s own header says it exists to make the uninformative "I'll get started" impossible; it had made a misinformative sentence possible instead. The phase's recurring shape for the seventh time. Fixed to name the three seeds from `ProjectDocs/docsText` and to say the interview comes first. ⚠️ **`tests-unit/bld-001/intent.test.ts` asserted the sentence contained the plan's target** — it passed for the wrong reason and is now inverted: the seeds appear whatever the plan said, and an invented target does not. | ✅ fixed |
| R14 | 📋 **The coverage line reports the budget that did not bind and omits the one that did.** On screen: *"Read 5 of 24 components in full; 19 were not read · 13,293 of 160,000 context characters used"* — which invites the reading that there was budget to read more, and there was. The real constraint is `REVIEW_BUDGET.maxComponentReads: 8`, which the line never mentions. Not a false claim, and the per-component reasons *are* one click away behind "Show what was read" (`assembleProject` distinguishes "read limit reached above it" from "too small to matter"), so this is a juxtaposition worth rewording rather than a defect. Filed because it cost this session real time chasing a selection bug that is not there. | 📋 filed |
| R15 | 📋 **Build item 8 — the proposed fourth document — did not fire, so it is still unexercised.** The interview offered no `proposedDoc` on a project with no docs and an obvious candidate subject. It is optional by construction and the model simply declined, so nothing is known to be wrong; but the branch has now been through a real drive without executing, and `InterviewCard`'s `.Proposal` block has still never been on screen. | 📋 filed |
