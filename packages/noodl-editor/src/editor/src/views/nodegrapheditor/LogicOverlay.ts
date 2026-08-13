import { resizeBlocklyWorkspaces } from '../BlocklyEditor/blocklyResize';
import {
  applyOverlayDrag,
  clampLogicOverlayRect,
  defaultLogicOverlayRect,
  fromFractions,
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
    applyRect(editor, readStoredRect(viewport) ?? defaultLogicOverlayRect(viewport));
  }

  editor.shell.root.classList.toggle(LOGIC_OVERLAY_OPEN_CLASS, open);
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

  const viewport = viewportOf();
  const style = editor.shell.root.style;

  const rect = {
    left: parseFloat(style.getPropertyValue(LOGIC_OVERLAY_VARS.left)),
    top: parseFloat(style.getPropertyValue(LOGIC_OVERLAY_VARS.top)),
    width: parseFloat(style.getPropertyValue(LOGIC_OVERLAY_VARS.width)),
    height: parseFloat(style.getPropertyValue(LOGIC_OVERLAY_VARS.height))
  };

  if (![rect.left, rect.top, rect.width, rect.height].every(Number.isFinite)) return;

  writeStoredRect(rect, viewport);
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
  const style = root.style;

  const current = {
    left: parseFloat(style.getPropertyValue(LOGIC_OVERLAY_VARS.left)),
    top: parseFloat(style.getPropertyValue(LOGIC_OVERLAY_VARS.top)),
    width: parseFloat(style.getPropertyValue(LOGIC_OVERLAY_VARS.width)),
    height: parseFloat(style.getPropertyValue(LOGIC_OVERLAY_VARS.height))
  };

  if (![current.left, current.top, current.width, current.height].every(Number.isFinite)) {
    applyRect(editor, defaultLogicOverlayRect(viewport));
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
