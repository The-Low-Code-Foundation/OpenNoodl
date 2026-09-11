/**
 * TUT-002 AC5 — the harness, pointed at a data lesson.
 *
 * Two separate things, and the second was a latent defect rather than a missing feature:
 *
 * 1. **F1's collection-reachability check now has a caller.** Session 2 built it and nothing
 *    supplied `knownCollections`, so a lesson could name a collection nothing in the bundle has
 *    ever heard of and the check never fired. The bundle harness is the one caller that holds
 *    *both* projects, and it now derives the population from them.
 *
 * 2. 🔴 **A correct data lesson was about to be refused as F2 "dead on solution".** A collection
 *    condition replayed against a context with no database reads `false` — correctly, because a
 *    grader that cannot see the database must never congratulate — and the harness read that as
 *    "the author's own solution does not satisfy their own step". That is a *manufactured*
 *    failure, the one output a gate must never produce, and it would have made TUT-003
 *    unshippable while every one of its 31 specs stayed green.
 */

import { verifyLessonBundle } from '../../src/editor/src/models/lessonbundleverify';
import { buildLessonEvalContext } from '../../src/editor/src/models/lessonprojectcontext';
import type { LessonProjectComponentFiles } from '../../src/editor/src/models/lessonprojectcontext';
import type { LessonManifest } from '../../src/editor/src/models/lessonformat';
import type { LessonDatabaseSnapshot } from '../../src/editor/src/views/lessons/lessonevalconditions';
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

/** The starter: a page, and no way to write a record. */
const STARTER_NODES: NodeV2[] = [{ id: 'page-1', type: 'Page', children: [] }];

/** The solution: a Create Record aimed at `Puppies`, which is what NAMES the collection. */
const SOLUTION_NODES: NodeV2[] = [
  { id: 'page-1', type: 'Page', children: ['save-1'] },
  {
    id: 'save-1',
    type: 'CreateNewRecord',
    label: 'Save',
    parent: 'page-1',
    parameters: { collectionName: 'Puppies' }
  }
];

function starter() {
  return buildLessonEvalContext({ components: [page(STARTER_NODES)] });
}
function solution(database?: LessonDatabaseSnapshot) {
  return buildLessonEvalContext({ components: [page(SOLUTION_NODES)], ...(database ? { database } : {}) });
}

function lesson(completeWhen: LessonManifest['steps'][number]['completeWhen']): LessonManifest {
  return {
    format: 'noodl-lesson@1',
    title: 'Save a puppy',
    description: 'Create a record.',
    steps: [{ title: 'Save one', body: 'Press the button.', completeWhen }]
  };
}

const NAMES_PUPPIES = lesson([
  { node: '/#__page__/Home:%Page:#Save', exists: true },
  { collection: 'Puppies', rowCountAtLeast: 1 }
]);

// ─── The defect that was about to ship ──────────────────────────────────────

describe('a correct data lesson is not reported as dead on its own solution', () => {
  it('🔴 F2 passes: the collection condition is reported as not-checkable, not as a failure', async () => {
    const scorecard = await verifyLessonBundle(NAMES_PUPPIES, { starter: starter(), solution: solution() });

    expect(scorecard.classes.F2).toBe('pass');
    expect(scorecard.findings.some((f) => f.code === 'dead-on-solution')).toBe(false);
    // Reported, never silent: a step the harness could only half-check must say which half.
    const notChecked = scorecard.findings.filter((f) => f.code === 'not-checked');
    expect(notChecked.some((f) => /built-in database/.test(f.message))).toBe(true);
  });

  it('🔴 the known-firing control: a genuinely dead GRAPH condition is still caught', async () => {
    // Held constant: the same bundle, the same harness, the same data condition. Varied: one
    // structural condition the solution does not satisfy. Without this the spec above would pass
    // just as well against a harness that had stopped checking F2 altogether.
    const wrong = lesson([
      { node: '/#__page__/Home:%Page:#Nonexistent', exists: true },
      { collection: 'Puppies', rowCountAtLeast: 1 }
    ]);
    const scorecard = await verifyLessonBundle(wrong, { starter: starter(), solution: solution() });

    expect(scorecard.classes.F2).toBe('fail');
    expect(scorecard.findings.some((f) => f.code === 'dead-on-solution')).toBe(true);
  });

  it('replays the data condition for real when a snapshot IS supplied', async () => {
    // The opt-in path `check_lesson --backend_id` takes. Now the condition is answerable, so a
    // solution whose database does not satisfy it IS dead-on-solution — and that is the finding
    // the author asked for by naming a backend.
    const empty: LessonDatabaseSnapshot = { status: 'ok', collections: [] };
    const scorecard = await verifyLessonBundle(NAMES_PUPPIES, {
      starter: starter(),
      solution: solution(empty)
    });

    expect(scorecard.classes.F2).toBe('fail');
    expect(scorecard.findings.some((f) => f.code === 'dead-on-solution')).toBe(true);
  });
});

