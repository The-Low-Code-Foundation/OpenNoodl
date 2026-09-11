/**
 * UNI-006's bridge, at the editor end — **"check my work" hands the work in.**
 *
 * 🔴 THIS IS *BUILD THE CALLER*, ONE LEVEL FURTHER OUT THAN SLICE 4 WAS. That slice found
 * `gradeLesson` had no caller and built the button. The platform then built `submitWork`,
 * specced it against a real database, and drove it — and nothing in either repo ever sent a
 * bundle from an editor to a platform, because `assignmentsForMember` was a reader with no
 * route and the route, once it existed, had no client. UNI-006 wrote the limit down rather
 * than implying it: *"every write is reachable only from a test."*
 *
 * ───────────────────────────────────────────────────────────────────────────────
 * 🔴 THE CONSEQUENCES, WRITTEN FIRST. The dangerous direction here is not a failed submit —
 * it is a submit that FAILS and reads as success, because a pupil who believes they handed
 * their homework in stops trying.
 *
 *   1. An assigned lesson submits, and sends the NARROWED bundle — not the raw one.
 *   2. 🔴 **A lesson with no assignment sends nothing at all.** D5 rules the Learning folder
 *      works with no platform and no account; a grader that phoned home for every lesson
 *      would repeal that quietly.
 *   3. **The grade survives every failure below it.** Refused, offline, signed out — the
 *      local grade is recorded first and nothing undoes it.
 *   4. 🔴 **`submittedAt` is written ONLY on acceptance.** It is the field somebody would read
 *      to decide whether a pupil was late.
 *   5. **No sentence claims a hand-in that did not happen**, asserted over EVERY outcome
 *      rather than over the two that were convenient to write.
 *   6. A thrown port is an outcome, not an exception — the grade is already recorded.
 */

import { checkMyWork, summariseSubmission } from '../../src/editor/src/models/lessoncheck';
import type { CheckMyWorkDeps, SubmissionOutcome } from '../../src/editor/src/models/lessoncheck';
import type { LearningEntryView } from '../../src/editor/src/models/learningfolder';
import type { LessonManifest } from '../../src/editor/src/models/lessonformat';
import type { LessonEvidence } from '../../src/editor/src/models/lessongrading';
import type {
  LessonComponent,
  LessonEvalContext,
  LessonNode
} from '../../src/editor/src/views/lessons/lessonevalconditions';

// ─── Fixtures ───────────────────────────────────────────────────────────────

function node(label: string, type: string): LessonNode {
  return {
    id: label,
    label,
    type: { name: type },
    ports: [],
    parameters: {},
    children: [],
    getPort: () => undefined,
    forAllConnectionsOnThisNode: () => undefined
  };
}

function context(roots: LessonNode[]): LessonEvalContext {
  const components: LessonComponent[] = [{ name: 'App', graph: { roots } }];
  return {
    components,
    rootNode: roots[0],
    getMetaData: () => undefined,
    viewerPath: undefined,
    activeComponentName: 'App'
  };
}

const manifest: LessonManifest = {
  format: 'noodl-lesson@1',
  title: 'State on a page',
  steps: [
    { title: 'Add a Group', completeWhen: [{ node: 'App:%Group', exists: true }] },
    { title: 'Add a Text', completeWhen: [{ node: 'App:%Text', exists: true }] }
  ]
};

const ASSIGNED: LearningEntryView = {
  id: 'state-on-a-page',
  title: 'State on a page',
  provenance: 'org',
  projectDirectory: '/learning/state-on-a-page',
  source: { kind: 'platform', url: 'https://community.nodegx.io/x' },
  installedAt: '2026-08-19T09:00:00.000Z',
  missing: false,
  assignment: { assignmentId: 'a5f0f1a2-0000-4000-8000-000000000001', orgSlug: 'ashfield-high' }
};

/** The same lesson, installed by the learner rather than set by a school. */
const PERSONAL: LearningEntryView = { ...ASSIGNED, assignment: undefined };
delete (PERSONAL as { assignment?: unknown }).assignment;

interface Sent {
  assignmentId: string;
  evidence: LessonEvidence;
}
interface Submitted {
  id: string;
  accepted: { submittedAt: string; state: string };
}

