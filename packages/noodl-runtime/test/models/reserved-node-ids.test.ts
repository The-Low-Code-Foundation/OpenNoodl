/**
 * A node whose graph **id** collides with something on `Array.prototype`.
 *
 * `ComponentModel.nodes` is declared as an array and used as an id-keyed
 * dictionary (`this.nodes[node.id] = node`). `collection.ts` installs the
 * collection vocabulary — `add`, `get`, `set`, `size`, `each`, `contains`,
 * `notify`, `getId`, `items`, `id` — directly on `Array.prototype`, most of it
 * `writable: false`. In a module (strict mode, which every source here is)
 * assigning to a non-writable inherited property **throws**, so a single node
 * called `add` took down the load of the whole component — and, through
 * `importComponentFromEditorData`, the whole bundle. What the caller then saw
 * was `Can't find component model for …`, an error naming a component that
 * had failed to import for a reason nothing reported.
 *
 * The class is much wider than `add`: every accessor on the prototype
 * (`items`, `id`) and `length` are the same bug in three different disguises,
 * and `items` is the worst of them — it has a *setter* that forwards to
 * `Collection.set`, so storing a node under that id would have run a
 * collection diff over a NodeModel rather than throwing.
 *
 * The fix is to give the dictionary no prototype at all, which is why this
 * suite asserts on the whole vocabulary rather than on `add`.
 */
import ComponentModel = require('../../src/models/componentmodel');
import NodeModel = require('../../src/models/nodemodel');

// The patches are installed as a side effect of loading the collection module,
// exactly as `noodl-runtime.ts` does at startup. Without this line the defect
// is invisible — which is why it only ever appeared in a real app.
require('../../src/collection');

/**
 * Every id that used to be unusable, and why.
 *
 *  - the collection vocabulary `collection.ts` defines `writable: false`;
 *  - its two accessors, which have no setter (`id`) or a *working* one (`items`);
 *  - `length`, which is not a patch at all but an array's own exotic property;
 *  - and the `Object.prototype` names, which assign fine but read back as
 *    inherited functions on any dictionary that has a prototype.
 */
const RESERVED_IDS = [
  // collection.ts, writable: false
  'add',
  'get',
  'set',
  'size',
  'each',
  'getId',
  'notify',
  'contains',
  'remove',
  'removeAtIndex',
  'addAtIndex',
  'on',
  'off',
  // collection.ts accessors
  'items',
  'id',
  // the array's own
  'length',
  'push',
  'pop',
  'filter',
  'map',
  // Object.prototype
  'constructor',
  'toString',
  'hasOwnProperty',
  'valueOf'
];

describe('a node id that collides with the collection vocabulary', () => {
  it('stores and reads back a node called "add"', async () => {
    const component = new ComponentModel('testComponent');
    await component.addNode(new NodeModel('add', 'testNode'));

    expect(component.getNodeWithId('add')).toBeDefined();
    expect(component.getNodeWithId('add').type).toBe('testNode');
    expect(component.hasNodeWithId('add')).toBe(true);
    expect(component.getAllNodes().length).toBe(1);
  });

  it('stores and reads back every reserved id, together, in one component', async () => {
    const component = new ComponentModel('testComponent');
    for (const id of RESERVED_IDS) {
      await component.addNode(new NodeModel(id, 'testNode'));
    }

    for (const id of RESERVED_IDS) {
      expect(component.hasNodeWithId(id)).toBe(true);
      expect(component.getNodeWithId(id).id).toBe(id);
    }
    expect(component.getAllNodes().length).toBe(RESERVED_IDS.length);
    expect(component.getNodesWithType('testNode').length).toBe(RESERVED_IDS.length);
  });

  it('answers undefined for an id it does not have, whatever the id is', () => {
    const component = new ComponentModel('testComponent');
    for (const id of RESERVED_IDS.concat(['toString', 'nope'])) {
      // Before the fix, `getNodeWithId('toString')` answered a FUNCTION —
      // truthy, so `hasNodeWithId` said yes and the caller went on to read
      // `.type` off `Function.prototype.toString`.
      expect(component.getNodeWithId(id)).toBeUndefined();
      expect(component.hasNodeWithId(id)).toBe(false);
    }
  });

  it('removes a reserved-id node the same way as any other', async () => {
    const component = new ComponentModel('testComponent');
    await component.addNode(new NodeModel('add', 'testNode'));
    await component.addNode(new NodeModel('keep', 'testNode'));

    expect(await component.removeNodeWithId('add')).toBe(true);
    expect(component.hasNodeWithId('add')).toBe(false);
    expect(component.getAllNodes().length).toBe(1);
  });

  it('imports a component whose graph carries a node called "add"', async () => {
    const component = await ComponentModel.createFromExportData({
      name: '/Test',
      nodes: [
        { id: 'add', type: 'testNode', parameters: {}, ports: [], children: [] },
        { id: 'get', type: 'testNode', parameters: {}, ports: [], children: [{ id: 'set', type: 'testNode' }] }
      ],
      connections: [{ sourceId: 'add', sourcePort: 'out', targetId: 'get', targetPort: 'in' }],
      roots: ['add']
    });

    expect(component.getAllNodes().length).toBe(3);
    expect(component.getNodeWithId('set').parent).toBe(component.getNodeWithId('get'));
    expect(component.getConnectionsFrom('add').length).toBe(1);
  });
});
