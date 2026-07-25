/**
 * LEARN-001 Slice 1 — unit tests for the typed, de-`eval`'d lesson completion
 * evaluator. These are the first tests the lessons subsystem has ever had.
 *
 * The evaluator reads editor state only through LessonEvalContext, so a plain
 * fake graph exercises every condition — including the "does not fire on a
 * near-miss" requirement from the task's testing plan.
 *
 * Jasmine provides describe/it/expect globally (see tests/models/index.ts).
 */

import {
  deepEqual,
  evalConditionsWithContext,
  evaluateSingleCondition,
  findNodeWithPath,
  LessonComponent,
  LessonConnection,
  LessonEvalContext,
  LessonNode,
  parseArrayValue
} from '../../src/editor/src/views/lessons/lessonevalconditions';

// ─── Fakes ──────────────────────────────────────────────────────────────────

interface FakeNodeArgs {
  id?: string;
  label?: string;
  type?: string;
  ports?: { name: string; type?: string | { name?: string } }[];
  parameters?: Record<string, unknown>;
  children?: LessonNode[];
  connections?: LessonConnection[];
}

function fakeNode(args: FakeNodeArgs): LessonNode {
  const ports = args.ports ?? [];
  const connections = args.connections ?? [];
  return {
    id: args.id ?? 'id',
    label: args.label ?? '',
    type: { name: args.type ?? 'Group' },
    ports,
    parameters: args.parameters ?? {},
    children: args.children ?? [],
    getPort(name, _filter) {
      return ports.find((p) => p.name.toLowerCase() === name.toLowerCase());
    },
    forAllConnectionsOnThisNode(callback) {
      connections.forEach(callback);
    }
  };
}

function ctxWith(components: LessonComponent[], overrides: Partial<LessonEvalContext> = {}): LessonEvalContext {
  return {
    components,
    rootNode: undefined,
    getMetaData: () => undefined,
    viewerPath: undefined,
    activeComponentName: undefined,
    ...overrides
  };
}

function componentWith(roots: LessonNode[], name = 'App'): LessonComponent {
  return { name, graph: { roots } };
}

// ─── parseArrayValue / deepEqual (the eval() replacement) ────────────────────

describe('parseArrayValue', () => {
  it('parses JSON arrays', () => {
    expect(parseArrayValue('[1, 2, 3]')).toEqual([1, 2, 3]);
  });

  it('leniently parses single-quoted / trailing-comma JS array literals', () => {
    expect(parseArrayValue("['a', 'b',]")).toEqual(['a', 'b']);
  });

  it('passes through non-string values unchanged', () => {
    const arr = [1, 2];
    expect(parseArrayValue(arr)).toBe(arr);
  });

  it('returns the raw string when it cannot parse', () => {
    expect(parseArrayValue('not-an-array')).toBe('not-an-array');
  });
});

describe('deepEqual', () => {
  it('compares arrays order-sensitively', () => {
    expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(deepEqual([1, 2, 3], [3, 2, 1])).toBe(false);
  });

  it('compares nested objects', () => {
    expect(deepEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true);
    expect(deepEqual({ a: { b: 1 } }, { a: { b: 2 } })).toBe(false);
  });

  it('is sensitive to differing key sets', () => {
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });
});

// ─── findNodeWithPath (path grammar) ─────────────────────────────────────────

describe('findNodeWithPath', () => {
  const child = fakeNode({ id: 'c1', label: 'Inner', type: 'Text' });
  const group = fakeNode({ id: 'g1', label: 'Outer', type: 'Group', children: [child] });
  const components = [componentWith([group], 'App')];

  it('resolves a node by #label', () => {
    expect(findNodeWithPath('App:#Outer', components)).toBe(group);
  });

  it('resolves a node by %type', () => {
    expect(findNodeWithPath('App:%Group', components)).toBe(group);
  });

  it('resolves a nested child through the path', () => {
    expect(findNodeWithPath('App:#Outer:#Inner', components)).toBe(child);
  });

  it('resolves by numeric child index', () => {
    expect(findNodeWithPath('App:0', components)).toBe(group);
  });

  it('is case-insensitive on component and segment names', () => {
    expect(findNodeWithPath('app:#outer', components)).toBe(group);
  });

  it('returns undefined for an unknown component', () => {
    expect(findNodeWithPath('Nope:#Outer', components)).toBeUndefined();
  });

  it('returns undefined for an unresolvable segment', () => {
    expect(findNodeWithPath('App:#DoesNotExist', components)).toBeUndefined();
  });
});

