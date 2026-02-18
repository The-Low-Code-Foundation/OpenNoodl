/**
 * ProjectImporter Tests -- STRUCT-003
 *
 * Tests for the import engine that converts v2 multi-file format back to
 * legacy project.json, including round-trip validation with ProjectExporter.
 *
 * Uses Jasmine matchers (Electron test runner).
 */

import {
  ProjectImporter,
  unflattenNodes,
  toLegacyName,
  ImportInput
} from '../../src/editor/src/io/ProjectImporter';

import {
  ProjectExporter,
  LegacyProject,
  LegacyComponent,
  LegacyNode,
  legacyNameToPath
} from '../../src/editor/src/io/ProjectExporter';

// ---- Fixtures ----------------------------------------------------------------

const makeNode = (id: string, type = 'Group', overrides: Partial<LegacyNode> = {}): LegacyNode => ({
  id, type, x: 0, y: 0, parameters: {}, children: [], ...overrides
});

const makeComponent = (name: string, overrides: Partial<LegacyComponent> = {}): LegacyComponent => ({
  name,
  id: 'comp_' + name.replace(/[^a-z0-9]/gi, '_'),
  graph: { roots: [], connections: [] },
  ...overrides
});

const makeProject = (overrides: Partial<LegacyProject> = {}): LegacyProject => ({
  name: 'Test Project',
  version: '4',
  components: [],
  variants: [],
  ...overrides
});

/** Helper: export a project then build ImportInput from the result */
function exportToImportInput(project: LegacyProject): ImportInput {
  const exporter = new ProjectExporter();
  const result = exporter.export(project);

  const getContent = (path: string) =>
    result.files.find((f) => f.relativePath === path)?.content;

  const projectFile = getContent('nodegx.project.json') as any;
  const registryFile = getContent('components/_registry.json') as any;
  const routesFile = getContent('nodegx.routes.json') as any;
  const stylesFile = getContent('nodegx.styles.json') as any;

  const components: ImportInput['components'] = {};

  for (const comp of project.components) {
    const compPath = legacyNameToPath(comp.name);
    const componentFile = getContent(`components/${compPath}/component.json`) as any;
    const nodesFile = getContent(`components/${compPath}/nodes.json`) as any;
    const connectionsFile = getContent(`components/${compPath}/connections.json`) as any;

    if (componentFile && nodesFile && connectionsFile) {
      components[compPath] = { component: componentFile, nodes: nodesFile, connections: connectionsFile };
    }
  }

  return {
    project: projectFile,
    registry: registryFile,
    ...(routesFile ? { routes: routesFile } : {}),
    ...(stylesFile ? { styles: stylesFile } : {}),
    components
  };
}

// ---- unflattenNodes ----------------------------------------------------------

