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
  LOGIC_OVERLAY_PANEL_RESERVE,
  moveLogicOverlayClearOf,
  OVERLAY_HANDLE_CURSOR,
  OVERLAY_RESIZE_HANDLES,
  placeLogicOverlayInFrame,
  rectsIntersect,
  sidePanelRegion,
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

/* ===========================================================================================
   VFN-005 — the app is behind the window.

   Every fixture below is the geometry the 2026-08-13 drive actually measured, not an invented
   one: viewport 1368×781, the running app's preview at 392,112 976×313, the window at 140,214
   1014×543, and `elementFromPoint` at the preview's centre answering the window's Blockly
   background. The node graph frame is what is left over — the column the side panel does not
   have, below the band the preview does.

   🔴 Every "clear of" assertion here is paired with the placement it replaced, asserted to be
   the opposite. A suite of absences is indistinguishable from an instrument that cannot see an
   overlap, so `defaultLogicOverlayRect` is asserted to *intersect* both regions in the same
   spec that asserts the new placement does not.
   =========================================================================================== */

/** The viewport the report was measured on: a 13" MacBook with the editor maximised. */
const DRIVEN = { width: 1368, height: 781 };

/** The running app, as measured. A full-width **band**, not a half — which is why snap was ruled out. */
const PREVIEW: OverlayRect = { left: 392, top: 112, width: 976, height: 313 };

/** The rail and the side panel: everything to the left of the node graph frame. */
const DOCK: OverlayRect = { left: 0, top: 0, width: 392, height: DRIVEN.height };

/** What is left: the node graph frame, in viewport coordinates. This is the window's home. */
const FRAME: OverlayRect = { left: 392, top: 425, width: 976, height: 356 };

describe('VFN-005 — rectsIntersect', () => {
  it('sees an overlap', () => {
    expect(rectsIntersect({ left: 0, top: 0, width: 100, height: 100 }, { left: 50, top: 50, width: 100, height: 100 }))
      .toBe(true);
  });

  it('does not count a shared edge as an overlap', () => {
    // The window placed exactly at the frame's left edge is clear of the dock, not half in it.
    // A `<=` here would make every "clear" placement report a collision and every remedy below
    // would be measuring the wrong thing.
    expect(rectsIntersect({ left: 0, top: 0, width: 100, height: 100 }, { left: 100, top: 0, width: 100, height: 100 }))
      .toBe(false);
    expect(rectsIntersect({ left: 0, top: 0, width: 100, height: 100 }, { left: 0, top: 100, width: 100, height: 100 }))
      .toBe(false);
  });
});

describe('VFN-005 — placeLogicOverlayInFrame', () => {
  it('🔴 leaves the running app and the side panel whole, where the centred default covered both', () => {
    const home = placeLogicOverlayInFrame(FRAME, DRIVEN);

    expect(rectsIntersect(home, PREVIEW)).toBe(false);
    expect(rectsIntersect(home, DOCK)).toBe(false);

    // 🔴 The control, in the same spec: the placement this replaces intersects both. Without
    // these two lines the assertions above are indistinguishable from an `rectsIntersect` that
    // always answers `false` — which is exactly the failure mode this phase keeps hitting.
    const before = defaultLogicOverlayRect(DRIVEN);
    expect(rectsIntersect(before, PREVIEW)).toBe(true);
    expect(rectsIntersect(before, DOCK)).toBe(true);
  });

  it('is still a real window — well over the floor on the machine the report came from', () => {
    // "Get out of the way" must not quietly become "be too small to use". The frame on the
    // driven fixture is 976×356, so the window is 952×332 after the margin.
    const home = placeLogicOverlayInFrame(FRAME, DRIVEN);

    expect(home).toEqual({ left: 404, top: 437, width: 952, height: 332 });
    expect(home.width).toBeGreaterThanOrEqual(LOGIC_OVERLAY_MIN_WIDTH);
    expect(home.height).toBeGreaterThanOrEqual(LOGIC_OVERLAY_MIN_HEIGHT);
  });

  it('overhangs a frame smaller than the floor rather than shrinking below it', () => {
    // The divider dragged down until the node graph is a strip. 640 × 320 is argued — 152 + 152
    // of interface rails plus ~90 of toolbox before a block is drawn — so the floor wins and the
    // window hangs over the frame's edges, centred on it.
    const strip: OverlayRect = { left: 392, top: 600, width: 976, height: 181 };
    const home = placeLogicOverlayInFrame(strip, DRIVEN);

    expect(home.height).toBe(LOGIC_OVERLAY_MIN_HEIGHT);
    // Centred on the frame, so it takes as much from above as below. Within a pixel: the rect is
    // rounded because it is printed into CSS and read back in an inspector.
    expect(Math.abs(home.top + home.height / 2 - (strip.top + strip.height / 2))).toBeLessThanOrEqual(1);
  });

  it('overhangs a narrow frame too — the floor beats the frame in both axes', () => {
    const narrow: OverlayRect = { left: 392, top: 425, width: 400, height: 356 };
    const home = placeLogicOverlayInFrame(narrow, DRIVEN);

    expect(home.width).toBe(LOGIC_OVERLAY_MIN_WIDTH);
    expect(Math.abs(home.left + home.width / 2 - (narrow.left + narrow.width / 2))).toBeLessThanOrEqual(1);
  });

  it('is still inside the viewport clamp, so the title bar stays reachable', () => {
    // A frame reported off-screen — a stale measurement taken mid-layout — must not put the
    // window somewhere with nothing to grab.
    const offscreen: OverlayRect = { left: 4000, top: 3000, width: 900, height: 500 };
    const home = placeLogicOverlayInFrame(offscreen, DRIVEN);

    expect(home.left).toBeLessThanOrEqual(DRIVEN.width - 96);
    expect(home.top).toBeGreaterThanOrEqual(0);
    expect(home.top).toBeLessThanOrEqual(DRIVEN.height - 96);
  });

  it('🔴 falls back to the centred default for every frame it cannot believe', () => {
    // `strictNullChecks` is OFF in this package, so `frame: OverlayRect | null` is documentation
    // and nothing else. The behaviour is held here instead. A 0×0 box is what an unattached or
    // fully collapsed frame measures, and a renderer that was occluded through the layout can
    // report exactly that; NaN is what a mid-teardown element gives back.
    const fallback = defaultLogicOverlayRect(DRIVEN);

    expect(placeLogicOverlayInFrame(null, DRIVEN)).toEqual(fallback);
    expect(placeLogicOverlayInFrame(undefined as unknown as OverlayRect, DRIVEN)).toEqual(fallback);
    expect(placeLogicOverlayInFrame({ left: 0, top: 0, width: 0, height: 0 }, DRIVEN)).toEqual(fallback);
    expect(placeLogicOverlayInFrame({ left: NaN, top: 0, width: 900, height: 500 }, DRIVEN)).toEqual(fallback);
    expect(placeLogicOverlayInFrame({ left: 0, top: 0, width: -900, height: 500 }, DRIVEN)).toEqual(fallback);
  });
});

