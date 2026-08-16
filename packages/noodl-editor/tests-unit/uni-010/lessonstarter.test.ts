/**
 * UNI-010 — `derive_starter`: the starter built by subtracting the lesson's own
 * steps from its solution.
 *
 * 🔴 **The finding this is graded against is a control pair, so the specs are
 * written as one.** The claim is not "subtraction produces a starter" — that is
 * trivially true of any subtraction, including one that removes everything or
 * nothing. It is:
 *
 * > a solution and the starter derived from it **differ in exactly whether each
 * > graded step is already done**, and the derivation *measures* that rather than
 * > assuming it.
 *
 * So every block below has both arms. The `solution` arm asserts the step holds
 * (otherwise the "it no longer holds" arm is a pass over a mechanism that was
 * never there — the failure mode this arc named in slice 4: *a failure that would
 * look identical if the mechanism were missing measures nothing*). The `starter`
 * arm asserts it does not, **and** asserts what else survived, because a
 * subtraction that emptied the project would also pass the first assertion.
 */

import { deriveLessonStarter, danglingReferences } from '../../src/editor/src/models/lessonstarter';
import { buildLessonEvalContext } from '../../src/editor/src/models/lessonprojectcontext';
import type {
  LessonProjectComponentFiles,
  LessonProjectSource
} from '../../src/editor/src/models/lessonprojectcontext';
import { compileConditions } from '../../src/editor/src/models/lessonformat';
import type { LessonManifest } from '../../src/editor/src/models/lessonformat';
import { evalConditionsWithContext } from '../../src/editor/src/views/lessons/lessonevalconditions';
import type { ConnectionV2, NodeV2 } from '../../src/editor/src/schemas';

// ─── Fixtures ───────────────────────────────────────────────────────────────

function component(
  registryPath: string,
  legacyName: string,
  nodes: NodeV2[],
  connections: ConnectionV2[] = []
): LessonProjectComponentFiles {
  return {
    registryPath,
    component: { id: registryPath, name: registryPath.split('/').pop() as string, path: legacyName, type: 'visual' },
    nodes: { componentId: registryPath, nodes, visualRoots: nodes.length ? [nodes[0].id] : [] },
    connections: { componentId: registryPath, connections }
  };
}

const HOME = '/#__page__/Home';
const ABOUT = '/#__page__/About';

/**
 * The solution: a home page with a labelled, filled-in Text and a Button wired to
 * a Counter; an About page; and an App component whose Router lists both.
 *
 * Deliberately more than any one test needs — the interesting assertion in almost
 * every block is what *survived*, and a two-node fixture cannot distinguish
 * "removed the right thing" from "removed everything".
 */
function solutionSource(): LessonProjectSource {
  return {
    rootNodeId: 'router-1',
    metadata: { lessonPrefs: { tourDone: true } },
    components: [
      component('App', '/App', [
        {
          id: 'router-1',
          type: 'Router',
          label: 'Main',
          parameters: { pages: { startPage: HOME, routes: [HOME, ABOUT] } },
          children: []
        }
      ]),
      component(
        '__page__/Home',
        HOME,
        [
          { id: 'page-1', type: 'Page', children: ['text-1', 'button-1', 'counter-1'] },
          { id: 'text-1', type: 'Text', label: 'Greeting', parameters: { text: 'Hello' }, parent: 'page-1' },
          { id: 'button-1', type: 'Button', label: 'Add', parameters: { label: 'Add one' }, parent: 'page-1' },
          { id: 'counter-1', type: 'Counter', label: 'Counter', parent: 'page-1' }
        ],
        [{ fromId: 'button-1', fromProperty: 'click', toId: 'counter-1', toProperty: 'increment' }]
      ),
      component('__page__/About', ABOUT, [
        { id: 'page-2', type: 'Page', children: ['about-text'] },
        { id: 'about-text', type: 'Text', label: 'Blurb', parameters: { text: 'About us' }, parent: 'page-2' }
      ])
    ]
  };
}

/** Does this step's conditions hold against this project? The real evaluator. */
function stepHolds(source: LessonProjectSource, manifest: LessonManifest, stepIndex: number): boolean {
  const step = manifest.steps[stepIndex];
  const compiled = compileConditions(step.completeWhen, `step ${stepIndex}`);
  return evalConditionsWithContext(compiled, buildLessonEvalContext(source));
}

