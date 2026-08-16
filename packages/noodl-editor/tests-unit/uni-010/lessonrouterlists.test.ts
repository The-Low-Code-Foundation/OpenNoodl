/**
 * UNI-010 criterion 3 §12.4 — `routerLists`, the verb the run found missing.
 *
 * 🔴 **WHAT THIS IS GRADED AGAINST, AND WHY IT IS A CONTROL PAIR.** The finding
 * was not "a lesson was wrong". It was that **two projects which differ in
 * whether the learner's app works score identically**, because the vocabulary
 * had no way to ask the question that separates them. L4 of the criterion-3 run
 * told the learner to create an About page *from the Router's Pages list*, and
 * graded it by checking the About page's Text — which is true of a component
 * created any other way, and a component created any other way is unreachable,
 * so step 4's navigation silently does nothing while every step ticks green.
 *
 * So the first block below is the pair itself: the same two arms, the old
 * condition, and the assertion that it **cannot tell them apart**. If that test
 * ever fails, this verb has stopped being necessary and someone should find out
 * why before deleting it. Everything after it is the new verb doing the job —
 * and doing it *only* when it should, because a verb that answers `true`
 * everywhere would pass the pair for the wrong reason.
 *
 * ⚠️ These fixtures are file-backed contexts, deliberately. `pages` is an
 * ordinary node parameter, so it survives serialisation — unlike `ports`, which
 * is the trap `lessonprojectcontext.ts` documents. That is a claim, so it is
 * asserted rather than assumed (see "the parameter survives the file").
 */

import { verifyLessonBundle } from '../../src/editor/src/models/lessonbundleverify';
import { buildLessonEvalContext } from '../../src/editor/src/models/lessonprojectcontext';
import type { LessonProjectComponentFiles } from '../../src/editor/src/models/lessonprojectcontext';
import { compileConditions, LessonFormatError } from '../../src/editor/src/models/lessonformat';
import type { LessonConditionDef, LessonManifest } from '../../src/editor/src/models/lessonformat';
import { routerListsProblems, verifyLessonManifest } from '../../src/editor/src/models/lessonverify';
import { evalConditionsWithContext } from '../../src/editor/src/views/lessons/lessonevalconditions';
import type { LessonEvalContext } from '../../src/editor/src/views/lessons/lessonevalconditions';
import type { NodeV2 } from '../../src/editor/src/schemas';

// ─── Fixtures ───────────────────────────────────────────────────────────────

const HOME = '/#__page__/Home';
const ABOUT = '/#__page__/About';

function component(registryPath: string, legacyName: string, nodes: NodeV2[]): LessonProjectComponentFiles {
  return {
    registryPath,
    component: { id: `id-${registryPath}`, name: registryPath, path: legacyName, type: 'visual' },
    nodes: { componentId: `id-${registryPath}`, nodes },
    connections: { componentId: `id-${registryPath}`, connections: [] }
  };
}

/**
 * The app shell: a Page holding a Router, exactly where one sits in a real
 * project — nested, not a graph root. The unscoped verb has to walk to it.
 */
function appShell(routes: string[], routerType = 'Router'): LessonProjectComponentFiles {
  return component('__page__/Home', HOME, [
    { id: 'page-1', type: 'Page', children: ['router-1'] },
    {
      id: 'router-1',
      type: routerType,
      label: 'Main',
      parameters: { pages: { startPage: HOME, routes } },
      parent: 'page-1'
    }
  ]);
}

/** The About page. Identical in both arms — that is the point of the pair. */
function aboutPage(): LessonProjectComponentFiles {
  return component('__page__/About', ABOUT, [
    { id: 'about-page', type: 'Page', children: ['about-text'] },
    { id: 'about-text', type: 'Text', label: 'AboutHeading', parameters: { text: 'About us' }, parent: 'about-page' }
  ]);
}

/** The arm where the learner used the Router's Pages list. Their app works. */
function registered(): LessonEvalContext {
  return buildLessonEvalContext({ components: [appShell([HOME, ABOUT]), aboutPage()] });
}

