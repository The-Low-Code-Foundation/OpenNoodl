/**
 * AAQ-005 — the drift detector for the one authoring vocabulary.
 *
 * `gateParity.test.ts` proves the two clients *judge* a candidate the same way.
 * This proves they *describe* one the same way — the surface an agent actually
 * reads before it writes anything.
 *
 * The two schemas cannot be the same object: the editor renders JSON Schema for
 * `submit_component`, this package renders zod for `create_component`, and
 * `noodl-editor` has no zod dependency to share. So the *declaration* is shared
 * (`validation/authoringVocabulary`) and each client keeps a renderer. This spec
 * reads both renderings back and fails when they disagree about a field that is
 * not on the declared divergence list.
 *
 * ⚠️ It reads the schemas this package **registers**, not a reconstruction of
 * them: `CREATE_COMPONENT_SHAPE` is the value passed to `registerTool`. A parity
 * spec over a copy of the surface proves nothing about the surface.
 */

import { z } from 'zod';

import {
  AUTHORED_CONNECTION_FIELDS,
  AUTHORED_NODE_FIELDS,
  AUTHORED_PAYLOAD_FIELDS,
  AUTHORED_PORT_FIELDS,
  declaredDivergences,
  describeFor,
  fieldsFor,
  isRequiredIn,
  jsonSchemasFor
} from '../src/editor-deps';
import type { VocabField } from '../src/editor-deps';
import { CREATE_COMPONENT_SHAPE, connectionSchema, nodeSchema, portSchema } from '../src/vocabulary';

// ── zod introspection ─────────────────────────────────────────────────────────

function unwrap(schema: z.ZodTypeAny): z.ZodTypeAny {
  return schema instanceof z.ZodOptional ? (schema.unwrap() as z.ZodTypeAny) : schema;
}

function enumValuesOf(schema: z.ZodTypeAny): string[] | undefined {
  const inner = unwrap(schema);
  return inner instanceof z.ZodEnum ? [...(inner.options as string[])] : undefined;
}

function minItemsOf(schema: z.ZodTypeAny): number | undefined {
  const inner = unwrap(schema);
  return inner instanceof z.ZodArray ? (inner._def.minLength?.value as number | undefined) : undefined;
}

/** Every assertion this spec makes about one rendered zod field. */
function expectFieldMatchesTable(schema: z.ZodTypeAny, field: VocabField, where: string): void {
  const required = isRequiredIn(field, 'mcp');
  expect({ where, field: field.name, optional: schema.isOptional() }).toEqual({
    where,
    field: field.name,
    optional: !required
  });
  expect({ where, field: field.name, description: schema.description }).toEqual({
    where,
    field: field.name,
    description: describeFor(field, 'mcp')
  });
  if (field.enumValues) expect(enumValuesOf(schema)).toEqual([...field.enumValues]);
  if (field.minItems !== undefined) expect(minItemsOf(schema)).toBe(field.minItems);
}

describe('AAQ-005 — the MCP schemas are the table, read back', () => {
  const cases: Array<{ where: string; shape: Record<string, z.ZodTypeAny>; fields: readonly VocabField[] }> = [
    { where: 'node', shape: nodeSchema.shape as Record<string, z.ZodTypeAny>, fields: AUTHORED_NODE_FIELDS },
    { where: 'port', shape: portSchema.shape as Record<string, z.ZodTypeAny>, fields: AUTHORED_PORT_FIELDS },
    {
      where: 'connection',
      shape: connectionSchema.shape as Record<string, z.ZodTypeAny>,
      fields: AUTHORED_CONNECTION_FIELDS
    },
    {
      where: 'create_component',
      shape: CREATE_COMPONENT_SHAPE as unknown as Record<string, z.ZodTypeAny>,
      fields: AUTHORED_PAYLOAD_FIELDS
    }
  ];

  for (const { where, shape, fields } of cases) {
    it(`${where}: exposes exactly the fields the table gives this client, in order`, () => {
      expect(Object.keys(shape)).toEqual(fieldsFor(fields, 'mcp').map((f) => f.name));
    });

    it(`${where}: every field matches the table on optionality, description and enum members`, () => {
      for (const field of fieldsFor(fields, 'mcp')) {
        expectFieldMatchesTable(shape[field.name], field, where);
      }
    });
  }
});