function harness(
  options: {
    entry?: LearningEntryView;
    outcome?: SubmissionOutcome;
    throws?: Error;
  } = {}
) {
  const entry = options.entry ?? ASSIGNED;
  const sent: Sent[] = [];
  const submissions: Submitted[] = [];
  const grades: LessonEvidence[] = [];

  const deps: CheckMyWorkDeps = {
    register: {
      get: (id: string) => (id === entry.id ? entry : undefined),
      recordGrade: (_id, evidence) => {
        grades.push(evidence);
        return undefined;
      },
      recordSubmission: (id, accepted) => {
        submissions.push({ id, accepted });
        return undefined;
      }
    },
    readManifest: () => manifest,
    evalContext: () => context([node('Card', 'Group'), node('T', 'Text')]),
    submitAssignment: async (assignmentId, evidence) => {
      sent.push({ assignmentId, evidence });
      if (options.throws) throw options.throws;
      return options.outcome ?? { result: 'accepted', state: 'graded', score: 100 };
    },
    now: () => '2026-08-19T10:00:00.000Z'
  };

  return { deps, sent, submissions, grades, entry };
}

// ─── 1 and 2 — who submits, and who must not ────────────────────────────────

describe('an assigned lesson hands itself in; a personal one never does', () => {
  it('submits to the assignment the entry names, once', async () => {
    const h = harness();
    const outcome = await checkMyWork(h.entry.id, h.deps);

    expect(outcome.result).toBe('graded');
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0].assignmentId).toBe('a5f0f1a2-0000-4000-8000-000000000001');
    if (outcome.result !== 'graded') throw new Error('unreachable');
    expect(outcome.submission).toEqual({ result: 'accepted', state: 'graded', score: 100 });
  });

  it('🔴 a lesson with no assignment sends NOTHING — D5 works with no platform at all', async () => {
    const h = harness({ entry: PERSONAL });
    const outcome = await checkMyWork(h.entry.id, h.deps);

    expect(h.sent).toEqual([]);
    expect(h.submissions).toEqual([]);
    // And it is still fully graded — the control that proves the assertion above is about
    // the assignment link and not about a harness where nothing ran.
    expect(h.grades).toHaveLength(1);
    if (outcome.result !== 'graded') throw new Error('unreachable');
    expect(outcome.submission).toEqual({ result: 'notAttempted' });
  });

  it('sends nothing when the build has no bridge wired, and still grades', async () => {
    const h = harness();
    const outcome = await checkMyWork(h.entry.id, { ...h.deps, submitAssignment: undefined });
    expect(h.sent).toEqual([]);
    expect(h.grades).toHaveLength(1);
    if (outcome.result !== 'graded') throw new Error('unreachable');
    expect(outcome.submission).toEqual({ result: 'notAttempted' });
  });
});

// ─── 3 and 4 — what survives a failure ──────────────────────────────────────

describe('the grade is local and survives everything the network does', () => {
  const failures: SubmissionOutcome[] = [
    { result: 'unauthenticated' },
    { result: 'refused', detail: 'that assignment is closed and takes no more submissions' },
    { result: 'failed', detail: 'network down' }
  ];

  for (const outcome of failures) {
    it(`records the grade anyway when the submit comes back ${outcome.result}`, async () => {
      const h = harness({ outcome });
      const result = await checkMyWork(h.entry.id, h.deps);

      expect(result.result).toBe('graded');
      expect(h.grades).toHaveLength(1);
      expect(h.grades[0].completionPercent).toBe(100);
      // 🔴 AND NO submittedAt. This is the field somebody reads to decide whether a pupil
      // was late; writing it on a refused attempt would say they handed in when they did not.
      expect(h.submissions).toEqual([]);
    });
  }

  it('writes submittedAt exactly once, and only on acceptance', async () => {
    const h = harness({ outcome: { result: 'accepted', state: 'submitted', score: null } });
    await checkMyWork(h.entry.id, h.deps);

    expect(h.submissions).toEqual([
      { id: 'state-on-a-page', accepted: { submittedAt: '2026-08-19T10:00:00.000Z', state: 'submitted' } }
    ]);
  });

  it('a null score with state submitted is acceptance, not failure (D13)', async () => {
    const h = harness({ outcome: { result: 'accepted', state: 'submitted', score: null } });
    const result = await checkMyWork(h.entry.id, h.deps);
    if (result.result !== 'graded') throw new Error('unreachable');
    expect(result.submission).toEqual({ result: 'accepted', state: 'submitted', score: null });
    expect(h.submissions).toHaveLength(1);
  });

  it('a port that throws is an outcome, because the grade is already recorded', async () => {
    const h = harness({ throws: new Error('boom') });
    const result = await checkMyWork(h.entry.id, h.deps);

    expect(result.result).toBe('graded');
    expect(h.grades).toHaveLength(1);
    if (result.result !== 'graded') throw new Error('unreachable');
    expect(result.submission).toEqual({ result: 'failed', detail: 'boom' });
    expect(h.submissions).toEqual([]);
  });
});

