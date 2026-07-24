/**
 * PLAT-001 characterisation tests.
 *
 * These pin the CURRENT behaviour of the canvas subsystem (viewport math,
 * hit-testing, interaction state machines) before and during the decomposition
 * of nodegrapheditor.ts. They must pass unchanged after every extraction —
 * any behavioural difference is a bug in the extraction, not in the test.
 *
 * The harness boots a real NodeGraphEditor in the Electron test runner, same
 * pattern as nodegrapheditor.js, with the test node library loaded so nodes
 * measure and connections resolve ports.
 */
const { NodeGraphNode } = require('@noodl-models/nodegraphmodel');
const { NodeGraphEditor } = require('@noodl-views/nodegrapheditor');
const { ProjectModel } = require('@noodl-models/projectmodel');
const { NodeLibrary } = require('@noodl-models/nodelibrary');
const { UndoQueue } = require('@noodl-models/undo-queue-model');
const { SidebarModel } = require('@noodl-models/sidebar');
const PopupLayer = require('@noodl-views/popuplayer');
const { ViewerConnection } = require('../../src/editor/src/ViewerConnection');

describe('Canvas characterisation (PLAT-001)', function () {
  let editor, graph;

  const NODE1 = '14e31556-f569-21bb-e948-65af515ae574';
  const NODE2 = '33a2be5c-b341-27b4-292f-aee1b5bc30fe';
  const NODE3 = '34ea0053-3334-d2cb-3a31-de577030102e';

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

  function addNodes() {
    graph.addRoot(NodeGraphNode.fromJSON({ id: NODE1, type: 'group', label: 'group1', x: 49, y: 75 }), {
      disableSelect: true
    });
    graph.addRoot(NodeGraphNode.fromJSON({ id: NODE2, type: 'group', label: 'group2', x: 49, y: 164 }), {
      disableSelect: true
    });
    graph.addRoot(NodeGraphNode.fromJSON({ id: NODE3, type: 'group', label: 'group3', x: 49, y: 267 }), {
      disableSelect: true
    });
    editor.layout();
  }

  function addConnection() {
    graph.addConnection({ fromId: NODE1, fromProperty: 'screenX', toId: NODE2, toProperty: 'x' });
    editor.layout();
  }

  function nodeView(id) {
    return editor.findNodeWithId(id);
  }

  // Canvas-space mouse event helper. With panAndScale {1,0,0} canvas
  // coordinates equal graph coordinates.
  function mouse(type, x, y, evt) {
    return editor.mouse(type, { x, y, pageX: x, pageY: y }, Object.assign({ button: 0 }, evt || {}));
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

    // Selecting a node switches the sidebar to the property editor, which is
    // not registered in the test runner — stub it out (auto-restored by jasmine).
    spyOn(SidebarModel.instance, 'switchToNode');

    $('body').append(
      '<div id="canvas-char-test" style="position:absolute; top:0px; left:0px; width:400px; height:800px;"></div>'
    );

    editor = new NodeGraphEditor({ model: graph });
    editor.render();
    $('#canvas-char-test').append(editor.el);
    editor.resize({ x: 0, y: 0, width: 400, height: 800 });
    editor.setPanAndScale({ scale: 1, x: 0, y: 0 });

    // render() defers overlay/comment mounts by a tick — let them settle
    setTimeout(done, 25);
  });

  afterEach(function () {
    editor.setHighlightedNode(undefined); // cancel any pending inspector timer
    editor.dispose();
    $('#canvas-char-test').remove();
    editor = undefined;
  });

  // ---------------------------------------------------------------- viewport

  it('setPanAndScale/getPanAndScale round-trips', function () {
    editor.setPanAndScale({ scale: 0.5, x: 100, y: 50 });
    expect(editor.getPanAndScale()).toEqual({ scale: 0.5, x: 100, y: 50 });
  });

  it('getPanAndScale with no pan set centers the root nodes at scale 1', function () {
    addNodes();
    editor.viewport.panAndScale = undefined;

    let cx = 0;
    let cy = 0;
    editor.roots.forEach((r) => {
      cx += r.x + r.nodeSize.width / 2;
      cy += r.y + r.nodeSize.height / 2;
    });
    cx /= editor.roots.length;
    cy /= editor.roots.length;

    const expected = {
      x: editor.canvas.width / editor.canvas.ratio / 2 - cx,
      y: editor.canvas.height / editor.canvas.ratio / 2 - cy,
      scale: 1
    };

    const ps = editor.getPanAndScale();
    expect(ps.scale).toBe(1);
    expect(ps.x).toBeCloseTo(expected.x, 6);
    expect(ps.y).toBeCloseTo(expected.y, 6);

    // and the fallback stores the result
    expect(editor.viewport.panAndScale).toEqual(ps);
  });

  it('relativeCoordsToNodeGraphCords divides by scale then subtracts pan', function () {
    editor.setPanAndScale({ scale: 0.5, x: 100, y: 50 });
    expect(editor.relativeCoordsToNodeGraphCords({ x: 200, y: 400 })).toEqual({ x: 300, y: 750 });

    editor.setPanAndScale({ scale: 1, x: 0, y: 0 });
    expect(editor.relativeCoordsToNodeGraphCords({ x: 123, y: 456 })).toEqual({ x: 123, y: 456 });
  });

  it('updateZoomLevel scales by 0.95^-deltaZ and compensates pan around the cursor', function () {
    addNodes();
    editor.setPanAndScale({ scale: 1, x: 0, y: 0 });

    editor.updateZoomLevel(200, 400, -1);

    const ps = editor.getPanAndScale();
    expect(ps.scale).toBeCloseTo(0.95, 10);
    // pan' = pan + (cursor/scale' - cursor/scale), unclamped for this graph
    expect(ps.x).toBeCloseTo(200 / 0.95 - 200, 6);
    expect(ps.y).toBeCloseTo(400 / 0.95 - 400, 6);
  });

  it('updateZoomLevel clamps zoom-in at scale 1', function () {
    addNodes();
    editor.setPanAndScale({ scale: 1, x: 0, y: 0 });

    editor.updateZoomLevel(200, 400, 5);

    const ps = editor.getPanAndScale();
    expect(ps.scale).toBe(1);
    expect(ps.x).toBeCloseTo(0, 6);
    expect(ps.y).toBeCloseTo(0, 6);
  });

  it('updateZoomLevel clamps zoom-out at 0.33 for a graph smaller than the canvas', function () {
    addNodes();
    editor.setPanAndScale({ scale: 1, x: 0, y: 0 });

    for (let i = 0; i < 50; i++) {
      editor.updateZoomLevel(200, 400, -3);
    }

    expect(editor.getPanAndScale().scale).toBeCloseTo(0.33, 10);
  });

  it('clampPanAndScale keeps 100 visible pixels of graph at each border', function () {
    addNodes();
    const aabb = editor.viewport.graphAABB;
    const canvasWidth = editor.canvas.width / editor.canvas.ratio;

    // Panned far right: clamped so the graph stays 100px inside the right edge
    const clamped = editor.clampPanAndScale({ scale: 1, x: 10000, y: 0 });
    expect(clamped.x).toBe(canvasWidth - aabb.minX - 100);
    expect(clamped.y).toBe(0);

    // Panned far left: clamped against the left border
    const clamped2 = editor.clampPanAndScale({ scale: 1, x: -10000, y: 0 });
    expect(clamped2.x).toBe(100 - aabb.maxX);
  });

  it('moveRoots pans by the given delta (with clamping a no-op for small deltas)', function () {
    addNodes();
    editor.setPanAndScale({ scale: 1, x: 0, y: 0 });

    editor.moveRoots(-10, 7);

    const ps = editor.getPanAndScale();
    expect(ps.x).toBe(-10);
    expect(ps.y).toBe(7);
  });

  it('calculateNodesAABB is the union of node rects in global coordinates', function () {
    addNodes();
    const n1 = nodeView(NODE1);
    const n3 = nodeView(NODE3);

    const aabb = editor.calculateNodesAABB([n1, n3]);
    expect(aabb.minX).toBe(Math.min(n1.global.x, n3.global.x));
    expect(aabb.minY).toBe(n1.global.y);
    expect(aabb.maxX).toBe(Math.max(n1.global.x + n1.nodeSize.width, n3.global.x + n3.nodeSize.width));
    expect(aabb.maxY).toBe(n3.global.y + n3.nodeSize.height);
  });

  // ------------------------------------------------------------- hit-testing

  it('findNodeWithId finds views for all roots', function () {
    addNodes();
    expect(nodeView(NODE1)).toBeDefined();
    expect(nodeView(NODE2)).toBeDefined();
    expect(nodeView(NODE3)).toBeDefined();
    expect(nodeView('nope')).toBeUndefined();
    expect(nodeView(NODE1).model.id).toBe(NODE1);
  });

  it('isPointInsideNodes hits inside the node rect and misses outside', function () {
    addNodes();
    const n1 = nodeView(NODE1);
    const inside = { x: n1.global.x + 5, y: n1.global.y + 5 };
    const outside = { x: n1.global.x - 1, y: n1.global.y - 1 };

    expect(editor.isPointInsideNodes(inside, [n1])).toBe(true);
    expect(editor.isPointInsideNodes(outside, [n1])).toBe(false);
    // edges are inclusive
    expect(editor.isPointInsideNodes({ x: n1.global.x, y: n1.global.y }, [n1])).toBe(true);
    expect(
      editor.isPointInsideNodes({ x: n1.global.x + n1.nodeSize.width, y: n1.global.y + n1.nodeSize.height }, [n1])
    ).toBe(true);
  });

  it('findConnectionWithKey concatenates fromId+fromProperty+toId+toProperty', function () {
    addNodes();
    addConnection();

    const key = NODE1 + 'screenX' + NODE2 + 'x';
    const con = editor.findConnectionWithKey(key);
    expect(con).toBeDefined();
    expect(con.model.fromId).toBe(NODE1);
    expect(editor.findConnectionWithKey('bogus')).toBeUndefined();

    expect(editor.findConnectionWithModel(con.model)).toBe(con);
  });

  it('multiselectNodes selects nodes overlapping the rect, with union and reduce modes', function () {
    addNodes();
    const n1 = nodeView(NODE1);
    const n2 = nodeView(NODE2);
    const n3 = nodeView(NODE3);

    // rect covering only the first two nodes
    const midY = n2.global.y + n2.nodeSize.height + 1;
    editor.multiselectNodes(0, 0, 400, midY, 'select');
    expect(editor.selector.nodes.length).toBe(2);
    expect(editor.selector.isActive(n1)).toBe(true);
    expect(editor.selector.isActive(n2)).toBe(true);
    expect(editor.selector.isActive(n3)).toBe(false);

    // union adds the third
    editor.interaction.lastMultiselected = [...editor.selector.nodes];
    editor.multiselectNodes(0, n3.global.y, 400, n3.global.y + 5, 'union');
    expect(editor.selector.nodes.length).toBe(3);

    // reduce removes the first two again
    editor.interaction.lastMultiselected = [...editor.selector.nodes];
    editor.multiselectNodes(0, 0, 400, midY, 'reduce');
    expect(editor.selector.nodes.length).toBe(1);
    expect(editor.selector.isActive(n3)).toBe(true);
  });

  // ------------------------------------------------------------- interaction

  it('right-mouse drag pans the viewport by the mouse delta over scale', function () {
    addNodes();
    editor.setPanAndScale({ scale: 1, x: 0, y: 0 });

    mouse('down', 300, 700, { button: 2 });
    expect(editor.interaction.panMouseDown).toEqual({ x: 300, y: 700, pageX: 300, pageY: 700 });

    mouse('move', 290, 707, { button: 2 });
    const ps = editor.getPanAndScale();
    expect(ps.x).toBe(-10);
    expect(ps.y).toBe(7);

    mouse('up', 290, 707, { button: 2 });
    expect(editor.interaction.panMouseDown).toBeUndefined();
  });

  it('space+left-mouse drag also pans', function () {
    addNodes();
    editor.setPanAndScale({ scale: 1, x: 0, y: 0 });

    mouse('down', 300, 700, { button: 0, spaceKey: true });
    expect(editor.interaction.panMouseDown).toBeTruthy();

    mouse('move', 305, 695, { button: 0, spaceKey: true });
    const ps = editor.getPanAndScale();
    expect(ps.x).toBe(5);
    expect(ps.y).toBe(-5);

    mouse('up', 305, 695, { button: 0, spaceKey: true });
    expect(editor.interaction.panMouseDown).toBeUndefined();
  });

  it('left-mouse drag on empty space box-selects nodes and keeps them selected on up', function () {
    addNodes();
    editor.setPanAndScale({ scale: 1, x: 0, y: 0 });

    mouse('move', 350, 700);
    mouse('down', 350, 700);
    expect(editor.interaction.multiselectMouseDown).toEqual({ x: 350, y: 700 });

    mouse('move', 30, 60);
    expect(editor.selector.nodes.length).toBe(3);

    mouse('up', 30, 60);
    expect(editor.interaction.multiselectMouseDown).toBeUndefined();
    expect(editor.interaction.multiselectMouseMove).toBeUndefined();
    expect(editor.selector.nodes.length).toBe(3);
  });

  it('dragging a node moves it, commits the move to the model, and undo restores it', function () {
    addNodes();
    editor.setPanAndScale({ scale: 1, x: 0, y: 0 });

    const n1 = nodeView(NODE1);
    const startX = n1.global.x;
    const startY = n1.global.y;
    const cx = startX + n1.nodeSize.width / 2;
    const cy = startY + n1.nodeSize.height / 2;

    // hover to highlight, then press to start the drag
    mouse('move', cx, cy);
    expect(editor.highlighted).toBe(n1);

    mouse('down', cx, cy);
    expect(editor.interaction.draggingNodes).toEqual([n1]);

    mouse('move', cx + 30, cy + 40);
    expect(n1.x).toBe(49 + 30);
    expect(n1.y).toBe(75 + 40);
    // model not committed until mouse up
    expect(n1.model.x).toBe(49);
    expect(n1.model.y).toBe(75);

    mouse('up', cx + 30, cy + 40);
    expect(editor.interaction.draggingNodes).toBeUndefined();
    expect(n1.model.x).toBe(49 + 30);
    expect(n1.model.y).toBe(75 + 40);

    editor.undo();
    expect(n1.model.x).toBe(49);
    expect(n1.model.y).toBe(75);
  });

  it('a small movement between down and up is a click, not a drag commit', function () {
    addNodes();
    editor.setPanAndScale({ scale: 1, x: 0, y: 0 });

    const n1 = nodeView(NODE1);
    const cx = n1.global.x + n1.nodeSize.width / 2;
    const cy = n1.global.y + n1.nodeSize.height / 2;

    mouse('move', cx, cy);
    mouse('down', cx, cy);
    mouse('move', cx + 2, cy + 2);
    mouse('up', cx + 2, cy + 2);

    expect(n1.model.x).toBe(49);
    expect(n1.model.y).toBe(75);
    expect(editor.interaction.draggingNodes).toBeUndefined();
  });

  it('dragging from the connection area starts a connection drag and releases on empty space', function () {
    addNodes();
    editor.setPanAndScale({ scale: 1, x: 0, y: 0 });

    const n1 = nodeView(NODE1);
    // connection drag hotspot: within 20px of the right edge, top 20px
    const hx = n1.global.x + n1.nodeSize.width - 5;
    const hy = n1.global.y + 5;

    mouse('move', hx, hy);
    expect(n1.connectionDragAreaHighlighted || n1.borderHighlighted).toBe(true);

    mouse('down', hx, hy);
    expect(editor.interaction.draggingConnection).toBeDefined();
    expect(editor.interaction.draggingConnection.fromNode).toBe(n1);

    mouse('move', 350, 700);
    expect(editor.interaction.draggingConnection.pos).toEqual({ x: 350, y: 700 });
    expect(editor.interaction.draggingConnection.toNode).toBeUndefined();

    mouse('up', 350, 700);
    expect(editor.interaction.draggingConnection).toBeUndefined();
  });

  it('latestMousePos tracks the graph-space mouse position under pan and zoom', function () {
    addNodes();
    editor.setPanAndScale({ scale: 0.5, x: 100, y: 50 });

    mouse('move', 200, 400);
    expect(editor.interaction.latestMousePos).toEqual({ x: 300, y: 750 });
  });

  it('verifyWithModel holds for the base setup', function () {
    addNodes();
    addConnection();
    expect(editor.verifyWithModel()).toBe(true);
  });
});