describe('unflattenNodes', () => {
  it('returns empty array for empty input', () => {
    expect(unflattenNodes([]).length).toBe(0);
  });

  it('reconstructs a single root node', () => {
    const roots = unflattenNodes([{ id: 'n1', type: 'Group' }]);
    expect(roots.length).toBe(1);
    expect(roots[0].id).toBe('n1');
    expect(roots[0].type).toBe('Group');
  });

  it('reconstructs parent-child relationship', () => {
    const flat = [
      { id: 'root', type: 'Group', children: ['child'] },
      { id: 'child', type: 'Text', parent: 'root' }
    ];
    const roots = unflattenNodes(flat);
    expect(roots.length).toBe(1);
    expect(roots[0].children!.length).toBe(1);
    expect(roots[0].children![0].id).toBe('child');
  });

  it('reconstructs deeply nested tree', () => {
    const flat = [
      { id: 'l1', type: 'Group', children: ['l2'] },
      { id: 'l2', type: 'Group', parent: 'l1', children: ['l3'] },
      { id: 'l3', type: 'Text', parent: 'l2' }
    ];
    const roots = unflattenNodes(flat);
    expect(roots.length).toBe(1);
    const l2 = roots[0].children![0];
    expect(l2.id).toBe('l2');
    const l3 = l2.children![0];
    expect(l3.id).toBe('l3');
  });

  it('preserves children order', () => {
    const flat = [
      { id: 'root', type: 'Group', children: ['c1', 'c2', 'c3'] },
      { id: 'c1', type: 'Text', parent: 'root' },
      { id: 'c2', type: 'Image', parent: 'root' },
      { id: 'c3', type: 'Button', parent: 'root' }
    ];
    const roots = unflattenNodes(flat);
    const childIds = roots[0].children!.map((c) => c.id);
    expect(childIds[0]).toBe('c1');
    expect(childIds[1]).toBe('c2');
    expect(childIds[2]).toBe('c3');
  });

  it('handles multiple root nodes', () => {
    const flat = [
      { id: 'r1', type: 'Group' },
      { id: 'r2', type: 'Group' }
    ];
    const roots = unflattenNodes(flat);
    expect(roots.length).toBe(2);
  });

  it('restores parameters', () => {
    const flat = [{ id: 'n1', type: 'Group', parameters: { layout: 'row' } }];
    const roots = unflattenNodes(flat);
    expect(roots[0].parameters).toEqual({ layout: 'row' });
  });

  it('restores stateParameters', () => {
    const flat = [{ id: 'n1', type: 'Group', stateParameters: { hover: { opacity: 0.5 } } }];
    const roots = unflattenNodes(flat);
    expect(roots[0].stateParameters).toEqual({ hover: { opacity: 0.5 } });
  });

  it('restores metadata', () => {
    const flat = [{ id: 'n1', type: 'Group', metadata: { comment: 'hello' } }];
    const roots = unflattenNodes(flat);
    expect(roots[0].metadata).toEqual({ comment: 'hello' });
  });

  it('restores variant', () => {
    const flat = [{ id: 'n1', type: 'Button', variant: 'primary' }];
    const roots = unflattenNodes(flat);
    expect(roots[0].variant).toBe('primary');
  });

  it('restores label, x, y', () => {
    const flat = [{ id: 'n1', type: 'Group', label: 'My Node', x: 100, y: 200 }];
    const roots = unflattenNodes(flat);
    expect(roots[0].label).toBe('My Node');
    expect(roots[0].x).toBe(100);
    expect(roots[0].y).toBe(200);
  });

  it('root nodes have empty children array', () => {
    const roots = unflattenNodes([{ id: 'n1', type: 'Group' }]);
    expect(roots[0].children!.length).toBe(0);
  });
});

// ---- toLegacyName ------------------------------------------------------------

describe('toLegacyName', () => {
  it('uses component.path when available (perfect round-trip)', () => {
    const comp = { id: 'c1', name: 'Header', path: '/#Header', type: 'visual' as const, modified: '' };
    expect(toLegacyName(comp, 'Header')).toBe('/#Header');
  });

  it('falls back to reconstructing from registry path', () => {
    const comp = { id: 'c1', name: 'Header', type: 'visual' as const, modified: '' };
    expect(toLegacyName(comp, 'Header')).toBe('/Header');
  });

  it('handles root component fallback', () => {
    const comp = { id: 'c1', name: 'App', type: 'root' as const, modified: '' };
    expect(toLegacyName(comp, '%rootcomponent')).toBe('/%rootcomponent');
  });

  it('handles cloud component fallback', () => {
    const comp = { id: 'c1', name: 'Send', type: 'cloud' as const, modified: '' };
    expect(toLegacyName(comp, '__cloud__/SendGrid/Send')).toBe('/#__cloud__/SendGrid/Send');
  });
});

// ---- ProjectImporter ---------------------------------------------------------

