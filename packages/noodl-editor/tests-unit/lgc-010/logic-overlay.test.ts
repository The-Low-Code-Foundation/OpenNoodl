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
  setLogicOverlayOpen,
  updateLogicOverlayDrag
} from '../../src/editor/src/views/nodegrapheditor/LogicOverlay';
import { defaultLogicOverlayRect } from '../../src/editor/src/views/nodegrapheditor/logicOverlayGeometry';

const VIEWPORT = { width: 1440, height: 800 };

/** A shell root with just enough of an element to be written to and read back. */
function fakeRoot() {
  const properties = new Map<string, string>();
  const classes = new Set<string>();

  return {
    properties,
    classes,
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

function fakeEditor() {
  const root = fakeRoot();

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
