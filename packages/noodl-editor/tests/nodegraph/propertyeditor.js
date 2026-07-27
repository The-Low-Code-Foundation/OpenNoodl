const { PropertyEditor } = require('@noodl-views/panels/propertyeditor/propertyeditor');
const { NodeGraphNodeRename } = require('@noodl-views/panels/propertyeditor');

const { ProjectModel } = require('@noodl-models/projectmodel');
const NodeLibrary = require('@noodl-models/nodelibrary').NodeLibrary;
const { UndoQueue } = require('@noodl-models/undo-queue-model');

describe('Property editor panel unit tests', function () {
  var pe, n, c;

  beforeEach(() => {
    ProjectModel.instance = ProjectModel.fromJSON(project);
    NodeLibrary.instance.registerModule(ProjectModel.instance);

    c = ProjectModel.instance.getComponentWithName('Root');
    n = c.graph.findNodeWithId('A');
    pe = new PropertyEditor({
      model: n
    });
    pe.render();
  });

  afterEach((done) => {
    //some tests schedule renders with a setTimeout
    //so schedule one ourselves before we clean up so the console
    //isn't filled with errors
    setTimeout(() => {
      ProjectModel.instance = undefined;
      done();
    }, 1);
  });

  it('can delete node and undo', function () {
    pe.performDelete();

    expect(c.graph.findNodeWithId('A')).toBe(undefined);
    expect(c.graph.connections.length).toBe(0);

    UndoQueue.instance.undo();

    expect(c.graph.findNodeWithId('A')).not.toBe(undefined);
    expect(c.graph.connections.length).toBe(1);
  });

  it('can rename and undo', function () {
    NodeGraphNodeRename(n, 'test');

    expect(c.graph.findNodeWithId('A').label).toBe('test');

    UndoQueue.instance.undo();

    expect(c.graph.findNodeWithId('A').label).toBe('group');
  });

  // AIX-005 integration pass: object-typed inputs (a Global Store's Initial State, an SSE
  // call's Headers, a State Snapshot's Snapshot Data) had no branch in viewClassForPort, so
  // _getPorts filtered the row out entirely and the port was connection-only with nothing
  // saying why. They edit as a literal in the same code editor as array-typed ports.
  it('gives an object-typed port the same editor as an array-typed port', function () {
    const arrayView = pe.portsView.viewClassForPort({ name: 'items', type: 'array' });
    const objectView = pe.portsView.viewClassForPort({ name: 'headers', type: 'object' });

    expect(arrayView).not.toBe(undefined);
    expect(objectView).toBe(arrayView);

    // The long spelling has to resolve too, since that is how a module-provided node
    // usually declares it.
    expect(pe.portsView.viewClassForPort({ name: 'headers', type: { name: 'object' } })).toBe(arrayView);
  });

  it('still leaves a connections-only object port out of the panel', function () {
    // `allowConnectionsOnly` is how a node says "wire this, do not type it", and the new
    // branch must not override it. noodl.cloud.sendemail's Variables is the live example —
    // the only object-typed input in the product that is meant to stay unwritable.
    const view = pe.portsView;
    const original = view.model.getPorts;
    view.model.getPorts = () => [
      { name: 'headers', group: 'General', type: 'object' },
      { name: 'variables', group: 'General', type: { name: 'object', allowConnectionsOnly: true } }
    ];
    try {
      expect(view._getPorts().map((p) => p.name)).toEqual(['headers']);
    } finally {
      view.model.getPorts = original;
    }
  });

  it('can edit parameter and undo', function () {
    pe.portsView.setParameter('alpha', 0.5);

    expect(c.graph.findNodeWithId('A').parameters['alpha']).toBe(0.5);

    UndoQueue.instance.undo();

    expect(c.graph.findNodeWithId('A').parameters['alpha']).toBe(undefined);
  });

  var project = {
    components: [
      {
        name: 'Root',
        graph: {
          roots: [
            {
              id: 'A',
              type: 'group'
            },
            {
              id: 'B',
              type: 'group'
            }
          ],
          connections: [
            {
              fromId: 'A',
              toId: 'B',
              fromProperty: 'x',
              toProperty: 'y'
            }
          ]
        }
      }
    ]
  };
});