// ─── F1, with a population at last ──────────────────────────────────────────

describe('F1 — a collection nothing in the bundle has ever heard of', () => {
  it('🔴 refuses a condition naming a collection neither project mentions, and names the alternatives', async () => {
    const typo = lesson([{ collection: 'Puppys', rowCountAtLeast: 1 }]);
    const scorecard = await verifyLessonBundle(typo, { starter: starter(), solution: solution() });

    expect(scorecard.classes.F1).toBe('fail');
    const finding = scorecard.findings.find((f) => f.code === 'unreachable-collection');
    expect(finding).toBeDefined();
    // Verbatim, not lower-cased: an author told to type "puppies" against a solution creating
    // `Puppies` has been told to make a second mistake.
    expect(finding?.message).toContain('Puppies');
  });

  it('the passing control: the same shape with the name the solution actually uses', async () => {
    const scorecard = await verifyLessonBundle(NAMES_PUPPIES, { starter: starter(), solution: solution() });
    expect(scorecard.classes.F1).toBe('pass');
    expect(scorecard.findings.some((f) => f.code === 'unreachable-collection')).toBe(false);
  });

  it('matches case-insensitively, as SQLite identifiers do', async () => {
    const scorecard = await verifyLessonBundle(lesson([{ collection: 'puppies', collectionExists: true }]), {
      starter: starter(),
      solution: solution()
    });
    expect(scorecard.findings.some((f) => f.code === 'unreachable-collection')).toBe(false);
  });

  it('🔴 a collection only the STARTER names is still reachable', async () => {
    // "Delete the Query that reads Owners" is a legitimate step. A population drawn from the
    // solution alone would call that name unreachable and refuse a correct lesson.
    const starterWithOwners = buildLessonEvalContext({
      components: [
        page([
          { id: 'page-1', type: 'Page', children: ['q-1'] },
          { id: 'q-1', type: 'DbCollection2', parent: 'page-1', parameters: { collectionName: 'Owners' } }
        ])
      ]
    });
    const scorecard = await verifyLessonBundle(lesson([{ collection: 'Owners', collectionExists: false }]), {
      starter: starterWithOwners,
      solution: solution()
    });
    expect(scorecard.findings.some((f) => f.code === 'unreachable-collection')).toBe(false);
  });

  it('🔴 checks nothing at all when there is no solution to derive a population from', async () => {
    // `asked − answered = absent`. Asserting "this collection does not exist" from a bundle we
    // were never given is the shape of finding that rejects correct work.
    const typo = lesson([{ collection: 'Puppys', rowCountAtLeast: 1 }]);
    const scorecard = await verifyLessonBundle(typo, { starter: starter() });
    expect(scorecard.findings.some((f) => f.code === 'unreachable-collection')).toBe(false);
  });

  it("an explicit knownCollections from the caller still wins", async () => {
    const scorecard = await verifyLessonBundle(NAMES_PUPPIES, {
      starter: starter(),
      solution: solution(),
      verify: { knownCollections: ['Owners'] }
    });
    expect(scorecard.classes.F1).toBe('fail');
  });
});
