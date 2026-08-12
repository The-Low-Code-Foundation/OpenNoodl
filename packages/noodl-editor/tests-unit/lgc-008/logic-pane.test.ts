/**
 * LGC-008 §1 — the pane. Opening a Visual Function splits the shell; it does not hide anything.
 *
 * Richard ruled on 2026-08-12 that *"a pane, not a takeover"* means the canvas and the blocks
 * are on screen **simultaneously**, and that a real second splitter gets built. These specs hold
 * the parts of that which are decidable without a running editor:
 *
 * - the split arithmetic, including both clamps and the shell too narrow for either;
 * - that opening the pane writes geometry and **not** `display: none` — the blanket hide is gone;
 * - that every geometry change re-measures both surfaces, synchronously, in that order;
 * - that the highlight overlay's escape (L27) is closed before any hide was removed.
 *
 * ⚠️ What they cannot hold, and what the task file's *Deferred verification* therefore owns: the
 * pixels. An occluded renderer does not report layout truthfully, so criterion 3 is a screenshot
 * and criterion 4's proof is the saved JSON on disk.
 */

import {
  blocklyResizeHandlerCount,
  registerBlocklyResizeHandler
} from '../../src/editor/src/views/BlocklyEditor/blocklyResize';
import { bindNodeGraphCanvas } from '../../src/editor/src/views/nodegrapheditor/CanvasDOMBindings';
import {
  EXECUTION_OVERLAY_Z,
  HIGHLIGHT_OVERLAY_Z,
  RECORDING_OVERLAY_Z
} from '../../src/editor/src/views/nodegrapheditor/CanvasShell';
import {
  LOGIC_PANE_SPLIT_CLASS,
  LOGIC_PANE_SPLIT_VAR,
  setLogicPaneOpen,
  setLogicPaneSplit
} from '../../src/editor/src/views/nodegrapheditor/LogicPane';
import {
  LOGIC_PANE_DEFAULT_PERCENT,
  LOGIC_PANE_MIN_PX,
  logicPaneSplitPercent
} from '../../src/editor/src/views/nodegrapheditor/logicPaneSplit';

beforeAll(() => {
  // `CanvasViewport.devicePixelRatio` reads `window.devicePixelRatio`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).window = { devicePixelRatio: 2 };
});

/** A shell root with just enough of an element to be written to and read back. */
function fakeRoot(shellWidth = 1600) {
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
    },
    getBoundingClientRect: () => ({ left: 0, width: shellWidth })
  };
}

function fakeLayer() {
  return { style: {} as Record<string, string> };
}

