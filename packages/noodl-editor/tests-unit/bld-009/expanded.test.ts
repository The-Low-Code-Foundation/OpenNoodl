/**
 * BLD-009 — the rules of the second host.
 *
 * Expanded mode is overwhelmingly a layout, and a layout is graded in a running
 * editor with a ruler. What is graded here is the part that has no appearance
 * and that a screenshot therefore cannot catch: **when the offer is allowed to
 * exist, and which of the two hosts is the live one.**
 *
 * The second of those is the task file's own trap — *"make sure only one thread
 * instance is live at a time, or two subscriptions will both drive the same
 * store and the activity feed will double"*. A doubled feed looks, on screen,
 * like an agent that repeated itself.
 */

import {
  COLLAPSE_LABEL,
  EXPAND_LABEL,
  EXPAND_SUGGESTION_THRESHOLD,
  expandSuggestion,
  shouldOfferExpanding,
  threadHost
} from '../../src/editor/src/models/AiAssistant/thread/expanded';

const EXPANDED_ID = 'ExpandedBuildDocumentProvider';

describe('BLD-009 the one-time offer of the wider host', () => {
  it('is silent until a plan is bigger than the panel comfortably holds', () => {
    expect(shouldOfferExpanding({ operationCount: 0, isExpanded: false, offered: false })).toBe(false);
    expect(shouldOfferExpanding({ operationCount: 1, isExpanded: false, offered: false })).toBe(false);
    expect(shouldOfferExpanding({ operationCount: 3, isExpanded: false, offered: false })).toBe(false);
  });

  it('offers on the first plan that exceeds the threshold', () => {
    expect(shouldOfferExpanding({ operationCount: 4, isExpanded: false, offered: false })).toBe(true);
    expect(shouldOfferExpanding({ operationCount: 7, isExpanded: false, offered: false })).toBe(true);
  });

  it('reads "more than ~3" as strictly more, so three operations is quiet', () => {
    // The threshold is a shipped constant and this is the boundary it decides.
    // Written as an equality against the export rather than the literal `3`, so
    // moving the constant moves this spec with it instead of silently
    // contradicting it.
    expect(
      shouldOfferExpanding({ operationCount: EXPAND_SUGGESTION_THRESHOLD, isExpanded: false, offered: false })
    ).toBe(false);
    expect(
      shouldOfferExpanding({ operationCount: EXPAND_SUGGESTION_THRESHOLD + 1, isExpanded: false, offered: false })
    ).toBe(true);
  });

  it('never offers what the user is already looking at', () => {
    expect(shouldOfferExpanding({ operationCount: 12, isExpanded: true, offered: false })).toBe(false);
  });

  it('is one-time — an answered offer stays answered, however big the next plan', () => {
    // ⚠️ The half that is easy to miss: `offered` is set by *accepting* the
    // offer as well as by dismissing it. A user who has expanded once has found
    // the control, and re-offering it is the nag build item 5 rules out.
    expect(shouldOfferExpanding({ operationCount: 40, isExpanded: false, offered: true })).toBe(false);
  });

  it('names the number, because the number is the reason', () => {
    // Rule 5 — the sentence has to carry evidence the user can check against
    // what is on screen, not an opinion about what they would prefer.
    expect(expandSuggestion(7)).toContain('7 operations');
  });
});

describe('BLD-009 which host is live', () => {
  it('is the document exactly while the expanded document is the one on screen', () => {
    expect(threadHost(EXPANDED_ID, EXPANDED_ID)).toBe('document');
  });

  it('is the panel for every other document, including the ones this panel opens itself', () => {
    expect(threadHost('EditorDocumentProvider', EXPANDED_ID)).toBe('panel');
    expect(threadHost('AuthoringPreviewDocumentProvider', EXPANDED_ID)).toBe('panel');
    expect(threadHost('ChangeReviewDocumentProvider', EXPANDED_ID)).toBe('panel');
  });

  it('is the panel at boot, when nothing has been opened yet', () => {
    // The honest default, and the same one `decisionOwner` takes: the panel is
    // the surface that is definitely on screen.
    expect(threadHost(undefined, EXPANDED_ID)).toBe('panel');
    expect(threadHost(null, EXPANDED_ID)).toBe('panel');
  });
});

describe('BLD-009 one action, one wording', () => {
  it('gives the two surfaces different sentences for the two directions', () => {
    // BLD-003's drift, pre-empted: the panel header and the document top bar
    // render opposite halves of one action, and two hand-written labels are how
    // "Discard" and "Reject" happened.
    expect(EXPAND_LABEL).not.toEqual(COLLAPSE_LABEL);
    expect(EXPAND_LABEL.length).toBeGreaterThan(0);
    expect(COLLAPSE_LABEL.length).toBeGreaterThan(0);
  });
});
