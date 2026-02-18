/**
 * Schema Validator Tests — STRUCT-001
 *
 * Tests for the Ajv-based validation utilities covering all 8 v2 format schemas.
 * Each schema is tested with a valid minimal fixture and key invalid cases.
 */

import { SchemaValidator, SCHEMA_IDS, validateSchema, formatValidationErrors } from '../../src/editor/src/schemas/validator';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const validProject = {
  name: 'My Conference App',
  version: '2.0',
  nodegxVersion: '1.1.0'
};

const validComponent = {
  id: 'comp_header_abc123',
  name: 'Header',
  type: 'visual'
};

const validNodes = {
  componentId: 'comp_header_abc123',
  version: 1,
  nodes: [
    {
      id: 'node_root_001',
      type: 'Group',
      label: 'Header Container',
      x: 0,
      y: 0,
      parameters: { layout: 'row' }
    }
  ]
};

const validConnections = {
  componentId: 'comp_header_abc123',
  version: 1,
  connections: [
    {
      fromId: 'node_root_001',
      fromProperty: 'onClick',
      toId: 'node_root_002',
      toProperty: 'trigger'
    }
  ]
};

const validRegistry = {
  version: 1,
  lastUpdated: '2026-02-18T00:00:00.000Z',
  components: {
    Header: {
      path: 'Header',
      type: 'visual',
      nodeCount: 10,
      connectionCount: 5
    }
  },
  stats: {
    totalComponents: 1,
    totalNodes: 10,
    totalConnections: 5
  }
};

const validRoutes = {
  routes: [
    { path: '/home', component: 'pages/HomePage' },
    { path: '/profile', component: 'pages/ProfilePage', title: 'Profile' }
  ]
};

const validStyles = {
  version: 1,
  colors: {
    primary: '#3B82F6',
    background: '#ffffff'
  },
  textStyles: {
    heading: { fontSize: '24px', fontWeight: '700' }
  }
};

