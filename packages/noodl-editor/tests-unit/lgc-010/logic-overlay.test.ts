/**
 * LGC-010 — opening, moving and remembering the floating block editor.
 *
 * The properties held here are the ones that used to be `LogicPane`'s and are still the ones
 * that matter, restated for a window rather than a pane:
 *
 * - opening writes geometry and **hides nothing** — the blanket `display: none` on eight canvas
 *   layers stays gone, and a spec fails if it comes back;
 * - opening does **not** resize the canvas either, which is the new half: a floating window
 *   takes no width from the graph, so the whole F3 class stops applying to this path;
 * - every geometry change re-measures Blockly, synchronously, because Blockly re-measures itself
 *   on a `window` resize only;
 * - the geometry survives a close, a reopen and a change of screen.
 */

import {
  blocklyResizeHandlerCount,
  registerBlocklyResizeHandler
} from '../../src/editor/src/views/BlocklyEditor/blocklyResize';
import {
  beginLogicOverlayDrag,
  endLogicOverlayDrag,
  LOGIC_OVERLAY_OPEN_CLASS,
  LOGIC_OVERLAY_STORAGE_KEY,
  LOGIC_OVERLAY_VARS,
  reflowLogicOverlay,
  sendLogicOverlayHome,
  setLogicOverlayOpen,
  updateLogicOverlayDrag,
  yieldLogicOverlayToSidePanel
} from '../../src/editor/src/views/nodegrapheditor/LogicOverlay';
import {
  defaultLogicOverlayRect,
  placeLogicOverlayInFrame,
  rectsIntersect,
  sidePanelRegion,
  type OverlayRect
} from '../../src/editor/src/views/nodegrapheditor/logicOverlayGeometry';

const VIEWPORT = { width: 1440, height: 800 };

/**
 * A shell root with just enough of an element to be written to and read back.
 *
 * `frame` is VFN-005's addition: `editor.shell.root` fills the node graph frame, so its client
 * rect *is* the frame's box, and that is what the window is now placed against on a first open.
 * The default is a 0×0 box — a root with no layout, which is what an unattached element and an
 * occluded renderer both report — so every spec written before VFN-005 keeps the centred-default
 * behaviour it was written against, unchanged.
 */
function fakeRoot(frame: OverlayRect = { left: 0, top: 0, width: 0, height: 0 }) {
  const properties = new Map<string, string>();
  const classes = new Set<string>();

  return {
    properties,
    classes,
    getBoundingClientRect: () => ({ ...frame, right: frame.left + frame.width, bottom: frame.top + frame.height }),
    style: {
      setProperty: (name: string, value: string) => properties.set(name, value),
      getPropertyValue: (name: string) => properties.get(name) ?? '',
      removeProperty: (name: string) => properties.delete(name)
    },
    classList: {
      toggle: (name: string, force: boolean) => (force ? classes.add(name) : classes.delete(name)),
      contains: (name: string) => classes.has(name)
    }
  };
}

function fakeLayer() {
  return { style: {} as Record<string, string> };
}

function fakeEditor(frame?: OverlayRect) {
  const root = fakeRoot(frame);

  const layers = {
    commentLayerBg: fakeLayer(),
    commentLayerFg: fakeLayer(),
    highlightOverlayLayer: fakeLayer(),
    recordingOverlayLayer: fakeLayer(),
    executionOverlayLayer: fakeLayer(),
    componentTrailRoot: fakeLayer(),
    canvasHudRoot: fakeLayer(),
    canvasTabsRoot: fakeLayer()
  };

  const canvas = { style: {} as Record<string, string>, width: 1000, height: 600 };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editor = { shell: { root, canvas, ...layers }, domElementContainer: fakeLayer(), resize: jest.fn() } as any;

  return { editor, root, canvas, layers };
}

/** The four numbers the stylesheet reads, as pixels. */
function readRect(root: ReturnType<typeof fakeRoot>) {
  const read = (name: string) => parseFloat(root.style.getPropertyValue(name));
  return {
    left: read(LOGIC_OVERLAY_VARS.left),
    top: read(LOGIC_OVERLAY_VARS.top),
    width: read(LOGIC_OVERLAY_VARS.width),
    height: read(LOGIC_OVERLAY_VARS.height)
  };
}