describe('VFN-005 — sidePanelRegion', () => {
  it('takes the frame\'s own left edge when a panel is open and wider than the reserve', () => {
    expect(sidePanelRegion(FRAME.left, DRIVEN)).toEqual({ left: 0, top: 0, width: 392, height: 781 });
  });

  it('🔴 falls back to the reserve when the panel is closed and has not been laid out yet', () => {
    // The VFN-012 case: the button that opened the panel is on the *same tick*, so the frame
    // still starts at the 52px rail. Waiting a tick to measure is not an option — an occluded
    // renderer clamps timers ~1000×. Reserving `RAIL_WIDTH + DEFAULT_PANEL_WIDTH` is the honest
    // synchronous answer; reading 52 here would move the window by 52px and leave the panel
    // just as buried as before.
    expect(sidePanelRegion(52, DRIVEN).width).toBe(LOGIC_OVERLAY_PANEL_RESERVE);
    expect(sidePanelRegion(0, DRIVEN).width).toBe(LOGIC_OVERLAY_PANEL_RESERVE);
    expect(sidePanelRegion(NaN, DRIVEN).width).toBe(LOGIC_OVERLAY_PANEL_RESERVE);
  });

  it('never claims more than the viewport', () => {
    expect(sidePanelRegion(2000, { width: 900, height: 600 }).width).toBe(900);
  });
});

describe('VFN-005 — moveLogicOverlayClearOf', () => {
  /** The window in its home placement, and the dock it is already clear of. */
  const home = placeLogicOverlayInFrame(FRAME, DRIVEN);

  it('leaves a window that is already clear exactly where it is', () => {
    expect(moveLogicOverlayClearOf(home, sidePanelRegion(FRAME.left, DRIVEN), DRIVEN)).toEqual(home);
  });

  it('🔴 moves a window that is over the dock, at the size the builder chose', () => {
    // The reported case, with the measured numbers: the window the drive found at 140,214
    // 1014×543 covers the side panel's whole column, so *Open app settings* opens behind it.
    const asFound: OverlayRect = { left: 140, top: 214, width: 1014, height: 543 };
    const region = sidePanelRegion(FRAME.left, DRIVEN);

    // The control: this is the state being fixed.
    expect(rectsIntersect(asFound, region)).toBe(true);

    const moved = moveLogicOverlayClearOf(asFound, region, DRIVEN);

    expect(moved).not.toBeNull();
    expect(rectsIntersect(moved, region)).toBe(false);
    // Size preserved. Shrinking to make room is how a 640px floor gets quietly violated.
    expect(moved.width).toBe(asFound.width);
    expect(moved.height).toBe(asFound.height);
    // The shortest move that clears it: east, to the region's right edge.
    expect(moved).toEqual({ left: 392, top: 214, width: 1014, height: 543 });
  });

  it('🔴 skips a candidate the clamp pulls back into the region, and takes the next one', () => {
    // The nearest translation is 100px east, and the clamp pulls it back to `width - 96` — still
    // inside the region.
    //
    // 🔴 **This is the negative control for the whole function.** Accept a candidate on its
    // pre-clamp coordinates and this returns `{ left: 1344, … }`, which overlaps: a placement
    // that measures correct in the arithmetic and is wrong on screen, which is the exact bug
    // class this task was filed about.
    const wide: OverlayRect = { left: 0, top: 0, width: 1400, height: 500 };
    const rect: OverlayRect = { left: 1300, top: 100, width: 700, height: 350 };

    const moved = moveLogicOverlayClearOf(rect, wide, LAPTOP);

    expect(moved).toEqual({ left: 1300, top: 500, width: 700, height: 350 });
    expect(rectsIntersect(moved, wide)).toBe(false);
  });

  it('🔴 answers null when nothing clears the region, so the caller parks instead', () => {
    // A band 750 of 800 tall. Every push is clamped back over it — the southward one lands at
    // `height - 96` = 704, which is 46px inside the band. Same control as above: without the
    // post-clamp re-test this returns that 704 as a clearance.
    const band: OverlayRect = { left: 0, top: 0, width: 1440, height: 750 };
    const rect: OverlayRect = { left: 100, top: 200, width: 800, height: 400 };

    expect(moveLogicOverlayClearOf(rect, band, LAPTOP)).toBeNull();
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
