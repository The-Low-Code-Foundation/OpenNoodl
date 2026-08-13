/**
 * LGC-010 — the floating block editor's geometry.
 *
 * The Logic Builder stopped being a pane beside the canvas and became a window over the
 * document, because the pane's minimum usable width (304 px of interface rails before a block is
 * drawn) is most of a 13" laptop's node-graph frame. These specs hold what is decidable without
 * a running editor: the arithmetic of placing, moving, resizing and restoring that window.
 *
 * ⚠️ What they cannot hold, and what the drive therefore owns: that `position: fixed` actually
 * escapes the node graph frame's `overflow: hidden`, that a click outside the window reaches the
 * running app, and that Blockly re-measures with the drag. An occluded renderer does not report
 * layout truthfully, so those are screenshots and CDP reads, not assertions.
 */

import {
  applyOverlayDrag,
  clampLogicOverlayRect,
  defaultLogicOverlayRect,
  fromFractions,
  LOGIC_OVERLAY_DEFAULT_FRACTION,
  LOGIC_OVERLAY_MIN_HEIGHT,
  LOGIC_OVERLAY_MIN_WIDTH,
  OVERLAY_HANDLE_CURSOR,
  OVERLAY_RESIZE_HANDLES,
  toFractions,
  type OverlayRect
} from '../../src/editor/src/views/nodegrapheditor/logicOverlayGeometry';

/** A 13" MacBook's editor window, which is the machine this task exists because of. */
const LAPTOP = { width: 1440, height: 800 };

describe('LGC-010 — defaultLogicOverlayRect', () => {
  it('opens large and centred, with a margin that says there is something behind it', () => {
    const rect = defaultLogicOverlayRect(LAPTOP);

    expect(rect.width).toBe(Math.round(1440 * LOGIC_OVERLAY_DEFAULT_FRACTION));
    expect(rect.height).toBe(Math.round(800 * LOGIC_OVERLAY_DEFAULT_FRACTION));
    // Centred: the margin either side is equal.
    expect(rect.left).toBe(Math.round((1440 - rect.width) / 2));
    expect(rect.top).toBe(Math.round((800 - rect.height) / 2));
  });

  it('is far wider than the pane it replaced could ever have been', () => {
    // The pane took its width out of the node-graph frame, which under the default `horizontal`
    // layout is about half the document. This is the whole argument for the change, as a number.
    const paneWouldHaveHad = LAPTOP.width / 2;
    expect(defaultLogicOverlayRect(LAPTOP).width).toBeGreaterThan(paneWouldHaveHad);
  });

  it('never opens below the minimums, even on a viewport smaller than they are', () => {
    // 82% of 700 is 574, which is under the 640 floor.
    const rect = defaultLogicOverlayRect({ width: 700, height: 380 });
    expect(rect.width).toBe(LOGIC_OVERLAY_MIN_WIDTH);
    expect(rect.height).toBe(LOGIC_OVERLAY_MIN_HEIGHT);
  });

  it('lets the viewport beat the minimums rather than opening off screen', () => {
    // A 640 px floor on a 400 px viewport is not a floor, it is an unreachable window.
    const rect = defaultLogicOverlayRect({ width: 400, height: 260 });
    expect(rect.width).toBeLessThanOrEqual(400);
    expect(rect.height).toBeLessThanOrEqual(260);
    expect(rect.left).toBeGreaterThanOrEqual(0);
  });
});

describe('LGC-010 — clampLogicOverlayRect', () => {
  it('keeps the title bar reachable when the window is pushed off the right edge', () => {
    // Shoving the window aside to see the canvas is a supported move; losing it is not.
    const rect = clampLogicOverlayRect({ left: 5000, top: 100, width: 900, height: 500 }, LAPTOP);
    expect(rect.left).toBeLessThan(LAPTOP.width);
    expect(rect.left + rect.width).toBeGreaterThan(LAPTOP.width);
  });

  it('never lets the top edge go above the viewport, because that is where the drag handle is', () => {
    const rect = clampLogicOverlayRect({ left: 100, top: -400, width: 900, height: 500 }, LAPTOP);
    expect(rect.top).toBe(0);
  });

  it('shrinks a window restored from a bigger screen to fit this one', () => {
    // The 27"-display case: stored geometry that is wider than the laptop it is reopened on.
    const rect = clampLogicOverlayRect({ left: 0, top: 0, width: 2400, height: 1400 }, LAPTOP);
    expect(rect.width).toBe(LAPTOP.width);
    expect(rect.height).toBe(LAPTOP.height);
  });

  it('clamps the size before the position, so an oversized window is not pushed off the left', () => {
    // Position-then-size would place a 2400px window at left 0 and *then* shrink it, which is
    // fine; size-then-position is what makes the far-right case land correctly too.
    const rect = clampLogicOverlayRect({ left: 1400, top: 700, width: 2400, height: 1400 }, LAPTOP);
    expect(rect.left).toBeGreaterThanOrEqual(0);
    expect(rect.left).toBeLessThanOrEqual(LAPTOP.width);
  });
});

