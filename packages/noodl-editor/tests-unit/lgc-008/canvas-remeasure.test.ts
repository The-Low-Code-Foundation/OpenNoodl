/**
 * LGC-008 F3 — a canvas that cannot be measured must not be measured as zero.
 *
 * This is a defect that predates the pane: open a Logic Builder (which hides the canvas),
 * resize the window (`ViewportActions.resize` calls `bindCanvas()` unconditionally), close the
 * tab, and the graph comes back on a 0×0 canvas with zero viewport metrics — `getPanAndScale`
 * guards on `canvas.width`, so it answers `{scale: 1, x: 0, y: 0}` and clamping is skipped —
 * until something else happens to resize it.
 *
 * The pane makes it structural rather than occasional: in split mode the canvas is never
 * hidden but is continuously resized, so the re-measure path runs on every splitter drag.
 *
 * These run in plain Node against fakes, which is possible because `CanvasDOMBindings` and
 * `CanvasVisibility` take the editor as an argument and touch no React. The fakes are the
 * shape the real editor has: `editor.canvas.width/height` are DEVICE pixels (CSS pixels times
 * the ratio), which is the arithmetic the staleness check has to get right.
 */

import {
  bindNodeGraphCanvas,
  measureNodeGraphCanvas,
  nodeGraphCanvasIsStale,
  remeasureNodeGraphCanvas
} from '../../src/editor/src/views/nodegrapheditor/CanvasDOMBindings';
import { setNodeGraphCanvasVisibility } from '../../src/editor/src/views/nodegrapheditor/CanvasVisibility';

type FakeCanvas = {
  clientWidth: number;
  clientHeight: number;
  width: number;
  height: number;
  style: Record<string, string>;
  getContext: () => unknown;
  getBoundingClientRect: () => { x: number; y: number };
  addEventListener: jest.Mock;
};

function fakeCanvas(clientWidth: number, clientHeight: number): FakeCanvas {
  return {
    clientWidth,
    clientHeight,
    // The backing store the canvas already carries. `createCanvasShell` starts it at 1000×600.
    width: 1000,
    height: 600,
    style: {},
    getContext: () => ({}),
    getBoundingClientRect: () => ({ x: 0, y: 0 }),
    addEventListener: jest.fn()
  };
}

