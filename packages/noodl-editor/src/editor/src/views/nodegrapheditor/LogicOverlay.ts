import { resizeBlocklyWorkspaces } from '../BlocklyEditor/blocklyResize';
import {
  applyOverlayDrag,
  clampLogicOverlayRect,
  fromFractions,
  moveLogicOverlayClearOf,
  placeLogicOverlayInFrame,
  sidePanelRegion,
  toFractions,
  type OverlayHandle,
  type OverlayRect,
  type OverlayViewport
} from './logicOverlayGeometry';

import type { NodeGraphEditor } from '../nodegrapheditor';

/**
 * LGC-010 — the Logic Builder opens as a **floating window over the document**, not as a pane
 * beside the canvas.
 *
 * ## What this replaced, and why the replacement is not a regression of it
 *
 * LGC-008 replaced a takeover (`display: none` on eight canvas layers) with a splitter. This
 * keeps everything that change won — nothing is hidden, every layer has a stated behaviour, the
 * canvas is on screen with the blocks — and drops the one thing that did not survive contact
 * with a 13" laptop: the *column*. The blocks now float above the canvas rather than taking
 * width from it, so:
 *
 * - **the canvas never resizes when the Logic Builder opens.** The whole F3 class — a canvas
 *   measured while it was the wrong size — stops applying to this feature. `remeasureNodeGraphCanvas`
 *   stays, because it is still a real defect fix for the *outer* preview/graph divider, and it
 *   is still called from there.
 * - **only Blockly is re-measured here**, on open, on every drag tick and on a window resize.
 *   Blockly re-measures itself on a `window` resize *only* (verified in `blockly_compressed.js`;
 *   see `blocklyResize.ts`), so a floating window that changes size without telling it leaves
 *   the SVG at its injected size with blocks outside the visible area.
 *
 * ## Why the geometry is CSS custom properties and not React state
 *
 * A drag writes on every `mousemove`. Routing that through React state re-renders the tab
 * content — and therefore every mounted `BlocklyWorkspace`'s props — at pointer frequency. The
 * DOM is the store: four numbers on the element they describe, written here, read by
 * `styles/nodegrapheditor.css`.
 *
 * ⚠️ **Everything is synchronous.** No `requestAnimationFrame`, no timer, no `ResizeObserver`.
 * An occluded Electron renderer fires zero observer callbacks and clamps timers by roughly
 * 1000×, so a deferred implementation works whenever the window happens to be focused and fails
 * exactly where a block editor is used.
 */

/** The custom properties holding the floating window's box. Read by `styles/nodegrapheditor.css`. */
export const LOGIC_OVERLAY_VARS = {
  left: '--logic-overlay-left',
  top: '--logic-overlay-top',
  width: '--logic-overlay-width',
  height: '--logic-overlay-height'
} as const;

/** The class that puts the shell into overlay mode. Every overlay rule is scoped to it. */
export const LOGIC_OVERLAY_OPEN_CLASS = 'is-logic-overlay';

/** Where the window's geometry is remembered between sessions, as fractions of the viewport. */
export const LOGIC_OVERLAY_STORAGE_KEY = 'logic_overlay_rect';

/**
 * VFN-005 — *"collapse the window, I want the app"*, asked for from outside the window.
 *
 * The park control is a title-bar button, so the ordinary route is a click on it. This is the
 * other route: {@link yieldLogicOverlayToSidePanel} answers `'park'` when a panel has opened
 * underneath a window with nowhere to move to, and `EditorEventBindings` emits this.
 *
 * Declared here rather than in `CanvasTabs.tsx` so that the module which *decides* to park owns
 * the name, and so `EditorEventBindings` — an eager-bundle module — does not have to import a
 * React component to say it.
 */
export const LOGIC_BUILDER_PARK_EVENT = 'LogicBuilder.ParkRequested';

/**
 * The live drag, if one is in progress.
 *
 * Module-level rather than per-editor: there is one pointer, so there is at most one drag, and
 * threading it through the React tree would put the origin rect into a re-render path that a
 * `mousemove` handler must stay out of.
 */
let dragSession: {
  handle: OverlayHandle;
  origin: OverlayRect;
  pointerX: number;
  pointerY: number;
} | null = null;

/** The viewport the window is placed in — the whole document, which is the point of this design. */
function viewportOf(): OverlayViewport {
  return {
    width: window.innerWidth || document.documentElement?.clientWidth || 0,
    height: window.innerHeight || document.documentElement?.clientHeight || 0
  };
}

function readStoredRect(viewport: OverlayViewport): OverlayRect | null {
  try {
    const raw = window.localStorage?.getItem(LOGIC_OVERLAY_STORAGE_KEY);
    if (!raw) return null;
    return fromFractions(JSON.parse(raw), viewport);
  } catch (error) {
    // A blocked or full `localStorage`, or stored nonsense. Neither is worth an exception over
    // where a window sits; the default placement is a perfectly good answer.
    return null;
  }
}

