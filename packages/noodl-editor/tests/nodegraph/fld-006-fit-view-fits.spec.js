/**
 * FLD-006 (#33) — "Fit view fits".
 *
 * The unit arm lives in tests/canvas/CanvasViewport.test.ts, on the pure math.
 * This one boots a real NodeGraphEditor because the defect was never in the
 * math: `centerOn` is honest about being a centre at scale 1, and the bug was
 * that `centerToFit(AllNodes)` — the HUD's Fit view button — routed there. So
 * the thing worth asserting in a real editor is the *route*, and the one thing
 * this task must not disturb: the camera every project opens with.
 *
 * Harness copied from canvas-characterisation.spec.js (400x800 pane).
 */
const { NodeGraphNode } = require('@noodl-models/nodegraphmodel');
const { NodeGraphEditor, CenterToFitMode } = require('@noodl-views/nodegrapheditor');
const { ProjectModel } = require('@noodl-models/projectmodel');
const { NodeLibrary } = require('@noodl-models/nodelibrary');
const { UndoQueue } = require('@noodl-models/undo-queue-model');
const { SidebarModel } = require('@noodl-models/sidebar');
const PopupLayer = require('@noodl-views/popuplayer').default;
const { ViewerConnection } = require('../../src/editor/src/ViewerConnection');

