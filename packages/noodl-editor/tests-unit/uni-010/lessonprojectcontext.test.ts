/**
 * UNI-010 — the file-backed lesson evaluation context.
 *
 * The property under test throughout is **fidelity**: a condition must get the
 * same answer here as it gets in the running editor. Every test in the first
 * block exists because a plausible shortcut would have broken that, and a broken
 * context does not produce a broken harness — it produces a harness that
 * confidently reports correct lessons as defective, which is worse than no
 * harness at all.
 */

import {
  ambiguousTypeSegments,
  buildLessonEvalContext,
  injectDecoys,
  staticallyEvaluable,
  unevaluableReason,
  walkNodes
} from '../../src/editor/src/models/lessonprojectcontext';
import type { LessonProjectComponentFiles } from '../../src/editor/src/models/lessonprojectcontext';
import { compileConditions } from '../../src/editor/src/models/lessonformat';
import type { LessonConditionDef } from '../../src/editor/src/models/lessonformat';
import { evalConditionsWithContext } from '../../src/editor/src/views/lessons/lessonevalconditions';
import type { LessonEvalContext } from '../../src/editor/src/views/lessons/lessonevalconditions';
import type { ConnectionV2, NodeV2 } from '../../src/editor/src/schemas';

// ─── Fixtures ───────────────────────────────────────────────────────────────

function componentFiles(args: {
  registryPath: string;
  /** The legacy name a condition's first path segment must match. */
  path: string;
  nodes: NodeV2[];
  connections?: ConnectionV2[];
}): LessonProjectComponentFiles {
  return {
    registryPath: args.registryPath,
    component: { id: `id-${args.registryPath}`, name: args.registryPath, path: args.path, type: 'visual' },
    nodes: { componentId: `id-${args.registryPath}`, nodes: args.nodes },
    connections: { componentId: `id-${args.registryPath}`, connections: args.connections ?? [] }
  };
}

/** A page with a Page root holding a Text and a Variable2, wired together. */
function homePage(): LessonProjectComponentFiles {
  return componentFiles({
    registryPath: '__page__/Home',
    // 🔴 Deliberately different from the registry path — this is the real shape
    // of this repo's own drive bundle, and the trap the context has to clear.
    path: '/#__page__/Home',
    nodes: [
      { id: 'page-1', type: 'Page', parameters: { title: 'Home' }, children: ['text-1', 'var-1'] },
      { id: 'text-1', type: 'Text', label: 'Greeting', parameters: { text: 'Hello' }, parent: 'page-1' },
      { id: 'var-1', type: 'Variable2', label: 'Counter', parameters: { name: 'count' }, parent: 'page-1' }
    ],
    connections: [{ fromId: 'var-1', fromProperty: 'value', toId: 'text-1', toProperty: 'text' }]
  });
}

function contextOf(components: LessonProjectComponentFiles[], extra: { rootNodeId?: string; metadata?: Record<string, unknown> } = {}) {
  return buildLessonEvalContext({ components, ...extra });
}

function holds(ctx: LessonEvalContext, ...defs: LessonConditionDef[]): boolean {
  return evalConditionsWithContext(compileConditions(defs, 'test'), ctx);
}

// ─── Fidelity ───────────────────────────────────────────────────────────────

describe('a component is named the way a condition names it', () => {
  it('resolves a path written against the legacy name, not the registry path', () => {
    const ctx = contextOf([homePage()]);

    expect(holds(ctx, { node: '/#__page__/Home:%Page:%Text', exists: true })).toBe(true);
  });

  it('does NOT resolve the registry path, because the editor would not either', () => {
    const ctx = contextOf([homePage()]);

    // Recorded as a property rather than an accident: if a future change makes
    // this pass, conditions have two spellings and the harness and the editor
    // have started disagreeing about which node a lesson means.
    expect(holds(ctx, { node: '__page__/Home:%Page:%Text', exists: true })).toBe(false);
  });
});