describe('AAQ-005 — the two clients describe a shared field identically', () => {
  const editor = jsonSchemasFor('editor');

  /**
   * The detector proper. Before this slice these strings were written twice and
   * differed on `type`, `parent`, `parameters` and `ports` — and `plug` was not
   * declared on this side at all, which is the one that had a consequence
   * (`getPorts` filters on it, so a port without one is inert).
   */
  const surfaces = [
    { name: 'node', fields: AUTHORED_NODE_FIELDS, json: editor.node, zodShape: nodeSchema.shape },
    { name: 'port', fields: AUTHORED_PORT_FIELDS, json: editor.port, zodShape: portSchema.shape },
    {
      name: 'connection',
      fields: AUTHORED_CONNECTION_FIELDS,
      json: editor.connection,
      zodShape: connectionSchema.shape
    },
    {
      name: 'payload',
      fields: AUTHORED_PAYLOAD_FIELDS,
      json: editor.payload,
      zodShape: CREATE_COMPONENT_SHAPE as unknown as Record<string, z.ZodTypeAny>
    }
  ];

  for (const surface of surfaces) {
    it(`${surface.name}: shared fields carry the same description on both doors`, () => {
      const shared = surface.fields.filter((f) => !f.exposedTo);
      expect(shared.length).toBeGreaterThan(0);
      for (const field of shared) {
        const fromJson = (surface.json.properties ?? {})[field.name]?.description;
        const fromZod = (surface.zodShape as Record<string, z.ZodTypeAny>)[field.name]?.description;
        // Per-client notes are a declared divergence; compare the shared sentence.
        const note = field.clientNotes?.mcp;
        expect({ field: field.name, text: fromZod }).toEqual({
          field: field.name,
          text: note && fromJson ? `${fromJson} (${note})` : note ?? fromJson
        });
      }
    });

    it(`${surface.name}: a field missing from one door is on the declared list`, () => {
      const jsonKeys = Object.keys(surface.json.properties ?? {});
      const zodKeys = Object.keys(surface.zodShape as Record<string, z.ZodTypeAny>);
      const onlyEditor = jsonKeys.filter((k) => !zodKeys.includes(k));
      const onlyMcp = zodKeys.filter((k) => !jsonKeys.includes(k));
      const declared = declaredDivergences()
        .filter((d) => d.kinds.includes('exposure'))
        .map((d) => d.field);
      for (const name of [...onlyEditor, ...onlyMcp]) expect(declared).toContain(name);
    });
  }

  it('the fields required in one door only are the declared ones', () => {
    const declared = declaredDivergences()
      .filter((d) => d.kinds.includes('requirement'))
      .map((d) => `${d.surface}.${d.field}`);
    const found: string[] = [];
    for (const surface of surfaces) {
      for (const field of surface.fields) {
        if (field.exposedTo) continue;
        const requiredInJson = (surface.json.required ?? []).includes(field.name);
        const requiredInZod = !(surface.zodShape as Record<string, z.ZodTypeAny>)[field.name].isOptional();
        if (requiredInJson !== requiredInZod) found.push(`${surface.name}.${field.name}`);
      }
    }
    expect(found.sort()).toEqual(declared.sort());
  });
});

describe('AAQ-005 — the behaviours the renderer had to preserve', () => {
  it('declares plug on an instance port — the field that decides the port exists', () => {
    // Before AAQ-005 this package's port schema was `{ name }` with
    // `.passthrough()`: an external agent was never told `plug` existed, and
    // `NodeGraphNode.getPorts(filter)` selects on it, so a Component Inputs node
    // authored without one yields a component with no such input. Nothing checks
    // it yet — AAQ-011 F15.
    expect(Object.keys(portSchema.shape)).toContain('plug');
    expect(enumValuesOf((portSchema.shape as Record<string, z.ZodTypeAny>).plug)).toEqual(['input', 'output']);
    expect(portSchema.parse({ name: 'Title', plug: 'output' })).toEqual({ name: 'Title', plug: 'output' });
  });

  it('keeps plug optional here, because zod rejects rather than instructs', () => {
    // The editor's schema is prompt text; this one runs before the handler. A
    // required `plug` would hard-reject calls that are accepted today.
    expect(() => portSchema.parse({ name: 'Title' })).not.toThrow();
  });

  it('passes unknown node fields through, so a read-modify-write cannot eat them', () => {
    const parsed = nodeSchema.parse({
      id: 'n1',
      type: 'Group',
      stateParameters: { hover: { backgroundColor: 'var(--color-primary)' } },
      metadata: { note: 'kept' }
    }) as Record<string, unknown>;
    expect(parsed.stateParameters).toEqual({ hover: { backgroundColor: 'var(--color-primary)' } });
    expect(parsed.metadata).toEqual({ note: 'kept' });
  });

  it('does not pass unknown connection fields through', () => {
    const parsed = connectionSchema.parse({
      fromId: 'a',
      fromProperty: 'out',
      toId: 'b',
      toProperty: 'in',
      nonsense: 1
    }) as Record<string, unknown>;
    expect(parsed.nonsense).toBeUndefined();
  });

  it('still requires a component path and at least one node', () => {
    const shape = CREATE_COMPONENT_SHAPE as unknown as Record<string, z.ZodTypeAny>;
    expect(shape.path.isOptional()).toBe(false);
    expect(minItemsOf(shape.nodes)).toBe(1);
    expect(() => z.object({ nodes: shape.nodes }).parse({ nodes: [] })).toThrow();
  });

  it('offers no sample_data on this door', () => {
    // AIX-008's preview sample data is never written; this package has no
    // preview sandbox, so the field would ask for output nothing consumes.
    expect(Object.keys(CREATE_COMPONENT_SHAPE)).not.toContain('sample_data');
  });
});