function lesson(...completeWhen: LessonManifest['steps'][number]['completeWhen'][]): LessonManifest {
  return {
    format: 'noodl-lesson@1',
    title: 'A lesson',
    steps: completeWhen.map((c, i) => ({ title: `Step ${i + 1}`, body: 'Do the thing.', completeWhen: c }))
  };
}

// ─── The verb decides the granularity ───────────────────────────────────────

describe('the condition verb decides what is subtracted', () => {
  it('hasType removes the node — and leaves its siblings alone', () => {
    const solution = solutionSource();
    const manifest = lesson([{ node: `${HOME}:%Page:#Greeting`, hasType: 'Text' }]);

    // The arm that makes the other arm mean something.
    expect(stepHolds(solution, manifest, 0)).toBe(true);

    const result = deriveLessonStarter(solution, manifest);
    expect(result.ok).toBe(true);
    expect(stepHolds(result.starter as LessonProjectSource, manifest, 0)).toBe(false);

    // ...and it removed THAT node, not the page it sits on and not its siblings.
    const home = (result.starter as LessonProjectSource).components.find((c) => c.registryPath === '__page__/Home');
    expect(home?.nodes.nodes.map((n) => n.id).sort()).toEqual(['button-1', 'counter-1', 'page-1']);
    expect(home?.nodes.nodes.find((n) => n.id === 'page-1')?.children).toEqual(['button-1', 'counter-1']);
  });

  it('paramsEqual keeps the node and unsets only the parameters it names', () => {
    const solution = solutionSource();
    const manifest = lesson([{ node: `${HOME}:%Page:#Greeting`, paramsEqual: { text: 'Hello' } }]);

    expect(stepHolds(solution, manifest, 0)).toBe(true);

    const result = deriveLessonStarter(solution, manifest);
    expect(result.ok).toBe(true);
    expect(stepHolds(result.starter as LessonProjectSource, manifest, 0)).toBe(false);

    // 🔴 The node is still there. This is the whole difference between "add a
    // Text" and "type into the Text that is there", and it is decided by the verb.
    const home = (result.starter as LessonProjectSource).components.find((c) => c.registryPath === '__page__/Home');
    const text = home?.nodes.nodes.find((n) => n.id === 'text-1');
    expect(text).toBeDefined();
    expect(text?.label).toBe('Greeting');
    expect(text?.parameters).toEqual({});
    expect(result.retractions.map((r) => r.kind)).toEqual(['clear-params']);
  });

  it('hasParams unsets the named parameters and leaves the others set', () => {
    const solution = solutionSource();
    const manifest = lesson([{ node: `${HOME}:%Page:#Add`, hasParams: ['label'] }]);

    expect(stepHolds(solution, manifest, 0)).toBe(true);

    const result = deriveLessonStarter(solution, manifest);
    expect(result.ok).toBe(true);
    expect(stepHolds(result.starter as LessonProjectSource, manifest, 0)).toBe(false);

    const home = (result.starter as LessonProjectSource).components.find((c) => c.registryPath === '__page__/Home');
    expect(home?.nodes.nodes.find((n) => n.id === 'button-1')?.parameters).toEqual({});
  });

  it('a connection condition removes the wire and keeps both nodes', () => {
    const solution = solutionSource();
    const manifest = lesson([
      {
        connection: {
          from: `${HOME}:%Page:#Add`,
          to: `${HOME}:%Page:#Counter`,
          fromPort: 'click',
          toPort: 'increment'
        }
      }
    ]);

    expect(stepHolds(solution, manifest, 0)).toBe(true);

    const result = deriveLessonStarter(solution, manifest);
    expect(result.ok).toBe(true);
    expect(stepHolds(result.starter as LessonProjectSource, manifest, 0)).toBe(false);

    const home = (result.starter as LessonProjectSource).components.find((c) => c.registryPath === '__page__/Home');
    expect(home?.connections.connections).toEqual([]);
    // Both ends survive: the lesson is about the wire, not about the nodes.
    expect(home?.nodes.nodes.map((n) => n.id)).toContain('button-1');
    expect(home?.nodes.nodes.map((n) => n.id)).toContain('counter-1');
  });

  it('routerLists un-lists the page and leaves the page component intact', () => {
    const solution = solutionSource();
    const manifest = lesson([{ routerLists: ABOUT }]);

    expect(stepHolds(solution, manifest, 0)).toBe(true);

    const result = deriveLessonStarter(solution, manifest);
    expect(result.ok).toBe(true);
    expect(stepHolds(result.starter as LessonProjectSource, manifest, 0)).toBe(false);

    const starter = result.starter as LessonProjectSource;
    const router = starter.components[0].nodes.nodes[0];
    expect(router.parameters?.pages).toEqual({ startPage: HOME, routes: [HOME] });
    // 🔴 The About component is still there. The step is about reachability, and
    // a subtraction that deleted the page would teach a different lesson.
    expect(starter.components.some((c) => c.registryPath === '__page__/About')).toBe(true);
  });

  it('a metadata condition unsets that key and no other', () => {
    const solution = solutionSource();
    const manifest = lesson([{ metadata: 'lessonPrefs:tourDone', equals: true }]);

    expect(stepHolds(solution, manifest, 0)).toBe(true);

    const result = deriveLessonStarter(solution, manifest);
    expect(result.ok).toBe(true);
    expect(stepHolds(result.starter as LessonProjectSource, manifest, 0)).toBe(false);
    expect((result.starter as LessonProjectSource).metadata).toEqual({ lessonPrefs: {} });
  });
});

