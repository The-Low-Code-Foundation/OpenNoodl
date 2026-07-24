const { ProjectModel } = require('@noodl-models/projectmodel');
const NodeLibrary = require('@noodl-models/nodelibrary').NodeLibrary;
const NodeGraphModel = require('@noodl-models/nodegraphmodel').NodeGraphModel;
const NodeGraphNode = require('@noodl-models/nodegraphmodel').NodeGraphNode;

describe('Component instances', function () {
  var c1, c2;
  var p, p2;
  var w;

  beforeEach(() => {
    window.NodeLibraryData = require('../nodegraph/nodelibrary');
    NodeLibrary.instance.loadLibrary();

    // Deep-copy: fromJSON keeps references into the fixture, so a spec that
    // renames ports would otherwise mutate `project` for every later spec
    // (the original quarantined specs depended on that leakage).
    p = ProjectModel.fromJSON(JSON.parse(JSON.stringify(project)));
    NodeLibrary.instance.registerModule(p);

    c1 = p.getComponentWithName('test');
    c2 = p.getComponentWithName('Root');
  });

  afterEach(() => {
    NodeLibrary.instance.unregisterModule(p);
  });

  it('can load project', function () {
    expect(p).not.toBe(undefined);
  });

  // Re-enabled by DEBT-004: the propagation chain was intact but
  // NodeGraphModel.bindTypeModel held a single typeModel slot, so binding any
  // later node type evicted the component's portRenamed listener. Graphs now
  // keep every distinct node type bound. In the editor, types resolve (and
  // bind) on an async schedule after module registration; the spec forces that
  // resolution synchronously so the rename has a bound instance to reach.
  it('can rename component inputs and outputs', function () {
    c2.graph.updateTypes();

    expect(c1.graph.findNodeWithId('46a72429-263c-2ad1-3ada-ce8a98b27308').renamePortWithName('p1', 'p1b')).toBe(true);
    expect(c1.graph.findNodeWithId('c01d18bc-b8cd-e792-6fd8-89694ef8da48').renamePortWithName('p3', 'p3b')).toBe(true);

    expect(c2.graph.connections[0].toProperty).toBe('p1b');
    expect(c2.graph.connections[1].fromProperty).toBe('p3b');

    expect(c2.graph.findNodeWithId('56b67ac1-224e-c3c8-b058-6fee9c590bee').parameters['p1b']).toBe(50);
    expect(c2.graph.findNodeWithId('56b67ac1-224e-c3c8-b058-6fee9c590bee').parameters['p1']).toBe(undefined);
  });

  it('can detect unhealthy connections', function () {
    // Rewritten by DEBT-004 (2026-07-25). The original spec referenced port
    // names from the rename spec's run (p3b) and expected removing an internal
    // connection to remove the derived component port — both stale: each spec
    // rebuilds the project, and component ports are declared on the Component
    // Inputs/Outputs nodes, not derived from connections. What health checking
    // does today: a connection whose endpoint port does not exist gets a
    // WarningsModel entry, which getConnectionHealth reports.
    c2.graph.updateTypes();
    c2.graph.evaluateHealth();


    expect(
      c2.graph.getConnectionHealth({
        sourceId: '56b67ac1-224e-c3c8-b058-6fee9c590bee',
        sourcePort: 'p3',
        targetId: 'c0210ab9-94ab-c4c8-313b-3b394d5361f6',
        targetPort: 'opacity'
      }).healthy
    ).toBe(true);

    // Point the instance connection at a port the component does not declare
    c2.graph.connections[1].fromProperty = 'does-not-exist';
    c2.graph.evaluateHealth();

    expect(
      c2.graph.getConnectionHealth({
        sourceId: '56b67ac1-224e-c3c8-b058-6fee9c590bee',
        sourcePort: 'does-not-exist',
        targetId: 'c0210ab9-94ab-c4c8-313b-3b394d5361f6',
        targetPort: 'opacity'
      }).healthy
    ).toBe(false);

    // Repair it and health recovers
    c2.graph.connections[1].fromProperty = 'p3';
    c2.graph.evaluateHealth();

    expect(
      c2.graph.getConnectionHealth({
        sourceId: '56b67ac1-224e-c3c8-b058-6fee9c590bee',
        sourcePort: 'p3',
        targetId: 'c0210ab9-94ab-c4c8-313b-3b394d5361f6',
        targetPort: 'opacity'
      }).healthy
    ).toBe(true);
  });

  it('can detect unhealthy nodes', function () {
    c2.graph.evaluateHealth();

    // Multiple roots with same category is OK
    var n = c2.graph.findNodeWithId('56b67ac1-224e-c3c8-b058-6fee9c590bee');
    expect(n.getHealth().healthy).toBe(true);

    c2.graph.removeNode(c2.graph.findNodeWithId('97720c17-1ff1-f4b0-8f97-8d70cf795348'));
    c2.graph.removeNode(c2.graph.findNodeWithId('c0210ab9-94ab-c4c8-313b-3b394d5361f6'));
    c2.graph.evaluateHealth();

    expect(n.getHealth().healthy).toBe(true);

    // The component cannot have visual children
    var nn = NodeGraphNode.fromJSON({
      type: 'group',
      id: 'A'
    });
    n.addChild(nn);
    c2.graph.evaluateHealth();

    expect(n.getHealth().healthy).toBe(false);

    // Adding a component children node will do it
    c1.graph.findNodeWithId('f89b4fcd-5cfe-c47e-7fab-03948aad878c').addChild(
      NodeGraphNode.fromJSON({
        type: 'Component Children',
        id: 'CC'
      })
    );
    c2.graph.evaluateHealth();

    expect(n.getHealth().healthy).toBe(true);

    // Remove the visual root of the test component, health will become false again
    c1.graph.removeNode(c1.graph.findNodeWithId('f89b4fcd-5cfe-c47e-7fab-03948aad878c'));
    c2.graph.evaluateHealth();

    expect(n.getHealth().healthy).toBe(false);
  });

  it('component renamed are propageted to component references', function () {
    var c3 = p.getComponentWithName('/has_comp_ref');
    var c4 = p.getComponentWithName('/to_be_renamed');

    var n = c3.graph.findNodeWithId('has_comp_ref_group');
    expect(n.parameters['compref']).toBe('/to_be_renamed');

    c4.rename('/is_renamed');
    expect(n.parameters['compref']).toBe('/is_renamed');
  });

  var project = {
    name: 'proj1',
    components: [
      {
        name: 'outside',
        graph: {
          roots: [
            {
              id: 'AABB',
              type: 'Component Inputs',
              parameters: {},
              children: [],
              ports: [
                {
                  name: 'p1',
                  plug: 'output',
                  type: '='
                }
              ]
            }
          ]
        }
      },
      {
        name: 'Root',
        ports: [],
        graph: {
          connections: [
            {
              fromId: '97720c17-1ff1-f4b0-8f97-8d70cf795348',
              fromProperty: 'screenX',
              toId: '56b67ac1-224e-c3c8-b058-6fee9c590bee',
              toProperty: 'p1'
            },
            {
              fromId: '56b67ac1-224e-c3c8-b058-6fee9c590bee',
              fromProperty: 'p3',
              toId: 'c0210ab9-94ab-c4c8-313b-3b394d5361f6',
              toProperty: 'opacity'
            }
          ],
          roots: [
            {
              id: '97720c17-1ff1-f4b0-8f97-8d70cf795348',
              type: 'group',
              x: 359,
              y: 74,
              parameters: {},
              children: []
            },
            {
              id: 'c0210ab9-94ab-c4c8-313b-3b394d5361f6',
              type: 'group',
              x: 457,
              y: 276,
              parameters: {},
              children: []
            },
            {
              id: '56b67ac1-224e-c3c8-b058-6fee9c590bee',
              type: 'test',
              x: 430,
              y: 181,
              parameters: {
                p1: 50
              },
              children: []
            }
          ]
        }
      },
      {
        name: 'test',
        graph: {
          connections: [
            {
              fromId: '46a72429-263c-2ad1-3ada-ce8a98b27308',
              fromProperty: 'p2',
              toId: 'f89b4fcd-5cfe-c47e-7fab-03948aad878c',
              toProperty: 'clip'
            },
            {
              fromId: '46a72429-263c-2ad1-3ada-ce8a98b27308',
              fromProperty: 'p1',
              toId: 'f89b4fcd-5cfe-c47e-7fab-03948aad878c',
              toProperty: 'scaleX'
            },
            {
              fromId: 'f89b4fcd-5cfe-c47e-7fab-03948aad878c',
              fromProperty: 'screenX',
              toId: 'c01d18bc-b8cd-e792-6fd8-89694ef8da48',
              toProperty: 'p3'
            }
          ],
          roots: [
            {
              id: '46a72429-263c-2ad1-3ada-ce8a98b27308',
              type: 'Component Inputs',
              x: 336,
              y: 115,
              parameters: {},
              children: [],
              ports: [
                {
                  name: 'p1',
                  plug: 'output',
                  type: '='
                },
                {
                  name: 'p2',
                  plug: 'output',
                  type: '='
                }
              ]
            },
            {
              id: 'f89b4fcd-5cfe-c47e-7fab-03948aad878c',
              type: 'group',
              x: 497,
              y: 211,
              parameters: {},
              children: []
            },
            {
              id: 'c01d18bc-b8cd-e792-6fd8-89694ef8da48',
              type: 'Component Outputs',
              x: 646,
              y: 283,
              parameters: {},
              children: [],
              ports: [
                {
                  name: 'p3',
                  plug: 'input',
                  type: '='
                }
              ]
            }
          ]
        }
      },

      // Test component references
      {
        name: '/has_comp_ref',
        ports: [],
        graph: {
          roots: [
            {
              id: 'has_comp_ref_group',
              type: 'group',
              parameters: {
                compref: '/to_be_renamed'
              },
              children: []
            }
          ]
        }
      },
      {
        name: '/to_be_renamed',
        graph: {}
      }
    ]
  };
});