describe('ports come from the catalog, not only from the file', () => {
  it('finds a declared port that the stored node never serialised', () => {
    const ctx = contextOf([homePage()]);

    // `text` is Text's own input. Nothing in nodes.json lists it — a context
    // built from the file alone would report this false for every Text node
    // ever made, and the harness would call a correct lesson dead-on-solution.
    expect(holds(ctx, { node: '/#__page__/Home:%Page:%Text', hasPort: 'text' })).toBe(true);
  });

  it('still finds a port the instance declared and the catalog does not', () => {
    const ctx = contextOf([
      componentFiles({
        registryPath: 'App',
        path: '/App',
        nodes: [
          {
            id: 'fn-1',
            type: 'JavaScriptFunction',
            label: 'Adder',
            dynamicports: [{ name: 'addend', type: 'number', plug: 'input' }]
          }
        ]
      })
    ]);

    expect(holds(ctx, { node: '/App:#Adder', hasPort: 'addend' })).toBe(true);
  });
});

describe('the rest of the vocabulary', () => {
  it('reads labels, types, parameters and connections', () => {
    const ctx = contextOf([homePage()]);

    expect(holds(ctx, { node: '/#__page__/Home:%Page:#Greeting', hasType: 'Text' })).toBe(true);
    expect(holds(ctx, { node: '/#__page__/Home:%Page:#Greeting', hasLabel: 'Greeting' })).toBe(true);
    expect(holds(ctx, { node: '/#__page__/Home:%Page:#Counter', hasParams: ['name'] })).toBe(true);
    expect(holds(ctx, { node: '/#__page__/Home:%Page:#Counter', paramsEqual: { name: 'count' } })).toBe(true);
    expect(
      holds(ctx, {
        connection: {
          from: '/#__page__/Home:%Page:#Counter',
          to: '/#__page__/Home:%Page:#Greeting',
          fromPort: 'value',
          toPort: 'text'
        }
      })
    ).toBe(true);
  });

  it('resolves isVisualRoot from the project file rootNodeId', () => {
    const ctx = contextOf([homePage()], { rootNodeId: 'page-1' });

    expect(holds(ctx, { node: '/#__page__/Home:%Page', isVisualRoot: true })).toBe(true);
    expect(holds(ctx, { node: '/#__page__/Home:%Page:#Greeting', isVisualRoot: true })).toBe(false);
  });

  it('reads project metadata', () => {
    const ctx = contextOf([homePage()], { metadata: { appConfig: { runtime: 'react19' } } });

    expect(holds(ctx, { metadata: 'appConfig:runtime', equals: 'react19' })).toBe(true);
    expect(holds(ctx, { metadata: 'appConfig:runtime', equals: 'react18' })).toBe(false);
  });

  it('walks every node in the project', () => {
    expect(walkNodes(contextOf([homePage()]).components).map((n) => n.id)).toEqual(['page-1', 'text-1', 'var-1']);
  });
});

// ─── The honest boundary ────────────────────────────────────────────────────

describe('what a file-backed context refuses to answer', () => {
  it('names the two verbs that observe a running editor', () => {
    const [viewerPath] = compileConditions([{ previewRouteEquals: '/home' }], 'test');
    const [activeComponent] = compileConditions([{ activeComponentEquals: '/App' }], 'test');

    expect(staticallyEvaluable(viewerPath)).toBe(false);
    expect(staticallyEvaluable(activeComponent)).toBe(false);
    expect(unevaluableReason(viewerPath)).toMatch(/running editor/);
  });

  it('answers everything else', () => {
    const conditions = compileConditions(
      [
        { node: 'App:%Text', exists: true },
        { node: 'App:%Text', hasType: 'Text' },
        { node: 'App:%Text', hasLabel: 'x' },
        { node: 'App:%Text', hasPort: 'text' },
        { node: 'App:%Text', hasParams: ['text'] },
        { node: 'App:%Text', paramsEqual: { text: 'x' } },
        { node: 'App:%Text', isVisualRoot: true },
        { connection: { from: 'App:%Text', to: 'App:%Group', fromPort: 'a', toPort: 'b' } },
        { metadata: 'a:b', equals: 1 }
      ],
      'test'
    );

    // ⚠️ Wrapped rather than passed point-free. TUT-002 gave `staticallyEvaluable` a second
    // parameter (whether a database snapshot is in play), and `.every` would hand it the array
    // INDEX — which is harmless at runtime and exactly the sort of quiet mismatch that stops
    // being harmless the first time the option means something. TypeScript refuses it; the wrap
    // is the fix, not a cast.
    expect(conditions.every((condition) => staticallyEvaluable(condition))).toBe(true);
  });
});

