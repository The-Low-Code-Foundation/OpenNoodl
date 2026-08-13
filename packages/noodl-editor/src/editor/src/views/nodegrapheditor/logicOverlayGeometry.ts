/**
 * LGC-010 — where the Logic Builder's floating window sits, and how big it is.
 *
 * ## Why this replaced a splitter
 *
 * LGC-008 built a second splitter: canvas left, blocks right. It was ruled and it was built and
 * it was driven, and then it was used on a 13" MacBook, where it is unusable — the two interface
 * rails alone are 304 px, the preview already owns half the document under the default
 * `horizontal` layout, and what is left for the blocks is a sliver. The pane's own drive filed
 * exactly this as a finding ("no minimum width; at 288 px the workspace measures 0") and left the
 * remedy open. The remedy is not a clamp. A surface whose *minimum* usable width is most of a
 * small laptop's screen cannot be a column beside another column.
 *
 * So it is a **floating window over the whole document**, which is what the code editor popout
 * already does for Function and Expression ports. That buys three things a pane cannot:
 *
 * - it is as wide as it needs to be, independent of what else is on screen;
 * - the node canvas and the running app are both still *there*, under and around it, rather than
 *   compressed into what is left;
 * - clicks outside it reach whatever is underneath and **do not dismiss it**, so a builder can
 *   poke the running app and come back to the blocks still open. (This is where it deliberately
 *   differs from the code editor popout, which `PopupLayer` closes on an outside click.)
 *
 * ## Why every number here is a pure function
 *
 * The window is dragged and resized from `mousemove`, and an occluded Electron renderer clamps
 * timers ~1000× and fires zero `ResizeObserver` callbacks — so the geometry has to be computed
 * and written synchronously on the event's own tick. Keeping the arithmetic here, with no DOM in
 * sight, is what lets it be gated by a plain-Node spec while the writing of it stays in
 * `LogicOverlay.ts`.
 */

/** A window box in viewport (client) coordinates, CSS pixels. */
export interface OverlayRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The viewport the window is clamped into. */
export interface OverlayViewport {
  width: number;
  height: number;
}

/**
 * The narrowest the window may be resized to, in CSS pixels.
 *
 * Not a taste number: the two interface rails are `152px` each (`BlocklyWorkspace.module.scss`)
 * and Blockly's toolbox is ~90 px before a single block is visible beside it, so 304 + 90 is
 * already spent before anything is shown. 640 leaves ~250 px of actual workspace, which is one
 * block wide. Below this the window is not small, it is empty — which is what the pane's drive
 * measured at 288 px: `.injectionDiv` was **0 px**.
 */
export const LOGIC_OVERLAY_MIN_WIDTH = 640;

/**
 * The shortest the window may be resized to.
 *
 * The tab bar is ~40 px and the rails' headers another ~28 before a row is drawn, so this is the
 * same argument as the width in the other axis, with more slack because blocks stack downwards
 * and a short workspace still scrolls.
 */
export const LOGIC_OVERLAY_MIN_HEIGHT = 320;

/**
 * How much of the viewport the window claims the first time it is opened.
 *
 * Deliberately not 100%: the point of a floating window over a takeover is that you can *see*
 * there is a canvas and a running app behind it. A margin all the way round is what says so,
 * and it is also the grab area for moving the window out of the way.
 */
export const LOGIC_OVERLAY_DEFAULT_FRACTION = 0.82;

/** The gap kept between the window and the viewport edge in the default placement. */
const DEFAULT_MARGIN = 12;

/**
 * How much of the window must stay inside the viewport when it is moved.
 *
 * A window dragged mostly off-screen is recoverable only if its title bar is still reachable,
 * so the clamp keeps the *top* edge on screen and enough width to grab. It is not a jail: you
 * can push it 90% off the right edge if you want the canvas back, and pull it in again.
 */
const KEEP_ON_SCREEN = 96;

/** The eight directions a resize can pull, plus `move` for a drag of the whole window. */
export type OverlayHandle = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/** Every resize handle, in the order they are rendered. Exported for the component and the spec. */
export const OVERLAY_RESIZE_HANDLES: Exclude<OverlayHandle, 'move'>[] = [
  'n',
  's',
  'e',
  'w',
  'ne',
  'nw',
  'se',
  'sw'
];

/** The `cursor` each handle shows. */
export const OVERLAY_HANDLE_CURSOR: Record<Exclude<OverlayHandle, 'move'>, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize'
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Round to whole pixels — the numbers are printed into CSS and read back in an inspector. */
function round(rect: OverlayRect): OverlayRect {
  return {
    left: Math.round(rect.left),
    top: Math.round(rect.top),
    width: Math.round(rect.width),
    height: Math.round(rect.height)
  };
}

/**
 * The minimums, reduced to fit a viewport smaller than they are.
 *
 * A 600 px-wide window on a 500 px viewport is not a floor, it is an off-screen window. The
 * viewport wins, because the alternative is unrecoverable.
 */
function minimums(viewport: OverlayViewport): { width: number; height: number } {
  return {
    width: Math.min(LOGIC_OVERLAY_MIN_WIDTH, Math.max(viewport.width, 1)),
    height: Math.min(LOGIC_OVERLAY_MIN_HEIGHT, Math.max(viewport.height, 1))
  };
}

