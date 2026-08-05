import { NodeGraphModel } from '../../src/editor/src/models/nodegraphmodel';
import { EditorSettings } from '../../src/editor/src/utils/editorsettings';
import { WireLabel } from '../../src/editor/src/views/nodegrapheditor/canvas/CanvasTheme';
import { InteractionController } from '../../src/editor/src/views/nodegrapheditor/canvas/InteractionController';
import {
  ALWAYS_SHOW_WIRE_LABELS,
  NodeGraphEditorConnection
} from '../../src/editor/src/views/nodegrapheditor/NodeGraphEditorConnection';
import PopupLayer from '../../src/editor/src/views/popuplayer';

import type { IVector2 } from '../../src/editor/src/views/nodegrapheditor/canvas/types';
import type { NodeGraphEditor } from '../../src/editor/src/views/nodegrapheditor';

/**
 * CAN-001 — the label gate, its placement, and the setter both it and CAN-002
 * write through.
 */

type ConnectionOptions = {
  label?: string;
  labelT?: number;
  connectionLabel?: boolean;
  highlighted?: boolean;
};

/**
 * A connection view without an editor behind it. `createFromModel` needs a live
 * canvas and a graph; the gate needs four fields.
 */
function stubConnection(options: ConnectionOptions = {}) {
  const connection: NodeGraphEditorConnection = Object.create(NodeGraphEditorConnection.prototype);

  connection.model = {
    fromId: 'a',
    fromProperty: 'result',
    toId: 'b',
    toProperty: 'value',
    annotation: undefined,
    label: options.label,
    labelT: options.labelT
  };
  connection.fromProperty = 'result';
  connection.fromPort = {
    name: 'result',
    displayName: 'Result',
    type: options.connectionLabel ? { name: 'signal', connectionLabel: true } : { name: 'string' }
  };
  connection.isHighlighted = () => !!options.highlighted;

  return connection;
}

describe('CAN-001 wire label gate', () => {
  beforeEach(() => {
    spyOn(EditorSettings.instance, 'get').and.callFake((key: string) =>
      key === ALWAYS_SHOW_WIRE_LABELS ? false : undefined
    );
  });

  it('hides the label on an ordinary wire that is not hovered', () => {
    expect(stubConnection().shouldShowPortLabel()).toBe(false);
  });

  it('shows it when the wire is highlighted — which includes either end`s node being hovered', () => {
    expect(stubConnection({ highlighted: true }).shouldShowPortLabel()).toBe(true);
  });

  it('still always shows it for a port type that asks for one (WFA-004 unchanged)', () => {
    expect(stubConnection({ connectionLabel: true }).shouldShowPortLabel()).toBe(true);
  });

  it('always shows an author-written label, hover or not, setting or not', () => {
    expect(stubConnection({ label: 'the retry path' }).shouldShowPortLabel()).toBe(true);
  });

  it('shows every label when the always-on setting is on', () => {
    (EditorSettings.instance.get as jasmine.Spy).and.returnValue(true);
    expect(stubConnection().shouldShowPortLabel()).toBe(true);
  });

  it('prefers the author`s text over the port name', () => {
    expect(stubConnection({ label: 'only after validation' }).labelText()).toBe('only after validation');
    expect(stubConnection().labelText()).toBe('Result');
  });

  it('defaults the position to the middle and clamps it clear of the cards', () => {
    expect(stubConnection().labelT()).toBe(WireLabel.defaultT);
    expect(stubConnection({ labelT: 0 }).labelT()).toBe(WireLabel.minT);
    expect(stubConnection({ labelT: 1 }).labelT()).toBe(WireLabel.maxT);
    expect(stubConnection({ labelT: 0.3 }).labelT()).toBe(0.3);
  });
});

