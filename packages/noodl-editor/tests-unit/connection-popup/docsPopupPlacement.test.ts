/**
 * SPR-003 §4 (F94) — where the port explainer goes.
 *
 * The defect was that it went nowhere in particular: the host it portals into
 * had `bottom: 2px` and no `left`, so it drew in the bottom-left corner of the
 * window whichever port was hovered. The replacement is arithmetic against the
 * hovered row's rect, and arithmetic that only ever runs behind a hover, at one
 * window size, on one monitor, is arithmetic nobody checks. Hence this.
 *
 * The numbers below are the real geometry: the connection popup is 200px wide
 * (`.popup` in `ConnectionPopup.module.scss`) and the explainer is 300px, so a
 * popup opened anywhere past ~viewport - 516px has to flip.
 */

import {
  DOCS_POPUP_GAP,
  DOCS_POPUP_MARGIN,
  DOCS_POPUP_WIDTH,
  placeDocsPopup
} from '../../src/editor/src/views/ConnectionPopup/docsPopupPlacement';

/** A 1440x900 editor window — a laptop, which is what the alpha is driven on. */
const VIEWPORT = { width: 1440, height: 900 };

/** A port row in a connection popup whose left edge is at `x`. */
function portRow(x: number, y: number) {
  return { left: x, right: x + 200, top: y };
}

describe('SPR-003 F94 — horizontal placement', () => {
  it('sits to the right of the port row when there is room', () => {
    const row = portRow(400, 300);
    expect(placeDocsPopup(row, 120, VIEWPORT).left).toBe(row.right + DOCS_POPUP_GAP);
  });

  it('flips to the left when the right side would leave the viewport', () => {
    // A node dragged over against the right-hand panels — the common case, and
    // the one Richard hit.
    const row = portRow(1150, 300);
    const placement = placeDocsPopup(row, 120, VIEWPORT);

    expect(placement.left).toBe(row.left - DOCS_POPUP_GAP - DOCS_POPUP_WIDTH);
    expect(placement.left + DOCS_POPUP_WIDTH).toBeLessThanOrEqual(VIEWPORT.width - DOCS_POPUP_MARGIN);
  });

  it('clamps the flipped side too, for an anchor scrolled off the right', () => {
    // The connection popup follows its node, and a node can be dragged or
    // scrolled past the window edge. The first version of `placeDocsPopup`
    // flipped this one to `1142` and drew 10px of it off the screen.
    const placement = placeDocsPopup(portRow(1450, 300), 120, VIEWPORT);
    expect(placement.left).toBe(VIEWPORT.width - DOCS_POPUP_MARGIN - DOCS_POPUP_WIDTH);
  });

  it('never leaves the box hanging off either edge, at any anchor position', () => {
    for (let x = -100; x <= VIEWPORT.width + 100; x += 10) {
      const placement = placeDocsPopup(portRow(x, 300), 120, VIEWPORT);
      expect(placement.left).toBeGreaterThanOrEqual(DOCS_POPUP_MARGIN);
      expect(placement.left + DOCS_POPUP_WIDTH).toBeLessThanOrEqual(VIEWPORT.width - DOCS_POPUP_MARGIN);
    }
  });

  it('overlaps the port list rather than going off-screen when neither side fits', () => {
    // A window narrower than gap + row + gap + box. Covering part of the list
    // is recoverable — moving the mouse closes the explainer. Being drawn off
    // the edge is the defect this section exists to fix.
    const narrow = { width: 500, height: 900 };
    const placement = placeDocsPopup(portRow(150, 300), 120, narrow);

    expect(placement.left).toBe(DOCS_POPUP_MARGIN);
    expect(placement.left + DOCS_POPUP_WIDTH).toBeLessThanOrEqual(narrow.width - DOCS_POPUP_MARGIN);
  });
});

describe('SPR-003 F94 — vertical placement', () => {
  it('aligns with the top of the port row when the box fits below it', () => {
    expect(placeDocsPopup(portRow(400, 300), 120, VIEWPORT).top).toBe(300);
  });

  it('is pulled up so a tall box near the bottom stays on screen', () => {
    const placement = placeDocsPopup(portRow(400, 800), 300, VIEWPORT);

    expect(placement.top).toBe(VIEWPORT.height - DOCS_POPUP_MARGIN - 300);
    expect(placement.top + 300).toBeLessThanOrEqual(VIEWPORT.height - DOCS_POPUP_MARGIN);
  });

  it('scrolls rather than climbing off the top when the docs are taller than the window', () => {
    const placement = placeDocsPopup(portRow(400, 500), 5000, VIEWPORT);

    expect(placement.top).toBe(DOCS_POPUP_MARGIN);
    expect(placement.maxHeight).toBe(VIEWPORT.height - DOCS_POPUP_MARGIN * 2);
  });

  it('keeps the box inside the window for any row position and any height', () => {
    for (let y = -50; y <= VIEWPORT.height + 50; y += 25) {
      for (const height of [40, 120, 400, 890, 2000]) {
        const placement = placeDocsPopup(portRow(400, y), height, VIEWPORT);
        const drawn = Math.min(height, placement.maxHeight);

        expect(placement.top).toBeGreaterThanOrEqual(DOCS_POPUP_MARGIN);
        expect(placement.top + drawn).toBeLessThanOrEqual(VIEWPORT.height - DOCS_POPUP_MARGIN);
      }
    }
  });
});

describe('SPR-003 F94 — the width is duplicated, so say so out loud', () => {
  it('matches `.docsPopup` in the stylesheet', () => {
    // The side is chosen before the box exists to be measured, so the width has
    // to be known in JS. This is the assertion that catches the stylesheet
    // moving on without it.
    const fs = require('fs');
    const path = require('path');
    const scss = fs.readFileSync(
      path.resolve(__dirname, '../../src/editor/src/views/ConnectionPopup/ConnectionPopup.module.scss'),
      'utf8'
    );
    const block = scss.slice(scss.indexOf('.docsPopup'));
    const width = /width:\s*(\d+)px/.exec(block);

    expect(width).not.toBeNull();
    expect(Number(width[1])).toBe(DOCS_POPUP_WIDTH);
  });
});