/** Where the window opens when nothing has been stored: centred, {@link LOGIC_OVERLAY_DEFAULT_FRACTION} of the viewport. */
export function defaultLogicOverlayRect(viewport: OverlayViewport): OverlayRect {
  const min = minimums(viewport);

  const width = clamp(
    viewport.width * LOGIC_OVERLAY_DEFAULT_FRACTION,
    min.width,
    Math.max(viewport.width - DEFAULT_MARGIN * 2, min.width)
  );
  const height = clamp(
    viewport.height * LOGIC_OVERLAY_DEFAULT_FRACTION,
    min.height,
    Math.max(viewport.height - DEFAULT_MARGIN * 2, min.height)
  );

  return round({
    left: (viewport.width - width) / 2,
    top: (viewport.height - height) / 2,
    width,
    height
  });
}

/**
 * Bring a rect back inside a viewport it may no longer fit.
 *
 * Called on every open and on every window resize, because the stored geometry was written
 * against whatever screen the last session used. Size is clamped first and position second:
 * a window sized larger than the viewport, then positioned, would be pushed off the left edge
 * by its own overhang.
 */
export function clampLogicOverlayRect(rect: OverlayRect, viewport: OverlayViewport): OverlayRect {
  const min = minimums(viewport);

  const width = clamp(rect.width, min.width, Math.max(viewport.width, min.width));
  const height = clamp(rect.height, min.height, Math.max(viewport.height, min.height));

  // The window may hang off the right and bottom — that is how you get the canvas back without
  // resizing — but never so far that there is nothing left to grab, and never off the top, which
  // is where the title bar is.
  const left = clamp(rect.left, Math.min(KEEP_ON_SCREEN - width, 0), Math.max(viewport.width - KEEP_ON_SCREEN, 0));
  const top = clamp(rect.top, 0, Math.max(viewport.height - KEEP_ON_SCREEN, 0));

  return round({ left, top, width, height });
}

/**
 * Apply a pointer delta to the rect a drag started from.
 *
 * `handle` decides which edges move. The minimums are applied against the *anchored* edge, so
 * dragging the west edge rightwards past the minimum pins the window's left at
 * `right - minWidth` instead of letting it walk through its own right edge — which is what an
 * unanchored `Math.max(width, min)` does, and it looks like the window sliding away from the
 * pointer.
 */
export function applyOverlayDrag(
  origin: OverlayRect,
  handle: OverlayHandle,
  deltaX: number,
  deltaY: number,
  viewport: OverlayViewport
): OverlayRect {
  if (handle === 'move') {
    return clampLogicOverlayRect({ ...origin, left: origin.left + deltaX, top: origin.top + deltaY }, viewport);
  }

  const min = minimums(viewport);
  const right = origin.left + origin.width;
  const bottom = origin.top + origin.height;

  let { left, top, width, height } = origin;

  if (handle.includes('e')) {
    width = Math.max(origin.width + deltaX, min.width);
  } else if (handle.includes('w')) {
    left = Math.min(origin.left + deltaX, right - min.width);
    width = right - left;
  }

  if (handle.includes('s')) {
    height = Math.max(origin.height + deltaY, min.height);
  } else if (handle.includes('n')) {
    top = Math.min(origin.top + deltaY, bottom - min.height);
    height = bottom - top;
  }

  return clampLogicOverlayRect({ left, top, width, height }, viewport);
}

/**
 * The stored form: fractions of the viewport, not pixels.
 *
 * The same reasoning the splitter used for its percentage, for the same reason — a builder who
 * sizes the window on a 27" display and then opens the laptop should get a window in proportion
 * rather than one wider than the screen. `clampLogicOverlayRect` catches the rest.
 */
export interface OverlayRectFractions {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function toFractions(rect: OverlayRect, viewport: OverlayViewport): OverlayRectFractions {
  const width = Math.max(viewport.width, 1);
  const height = Math.max(viewport.height, 1);

  return {
    left: rect.left / width,
    top: rect.top / height,
    width: rect.width / width,
    height: rect.height / height
  };
}

/**
 * Read fractions back into pixels, or answer `null` for anything that is not four finite numbers.
 *
 * `null` rather than a repaired rect: a caller that cannot tell "nothing stored" from "stored
 * nonsense" would silently place the window somewhere the user never put it, and the honest
 * answer to nonsense is the default placement.
 */
export function fromFractions(value: unknown, viewport: OverlayViewport): OverlayRect | null {
  if (!value || typeof value !== 'object') return null;

  const record = value as Record<string, unknown>;
  const numbers = ['left', 'top', 'width', 'height'].map((key) => record[key]);

  if (!numbers.every((n) => typeof n === 'number' && Number.isFinite(n))) return null;

  const [left, top, width, height] = numbers as number[];

  // A stored window of zero size is not a window; it is a serialisation that happened while the
  // element was hidden. Treated as nothing stored.
  if (width <= 0 || height <= 0) return null;

  return clampLogicOverlayRect(
    {
      left: left * viewport.width,
      top: top * viewport.height,
      width: width * viewport.width,
      height: height * viewport.height
    },
    viewport
  );
}