describe('CAN-001 NodeGraphModel.updateConnection', () => {
  let model: NodeGraphModel;
  let connection: TSFixme;

  beforeEach(() => {
    model = new NodeGraphModel();
    connection = { fromId: 'a', fromProperty: 'out', toId: 'b', toProperty: 'in', annotation: undefined };
    model.addConnection(connection);
  });

  it('applies the change and announces it', () => {
    let announced = 0;
    model.on('connectionUpdated', () => announced++, {});

    model.updateConnection(connection, { labelT: 0.7 });

    expect(connection.labelT).toBe(0.7);
    expect(announced).toBe(1);
  });

  it('removes the key rather than storing undefined, so untouched wires stay clean', () => {
    model.updateConnection(connection, { label: 'why' });
    expect('label' in connection).toBe(true);

    model.updateConnection(connection, { label: undefined });
    expect('label' in connection).toBe(false);
    expect(JSON.stringify(connection).indexOf('label')).toBe(-1);
  });

  it('pushes an undo pair that restores the previous value — including its absence', () => {
    const undo = { pushed: [] as TSFixme[], push(action: TSFixme) { this.pushed.push(action); } };

    model.updateConnection(connection, { labelT: 0.8 }, { undo, label: 'move wire label' });
    expect(connection.labelT).toBe(0.8);
    expect(undo.pushed.length).toBe(1);

    undo.pushed[0].undo();
    expect('labelT' in connection).toBe(false);

    undo.pushed[0].do();
    expect(connection.labelT).toBe(0.8);
  });
});

/* ---------------------------------------------------------------------------
 * FH-016 — grabbing the chip
 *
 * CAN-001 built the drag and then gated it on the wire-stroke hover, which is
 * the exact ordering its own spec warned about. These pin the ordering: the
 * chip is hit-tested before, and independently of, the ±5-unit stroke band.
 *
 * The chip below is 80×40 graph units centred on (120, 40) and the wire runs
 * through that centre at 45°, so the chip's corners are ~14 units off the
 * stroke — the "wide chip on a sloped wire" the report could not grab.
 * ------------------------------------------------------------------------- */

const CHIP = { x: 80, y: 20, width: 80, height: 40 };
const CHIP_CENTRE: IVector2 = { x: 120, y: 40 };
/** Inside the chip, nowhere near the stroke. */
const CHIP_CORNER: IVector2 = { x: 85, y: 25 };
/** On the stroke, well past the end of the chip. */
const BARE_STROKE: IVector2 = { x: 300, y: 220 };

/** Distance from a 45° line through the chip's centre, as `isPointInStroke` would measure it. */
function onSlopedStroke(pos: IVector2) {
  return Math.abs(pos.y - CHIP_CENTRE.y - (pos.x - CHIP_CENTRE.x)) * Math.SQRT1_2 <= 5;
}

interface WireOwnerStub {
  readOnly: boolean;
  highlightedConnection: NodeGraphEditorConnection | undefined;
  repaint: jasmine.Spy;
  setHighlightedConnection: jasmine.Spy;
  selectConnection: jasmine.Spy;
  wireLabelEditor: { open: jasmine.Spy };
  interaction: {
    leftButtonIsDoubleClicked: boolean;
    startDraggingWireLabel: jasmine.Spy;
    startReroutingConnection: jasmine.Spy;
  };
}

function stubWireOwner(): WireOwnerStub {
  const owner: WireOwnerStub = {
    readOnly: false,
    highlightedConnection: undefined,
    repaint: jasmine.createSpy('repaint'),
    setHighlightedConnection: jasmine.createSpy('setHighlightedConnection'),
    selectConnection: jasmine.createSpy('selectConnection'),
    wireLabelEditor: { open: jasmine.createSpy('open') },
    interaction: {
      leftButtonIsDoubleClicked: false,
      startDraggingWireLabel: jasmine.createSpy('startDraggingWireLabel'),
      startReroutingConnection: jasmine.createSpy('startReroutingConnection')
    }
  };

  // The real one writes the field; the hover path's else-branch reads it back.
  owner.setHighlightedConnection.and.callFake((c: NodeGraphEditorConnection) => {
    owner.highlightedConnection = c;
  });

  return owner;
}