describe('ProjectImporter', () => {
  let importer: ProjectImporter;

  beforeEach(() => {
    importer = new ProjectImporter();
  });

  describe('basic import', () => {
    it('reconstructs project name', () => {
      const input = exportToImportInput(makeProject({ name: 'My App' }));
      const { project } = importer.import(input);
      expect(project.name).toBe('My App');
    });

    it('reconstructs project version', () => {
      const input = exportToImportInput(makeProject({ version: '4' }));
      const { project } = importer.import(input);
      expect(project.version).toBe('4');
    });

    it('reconstructs runtimeVersion', () => {
      const input = exportToImportInput(makeProject({ runtimeVersion: 'react19' }));
      const { project } = importer.import(input);
      expect(project.runtimeVersion).toBe('react19');
    });

    it('reconstructs settings', () => {
      const input = exportToImportInput(makeProject({ settings: { bodyScroll: true } }));
      const { project } = importer.import(input);
      expect((project.settings as any)?.bodyScroll).toBe(true);
    });

    it('returns no warnings for clean input', () => {
      const input = exportToImportInput(makeProject());
      const { warnings } = importer.import(input);
      expect(warnings.length).toBe(0);
    });

    it('reconstructs empty components array', () => {
      const input = exportToImportInput(makeProject());
      const { project } = importer.import(input);
      expect(project.components.length).toBe(0);
    });
  });

  describe('metadata reconstruction', () => {
    it('restores routes from nodegx.routes.json into metadata', () => {
      const routes = [{ path: '/home', component: 'pages/Home' }];
      const input = exportToImportInput(makeProject({ metadata: { routes } }));
      const { project } = importer.import(input);
      expect((project.metadata as any)?.routes).toEqual(routes);
    });

    it('restores styles.colors from nodegx.styles.json into metadata', () => {
      const input = exportToImportInput(makeProject({
        metadata: { styles: { colors: { primary: '#3B82F6' } } }
      }));
      const { project } = importer.import(input);
      expect((project.metadata as any)?.styles?.colors).toEqual({ primary: '#3B82F6' });
    });

    it('restores non-styles non-routes metadata keys', () => {
      const input = exportToImportInput(makeProject({
        metadata: { cloudservices: { id: 'abc' }, routes: [] }
      }));
      const { project } = importer.import(input);
      expect((project.metadata as any)?.cloudservices).toEqual({ id: 'abc' });
    });
  });

  describe('variants reconstruction', () => {
    it('restores variants from styles file', () => {
      const input = exportToImportInput(makeProject({
        variants: [{ name: 'primary', typename: 'Button', parameters: { color: 'blue' } }]
      }));
      const { project } = importer.import(input);
      expect(project.variants!.length).toBe(1);
      expect(project.variants![0].name).toBe('primary');
      expect(project.variants![0].typename).toBe('Button');
      expect(project.variants![0].parameters).toEqual({ color: 'blue' });
    });

    it('reverses stateParameters normalisation back to stateParamaters typo', () => {
      const input = exportToImportInput(makeProject({
        variants: [{ name: 'primary', typename: 'Button', stateParamaters: { hover: { opacity: 0.8 } } }]
      }));
      const { project } = importer.import(input);
      expect(project.variants![0].stateParamaters).toEqual({ hover: { opacity: 0.8 } });
    });

    it('returns empty variants when none exist', () => {
      const input = exportToImportInput(makeProject({ variants: [] }));
      const { project } = importer.import(input);
      expect((project.variants ?? []).length).toBe(0);
    });
  });

  describe('component reconstruction', () => {
    it('reconstructs component name (legacy path)', () => {
      const input = exportToImportInput(makeProject({ components: [makeComponent('/#Header')] }));
      const { project } = importer.import(input);
      expect(project.components[0].name).toBe('/#Header');
    });

    it('reconstructs component id', () => {
      const comp = makeComponent('/#Header');
      comp.id = 'comp_header_123';
      const input = exportToImportInput(makeProject({ components: [comp] }));
      const { project } = importer.import(input);
      expect(project.components[0].id).toBe('comp_header_123');
    });

    it('reconstructs empty graph', () => {
      const input = exportToImportInput(makeProject({ components: [makeComponent('/#Header')] }));
      const { project } = importer.import(input);
      expect(project.components[0].graph.roots.length).toBe(0);
      expect(project.components[0].graph.connections.length).toBe(0);
    });

    it('reconstructs connections', () => {
      const comp = makeComponent('/#Header');
      comp.graph.connections = [{ fromId: 'n1', fromProperty: 'onClick', toId: 'n2', toProperty: 'trigger' }];
      const input = exportToImportInput(makeProject({ components: [comp] }));
      const { project } = importer.import(input);
      expect(project.components[0].graph.connections.length).toBe(1);
      expect(project.components[0].graph.connections[0]).toEqual({
        fromId: 'n1', fromProperty: 'onClick', toId: 'n2', toProperty: 'trigger'
      });
    });

    it('preserves connection annotation', () => {
      const comp = makeComponent('/#Header');
      comp.graph.connections = [{ fromId: 'n1', fromProperty: 'out', toId: 'n2', toProperty: 'in', annotation: 'Created' }];
      const input = exportToImportInput(makeProject({ components: [comp] }));
      const { project } = importer.import(input);
      expect(project.components[0].graph.connections[0].annotation).toBe('Created');
    });

    it('reconstructs multiple components', () => {
      const input = exportToImportInput(makeProject({
        components: [makeComponent('/#Header'), makeComponent('/Pages/Home')]
      }));
      const { project } = importer.import(input);
      expect(project.components.length).toBe(2);
    });
  });

  describe('node tree reconstruction', () => {
    it('reconstructs flat root nodes', () => {
      const comp = makeComponent('/#Header');
      comp.graph.roots = [makeNode('n1', 'Group'), makeNode('n2', 'Text')];
      const input = exportToImportInput(makeProject({ components: [comp] }));
      const { project } = importer.import(input);
      expect(project.components[0].graph.roots.length).toBe(2);
    });

    it('reconstructs nested node tree', () => {
      const comp = makeComponent('/#Header');
      comp.graph.roots = [
        makeNode('root', 'Group', { children: [makeNode('child', 'Text')] })
      ];
      const input = exportToImportInput(makeProject({ components: [comp] }));
      const { project } = importer.import(input);
      const roots = project.components[0].graph.roots;
      expect(roots.length).toBe(1);
      expect(roots[0].children!.length).toBe(1);
      expect(roots[0].children![0].id).toBe('child');
    });

    it('reconstructs deeply nested tree', () => {
      const comp = makeComponent('/#Header');
      comp.graph.roots = [
        makeNode('l1', 'Group', {
          children: [makeNode('l2', 'Group', { children: [makeNode('l3', 'Text')] })]
        })
      ];
      const input = exportToImportInput(makeProject({ components: [comp] }));
      const { project } = importer.import(input);
      const l2 = project.components[0].graph.roots[0].children![0];
      expect(l2.id).toBe('l2');
      expect(l2.children![0].id).toBe('l3');
    });

    it('preserves node parameters through round-trip', () => {
      const comp = makeComponent('/#Header');
      comp.graph.roots = [makeNode('n1', 'Group', { parameters: { layout: 'row', gap: '12px' } })];
      const input = exportToImportInput(makeProject({ components: [comp] }));
      const { project } = importer.import(input);
      expect(project.components[0].graph.roots[0].parameters).toEqual({ layout: 'row', gap: '12px' });
    });

    it('preserves node variant through round-trip', () => {
      const comp = makeComponent('/#Header');
      comp.graph.roots = [makeNode('n1', 'Button', { variant: 'primary' })];
      const input = exportToImportInput(makeProject({ components: [comp] }));
      const { project } = importer.import(input);
      expect(project.components[0].graph.roots[0].variant).toBe('primary');
    });
  });
});

