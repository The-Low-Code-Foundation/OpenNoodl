# BLD-003 — Decisions live on the thing they decide

**Status:** 📋 not started · **Track A** · ⭐ · after BLD-001 · closes **D2**, **D3**, and the
duplicate-surface half of **D8**

## The defect, measured

**Accept, Reject and Review changes are rendered twice, at once, in different variants.** Both are
visible together in the screenshot this phase started from.

| Surface | Review changes | Accept | Reject |
|---|---|---|---|
| Panel bottom bar ([AiAuthoringPanel.tsx:635-645](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/AiAuthoringPanel.tsx#L635)) | `Ghost` | `Primary` | **`Danger`** |
| Preview document top bar ([AuthoringPreviewDocument.tsx:195-197](../../../packages/noodl-editor/src/editor/src/views/documents/AuthoringPreviewDocument/AuthoringPreviewDocument.tsx#L195)) | `MutedOnLowBg` | `Primary` | **`Danger`** |
| Docs panel ([DocsPanel.tsx:328-330](../../../packages/noodl-editor/src/editor/src/views/panels/DocsPanel/DocsPanel.tsx#L328)) | — | — | `Ghost` ✅ |

Neither AI surface defers to the other, and the panel *opens* the document itself
([AiAuthoringPanel.tsx:263-268](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/AiAuthoringPanel.tsx#L263)) —
so the duplication is not an edge case, it is the normal path.

**Reject is red, and rejecting destroys nothing.** Reject is the absence of an accept call
([:369-383](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/AiAuthoringPanel.tsx#L369));
nothing has been written to the project. The phase-23 law is that red means danger. AIB-004 already
made exactly this call one screen over, and its comment says why:

> *"not red. Nothing has been authored yet, so this throws away a paragraph of text — per the
> phase-23 law, red is for danger, and there is none here."*
> — [ProjectAuthoringView.tsx:1286-1290](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/ProjectAuthoringView.tsx#L1286)

The Docs panel got it right. The two AI surfaces are the outliers.

## Build

1. **Delete the pinned bottom bar.** Accept / See the changes / Discard move onto the **outcome
   card** for that candidate, in the thread, immediately below the sentence describing what is being
   accepted.
2. **One owner, and the rule is mechanical: whichever surface is showing the candidate owns the
   buttons.**
   - Preview document open → the card renders *"Showing on canvas ↗"* and no buttons; the document
     bar holds them.
   - Preview document closed → the card holds them; the document is not on screen to duplicate them.
   - Expanded mode (BLD-009) → one surface shows both, so there is exactly one bar and the rule is
     satisfied trivially. This is why BLD-009 depends on this task and not the reverse.
   - Implement as **one piece of state on the thread**, not two components each guessing. Two
     components guessing is the current bug.
3. **Reject becomes Discard, and is `Ghost`** on both surfaces. Copy: **"Discard"**, not "Reject" —
   it describes what happens (the candidate is dropped) rather than passing judgement, and it
   matches the language the plan path already uses.
4. **Accept's label says what happens**, per the copy rule: *"Add to project"* for a create,
   *"Apply the change"* for an update. `session.mode` already carries the distinction
   ([AiAuthoringPanel.tsx:334-336](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/AiAuthoringPanel.tsx#L334)).
5. **The docs hand-off stops being a hand-off.** `stageReviewDrafts` currently ends with *"N
   documents are waiting in the Docs panel"*
   ([ProjectReviewView.tsx:201-216](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/ProjectReviewView.tsx#L201)).
   Each draft becomes its own outcome card in the thread with Accept / See the diff / Discard. The
   Docs panel keeps its diff view — "See the diff" opens it — but it is no longer where the decision
   is *made*.

## Acceptance

- [ ] With the preview document open and a candidate staged, **exactly one** Accept exists on screen.
      Close the document: still exactly one, now on the card. Driven live, screenshotted both ways.
- [ ] `grep -rn "PrimaryButtonVariant.Danger"` in the Build/preview surfaces returns nothing.
- [ ] Controls live at once ≤ 4 in the staged state (from 8 + 4).
- [ ] Accepting three docs from the thread writes three files and never opens a second panel to do it.
- [ ] Undo still restores in one step for every accept path (unchanged behaviour — pin it).

## Register

| # | Finding | State |
|---|---|---|
| | | |