describe('LGC-010 — applyOverlayDrag', () => {
  const origin: OverlayRect = { left: 200, top: 100, width: 900, height: 500 };

  it('moves the window without resizing it', () => {
    const rect = applyOverlayDrag(origin, 'move', 120, -40, LAPTOP);
    expect(rect).toEqual({ left: 320, top: 60, width: 900, height: 500 });
  });

  it('grows from the east edge and leaves the west where it was', () => {
    const rect = applyOverlayDrag(origin, 'e', 150, 0, LAPTOP);
    expect(rect.left).toBe(200);
    expect(rect.width).toBe(1050);
  });

  it('grows from the west edge by moving it, not by moving the window', () => {
    const rect = applyOverlayDrag(origin, 'w', -150, 0, LAPTOP);
    expect(rect.left).toBe(50);
    expect(rect.width).toBe(1050);
    // The right edge is the anchor and must not have moved.
    expect(rect.left + rect.width).toBe(origin.left + origin.width);
  });

  it('pins the west edge against the minimum rather than walking it through the east one', () => {
    // 🔴 The failure an unanchored `Math.max(width, min)` produces: the window slides away from
    // the pointer instead of stopping. Dragged 5000px right, the left edge must land exactly at
    // `right - minWidth` and the right edge must still be where it started.
    const rect = applyOverlayDrag(origin, 'w', 5000, 0, LAPTOP);
    const right = origin.left + origin.width;

    expect(rect.width).toBe(LOGIC_OVERLAY_MIN_WIDTH);
    expect(rect.left).toBe(right - LOGIC_OVERLAY_MIN_WIDTH);
    expect(rect.left + rect.width).toBe(right);
  });

  it('pins the north edge against the minimum the same way', () => {
    const rect = applyOverlayDrag(origin, 'n', 5000, 5000, LAPTOP);
    const bottom = origin.top + origin.height;

    expect(rect.height).toBe(LOGIC_OVERLAY_MIN_HEIGHT);
    expect(rect.top).toBe(bottom - LOGIC_OVERLAY_MIN_HEIGHT);
  });

  it('drags both axes from a corner', () => {
    const rect = applyOverlayDrag(origin, 'se', 100, 60, LAPTOP);
    expect(rect).toEqual({ left: 200, top: 100, width: 1000, height: 560 });
  });

  it('drags a corner that moves two edges', () => {
    const rect = applyOverlayDrag(origin, 'nw', -50, -30, LAPTOP);
    expect(rect).toEqual({ left: 150, top: 70, width: 950, height: 530 });
  });

  it('never resizes below the floor from any handle', () => {
    for (const handle of OVERLAY_RESIZE_HANDLES) {
      const rect = applyOverlayDrag(origin, handle, -5000, -5000, LAPTOP);
      expect(rect.width).toBeGreaterThanOrEqual(LOGIC_OVERLAY_MIN_WIDTH);
      expect(rect.height).toBeGreaterThanOrEqual(LOGIC_OVERLAY_MIN_HEIGHT);
    }
  });

  it('gives every resize handle a cursor', () => {
    // A handle with no cursor is a handle nobody finds.
    for (const handle of OVERLAY_RESIZE_HANDLES) {
      expect(OVERLAY_HANDLE_CURSOR[handle]).toBeTruthy();
    }
    expect(OVERLAY_RESIZE_HANDLES).toHaveLength(8);
  });
});

describe('LGC-010 — the stored form', () => {
  it('round-trips a rect through fractions on the same viewport', () => {
    const rect: OverlayRect = { left: 200, top: 100, width: 900, height: 500 };
    expect(fromFractions(toFractions(rect, LAPTOP), LAPTOP)).toEqual(rect);
  });

  it('keeps the window in proportion across a change of screen', () => {
    // Sized on a 27" display, reopened on the laptop. A pixel store would give a window wider
    // than the screen; a fraction store gives one in proportion.
    const big = { width: 2560, height: 1440 };
    const stored = toFractions({ left: 256, top: 144, width: 2048, height: 1152 }, big);
    const restored = fromFractions(stored, LAPTOP);

    expect(restored.width).toBe(Math.round(LAPTOP.width * 0.8));
    expect(restored.height).toBe(Math.round(LAPTOP.height * 0.8));
  });

  it('answers null for anything that is not four finite numbers', () => {
    // `null` rather than a repaired rect: a caller that cannot tell "nothing stored" from
    // "stored nonsense" would place the window somewhere the user never put it.
    expect(fromFractions(null, LAPTOP)).toBeNull();
    expect(fromFractions('0.5', LAPTOP)).toBeNull();
    expect(fromFractions({ left: 0.1, top: 0.1, width: 0.5 }, LAPTOP)).toBeNull();
    expect(fromFractions({ left: 0.1, top: 0.1, width: NaN, height: 0.5 }, LAPTOP)).toBeNull();
  });

  it('treats a zero-size stored window as nothing stored', () => {
    // What a serialisation taken while the element was `display: none` looks like.
    expect(fromFractions({ left: 0, top: 0, width: 0, height: 0 }, LAPTOP)).toBeNull();
  });
});
