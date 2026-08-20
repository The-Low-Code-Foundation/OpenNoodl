/**
 * TUT-003 — F2′ against a data lesson, and the false conviction it used to hand out.
 *
 * 🔴 THE DEFECT, AND WHY 70 GREEN TUT-002 SPECS DID NOT SEE IT
 * ------------------------------------------------------------
 * Session 3's `bundle-verifies-a-data-lesson.test.ts` supplies a snapshot to the **solution only**.
 * The one caller that fills a snapshot for real — `check_lesson --backend_id`,
 * `noodl-mcp/src/tools/lessonTools.ts` — reads one live backend and hands the **same** snapshot to
 * both contexts, because a bundle on disk has one database and not two. Under that shape a step
 * whose conditions are all data conditions is `already-satisfied-in-starter` by construction: the
 * snapshot describes the author's world after they ran the solution, and F2′ asks about the
 * learner's world before they start.
 *
 * The step it convicted is the one TUT-003 AC5 requires — "complete the graph, create no record,
 * the data step stays red". So the route the phase notes recommended would have refused the correct
 * lesson.
 *
 * Every case below fixes the caller's shape (snapshot on BOTH contexts) and varies one thing.
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

const STARTER_NODES: NodeV2[] = [{ id: 'page-1', type: 'Page', children: [] }];
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

/**
 * A backend the author has already driven: the collection exists and holds a row. This is what
 * `lessonDatabaseFromBackend` returns after the author has built and run the solution once, and it
 * is the only snapshot that exists at check time.
 */
const AFTER_THE_AUTHOR_RAN_IT: LessonDatabaseSnapshot = {
  status: 'ok',
  collections: [{ name: 'Puppies', columns: ['name'], rowCount: 1 }]
};

function ctx(nodes: NodeV2[], database?: LessonDatabaseSnapshot) {
  return buildLessonEvalContext({ components: [page(nodes)], ...(database ? { database } : {}) });
}

/** The caller's real shape: one snapshot, both contexts. */
function bothContexts(snapshot = AFTER_THE_AUTHOR_RAN_IT) {
  return { starter: ctx(STARTER_NODES, snapshot), solution: ctx(SOLUTION_NODES, snapshot) };
}

const SAVE_EXISTS = { node: '/#__page__/Home:%Page:#Save', exists: true } as const;

function lesson(...steps: LessonManifest['steps']): LessonManifest {
  return { format: 'noodl-lesson@1', title: 'Save a puppy', steps };
}

/** AC5's shape: a structural step, then a step that is *only* about the data. */
const GRAPH_THEN_DATA = lesson(
  { title: 'Add the node', completeWhen: [SAVE_EXISTS] },
  { title: 'Create a record', completeWhen: [{ collection: 'Puppies', rowCountAtLeast: 1 }] }
);

function codes(scorecard: Awaited<ReturnType<typeof verifyLessonBundle>>) {
  return scorecard.findings.map((f) => f.code);
}

// ─── The defect ─────────────────────────────────────────────────────────────

describe("F2′ has no opinion about a step that grades against the database", () => {
  it('🔴 a pure-data step is not convicted as ghostwritten when the snapshot reaches both contexts', async () => {
    const scorecard = await verifyLessonBundle(GRAPH_THEN_DATA, bothContexts());

    expect(scorecard.classes.F2).toBe('pass');
    expect(codes(scorecard)).not.toContain('already-satisfied-in-starter');
  });

  it('says which half went unchecked, rather than reading as a clean pass', async () => {
    const scorecard = await verifyLessonBundle(GRAPH_THEN_DATA, bothContexts());

    // The data step is index 1. Silence here is the failure mode this project keeps paying for:
    // "checked and clean" and "never asked" must not look the same.
    const notChecked = scorecard.findings.filter((f) => f.code === 'not-checked' && f.step === 1);
    expect(notChecked.some((f) => /pre-made/.test(f.message))).toBe(true);
  });

  it('🔴 the known-firing control: F2′ still convicts a genuinely ghostwritten STRUCTURAL step', async () => {
    // Held constant: the same snapshot on both contexts, the same harness. Varied: the step now
    // asserts something the STARTER already satisfies. Without this, the two cases above would pass
    // just as well against a harness that had stopped running F2′ at all.
    const ghostwritten = lesson({
      title: 'Find the page',
      completeWhen: [{ node: '/#__page__/Home:%Page', exists: true }]
    });
    const scorecard = await verifyLessonBundle(ghostwritten, bothContexts());

    expect(scorecard.classes.F2).toBe('fail');
    expect(codes(scorecard)).toContain('already-satisfied-in-starter');
  });

  it('a MIXED step is not convicted on its structural half alone', async () => {
    // The over-report a partial replay would produce: the starter legitimately has the Page, and a
    // step reading "the Page exists AND a row exists" cannot tick itself on arrival — the learner
    // still has to make the row. F2′ must not split the conjunction and convict on the half it can
    // answer.
    const mixed = lesson({
      title: 'Save one',
      completeWhen: [{ node: '/#__page__/Home:%Page', exists: true }, { collection: 'Puppies', rowCountAtLeast: 1 }]
    });
    const scorecard = await verifyLessonBundle(mixed, bothContexts());

    expect(codes(scorecard)).not.toContain('already-satisfied-in-starter');
  });
});

// ─── F2 proper is untouched ─────────────────────────────────────────────────

describe('the F2 half still grades the data conditions it was given a snapshot for', () => {
  it('🔴 an empty database still reports the data step dead on its own solution', async () => {
    // The guard above suppresses F2′ only. A snapshot that genuinely does not satisfy the step is
    // still the finding the author asked for by naming a backend — otherwise the fix would have
    // traded a false conviction for a blind spot.
    const empty: LessonDatabaseSnapshot = { status: 'ok', collections: [] };
    const scorecard = await verifyLessonBundle(GRAPH_THEN_DATA, bothContexts(empty));

    expect(scorecard.classes.F2).toBe('fail');
    expect(codes(scorecard)).toContain('dead-on-solution');
  });

  it('and a structural step with no database in play is graded exactly as before', async () => {
    const scorecard = await verifyLessonBundle(lesson({ title: 'Add the node', completeWhen: [SAVE_EXISTS] }), {
      starter: ctx(STARTER_NODES),
      solution: ctx(SOLUTION_NODES)
    });

    expect(scorecard.classes.F2).toBe('pass');
    expect(codes(scorecard)).not.toContain('already-satisfied-in-starter');
  });
});
