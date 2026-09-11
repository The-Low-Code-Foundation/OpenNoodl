/**
 * AAQ-005 — the one authoring vocabulary, editor side.
 *
 * Three jobs, in order of what they protect:
 *
 * 1. **The model-facing contract did not change.** `submit_component`'s JSON
 *    Schema is prompt surface for the in-editor authoring loop — the AIX-002
 *    compiler loop is the crown jewel, and altering the words a model reads while
 *    claiming to refactor a schema is the kind of change that shows up three
 *    sessions later as "the model got worse". The rendered schema is compared
 *    against a verbatim copy of the hand-written literal it replaced.
 * 2. **Every divergence between the two clients is declared with a reason.**
 *    `undeclaredDivergences()` is the invariant; the explicit expected list below
 *    is the deliberate-edit gate, so widening the gap takes two edits, not one.
 * 3. **No phantom fields.** Every node field the vocabulary offers an agent must
 *    exist in `schemas/nodes.schema.json`. This is the `widthUnit` class of bug —
 *    a field an agent can set that the storage format has never heard of — caught
 *    at the vocabulary rather than at a render nobody looks at.
 */

import * as fs from 'fs';
import * as path from 'path';

import {
  AUTHORED_NODE_FIELDS,
  AUTHORED_PAYLOAD_FIELDS,
  AUTHORED_PORT_FIELDS,
  SURFACE_DIVERGENCES,
  declaredDivergences,
  describeFor,
  fieldsFor,
  isRequiredIn,
  jsonSchemasFor,
  undeclaredDivergences
} from '../../src/editor/src/validation/authoringVocabulary';
import {
  AUTHORING_TOOLS,
  SUBMIT_COMPONENT
} from '../../src/editor/src/models/AiAssistant/authoring/tools';

// ── The literal this replaced, verbatim from tools.ts before AAQ-005 ──────────

const PRE_AAQ005_PORT_ITEMS = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    plug: { type: 'string', enum: ['input', 'output'] },
    type: { type: 'string', description: 'Port value type; "*" when it does not matter' },
    index: { type: 'number' }
  },
  required: ['name', 'plug']
};

const PRE_AAQ005_NODE_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Unique id you invent; required to wire connections or parent nodes' },
    type: {
      type: 'string',
      description: 'Exact catalog typeName ("Group"), or an existing component name ("/Pages/Home") to instantiate it'
    },
    label: { type: 'string', description: 'What this node is for, in this graph' },
    x: { type: 'number' },
    y: { type: 'number' },
    parent: { type: 'string', description: 'Id of the parent node in the visual tree; omit for roots and logic nodes' },
    parameters: { type: 'object', description: 'Static input values keyed by exact port name' },
    ports: {
      type: 'array',
      description:
        'Instance ports — only for "Component Inputs" (plug "output") and "Component Outputs" (plug "input") nodes',
      items: PRE_AAQ005_PORT_ITEMS
    }
  },
  required: ['id', 'type']
};

const PRE_AAQ005_CONNECTION_SCHEMA = {
  type: 'object',
  properties: {
    fromId: { type: 'string' },
    fromProperty: { type: 'string', description: 'Output port name on the source node' },
    toId: { type: 'string' },
    toProperty: { type: 'string', description: 'Input port name on the target node' }
  },
  required: ['fromId', 'fromProperty', 'toId', 'toProperty']
};

const PRE_AAQ005_SUBMIT_SCHEMA = {
  type: 'object',
  properties: {
    nodes: { type: 'array', items: PRE_AAQ005_NODE_SCHEMA, minItems: 1 },
    connections: { type: 'array', items: PRE_AAQ005_CONNECTION_SCHEMA },
    visual_roots: {
      type: 'array',
      items: { type: 'string' },
      description: 'Ids of the canvas root nodes (the visual root container for pages/visual components)'
    },
    description: { type: 'string', description: 'One or two sentences: what this component is and does' },
    sample_data: {
      type: 'object',
      description:
        'Optional. Example records the preview should display, keyed by the collection name this component ' +
        'queries — up to 5 per collection, realistic values, no real data. Only for components that read a backend.'
    }
  },
  required: ['nodes']
};

// ── The one field LEG-001 added, and nothing else ─────────────────────────────
//
// The literals above are the model-facing contract as AAQ-005 froze it. LEG-001
// changes it deliberately — `comment` was the field an agent could not write, at
// 1 authored comment in 2,045 nodes against `label`'s 89.3% — so the expectation
// is not edited in place. It is derived: the frozen literal PLUS one property.
// Anything else that moves still fails the byte-for-byte check, which is the
// property this describe block was written to hold.
//
// The description is pinned verbatim on purpose. It is shared with LEG-005's
// property-panel row, and two surfaces describing one field differently is the
// divergence `authoringVocabulary.ts` exists to prevent — a parity spec cannot
// catch it, because the other copy is UI copy.
const LEG001_COMMENT_DESCRIPTION =
  'Why this node is the way it is — a constraint, a rule, or a decision with an alternative. ' +
  'Omit when the type and label already say it.';