// ─── The postcondition is measured, not assumed ─────────────────────────────

describe('the postcondition', () => {
  it('refuses when a step survives the subtraction, and names why it could not be undone', () => {
    const solution = solutionSource();
    // `isVisualRoot` is the one node verb that is deliberately not retractable:
    // clearing the project's root leaves a starter that renders nothing at all.
    const manifest = lesson([{ node: '/App:%Router', isVisualRoot: true }]);

    expect(stepHolds(solution, manifest, 0)).toBe(true);

    const result = deriveLessonStarter(solution, manifest);
    expect(result.ok).toBe(false);
    expect(result.starter).toBeUndefined();
    expect(result.stillSatisfied).toEqual([{ step: 0, where: 'Step 1 ("Step 1")' }]);
    // Graded by what the refusal wrote — the phase-64 rule.
    expect(result.refusal).toContain('already ticked');
    expect(result.refusal).toContain('cannot render at all');
  });

  it('refuses a lesson whose starter would be its solution — the ghostwriting case, end to end', () => {
    const solution = solutionSource();
    // Every condition is unretractable, so nothing is subtracted at all and the
    // derived starter IS the solution. This is the shape the criterion-3 run
    // predicted a model building two projects independently would produce.
    const manifest = lesson([{ node: '/App:%Router', isVisualRoot: true }], [{ node: '/App:%Router', isVisualRoot: true }]);

    const result = deriveLessonStarter(solution, manifest);
    expect(result.ok).toBe(false);
    expect(result.stillSatisfied.map((s) => s.step)).toEqual([0, 1]);

    // 🔴 The refusal is asserted by its REASON, not by its existence. This spec
    // was dead when first written: a control run with the retraction branch
    // disabled left every step satisfied and every assertion above still green,
    // because "refused" is what a missing mechanism looks like too. Slice 4 found
    // the identical defect in its own F2 specs — *a failure indistinguishable
    // from a missing mechanism measures nothing.*
    expect(result.retractions).toHaveLength(2);
    for (const r of result.retractions) {
      expect(r.kind).toBe('unsupported');
      expect(r.detail).toContain('visual root');
    }
  });

  it('an editor-only condition is reported as unsubtractable rather than silently skipped', () => {
    const solution = solutionSource();
    const manifest = lesson([{ previewRouteEquals: '/home' }]);

    const result = deriveLessonStarter(solution, manifest);
    // 🔴 It writes: a condition the FILES cannot answer is one the derived
    // starter cannot satisfy either, so the postcondition is genuinely met. The
    // retraction is still recorded, because "we did not look" and "we looked and
    // it was fine" must never be written the same way.
    expect(result.ok).toBe(true);
    expect(result.retractions).toHaveLength(1);
    expect(result.retractions[0].kind).toBe('unsupported');
    expect(result.retractions[0].detail).toContain('running editor');
  });

  it('leaves no dangling reference behind when it removes a subtree', () => {
    const solution = solutionSource();
    // Removing the Page removes everything on it, including a wired pair.
    const manifest = lesson([{ node: `${HOME}:%Page`, exists: true }]);

    const result = deriveLessonStarter(solution, manifest);
    expect(result.ok).toBe(true);

    const starter = result.starter as LessonProjectSource;
    const home = starter.components.find((c) => c.registryPath === '__page__/Home');
    expect(home?.nodes.nodes).toEqual([]);
    expect(home?.nodes.visualRoots).toEqual([]);
    expect(home?.connections.connections).toEqual([]);
    expect(danglingReferences(starter)).toEqual([]);
  });

  it('danglingReferences actually reports damage, so its empty result means something', () => {
    // The control for the assertion above: a project with the damage the repair
    // exists to prevent must be reported. Without this, `toEqual([])` passes
    // against a function that returns [] unconditionally.
    const broken = solutionSource();
    broken.components[1].nodes.nodes = broken.components[1].nodes.nodes.filter((n) => n.id !== 'counter-1');

    const problems = danglingReferences(broken);
    expect(problems.join('\n')).toContain('counter-1');
    expect(problems.length).toBeGreaterThanOrEqual(2); // the child ref and the connection
  });
});

