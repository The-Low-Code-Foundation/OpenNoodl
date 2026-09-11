# BLD-003 — Decisions live on the thing they decide

**Status:** ✅ **built, driven and closed 2026-08-09** (`49d06961`, `eb23291c`) · **Track A** · ⭐ ·
after BLD-001 · **closes D2, D3** and the duplicate-surface half of **D8**

**Driven live in `ai-test` from a provably empty thread**, all three surfaces, screenshots both ways.
**B5's measurement is answered:** where there were **2 Accept and 2 Review changes** with the two
copies disagreeing on wording, there is now **exactly one of each**, and it moves between surfaces as
the document opens and closes.

⚠️ **The build found a third surface the defect table missed.** `ChangeReviewDocument` is reached
*from this card's own "Review changes" button*, carries its own Accept, and a document sits **beside**
the sidebar rather than over it — so scoping the ownership rule to the preview document alone would
have meant this task's own control opened the second Accept it exists to remove. See **C1**.

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

- [x] ✅ With the preview document open and a candidate staged, **exactly one** Accept exists on
      screen. Close the document: still exactly one, now on the card. **Driven live and screenshotted
      both ways** (2026-08-09, `ai-test`, scripted provider). Counted from the DOM, not from the
      picture:

      | State | Accept | Review changes | Discard | Where |
      |---|---|---|---|---|
      | Preview document open | **1** (`Add to project`) | **1** | **1** | preview topbar; card reads *"Open on the preview canvas…"* |
      | Preview closed | **1** (`Add to project`) | **1** | **1** | the outcome card |
      | Review diff open | **1** (`Accept all`) | — | **1** | review topbar; card reads *"Open in the review…"* |

      No `Reject` anywhere, in any state. ⚠️ **The starting state was asserted, not assumed** — zero
      Accept buttons before the send, per session 4's trap 1.
- [x] ✅ `grep -rn "PrimaryButtonVariant.Danger"` in the Build/preview surfaces returns nothing —
      and it is **no longer a grep a human is trusted to run**. `tests-unit/bld-003/decisions.test.ts`
      asserts it over all three surfaces, plus that none of them hard-codes a decision label.
      ⚠️ **Verified by reintroducing the defect** (`label="Reject"` + `Danger` back on the preview
      bar) and watching both guards go red: 2 failed, 14 passed. A guard that has never failed is
      not a guard — [[a-defaulted-parameter-cannot-fail-loudly]] is the same lesson one task over.
- [x] ✅ Controls live at once ≤ 4 in the staged state (from 8 + 4). **Measured: 3 decision controls,
      on one surface.** ⚠️ **Read the number honestly** — the panel also carries `Send` and, on this
      route, BLD-001's `Show me the plan first` override, so **5 interactive controls** are in the
      Build panel with a candidate staged. The 8 + 4 the criterion counts down from were the
      *duplicated decision bars*, and those are now 3 on one surface. The other two are not
      duplicates of anything.
- [ ] Accepting three docs from the thread writes three files and never opens a second panel to do
      it. **Built** (each draft carries Accept / Review changes / Discard; the Docs panel is reached
      by route, not by instruction) — ⚠️ **not driven.** The component route was scripted; the docs
      route needs a review provider this drive did not script, and it is the one half of this task
      that has never been on screen. **BLD-010 owns it, and it should not be assumed to work.**
- [ ] Undo still restores in one step for every accept path (unchanged behaviour — pin it).
      **Untouched by this task**: accept still goes through `DocProposalStore.accept`, whose
      `UndoActionGroup` is unchanged, and the component paths were not modified at all.

## Build notes

**One derivation, not a flag on each component.** The bug was two components each guessing whether
the other was rendering the buttons; a boolean prop threaded to both is that bug with more wiring,
because the two are still free to disagree about what it *means*.
`decisionOwner(currentDocumentId, candidateDocumentIds)` is a total function over the one fact that
decides it, and `useModel(AppRegistry.instance, ['documentChanged'])` is what makes closing the
preview hand the buttons back immediately.

**The copy moved into the same module as the ownership**, because they are two halves of one defect.
The measured symptom was not a wrong string — it was **two surfaces disagreeing about the same
action** (the thread said *Discard*, the preview still said *Reject*), which is worse than either
wording. A spec on a copy module would have passed throughout that: the module was right and one of
its consumers had a literal. Hence the source-level guard.

**`acceptLabel` is deliberately not applied to the review diff.** That document's Accept composes
with a selection — *"Accept all"*, *"Accept 3 of 5"* — so it answers *how much of this?*, not *what
happens to my project?*. "Add to project all" would be worse copy, not better.