const NODE_SCHEMA_WITH_COMMENT = {
  ...PRE_AAQ005_NODE_SCHEMA,
  properties: {
    ...PRE_AAQ005_NODE_SCHEMA.properties,
    comment: { type: 'string', description: LEG001_COMMENT_DESCRIPTION }
  }
};

const SUBMIT_SCHEMA_WITH_COMMENT = {
  ...PRE_AAQ005_SUBMIT_SCHEMA,
  properties: {
    ...PRE_AAQ005_SUBMIT_SCHEMA.properties,
    nodes: { type: 'array', items: NODE_SCHEMA_WITH_COMMENT, minItems: 1 }
  }
};

describe('AAQ-005 — submit_component is unchanged by the convergence', () => {
  const submitTool = AUTHORING_TOOLS.find((t) => t.name === SUBMIT_COMPONENT);

  it('renders the hand-written literal plus LEG-001s one field', () => {
    expect(submitTool).toBeDefined();
    expect(submitTool!.parameters).toEqual(SUBMIT_SCHEMA_WITH_COMMENT);
  });

  it('renders the same node and connection schemas standalone', () => {
    const { node, connection } = jsonSchemasFor('editor');
    expect(node).toEqual(NODE_SCHEMA_WITH_COMMENT);
    expect(connection).toEqual(PRE_AAQ005_CONNECTION_SCHEMA);
  });

  it('changed the node schema by exactly one property', () => {
    const { node } = jsonSchemasFor('editor');
    const added = Object.keys(node.properties!).filter((k) => !(k in PRE_AAQ005_NODE_SCHEMA.properties));
    const removed = Object.keys(PRE_AAQ005_NODE_SCHEMA.properties).filter((k) => !(k in node.properties!));
    expect({ added, removed }).toEqual({ added: ['comment'], removed: [] });
  });

  it('carries the exact sentence LEG-005 shares with it', () => {
    const comment = AUTHORED_NODE_FIELDS.find((f) => f.name === 'comment')!;
    expect(describeFor(comment, 'editor')).toBe(LEG001_COMMENT_DESCRIPTION);
    expect(describeFor(comment, 'mcp')).toBe(LEG001_COMMENT_DESCRIPTION);
  });

  it('still offers exactly three tools', () => {
    expect(AUTHORING_TOOLS.map((t) => t.name)).toEqual(['get_node_types', 'get_component', 'submit_component']);
  });
});

describe('AAQ-005 — the editor omits the fields only the MCP door has', () => {
  const { node, payload } = jsonSchemasFor('editor');

  it('does not offer children or variant on a node', () => {
    // `children` is derived from `parent` plus submission order (candidate.ts):
    // double bookkeeping is what an LLM gets wrong. `variant` is carried over
    // from the base node instead — which is why an editor-authored *create* can
    // never have one (AAQ-011 F14).
    expect(Object.keys(node.properties!)).not.toContain('children');
    expect(Object.keys(node.properties!)).not.toContain('variant');
  });

  it('does not offer path, type or allow_unknown_types on the payload', () => {
    for (const mcpOnly of ['path', 'type', 'allow_unknown_types']) {
      expect(Object.keys(payload.properties!)).not.toContain(mcpOnly);
    }
  });

  it('keeps sample_data, which only this door consumes', () => {
    expect(Object.keys(payload.properties!)).toContain('sample_data');
  });
});

describe('AAQ-005 — every divergence is declared with a reason', () => {
  it('has no undeclared divergence', () => {
    // Anything partial — exposed to one client, required in one client, or
    // carrying a per-client note — must say why.
    expect(undeclaredDivergences().map((d) => `${d.surface}.${d.field}`)).toEqual([]);
  });

  it('declares exactly the divergences this session accounted for', () => {
    // A deliberate-edit gate. Adding a row here is the moment to ask whether the
    // two doors should really differ; slice 2's lesson is that they had, and
    // nobody had noticed for a year.
    expect(declaredDivergences().map((d) => ({ surface: d.surface, field: d.field, kinds: d.kinds }))).toEqual([
      { surface: 'node', field: 'id', kinds: ['requirement', 'note'] },
      { surface: 'node', field: 'children', kinds: ['exposure'] },
      { surface: 'node', field: 'variant', kinds: ['exposure'] },
      { surface: 'port', field: 'plug', kinds: ['requirement'] },
      { surface: 'payload', field: 'path', kinds: ['exposure'] },
      { surface: 'payload', field: 'type', kinds: ['exposure'] },
      { surface: 'payload', field: 'sample_data', kinds: ['exposure'] },
      { surface: 'payload', field: 'allow_unknown_types', kinds: ['exposure'] }
    ]);
  });

  it('gives every reason enough text to be a reason', () => {
    for (const d of declaredDivergences()) {
      expect(d.why.length).toBeGreaterThan(60);
    }
  });

  it('declares the surface-level divergences too, each with a why', () => {
    expect(SURFACE_DIVERGENCES.length).toBeGreaterThanOrEqual(5);
    for (const d of SURFACE_DIVERGENCES) {
      expect(d.what.length).toBeGreaterThan(10);
      expect(d.why.length).toBeGreaterThan(60);
    }
  });
});