// ---- Round-trip tests --------------------------------------------------------

describe('Round-trip: export -> import', () => {
  const exporter = new ProjectExporter();
  const importer = new ProjectImporter();

  function roundTrip(project: LegacyProject): LegacyProject {
    const input = exportToImportInput(project);
    return importer.import(input).project;
  }

  it('preserves project name', () => {
    expect(roundTrip(makeProject({ name: 'Conference App' })).name).toBe('Conference App');
  });

  it('preserves project version', () => {
    expect(roundTrip(makeProject({ version: '4' })).version).toBe('4');
  });

  it('preserves runtimeVersion', () => {
    expect(roundTrip(makeProject({ runtimeVersion: 'react19' })).runtimeVersion).toBe('react19');
  });

  it('preserves settings', () => {
    const settings = { bodyScroll: true, favicon: '/favicon.ico' };
    expect((roundTrip(makeProject({ settings })).settings as any)?.bodyScroll).toBe(true);
  });

  it('preserves component count', () => {
    const project = makeProject({
      components: [makeComponent('/#Header'), makeComponent('/Pages/Home'), makeComponent('/Shared/Button')]
    });
    expect(roundTrip(project).components.length).toBe(3);
  });

  it('preserves component legacy names', () => {
    const project = makeProject({
      components: [makeComponent('/#Header'), makeComponent('/Pages/Home')]
    });
    const names = roundTrip(project).components.map((c) => c.name).sort();
    expect(names[0]).toBe('/#Header');
    expect(names[1]).toBe('/Pages/Home');
  });

  it('preserves component ids', () => {
    const comp = makeComponent('/#Header');
    comp.id = 'comp_header_xyz';
    const result = roundTrip(makeProject({ components: [comp] }));
    expect(result.components[0].id).toBe('comp_header_xyz');
  });

  it('preserves connections', () => {
    const comp = makeComponent('/#Header');
    comp.graph.connections = [
      { fromId: 'n1', fromProperty: 'onClick', toId: 'n2', toProperty: 'trigger' },
      { fromId: 'n2', fromProperty: 'out', toId: 'n3', toProperty: 'in', annotation: 'Created' as const }
    ];
    const result = roundTrip(makeProject({ components: [comp] }));
    expect(result.components[0].graph.connections.length).toBe(2);
    expect(result.components[0].graph.connections[1].annotation).toBe('Created');
  });

  it('preserves node tree structure', () => {
    const comp = makeComponent('/#Header');
    comp.graph.roots = [
      makeNode('root', 'Group', {
        children: [
          makeNode('child1', 'Text', { parameters: { text: 'Hello' } }),
          makeNode('child2', 'Image')
        ]
      })
    ];
    const result = roundTrip(makeProject({ components: [comp] }));
    const roots = result.components[0].graph.roots;
    expect(roots.length).toBe(1);
    expect(roots[0].children!.length).toBe(2);
    expect(roots[0].children![0].parameters).toEqual({ text: 'Hello' });
  });

  it('preserves routes in metadata', () => {
    const routes = [{ path: '/home', component: 'pages/Home' }, { path: '/profile', component: 'pages/Profile' }];
    const result = roundTrip(makeProject({ metadata: { routes } }));
    expect((result.metadata as any)?.routes).toEqual(routes);
  });

  it('preserves styles colors in metadata', () => {
    const colors = { primary: '#3B82F6', secondary: '#10B981' };
    const result = roundTrip(makeProject({ metadata: { styles: { colors } } }));
    expect((result.metadata as any)?.styles?.colors).toEqual(colors);
  });

  it('preserves variants with stateParamaters typo', () => {
    const variants = [
      { name: 'primary', typename: 'Button', stateParamaters: { hover: { opacity: 0.8 } } }
    ];
    const result = roundTrip(makeProject({ variants }));
    expect(result.variants!.length).toBe(1);
    expect(result.variants![0].stateParamaters).toEqual({ hover: { opacity: 0.8 } });
  });

  it('preserves non-styles non-routes metadata', () => {
    const result = roundTrip(makeProject({ metadata: { cloudservices: { id: 'abc' } } }));
    expect((result.metadata as any)?.cloudservices).toEqual({ id: 'abc' });
  });

  it('handles empty project cleanly', () => {
    const result = roundTrip(makeProject());
    expect(result.name).toBe('Test Project');
    expect(result.components.length).toBe(0);
  });

  it('handles cloud component round-trip', () => {
    const project = makeProject({ components: [makeComponent('/#__cloud__/SendGrid/Send')] });
    const result = roundTrip(project);
    expect(result.components[0].name).toBe('/#__cloud__/SendGrid/Send');
  });

  it('handles page component round-trip', () => {
    const project = makeProject({ components: [makeComponent('/Pages/Home')] });
    const result = roundTrip(project);
    expect(result.components[0].name).toBe('/Pages/Home');
  });
});