// ─── Ordering, and the F3 lottery this module could have run on itself ──────

describe('resolution order', () => {
  it('resolves every path against the solution, so one removal cannot redirect another', () => {
    // 🔴 Two steps addressing `%Text` by type in the same parent. Resolved
    // against a draft that is being mutated, the second condition would find the
    // SECOND Text after the first was removed — and delete a node the lesson
    // never mentioned. Resolved against the original, both name what they meant.
    const source: LessonProjectSource = {
      components: [
        component('__page__/Home', HOME, [
          { id: 'page-1', type: 'Page', children: ['t1', 't2', 'keep'] },
          { id: 't1', type: 'Text', label: 'One', parent: 'page-1' },
          { id: 't2', type: 'Text', label: 'Two', parent: 'page-1' },
          { id: 'keep', type: 'Text', label: 'Keep', parent: 'page-1' }
        ])
      ]
    };
    const manifest = lesson(
      [{ node: `${HOME}:%Page:#One`, hasType: 'Text' }],
      [{ node: `${HOME}:%Page:#Two`, hasType: 'Text' }]
    );

    const result = deriveLessonStarter(source, manifest);
    expect(result.ok).toBe(true);

    const ids = (result.starter as LessonProjectSource).components[0].nodes.nodes.map((n) => n.id);
    expect(ids).toEqual(['page-1', 'keep']);
  });

  it('two steps addressing one node is ordinary, not an error', () => {
    const solution = solutionSource();
    const manifest = lesson(
      [{ node: `${HOME}:%Page:#Greeting`, hasType: 'Text' }],
      [{ node: `${HOME}:%Page:#Greeting`, paramsEqual: { text: 'Hello' } }]
    );

    const result = deriveLessonStarter(solution, manifest);
    expect(result.ok).toBe(true);
    expect(result.retractions.map((r) => r.kind)).toEqual(['remove-node', 'clear-params']);
    expect(result.retractions[1].detail).toContain('already removed');
  });
});

// ─── The solution is not touched ────────────────────────────────────────────

describe('the solution', () => {
  it('is not mutated by deriving a starter from it', () => {
    const solution = solutionSource();
    const before = JSON.stringify(solution);

    const result = deriveLessonStarter(
      solution,
      lesson([{ node: `${HOME}:%Page:#Greeting`, hasType: 'Text' }], [{ routerLists: ABOUT }])
    );

    // The derivation has to have DONE something, or "the solution is unchanged"
    // is true of a function that returns immediately — which is what the control
    // run showed when this spec asserted only the second line.
    expect(result.retractions.map((r) => r.kind)).toEqual(['remove-node', 'remove-route']);
    expect(JSON.stringify(solution)).toBe(before);
  });

  it('ungraded prose steps are ignored', () => {
    const solution = solutionSource();
    const manifest: LessonManifest = {
      format: 'noodl-lesson@1',
      title: 'A lesson',
      steps: [
        { kind: 'popup', body: 'Welcome.' },
        { title: 'Add a Text', body: 'Do it.', completeWhen: [{ node: `${HOME}:%Page:#Greeting`, hasType: 'Text' }] }
      ]
    };

    const result = deriveLessonStarter(solution, manifest);
    expect(result.ok).toBe(true);
    // Indexed by the step's position in the manifest, so a scorecard finding and
    // a retraction for the same step carry the same number.
    expect(result.retractions.map((r) => r.step)).toEqual([1]);
  });
});
