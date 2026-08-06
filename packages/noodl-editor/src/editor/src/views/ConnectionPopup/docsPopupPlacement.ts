/**
 * SPR-003 §4 (F94) — where the port explainer goes.
 *
 * Its own module, and import-free, for the reason `portTypes.ts` is: the whole
 * defect is a placement one, it can only otherwise be judged by looking at the
 * running editor, and "flips when it would leave the viewport" is exactly the
 * kind of claim that goes untested and then turns out to flip the wrong way at
 * the one edge nobody hovered. See
 * `tests-unit/connection-popup/docsPopupPlacement.test.ts`.
 *
 * `DocsPopup.tsx` owns everything that needs the DOM: measuring the box and
 * reading the hovered row's rect.
 */

/** Gap between the anchor and the box, and the least breathing room at any edge. */
export const DOCS_POPUP_GAP = 8;
export const DOCS_POPUP_MARGIN = 8;

/**
 * The box's fixed width.
 *
 * ⚠️ Duplicated from `.docsPopup` in `ConnectionPopup.module.scss`, and it has
 * to be: which side of the anchor the box goes on is decided before there is a
 * box to measure. Change one and change the other.
 */
export const DOCS_POPUP_WIDTH = 300;

/** Just the parts of a `DOMRect` this needs, so a test can write one down. */
export interface AnchorRect {
  left: number;
  right: number;
  top: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export interface DocsPopupPlacement {
  left: number;
  top: number;
  maxHeight: number;
}

/**
 * Beside the anchor, on whichever side keeps the box on screen.
 *
 * The anchor is the hovered **port row**, which spans the connection popup, so
 * `right` is the popup's own right edge and the default placement sits outside
 * it rather than over the list the author is reading.
 *
 * Right is preferred because the connection popup opens to the right of its
 * node; the flip is the case that actually matters, since a node near the
 * right-hand panels is where an author spends most of their time.
 */
export function placeDocsPopup(anchor: AnchorRect, height: number, viewport: Viewport): DocsPopupPlacement {
  let left = anchor.right + DOCS_POPUP_GAP;

  if (left + DOCS_POPUP_WIDTH > viewport.width - DOCS_POPUP_MARGIN) {
    left = anchor.left - DOCS_POPUP_GAP - DOCS_POPUP_WIDTH;
  }

  /*
   * The clamp is not belt-and-braces, it is load-bearing twice, and the first
   * version of this function got both wrong until the suite next door said so:
   *
   * - The *flipped* side can overrun too. An anchor off the right of the window
   *   — the connection popup follows its node, and a node can be scrolled past
   *   the edge — flips to a `left` that is still off-screen.
   * - A window narrower than gap + row + gap + box has no side that fits at
   *   all. Overlapping the port list is recoverable; being drawn off the edge
   *   is the defect this whole section is about.
   */
  left = Math.max(DOCS_POPUP_MARGIN, Math.min(left, viewport.width - DOCS_POPUP_MARGIN - DOCS_POPUP_WIDTH));

  // Aligned to the top of the row, then pulled up far enough to fit. `maxHeight`
  // is what stops a long docs body doing the pulling forever: past that it
  // scrolls itself instead.
  const maxHeight = viewport.height - DOCS_POPUP_MARGIN * 2;
  const top = Math.max(
    DOCS_POPUP_MARGIN,
    Math.min(anchor.top, viewport.height - DOCS_POPUP_MARGIN - Math.min(height, maxHeight))
  );

  return { left, top, maxHeight };
}
