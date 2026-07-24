import { NodeSelector } from '../../src/editor/src/views/nodegrapheditor/canvas/NodeSelector';

/** Stub node views: NodeSelector only touches the `selected` flag. */
function stubNode(id: string) {
  return { id, selected: false } as TSFixme;
}

describe('NodeSelector', () => {
  it('starts inactive and empty', () => {
    const selector = new NodeSelector();
    expect(selector.active).toBe(false);
    expect(selector.nodes.length).toBe(0);
  });

  it('select replaces the selection and reports membership', () => {
    const selector = new NodeSelector();
    const a = stubNode('a');
    const b = stubNode('b');
    const c = stubNode('c');

    selector.select([a, b]);
    expect(selector.active).toBe(true);
    expect(selector.isActive(a)).toBe(true);
    expect(selector.isActive(c)).toBe(false);

    selector.select([c]);
    expect(selector.nodes.length).toBe(1);
    expect(selector.isActive(a)).toBe(false);
    expect(selector.isActive(c)).toBe(true);
  });

  it('unselect clears the selected highlight only for a single-node selection', () => {
    const selector = new NodeSelector();
    const a = stubNode('a');
    a.selected = true;

    selector.select([a]);
    selector.unselect();
    expect(a.selected).toBe(false);
    expect(selector.active).toBe(false);

    // Multi-selection: nodes never got the `selected` flag from the selector,
    // and unselect leaves whatever flags they carry untouched.
    const b = stubNode('b');
    const c = stubNode('c');
    b.selected = true;
    c.selected = true;
    selector.select([b, c]);
    selector.unselect();
    expect(b.selected).toBe(true);
    expect(c.selected).toBe(true);
    expect(selector.active).toBe(false);
  });

  it('unselectNode removes only that node and clears its highlight', () => {
    const selector = new NodeSelector();
    const a = stubNode('a');
    const b = stubNode('b');
    a.selected = true;

    selector.select([a, b]);
    selector.unselectNode(a);

    expect(a.selected).toBe(false);
    expect(selector.isActive(a)).toBe(false);
    expect(selector.isActive(b)).toBe(true);

    // Unselecting a node that is not in the selection is a no-op
    selector.unselectNode(a);
    expect(selector.nodes.length).toBe(1);
  });
});