let store: Record<string, string>;

beforeEach(() => {
  store = {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).window = {
    innerWidth: VIEWPORT.width,
    innerHeight: VIEWPORT.height,
    localStorage: {
      getItem: (key: string) => (key in store ? store[key] : null),
      setItem: (key: string, value: string) => {
        store[key] = value;
      }
    }
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).document = { documentElement: { clientWidth: VIEWPORT.width, clientHeight: VIEWPORT.height } };
});

describe('LGC-010 — setLogicOverlayOpen', () => {
  it('opens the window at the default placement the first time', () => {
    const { editor, root } = fakeEditor();

    setLogicOverlayOpen(editor, true);

    expect(root.classList.contains(LOGIC_OVERLAY_OPEN_CLASS)).toBe(true);
    expect(readRect(root)).toEqual(defaultLogicOverlayRect(VIEWPORT));
  });

  it('puts the window away when the last tab closes', () => {
    const { editor, root } = fakeEditor();

    setLogicOverlayOpen(editor, true);
    setLogicOverlayOpen(editor, false);

    expect(root.classList.contains(LOGIC_OVERLAY_OPEN_CLASS)).toBe(false);
  });

  it('hides nothing — the blanket display:none is still gone, not conditional', () => {
    // 🔴 LGC-008's ruling, restated as a gate for the window. Eight layers used to be hidden:
    // the canvas, both comment layers, the highlight overlay, the recording overlay, the canvas
    // HUD, the component trail and the DOM layer. The window floats over all of them.
    const { editor, layers, canvas } = fakeEditor();

    setLogicOverlayOpen(editor, true);

    for (const layer of [...Object.values(layers), editor.domElementContainer]) {
      expect(layer.style.display).toBeUndefined();
    }
    expect(canvas.style.display).toBeUndefined();
  });

  it('does not resize the canvas either — a floating window takes no width from the graph', () => {
    // The new half, and the reason F3's class stops applying here: LGC-008's pane narrowed the
    // canvas on every open and every drag, so the canvas had to be re-measured on both. This
    // does not touch it.
    const { editor, canvas } = fakeEditor();

    setLogicOverlayOpen(editor, true);

    expect(editor.resize).not.toHaveBeenCalled();
    expect(canvas.width).toBe(1000);
    expect(canvas.height).toBe(600);
  });

  it('re-measures Blockly on open, because Blockly only re-measures on a window resize', () => {
    const { editor } = fakeEditor();
    const workspace = jest.fn();
    const unregister = registerBlocklyResizeHandler(workspace);

    setLogicOverlayOpen(editor, true);

    expect(workspace).toHaveBeenCalledTimes(1);

    unregister();
    expect(blocklyResizeHandlerCount()).toBe(0);
  });
});