function fakeEditor(canvas: FakeCanvas) {
  return {
    shell: {
      canvas,
      commentLayerBg: { style: {} as Record<string, string> },
      commentLayerFg: { style: {} as Record<string, string> },
      highlightOverlayLayer: { style: {} as Record<string, string> },
      recordingOverlayLayer: { style: {} as Record<string, string> },
      componentTrailRoot: { style: {} as Record<string, string> },
      canvasHudRoot: { style: {} as Record<string, string> }
    },
    domElementContainer: { style: {} as Record<string, string> },
    canvas: {
      desiredWidth: 100,
      desiredHeight: 100,
      ratio: NaN,
      width: NaN,
      height: NaN,
      ctx: undefined
    },
    currentLayout: { width: 800, height: 600 },
    viewport: { setCanvasMetrics: jest.fn() },
    topLeftCanvasPos: [0, 0],
    mouse: jest.fn(),
    handleMouseWheelEvent: jest.fn(),
    interaction: { spaceKeyDown: false },
    resize: jest.fn()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

beforeAll(() => {
  // `CanvasViewport.devicePixelRatio` reads `window.devicePixelRatio`. 2 rather than 1 so a
  // spec that confused CSS pixels with device pixels cannot pass by coincidence.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).window = { devicePixelRatio: 2 };
});

describe('LGC-008 F3 — measureNodeGraphCanvas', () => {
  it('answers with the CSS size when the canvas has one', () => {
    expect(measureNodeGraphCanvas(fakeCanvas(1200, 800) as never)).toEqual({ width: 1200, height: 800 });
  });

  it('answers undefined for a hidden canvas, because 0 is the absence of a measurement', () => {
    // `display: none` reports clientWidth === clientHeight === 0. So does an element in a
    // container that has not been laid out yet.
    expect(measureNodeGraphCanvas(fakeCanvas(0, 0) as never)).toBeUndefined();
    expect(measureNodeGraphCanvas(fakeCanvas(1200, 0) as never)).toBeUndefined();
    expect(measureNodeGraphCanvas(fakeCanvas(0, 800) as never)).toBeUndefined();
  });
});

describe('LGC-008 F3 — bindNodeGraphCanvas', () => {
  it('writes the measured size into the backing store and the viewport metrics', () => {
    const canvas = fakeCanvas(1200, 800);
    const editor = fakeEditor(canvas);

    bindNodeGraphCanvas(editor);

    expect(canvas.width).toBe(2400);
    expect(canvas.height).toBe(1600);
    expect(editor.canvas.width).toBe(2400);
    expect(editor.canvas.height).toBe(1600);
    expect(editor.viewport.setCanvasMetrics).toHaveBeenCalledWith(2400, 1600, 2);
  });

  it('leaves the metrics alone when the canvas is hidden, rather than writing zeros', () => {
    // 🔴 The defect. `bindCanvas()` is called unconditionally by `ViewportActions.resize`, so a
    // window resize while a Logic Builder is open used to run exactly this path and replace a
    // good viewport with a zero one.
    const canvas = fakeCanvas(1200, 800);
    const editor = fakeEditor(canvas);
    bindNodeGraphCanvas(editor);
    editor.viewport.setCanvasMetrics.mockClear();

    canvas.clientWidth = 0;
    canvas.clientHeight = 0;
    bindNodeGraphCanvas(editor);

    expect(canvas.width).toBe(2400);
    expect(canvas.height).toBe(1600);
    expect(editor.canvas.width).toBe(2400);
    expect(editor.canvas.height).toBe(1600);
    expect(editor.viewport.setCanvasMetrics).not.toHaveBeenCalled();
  });

  it('still binds its listeners when the canvas is hidden', () => {
    // The guard is about the measurement, not about the element. A hidden canvas is the same
    // canvas that will be shown again, and a bind that skipped its listeners would trade one
    // defect for a worse one.
    const canvas = fakeCanvas(0, 0);
    const editor = fakeEditor(canvas);

    bindNodeGraphCanvas(editor);

    const boundEvents = canvas.addEventListener.mock.calls.map((call) => call[0]);
    expect(boundEvents).toEqual(expect.arrayContaining(['mousedown', 'mouseup', 'mousemove', 'wheel']));
  });
});

describe('LGC-008 F3 — remeasureNodeGraphCanvas', () => {
  it('resizes when the container moved under a bound canvas', () => {
    const canvas = fakeCanvas(1200, 800);
    const editor = fakeEditor(canvas);
    bindNodeGraphCanvas(editor);

    // A splitter drag: the container is narrower, and nothing observed it.
    canvas.clientWidth = 600;

    expect(nodeGraphCanvasIsStale(editor)).toBe(true);
    expect(remeasureNodeGraphCanvas(editor)).toBe(true);
    // The canvas's own size, not the frame's — `currentLayout` is read for centre-on-node, and
    // in split mode the frame is wider than the canvas.
    expect(editor.resize).toHaveBeenCalledWith({ width: 600, height: 800 });
  });

  it('does nothing when the canvas did not change size', () => {
    // This runs from a `mousemove`, and `editor.resize` relayouts and repaints the whole graph.
    const canvas = fakeCanvas(1200, 800);
    const editor = fakeEditor(canvas);
    bindNodeGraphCanvas(editor);

    expect(nodeGraphCanvasIsStale(editor)).toBe(false);
    expect(remeasureNodeGraphCanvas(editor)).toBe(false);
    expect(editor.resize).not.toHaveBeenCalled();
  });

  it('does nothing while the canvas is hidden — there is nothing to measure it to', () => {
    const canvas = fakeCanvas(0, 0);
    const editor = fakeEditor(canvas);

    expect(nodeGraphCanvasIsStale(editor)).toBe(false);
    expect(remeasureNodeGraphCanvas(editor)).toBe(false);
    expect(editor.resize).not.toHaveBeenCalled();
  });

  it('resizes a canvas that has never been bound', () => {
    // `editor.canvas.width` is NaN before the first bind, and NaN compares unequal to
    // everything — which is the right answer here rather than an accident.
    const editor = fakeEditor(fakeCanvas(1200, 800));

    expect(nodeGraphCanvasIsStale(editor)).toBe(true);
    expect(remeasureNodeGraphCanvas(editor)).toBe(true);
  });
});

describe('LGC-008 F3 — setNodeGraphCanvasVisibility', () => {
  it('re-measures on reveal, because the reveal is the first moment it can be measured', () => {
    // 🔴 The other half of the defect: hiding is a state change with two halves and only one
    // was written. The sequence is the real one — open a Logic Builder, resize the window while
    // it is open, close the tab.
    const canvas = fakeCanvas(1200, 800);
    const editor = fakeEditor(canvas);
    bindNodeGraphCanvas(editor);

    setNodeGraphCanvasVisibility(editor, false);
    canvas.clientWidth = 0;
    canvas.clientHeight = 0;
    bindNodeGraphCanvas(editor); // the window resize that happens while it is hidden

    // The tab closes; the canvas comes back into a container that is now narrower.
    canvas.clientWidth = 700;
    canvas.clientHeight = 500;
    setNodeGraphCanvasVisibility(editor, true);

    expect(editor.resize).toHaveBeenCalledWith({ width: 700, height: 500 });
  });

  it('does not re-measure on hide', () => {
    const canvas = fakeCanvas(1200, 800);
    const editor = fakeEditor(canvas);
    bindNodeGraphCanvas(editor);

    setNodeGraphCanvasVisibility(editor, false);

    expect(editor.resize).not.toHaveBeenCalled();
  });

  it('writes the same display values it always did', () => {
    // The body was moved out of `OverlayViews` verbatim; this is the characterisation that says
    // so. The component trail is `flex`, not `block`, and the DOM layer is cleared rather than
    // set — both load-bearing.
    const editor = fakeEditor(fakeCanvas(1200, 800));

    setNodeGraphCanvasVisibility(editor, false);
    expect(editor.shell.canvas.style.display).toBe('none');
    expect(editor.shell.commentLayerBg.style.display).toBe('none');
    expect(editor.shell.commentLayerFg.style.display).toBe('none');
    expect(editor.shell.highlightOverlayLayer.style.display).toBe('none');
    expect(editor.shell.recordingOverlayLayer.style.display).toBe('none');
    expect(editor.shell.canvasHudRoot.style.display).toBe('none');
    expect(editor.shell.componentTrailRoot.style.display).toBe('none');
    expect(editor.domElementContainer.style.display).toBe('none');

    setNodeGraphCanvasVisibility(editor, true);
    expect(editor.shell.canvas.style.display).toBe('block');
    expect(editor.shell.componentTrailRoot.style.display).toBe('flex');
    expect(editor.domElementContainer.style.display).toBe('');
  });
});