/** The arm where they made the component some other way. Their app does not. */
function unregistered(): LessonEvalContext {
  return buildLessonEvalContext({ components: [appShell([HOME]), aboutPage()] });
}

function holds(ctx: LessonEvalContext, ...defs: LessonConditionDef[]): boolean {
  return evalConditionsWithContext(compileConditions(defs, 'test'), ctx);
}

// ─── The pair, stated as the defect ─────────────────────────────────────────

describe('🔴 the two arms the old vocabulary could not separate', () => {
  const THE_OLD_CONDITION: LessonConditionDef = {
    node: `${ABOUT}:%Page:#AboutHeading`,
    paramsEqual: { text: 'About us' }
  };

  it('grades the working app and the broken one identically', () => {
    // This is the finding, not a regression guard. Both arms have the About
    // page and its heading; only one of them can be navigated to.
    expect(holds(registered(), THE_OLD_CONDITION)).toBe(true);
    expect(holds(unregistered(), THE_OLD_CONDITION)).toBe(true);
  });

  it('🔴 routerLists separates them, which is the whole reason it exists', () => {
    expect(holds(registered(), { routerLists: ABOUT })).toBe(true);
    expect(holds(unregistered(), { routerLists: ABOUT })).toBe(false);
  });
});

// ─── Not vacuously true ─────────────────────────────────────────────────────

describe('the verb answers false where it should', () => {
  it('does not accept a page no router lists, even though the component exists', () => {
    // The distinction the verb is for: being a component is not being a page.
    expect(holds(unregistered(), { node: `${ABOUT}:%Page`, exists: true })).toBe(true);
    expect(holds(unregistered(), { routerLists: ABOUT })).toBe(false);
  });

  it('does not accept a page name that appears nowhere at all', () => {
    expect(holds(registered(), { routerLists: '/#__page__/Contact' })).toBe(false);
  });

  it('does not treat a project with no router as listing everything', () => {
    const routerless = buildLessonEvalContext({
      components: [component('__page__/Home', HOME, [{ id: 'page-1', type: 'Page', children: [] }]), aboutPage()]
    });

    expect(holds(routerless, { routerLists: ABOUT })).toBe(false);
  });
});

// ─── Tolerances, borrowed rather than restated ──────────────────────────────

describe('what counts as the same page', () => {
  it('accepts the same legacy name written without its leading slash or hash', () => {
    // `isSamePage` from the editor's own registration path. A lesson author
    // copying a name out of a router and one copying it out of a component
    // file must not get different answers.
    expect(holds(registered(), { routerLists: '__page__/About' })).toBe(true);
    expect(holds(registered(), { routerLists: '#__page__/About' })).toBe(true);
  });

  it('counts a Page Stack as a router, because the editor does', () => {
    const stack = buildLessonEvalContext({
      components: [appShell([HOME, ABOUT], 'Page Stack'), aboutPage()]
    });

    expect(holds(stack, { routerLists: ABOUT })).toBe(true);
  });

  it('answers false rather than throwing on a malformed pages parameter', () => {
    // Hand-edited projects and a model that half-understood the shape both
    // reach this. "No, it does not list that page" is true of a router with a
    // broken `pages`, and it is what the learner will experience.
    const malformed = buildLessonEvalContext({
      components: [
        component('__page__/Home', HOME, [
          { id: 'page-1', type: 'Page', children: ['router-1'] },
          { id: 'router-1', type: 'Router', parameters: { pages: 'about' }, parent: 'page-1' }
        ]),
        aboutPage()
      ]
    });

    expect(() => holds(malformed, { routerLists: ABOUT })).not.toThrow();
    expect(holds(malformed, { routerLists: ABOUT })).toBe(false);
  });

  it('the parameter survives the file, so this verb is statically checkable', () => {
    // Stated because the sibling trap is real and cost this arc a round trip:
    // a stored node serialises only its *dynamic* ports, so `hasPort` reads
    // false from the file alone. Parameters are not ports.
    const router = registered().components.flatMap((c) => c.graph.roots.flatMap((r) => r.children));

    expect(router[0].parameters.pages).toEqual({ startPage: HOME, routes: [HOME, ABOUT] });
  });
});

