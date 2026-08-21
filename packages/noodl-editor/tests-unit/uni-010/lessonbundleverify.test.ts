/**
 * UNI-010 acceptance criterion 1 — **one deliberately-broken bundle per
 * machine-detectable class**, refused with a diagnostic the authoring model can
 * act on.
 *
 * The criterion is deliberately not "a broken bundle is refused". The 2026-08-14
 * ruling traded a structural guarantee (a model that never writes predicates
 * cannot write a wrong one) for a gate, and a gate is only worth the trade if it
 * separates the classes: the model that receives this output is the one that has
 * to fix the bundle, and "verification failed" is not a repair instruction.
 *
 * So each block below builds a lesson that is wrong in exactly one way, and
 * asserts both the class and that the sentence names what to change — the
 * phase-64 rule that a refusal is graded by what it wrote.
 */

import {
  formatBundleScorecard,
  verifyLessonBundle
} from '../../src/editor/src/models/lessonbundleverify';
import { buildLessonEvalContext } from '../../src/editor/src/models/lessonprojectcontext';
import type { LessonProjectComponentFiles } from '../../src/editor/src/models/lessonprojectcontext';
import type { LessonManifest } from '../../src/editor/src/models/lessonformat';
import type { WholeSolutionGrader, WholeSolutionResult } from '../../src/editor/src/models/lessongrading';
import type { NodeV2 } from '../../src/editor/src/schemas';

// ─── Fixtures ───────────────────────────────────────────────────────────────

function page(nodes: NodeV2[]): LessonProjectComponentFiles {
  return {
    registryPath: '__page__/Home',
    component: { id: 'home', name: 'Home', path: '/#__page__/Home', type: 'visual' },
    nodes: { componentId: 'home', nodes },
    connections: { componentId: 'home', connections: [] }
  };
}

const PAGE_ONLY: NodeV2[] = [{ id: 'page-1', type: 'Page', children: [] }];

/** The starter: a page and nothing on it. */
function starter() {
  return buildLessonEvalContext({ components: [page(PAGE_ONLY)] });
}

/** The solution: the same page with a labelled Text on it. */
function solution() {
  return buildLessonEvalContext({
    components: [
      page([
        { id: 'page-1', type: 'Page', children: ['text-1'] },
        { id: 'text-1', type: 'Text', label: 'Greeting', parameters: { text: 'Hello' }, parent: 'page-1' }
      ])
    ]
  });
}

/** A lesson asking for exactly what the solution has, addressed by label. */
const GOOD_LESSON: LessonManifest = {
  format: 'noodl-lesson@1',
  title: 'Put some text on the page',
  steps: [
    { kind: 'popup', body: 'Welcome.' },
    {
      title: 'Add a Text node',
      body: 'Drag a **Text** node onto the page and label it `Greeting`.',
      completeWhen: [{ node: '/#__page__/Home:%Page:#Greeting', hasType: 'Text' }]
    }
  ]
};

function grader(result: Partial<WholeSolutionResult>): WholeSolutionGrader {
  return {
    check: async () => ({ valid: true, rendered: true, drawnElementCount: 3, findings: [], ...result })
  };
}

function messages(findings: Array<{ message: string }>): string {
  return findings.map((f) => f.message).join('\n');
}

// ─── The bundle that should pass ────────────────────────────────────────────

describe('a sound bundle', () => {
  it('passes every class it was given the means to check', async () => {
    const card = await verifyLessonBundle(GOOD_LESSON, {
      starter: starter(),
      solution: solution(),
      wholeSolution: grader({})
    });

    expect(card.classes).toEqual({ F1: 'pass', F2: 'pass', F3: 'pass', F4: 'pass' });
    expect(card.ok).toBe(true);
    expect(card.installable).toBe(true);
    expect(card.gradedSteps).toBe(1);
    expect(card.findings.filter((f) => f.severity === 'error')).toEqual([]);
  });

  it('does not count a prose step as a graded one', async () => {
    const card = await verifyLessonBundle(GOOD_LESSON, { starter: starter(), solution: solution() });

    // Two steps in the manifest, one condition-carrying. An intro that "fails"
    // because it has nothing to check would be the harness inventing a defect.
    expect(card.gradedSteps).toBe(1);
  });
});

