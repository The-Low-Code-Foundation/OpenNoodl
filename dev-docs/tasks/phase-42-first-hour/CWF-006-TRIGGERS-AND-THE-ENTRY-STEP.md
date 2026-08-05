# CWF-006 — Two things that work as designed and read as missing

**From:** [TALK-001](TALK-001-THE-CLOUD-WORKFLOW-AUDIT.md) Pile 2. Neither is a bug; both cost the
same confusion a bug would. Affordance work, cheap, do it after the plumbing.
**Status:** open, unowned.

## 1. "Where do I place a Receive node?"

You cannot, and that is correct. Trigger nodes are a **read-only view of backend trigger state**:
drawn onto the canvas from the trigger list, never saved into the definition, and deletable only
via the Triggers panel — deliberately, because a canvas delete is undoable and deleting a backend
trigger is not ([WorkflowDocument.ts:160, 539, 579-582](../../../packages/noodl-editor/src/editor/src/models/workflow/WorkflowDocument.ts#L579-L582),
`addTriggerNodes` in [workflowTriggerNodes.ts](../../../packages/noodl-editor/src/editor/src/models/workflow/workflowTriggerNodes.ts)).
A workflow with no triggers still shows a synthetic **manual entry marker**, which the code
describes as "a positive claim that nothing triggers this"
([WorkflowDocument.ts:607, 643](../../../packages/noodl-editor/src/editor/src/models/workflow/WorkflowDocument.ts#L643)).

Everything is right except that the picker never says so. **Fix:** a non-placeable "Triggers…"
entry in the node picker that opens the Triggers surface, with one line of explanation. The author
looking for a Receive node finds the door instead of concluding the feature is missing.

## 2. "Does Call Function declare the workflow, or call out?"

It calls out. It cannot call another workflow — no such step exists. The confusion is manufactured
by birth: a new workflow is created as a **single bare `call-function` step that is also the
entry**, so the first card on an empty canvas reads as "this declares the workflow callable" when
`entry` is only "the step nothing is wired into"
([WorkflowDocument.ts:103, 157, 200, 218-238](../../../packages/noodl-editor/src/editor/src/models/workflow/WorkflowDocument.ts#L218-L238)).

**Fix, either or both:**
- Don't birth a workflow as a bare call-function. An empty canvas with the entry marker and a
  "add your first step" affordance is more honest than a card that means something it doesn't.
- Label the entry step visibly on the canvas. The text already exists — `'entry step'` is composed
  for the accessible description at [WorkflowDocument.ts:103](../../../packages/noodl-editor/src/editor/src/models/workflow/WorkflowDocument.ts#L103)
  and shows nowhere visually.

## Done when

- The picker has a Triggers entry that opens the Triggers panel and cannot be dropped on the canvas.
- A brand-new workflow does not present a call-function step the author did not ask for.
- The entry step is identifiable from the canvas alone, without reading the property panel.
- Driven live in the editor: create a workflow, read the canvas, and the two questions above answer
  themselves.

## Traps

- ⚠️ "Set as entry step" is described in the code as *the one thing about a workflow that is not*
  … ([WorkflowDocument.ts:218](../../../packages/noodl-editor/src/editor/src/models/workflow/WorkflowDocument.ts#L218)) —
  read that comment in full before changing how entry is chosen. Whatever it says is a constraint
  somebody already paid for.
- Trigger nodes are re-added whenever the trigger set changes ([WorkflowDocument.ts:539](../../../packages/noodl-editor/src/editor/src/models/workflow/WorkflowDocument.ts#L539)).
  A visual change to the entry marker must survive that redraw, not just look right on first paint.
- ⚠️ The canvas must not make trigger nodes look deletable. If the picker gains a Triggers entry,
  check it does not also make them *draggable in* — that is exactly the affordance that would lie.