// ─── Per-condition evaluation ────────────────────────────────────────────────

describe('evaluateSingleCondition', () => {
  it('hastype matches (case-insensitive) and rejects near-misses', () => {
    const ctx = ctxWith([componentWith([fakeNode({ label: 'Card', type: 'Group' })])]);
    expect(evaluateSingleCondition({ path: 'App:#Card', hastype: 'group' }, ctx)).toBe(true);
    expect(evaluateSingleCondition({ path: 'App:#Card', hastype: 'Text' }, ctx)).toBe(false);
  });

  it('hasport checks a port exists on the node', () => {
    const ctx = ctxWith([componentWith([fakeNode({ label: 'N', ports: [{ name: 'width' }] })])]);
    expect(evaluateSingleCondition({ path: 'App:#N', hasport: 'width' }, ctx)).toBe(true);
    expect(evaluateSingleCondition({ path: 'App:#N', hasport: 'height' }, ctx)).toBe(false);
  });

  it('haslabel matches the node label', () => {
    const ctx = ctxWith([componentWith([fakeNode({ label: 'Header' })])]);
    expect(evaluateSingleCondition({ path: 'App:#Header', haslabel: 'header' }, ctx)).toBe(true);
    expect(evaluateSingleCondition({ path: 'App:#Header', haslabel: 'Footer' }, ctx)).toBe(false);
  });

  it('exists true/false reflect node presence', () => {
    const ctx = ctxWith([componentWith([fakeNode({ label: 'N' })])]);
    expect(evaluateSingleCondition({ path: 'App:#N', exists: true }, ctx)).toBe(true);
    expect(evaluateSingleCondition({ path: 'App:#Missing', exists: true }, ctx)).toBe(false);
    expect(evaluateSingleCondition({ path: 'App:#Missing', exists: false }, ctx)).toBe(true);
  });

  it('isvisualroot compares against the context root node', () => {
    const root = fakeNode({ label: 'Root' });
    const ctx = ctxWith([componentWith([root])], { rootNode: root });
    expect(evaluateSingleCondition({ path: 'App:#Root', isvisualroot: true }, ctx)).toBe(true);
    expect(evaluateSingleCondition({ path: 'App:#Root', isvisualroot: false }, ctx)).toBe(false);
  });

  it('hasparams requires all named parameters to be present', () => {
    const ctx = ctxWith([componentWith([fakeNode({ label: 'N', parameters: { width: 10, height: 20 } })])]);
    expect(evaluateSingleCondition({ path: 'App:#N', hasparams: 'width, height' }, ctx)).toBe(true);
    expect(evaluateSingleCondition({ path: 'App:#N', hasparams: 'width, color' }, ctx)).toBe(false);
  });

  it('paramseq compares scalar params case-insensitively', () => {
    const ctx = ctxWith([componentWith([fakeNode({ label: 'N', parameters: { align: 'Center' } })])]);
    expect(evaluateSingleCondition({ path: 'App:#N', paramseq: { align: 'center' } }, ctx)).toBe(true);
    expect(evaluateSingleCondition({ path: 'App:#N', paramseq: { align: 'left' } }, ctx)).toBe(false);
  });

  it('paramseq compares array-typed params structurally (no eval)', () => {
    const node = fakeNode({
      label: 'N',
      ports: [{ name: 'items', type: 'array' }],
      parameters: { items: '[1, 2, 3]' }
    });
    const ctx = ctxWith([componentWith([node])]);
    expect(evaluateSingleCondition({ path: 'App:#N', paramseq: { items: '[1,2,3]' } }, ctx)).toBe(true);
    expect(evaluateSingleCondition({ path: 'App:#N', paramseq: { items: '[3,2,1]' } }, ctx)).toBe(false);
  });

  it('paramseq treats stringlist params as order-independent', () => {
    const node = fakeNode({
      label: 'N',
      ports: [{ name: 'tags', type: 'stringlist' }],
      parameters: { tags: 'a,b,c' }
    });
    const ctx = ctxWith([componentWith([node])]);
    expect(evaluateSingleCondition({ path: 'App:#N', paramseq: { tags: 'c,b,a' } }, ctx)).toBe(true);
    expect(evaluateSingleCondition({ path: 'App:#N', paramseq: { tags: 'a,b' } }, ctx)).toBe(false);
  });

  it('paramseq matches object params by containment (isMatch)', () => {
    const node = fakeNode({ label: 'N', parameters: { style: { color: 'red', size: 12 } } });
    const ctx = ctxWith([componentWith([node])]);
    expect(evaluateSingleCondition({ path: 'App:#N', paramseq: { style: { color: 'red' } } }, ctx)).toBe(true);
    expect(evaluateSingleCondition({ path: 'App:#N', paramseq: { style: { color: 'blue' } } }, ctx)).toBe(false);
  });

  it('hasconnection detects a directed port-to-port connection', () => {
    const from = fakeNode({
      id: 'from',
      label: 'A',
      connections: [{ fromId: 'from', toId: 'to', fromProperty: 'output', toProperty: 'input' }]
    });
    const to = fakeNode({ id: 'to', label: 'B' });
    const ctx = ctxWith([componentWith([from, to])]);
    expect(
      evaluateSingleCondition({ from: 'App:#A', to: 'App:#B', hasconnection: 'output, input' }, ctx)
    ).toBe(true);
    // Near-miss: wrong target port.
    expect(
      evaluateSingleCondition({ from: 'App:#A', to: 'App:#B', hasconnection: 'output, other' }, ctx)
    ).toBe(false);
  });

  it('hasconnection throws when from/to are missing', () => {
    const ctx = ctxWith([componentWith([])]);
    expect(() => evaluateSingleCondition({ hasconnection: 'a,b' } as never, ctx)).toThrowError(/missing a 'to'/);
  });

  it('metadata compares a key:subkey against equals', () => {
    const ctx = ctxWith([componentWith([])], { getMetaData: (k) => (k === 'styles' ? { theme: 'dark' } : undefined) });
    expect(evaluateSingleCondition({ metadata: 'styles:theme', equals: 'dark' }, ctx)).toBe(true);
    expect(evaluateSingleCondition({ metadata: 'styles:theme', equals: 'light' }, ctx)).toBe(false);
  });

  it('viewerpatheq compares the current preview route', () => {
    const ctx = ctxWith([componentWith([])], { viewerPath: '/Home' });
    expect(evaluateSingleCondition({ viewerpatheq: '/Home' }, ctx)).toBe(true);
    expect(evaluateSingleCondition({ viewerpatheq: '/Other' }, ctx)).toBe(false);
  });

  it('activecomponentnameeq compares the open component', () => {
    const ctx = ctxWith([componentWith([])], { activeComponentName: '/Start Page' });
    expect(evaluateSingleCondition({ activecomponentnameeq: '/Start Page' }, ctx)).toBe(true);
    expect(evaluateSingleCondition({ activecomponentnameeq: '/Other' }, ctx)).toBe(false);
  });

  it('throws on an unknown condition', () => {
    const ctx = ctxWith([componentWith([])]);
    expect(() => evaluateSingleCondition({ bogus: true } as never, ctx)).toThrowError(/Unknown lesson condition/);
  });
});

// ─── AND semantics ───────────────────────────────────────────────────────────

describe('evalConditionsWithContext', () => {
  const node = fakeNode({ label: 'Card', type: 'Group', parameters: { align: 'center' } });
  const ctx = ctxWith([componentWith([node])]);

  it('completes only when every condition holds', () => {
    expect(
      evalConditionsWithContext(
        [
          { path: 'App:#Card', hastype: 'Group' },
          { path: 'App:#Card', paramseq: { align: 'center' } }
        ],
        ctx
      )
    ).toBe(true);
  });

  it('does not fire on a near-miss (one condition failing)', () => {
    expect(
      evalConditionsWithContext(
        [
          { path: 'App:#Card', hastype: 'Group' },
          { path: 'App:#Card', paramseq: { align: 'left' } }
        ],
        ctx
      )
    ).toBe(false);
  });

  it('an empty condition list is vacuously complete', () => {
    expect(evalConditionsWithContext([], ctx)).toBe(true);
  });
});