describe('AAQ-005 — no phantom fields', () => {
  const schemaPath = path.join(__dirname, '../../src/editor/src/schemas/nodes.schema.json');
  const nodesSchema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

  it('every node field the vocabulary offers exists in nodes.schema.json', () => {
    const stored = Object.keys(nodesSchema.definitions.node.properties);
    for (const field of AUTHORED_NODE_FIELDS) {
      // LEG-001 — a field whose authored name is not its storage name declares
      // where it goes, and the check follows the declaration to its root key.
      // `comment` is stored at `metadata.comment`, so `metadata` is what must
      // exist. An UNDECLARED name still has to be a stored property: this is the
      // `widthUnit` check, and "it is really somewhere else" is exactly the
      // excuse it must not accept without the field saying so.
      expect(stored).toContain(field.storedAs ? field.storedAs.split('.')[0] : field.name);
    }
  });

  it('maps comment onto the metadata bag rather than a stored top-level field', () => {
    const comment = AUTHORED_NODE_FIELDS.find((f) => f.name === 'comment')!;
    expect(comment.storedAs).toBe('metadata.comment');
    // Storage has no top-level `comment` and must not grow one: CAN-004's gutter
    // stripe, hover tooltip and context menu all read `metadata.comment`, so a
    // flat key on disk would be a comment nothing in the editor can see.
    expect(Object.keys(nodesSchema.definitions.node.properties)).not.toContain('comment');
  });

  it('every port field the vocabulary offers exists in the stored port definition', () => {
    const stored = Object.keys(nodesSchema.definitions.port.properties);
    for (const field of AUTHORED_PORT_FIELDS) {
      expect(stored).toContain(field.name);
    }
  });
});

describe('AAQ-005 — reading the table', () => {
  it('filters by client', () => {
    const editorNodes = fieldsFor(AUTHORED_NODE_FIELDS, 'editor').map((f) => f.name);
    const mcpNodes = fieldsFor(AUTHORED_NODE_FIELDS, 'mcp').map((f) => f.name);
    expect(editorNodes).toEqual(['id', 'type', 'label', 'comment', 'x', 'y', 'parent', 'parameters', 'ports']);
    expect(mcpNodes).toEqual([
      'id',
      'type',
      'label',
      // LEG-001 — shared, not diverged: both doors, same words, same position.
      'comment',
      'x',
      'y',
      'parent',
      'children',
      'parameters',
      'variant',
      'ports'
    ]);
  });

  it('reports required-ness per client', () => {
    const id = AUTHORED_NODE_FIELDS.find((f) => f.name === 'id')!;
    expect(isRequiredIn(id, 'editor')).toBe(true);
    expect(isRequiredIn(id, 'mcp')).toBe(false);
    const plug = AUTHORED_PORT_FIELDS.find((f) => f.name === 'plug')!;
    expect(isRequiredIn(plug, 'editor')).toBe(true);
    expect(isRequiredIn(plug, 'mcp')).toBe(false);
  });

  it('appends a client note to the shared description', () => {
    const id = AUTHORED_NODE_FIELDS.find((f) => f.name === 'id')!;
    expect(describeFor(id, 'editor')).toBe('Unique id you invent; required to wire connections or parent nodes');
    expect(describeFor(id, 'mcp')).toBe(
      'Unique id you invent; required to wire connections or parent nodes (Generated when omitted)'
    );
  });

  it('keeps the payload order each client already had', () => {
    expect(fieldsFor(AUTHORED_PAYLOAD_FIELDS, 'mcp').map((f) => f.name)).toEqual([
      'path',
      'type',
      'nodes',
      'connections',
      'visual_roots',
      'description',
      'allow_unknown_types'
    ]);
    expect(fieldsFor(AUTHORED_PAYLOAD_FIELDS, 'editor').map((f) => f.name)).toEqual([
      'nodes',
      'connections',
      'visual_roots',
      'description',
      'sample_data'
    ]);
  });
});
