/**
 * BLD-003 — decisions live on the thing they decide, and exactly one surface
 * owns them.
 *
 * Two defects share one cause. **D2:** Accept / Review changes / Reject were
 * rendered by the Build panel *and* by the preview document, at the same time,
 * and neither deferred to the other — the panel *opens* the document itself, so
 * the duplication was the normal path rather than an edge case. **D3:** Reject
 * was `Danger` red on both, and rejecting a candidate destroys nothing; it is
 * the absence of an accept call.
 *
 * ## Why the ownership rule is a function and not a flag on each component
 *
 * The bug was two components each guessing. A boolean prop threaded to both
 * would be the same bug with more wiring — the two would still be free to
 * disagree about what it *meant*. This derives the owner from the one fact that
 * decides it (which document the editor is showing), so "who renders the
 * buttons" has exactly one answer and both surfaces read it from here.
 *
 * The rule is mechanical, and that matters more than which surface wins:
 * **whichever surface is showing the candidate owns the buttons.** The preview
 * document is showing the graph being decided about, so when it is open the
 * decision belongs beside it and the thread's card says where it went. When it
 * is closed the card is the only surface with the candidate on it, so the card
 * holds them. BLD-009's expanded mode shows both in one surface, which satisfies
 * the rule trivially — that is why BLD-009 depends on this task and not the
 * reverse.
 *
 * ## Why the copy lives here too
 *
 * The labels are the other half of the same defect: the two surfaces had drifted
 * to *different words for the same action* (the thread said "Discard", the
 * document still said "Reject"), which is worse than either wording. One export,
 * two importers, and a spec that a reviewer can read.
 *
 * @module AiAssistant/thread/decisions
 */

import type { AuthoringMode } from '../authoring';

/** Which surface renders Accept / Review changes / Discard right now. */
export type DecisionOwner = 'thread' | 'document';

/**
 * Who owns the decision, given what the editor is currently showing.
 *
 * `currentDocumentId` is `AppRegistry.instance.CurrentDocumentId`.
 * `candidateDocumentIds` is every document that puts the candidate itself on
 * screen — the live preview canvas, and the change-review diff. Both carry
 * their own action bar, and **a document does not cover the sidebar**: it sits
 * beside it, so a card that kept its buttons while either was open is the
 * duplication D2 names, not a hidden one.
 *
 * The ids are parameters rather than imports because this module is pure — it
 * is graded in the plain-Node runner, and reaching a document provider would
 * drag a React tree and an editor singleton in behind it.
 *
 * An `undefined` current id (nothing opened yet, which is the state at boot) is
 * not one of them, so the thread owns — the honest default, because the thread
 * is the surface that is definitely on screen.
 */
export function decisionOwner(
  currentDocumentId: string | undefined | null,
  candidateDocumentIds: readonly string[]
): DecisionOwner {
  return currentDocumentId != null && candidateDocumentIds.includes(currentDocumentId) ? 'document' : 'thread';
}

/**
 * What Accept does, said as what happens rather than as a verdict.
 *
 * `AuthoringSession.mode` already carries the distinction and nothing else had
 * to be invented for it: a create adds a component that was not there, an
 * update replaces one that was. "Accept" describes neither, and the difference
 * is the one a user wants before they click — an update is the one that changes
 * something they already have.
 */
export function acceptLabel(mode: AuthoringMode): string {
  return mode === 'update' ? 'Apply the change' : 'Add to project';
}

/**
 * D3 — the copy correction, in one place.
 *
 * "Discard" describes what happens (the candidate is dropped); "Reject" passes
 * judgement on work the user asked for. It is also the word the plan path
 * already uses, and AIB-004 made exactly this call one screen over:
 *
 * > *"not red. Nothing has been authored yet … per the phase-23 law, red is for
 * > danger, and there is none here."*
 */
export const DISCARD_LABEL = 'Discard';

/** One wording for the diff, on both surfaces. */
export const REVIEW_LABEL = 'Review changes';

/**
 * What the thread's card says while a document owns the decision.
 *
 * It names the surface that has the buttons rather than going quiet: a card
 * that simply dropped its controls reads as a candidate that can no longer be
 * accepted, which is the opposite of what happened.
 */
export const ON_CANVAS_NOTE = 'Open on the preview canvas — accept or discard it there.';

/** The same, for the change-review diff. Two documents, two true sentences. */
export const ON_REVIEW_NOTE = 'Open in the review — accept or discard it there.';
