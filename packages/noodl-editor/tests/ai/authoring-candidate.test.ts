/**
 * AIX-002 — candidate builder: agent payload → v2 files.
 *
 * The shape problems an LLM actually produces (duplicate ids, orphan parents,
 * cycles) must come back as actionable strings, and a clean payload must come
 * back as schema-valid files with hierarchy derived from `parent` alone.
 */

import { buildCandidate, pathToLegacyName } from '../../src/editor/src/models/AiAssistant/authoring/candidate';
import type { AuthoringRequest, SubmitPayload } from '../../src/editor/src/models/AiAssistant/authoring/types';

const REQUEST: AuthoringRequest = {
  description: 'a test component',
  componentPath: 'Pages/Customers'
};

function payload(overrides: Partial<SubmitPayload> = {}): SubmitPayload {
  return {
    nodes: [
      { id: 'root', type: 'Group', label: 'Page root' },
      { id: 'title', type: 'Text', parent: 'root', parameters: { text: 'Customers' } },
      { id: 'list', type: 'Group', parent: 'root' }
    ],
    ...overrides
  };
}

describe('AIX-002 candidate builder', () => {
  it('maps a path to the legacy name component references use', () => {
    expect(pathToLegacyName('Pages/Customers')).toBe('/Pages/Customers');
    expect(pathToLegacyName('/Pages/Customers')).toBe('/Pages/Customers');
  });

  it('builds the three v2 files with a shared componentId', () => {
    const result = buildCandidate(REQUEST, payload());
    expect(result.errors).toEqual([]);
    const files = result.files!;
    expect(files.component.id).toBeTruthy();
    expect(files.nodes.componentId).toBe(files.component.id);
    expect(files.connections.componentId).toBe(files.component.id);
    expect(files.component.path).toBe('/Pages/Customers');
    expect(files.component.name).toBe('Customers');
  });

  it('infers the component type from the path', () => {
    expect(buildCandidate(REQUEST, payload()).files!.component.type).toBe('page');
    expect(
      buildCandidate({ ...REQUEST, componentPath: 'Widgets/Card' }, payload()).files!.component.type
    ).toBe('visual');
    expect(buildCandidate({ ...REQUEST, componentType: 'logic' }, payload()).files!.component.type).toBe('logic');
  });

  it('derives children arrays from parent fields, in submission order', () => {
    const files = buildCandidate(REQUEST, payload()).files!;
    const root = files.nodes.nodes.find((n) => n.id === 'root')!;
    expect(root.children).toEqual(['title', 'list']);
    // Children never carry their own (empty) children arrays.
    const title = files.nodes.nodes.find((n) => n.id === 'title')!;
    expect(title.children).toBeUndefined();
    expect(title.parent).toBe('root');
  });

  it('generates ids for nodes that omit them', () => {
    const files = buildCandidate(REQUEST, payload({ nodes: [{ type: 'Group' }, { type: 'Group' }] })).files!;
    const [a, b] = files.nodes.nodes;
    expect(a.id).toBeTruthy();
    expect(b.id).toBeTruthy();
    expect(a.id).not.toBe(b.id);
  });

  it('rejects duplicate ids, unknown parents, and parent cycles with actionable messages', () => {
    const duplicate = buildCandidate(REQUEST, payload({ nodes: [{ id: 'x', type: 'Group' }, { id: 'x', type: 'Text' }] }));
    expect(duplicate.files).toBeUndefined();
    expect(duplicate.errors.join('\n')).toContain('Duplicate node id "x"');

    const orphan = buildCandidate(REQUEST, payload({ nodes: [{ id: 'a', type: 'Text', parent: 'ghost' }] }));
    expect(orphan.errors.join('\n')).toContain('parent "ghost"');

    const cycle = buildCandidate(
      REQUEST,
      payload({
        nodes: [
          { id: 'a', type: 'Group', parent: 'b' },
          { id: 'b', type: 'Group', parent: 'a' }
        ]
      })
    );
    expect(cycle.errors.join('\n')).toContain('cycle');
  });

  it('rejects an empty submission and an unknown visual root', () => {
    expect(buildCandidate(REQUEST, { nodes: [] }).errors.join('\n')).toContain('no nodes');
    const badRoot = buildCandidate(REQUEST, payload({ visualRoots: ['nope'] }));
    expect(badRoot.errors.join('\n')).toContain('visualRoots');
  });

  it('passes visual roots and description through', () => {
    const files = buildCandidate(REQUEST, payload({ visualRoots: ['root'], description: 'Lists customers' })).files!;
    expect(files.nodes.visualRoots).toEqual(['root']);
    expect(files.component.description).toBe('Lists customers');
  });
});