// ─── 1b — what actually goes over the wire ──────────────────────────────────

describe('what the port is handed', () => {
  it('receives the full evidence bundle — the narrowing is the transport job', async () => {
    // ⚠️ Deliberate: `checkMyWork` hands the whole bundle to the port, and
    // `liveSubmitAssignment` calls `submittedEvidence` on it. Narrowing here would put the
    // allow-list two modules away from `LessonEvidence`, which is the file somebody edits
    // when they add a field — and `tests-unit/uni-006/submittedevidence.test.ts` is the gate
    // that fires there.
    const h = harness();
    await checkMyWork(h.entry.id, h.deps);
    expect(h.sent[0].evidence.lessonTitle).toBe('State on a page');
    expect(h.sent[0].evidence.completionPercent).toBe(100);
  });

  it('sends the grade it just recorded, not a second computation of it', async () => {
    const h = harness();
    await checkMyWork(h.entry.id, h.deps);
    expect(h.sent[0].evidence).toEqual(h.grades[0]);
  });
});

// ─── 5 — the sentences ──────────────────────────────────────────────────────

describe('summariseSubmission — nothing claims a hand-in that did not happen', () => {
  const HANDED_IN = /handed in/i;

  it('says nothing at all when there was nothing to hand in', () => {
    expect(summariseSubmission({ result: 'notAttempted' })).toBe('');
  });

  it('names the school when it succeeded', () => {
    const said = summariseSubmission({ result: 'accepted', state: 'graded', score: 90 }, 'ashfield-high');
    expect(said).toContain('ashfield-high');
    expect(said).toMatch(HANDED_IN);
  });

  it('tells a learner waiting on a person that a person will look', () => {
    const said = summariseSubmission({ result: 'accepted', state: 'submitted', score: null });
    expect(said).toMatch(/a person will look/i);
  });

  /**
   * 🔴 QUANTIFIED OVER EVERY FAILING OUTCOME, not over the two that were easy to write. The
   * damage available to this string is a pupil who believes they submitted and stops trying,
   * and a hand-written list of cases is how the outcome added next year escapes the rule.
   */
  const everyFailure: SubmissionOutcome[] = [
    { result: 'unauthenticated' },
    { result: 'refused', detail: 'that assignment is closed and takes no more submissions' },
    { result: 'failed', detail: 'network down' }
  ];

  for (const outcome of everyFailure) {
    it(`says NOT handed in, plainly, for ${outcome.result}`, () => {
      const said = summariseSubmission(outcome, 'ashfield-high');
      expect(said).toMatch(/not handed in/i);
      // The negation must be adjacent to the claim, not somewhere else in the sentence: a
      // string containing "handed in" preceded by nothing readable as a negation is the
      // failure mode this guards.
      expect(said.toLowerCase().indexOf('handed in')).toBe(said.toLowerCase().indexOf('not handed in') + 4);
    });
  }

  it('passes the platform own words through on a refusal, because it chose them', () => {
    const said = summariseSubmission(
      { result: 'refused', detail: 'that assignment is closed and takes no more submissions' },
      'ashfield-high'
    );
    expect(said).toContain('closed and takes no more submissions');
  });

  it('tells an offline learner their work is safe, and what to do', () => {
    const said = summariseSubmission({ result: 'failed', detail: 'ECONNREFUSED' });
    expect(said).toMatch(/graded and saved/i);
    expect(said).toMatch(/again when you are back online/i);
    // 🔴 And never the raw transport detail — "ECONNREFUSED" is not a sentence for a pupil.
    expect(said).not.toContain('ECONNREFUSED');
  });
});