function writeStoredRect(rect: OverlayRect, viewport: OverlayViewport): void {
  try {
    window.localStorage?.setItem(LOGIC_OVERLAY_STORAGE_KEY, JSON.stringify(toFractions(rect, viewport)));
  } catch (error) {
    /* see readStoredRect */
  }
}

/**
 * VFN-005 — the node graph frame's box, in viewport coordinates.
 *
 * `editor.shell.root` is `width: 100%; height: 100%` inside the `Frame` the document lays out, so
 * its client rect *is* the frame's box: what is left of the viewport after the side panel has
 * taken its column and the running app its band. Read as four numbers and used to *place* the
 * window — 🔴 the frame is never made a containing block for it. `position: fixed` escaping the
 * frame's `overflow: hidden` is what makes a 640 px window possible on a 13" screen at all.
 *
 * `null` only when there is no element to measure at all.
 *
 * 🔴 It deliberately does **not** also reject a 0×0 or a `NaN` box. It used to, and the guard was
 * proved to be **decoration**: removing it changed no spec's answer, because `placeLogicOverlayInFrame`
 * already rejects exactly those boxes and both paths produce the same rect. One property, one
 * guard, in the pure module that has a spec around it — and a spec here that fails if this stops
 * finding the frame at all.
 */
function frameRectOf(editor: NodeGraphEditor): OverlayRect | null {
  // Not padding either: `reflowLogicOverlay` is reachable during teardown, and `shell.root` is
  // typed `HTMLDivElement` under `strictNullChecks: false` — which makes the type a claim rather
  // than a guarantee.
  const root = editor.shell?.root;
  if (!root || typeof root.getBoundingClientRect !== 'function') return null;

  const box = root.getBoundingClientRect();
  return { left: box.left, top: box.top, width: box.width, height: box.height };
}

/** Write the box onto the shell root, where the stylesheet reads it, and re-measure Blockly. */
function applyRect(editor: NodeGraphEditor, rect: OverlayRect): void {
  const style = editor.shell.root.style;

  style.setProperty(LOGIC_OVERLAY_VARS.left, `${rect.left}px`);
  style.setProperty(LOGIC_OVERLAY_VARS.top, `${rect.top}px`);
  style.setProperty(LOGIC_OVERLAY_VARS.width, `${rect.width}px`);
  style.setProperty(LOGIC_OVERLAY_VARS.height, `${rect.height}px`);

  // The style write *is* the geometry change and it has already happened, so Blockly measures
  // the new box rather than the old one.
  resizeBlocklyWorkspaces();
}

/**
 * Open or close the floating window.
 *
 * Called when the first Logic Builder tab opens and when the last one closes. Opening restores
 * the geometry the builder last left it at — clamped into whatever viewport they are on now —
 * and falls back to a centred default the first time.
 */
export function setLogicOverlayOpen(editor: NodeGraphEditor, open: boolean): void {
  // Either direction ends any drag. A window that has just been placed is not mid-drag, and a
  // session that outlived its `mouseup` — the pointer left the window, the event was dropped —
  // would otherwise snap the newly opened window to the next stray `mousemove`.
  dragSession = null;

  if (open) {
    const viewport = viewportOf();
    /**
     * 🔴 VFN-005 criterion 4 — the *first* open is placed over the node graph frame, not over
     * the middle of the viewport. Stored geometry still wins after that (criterion 5): a builder
     * who has placed this window has answered the question, and re-answering it for them on
     * every open is worse than the placement they chose.
     */
    applyRect(editor, readStoredRect(viewport) ?? placeLogicOverlayInFrame(frameRectOf(editor), viewport));
  }

  editor.shell.root.classList.toggle(LOGIC_OVERLAY_OPEN_CLASS, open);
}

/** The box currently written on the shell root, or `null` if it is not four finite numbers. */
function currentRect(editor: NodeGraphEditor): OverlayRect | null {
  const style = editor.shell.root.style;

  const rect = {
    left: parseFloat(style.getPropertyValue(LOGIC_OVERLAY_VARS.left)),
    top: parseFloat(style.getPropertyValue(LOGIC_OVERLAY_VARS.top)),
    width: parseFloat(style.getPropertyValue(LOGIC_OVERLAY_VARS.width)),
    height: parseFloat(style.getPropertyValue(LOGIC_OVERLAY_VARS.height))
  };

  return [rect.left, rect.top, rect.width, rect.height].every(Number.isFinite) ? rect : null;
}

/**
 * VFN-005 — put the window back over the node graph frame.
 *
 * The *"put it back"* half of the placement remedy, and the recovery from every gesture that
 * leaves the window somewhere unhelpful: a drag that buried the preview, a viewport change, a
 * stored geometry from a screen this one is not. Stored, like a drag is, because it is a
 * placement the builder chose and it should survive the reopen.
 */
export function sendLogicOverlayHome(editor: NodeGraphEditor): void {
  dragSession = null;

  const viewport = viewportOf();
  const rect = placeLogicOverlayInFrame(frameRectOf(editor), viewport);

  applyRect(editor, rect);
  writeStoredRect(rect, viewport);
}