// ─── Decoys ─────────────────────────────────────────────────────────────────

describe('decoy injection', () => {
  it('puts a decoy in front of the node a %Type segment resolves to', () => {
    const ctx = contextOf([homePage()]);
    const injections = injectDecoys(ctx.components, '/#__page__/Home:%Page:%Text');

    // One per `%Type` segment, and every one of them is a real risk: `%Page` is
    // type-only addressing too, and a lesson that adds a second Page breaks it
    // by exactly the same mechanism.
    expect(injections.map((i) => i.typeName)).toEqual(['Page', 'Text']);

    const textDecoy = injections[1];
    const page = textDecoy.components[0].graph.roots[0];
    expect(page.children.map((n) => n.id)).toEqual(['__decoy__', 'text-1', 'var-1']);

    const pageDecoy = injections[0];
    expect(pageDecoy.components[0].graph.roots.map((n) => n.id)).toEqual(['__decoy__', 'page-1']);
  });

  it('does not touch the original graph', () => {
    const ctx = contextOf([homePage()]);
    injectDecoys(ctx.components, '/#__page__/Home:%Page:%Text');

    expect(ctx.components[0].graph.roots.map((n) => n.id)).toEqual(['page-1']);
    expect(ctx.components[0].graph.roots[0].children.map((n) => n.id)).toEqual(['text-1', 'var-1']);
  });

  it('has nothing to inject for a path addressed only by label', () => {
    const ctx = contextOf([
      componentFiles({
        registryPath: 'App',
        path: '/App',
        nodes: [{ id: 'fn-1', type: 'JavaScriptFunction', label: 'Adder' }]
      })
    ]);

    // §3.2's binding recommendation, checked rather than restated: a `#label`
    // address cannot be made ambiguous by adding another node of the same type.
    expect(injectDecoys(ctx.components, '/App:#Adder')).toEqual([]);
  });

  it('has nothing to inject for a segment that matches nothing at all', () => {
    const ctx = contextOf([homePage()]);

    // Turning "no match" into "wrong match" would measure the harness, not the
    // lesson — and never matching is already F1's finding.
    expect(injectDecoys(ctx.components, '/#__page__/Home:%Repeater')).toEqual([]);
  });
});

describe('ambiguity already present in the solution', () => {
  it('reports a %Type segment with two candidates', () => {
    const twoTexts = componentFiles({
      registryPath: '__page__/Home',
      path: '/#__page__/Home',
      nodes: [
        { id: 'page-1', type: 'Page', children: ['text-1', 'text-2'] },
        { id: 'text-1', type: 'Text', label: 'A', parent: 'page-1' },
        { id: 'text-2', type: 'Text', label: 'B', parent: 'page-1' }
      ]
    });
    const ctx = contextOf([twoTexts]);

    expect(ambiguousTypeSegments(ctx.components, '/#__page__/Home:%Page:%Text')).toEqual(['%Text']);
    expect(ambiguousTypeSegments(ctx.components, '/#__page__/Home:%Page:#A')).toEqual([]);
  });

  it('says nothing when only one node of the type exists', () => {
    const ctx = contextOf([homePage()]);

    expect(ambiguousTypeSegments(ctx.components, '/#__page__/Home:%Page:%Text')).toEqual([]);
  });
});
