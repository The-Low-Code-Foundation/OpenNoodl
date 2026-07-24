import { InteractionController } from '../../src/editor/src/views/nodegrapheditor/canvas/InteractionController';
import PopupLayer from '../../src/editor/src/views/popuplayer';

/**
 * Unit tests with a stubbed owner. Full-stack behaviour (against a real
 * NodeGraphEditor) is covered by tests/nodegraph/canvas-characterisation.spec.js;
 * these pin the controller's state machines in isolation.
 */
function stubOwner() {
  const owner: TSFixme = {
    readOnly: false,
    model: {},
    roots: [],
    connections: [],
    highlighted: undefined,
    highlightedConnection: undefined,
    selector: {
      nodes: [],
      active: false,
      select: jasmine.createSpy('select'),
      unselect: jasmine.createSpy('unselect'),
      isActive: () => false
    },
    commentLayer: {
      clearSelection: jasmine.createSpy('clearSelection'),
      clearMultiselection: jasmine.createSpy('clearMultiselection'),
      moveSelectedComments: jasmine.createSpy('moveSelectedComments'),
      commitSelectedComments: jasmine.createSpy('commitSelectedComments'),
      getSelectedComments: () => []
    },
    getPanAndScale: () => ({ scale: 2, x: 0, y: 0 }),
    relativeCoordsToNodeGraphCords: (pos: TSFixme) => ({ x: pos.x / 2, y: pos.y / 2 }),
    hideInspectors: jasmine.createSpy('hideInspectors'),
    hideNodeToolbar: jasmine.createSpy('hideNodeToolbar'),
    setDOMLayerVisible: jasmine.createSpy('setDOMLayerVisible'),
    updateNodeToolbar: jasmine.createSpy('updateNodeToolbar'),
    clearSelection: jasmine.createSpy('clearSelection'),
    multiselectNodes: jasmine.createSpy('multiselectNodes'),
    moveRoots: jasmine.createSpy('moveRoots'),
    setCanvasCursor: jasmine.createSpy('setCanvasCursor'),
    updateZoomLevel: jasmine.createSpy('updateZoomLevel'),
    openRightClickMenu: jasmine.createSpy('openRightClickMenu'),
    relayout: jasmine.createSpy('relayout'),
    repaint: jasmine.createSpy('repaint'),
    mouseWheelDetector: { changeMode: () => 'mouse' }
  };
  return owner;
}

