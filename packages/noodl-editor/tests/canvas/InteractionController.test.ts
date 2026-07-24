import { InteractionController } from '../../src/editor/src/views/nodegrapheditor/canvas/InteractionController';
import PopupLayer from '../../src/editor/src/views/popuplayer';

import type { NodeGraphModel } from '../../src/editor/src/models/nodegraphmodel';
import type { NodeGraphEditorNode } from '../../src/editor/src/views/nodegrapheditor/NodeGraphEditorNode';
import type { IVector2, MouseEventType, PanAndScale } from '../../src/editor/src/views/nodegrapheditor/canvas/types';
import type { NodeGraphEditor } from '../../src/editor/src/views/nodegrapheditor';

/**
 * Unit tests with a stubbed owner. Full-stack behaviour (against a real
 * NodeGraphEditor) is covered by tests/nodegraph/canvas-characterisation.spec.js;
 * these pin the controller's state machines in isolation.
 */

/**
 * Fails to compile — naming the offending member — if `T` declares anything the
 * editor does not have. The stub cannot be a `Partial<NodeGraphEditor>`: it
 * supplies jasmine spies where the editor has methods, and a partial of the real
 * class would demand the real signatures. This keeps the member *names* honest,
 * which is the check the `TSFixme` here used to cost.
 */
type MembersOf<Base, T> = keyof T extends keyof Base
  ? T
  : ['not a member of the editor:', Exclude<keyof T, keyof Base>];

/** The slice of `NodeGraphEditor` that `InteractionController` reaches through `owner`. */
interface StubOwnerShape {
  readOnly: boolean;
  model: NodeGraphModel | undefined;
  roots: NodeGraphEditorNode[];
  connections: unknown[];
  highlighted: NodeGraphEditorNode | undefined;
  highlightedConnection: unknown;
  selector: {
    nodes: NodeGraphEditorNode[];
    active: boolean;
    select: jasmine.Spy;
    unselect: jasmine.Spy;
    isActive(): boolean;
  };
  commentLayer: {
    clearSelection: jasmine.Spy;
    clearMultiselection: jasmine.Spy;
    moveSelectedComments: jasmine.Spy;
    commitSelectedComments: jasmine.Spy;
    getSelectedComments(): unknown[];
  };
  mouseWheelDetector: { changeMode(): 'mouse' | 'trackpad' };
  getPanAndScale(): PanAndScale;
  relativeCoordsToNodeGraphCords(pos: IVector2): IVector2;
  hideInspectors: jasmine.Spy;
  hideNodeToolbar: jasmine.Spy;
  setDOMLayerVisible: jasmine.Spy;
  updateNodeToolbar: jasmine.Spy;
  clearSelection: jasmine.Spy;
  multiselectNodes: jasmine.Spy;
  moveRoots: jasmine.Spy;
  setCanvasCursor: jasmine.Spy;
  updateZoomLevel: jasmine.Spy;
  openRightClickMenu: jasmine.Spy;
  relayout: jasmine.Spy;
  repaint: jasmine.Spy;
}

type StubOwner = MembersOf<NodeGraphEditor, StubOwnerShape>;

/**
 * The fields of the canvas mouse event these specs vary. `spaceKey` is the
 * editor's own addition, not a DOM one. `InteractionController.mouse` still takes
 * `TSFixme` for this argument — that marker belongs to the source, and to PLAT-002.
 */
interface MouseEventStub {
  button?: number;
  type?: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  spaceKey?: boolean;
}

/** The wheel-event fields the controller reads in `handleMouseWheelEvent`. */
interface WheelEventStub {
  preventDefault(): void;
  ctrlKey: boolean;
  metaKey: boolean;
  deltaX?: number;
  deltaY: number;
  offsetX?: number;
  offsetY?: number;
}

function stubOwner(): StubOwner {
  return {
    readOnly: false,
    model: {} as NodeGraphModel,
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
    relativeCoordsToNodeGraphCords: (pos: IVector2) => ({ x: pos.x / 2, y: pos.y / 2 }),
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
}

describe('InteractionController', () => {
  let owner: StubOwner;
  let controller: InteractionController;
  let popupLayerBefore: PopupLayer;

  beforeEach(() => {
    popupLayerBefore = PopupLayer.instance;
    const popupStub: Pick<PopupLayer, 'isDragging' | 'hidePopup' | 'hideTooltip'> = {
      isDragging: () => false,
      hidePopup() {},
      hideTooltip() {}
    };
    // The controller only asks the popup layer these three questions; standing up
    // a real one needs the editor's DOM.
    PopupLayer.instance = popupStub as PopupLayer;

    owner = stubOwner();
    // `owner` is deliberately a slice, not an editor — see StubOwnerShape.
    controller = new InteractionController(owner as unknown as NodeGraphEditor);
  });

  afterEach(() => {
    PopupLayer.instance = popupLayerBefore;
  });

  function mouse(type: MouseEventType, x: number, y: number, evt?: MouseEventStub) {
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
    owner.highlighted = {} as NodeGraphEditorNode; // only its presence is checked
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
    const wheel: WheelEventStub = {
      preventDefault() {},
      ctrlKey: false,
      metaKey: false,
      deltaY: 100,
      offsetX: 10,
      offsetY: 20
    };
    controller.handleMouseWheelEvent(wheel);
    expect(owner.updateZoomLevel).toHaveBeenCalledWith(10, 20, -100 / 100);
  });

  it('routes trackpad wheel (non-zoom) to panning', () => {
    owner.mouseWheelDetector = { changeMode: () => 'trackpad' };
    const wheel: WheelEventStub = {
      preventDefault() {},
      ctrlKey: false,
      metaKey: false,
      deltaX: 10,
      deltaY: 30
    };
    controller.handleMouseWheelEvent(wheel);
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
    controller.startDraggingNode({} as NodeGraphEditorNode); // returns before touching it
    expect(controller.draggingNodes).toBeNull();
    expect(controller.startDraggingConnection({})).toBe(false);
    expect(controller.draggingConnection).toBeUndefined();
  });
});