describe('LGC-010 — dragging the window', () => {
  it('follows the pointer and re-measures Blockly on every tick', () => {
    const { editor, root } = fakeEditor();
    const workspace = jest.fn();
    const unregister = registerBlocklyResizeHandler(workspace);

    setLogicOverlayOpen(editor, true);
    workspace.mockClear();

    beginLogicOverlayDrag('move', { left: 200, top: 100, width: 900, height: 500 }, 500, 400);
    updateLogicOverlayDrag(editor, 560, 430);

    expect(readRect(root)).toEqual({ left: 260, top: 130, width: 900, height: 500 });
    expect(workspace).toHaveBeenCalledTimes(1);

    unregister();
  });

  it('ignores a mousemove with no drag in progress', () => {
    // A `mouseup` missed because the pointer left the window must not leave the window glued to
    // the cursor. Opening clears any session for the same reason, which is what this also holds:
    // the previous spec deliberately leaves one open.
    const { editor, root } = fakeEditor();

    setLogicOverlayOpen(editor, true);
    const before = readRect(root);

    updateLogicOverlayDrag(editor, 900, 900);

    expect(readRect(root)).toEqual(before);
  });

  it('resizes from a handle rather than moving', () => {
    const { editor, root } = fakeEditor();

    setLogicOverlayOpen(editor, true);
    beginLogicOverlayDrag('e', { left: 200, top: 100, width: 900, height: 500 }, 1100, 400);
    updateLogicOverlayDrag(editor, 1200, 400);

    expect(readRect(root)).toEqual({ left: 200, top: 100, width: 1000, height: 500 });
  });

  it('remembers where the drag finished, and reopens there', () => {
    const { editor, root } = fakeEditor();

    setLogicOverlayOpen(editor, true);
    beginLogicOverlayDrag('move', { left: 200, top: 100, width: 900, height: 500 }, 500, 400);
    updateLogicOverlayDrag(editor, 400, 300);
    endLogicOverlayDrag(editor);

    expect(store[LOGIC_OVERLAY_STORAGE_KEY]).toBeTruthy();

    setLogicOverlayOpen(editor, false);
    setLogicOverlayOpen(editor, true);

    expect(readRect(root)).toEqual({ left: 100, top: 0, width: 900, height: 500 });
  });

  it('stores nothing when no drag was in progress', () => {
    const { editor } = fakeEditor();

    setLogicOverlayOpen(editor, true);
    endLogicOverlayDrag(editor);

    expect(store[LOGIC_OVERLAY_STORAGE_KEY]).toBeUndefined();
  });

  it('survives a localStorage that throws', () => {
    // A blocked or full store is not worth an exception over where a window sits.
    const { editor, root } = fakeEditor();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).window.localStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      }
    };

    expect(() => setLogicOverlayOpen(editor, true)).not.toThrow();
    expect(readRect(root)).toEqual(defaultLogicOverlayRect(VIEWPORT));

    beginLogicOverlayDrag('move', { left: 0, top: 0, width: 900, height: 500 }, 0, 0);
    updateLogicOverlayDrag(editor, 10, 10);
    expect(() => endLogicOverlayDrag(editor)).not.toThrow();
  });
});

/* ===========================================================================================
   VFN-005 — the placement remedy, at the seam that writes it.

   The arithmetic is graded next door in `logic-overlay-geometry.test.ts`, against the geometry
   the 2026-08-13 drive measured. What is graded here is which arithmetic each entry point
   reaches for, what it stores, and whether Blockly is told — because a placement that is
   computed correctly and written nowhere is the same defect as one computed wrong.
   =========================================================================================== */

/** The node graph frame on a 1440×800 editor with a side panel open and the app preview on top. */
const FRAME: OverlayRect = { left: 392, top: 425, width: 1048, height: 375 };
/** The dock the frame's left edge implies, which is what a yield has to clear. */
const DOCK = { left: 0, top: 0, width: 392, height: VIEWPORT.height };