describe('InteractionController', () => {
  let owner: TSFixme;
  let controller: InteractionController;
  let popupLayerBefore: TSFixme;

  beforeEach(() => {
    popupLayerBefore = PopupLayer.instance;
    PopupLayer.instance = {
      isDragging: () => false,
      hidePopup() {},
      hideTooltip() {}
    } as TSFixme;

    owner = stubOwner();
    controller = new InteractionController(owner);
  });

  afterEach(() => {
    PopupLayer.instance = popupLayerBefore;
  });

  function mouse(type: TSFixme, x: number, y: number, evt?: TSFixme) {
    return controller.mouse(type, { x, y }, Object.assign({ button: 0 }, evt || {}));
  }

  it('ignores events when mouse events are disabled or there is no model', () => {
    controller.mouseEventsEnabled = false;
    expect(mouse('down', 0, 0)).toBe(false);

    controller.mouseEventsEnabled = true;
    owner.model = undefined;
    expect(mouse('down', 0, 0)).toBe(false);
  });

  it('tracks latestMousePos in graph coordinates', () => {
    mouse('move', 100, 60);
    expect(controller.latestMousePos).toEqual({ x: 50, y: 30 });
  });

  it('pans on right-mouse drag, dividing the mouse delta by scale', () => {
    mouse('down', 100, 100, { button: 2 });
    expect(controller.panMouseDown).toEqual({ x: 100, y: 100 });
    expect(owner.setCanvasCursor).toHaveBeenCalledWith('grabbing');

    mouse('move', 90, 110, { button: 2 });
    // scale is 2 → pan delta is mouse delta / 2
    expect(owner.moveRoots).toHaveBeenCalledWith(-5, 5);
    expect(controller.panMouseDown).toEqual({ x: 90, y: 110 });

    mouse('up', 90, 110, { button: 2 });
    expect(controller.panMouseDown).toBeUndefined();
    expect(owner.setCanvasCursor).toHaveBeenCalledWith('inherit');
  });

  it('pans with space + left mouse', () => {
    mouse('down', 10, 10, { button: 0, spaceKey: true });
    expect(controller.panMouseDown).toBeTruthy();
  });

  it('starts a rect multiselect on left-down over empty space and routes modes by modifier', () => {
    mouse('down', 100, 100);
    expect(controller.multiselectMouseDown).toEqual({ x: 50, y: 50 });
    expect(owner.clearSelection).toHaveBeenCalled();

    mouse('move', 200, 200);
    expect(owner.multiselectNodes).toHaveBeenCalledWith(50, 50, 100, 100, 'select');

    mouse('move', 220, 220, { shiftKey: true });
    expect(owner.multiselectNodes).toHaveBeenCalledWith(50, 50, 110, 110, 'union');

    mouse('move', 240, 240, { ctrlKey: true });
    expect(owner.multiselectNodes).toHaveBeenCalledWith(50, 50, 120, 120, 'reduce');

    mouse('up', 240, 240);
    expect(controller.multiselectMouseDown).toBeUndefined();
    expect(controller.multiselectMouseMove).toBeUndefined();
  });

  it('does not start multiselect when read-only or a node is highlighted', () => {
    owner.readOnly = true;
    mouse('down', 100, 100);
    expect(controller.multiselectMouseDown).toBeUndefined();

    owner.readOnly = false;
    owner.highlighted = { some: 'node' };
    mouse('down', 100, 100);
    expect(controller.multiselectMouseDown).toBeUndefined();
  });

  it('detects double clicks within 500ms of the previous left press', () => {
    mouse('down', 0, 0, { type: 'mousedown' });
    expect(controller.leftButtonIsDoubleClicked).toBe(false);

    mouse('down', 0, 0, { type: 'mousedown' });
    expect(controller.leftButtonIsDoubleClicked).toBe(true);
  });

  it('routes ctrl/meta or mouse-device wheel to zoom', () => {
    controller.handleMouseWheelEvent({
      preventDefault() {},
      ctrlKey: false,
      metaKey: false,
      deltaY: 100,
      offsetX: 10,
      offsetY: 20
    });
    expect(owner.updateZoomLevel).toHaveBeenCalledWith(10, 20, -100 / 100);
  });

  it('routes trackpad wheel (non-zoom) to panning', () => {
    owner.mouseWheelDetector = { changeMode: () => 'trackpad' };
    controller.handleMouseWheelEvent({
      preventDefault() {},
      ctrlKey: false,
      metaKey: false,
      deltaX: 10,
      deltaY: 30
    });
    // scale 2 → deltas divided by scale, negated
    expect(owner.moveRoots).toHaveBeenCalledWith(-5, -15);
    expect(owner.updateZoomLevel).not.toHaveBeenCalled();
  });

  it('startDraggingNodes snapshots the drag origin and opens an undo group', () => {
    controller.latestMousePos = { x: 5, y: 7 };
    controller.startDraggingNodes([]);
    expect(controller.draggingNodes).toEqual([]);
    expect(controller.startDraggingMousePos).toEqual({ x: 5, y: 7 });
    expect(owner.setDOMLayerVisible).toHaveBeenCalledWith(false);
    expect(controller.dragNodesUndoGroup).toBeDefined();
  });

  it('startDragging* respect read-only mode', () => {
    owner.readOnly = true;
    controller.startDraggingNode({} as TSFixme);
    expect(controller.draggingNodes).toBeNull();
    expect(controller.startDraggingConnection({})).toBe(false);
    expect(controller.draggingConnection).toBeUndefined();
  });
});