// ─── The scoped form ────────────────────────────────────────────────────────

describe('naming one router', () => {
  const ROUTER_PATH = `${HOME}:%Page:%Router`;

  it('asks that router and gets the same answer', () => {
    expect(holds(registered(), { node: ROUTER_PATH, routerLists: ABOUT })).toBe(true);
    expect(holds(unregistered(), { node: ROUTER_PATH, routerLists: ABOUT })).toBe(false);
  });

  it('is false — not an error — when the path resolves to something that is not a router', () => {
    // Same shape as every other node-path verb when the node is missing or
    // wrong. F2's replay against the author's own solution is what tells them.
    expect(holds(registered(), { node: `${ABOUT}:%Page:#AboutHeading`, routerLists: ABOUT })).toBe(false);
  });

  it('is false when the path resolves to nothing', () => {
    expect(holds(registered(), { node: `${HOME}:%Page:#Nonexistent`, routerLists: ABOUT })).toBe(false);
  });

  it('scopes: a second router that does not list the page cannot be answered for', () => {
    const twoRouters = buildLessonEvalContext({
      components: [
        component('__page__/Home', HOME, [
          { id: 'page-1', type: 'Page', children: ['router-1', 'router-2'] },
          { id: 'router-1', type: 'Router', label: 'Main', parameters: { pages: { routes: [HOME, ABOUT] } }, parent: 'page-1' },
          { id: 'router-2', type: 'Router', label: 'Side', parameters: { pages: { routes: [HOME] } }, parent: 'page-1' }
        ]),
        aboutPage()
      ]
    });

    expect(holds(twoRouters, { node: `${HOME}:%Page:#Main`, routerLists: ABOUT })).toBe(true);
    expect(holds(twoRouters, { node: `${HOME}:%Page:#Side`, routerLists: ABOUT })).toBe(false);
    // Unscoped is an existential over all of them, which is what "reachable"
    // means — one router routing to it is enough.
    expect(holds(twoRouters, { routerLists: ABOUT })).toBe(true);
  });
});

// ─── Compilation ────────────────────────────────────────────────────────────

describe('compiling the verb', () => {
  it('omits `path` entirely when no node was named', () => {
    // Not `path: ''`. An empty component name resolves to no component, which
    // would make the condition permanently false — a silent never-completes,
    // which is the class F1 exists to prevent.
    expect(compileConditions([{ routerLists: ABOUT }], 'test')).toEqual([{ routerlists: ABOUT }]);
  });

  it('carries the path through when one was named', () => {
    expect(compileConditions([{ node: 'App:%Router', routerLists: ABOUT }], 'test')).toEqual([
      { path: 'App:%Router', routerlists: ABOUT }
    ]);
  });

  it('refuses an empty page name rather than compiling a condition that cannot hold', () => {
    expect(() => compileConditions([{ routerLists: '' } as LessonConditionDef], 'test')).toThrow(LessonFormatError);
  });

  it('names the verb in the "unrecognised condition" list, so a near-miss spelling is recoverable', () => {
    let message = '';
    try {
      compileConditions([{ routerListed: ABOUT } as unknown as LessonConditionDef], 'test');
    } catch (e) {
      message = (e as Error).message;
    }

    expect(message).toContain('routerLists');
  });
});

// ─── F1: the value is a component name, not a node path ─────────────────────