## Driving this panel with no provider — what session 5 adds to the recipe

The seam is **`AiClient.chatStream` plus `AiClient.isConfigured`**, hooked on a global and reverted
after (`git checkout --`). Two hook lines are enough for the whole drive, because the fake is then
installed and re-installed from `cdp eval` with no rebuild. Branch on `request.tools`, not on the
prose: `submit_plan` present → return one `create` operation (one component operation is the
`component` route); `submit_component` present → return `{ nodes: [{ id: 'g1', type: 'Group',
parameters: {} }], connections: [], visual_roots: ['g1'] }`.

⚠️ Things that cost time:

- **`stopReason` is `'tool_calls'`**, not `'tool_use'` — the union is `stop | length | tool_calls |
  aborted | unknown`, and the response also needs `text`, `usage` and `model`.
- **The planning turn fired twice** (`submit_plan`, `submit_plan`, then the authoring call) — the
  LAS-006 advisory turn, exactly as session 4 warned. **Count sends by request, never by call.**
- **`cdp click` has no `:has-text`.** Tag the button from `eval` (`setAttribute('data-drive',…)`),
  then click the attribute selector — and one click per `eval`, per the CAN/BEN trap.
- **Assert the empty thread by counting Accept buttons, not `Turn` elements.** The selector
  `[class*=BuildThread-module__Turn]` also matches the **`Turns` container**, so an empty thread
  reports `1`. That is a substring match reading as a turn that is not there.

## Register

| # | Finding | State |
|---|---|---|
| **C1** | ⚠️ **The defect table listed two surfaces; there are three.** `ChangeReviewDocument` renders its own Accept and a red Reject, it is reached from this card's own *"Review changes"* button, and a document sits **beside** the sidebar rather than over it — so with the review open, the card's Accept and the document's Accept were both on screen. Scoping the rule to the preview document alone would have left this task's own control opening the duplicate it exists to remove. Fixed by making the rule take *every document that shows the candidate*, and by passing `rejectLabel` / `isRejectDangerous: false` on the **caller** rather than changing a shared component's defaults (AIB-004 used the same flags one screen over, for the same reason). | ✅ **fixed in flight** |
| **C2** | ⚠️ **The preview document's prop was `onReject`, and `openDocument` takes `props?: any`.** Renaming it to `onDiscard` is unchecked by `tsc` in both directions — a missed call site would compile and the button would silently do nothing. There is exactly one call site and it was updated with the rename; the risk is recorded because the *next* prop added to this document has the same hole. **The document boundary is untyped and nothing in this repo closes it.** | **filed** — a typed `openDocument` is nobody's task yet |
| **C3** | The docs drafts stage **automatically** when the run finishes, rather than behind *"Review N drafts in the Docs panel"*. That button was asking permission to prepare a diff: `proposeDocChange` writes nothing, so there was no decision to gate. Residual, narrow and deliberate: the "already staged" guard is a per-mount ref plus a check of the proposal store, and a **remount after every draft has been decided** finds neither, so it would re-offer answered files. Within a session this view never remounts (its turn id is stable); HMR and BLD-009's second host do. | **filed — BLD-009** |
| **C5** | 🔴 ⚠️ **BLD-001's intent-override button is 96px tall and paints 52px over the first turn.** Not this task's control and not found by reading — it is in **both** of this drive's screenshots, overlapping the request text and striking a line through *"I'll build this as one component — Ui/DecisionCard."*. Measured from the DOM: the button's box is `top 151 → bottom 247` (**96px**, where a `PrimaryButton` is ~28), its `Header` ends at **195**, and the header's `overflow` is `visible`, so the excess paints over the scroll area rather than clipping. The likely cause is a stretch — the button's `HStack` parent computes `align-items: normal`, and a flex child with no `align-items: center` grows to the line height — but ⚠️ **that is a hypothesis, not the measurement**: the numbers do not fully close (the button also starts 60px below its own parent's top), so whoever fixes it should re-measure rather than trust this sentence. **The consequence is certain; the mechanism is not.** | **filed — BLD-002** (it owns message treatment and this is the header sitting on top of a message) |
| **C4** | ⚠️ **A retired docs turn keeps its drafts pending but loses its buttons**, by the same id-prefix rule B10 established. That is the correct behaviour and not a regression — the proposals are still in the Docs panel, with its diff view, which is where they lived before this task. Worth stating because "the decision moved into the thread" is only true for the *live* turn. | **accepted, by design** |