describe('VFN-005 — where the window opens', () => {
  it('🔴 places the first open over the node graph frame, not over the middle of the viewport', () => {
    const { editor, root } = fakeEditor(FRAME);

    setLogicOverlayOpen(editor, true);

    expect(readRect(root)).toEqual(placeLogicOverlayInFrame(FRAME, VIEWPORT));

    // 🔴 The control: the placement this replaces, on the same viewport, is over the dock. If
    // `frameRectOf` ever stops finding the frame, the first line above still passes — this one
    // is what makes the two placements distinguishable.
    const before = defaultLogicOverlayRect(VIEWPORT);
    expect(rectsIntersect(before, DOCK)).toBe(true);
    expect(rectsIntersect(readRect(root), DOCK)).toBe(false);
  });

  it('falls back to the centred default when the frame measures 0×0', () => {
    // A root that is not in the document, or a renderer occluded through the layout: both report
    // a 0×0 box. Placing a window at NaN is not an improvement on placing it in the middle.
    const { editor, root } = fakeEditor();

    setLogicOverlayOpen(editor, true);

    expect(readRect(root)).toEqual(defaultLogicOverlayRect(VIEWPORT));
  });

  it('🔴 falls back to the centred default when the root cannot be measured at all', () => {
    // The one thing `frameRectOf`'s own guard holds that `placeLogicOverlayInFrame`'s does not:
    // no `getBoundingClientRect` to call. `shell.root` is typed `HTMLDivElement`, and
    // `strictNullChecks` is off in this package, so the type is a claim rather than a guarantee —
    // this is what holds it instead. Without the guard the open **throws**, and a Logic Builder
    // tab opens onto nothing.
    const { editor, root } = fakeEditor(FRAME);
    delete (root as { getBoundingClientRect?: unknown }).getBoundingClientRect;

    expect(() => setLogicOverlayOpen(editor, true)).not.toThrow();
    expect(readRect(root)).toEqual(defaultLogicOverlayRect(VIEWPORT));
  });

  it('🔴 criterion 5 — stored geometry still wins over the frame placement', () => {
    // A builder who has placed this window has answered the question. Re-answering it for them
    // on every open is worse than the placement they chose, and it would also mean the *first*
    // placement silently became the *only* placement.
    const { editor, root } = fakeEditor(FRAME);

    setLogicOverlayOpen(editor, true);
    beginLogicOverlayDrag('move', { left: 200, top: 100, width: 900, height: 500 }, 500, 400);
    updateLogicOverlayDrag(editor, 400, 300);
    endLogicOverlayDrag(editor);

    setLogicOverlayOpen(editor, false);
    setLogicOverlayOpen(editor, true);

    expect(readRect(root)).toEqual({ left: 100, top: 0, width: 900, height: 500 });
    expect(readRect(root)).not.toEqual(placeLogicOverlayInFrame(FRAME, VIEWPORT));
  });
});

describe('VFN-005 — sendLogicOverlayHome', () => {
  it('puts a window that was burying the app back over the node graph frame', () => {
    const { editor, root } = fakeEditor(FRAME);

    setLogicOverlayOpen(editor, true);
    beginLogicOverlayDrag('move', { left: 700, top: 400, width: 900, height: 500 }, 0, 0);
    updateLogicOverlayDrag(editor, -700, -400);
    endLogicOverlayDrag(editor);

    // The control: it is somewhere unhelpful now.
    expect(rectsIntersect(readRect(root), DOCK)).toBe(true);

    sendLogicOverlayHome(editor);

    expect(readRect(root)).toEqual(placeLogicOverlayInFrame(FRAME, VIEWPORT));
    expect(rectsIntersect(readRect(root), DOCK)).toBe(false);
  });

  it('stores the home placement, so it survives the reopen', () => {
    // Home is a placement the builder chose, like a drag is. A home that reverted on the next
    // open would make the control a one-shot.
    const { editor, root } = fakeEditor(FRAME);

    setLogicOverlayOpen(editor, true);
    sendLogicOverlayHome(editor);

    expect(store[LOGIC_OVERLAY_STORAGE_KEY]).toBeTruthy();

    setLogicOverlayOpen(editor, false);
    setLogicOverlayOpen(editor, true);

    expect(readRect(root)).toEqual(placeLogicOverlayInFrame(FRAME, VIEWPORT));
  });

  it('re-measures Blockly, because nothing else will', () => {
    const { editor } = fakeEditor(FRAME);
    const workspace = jest.fn();
    const unregister = registerBlocklyResizeHandler(workspace);

    setLogicOverlayOpen(editor, true);
    workspace.mockClear();

    sendLogicOverlayHome(editor);

    expect(workspace).toHaveBeenCalledTimes(1);
    unregister();
  });
});

