/**
 * BLD-003 — decisions live on the thing they decide.
 *
 * Two halves, and they need different kinds of check.
 *
 * The **ownership** half is a total function, and that is the whole design: the
 * bug was two components each guessing whether the other was rendering the
 * buttons, so the fix is a derivation with exactly one answer per input. What is
 * worth pinning is not that it returns 'preview' for the preview id — that is a
 * comparison — but that it is *total*, so "both surfaces render" and "neither
 * renders" are unrepresentable rather than merely unlikely.
 *
 * The **copy** half cannot be protected by a pure spec at all, and that matters
 * more here than it looks. The measured defect was not a wrong string; it was
 * *two surfaces disagreeing about the same action* — the thread said "Discard"
 * while the preview document still said "Reject", because the D3 correction
 * landed on one surface only. A spec on the copy module would have passed
 * throughout: the module was right, and one of its two consumers had a
 * hard-coded string. So the last block reads the surfaces themselves. That is
 * BLD-003's own acceptance criterion ("`grep -rn "PrimaryButtonVariant.Danger"`
 * in the Build/preview surfaces returns nothing") turned from an instruction a
 * human is trusted to run into a gate that runs itself.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import {
  acceptLabel,
  decisionOwner,
  DISCARD_LABEL,
  ON_CANVAS_NOTE,
  ON_REVIEW_NOTE,
  REVIEW_LABEL
} from '@noodl-models/AiAssistant/thread';

const PREVIEW_ID = 'AuthoringPreviewDocumentProvider';
const REVIEW_ID = 'ChangeReviewDocumentProvider';
/** Every document that puts the candidate itself on screen. */
const CANDIDATE_SURFACES = [PREVIEW_ID, REVIEW_ID];

describe('decisionOwner', () => {
  it('gives the preview document the decision while it is open', () => {
    expect(decisionOwner(PREVIEW_ID, CANDIDATE_SURFACES)).toBe('document');
  });

  it('gives the review diff the decision too', () => {
    // The easy one to miss: the review is reached *from* the card's own
    // "Review changes" button, and a document sits beside the sidebar rather
    // than over it — so leaving it out would mean this task's own control
    // opened a second Accept.
    expect(decisionOwner(REVIEW_ID, CANDIDATE_SURFACES)).toBe('document');
  });

  it('gives the thread the decision for a document that is not showing the candidate', () => {
    expect(decisionOwner('EditorDocumentProvider', CANDIDATE_SURFACES)).toBe('thread');
  });

  it('gives the thread the decision before any document has opened', () => {
    // The state at boot. Nothing is showing the candidate, and the thread is
    // the surface that is definitely on screen — so it owns rather than nothing
    // owning, which would strand a staged candidate with no way to accept it.
    expect(decisionOwner(undefined, CANDIDATE_SURFACES)).toBe('thread');
    expect(decisionOwner(null, CANDIDATE_SURFACES)).toBe('thread');
  });

  it('never leaves a candidate with no owner', () => {
    // The half of the invariant that a "hide the buttons when a document is
    // open" flag gets wrong: every input resolves to a surface that renders
    // them, so there is no document id for which the decision disappears.
    const ids = [...CANDIDATE_SURFACES, 'EditorDocumentProvider', '', undefined, null];
    const owners = ids.map((id) => decisionOwner(id, CANDIDATE_SURFACES));
    expect(owners.every((owner) => owner === 'thread' || owner === 'document')).toBe(true);
  });

  it('takes no owner when nothing is declared a candidate surface', () => {
    // A caller that forgets the list does not silently hand the decision to a
    // document — it keeps it on the thread, which is the surface that can
    // always render it.
    expect(decisionOwner(PREVIEW_ID, [])).toBe('thread');
  });
});

describe('acceptLabel', () => {
  it('says what happens rather than passing a verdict', () => {
    expect(acceptLabel('create')).toBe('Add to project');
    expect(acceptLabel('update')).toBe('Apply the change');
  });

  it('distinguishes the mode that changes something the user already has', () => {
    // The point of the copy rule: an update is the risky one, and "Accept"
    // said nothing about which of the two you were about to do.
    expect(acceptLabel('create')).not.toBe(acceptLabel('update'));
  });
});

describe('the decision copy', () => {
  it('never calls discarding a rejection', () => {
    expect(DISCARD_LABEL).toBe('Discard');
    expect(DISCARD_LABEL).not.toMatch(/reject/i);
  });

  it('names where the buttons went rather than going quiet', () => {
    // A card that simply dropped its controls reads as a candidate that can no
    // longer be accepted — the opposite of what happened. Each note names the
    // surface that actually has them, so the two are not interchangeable.
    expect(ON_CANVAS_NOTE).toMatch(/preview canvas/i);
    expect(ON_REVIEW_NOTE).toMatch(/review/i);
    expect(ON_CANVAS_NOTE).not.toBe(ON_REVIEW_NOTE);
    expect(REVIEW_LABEL).toBe('Review changes');
  });
});

describe('the surfaces that render decisions', () => {
  const SRC = join(__dirname, '..', '..', 'src', 'editor', 'src');
  const SURFACES = [
    join(SRC, 'views', 'panels', 'AiAuthoringPanel', 'AiAuthoringPanel.tsx'),
    join(SRC, 'views', 'documents', 'AuthoringPreviewDocument', 'AuthoringPreviewDocument.tsx'),
    join(SRC, 'views', 'panels', 'AiAuthoringPanel', 'ProjectReviewView.tsx')
  ];

  /**
   * Comments discuss `Danger` and "Reject" on purpose — the reason for the
   * correction is worth keeping next to it. Only code is graded.
   */
  function code(path: string): string {
    return readFileSync(path, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
  }

  it.each(SURFACES)('renders no red decision button: %s', (path) => {
    expect(code(path)).not.toContain('PrimaryButtonVariant.Danger');
  });

  it.each(SURFACES)('hard-codes none of the decision labels: %s', (path) => {
    // The regression this catches is the one that actually happened: a
    // correction applied to one surface's literal string while the other kept
    // its own copy. Going through the module is what makes them one decision.
    const source = code(path);
    expect(source).not.toMatch(/label="Reject"/);
    expect(source).not.toMatch(/label="Discard"/);
    expect(source).not.toMatch(/label="Accept"/);
    expect(source).not.toMatch(/label="Review changes"/);
  });
});