function fakeEditor(shellWidth = 1600) {
  const root = fakeRoot(shellWidth);
  const canvas = {
    clientWidth: 1600,
    clientHeight: 900,
    width: 1000,
    height: 600,
    style: {} as Record<string, string>,
    getContext: () => ({}),
    getBoundingClientRect: () => ({ x: 0, y: 0 }),
    addEventListener: jest.fn()
  };

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

  const resizedTo: { width: number; height: number; splitAtCall: string }[] = [];

  const editor = {
    shell: { root, canvas, ...layers },
    domElementContainer: fakeLayer(),
    canvas: { desiredWidth: 100, desiredHeight: 100, ratio: NaN, width: NaN, height: NaN, ctx: undefined },
    currentLayout: { width: 1600, height: 900 },
    viewport: { setCanvasMetrics: jest.fn() },
    topLeftCanvasPos: [0, 0],
    mouse: jest.fn(),
    handleMouseWheelEvent: jest.fn(),
    interaction: { spaceKeyDown: false },
    resize: jest.fn((layout: { width: number; height: number }) => {
      // Recorded at the moment of the call, so the ordering assertion is about what the canvas
      // could actually have measured rather than about what was true afterwards.
      resizedTo.push({ ...layout, splitAtCall: root.style.getPropertyValue(LOGIC_PANE_SPLIT_VAR) });
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  return { editor, root, canvas, layers, resizedTo };
}

describe('LGC-008 §1 — logicPaneSplitPercent', () => {
  const bounds = { left: 100, width: 1000 };

  it('follows the pointer', () => {
    expect(logicPaneSplitPercent(700, bounds)).toBe(60);
    expect(logicPaneSplitPercent(450, bounds)).toBe(35);
  });

  it('keeps both panes above the minimum, at either end', () => {
    // Dragged off the left edge entirely, and off the right.
    expect(logicPaneSplitPercent(-5000, bounds)).toBe((LOGIC_PANE_MIN_PX / bounds.width) * 100);
    expect(logicPaneSplitPercent(5000, bounds)).toBe(((bounds.width - LOGIC_PANE_MIN_PX) / bounds.width) * 100);
  });

  it('collapses to the middle when the shell cannot give both panes the minimum', () => {
    // One legible pane and one sliver is worse than two cramped ones, and it is not recoverable
    // by widening the window — the sliver has no grab target left.
    const narrow = { left: 0, width: LOGIC_PANE_MIN_PX };
    expect(logicPaneSplitPercent(0, narrow)).toBe(50);
    expect(logicPaneSplitPercent(9999, narrow)).toBe(50);
  });

  it('answers the default rather than dividing by zero for an unlaid-out shell', () => {
    expect(logicPaneSplitPercent(400, { left: 0, width: 0 })).toBe(LOGIC_PANE_DEFAULT_PERCENT);
  });

  it('rounds to two decimals, because the number is printed into CSS', () => {
    expect(logicPaneSplitPercent(433, { left: 0, width: 777 })).toBe(55.73);
  });
});

describe('LGC-008 §1 — setLogicPaneOpen', () => {
  it('splits the shell and gives the split a default the first time', () => {
    const { editor, root } = fakeEditor();

    setLogicPaneOpen(editor, true);

    expect(root.classList.contains(LOGIC_PANE_SPLIT_CLASS)).toBe(true);
    expect(root.style.getPropertyValue(LOGIC_PANE_SPLIT_VAR)).toBe(`${LOGIC_PANE_DEFAULT_PERCENT}%`);
  });

  it('keeps the split a builder chose, across closing and reopening the pane', () => {
    const { editor, root } = fakeEditor();

    setLogicPaneOpen(editor, true);
    setLogicPaneSplit(editor, 400); // 25% of a 1600 shell
    setLogicPaneOpen(editor, false);
    setLogicPaneOpen(editor, true);

    expect(root.style.getPropertyValue(LOGIC_PANE_SPLIT_VAR)).toBe('25%');
  });

  it('gives the whole shell back when the last tab closes', () => {
    const { editor, root } = fakeEditor();

    setLogicPaneOpen(editor, true);
    setLogicPaneOpen(editor, false);

    expect(root.classList.contains(LOGIC_PANE_SPLIT_CLASS)).toBe(false);
  });

  it('hides nothing — the blanket display:none is gone, not conditional', () => {
    // 🔴 The ruling, stated as a gate. Eight layers used to be hidden: the canvas, both comment
    // layers, the highlight overlay, the recording overlay, the canvas HUD, the component trail
    // and the DOM layer. Every one of them is a layer of the canvas pane now.
    const { editor, layers, canvas } = fakeEditor();

    setLogicPaneOpen(editor, true);

    const everyLayer = [...Object.values(layers), editor.domElementContainer];
    for (const layer of everyLayer) {
      expect(layer.style.display).toBeUndefined();
    }
    expect(canvas.style.display).toBeUndefined();
  });

  it('re-measures both surfaces, because neither observes its container', () => {
    const { editor, resizedTo } = fakeEditor();
    const workspace = jest.fn();
    const unregister = registerBlocklyResizeHandler(workspace);

    // The canvas is stale: it has never been bound, so its backing store disagrees with the
    // width it is drawn at.
    setLogicPaneOpen(editor, true);

    expect(resizedTo).toHaveLength(1);
    expect(workspace).toHaveBeenCalledTimes(1);

    unregister();
    expect(blocklyResizeHandlerCount()).toBe(0);
  });
});

describe('LGC-008 §1 — setLogicPaneSplit', () => {
  it('writes the split before re-measuring, so nothing is measured against the old geometry', () => {
    const { editor, root, canvas, resizedTo } = fakeEditor(1600);
    bindNodeGraphCanvas(editor); // the canvas starts in agreement with its container

    // A drag to 600px of a 1600px shell. The canvas's container narrows with it — in the real
    // DOM that is the stylesheet reacting to the custom property; here it is the fake keeping
    // up, which is the same thing a synchronous `clientWidth` read would have forced.
    canvas.clientWidth = 600;
    setLogicPaneSplit(editor, 600);

    expect(root.style.getPropertyValue(LOGIC_PANE_SPLIT_VAR)).toBe('37.5%');
    expect(resizedTo).toEqual([{ width: 600, height: 900, splitAtCall: '37.5%' }]);
  });

  it('costs nothing when the drag did not move the canvas', () => {
    // This runs at `mousemove` frequency and `editor.resize` relayouts and repaints the graph.
    const { editor, resizedTo } = fakeEditor(1600);
    bindNodeGraphCanvas(editor);

    setLogicPaneSplit(editor, 1600);

    expect(resizedTo).toHaveLength(0);
  });
});

describe('LGC-008 L27 — the highlight overlay stops escaping', () => {
  it('gives the highlight wrapper a z-index above the other two overlays and below .popup-layer', () => {
    // 🔴 Its wrapper was the only one built without a `z-index`, so it was not a stacking
    // context and `HighlightedConnection` (999), `HighlightedNode` (1000) and
    // `BoundaryIndicator` (1001) escaped to the body level and out-painted the tabs root's 100.
    // While the canvas was hidden that never showed; with both panes on screen it would draw a
    // lesson highlight straight over the Blockly workspace. This is the one hide that was
    // load-bearing, and closing the escape is what made removing it safe.
    const z = Number(HIGHLIGHT_OVERLAY_Z);

    expect(Number.isFinite(z)).toBe(true);
    expect(z).toBeGreaterThan(Number(RECORDING_OVERLAY_Z));
    expect(Number(RECORDING_OVERLAY_Z)).toBeGreaterThan(Number(EXECUTION_OVERLAY_Z));
    // `.popup-layer` is 10 and must keep drawing over every canvas overlay.
    expect(z).toBeLessThan(10);
  });
});