describe('VFN-005 / VFN-012 — yielding to a side panel opened from inside the window', () => {
  it('🔴 moves a window that is over the dock, and stores where it landed', () => {
    // The reported defect: *Open app settings* works, and the panel opens behind the window the
    // button was pressed from.
    const { editor, root } = fakeEditor(FRAME);

    setLogicOverlayOpen(editor, true);
    beginLogicOverlayDrag('move', { left: 140, top: 214, width: 1014, height: 543 }, 0, 0);
    updateLogicOverlayDrag(editor, 0, 0);
    endLogicOverlayDrag(editor);

    // The control: this is the state being fixed, at the size the drive measured.
    expect(rectsIntersect(readRect(root), sidePanelRegion(FRAME.left, VIEWPORT))).toBe(true);

    expect(yieldLogicOverlayToSidePanel(editor)).toBe('moved');

    const after = readRect(root);
    expect(rectsIntersect(after, sidePanelRegion(FRAME.left, VIEWPORT))).toBe(false);
    // The builder's size is theirs. Shrinking to make room is how a 640px floor gets violated.
    expect(after.width).toBe(1014);
    expect(after.height).toBe(543);
    expect(store[LOGIC_OVERLAY_STORAGE_KEY]).toBeTruthy();
  });

  it('leaves a window that is already clear exactly where it is', () => {
    // Which is what a window in its home placement is — the point of the home placement.
    const { editor, root } = fakeEditor(FRAME);

    setLogicOverlayOpen(editor, true);
    const before = readRect(root);

    expect(yieldLogicOverlayToSidePanel(editor)).toBe('clear');
    expect(readRect(root)).toEqual(before);
  });

  it('re-measures Blockly when it moves the window', () => {
    const { editor } = fakeEditor(FRAME);
    const workspace = jest.fn();
    const unregister = registerBlocklyResizeHandler(workspace);

    setLogicOverlayOpen(editor, true);
    beginLogicOverlayDrag('move', { left: 0, top: 100, width: 900, height: 500 }, 0, 0);
    updateLogicOverlayDrag(editor, 0, 0);
    endLogicOverlayDrag(editor);
    workspace.mockClear();

    expect(yieldLogicOverlayToSidePanel(editor)).toBe('moved');
    expect(workspace).toHaveBeenCalledTimes(1);

    unregister();
  });

  it('🔴 asks to be parked when there is nowhere on this viewport to move to', () => {
    // A viewport narrow enough that the window plus the panel's column do not both fit. The
    // caller collapses the window to its title bar instead, which always works.
    const { editor } = fakeEditor({ left: 0, top: 0, width: 460, height: 400 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).window.innerWidth = 460;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).window.innerHeight = 400;

    setLogicOverlayOpen(editor, true);

    expect(yieldLogicOverlayToSidePanel(editor)).toBe('park');
  });

  it('does nothing at all while the window is closed', () => {
    const { editor, root } = fakeEditor(FRAME);

    expect(yieldLogicOverlayToSidePanel(editor)).toBe('clear');
    expect(root.properties.size).toBe(0);
  });
});

describe('LGC-010 — reflowLogicOverlay', () => {
  it('does nothing while the window is closed', () => {
    const { editor, root } = fakeEditor();

    reflowLogicOverlay(editor);

    expect(root.properties.size).toBe(0);
  });

  it('pulls a window back on screen when the editor window shrinks', () => {
    // Opening the laptop after a session on an external display. Without this the block editor
    // is off screen with its title bar out of reach and no way back to it.
    const { editor, root } = fakeEditor();

    setLogicOverlayOpen(editor, true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).window.innerWidth = 900;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).window.innerHeight = 600;

    reflowLogicOverlay(editor);

    const rect = readRect(root);
    expect(rect.width).toBeLessThanOrEqual(900);
    expect(rect.height).toBeLessThanOrEqual(600);
    expect(rect.left).toBeLessThan(900);
    expect(rect.top).toBeGreaterThanOrEqual(0);
  });

  it('re-measures Blockly even when the clamp did not move anything', () => {
    // The renderer may have been occluded through the resize that changed the window, in which
    // case Blockly heard nothing at all. `resizeBlocklyWorkspaces` is a no-op for a workspace
    // whose own box did not move, so this costs nothing when it is not needed.
    const { editor } = fakeEditor();
    const workspace = jest.fn();
    const unregister = registerBlocklyResizeHandler(workspace);

    setLogicOverlayOpen(editor, true);
    workspace.mockClear();

    reflowLogicOverlay(editor);

    expect(workspace).toHaveBeenCalledTimes(1);
    unregister();
  });
});