describe('F1 — routerLists written in the wrong grammar', () => {
  it('rejects a node path, because the two sit one line apart in the same object', () => {
    expect(routerListsProblems(`${HOME}:%Page:%Router`)).toHaveLength(1);
    expect(routerListsProblems(`${HOME}:%Page:%Router`)[0]).toContain('legacy name');
  });

  it('accepts a legacy name', () => {
    expect(routerListsProblems(ABOUT)).toEqual([]);
    expect(routerListsProblems('/Pages/About')).toEqual([]);
  });

  it('surfaces it through the manifest verifier as an error naming the step', () => {
    const lesson: LessonManifest = {
      format: 'noodl-lesson@1',
      steps: [
        {
          title: 'Register the page',
          body: 'Add **About** to the Router.',
          completeWhen: [{ routerLists: `${ABOUT}:%Page` }]
        }
      ]
    };

    const report = verifyLessonManifest(lesson);
    const finding = report.findings.find((f) => f.code === 'unmatchable-node-path');

    expect(report.ok).toBe(false);
    expect(finding?.where).toContain('Register the page');
    expect(finding?.where).toContain('routerLists');
  });

  it('leaves a correct one alone', () => {
    const lesson: LessonManifest = {
      format: 'noodl-lesson@1',
      steps: [{ title: 'Register the page', body: 'Add it.', completeWhen: [{ routerLists: ABOUT }] }]
    };

    expect(verifyLessonManifest(lesson).ok).toBe(true);
  });
});

// ─── It reaches the gate ────────────────────────────────────────────────────

describe('the verb participates in the bundle gate', () => {
  const LESSON: LessonManifest = {
    format: 'noodl-lesson@1',
    title: 'A second page, and a way to reach it',
    steps: [
      {
        title: 'Create the About page from the Router',
        body: 'Open the Router and add a page called **About**.',
        completeWhen: [{ routerLists: ABOUT }]
      }
    ]
  };

  it('passes F2 when the solution registers the page', async () => {
    const card = await verifyLessonBundle(LESSON, {
      starter: buildLessonEvalContext({ components: [appShell([HOME])] }),
      solution: registered()
    });

    expect(card.classes.F1).toBe('pass');
    expect(card.classes.F2).toBe('pass');
  });

  it('🔴 fails F2 when the author wrote the step but never registered it in their own solution', async () => {
    // The half of the finding that better authoring *could* have caught, now
    // caught by the gate: an author who writes the step and forgets to do it in
    // the answer is told, instead of shipping a step no learner can complete.
    //
    // ⚠️ **The named code is the discriminating part, and this test was weaker
    // before the control run said so.** Asserting only `F2: 'fail'` passes just
    // as happily when the verb is dead — a condition that is false everywhere
    // fails F2 too, for a reason that has nothing to do with the lesson. A
    // failure that would look identical if the mechanism were missing measures
    // nothing.
    const card = await verifyLessonBundle(LESSON, {
      starter: buildLessonEvalContext({ components: [appShell([HOME])] }),
      solution: unregistered()
    });

    expect(card.classes.F2).toBe('fail');
    expect(card.findings.map((f) => f.code)).toContain('dead-on-solution');
  });

  it('🔴 fails F2′ when the starter already registered the page', async () => {
    // The ghostwriting check, which the verb gets for free by being an ordinary
    // condition: a step that ticks itself the moment the learner arrives.
    //
    // `already-satisfied-in-starter` is only reachable when the condition is
    // *true* of the starter, so unlike a bare `F2: 'fail'` this cannot be
    // satisfied by a verb that answers false everywhere.
    const card = await verifyLessonBundle(LESSON, {
      starter: registered(),
      solution: registered()
    });

    expect(card.classes.F2).toBe('fail');
    expect(card.findings.map((f) => f.code)).toContain('already-satisfied-in-starter');
  });

  it('is checkable against files, so it never lands in the not-checkable bucket', async () => {
    // `previewRouteEquals` and `activeComponentEquals` are reported as
    // unanswerable rather than failed. This verb reads project files, so it
    // must not join them — a not-checked verdict here would be the gate
    // quietly declining the one question the run added it to ask.
    const card = await verifyLessonBundle(LESSON, {
      starter: buildLessonEvalContext({ components: [appShell([HOME])] }),
      solution: registered()
    });

    expect(card.findings.filter((f) => f.code === 'not-checked' && f.failureClass === 'F2')).toEqual([]);
  });
});