describe('AIX-002 candidate builder — update mode', () => {
  /** The component as it exists today: the base an update candidate starts from. */
  function baseFiles(): NonNullable<ReturnType<typeof buildCandidate>['files']> {
    const files = buildCandidate(REQUEST, payload({ description: 'The original.' }), '2026-01-01T00:00:00.000Z').files!;
    // Hand-tuned work the submit contract cannot express — exactly what an
    // update must not eat.
    const title = files.nodes.nodes.find((n) => n.id === 'title')!;
    title.variant = 'Headline';
    title.stateParameters = { hover: { color: 'red' } };
    files.nodes.comments = [{ text: 'keep me', x: 0, y: 0 }] as never;
    return files;
  }

  it('keeps the base component identity — id, created, metadata — and stamps the revision', () => {
    const base = baseFiles();
    const result = buildCandidate(REQUEST, payload(), '2026-02-02T00:00:00.000Z', base);
    expect(result.errors).toEqual([]);
    const files = result.files!;
    expect(files.component.id).toBe(base.component.id);
    expect(files.component.created).toBe(base.component.created);
    expect(files.component.path).toBe(base.component.path);
    expect(files.component.modified).toBe('2026-02-02T00:00:00.000Z');
    expect(files.component.modifiedBy).toBe('ai-authoring');
    // Unchanged unless the payload says otherwise.
    expect(files.component.description).toBe('The original.');
    expect(files.nodes.componentId).toBe(base.component.id);
    expect(files.connections.componentId).toBe(base.component.id);
  });

  it('carries inexpressible node fields over for kept nodes, and canvas comments verbatim', () => {
    const base = baseFiles();
    const result = buildCandidate(REQUEST, payload(), undefined, base);
    const title = result.files!.nodes.nodes.find((n) => n.id === 'title')!;
    expect(title.variant).toBe('Headline');
    expect(title.stateParameters).toEqual({ hover: { color: 'red' } });
    // A copy, not a shared reference into the base.
    expect(title.stateParameters).not.toBe(base.nodes.nodes.find((n) => n.id === 'title')!.stateParameters);
    expect(result.files!.nodes.comments).toEqual(base.nodes.comments);
  });

  it('does not carry fields onto a node whose type changed or whose id is new', () => {
    const base = baseFiles();
    const changed = buildCandidate(
      REQUEST,
      payload({
        nodes: [
          { id: 'root', type: 'Group' },
          // Same id, different type: the base node's tuning does not apply.
          { id: 'title', type: 'Group', parent: 'root' },
          // New id: nothing to carry.
          { id: 'title2', type: 'Text', parent: 'root' }
        ]
      }),
      undefined,
      base
    );
    const title = changed.files!.nodes.nodes.find((n) => n.id === 'title')!;
    const title2 = changed.files!.nodes.nodes.find((n) => n.id === 'title2')!;
    expect(title.variant).toBeUndefined();
    expect(title.stateParameters).toBeUndefined();
    expect(title2.variant).toBeUndefined();
  });

  it('lets the agent own what it can express — submitted parameters and ports are not overridden', () => {
    const base = baseFiles();
    const result = buildCandidate(
      REQUEST,
      payload({
        nodes: [
          { id: 'root', type: 'Group' },
          { id: 'title', type: 'Text', parent: 'root', parameters: { text: 'Revised' } },
          { id: 'list', type: 'Group', parent: 'root' }
        ]
      }),
      undefined,
      base
    );
    const title = result.files!.nodes.nodes.find((n) => n.id === 'title')!;
    expect(title.parameters).toEqual({ text: 'Revised' });
    // Carryover still applies alongside.
    expect(title.variant).toBe('Headline');
  });
});

/**
 * Phase-15 close-out — malformed submissions must be *rejected*, never thrown.
 *
 * Found by the first live run of update mode: `claude-sonnet-5` submitted
 * `nodes` as a JSON **string** rather than an array, and
 * `(payload.nodes ?? []).map(…)` threw a `TypeError` straight out of the
 * authoring session — losing every turn the user had already paid for, on a
 * mistake the model corrects immediately when told. `SubmitPayload` types these
 * fields as arrays, but it is built by an unchecked cast over tool arguments the
 * model wrote, so the type is a claim about what should arrive rather than about
 * what does.
 */
describe('AIX-002 candidate builder — malformed array fields', () => {
  const badShapes: [string, unknown, string][] = [
    ['a JSON string', '[{"id":"root","type":"Group"}]', 'string'],
    ['an object', { 0: { id: 'root', type: 'Group' } }, 'object'],
    ['a number', 3, 'number']
  ];

  for (const [label, value, typeWord] of badShapes) {
    it(`rejects nodes submitted as ${label} instead of throwing`, () => {
      const result = buildCandidate(REQUEST, { nodes: value } as unknown as SubmitPayload);
      expect(result.files).toBeUndefined();
      expect(result.errors).toEqual([`submit_component: \`nodes\` must be an array — got ${typeWord}.`]);
    });
  }

  it('rejects connections submitted as a string', () => {
    const result = buildCandidate(REQUEST, payload({ connections: '[]' as never }));
    expect(result.files).toBeUndefined();
    expect(result.errors).toEqual(['submit_component: `connections` must be an array — got string.']);
  });

  it('rejects visual_roots submitted as a single string', () => {
    const result = buildCandidate(REQUEST, payload({ visualRoots: 'root' as never }));
    expect(result.files).toBeUndefined();
    expect(result.errors).toEqual(['submit_component: `visual_roots` must be an array — got string.']);
  });

  it("rejects a node whose ports are not an array — they are mapped further down", () => {
    const result = buildCandidate(
      REQUEST,
      payload({
        nodes: [{ id: 'root', type: 'Group', ports: { name: 'Label' } as never }]
      })
    );
    expect(result.files).toBeUndefined();
    expect(result.errors).toEqual(['Node "root": `ports` must be an array — got object.']);
  });

  it('still accepts the fields when they are genuinely absent', () => {
    const result = buildCandidate(REQUEST, { nodes: [{ id: 'root', type: 'Group' }] });
    expect(result.errors).toEqual([]);
    expect(result.files!.connections.connections).toEqual([]);
  });
});