/** What {@link yieldLogicOverlayToSidePanel} did, so the caller knows whether to park instead. */
export type LogicOverlayYield = 'clear' | 'moved' | 'park';

/**
 * 🔴 VFN-005 / VFN-012 — the window gets out of the way of a side panel it has just opened.
 *
 * The argument, which is the one this task's design turns on: the App Config toolbox flyout has
 * a button labelled *Open app settings*. It works — and the settings panel it opens renders
 * **behind** the Logic Builder window the builder pressed it from. A feature's own call to action
 * cannot land somewhere the feature is hiding, and a first-open placement does not fix it,
 * because by then the builder has a stored geometry of their own and stored geometry wins.
 *
 * Three answers, in order:
 *
 * - `'clear'` — the window was never over the panel's column. Nothing moves. (This is what a
 *   window sitting in its home placement gets, which is the point of the home placement.)
 * - `'moved'` — the window is translated the shortest distance that clears the column, at the
 *   size the builder chose. Stored, because it is now where the window is; a shift that
 *   un-shifts itself needs an answer to *when*, and every answer to that is wrong.
 * - `'park'` — there is nowhere to move to. The caller collapses the window to its title bar
 *   instead, which always works and is one click to undo.
 */
export function yieldLogicOverlayToSidePanel(editor: NodeGraphEditor): LogicOverlayYield {
  const root = editor.shell.root;
  if (!root.classList.contains(LOGIC_OVERLAY_OPEN_CLASS)) return 'clear';

  const viewport = viewportOf();
  const rect = currentRect(editor);
  if (!rect) return 'clear';

  const frame = frameRectOf(editor);
  const region = sidePanelRegion(frame ? frame.left : 0, viewport);

  const moved = moveLogicOverlayClearOf(rect, region, viewport);
  if (!moved) return 'park';

  const unchanged =
    moved.left === rect.left && moved.top === rect.top && moved.width === rect.width && moved.height === rect.height;
  if (unchanged) return 'clear';

  dragSession = null;
  applyRect(editor, moved);
  writeStoredRect(moved, viewport);
  return 'moved';
}

/**
 * Begin a move or a resize.
 *
 * `origin` is the window's box as the component measured it at `mousedown`, rather than
 * something read back out of the custom properties: the element is the authority on where it
 * actually is, and on the very first drag after an open the properties and the element agree
 * only because `applyRect` just wrote them.
 */
export function beginLogicOverlayDrag(
  handle: OverlayHandle,
  origin: OverlayRect,
  pointerX: number,
  pointerY: number
): void {
  dragSession = { handle, origin, pointerX, pointerY };
}

/**
 * Move the window to follow a pointer. Called synchronously from `mousemove`.
 *
 * A no-op with no drag in progress, so a stray `mousemove` after a `mouseup` that was missed
 * (the pointer leaving the window, a dropped event) cannot move anything.
 */
export function updateLogicOverlayDrag(editor: NodeGraphEditor, pointerX: number, pointerY: number): void {
  if (!dragSession) return;

  const rect = applyOverlayDrag(
    dragSession.origin,
    dragSession.handle,
    pointerX - dragSession.pointerX,
    pointerY - dragSession.pointerY,
    viewportOf()
  );

  applyRect(editor, rect);
}

/** End the drag and remember where it finished. */
export function endLogicOverlayDrag(editor: NodeGraphEditor): void {
  if (!dragSession) return;
  dragSession = null;

  const rect = currentRect(editor);
  if (!rect) return;

  writeStoredRect(rect, viewportOf());
}

/**
 * Keep the window inside a viewport that just changed size.
 *
 * Called from the editor's own `resize`, which the frame drives. Without this, shrinking the
 * editor window — or opening the laptop after a session on an external display — leaves the
 * block editor partly or wholly outside the screen with no way to reach its title bar.
 *
 * A no-op when the overlay is closed, and a no-op when the clamp does not actually move
 * anything, because it runs beside a full relayout of the graph.
 */
export function reflowLogicOverlay(editor: NodeGraphEditor): void {
  const root = editor.shell.root;
  if (!root.classList.contains(LOGIC_OVERLAY_OPEN_CLASS)) return;

  const viewport = viewportOf();
  const current = currentRect(editor);

  if (!current) {
    // Nothing legible written yet. VFN-005: the frame is still the better answer than the
    // centred default, and `placeLogicOverlayInFrame` falls back to that default on its own if
    // there is no frame to read either.
    applyRect(editor, placeLogicOverlayInFrame(frameRectOf(editor), viewport));
    return;
  }

  const clamped = clampLogicOverlayRect(current, viewport);

  const unchanged =
    clamped.left === current.left &&
    clamped.top === current.top &&
    clamped.width === current.width &&
    clamped.height === current.height;

  // Blockly is re-measured either way: the window may be the same size while the *renderer*
  // was occluded through the resize that changed it, and `resizeBlocklyWorkspaces` is a no-op
  // for a workspace whose box did not move.
  if (unchanged) resizeBlocklyWorkspaces();
  else applyRect(editor, clamped);
}