/** A painted wire with a chip, a sloped stroke, and no editor behind it. */
function stubPaintedWire(options: { label?: string; painted?: boolean } = {}) {
  const connection = stubConnection({ label: options.label ?? 'the retry path' });
  const owner = stubWireOwner();

  connection.owner = owner as unknown as NodeGraphEditor;
  // Only its presence is checked — the hover path refuses to run without one.
  connection.ctx = {} as CanvasRenderingContext2D;
  connection.labelBounds = options.painted === false ? undefined : { ...CHIP };
  connection.hitTest = (pos: IVector2) => onSlopedStroke(pos);
  connection.endpointAt = () => undefined;
  connection.getHealth = () => ({ healthy: true, message: undefined });

  return { connection, owner };
}

function leftMouse(extra?: Record<string, unknown>) {
  return Object.assign({ button: 0, pageX: 0, pageY: 0, consumed: false }, extra || {});
}

describe('FH-016 grabbing a wire label', () => {
  let popupLayerBefore: PopupLayer;

  beforeEach(() => {
    popupLayerBefore = PopupLayer.instance;
    // The wire only ever asks the popup layer these three questions; standing
    // up a real one needs the editor's DOM.
    PopupLayer.instance = {
      showTooltip: () => undefined,
      hideTooltip() {},
      isDragging: () => false
    } as TSFixme;
  });

  afterEach(() => {
    PopupLayer.instance = popupLayerBefore;
  });

  it('highlights the wire from a point on the chip that is nowhere near the stroke', () => {
    const { connection, owner } = stubPaintedWire();
    // The premise of the whole fix: this point is on the chip and off the wire.
    expect(connection.isPointInLabel(CHIP_CORNER)).toBe(true);
    expect(connection.hitTest(CHIP_CORNER)).toBe(false);

    connection.mouse('move', CHIP_CORNER, leftMouse());

    expect(owner.setHighlightedConnection).toHaveBeenCalledWith(connection, CHIP_CORNER);
  });

  it('does not clear the highlight when the pointer steps off the stroke onto the chip', () => {
    const { connection, owner } = stubPaintedWire();

    connection.mouse('move', CHIP_CENTRE, leftMouse());
    expect(owner.highlightedConnection).toBe(connection);

    // Before FH-016 this cleared the highlight, and the chip vanished under
    // the cursor mid-reach.
    connection.mouse('move', CHIP_CORNER, leftMouse());
    expect(owner.highlightedConnection).toBe(connection);
  });

  it('still lets go when the pointer leaves both the chip and the stroke', () => {
    const { connection, owner } = stubPaintedWire();

    connection.mouse('move', CHIP_CENTRE, leftMouse());
    connection.mouse('move', { x: 400, y: 20 }, leftMouse());

    expect(owner.setHighlightedConnection).toHaveBeenCalledWith(undefined);
    expect(owner.highlightedConnection).toBeUndefined();
  });

  it('starts the drag from the far corner of the chip', () => {
    const { connection, owner } = stubPaintedWire();
    owner.highlightedConnection = connection;

    connection.mouse('down', CHIP_CORNER, leftMouse());

    expect(owner.interaction.startDraggingWireLabel).toHaveBeenCalledWith(connection);
  });

  it('starts the drag from a chip lit by node selection, which never sets highlightedConnection', () => {
    const { connection, owner } = stubPaintedWire();
    // A selection-lit chip: painted, but the stroke hover never happened.
    owner.highlightedConnection = undefined;

    const evt = leftMouse();
    connection.mouse('down', CHIP_CORNER, evt);

    expect(owner.interaction.startDraggingWireLabel).toHaveBeenCalledWith(connection);
    expect(evt.consumed).toBe(true);
  });

  it('opens the label editor on a double-click on a selection-lit chip', () => {
    const { connection, owner } = stubPaintedWire();
    owner.interaction.leftButtonIsDoubleClicked = true;

    connection.mouse('down', CHIP_CENTRE, leftMouse());

    expect(owner.wireLabelEditor.open).toHaveBeenCalledWith(connection);
    expect(owner.interaction.startDraggingWireLabel).not.toHaveBeenCalled();
  });

  it('ignores a press on empty canvas, and on the stroke of a wire it is not hovering', () => {
    const { connection, owner } = stubPaintedWire();
    owner.highlightedConnection = undefined;

    const away = leftMouse();
    connection.mouse('down', { x: 500, y: 500 }, away);
    expect(away.consumed).toBe(false);

    // On the stroke but not hovered — the pre-existing gate, unchanged.
    const stroke = leftMouse();
    connection.mouse('down', BARE_STROKE, stroke);
    expect(stroke.consumed).toBe(false);
    expect(owner.interaction.startDraggingWireLabel).not.toHaveBeenCalled();
  });

  it('grabs nothing when no chip was painted this frame', () => {
    const { connection, owner } = stubPaintedWire({ painted: false });

    connection.mouse('move', CHIP_CORNER, leftMouse());
    expect(owner.setHighlightedConnection).not.toHaveBeenCalledWith(connection, CHIP_CORNER);

    connection.mouse('down', CHIP_CORNER, leftMouse());
    expect(owner.interaction.startDraggingWireLabel).not.toHaveBeenCalled();
  });

  it('refuses in read-only mode, on a chip it would otherwise grab', () => {
    const { connection, owner } = stubPaintedWire();
    owner.readOnly = true;

    connection.mouse('down', CHIP_CORNER, leftMouse());

    expect(owner.interaction.startDraggingWireLabel).not.toHaveBeenCalled();
  });
});

