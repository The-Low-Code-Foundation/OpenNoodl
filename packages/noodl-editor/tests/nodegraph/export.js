const NodeLibrary = require('@noodl-models/nodelibrary').NodeLibrary;
const Exporter = require('@noodl-utils/exporter');
const { ProjectModel } = require('@noodl-models/projectmodel');

describe('export tests', function () {
  beforeEach(() => {
    // Bundle discovery turns on `n.type instanceof ComponentModel`, and a node
    // type only resolves if the singleton NodeLibrary has been loaded —
    // `getNodeTypeWithName` refills its cache only when `types` is non-empty,
    // so with no library loaded a project's own components never resolve and
    // every dependency edge is missed. Nine other spec files install their own
    // `window.NodeLibraryData` and reload; this one installed none and
    // inherited whichever ran last, which is why its bundle assertions passed
    // or failed on the seed. Install ours.
    window.NodeLibraryData = require('../nodegraph/nodelibrary');
    NodeLibrary.instance.loadLibrary();
  });

  xit('can export ports on components', function () {
    ProjectModel.instance = ProjectModel.fromJSON(project1);
    NodeLibrary.instance.registerModule(ProjectModel.instance);

    ProjectModel.instance.setRootNode(ProjectModel.instance.findNodeWithId('Image-1'));

    const json = Exporter.exportToJSON(ProjectModel.instance);

    // Should not export types where the type has not been resolved
    expect(json.components[0].ports.length).toBe(2);
    expect(json.components[0].ports[0].name).toBe('out1');
    expect(json.components[0].ports[0].plug).toBe('output');
    expect(NodeLibrary.nameForPortType(json.components[0].ports[0].type)).toBe('string');
    expect(json.components[0].ports[1].name).toBe('out2');
    expect(json.components[0].ports[1].plug).toBe('output');
    expect(NodeLibrary.nameForPortType(json.components[0].ports[1].type)).toBe('number');

    NodeLibrary.instance.unregisterModule(ProjectModel.instance);
  });

  it('project settings are exported', function () {
    ProjectModel.instance = ProjectModel.fromJSON(project2);
    NodeLibrary.instance.registerModule(ProjectModel.instance);

    ProjectModel.instance.setRootNode(ProjectModel.instance.findNodeWithId('Group-1'));

    const json = Exporter.exportToJSON(ProjectModel.instance);
    expect(json.settings.canvasWidth).toBe(303);
    expect(json.settings.canvasHeight).toBe(404);

    NodeLibrary.instance.unregisterModule(ProjectModel.instance);
  });

  // BCN phase 34, orchestrator pass. `json.metadata` is a deep copy of the whole project
  // metadata block and only `cloudservices` was ever overridden, so `backendServices` rode
  // along verbatim — admin tokens included. The export JSON becomes `window.projectData`
  // in the deployed app, so every configured backend's admin token was readable from the
  // browser console of the shipped site. Measured in a real browser against a real deploy
  // bundle before it was fixed.
  describe('backend credentials in the export', function () {
    function exportWithBackends() {
      ProjectModel.instance = ProjectModel.fromJSON(projectWithBackends);
      NodeLibrary.instance.registerModule(ProjectModel.instance);
      ProjectModel.instance.setRootNode(ProjectModel.instance.findNodeWithId('Group-1'));
      const json = Exporter.exportToJSON(ProjectModel.instance);
      NodeLibrary.instance.unregisterModule(ProjectModel.instance);
      return json;
    }

    it('strips adminToken — types.ts declares it editor-only and the runtime never reads it', function () {
      const json = exportWithBackends();
      const backend = json.metadata.backendServices.backends[0];

      expect(backend.auth.adminToken).toBeUndefined();
      // The whole serialised export, because a token that survives anywhere in it is
      // published — asserting only on the field would miss a second copy.
      expect(JSON.stringify(json)).not.toContain('ADMIN-TOKEN-MUST-NOT-SHIP');
    });

    it('keeps publicToken and basic-auth credentials — a deployed app needs them', function () {
      const backend = exportWithBackends().metadata.backendServices.backends[0];

      // `handleFor` hands this to every adapter as `handle.publicToken`. Stripping it
      // would break the deployed app rather than protect it.
      expect(backend.auth.publicToken).toBe('public-token-must-ship');
      expect(backend.auth.username).toBe('basic-user');
      expect(backend.auth.password).toBe('basic-pass');
    });

    it('leaves the project model itself untouched — the export copies, it does not mutate', function () {
      exportWithBackends();

      expect(ProjectModel.instance.metadata.backendServices.backends[0].auth.adminToken).toBe(
        'ADMIN-TOKEN-MUST-NOT-SHIP'
      );
    });

    it('carries the converged selection, which is what a deployed app resolves from', function () {
      const backendServices = exportWithBackends().metadata.backendServices;

      expect(backendServices.version).toBe(2);
      expect(backendServices.activeBackendId).toBe('backend_test');
    });
  });

  function matchBundle(bundle, componentIndex) {
    function arrayHasSameElements(a, b) {
      //check if equal but ignore order
      if (a.length !== b.length) return false;
      return a.every((e) => b.includes(e));
    }

    return Object.values(componentIndex).some((b) => arrayHasSameElements(bundle, b));
  }

  // DEBT-005: bundle names (b0, b1, ...) come from a counter whose start value
  // depends on how many exports ran before this spec, so asserting them made
  // these specs order-dependent. Normalize the index into an order-independent
  // shape: each bundle keyed by its sorted component list, dependencies
  // expressed as those keys.
  function normalizeComponentIndex(componentIndex) {
    const keyOf = (bundleName) => componentIndex[bundleName].components.slice().sort().join(',');
    const out = {};
    for (const name of Object.keys(componentIndex)) {
      out[keyOf(name)] = componentIndex[name].dependencies.map(keyOf).sort();
    }
    return out;
  }

  it('can export an index that includes pages and for each nodes', function () {
    ProjectModel.instance = ProjectModel.fromJSON({
      components: [
        {
          name: '/root',
          graph: {
            roots: [
              {
                id: 'nav-stack',
                type: 'Page Stack',
                parameters: {
                  pages: [
                    {
                      id: 'p1',
                      label: 'Page1'
                    },
                    {
                      id: 'p2',
                      label: 'Page2'
                    }
                  ],
                  'pageComp-p1': '/page1',
                  'pageComp-p2': '/page2'
                }
              },
              {
                id: 'n0',
                type: '/shared-comp'
              }
            ]
          }
        },
        {
          name: '/page1',
          graph: {
            roots: [
              {
                id: 'n0',
                type: '/shared-comp'
              }
            ]
          }
        },
        {
          name: '/page2',
          graph: {}
        },
        {
          name: '/shared-comp',
          graph: {}
        },
        {
          name: '/remaining-comp',
          graph: {}
        }
      ]
    });

    // DEBT-005: resolve node types synchronously — bundle dependency discovery
    // checks `n.type instanceof ComponentModel`, and lazy resolution against the
    // singleton NodeLibrary made bundle grouping depend on spec order.
    ProjectModel.instance.getComponents().forEach((c) => c.graph.updateTypes());

    ProjectModel.instance.setRootNode(ProjectModel.instance.findNodeWithId('nav-stack'));

    const json = Exporter.exportToJSON(ProjectModel.instance);

    //make sure the root components are present directly in the export, not in a bundle
    expect(json.components.find((c) => c.name === '/root'));
    expect(json.components.find((c) => c.name === '/shared-comp'));

    expect(normalizeComponentIndex(json.componentIndex)).toEqual({
      '/page1': [],
      '/page2': [],
      '/remaining-comp': []
    });
  });

  it('can follow For Each nodes when collecting dependencies', function () {
    ProjectModel.instance = ProjectModel.fromJSON({
      components: [
        {
          name: '/root',
          graph: {
            roots: [
              {
                id: 'node1',
                type: 'For Each',
                parameters: {
                  template: '/for-each-comp'
                }
              }
            ]
          }
        },
        {
          name: '/for-each-comp',
          graph: {}
        }
      ]
    });

    // DEBT-005: resolve node types synchronously — bundle dependency discovery
    // checks `n.type instanceof ComponentModel`, and lazy resolution against the
    // singleton NodeLibrary made bundle grouping depend on spec order.
    ProjectModel.instance.getComponents().forEach((c) => c.graph.updateTypes());

    const allComponents = ProjectModel.instance.getComponents();
    const rootComponent = allComponents.find((c) => c.name === '/root');

    const graph = Exporter._collectDependencyGraph(rootComponent, allComponents);
    const deps = Exporter._flattenDependencyGraph(graph);

    expect(deps.length).toBe(2);
    expect(deps.find((c) => c.name === '/root'));
    expect(deps.find((c) => c.name === '/for-each-comp'));
  });

  it("creates bundles that doesn't have duplicates", function () {
    ProjectModel.instance = ProjectModel.fromJSON({
      components: [
        {
          name: '/comp1',
          graph: {
            roots: [
              {
                id: 'nav-stack',
                type: 'Page Stack',
                parameters: {
                  pages: [
                    {
                      id: 'p1',
                      label: 'Page1'
                    },
                    {
                      id: 'p2',
                      label: 'Page2'
                    }
                  ],
                  'pageComp-p1': '/page1',
                  'pageComp-p2': '/page2'
                }
              },
              {
                id: 'n0',
                type: '/shared-comp'
              }
            ]
          }
        },
        {
          name: '/page1',
          id: 'page1',
          graph: {
            roots: [
              {
                id: 'n1',
                type: '/shared-comp'
              },
              {
                id: 'n2',
                type: '/comp-used-on-both-pages'
              }
            ]
          }
        },
        {
          name: '/page2',
          id: 'page2',
          graph: {
            roots: [
              {
                id: 'n3',
                type: '/comp-used-on-both-pages'
              }
            ]
          }
        },
        {
          name: '/shared-comp',
          graph: {}
        },
        {
          name: '/comp-used-on-both-pages',
          graph: {}
        }
      ]
    });

    // DEBT-005: resolve node types synchronously — bundle dependency discovery
    // checks `n.type instanceof ComponentModel`, and lazy resolution against the
    // singleton NodeLibrary made bundle grouping depend on spec order.
    ProjectModel.instance.getComponents().forEach((c) => c.graph.updateTypes());

    ProjectModel.instance.setRootNode(ProjectModel.instance.findNodeWithId('nav-stack'));

    const json = Exporter.exportToJSON(ProjectModel.instance);

    const componentCount = {};
    for (const name in json.componentIndex) {
      for (const comp of json.componentIndex[name].components) {
        if (componentCount[comp]) componentCount[comp]++;
        else componentCount[comp] = 1;
      }
    }

    for (const name in componentCount) {
      expect(componentCount[name]).toBe(1, 'Component ' + name + ' is in multiple bundles');
    }
  });

  it('calculated dependencies for bundles', function () {
    ProjectModel.instance = ProjectModel.fromJSON({
      components: [
        {
          name: '/comp1',
          graph: {
            roots: [
              {
                id: 'nav-stack',
                type: 'Page Stack',
                parameters: {
                  pages: [
                    {
                      id: 'p1',
                      label: 'Page1'
                    },
                    {
                      id: 'p2',
                      label: 'Page2'
                    }
                  ],
                  'pageComp-p1': '/page1',
                  'pageComp-p2': '/page2'
                }
              },
              {
                id: 'n0',
                type: '/shared-comp'
              }
            ]
          }
        },
        {
          name: '/page1',
          id: 'page1',
          graph: {
            roots: [
              {
                id: 'n1',
                type: '/shared-comp'
              },
              {
                id: 'n2',
                type: '/comp-used-on-both-pages'
              }
            ]
          }
        },
        {
          name: '/page2',
          id: 'page2',
          graph: {
            roots: [
              {
                id: 'n3',
                type: '/comp-used-on-both-pages'
              }
            ]
          }
        },
        {
          name: '/shared-comp',
          graph: {}
        },
        {
          name: '/comp-used-on-both-pages',
          graph: {}
        }
      ]
    });

    // DEBT-005: resolve node types synchronously — bundle dependency discovery
    // checks `n.type instanceof ComponentModel`, and lazy resolution against the
    // singleton NodeLibrary made bundle grouping depend on spec order.
    ProjectModel.instance.getComponents().forEach((c) => c.graph.updateTypes());

    ProjectModel.instance.setRootNode(ProjectModel.instance.findNodeWithId('nav-stack'));

    const allComponents = ProjectModel.instance.getComponents();
    const rootComponent = allComponents.find((c) => c.name === '/comp1');

    const componentIndex = Exporter.getComponentIndex(rootComponent, allComponents);

    expect(normalizeComponentIndex(componentIndex)).toEqual({
      '/comp1': ['/shared-comp'],
      '/shared-comp': [],
      '/page1': ['/comp-used-on-both-pages', '/shared-comp'],
      '/comp-used-on-both-pages': [],
      '/page2': ['/comp-used-on-both-pages']
    });
  });

  xit('ignores project settings flagged to be excluded', function () {
    ProjectModel.instance = ProjectModel.fromJSON({
      components: [
        {
          name: '/comp2',
          graph: {
            roots: [
              {
                id: 'Group-1',
                type: 'group'
              }
            ]
          }
        }
      ],
      settings: {
        someSetting: 'test',
        someSetting2: 'test2',
        settingIgnoredInExport: 'test3'
      }
    });

    // DEBT-005: resolve node types synchronously — bundle dependency discovery
    // checks `n.type instanceof ComponentModel`, and lazy resolution against the
    // singleton NodeLibrary made bundle grouping depend on spec order.
    ProjectModel.instance.getComponents().forEach((c) => c.graph.updateTypes());

    NodeLibrary.instance.registerModule(ProjectModel.instance);

    ProjectModel.instance.setRootNode(ProjectModel.instance.findNodeWithId('Group-1'));

    const json = Exporter.exportToJSON(ProjectModel.instance);
    expect(json.settings.someSetting).toBe('test');
    expect(json.settings.someSetting2).toBe('test2');
    expect(json.settings.settingIgnoredInExport).toBe(undefined);
    NodeLibrary.instance.unregisterModule(ProjectModel.instance);
  });

  var project1 = {
    components: [
      {
        name: '/comp1',
        graph: {
          roots: [
            {
              id: 'Image-1',
              type: 'image',
              parameters: {
                image: 'pic1.png',
                css: '%%%mycss {background:#ff00ff;}'
              }
            },
            {
              id: 'Comp-2',
              type: '/comp2'
            },
            {
              id: 'CO-1',
              type: 'Component Outputs',
              ports: [
                {
                  name: 'out1',
                  type: '*',
                  plug: 'input'
                },
                {
                  name: 'out2',
                  type: '*',
                  plug: 'input'
                }
              ]
            }
          ],
          connections: [
            {
              fromId: 'Image-1',
              fromProperty: 'image',
              toId: 'CO-1',
              toProperty: 'out1'
            },
            {
              fromId: 'Image-1',
              fromProperty: 'screenX',
              toId: 'CO-1',
              toProperty: 'out2'
            }
          ]
        }
      },

      // Should be excluded
      {
        name: '/comp3',
        graph: {
          roots: [
            {
              id: 'Image-3',
              type: 'image'
            }
          ]
        }
      },

      {
        name: '/comp2',
        graph: {
          roots: [
            {
              id: 'Image-2',
              type: 'image'
            }
          ]
        }
      }
    ]
  };

  // A converged project (BCN-009 step 2: `version: 2`) with one external backend
  // carrying every credential shape `BackendAuthConfig` allows.
  var projectWithBackends = {
    components: [
      {
        name: '/comp2',
        graph: {
          roots: [
            {
              id: 'Group-1',
              type: 'group'
            }
          ]
        }
      }
    ],
    metadata: {
      backendServices: {
        version: 2,
        activeBackendId: 'backend_test',
        backends: [
          {
            id: 'backend_test',
            name: 'Test Directus',
            type: 'directus',
            url: 'http://example.invalid',
            auth: {
              method: 'bearer',
              adminToken: 'ADMIN-TOKEN-MUST-NOT-SHIP',
              publicToken: 'public-token-must-ship',
              username: 'basic-user',
              password: 'basic-pass'
            }
          }
        ]
      }
    }
  };

  // Second project for cross project reference
  var project2 = {
    components: [
      {
        name: '/comp2',
        graph: {
          roots: [
            {
              id: 'Group-1',
              type: 'group'
            }
          ]
        }
      }
    ],
    settings: {
      canvasWidth: 303,
      canvasHeight: 404
    }
  };
});
