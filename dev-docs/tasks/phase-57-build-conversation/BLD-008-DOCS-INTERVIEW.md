# BLD-008 — Docs are a conversation

**Status:** 🟡 built, not driven · **Track A** · ⭐ · after BLD-001, BLD-007 · closes **D8**

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
      extends it across a restart, and resumes **without a second billed call**. Not yet driven.
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
| R8 | 📋 **Not driven.** Every criterion above is a spec, not a measurement. The interview has never been on screen: the phrasing, the guess quality, the length of the sit-down at 400px, and the `.Question` treatment's contrast are all unmeasured. **BLD-010 or a session-12 drive.** ⚠️ The editor has a live Anthropic key, so a drive costs money. | 📋 open |