// ─── F1 — unreachable ───────────────────────────────────────────────────────

describe('F1 — a condition written in the prose vocabulary', () => {
  it('is refused, and the refusal names the type name to use instead', async () => {
    const lesson: LessonManifest = {
      title: 'Lists',
      steps: [
        {
          title: 'Add a Repeater',
          // `Repeater` is what the node picker shows; `For Each` is what a
          // condition has to say. The silent failure this whole check exists for.
          completeWhen: [{ node: '/#__page__/Home:%Page:%Repeater', exists: true }]
        }
      ]
    };

    const card = await verifyLessonBundle(lesson, { starter: starter(), solution: solution() });

    expect(card.classes.F1).toBe('fail');
    expect(card.ok).toBe(false);
    expect(messages(card.findings)).toMatch(/display name/i);
    expect(messages(card.findings)).toMatch(/For Each/);
  });

  it('carries the static finding’s own code through, rather than flattening it', async () => {
    const lesson: LessonManifest = {
      title: 'Variables',
      steps: [
        // The shadowed class: `Variable` IS a real type name, so an existence
        // check passes — and it names the deprecated node.
        { title: 'Add a Variable', completeWhen: [{ node: '/#__page__/Home:%Variable', exists: true }] }
      ]
    };

    const card = await verifyLessonBundle(lesson, { solution: solution() });

    // 🔴 A scorecard that cannot say *which* F1 defect it hit cannot answer the
    // arc's own question about which class dominates — the deliverable is a
    // number per class, not a verdict per bundle.
    expect(card.findings.some((f) => f.code === 'shadowed-by-deprecated')).toBe(true);
  });

  it('refuses an ambiguous display name without suggesting a substitution', async () => {
    const lesson: LessonManifest = {
      title: 'Objects',
      steps: [{ title: 'Add an Object', completeWhen: [{ node: '/#__page__/Home:%Object', exists: true }] }]
    };

    const card = await verifyLessonBundle(lesson, { solution: solution() });

    expect(card.classes.F1).toBe('fail');
    // `Object` maps to both Model and Model2. Choosing one for the author is how
    // a class-F1 failure becomes a class-F3 one.
    expect(messages(card.findings)).toMatch(/Model/);
    expect(messages(card.findings)).not.toMatch(/Use "Model"/);
  });
});

// ─── F2 — dead on solution ──────────────────────────────────────────────────

describe('F2 — conditions that never fire against the lesson’s own solution', () => {
  it('is refused, and the refusal says the learner would be told they failed', async () => {
    const lesson: LessonManifest = {
      title: 'Text',
      steps: [
        {
          title: 'Label the Text "Caption"',
          // The prose says Caption; the solution labels it Greeting. Nobody who
          // follows this lesson can ever complete it.
          completeWhen: [{ node: '/#__page__/Home:%Page:#Caption', hasType: 'Text' }]
        }
      ]
    };

    const card = await verifyLessonBundle(lesson, { starter: starter(), solution: solution() });

    expect(card.classes.F2).toBe('fail');
    expect(card.findings.some((f) => f.code === 'dead-on-solution')).toBe(true);
    expect(messages(card.findings)).toMatch(/still be told they have not finished/);
  });

  /**
   * FIX-025 — 🔴 THIS TEST USED TO ASSERT THE OPPOSITE, and the reversal is the fix.
   *
   * It called `/#__page__/Home:%Text` *"one level too shallow"* and required F2 to refuse it.
   * That was the resolver's old contract — a `%type`/`#label` segment matched one level of
   * siblings — and it is what made the shipped *State on a page* lesson ungradeable: a node
   * dropped onto a page is a child of the `Page`, so all three of its graded steps named a
   * node that could never be found. Richard hit it as *"I've added the Caption and the step
   * won't complete"*.
   *
   * Depth is no longer significant for a named segment (see `findNodeWithPath`), so this path
   * is now simply CORRECT and F2 must pass it. F2 still earns its place — the sibling test
   * above, where the prose says `Caption` and the solution says `Greeting`, still fails.
   */
  it('a named node found deeper in the page is NOT a mistake', async () => {
    const lesson: LessonManifest = {
      title: 'Text',
      steps: [
        {
          title: 'Add a Text',
          completeWhen: [{ node: '/#__page__/Home:%Text', exists: true }]
        }
      ]
    };

    const card = await verifyLessonBundle(lesson, { starter: starter(), solution: solution() });

    expect(card.classes.F1).toBe('pass');
    expect(card.classes.F2).toBe('pass');
  });
});

