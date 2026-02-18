/**
 * ProjectExporter Tests -- STRUCT-002
 *
 * Tests for the export engine that converts legacy project.json
 * to the v2 multi-file directory structure.
 */

import {
  ProjectExporter,
  legacyNameToPath,
  inferComponentType,
  flattenNodes,
  countNodes,
  LegacyProject,
  LegacyComponent,
  LegacyNode
} from '../../src/editor/src/io/ProjectExporter';

// ---- Fixtures ----------------------------------------------------------------

const makeNode = (id: string, type = 'Group', overrides: Partial<LegacyNode> = {}): LegacyNode => ({
  id,
  type,
  x: 0,
  y: 0,
  parameters: {},
  children: [],
  ...overrides
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

// ---- legacyNameToPath --------------------------------------------------------

describe('legacyNameToPath', () => {
  it('strips leading slash and hash', () => {
    expect(legacyNameToPath('/#Header')).toBe('Header');
  });
  it('strips leading slash only', () => {
    expect(legacyNameToPath('/Pages/Home')).toBe('Pages/Home');
  });
  it('handles root component marker', () => {
    expect(legacyNameToPath('/%rootcomponent')).toBe('%rootcomponent');
  });
  it('handles cloud component path', () => {
    expect(legacyNameToPath('/#__cloud__/SendGrid/Send')).toBe('__cloud__/SendGrid/Send');
  });
  it('handles name without leading slash', () => {
    expect(legacyNameToPath('Header')).toBe('Header');
  });
  it('handles nested path', () => {
    expect(legacyNameToPath('/Shared/Button')).toBe('Shared/Button');
  });
});

// ---- inferComponentType ------------------------------------------------------

describe('inferComponentType', () => {
  it('returns root for %rootcomponent', () => {
    expect(inferComponentType('/%rootcomponent')).toBe('root');
  });
  it('returns cloud for __cloud__ paths', () => {
    expect(inferComponentType('/#__cloud__/SendGrid/Send')).toBe('cloud');
  });
  it('returns page for /Pages/ paths', () => {
    expect(inferComponentType('/Pages/Home')).toBe('page');
  });
  it('returns page case-insensitively', () => {
    expect(inferComponentType('/pages/profile')).toBe('page');
  });
  it('returns visual for regular components', () => {
    expect(inferComponentType('/#Header')).toBe('visual');
  });
  it('returns visual for shared components', () => {
    expect(inferComponentType('/Shared/Button')).toBe('visual');
  });
});

// ---- countNodes --------------------------------------------------------------

describe('countNodes', () => {
  it('returns 0 for empty roots', () => {
    expect(countNodes([])).toBe(0);
  });
  it('counts a single root node', () => {
    expect(countNodes([makeNode('n1')])).toBe(1);
  });
  it('counts root + children recursively', () => {
    const root = makeNode('n1', 'Group', {
      children: [
        makeNode('n2', 'Text', { children: [makeNode('n3')] }),
        makeNode('n4')
      ]
    });
    expect(countNodes([root])).toBe(4);
  });
  it('counts multiple roots', () => {
    expect(countNodes([makeNode('n1'), makeNode('n2'), makeNode('n3')])).toBe(3);
  });
});

// ---- flattenNodes ------------------------------------------------------------

describe('flattenNodes', () => {
  it('returns empty array for no roots', () => {
    expect(flattenNodes([])).toEqual([]);
  });
  it('flattens a single root node', () => {
    const nodes = flattenNodes([makeNode('n1', 'Group')]);
    expect(nodes.length).toBe(1);
    expect(nodes[0].id).toBe('n1');
    expect(nodes[0].type).toBe('Group');
  });
  it('flattens nested children into flat array', () => {
    const root = makeNode('root', 'Group', {
      children: [makeNode('child1', 'Text'), makeNode('child2', 'Image')]
    });
    const nodes = flattenNodes([root]);
    expect(nodes.length).toBe(3);
    expect(nodes.map((n) => n.id)).toEqual(['root', 'child1', 'child2']);
  });
  it('sets parent id on child nodes', () => {
    const root = makeNode('root', 'Group', { children: [makeNode('child1')] });
    const nodes = flattenNodes([root]);
    const child = nodes.find((n) => n.id === 'child1');
    expect(child?.parent).toBe('root');
  });
  it('root nodes have no parent field', () => {
    const nodes = flattenNodes([makeNode('root')]);
    expect(nodes[0].parent).toBeUndefined();
  });
  it('sets children array of ids on parent node', () => {
    const root = makeNode('root', 'Group', { children: [makeNode('c1'), makeNode('c2')] });
    const nodes = flattenNodes([root]);
    const rootNode = nodes.find((n) => n.id === 'root');
    expect(rootNode?.children).toEqual(['c1', 'c2']);
  });
  it('omits empty parameters object', () => {
    const nodes = flattenNodes([makeNode('n1', 'Group', { parameters: {} })]);
    expect(nodes[0].parameters).toBeUndefined();
  });
  it('preserves non-empty parameters', () => {
    const nodes = flattenNodes([makeNode('n1', 'Group', { parameters: { layout: 'row' } })]);
    expect(nodes[0].parameters).toEqual({ layout: 'row' });
  });
  it('preserves stateParameters', () => {
    const nodes = flattenNodes([makeNode('n1', 'Group', { stateParameters: { hover: { opacity: 0.5 } } })]);
    expect(nodes[0].stateParameters).toEqual({ hover: { opacity: 0.5 } });
  });
  it('preserves metadata', () => {
    const nodes = flattenNodes([makeNode('n1', 'Group', { metadata: { comment: 'hello' } })]);
    expect(nodes[0].metadata).toEqual({ comment: 'hello' });
  });
  it('handles deeply nested children', () => {
    const deep = makeNode('l3');
    const mid = makeNode('l2', 'Group', { children: [deep] });
    const root = makeNode('l1', 'Group', { children: [mid] });
    const nodes = flattenNodes([root]);
    expect(nodes.length).toBe(3);
    const l3 = nodes.find((n) => n.id === 'l3');
    expect(l3?.parent).toBe('l2');
  });
});

// ---- ProjectExporter ---------------------------------------------------------

describe('ProjectExporter', () => {
  let exporter: ProjectExporter;

  beforeEach(() => {
    exporter = new ProjectExporter();
  });

  describe('export() basic structure', () => {
    it('always produces nodegx.project.json', () => {
      const result = exporter.export(makeProject());
      expect(result.files.map((f) => f.relativePath)).toContain('nodegx.project.json');
    });
    it('always produces components/_registry.json', () => {
      const result = exporter.export(makeProject());
      expect(result.files.map((f) => f.relativePath)).toContain('components/_registry.json');
    });
    it('does not produce routes file when no routes in metadata', () => {
      const result = exporter.export(makeProject());
      expect(result.files.map((f) => f.relativePath)).not.toContain('nodegx.routes.json');
    });
    it('does not produce styles file when no styles or variants', () => {
      const result = exporter.export(makeProject());
      expect(result.files.map((f) => f.relativePath)).not.toContain('nodegx.styles.json');
    });
    it('returns correct stats for empty project', () => {
      const result = exporter.export(makeProject());
      expect(result.stats).toEqual({ totalComponents: 0, totalNodes: 0, totalConnections: 0 });
    });
  });

  describe('nodegx.project.json', () => {
    const getProjectFile = (project: LegacyProject) => {
      const result = exporter.export(project);
      return result.files.find((f) => f.relativePath === 'nodegx.project.json')?.content as any;
    };

    it('includes project name', () => {
      expect(getProjectFile(makeProject({ name: 'My App' })).name).toBe('My App');
    });
    it('includes version', () => {
      expect(getProjectFile(makeProject({ version: '4' })).version).toBe('4');
    });
    it('includes runtimeVersion when set', () => {
      expect(getProjectFile(makeProject({ runtimeVersion: 'react19' })).runtimeVersion).toBe('react19');
    });
    it('omits runtimeVersion when not set', () => {
      expect(getProjectFile(makeProject()).runtimeVersion).toBeUndefined();
    });
    it('includes settings when present', () => {
      expect(getProjectFile(makeProject({ settings: { bodyScroll: true } })).settings).toEqual({ bodyScroll: true });
    });
    it('includes $schema field', () => {
      expect(getProjectFile(makeProject())['$schema']).toContain('project-v2');
    });
    it('strips styles and routes from metadata but keeps other keys', () => {
      const meta = getProjectFile(makeProject({
        metadata: { styles: { colors: {} }, routes: [], cloudservices: { id: 'abc' } }
      })).metadata;
      expect(meta?.styles).toBeUndefined();
      expect(meta?.routes).toBeUndefined();
      expect(meta?.cloudservices).toEqual({ id: 'abc' });
    });
  });

  describe('nodegx.routes.json', () => {
    it('produces routes file when metadata.routes is an array', () => {
      const result = exporter.export(makeProject({ metadata: { routes: [{ path: '/home', component: 'pages/Home' }] } }));
      expect(result.files.map((f) => f.relativePath)).toContain('nodegx.routes.json');
    });
    it('routes file contains the routes array', () => {
      const routes = [{ path: '/home', component: 'pages/Home' }];
      const result = exporter.export(makeProject({ metadata: { routes } }));
      const file = result.files.find((f) => f.relativePath === 'nodegx.routes.json')?.content as any;
      expect(file.routes).toEqual(routes);
    });
    it('does not produce routes file when metadata.routes is not an array', () => {
      const result = exporter.export(makeProject({ metadata: { routes: {} } }));
      expect(result.files.map((f) => f.relativePath)).not.toContain('nodegx.routes.json');
    });
  });

  describe('nodegx.styles.json', () => {
    it('produces styles file when metadata.styles has colors', () => {
      const result = exporter.export(makeProject({ metadata: { styles: { colors: { primary: '#3B82F6' } } } }));
      expect(result.files.map((f) => f.relativePath)).toContain('nodegx.styles.json');
    });
    it('produces styles file when variants exist', () => {
      const result = exporter.export(makeProject({ variants: [{ name: 'primary', typename: 'Button' }] }));
      expect(result.files.map((f) => f.relativePath)).toContain('nodegx.styles.json');
    });
    it('includes colors from metadata.styles', () => {
      const result = exporter.export(makeProject({ metadata: { styles: { colors: { primary: '#3B82F6' } } } }));
      const file = result.files.find((f) => f.relativePath === 'nodegx.styles.json')?.content as any;
      expect(file.colors).toEqual({ primary: '#3B82F6' });
    });
    it('normalises legacy stateParamaters typo to stateParameters', () => {
      const result = exporter.export(makeProject({
        variants: [{ name: 'primary', typename: 'Button', stateParamaters: { hover: { opacity: 0.8 } } }]
      }));
      const file = result.files.find((f) => f.relativePath === 'nodegx.styles.json')?.content as any;
      expect(file.variants[0].stateParameters).toEqual({ hover: { opacity: 0.8 } });
      expect(file.variants[0].stateParamaters).toBeUndefined();
    });
  });

  describe('component files', () => {
    it('produces 3 files per component', () => {
      const result = exporter.export(makeProject({ components: [makeComponent('/#Header')] }));
      const paths = result.files.map((f) => f.relativePath);
      expect(paths).toContain('components/Header/component.json');
      expect(paths).toContain('components/Header/nodes.json');
      expect(paths).toContain('components/Header/connections.json');
    });
    it('uses correct path for nested component', () => {
      const result = exporter.export(makeProject({ components: [makeComponent('/Pages/Home')] }));
      expect(result.files.map((f) => f.relativePath)).toContain('components/Pages/Home/component.json');
    });
    it('component.json has correct id', () => {
      const comp = makeComponent('/#Header');
      comp.id = 'comp_header_123';
      const result = exporter.export(makeProject({ components: [comp] }));
      const file = result.files.find((f) => f.relativePath === 'components/Header/component.json')?.content as any;
      expect(file.id).toBe('comp_header_123');
    });
    it('component.json preserves original legacy path', () => {
      const result = exporter.export(makeProject({ components: [makeComponent('/#Header')] }));
      const file = result.files.find((f) => f.relativePath === 'components/Header/component.json')?.content as any;
      expect(file.path).toBe('/#Header');
    });
    it('component.json infers correct type for page', () => {
      const result = exporter.export(makeProject({ components: [makeComponent('/Pages/Home')] }));
      const file = result.files.find((f) => f.relativePath === 'components/Pages/Home/component.json')?.content as any;
      expect(file.type).toBe('page');
    });
    it('nodes.json has componentId', () => {
      const comp = makeComponent('/#Header');
      comp.id = 'comp_header_123';
      const result = exporter.export(makeProject({ components: [comp] }));
      const file = result.files.find((f) => f.relativePath === 'components/Header/nodes.json')?.content as any;
      expect(file.componentId).toBe('comp_header_123');
    });
    it('nodes.json flattens nested nodes', () => {
      const comp = makeComponent('/#Header');
      comp.graph.roots = [makeNode('root', 'Group', { children: [makeNode('child', 'Text')] })];
      const result = exporter.export(makeProject({ components: [comp] }));
      const file = result.files.find((f) => f.relativePath === 'components/Header/nodes.json')?.content as any;
      expect(file.nodes.length).toBe(2);
    });
    it('connections.json maps legacy connections correctly', () => {
      const comp = makeComponent('/#Header');
      comp.graph.connections = [{ fromId: 'n1', fromProperty: 'onClick', toId: 'n2', toProperty: 'trigger' }];
      const result = exporter.export(makeProject({ components: [comp] }));
      const file = result.files.find((f) => f.relativePath === 'components/Header/connections.json')?.content as any;
      expect(file.connections.length).toBe(1);
      expect(file.connections[0]).toEqual({ fromId: 'n1', fromProperty: 'onClick', toId: 'n2', toProperty: 'trigger' });
    });
    it('connections.json preserves annotation field', () => {
      const comp = makeComponent('/#Header');
      comp.graph.connections = [{ fromId: 'n1', fromProperty: 'out', toId: 'n2', toProperty: 'in', annotation: 'Created' }];
      const result = exporter.export(makeProject({ components: [comp] }));
      const file = result.files.find((f) => f.relativePath === 'components/Header/connections.json')?.content as any;
      expect(file.connections[0].annotation).toBe('Created');
    });
  });

  describe('_registry.json', () => {
    it('lists all components', () => {
      const result = exporter.export(makeProject({ components: [makeComponent('/#Header'), makeComponent('/Pages/Home')] }));
      const file = result.files.find((f) => f.relativePath === 'components/_registry.json')?.content as any;
      expect(Object.keys(file.components).length).toBe(2);
      expect(file.components['Header']).toBeDefined();
      expect(file.components['Pages/Home']).toBeDefined();
    });
    it('registry entry has correct path', () => {
      const result = exporter.export(makeProject({ components: [makeComponent('/#Header')] }));
      const file = result.files.find((f) => f.relativePath === 'components/_registry.json')?.content as any;
      expect(file.components['Header'].path).toBe('Header');
    });
    it('registry entry has correct type', () => {
      const result = exporter.export(makeProject({ components: [makeComponent('/Pages/Home')] }));
      const file = result.files.find((f) => f.relativePath === 'components/_registry.json')?.content as any;
      expect(file.components['Pages/Home'].type).toBe('page');
    });
    it('registry entry has nodeCount', () => {
      const comp = makeComponent('/#Header');
      comp.graph.roots = [makeNode('n1'), makeNode('n2')];
      const result = exporter.export(makeProject({ components: [comp] }));
      const file = result.files.find((f) => f.relativePath === 'components/_registry.json')?.content as any;
      expect(file.components['Header'].nodeCount).toBe(2);
    });
    it('registry entry has connectionCount', () => {
      const comp = makeComponent('/#Header');
      comp.graph.connections = [
        { fromId: 'n1', fromProperty: 'out', toId: 'n2', toProperty: 'in' },
        { fromId: 'n2', fromProperty: 'out', toId: 'n3', toProperty: 'in' }
      ];
      const result = exporter.export(makeProject({ components: [comp] }));
      const file = result.files.find((f) => f.relativePath === 'components/_registry.json')?.content as any;
      expect(file.components['Header'].connectionCount).toBe(2);
    });
    it('registry stats are correct', () => {
      const comp1 = makeComponent('/#Header');
      comp1.graph.roots = [makeNode('n1')];
      comp1.graph.connections = [{ fromId: 'n1', fromProperty: 'out', toId: 'n2', toProperty: 'in' }];
      const comp2 = makeComponent('/Pages/Home');
      comp2.graph.roots = [makeNode('n2'), makeNode('n3')];
      const result = exporter.export(makeProject({ components: [comp1, comp2] }));
      const file = result.files.find((f) => f.relativePath === 'components/_registry.json')?.content as any;
      expect(file.stats.totalComponents).toBe(2);
      expect(file.stats.totalNodes).toBe(3);
      expect(file.stats.totalConnections).toBe(1);
    });
    it('registry has version 1', () => {
      const result = exporter.export(makeProject());
      const file = result.files.find((f) => f.relativePath === 'components/_registry.json')?.content as any;
      expect(file.version).toBe(1);
    });
  });

  describe('ExportResult stats', () => {
    it('stats match actual component/node/connection counts', () => {
      const comp = makeComponent('/#Header');
      comp.graph.roots = [makeNode('n1', 'Group', { children: [makeNode('n2')] })];
      comp.graph.connections = [{ fromId: 'n1', fromProperty: 'out', toId: 'n2', toProperty: 'in' }];
      const result = exporter.export(makeProject({ components: [comp] }));
      expect(result.stats.totalComponents).toBe(1);
      expect(result.stats.totalNodes).toBe(2);
      expect(result.stats.totalConnections).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('handles component with no graph gracefully', () => {
      const comp = makeComponent('/#Header');
      (comp as any).graph = undefined;
      expect(() => exporter.export(makeProject({ components: [comp] }))).not.toThrow();
    });
    it('handles component with empty graph', () => {
      const comp = makeComponent('/#Header');
      comp.graph = { roots: [], connections: [] };
      const result = exporter.export(makeProject({ components: [comp] }));
      const nodesFile = result.files.find((f) => f.relativePath === 'components/Header/nodes.json')?.content as any;
      expect(nodesFile.nodes.length).toBe(0);
    });
    it('handles multiple components correctly', () => {
      const project = makeProject({
        components: [makeComponent('/#Header'), makeComponent('/Pages/Home'), makeComponent('/Shared/Button')]
      });
      const result = exporter.export(project);
      expect(result.stats.totalComponents).toBe(3);
      const componentFiles = result.files.filter(
        (f) => f.relativePath.startsWith('components/') && !f.relativePath.endsWith('_registry.json')
      );
      expect(componentFiles.length).toBe(9);
    });
    it('cloud component gets correct type', () => {
      const result = exporter.export(makeProject({ components: [makeComponent('/#__cloud__/SendGrid/Send')] }));
      const file = result.files.find((f) => f.relativePath.includes('component.json'))?.content as any;
      expect(file.type).toBe('cloud');
    });
    it('node with variant is preserved', () => {
      const comp = makeComponent('/#Header');
      comp.graph.roots = [makeNode('n1', 'Button', { variant: 'primary' })];
      const result = exporter.export(makeProject({ components: [comp] }));
      const nodesFile = result.files.find((f) => f.relativePath === 'components/Header/nodes.json')?.content as any;
      expect(nodesFile.nodes[0].variant).toBe('primary');
    });
  });
});