describe('FLD-006 fit view fits', function () {
  let editor, graph;

  const NODE1 = '5a1f0001-0000-4000-8000-00000000f001';
  const NODE2 = '5a1f0002-0000-4000-8000-00000000f002';
  const NODE3 = '5a1f0003-0000-4000-8000-00000000f003';

  const project = {
    components: [
      {
        name: 'Root',
        ports: [],
        visual: true,
        visualRootId: NODE1,
        canHaveVisualChildren: false,
        graph: { connections: [], roots: [] }
      }
    ]
  };

  /**
   * A dense pair on the left and one far outlier on the right: wider than the
   * 400px pane, and asymmetric, so a fix for the scale alone would still land
   * the camera in the wrong place.
   */
  function addWideGraph() {
    graph.addRoot(NodeGraphNode.fromJSON({ id: NODE1, type: 'group', label: 'group1', x: 0, y: 0 }), {
      disableSelect: true
    });
    graph.addRoot(NodeGraphNode.fromJSON({ id: NODE2, type: 'group', label: 'group2', x: 40, y: 120 }), {
      disableSelect: true
    });
    graph.addRoot(NodeGraphNode.fromJSON({ id: NODE3, type: 'group', label: 'group3', x: 1400, y: 40 }), {
      disableSelect: true
    });
    editor.layout();
  }

  function cssSize() {
    return {
      width: editor.canvas.width / editor.canvas.ratio,
      height: editor.canvas.height / editor.canvas.ratio
    };
  }

  /** Every root's rectangle in canvas CSS pixels under the given camera. */
  function rootsOnCanvas(ps) {
    return editor.roots.map((r) => ({
      left: (r.x + ps.x) * ps.scale,
      right: (r.x + r.measuredSize.width + ps.x) * ps.scale,
      top: (r.y + ps.y) * ps.scale,
      bottom: (r.y + r.measuredSize.height + ps.y) * ps.scale
    }));
  }

  beforeEach(function (done) {
    window.NodeLibraryData = require('./nodelibrary');
    NodeLibrary.instance.loadLibrary();

    ProjectModel.instance = ProjectModel.fromJSON(project);
    NodeLibrary.instance.registerModule(ProjectModel.instance);

    graph = ProjectModel.instance.getComponentWithName('Root').graph;

    PopupLayer.instance = {
      showTooltip() {},
      hideTooltip() {},
      showToast() {},
      showInteraction() {},
      on() {},
      hidePopup() {},
      showPopup() {},
      showPopout() {
        return {};
      },
      isDragging() {
        return false;
      },
      showModal() {},
      hideModal() {},
      hideAllModalsAndPopups() {},
      setDragMessage() {},
      indicateDropType() {}
    };

    ViewerConnection.instance = {
      on() {},
      off() {},
      sendNodeHighlighted() {}
    };

    UndoQueue.instance = new UndoQueue();

    spyOn(SidebarModel.instance, 'switchToNode');

    const host = document.createElement('div');
    host.id = 'fld-006-test';
    host.setAttribute('style', 'position:absolute; top:0px; left:0px; width:400px; height:800px;');
    document.body.appendChild(host);

    editor = new NodeGraphEditor({ model: graph });
    editor.render();
    host.appendChild(editor.el);
    editor.resize({ x: 0, y: 0, width: 400, height: 800 });
    editor.setPanAndScale({ scale: 1, x: 0, y: 0 });

    setTimeout(done, 25);
  });

  afterEach(function () {
    editor.setHighlightedNode(undefined);
    editor.dispose();
    document.getElementById('fld-006-test').remove();
    editor = undefined;
  });

  it('puts every node inside the pane, below 100%', function () {
    addWideGraph();

    editor.centerToFit(CenterToFitMode.AllNodes);
    const ps = editor.getPanAndScale();

    // The HUD reads Math.round(scale * 100) — #33 reported a flat 100%.
    expect(ps.scale).toBeLessThan(1);

    const { width, height } = cssSize();
    rootsOnCanvas(ps).forEach((r) => {
      expect(r.left).toBeGreaterThanOrEqual(-0.001);
      expect(r.right).toBeLessThanOrEqual(width + 0.001);
      expect(r.top).toBeGreaterThanOrEqual(-0.001);
      expect(r.bottom).toBeLessThanOrEqual(height + 0.001);
    });
  });

  it('REVERTED ARM: the route it used to take leaves the outlier off the right edge', function () {
    addWideGraph();

    // `getCenterPanAndScale` is exactly what `centerToFit(AllNodes)` called
    // before this task, and it is still a public delegate — so this is the
    // pre-fix behaviour itself, not a re-implementation of it.
    const reverted = editor.getCenterPanAndScale();
    expect(reverted.scale).toBe(1);

    const { width } = cssSize();
    const overflowing = rootsOnCanvas(reverted).filter((r) => r.right > width || r.left < 0);
    expect(overflowing.length).toBeGreaterThan(0);
  });

  it('a second click of fit view changes nothing, because the first one was right', function () {
    addWideGraph();

    editor.centerToFit(CenterToFitMode.AllNodes);
    const first = Object.assign({}, editor.getPanAndScale());

    editor.centerToFit(CenterToFitMode.AllNodes);
    const second = editor.getPanAndScale();

    expect(second.scale).toBeCloseTo(first.scale, 10);
    expect(second.x).toBeCloseTo(first.x, 10);
    expect(second.y).toBeCloseTo(first.y, 10);
    expect(first.scale).toBeLessThan(1);
  });

  it('the camera a project opens with is UNCHANGED — still the root centre at scale 1', function () {
    addWideGraph();
    editor.viewport.panAndScale = undefined;

    // getPanAndScale falls back to centerToFit(RootNodes). FLD-006 deliberately
    // left that arm alone: changing it would change how every project looks the
    // moment it is opened.
    const opened = editor.getPanAndScale();
    expect(opened.scale).toBe(1);

    let cx = 0;
    let cy = 0;
    editor.roots.forEach((r) => {
      cx += r.x + r.nodeSize.width / 2;
      cy += r.y + r.nodeSize.height / 2;
    });
    cx /= editor.roots.length;
    cy /= editor.roots.length;

    const { width, height } = cssSize();
    expect(opened.x).toBeCloseTo(width / 2 - cx, 6);
    expect(opened.y).toBeCloseTo(height / 2 - cy, 6);
  });

  it('the fit sits at or above the zoom floor, so the minus button does not zoom back in', function () {
    addWideGraph();

    editor.centerToFit(CenterToFitMode.AllNodes);
    const fitted = editor.getPanAndScale().scale;

    editor.updateZoomLevel(200, 400, -1);
    expect(editor.getPanAndScale().scale).toBeLessThanOrEqual(fitted + 1e-9);
  });
});