// ─── F2' — ghostwritten ─────────────────────────────────────────────────────

describe('F2′ — a step the starter has already done', () => {
  it('is refused, and the refusal says the starter must not contain it', async () => {
    const lesson: LessonManifest = {
      title: 'Pages',
      steps: [
        {
          title: 'Add a Page node',
          // True the moment the learner opens the project. The step ticks itself
          // and the lesson has built it for them — §3.5's line.
          completeWhen: [{ node: '/#__page__/Home:%Page', exists: true }]
        }
      ]
    };

    const card = await verifyLessonBundle(lesson, { starter: starter(), solution: solution() });

    expect(card.classes.F2).toBe('fail');
    expect(card.findings.some((f) => f.code === 'already-satisfied-in-starter')).toBe(true);
    expect(messages(card.findings)).toMatch(/absent from the starter/);
  });

  it('checks only F2 when no starter is supplied, rather than assuming innocence', async () => {
    const lesson: LessonManifest = {
      title: 'Pages',
      steps: [{ title: 'Add a Page node', completeWhen: [{ node: '/#__page__/Home:%Page', exists: true }] }]
    };

    const card = await verifyLessonBundle(lesson, { solution: solution() });

    // The same lesson, with the ghostwriting invisible: F2 passes because the
    // solution satisfies it. This is why `installable` is not `ok`.
    expect(card.classes.F2).toBe('pass');
  });
});

// ─── F3 — ambiguous address ─────────────────────────────────────────────────

/** The solution of a lesson that itself asks for a second Text. */
function twoTextSolution() {
  return buildLessonEvalContext({
    components: [
      page([
        { id: 'page-1', type: 'Page', children: ['text-1', 'text-2'] },
        { id: 'text-1', type: 'Text', label: 'Greeting', parameters: { text: 'Hello' }, parent: 'page-1' },
        { id: 'text-2', type: 'Text', label: 'Caption', parameters: { text: 'Bye' }, parent: 'page-1' }
      ])
    ]
  });
}