const validModel = {
  name: 'User',
  fields: [
    { name: 'username', type: 'String', required: true },
    { name: 'email', type: 'String', unique: true },
    { name: 'age', type: 'Number' }
  ]
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SchemaValidator', () => {
  beforeEach(() => {
    // Reset singleton between tests to ensure clean state
    SchemaValidator.reset();
  });

  describe('singleton', () => {
    it('returns the same instance on repeated calls', () => {
      const a = SchemaValidator.instance;
      const b = SchemaValidator.instance;
      expect(a).toBe(b);
    });

    it('creates a new instance after reset()', () => {
      const a = SchemaValidator.instance;
      SchemaValidator.reset();
      const b = SchemaValidator.instance;
      expect(a).not.toBe(b);
    });
  });

  // ─── project-v2.schema.json ─────────────────────────────────────────────────

  describe('validateProject', () => {
    it('accepts a valid minimal project file', () => {
      const result = SchemaValidator.instance.validateProject(validProject);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('accepts a full project file with all optional fields', () => {
      const result = SchemaValidator.instance.validateProject({
        ...validProject,
        id: 'proj_abc123',
        runtimeVersion: 'react19',
        created: '2026-01-01T00:00:00.000Z',
        modified: '2026-02-18T00:00:00.000Z',
        settings: { rootComponent: 'App', defaultRoute: '/home' },
        structure: { componentsDir: 'components', modelsDir: 'models', assetsDir: 'assets' },
        metadata: { styles: {}, cloudservices: {} }
      });
      expect(result.valid).toBe(true);
    });

    it('rejects when name is missing', () => {
      const result = SchemaValidator.instance.validateProject({ version: '2.0', nodegxVersion: '1.1.0' });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('name'))).toBe(true);
    });

    it('rejects when version is missing', () => {
      const result = SchemaValidator.instance.validateProject({ name: 'Test', nodegxVersion: '1.1.0' });
      expect(result.valid).toBe(false);
    });

    it('rejects when nodegxVersion is missing', () => {
      const result = SchemaValidator.instance.validateProject({ name: 'Test', version: '2.0' });
      expect(result.valid).toBe(false);
    });

    it('rejects invalid runtimeVersion enum value', () => {
      const result = SchemaValidator.instance.validateProject({
        ...validProject,
        runtimeVersion: 'react18'
      });
      expect(result.valid).toBe(false);
    });

    it('rejects invalid date-time format for created', () => {
      const result = SchemaValidator.instance.validateProject({
        ...validProject,
        created: 'not-a-date'
      });
      expect(result.valid).toBe(false);
    });

    it('rejects non-object input', () => {
      expect(SchemaValidator.instance.validateProject(null).valid).toBe(false);
      expect(SchemaValidator.instance.validateProject('string').valid).toBe(false);
      expect(SchemaValidator.instance.validateProject(42).valid).toBe(false);
    });
  });

  // ─── component.schema.json ──────────────────────────────────────────────────

  describe('validateComponent', () => {
    it('accepts a valid minimal component file', () => {
      const result = SchemaValidator.instance.validateComponent(validComponent);
      expect(result.valid).toBe(true);
    });

    it('accepts a full component with ports and dependencies', () => {
      const result = SchemaValidator.instance.validateComponent({
        ...validComponent,
        displayName: 'Site Header',
        path: '/#Header',
        description: 'Main navigation header',
        category: 'layout',
        tags: ['navigation', 'header'],
        ports: {
          inputs: [
            { name: 'userName', type: 'string', displayName: 'User Name' },
            { name: 'isLoggedIn', type: 'boolean', default: false }
          ],
          outputs: [
            { name: 'onLogout', type: 'signal' }
          ]
        },
        dependencies: ['shared/Avatar', 'shared/Button'],
        created: '2026-01-01T00:00:00.000Z',
        modified: '2026-02-18T00:00:00.000Z'
      });
      expect(result.valid).toBe(true);
    });

    it('rejects when id is missing', () => {
      const result = SchemaValidator.instance.validateComponent({ name: 'Header', type: 'visual' });
      expect(result.valid).toBe(false);
    });

    it('rejects when name is missing', () => {
      const result = SchemaValidator.instance.validateComponent({ id: 'comp_abc', type: 'visual' });
      expect(result.valid).toBe(false);
    });

    it('rejects invalid type enum', () => {
      const result = SchemaValidator.instance.validateComponent({ ...validComponent, type: 'widget' });
      expect(result.valid).toBe(false);
    });

    it('accepts all valid type enum values', () => {
      const types = ['root', 'page', 'visual', 'logic', 'cloud'] as const;
      for (const type of types) {
        const result = SchemaValidator.instance.validateComponent({ ...validComponent, type });
        expect(result.valid).toBe(true);
      }
    });

    it('rejects port with missing name', () => {
      const result = SchemaValidator.instance.validateComponent({
        ...validComponent,
        ports: { inputs: [{ type: 'string' }] }
      });
      expect(result.valid).toBe(false);
    });
  });

  // ─── nodes.schema.json ──────────────────────────────────────────────────────

  describe('validateNodes', () => {
    it('accepts a valid nodes file', () => {
      const result = SchemaValidator.instance.validateNodes(validNodes);
      expect(result.valid).toBe(true);
    });

    it('accepts an empty nodes array', () => {
      const result = SchemaValidator.instance.validateNodes({
        componentId: 'comp_abc',
        nodes: []
      });
      expect(result.valid).toBe(true);
    });

    it('accepts nodes with all optional fields', () => {
      const result = SchemaValidator.instance.validateNodes({
        componentId: 'comp_abc',
        version: 1,
        nodes: [
          {
            id: 'node_001',
            type: 'Group',
            label: 'Container',
            x: 100,
            y: 200,
            variant: 'primary',
            parameters: { layout: 'row', gap: '12px' },
            stateParameters: { hover: { opacity: 0.8 } },
            children: ['node_002'],
            metadata: { comment: 'Main container' }
          },
          {
            id: 'node_002',
            type: '/#Header',
            parent: 'node_001',
            dynamicports: [{ name: 'item-0-label', type: 'string' }]
          }
        ]
      });
      expect(result.valid).toBe(true);
    });

    it('rejects when componentId is missing', () => {
      const result = SchemaValidator.instance.validateNodes({ nodes: [] });
      expect(result.valid).toBe(false);
    });

    it('rejects when nodes is missing', () => {
      const result = SchemaValidator.instance.validateNodes({ componentId: 'comp_abc' });
      expect(result.valid).toBe(false);
    });

    it('rejects a node with missing id', () => {
      const result = SchemaValidator.instance.validateNodes({
        componentId: 'comp_abc',
        nodes: [{ type: 'Group' }]
      });
      expect(result.valid).toBe(false);
    });

    it('rejects a node with missing type', () => {
      const result = SchemaValidator.instance.validateNodes({
        componentId: 'comp_abc',
        nodes: [{ id: 'node_001' }]
      });
      expect(result.valid).toBe(false);
    });

    it('accepts valid annotation values', () => {
      const annotations = ['Deleted', 'Created', 'Changed'] as const;
      for (const annotation of annotations) {
        const result = SchemaValidator.instance.validateNodes({
          componentId: 'comp_abc',
          nodes: [{ id: 'node_001', type: 'Group', annotation }]
        });
        expect(result.valid).toBe(true);
      }
    });

    it('rejects invalid annotation value', () => {
      const result = SchemaValidator.instance.validateNodes({
        componentId: 'comp_abc',
        nodes: [{ id: 'node_001', type: 'Group', annotation: 'Modified' }]
      });
      expect(result.valid).toBe(false);
    });
  });

  // ─── connections.schema.json ────────────────────────────────────────────────

  describe('validateConnections', () => {
    it('accepts a valid connections file', () => {
      const result = SchemaValidator.instance.validateConnections(validConnections);
      expect(result.valid).toBe(true);
    });

    it('accepts an empty connections array', () => {
      const result = SchemaValidator.instance.validateConnections({
        componentId: 'comp_abc',
        connections: []
      });
      expect(result.valid).toBe(true);
    });

    it('rejects when componentId is missing', () => {
      const result = SchemaValidator.instance.validateConnections({ connections: [] });
      expect(result.valid).toBe(false);
    });

    it('rejects when connections is missing', () => {
      const result = SchemaValidator.instance.validateConnections({ componentId: 'comp_abc' });
      expect(result.valid).toBe(false);
    });

    it('rejects a connection missing fromId', () => {
      const result = SchemaValidator.instance.validateConnections({
        componentId: 'comp_abc',
        connections: [{ fromProperty: 'onClick', toId: 'node_002', toProperty: 'trigger' }]
      });
      expect(result.valid).toBe(false);
    });

    it('rejects a connection missing toProperty', () => {
      const result = SchemaValidator.instance.validateConnections({
        componentId: 'comp_abc',
        connections: [{ fromId: 'node_001', fromProperty: 'onClick', toId: 'node_002' }]
      });
      expect(result.valid).toBe(false);
    });

    it('accepts connection with annotation', () => {
      const result = SchemaValidator.instance.validateConnections({
        componentId: 'comp_abc',
        connections: [
          {
            fromId: 'node_001',
            fromProperty: 'onClick',
            toId: 'node_002',
            toProperty: 'trigger',
            annotation: 'Created'
          }
        ]
      });
      expect(result.valid).toBe(true);
    });
  });

  // ─── registry.schema.json ───────────────────────────────────────────────────

  describe('validateRegistry', () => {
    it('accepts a valid registry file', () => {
      const result = SchemaValidator.instance.validateRegistry(validRegistry);
      expect(result.valid).toBe(true);
    });

    it('accepts an empty components map', () => {
      const result = SchemaValidator.instance.validateRegistry({ version: 1, components: {} });
      expect(result.valid).toBe(true);
    });

    it('rejects when version is missing', () => {
      const result = SchemaValidator.instance.validateRegistry({ components: {} });
      expect(result.valid).toBe(false);
    });

    it('rejects when components is missing', () => {
      const result = SchemaValidator.instance.validateRegistry({ version: 1 });
      expect(result.valid).toBe(false);
    });

    it('rejects a component entry with invalid type', () => {
      const result = SchemaValidator.instance.validateRegistry({
        version: 1,
        components: {
          Header: { path: 'Header', type: 'widget' }
        }
      });
      expect(result.valid).toBe(false);
    });

    it('rejects a component entry missing path', () => {
      const result = SchemaValidator.instance.validateRegistry({
        version: 1,
        components: {
          Header: { type: 'visual' }
        }
      });
      expect(result.valid).toBe(false);
    });

    it('accepts all valid component type values', () => {
      const types = ['root', 'page', 'visual', 'logic', 'cloud'] as const;
      for (const type of types) {
        const result = SchemaValidator.instance.validateRegistry({
          version: 1,
          components: { Test: { path: 'Test', type } }
        });
        expect(result.valid).toBe(true);
      }
    });
  });

  // ─── routes.schema.json ─────────────────────────────────────────────────────

  describe('validateRoutes', () => {
    it('accepts a valid routes file', () => {
      const result = SchemaValidator.instance.validateRoutes(validRoutes);
      expect(result.valid).toBe(true);
    });

    it('accepts an empty routes array', () => {
      const result = SchemaValidator.instance.validateRoutes({ routes: [] });
      expect(result.valid).toBe(true);
    });

    it('accepts routes with all optional fields', () => {
      const result = SchemaValidator.instance.validateRoutes({
        version: 1,
        routes: [
          {
            path: '/home',
            component: 'pages/HomePage',
            title: 'Home',
            exact: true,
            metadata: { requiresAuth: false }
          }
        ],
        notFound: 'pages/NotFoundPage'
      });
      expect(result.valid).toBe(true);
    });

    it('rejects when routes is missing', () => {
      const result = SchemaValidator.instance.validateRoutes({});
      expect(result.valid).toBe(false);
    });

    it('rejects a route missing path', () => {
      const result = SchemaValidator.instance.validateRoutes({
        routes: [{ component: 'pages/HomePage' }]
      });
      expect(result.valid).toBe(false);
    });

    it('rejects a route missing component', () => {
      const result = SchemaValidator.instance.validateRoutes({
        routes: [{ path: '/home' }]
      });
      expect(result.valid).toBe(false);
    });
  });

  // ─── styles.schema.json ─────────────────────────────────────────────────────

  describe('validateStyles', () => {
    it('accepts a valid styles file', () => {
      const result = SchemaValidator.instance.validateStyles(validStyles);
      expect(result.valid).toBe(true);
    });

    it('accepts an empty styles file', () => {
      const result = SchemaValidator.instance.validateStyles({});
      expect(result.valid).toBe(true);
    });

    it('accepts styles with variants', () => {
      const result = SchemaValidator.instance.validateStyles({
        variants: [
          {
            name: 'primary',
            typename: 'Button',
            parameters: { backgroundColor: '#3B82F6', color: '#ffffff' },
            stateParameters: { hover: { backgroundColor: '#2563EB' } }
          }
        ]
      });
      expect(result.valid).toBe(true);
    });

    it('rejects a variant missing name', () => {
      const result = SchemaValidator.instance.validateStyles({
        variants: [{ typename: 'Button' }]
      });
      expect(result.valid).toBe(false);
    });

    it('rejects a variant missing typename', () => {
      const result = SchemaValidator.instance.validateStyles({
        variants: [{ name: 'primary' }]
      });
      expect(result.valid).toBe(false);
    });
  });

  // ─── model.schema.json ──────────────────────────────────────────────────────

  describe('validateModel', () => {
    it('accepts a valid model file', () => {
      const result = SchemaValidator.instance.validateModel(validModel);
      expect(result.valid).toBe(true);
    });

    it('accepts a model with all field types', () => {
      const result = SchemaValidator.instance.validateModel({
        name: 'Session',
        fields: [
          { name: 'title', type: 'String' },
          { name: 'capacity', type: 'Number' },
          { name: 'isPublished', type: 'Boolean' },
          { name: 'startTime', type: 'Date' },
          { name: 'metadata', type: 'Object' },
          { name: 'tags', type: 'Array' },
          { name: 'speaker', type: 'Pointer', targetClass: 'User' },
          { name: 'attendees', type: 'Relation', targetClass: 'User' },
          { name: 'thumbnail', type: 'File' },
          { name: 'location', type: 'GeoPoint' }
        ]
      });
      expect(result.valid).toBe(true);
    });

    it('accepts a model with indexes', () => {
      const result = SchemaValidator.instance.validateModel({
        ...validModel,
        indexes: [
          { name: 'email_idx', fields: ['email'], unique: true },
          { fields: ['username'] }
        ]
      });
      expect(result.valid).toBe(true);
    });

    it('rejects when name is missing', () => {
      const result = SchemaValidator.instance.validateModel({ fields: [] });
      expect(result.valid).toBe(false);
    });

    it('rejects when fields is missing', () => {
      const result = SchemaValidator.instance.validateModel({ name: 'User' });
      expect(result.valid).toBe(false);
    });

    it('rejects a field with invalid type', () => {
      const result = SchemaValidator.instance.validateModel({
        name: 'User',
        fields: [{ name: 'username', type: 'Text' }]
      });
      expect(result.valid).toBe(false);
    });

    it('rejects a field missing name', () => {
      const result = SchemaValidator.instance.validateModel({
        name: 'User',
        fields: [{ type: 'String' }]
      });
      expect(result.valid).toBe(false);
    });

    it('rejects an index with empty fields array', () => {
      const result = SchemaValidator.instance.validateModel({
        ...validModel,
        indexes: [{ fields: [] }]
      });
      expect(result.valid).toBe(false);
    });
  });

  // ─── validateSchema convenience function ────────────────────────────────────

  describe('validateSchema (convenience function)', () => {
    it('delegates to the singleton validator', () => {
      const result = validateSchema(SCHEMA_IDS.COMPONENT, validComponent);
      expect(result.valid).toBe(true);
    });

    it('returns errors for invalid data', () => {
      const result = validateSchema(SCHEMA_IDS.PROJECT, {});
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  // ─── validateOrThrow ────────────────────────────────────────────────────────

  describe('validateOrThrow', () => {
    it('does not throw for valid data', () => {
      expect(() => {
        SchemaValidator.instance.validateOrThrow(SCHEMA_IDS.COMPONENT, validComponent);
      }).not.toThrow();
    });

    it('throws for invalid data', () => {
      expect(() => {
        SchemaValidator.instance.validateOrThrow(SCHEMA_IDS.COMPONENT, { name: 'Header' });
      }).toThrow('Schema validation failed');
    });

    it('includes context in the error message', () => {
      expect(() => {
        SchemaValidator.instance.validateOrThrow(SCHEMA_IDS.COMPONENT, {}, 'components/Header/component.json');
      }).toThrow('[components/Header/component.json]');
    });
  });

  // ─── formatValidationErrors ─────────────────────────────────────────────────

  describe('formatValidationErrors', () => {
    it('returns "No errors" for empty array', () => {
      const { formatValidationErrors } = require('../../src/editor/src/schemas/validator');
      expect(formatValidationErrors([])).toBe('No errors');
    });

    it('formats errors with path and message', () => {
      const { formatValidationErrors } = require('../../src/editor/src/schemas/validator');
      const errors = [
        { path: '/name', message: 'must be string', keyword: 'type', params: {} },
        { path: '/type', message: 'must be equal to one of the allowed values', keyword: 'enum', params: {} }
      ];
      const formatted = formatValidationErrors(errors);
      expect(formatted).toContain('/name');
      expect(formatted).toContain('must be string');
      expect(formatted).toContain('/type');
    });
  });

  // ─── SCHEMA_IDS ─────────────────────────────────────────────────────────────

  describe('SCHEMA_IDS', () => {
    it('has all 8 schema IDs defined', () => {
      expect(Object.keys(SCHEMA_IDS).length).toBe(8);
    });

    it('all IDs are valid opennoodl.dev URLs', () => {
      for (const id of Object.values(SCHEMA_IDS)) {
        expect(id).toMatch(/^https:\/\/opennoodl\.dev\/schemas\//);
      }
    });
  });

  // ─── Edge cases ──────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('collects multiple errors when allErrors is true', () => {
      // Missing name, version, AND nodegxVersion — should get 3 errors
      const result = SchemaValidator.instance.validateProject({});
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });

    it('handles deeply nested valid node metadata', () => {
      const result = SchemaValidator.instance.validateNodes({
        componentId: 'comp_abc',
        nodes: [
          {
            id: 'node_001',
            type: 'JavaScriptNode',
            metadata: {
              merge: { soureCodePorts: ['script'] },
              prompt: {
                history: [
                  { role: 'user', content: 'Create a function that...' },
                  { role: 'assistant', content: 'Here is the code...' }
                ]
              }
            }
          }
        ]
      });
      expect(result.valid).toBe(true);
    });

    it('handles component references in node type (legacy path format)', () => {
      const result = SchemaValidator.instance.validateNodes({
        componentId: 'comp_abc',
        nodes: [
          { id: 'node_001', type: '/#Header' },
          { id: 'node_002', type: '/#__cloud__/SendGrid/SendEmail' }
        ]
      });
      expect(result.valid).toBe(true);
    });

    it('handles port type as object (complex type definition)', () => {
      const result = SchemaValidator.instance.validateComponent({
        ...validComponent,
        ports: {
          inputs: [
            {
              name: 'items',
              type: { name: 'stringlist', allowConnectionsOnly: true },
              displayName: 'Items'
            }
          ]
        }
      });
      expect(result.valid).toBe(true);
    });
  });
});