/* ---------------------------------------------------------------------------
 * FH-016 — the drag itself, and the cursor that says it is one.
 * ------------------------------------------------------------------------- */

interface DragOwnerStub {
  readOnly: boolean;
  model: { updateConnection: jasmine.Spy };
  connections: unknown[];
  roots: unknown[];
  repaint: jasmine.Spy;
  relayout: jasmine.Spy;
  setCanvasCursor: jasmine.Spy;
  hideInspectors: jasmine.Spy;
  hideNodeToolbar: jasmine.Spy;
  setDOMLayerVisible: jasmine.Spy;
  updateNodeToolbar: jasmine.Spy;
  getPanAndScale(): { scale: number; x: number; y: number };
  relativeCoordsToNodeGraphCords(pos: IVector2): IVector2;
  mouseWheelDetector: { changeMode(): 'mouse' };
}

function stubDragOwner(): DragOwnerStub {
  return {
    readOnly: false,
    model: { updateConnection: jasmine.createSpy('updateConnection') },
    connections: [],
    roots: [],
    repaint: jasmine.createSpy('repaint'),
    relayout: jasmine.createSpy('relayout'),
    setCanvasCursor: jasmine.createSpy('setCanvasCursor'),
    hideInspectors: jasmine.createSpy('hideInspectors'),
    hideNodeToolbar: jasmine.createSpy('hideNodeToolbar'),
    setDOMLayerVisible: jasmine.createSpy('setDOMLayerVisible'),
    updateNodeToolbar: jasmine.createSpy('updateNodeToolbar'),
    getPanAndScale: () => ({ scale: 1, x: 0, y: 0 }),
    relativeCoordsToNodeGraphCords: (pos: IVector2) => pos,
    mouseWheelDetector: { changeMode: () => 'mouse' }
  };
}