describe('F3 — an address that depends on being first', () => {
  it('fails when the lesson’s own solution already has a second candidate', async () => {
    const lesson: LessonManifest = {
      title: 'Text',
      steps: [
        {
          title: 'Set the first text to Hello',
          // The lesson asks for two Texts and then addresses one of them by
          // type. Which one this means is decided by graph order — F3 exactly,
          // and caught because the solution is the graph after every step.
          completeWhen: [{ node: '/#__page__/Home:%Page:%Text', paramsEqual: { text: 'Hello' } }]
        },
        {
          title: 'Add a second Text labelled Caption',
          completeWhen: [{ node: '/#__page__/Home:%Page:#Caption', hasType: 'Text' }]
        }
      ]
    };

    const card = await verifyLessonBundle(lesson, { starter: starter(), solution: twoTextSolution() });

    expect(card.classes.F2).toBe('pass');
    expect(card.classes.F3).toBe('fail');
    expect(card.findings.some((f) => f.code === 'ambiguous-type-address')).toBe(true);
    expect(messages(card.findings)).toMatch(/#TheLabel/);
  });

  it('passes the same lesson with the first step addressed by label', async () => {
    const lesson: LessonManifest = {
      title: 'Text',
      steps: [
        {
          title: 'Set the first text to Hello',
          completeWhen: [{ node: '/#__page__/Home:%Page:#Greeting', paramsEqual: { text: 'Hello' } }]
        },
        {
          title: 'Add a second Text labelled Caption',
          completeWhen: [{ node: '/#__page__/Home:%Page:#Caption', hasType: 'Text' }]
        }
      ]
    };

    const card = await verifyLessonBundle(lesson, { starter: starter(), solution: twoTextSolution() });

    // §3.2's recommendation earns its keep here: the same lesson, one addressing
    // change, and the class flips. That is the fix the finding asks for.
    expect(card.classes.F3).toBe('pass');
  });

  it('warns but does not fail when exactly one candidate exists', async () => {
    const lesson: LessonManifest = {
      title: 'Text',
      steps: [
        {
          title: 'Set the text to Hello',
          completeWhen: [{ node: '/#__page__/Home:%Page:%Text', paramsEqual: { text: 'Hello' } }]
        }
      ]
    };

    const card = await verifyLessonBundle(lesson, { starter: starter(), solution: solution() });

    // 🔴 The line that keeps this gate usable. One Text exists, so the lesson
    // works and rejecting it would be the harness manufacturing a defect — but
    // the address is brittle and the author is told so.
    expect(card.classes.F3).toBe('pass');
    expect(card.findings.some((f) => f.code === 'fragile-type-address')).toBe(true);
    expect(messages(card.findings)).toMatch(/Exactly one exists today/);
  });

  it('says nothing at all about an address a decoy cannot displace', async () => {
    const flat = buildLessonEvalContext({
      components: [page([{ id: 'text-1', type: 'Text', label: 'Greeting' }])]
    });
    const lesson: LessonManifest = {
      title: 'Text',
      steps: [
        // `hasType` on a `%Text` path is true of any Text, decoy included — the
        // address is type-only and it does not matter, so there is nothing here
        // for an author to fix.
        { title: 'Add a Text', completeWhen: [{ node: '/#__page__/Home:%Text', hasType: 'Text' }] }
      ]
    };

    const card = await verifyLessonBundle(lesson, { solution: flat });

    expect(card.classes.F3).toBe('pass');
    expect(card.findings.filter((f) => f.failureClass === 'F3')).toEqual([]);
  });

  it('does not run the decoy test on a step that already fails its own solution', async () => {
    const lesson: LessonManifest = {
      title: 'Text',
      steps: [{ title: 'Nope', completeWhen: [{ node: '/#__page__/Home:%Page:%Group', exists: true }] }]
    };

    const card = await verifyLessonBundle(lesson, { solution: solution() });

    // Injecting a decoy into a graph the step already fails measures the
    // harness, not the lesson. F2 owns this one.
    expect(card.classes.F2).toBe('fail');
    expect(card.findings.filter((f) => f.failureClass === 'F3')).toEqual([]);
  });
});

// ─── F4 — empty preview ─────────────────────────────────────────────────────

describe('F4 — the solution that draws nothing', () => {
  it('is refused, and the refusal points at the bindings', async () => {
    const card = await verifyLessonBundle(GOOD_LESSON, {
      starter: starter(),
      solution: solution(),
      wholeSolution: grader({ rendered: false, drawnElementCount: 0 })
    });

    expect(card.classes.F4).toBe('fail');
    expect(messages(card.findings)).toMatch(/empty page/);
    expect(messages(card.findings)).toMatch(/sample data keys/);
  });

  it('refuses a solution that does not validate', async () => {
    const card = await verifyLessonBundle(GOOD_LESSON, {
      starter: starter(),
      solution: solution(),
      wholeSolution: grader({ valid: false, findings: ['Unknown node type "Reapeter".'] })
    });

    expect(card.classes.F4).toBe('fail');
    expect(messages(card.findings)).toMatch(/Reapeter/);
  });

  it('applies the clean-can-mean-EMPTY rule to an adapter that claims otherwise', async () => {
    const card = await verifyLessonBundle(GOOD_LESSON, {
      starter: starter(),
      solution: solution(),
      // An adapter reporting a successful render of nothing. `normaliseWholeSolutionResult`
      // rewrites it; the harness must not have its own opinion about that.
      wholeSolution: grader({ rendered: true, drawnElementCount: 0 })
    });

    expect(card.classes.F4).toBe('fail');
    expect(card.wholeSolution?.rendered).toBe(false);
  });

  it('does not fail a bundle because this machine has no Chrome', async () => {
    const card = await verifyLessonBundle(GOOD_LESSON, {
      starter: starter(),
      solution: solution(),
      wholeSolution: grader({ unavailable: 'no render harness on this machine' })
    });

    // 🔴 The whole discipline in one assertion: a check that could not run has
    // found nothing, and must never be reported as having found something.
    expect(card.classes.F4).toBe('not-checked');
    expect(card.ok).toBe(true);
    expect(card.installable).toBe(false);
  });
});

// ─── F4 — the solution that draws, and draws broken ─────────────────────────
//
// 🔴 UNI-010 criterion 3 §8.1, as a spec. The run's own control pair is the
// shape of it: two bundles differing by one JSON key in one node, one showing
// the learner three blank rows, and — before this — two identical scorecards.
// The pair is what the block asserts, because a single broken case would pass
// just as well against a gate that had started failing everything.

describe('F4 — the solution that draws, and what it drew is broken', () => {
  /** The §8.1 solution: one real heading, and three rows of the literal word "Text". */
  const BROKEN_ROWS = {
    drawnElementCount: 4,
    renderDefects: ['dead-placeholder-text'],
    findings: [
      '[error] desktop: dead-placeholder-text — 3 elements render a node-type default instead of ' +
        'content: 3× "Text". Nothing set those ports.'
    ]
  };

  /** The same lesson with `ports` instead of `dynamicports`: the rows carry their data. */
  const WORKING_ROWS = { drawnElementCount: 4, renderDefects: [], findings: [] };

  it('is refused, where before it passed on the strength of the heading beside it', async () => {
    const card = await verifyLessonBundle(GOOD_LESSON, {
      starter: starter(),
      solution: solution(),
      wholeSolution: grader(BROKEN_ROWS)
    });

    expect(card.classes.F4).toBe('fail');
    expect(card.installable).toBe(false);
    expect(messages(card.findings)).toMatch(/dead-placeholder-text/);
  });

  it('names the defect rather than calling a four-element page empty', async () => {
    const card = await verifyLessonBundle(GOOD_LESSON, {
      starter: starter(),
      solution: solution(),
      wholeSolution: grader(BROKEN_ROWS)
    });

    const f4 = card.findings.filter((f) => f.failureClass === 'F4' && f.severity === 'error');
    expect(f4.map((f) => f.code)).toEqual(['solution-renders-broken']);
    // The repair the author needs is "fix what is on the page", not "put
    // something on the page" — phase 64's rule that a refusal is graded by what
    // it wrote, applied to the one sentence the authoring model acts on.
    expect(f4[0].message).not.toMatch(/empty page|draws nothing/);
    expect(f4[0].message).toMatch(/4 elements/);
  });

  it('🔴 tells the control pair apart — the assertion the run could not make', async () => {
    const options = { starter: starter(), solution: solution() };
    const broken = await verifyLessonBundle(GOOD_LESSON, { ...options, wholeSolution: grader(BROKEN_ROWS) });
    const working = await verifyLessonBundle(GOOD_LESSON, { ...options, wholeSolution: grader(WORKING_ROWS) });

    expect(working.classes.F4).toBe('pass');
    expect(working.installable).toBe(true);
    expect(broken.classes.F4).toBe('fail');
    // Character-for-character identical scorecards were the finding. They must
    // now differ, and this is the one assertion that would have caught it.
    expect(formatBundleScorecard(broken)).not.toEqual(formatBundleScorecard(working));
  });

  it('does not invent a verdict for an adapter that reported no defect list', async () => {
    // 🔴 Absent is "not reported", not "none found" — the same distinction
    // `drawnElementCount` draws. An adapter that stays silent opts itself out,
    // and this harness must not turn that silence into either verdict.
    const card = await verifyLessonBundle(GOOD_LESSON, {
      starter: starter(),
      solution: solution(),
      wholeSolution: grader({ drawnElementCount: 4 })
    });

    expect(card.classes.F4).toBe('pass');
    expect(card.findings.map((f) => f.code)).not.toContain('solution-renders-broken');
  });

  it('says the page is empty, not broken, when the page is empty', async () => {
    // Both branches are reachable and they must not collapse into each other: a
    // blank render carries `blank-render`, which `renderDefectCodes` excludes
    // precisely so one defect is not reported twice under two names.
    const card = await verifyLessonBundle(GOOD_LESSON, {
      starter: starter(),
      solution: solution(),
      wholeSolution: grader({ rendered: false, drawnElementCount: 0, renderDefects: [] })
    });

    expect(card.findings.filter((f) => f.failureClass === 'F4').map((f) => f.code)).toEqual([
      'solution-renders-nothing'
    ]);
  });
});

// ─── Not checked is not passed ──────────────────────────────────────────────

describe('a bundle with no solution', () => {
  it('is not a failure, and is not installable either', async () => {
    const card = await verifyLessonBundle(GOOD_LESSON, {});

    expect(card.classes).toEqual({ F1: 'pass', F2: 'not-checked', F3: 'not-checked', F4: 'not-checked' });
    expect(card.ok).toBe(true);
    expect(card.installable).toBe(false);
    expect(messages(card.findings)).toMatch(/carries no solution/);
  });
});

describe('a condition only a running editor can answer', () => {
  it('is reported as unchecked rather than evaluated to false', async () => {
    const lesson: LessonManifest = {
      title: 'Preview',
      steps: [{ title: 'Open the home route', completeWhen: [{ previewRouteEquals: '/home' }] }]
    };

    const card = await verifyLessonBundle(lesson, { starter: starter(), solution: solution() });

    // Evaluating this would return false and the harness would report a sound
    // lesson as dead on its own solution — accusing the author of the harness's
    // blind spot.
    expect(card.classes.F2).toBe('pass');
    expect(card.findings.some((f) => f.code === 'not-checked' && f.failureClass === 'F2')).toBe(true);
    expect(messages(card.findings)).toMatch(/running editor/);
  });

  it('still checks the conditions beside it', async () => {
    const lesson: LessonManifest = {
      title: 'Preview',
      steps: [
        {
          title: 'Open the home route with the text there',
          completeWhen: [
            { previewRouteEquals: '/home' },
            { node: '/#__page__/Home:%Page:#Caption', hasType: 'Text' }
          ]
        }
      ]
    };

    const card = await verifyLessonBundle(lesson, { starter: starter(), solution: solution() });

    expect(card.classes.F2).toBe('fail');
  });
});

// ─── The scorecard an authoring model reads ─────────────────────────────────

describe('the scorecard', () => {
  it('names every class, the step, and what to change', async () => {
    const lesson: LessonManifest = {
      title: 'Text',
      steps: [
        {
          title: 'Set the text to Hello',
          completeWhen: [{ node: '/#__page__/Home:%Page:%Text', paramsEqual: { text: 'Hello' } }]
        },
        {
          title: 'Add a second Text labelled Caption',
          completeWhen: [{ node: '/#__page__/Home:%Page:#Caption', hasType: 'Text' }]
        }
      ]
    };

    const text = formatBundleScorecard(
      await verifyLessonBundle(lesson, { starter: starter(), solution: twoTextSolution() })
    );

    expect(text).toMatch(/F3 ambiguous address:\s+FAIL/);
    expect(text).toMatch(/F4 empty preview:\s+not checked/);
    expect(text).toMatch(/Step 1 \("Set the text to Hello"\)/);
    expect(text).toMatch(/#TheLabel/);
  });

  it('says so when nothing failed but not everything was checked', async () => {
    const text = formatBundleScorecard(await verifyLessonBundle(GOOD_LESSON, {}));

    expect(text).toMatch(/not every class was checked/);
  });
});
