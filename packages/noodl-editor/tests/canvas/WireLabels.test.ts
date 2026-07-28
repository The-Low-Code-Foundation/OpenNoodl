import { NodeGraphModel } from '../../src/editor/src/models/nodegraphmodel';
import { EditorSettings } from '../../src/editor/src/utils/editorsettings';
import { WireLabel } from '../../src/editor/src/views/nodegrapheditor/canvas/CanvasTheme';
import {
  ALWAYS_SHOW_WIRE_LABELS,
  NodeGraphEditorConnection
} from '../../src/editor/src/views/nodegrapheditor/NodeGraphEditorConnection';

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