describe('FH-016 sliding the chip along the wire', () => {
  let owner: DragOwnerStub;
  let controller: InteractionController;
  let popupLayerBefore: PopupLayer;
  /** Whatever `findClosestPointOnCurve` should answer for the next move. */
  let closestT: number;
  let connection: TSFixme;

  beforeEach(() => {
    popupLayerBefore = PopupLayer.instance;
    PopupLayer.instance = { isDragging: () => false, hidePopup() {}, hideTooltip() {} } as TSFixme;

    owner = stubDragOwner();
    controller = new InteractionController(owner as unknown as NodeGraphEditor);

    closestT = 0.5;
    connection = {
      model: { fromId: 'a', fromProperty: 'out', toId: 'b', toProperty: 'in', labelT: 0.5 },
      labelBounds: { ...CHIP },
      isPointInLabel(pos: IVector2) {
        const b = this.labelBounds;
        return !!b && pos.x >= b.x && pos.x <= b.x + b.width && pos.y >= b.y && pos.y <= b.y + b.height;
      },
      findClosestPointOnCurve: () => closestT,
      mouse: () => undefined
    };
    owner.connections.push(connection);
  });

  afterEach(() => {
    PopupLayer.instance = popupLayerBefore;
  });

  function drag(type: 'move' | 'up', t: number) {
    closestT = t;
    const evt = leftMouse();
    controller.doDragging(type, CHIP_CENTRE, evt);
    return evt;
  }

  it('shows grab over a chip and nothing over bare canvas', () => {
    controller.mouse('move', CHIP_CENTRE, leftMouse());
    expect(owner.setCanvasCursor).toHaveBeenCalledWith('grab');

    owner.setCanvasCursor.calls.reset();
    controller.mouse('move', { x: 500, y: 500 }, leftMouse());
    expect(owner.setCanvasCursor).toHaveBeenCalledWith('inherit');
  });

  it('does not rewrite the cursor while the pointer stays on the chip', () => {
    controller.mouse('move', CHIP_CENTRE, leftMouse());
    owner.setCanvasCursor.calls.reset();
    controller.mouse('move', { x: 121, y: 41 }, leftMouse());
    expect(owner.setCanvasCursor).not.toHaveBeenCalled();
  });

  it('shows grabbing for the length of the drag, and grab again on release', () => {
    controller.startDraggingWireLabel(connection);
    expect(owner.setCanvasCursor).toHaveBeenCalledWith('grabbing');

    owner.setCanvasCursor.calls.reset();
    drag('move', 0.4);
    expect(owner.setCanvasCursor).not.toHaveBeenCalled();

    drag('up', 0.4);
    expect(owner.setCanvasCursor).toHaveBeenCalledWith('grab');
  });

  it('follows the pointer along the curve, clamped clear of both cards', () => {
    controller.startDraggingWireLabel(connection);

    drag('move', 0.72);
    expect(connection.model.labelT).toBe(0.72);

    drag('move', -3);
    expect(connection.model.labelT).toBe(WireLabel.minT);

    drag('move', 4);
    expect(connection.model.labelT).toBe(WireLabel.maxT);
  });

  it('commits the whole drag as one undo entry, from where it started', () => {
    controller.startDraggingWireLabel(connection);

    drag('move', 0.4);
    drag('move', 0.3);
    drag('move', 0.25);
    expect(owner.model.updateConnection).not.toHaveBeenCalled();

    const up = drag('up', 0.25);

    expect(owner.model.updateConnection.calls.count()).toBe(1);
    const [model, change, options] = owner.model.updateConnection.calls.mostRecent().args;
    expect(model).toBe(connection.model);
    expect(change).toEqual({ labelT: 0.25 });
    expect(options).toEqual({ undo: true, label: 'move wire label' });
    // Rewound first, so the setter's undo pair restores the pre-drag value and
    // not the last intermediate frame.
    expect(model.labelT).toBe(0.5);
    expect(controller.draggingWireLabel).toBeUndefined();
    expect(up.consumed).toBe(true);
  });

  it('pushes nothing when the drag ends where it started', () => {
    controller.startDraggingWireLabel(connection);

    drag('move', 0.3);
    drag('move', 0.5);
    drag('up', 0.5);

    expect(owner.model.updateConnection).not.toHaveBeenCalled();
  });

  it('is refused in read-only mode', () => {
    owner.readOnly = true;
    expect(controller.startDraggingWireLabel(connection)).toBe(false);
    expect(controller.draggingWireLabel).toBeUndefined();
    expect(owner.setCanvasCursor).not.toHaveBeenCalled();
  });
});
