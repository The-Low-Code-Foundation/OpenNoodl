# BLD-008 — Docs are a conversation

**Status:** 📋 not started · **Track A** · ⭐ · after BLD-001, BLD-007 · closes **D8**

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

- [ ] A project with no docs → the agent reports coverage, then asks ≥ 4 questions before writing a
      single character of draft.
- [ ] Answering every question produces drafts with **zero** TODOs; skipping three produces exactly
      three, each naming the skipped question.
- [ ] Leaving the panel mid-interview and returning resumes at the same question with prior answers
      intact.
- [ ] The question set changes when `templates.ts` changes — proving they share a source. Pin with a
      spec.
- [ ] Rejecting every draft leaves the project byte-identical (existing property — pin it).
- [ ] The Docs panel is never *required* to complete a docs run.

## Register

| # | Finding | State |
|---|---|---|
| | | |
