/**
 * UNI-007 AC1, the editor half — the intake, the path, and the three refusals.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔴 THE TWO ASSERTIONS THIS FILE EXISTS FOR, and neither is about rendering:
 *
 * 1. **The editor prints the platform's sentence about what the path can deliver, and does not
 *    reconstruct it.** Proved the only way it can be proved — by handing the view a payload
 *    whose `ready`/`total` **contradict** its own `truth`, and requiring the sentence. A
 *    version that recomputed would produce the plausible string and the wrong one, and every
 *    other assertion in this file would still pass.
 *
 * 2. **"Signed out" and "could not reach the community" must DISAGREE.** They were the same
 *    outcome in `communityapi.ts` until 2026-08-20 — `get()` had no 401 branch — and no route
 *    exercised it, because `GET /me/path` is the first read on this API that answers 401.
 *    So the two arms are asserted against each other rather than one being asserted alone:
 *    a control pair whose arms produce the same answer has measured nothing.
 *
 * ⚠️ Every fixture here is shaped from the platform's own types (`nodegx-community`,
 * `src/lib/pathing.ts` and `src/lib/projection/projector.ts`). Where a value is a literal from
 * the wire it is written out rather than built from a helper, so a change on the platform side
 * shows up here as a compile error rather than as a fixture that quietly agrees with itself.
 */

import type { IntakeState, LearnerPath, PathState, PathStep, Read } from '../../src/editor/src/models/community/communityapi';
import {
  durationLabel,
  learnerPathSurface,
  projectionNote,
  standingLabel
} from '../../src/editor/src/models/community/learnerpathview';

const QUESTIONS = [
  {
    key: 'experience',
    prompt: 'Have you written code before?',
    options: [
      { value: 'none', label: 'No, this would be my first time' },
      { value: 'some', label: 'A little — I can follow along' },
      { value: 'fluent', label: 'Yes, I write code regularly' }
    ]
  },
  {
    key: 'logic',
    prompt: 'When something gets complicated, which would you rather do?',
    options: [
      { value: 'visual', label: 'Wire it up visually so I can see it' },
      { value: 'code', label: 'Write a few lines of code' }
    ]
  },
  {
    key: 'building',
    prompt: 'What do you want to build first?',
    options: [
      { value: 'interactive', label: 'Something people click and play with' },
      { value: 'data-app', label: 'An app that stores and looks things up' },
      { value: 'custom-nodes', label: 'My own nodes, to use in other projects' }
    ]
  }
];

function step(over: Partial<PathStep> = {}): PathStep {
  return {
    slug: 'where-state-lives',
    title: 'Where state lives',
    description: 'Variables, and the things that read them.',
    teaches: 'state',
    estimatedMinutes: 25,
    nodes: ['Variable'],
    needs: null,
    track: 'spine',
    standing: { kind: 'in-writing' },
    reason: 'Part of the spine everybody walks.',
    projection: null,
    ...over
  };
}

function path(over: Partial<LearnerPath> = {}): LearnerPath {
  const steps = over.steps ?? [step()];
  return {
    steps,
    omitted: [],
    ready: 0,
    total: steps.length,
    minutes: steps.reduce((sum, s) => sum + s.estimatedMinutes, 0),
    truth:
      'This is your path — 1 lessons in the order they build on each other. None of them can be installed yet: every one is still being written. The path is real; the lessons are the work in front of us.',
    ...over
  };
}

const intakeOk: Read<IntakeState> = { outcome: 'ok', value: { questions: QUESTIONS, answers: null } };

function pathRead(value: PathState): Read<PathState> {
  return { outcome: 'ok', value };
}

// ───────────────────────────────────────────────────────────────────────────────
// 1. The sentence is the platform's
// ───────────────────────────────────────────────────────────────────────────────

describe('the truth sentence', () => {
  it('is printed verbatim even when the counts beside it say something else', () => {
    // 🔴 THE GRADING ASSERTION OF THIS FILE. The payload claims 4 of 6 are ready and its own
    // sentence says none of them can be installed. A view that recomputed from ready/total
    // would say "4 of the 6 lessons on your path are ready to install" — plausible, wrong, and
    // invisible to every other test here. Same shape as `entryPointFor`'s spec for D16.
    const contradictory = path({
      ready: 4,
      total: 6,
      truth: 'None of them can be installed yet: every one is still being written.'
    });

    const surface = learnerPathSurface({
      intake: intakeOk,
      path: pathRead({ intake: { experience: 'none', logic: 'visual', building: 'interactive' }, path: contradictory })
    });

    if (surface.state !== 'path') throw new Error(`expected a path, got ${surface.state}`);
    expect(surface.truth).toBe('None of them can be installed yet: every one is still being written.');
    expect(surface.truth).not.toContain('ready to install');
    // The counts are carried too — the point is that they are carried, not derived from.
    expect(surface.ready).toBe(4);
    expect(surface.total).toBe(6);
  });

  it('is never dropped when the path is otherwise complete-looking', () => {
    // The temptation this guards: an eight-step path with titles and times reads like a
    // product, and the one string saying it delivers nothing is the one a tidy-up removes.
    const surface = learnerPathSurface({
      intake: intakeOk,
      path: pathRead({
        intake: { experience: 'fluent', logic: 'code', building: 'data-app' },
        path: path({ steps: [step(), step({ slug: 'b', title: 'B' }), step({ slug: 'c', title: 'C' })] })
      })
    });

    if (surface.state !== 'path') throw new Error(`expected a path, got ${surface.state}`);
    expect(surface.truth.length).toBeGreaterThan(0);
  });
});

// ───────────────────────────────────────────────────────────────────────────────
// 2. Signed out vs unreachable — the arms must DISAGREE
// ───────────────────────────────────────────────────────────────────────────────

describe('the three refusals', () => {
  it('tells signed-out and could-not-reach apart, and the two arms differ', () => {
    const signedOut = learnerPathSurface({
      intake: intakeOk,
      path: { outcome: 'unauthenticated' }
    });
    const down = learnerPathSurface({
      intake: intakeOk,
      path: { outcome: 'unreachable', status: null, detail: 'fetch failed' }
    });

    expect(signedOut.state).toBe('signed-out');
    expect(down.state).toBe('unreachable');
    // 🔴 The assertion that carries the finding: BEFORE 2026-08-20 both of these were
    // `unreachable`, because `get()` had no 401 branch. Asserting either one alone would have
    // passed against the defect.
    expect(signedOut.state).not.toBe(down.state);
  });

  it('still shows the questions when signed out, because that read needs no token', () => {
    const surface = learnerPathSurface({ intake: intakeOk, path: { outcome: 'unauthenticated' } });
    if (surface.state !== 'signed-out') throw new Error(`expected signed-out, got ${surface.state}`);
    expect(surface.questions).toHaveLength(3);
    expect(surface.questions[1].options.map((o) => o.label)).toContain('Write a few lines of code');
  });

  it('draws NOTHING for a D15-refused viewer, and does not offer a sign-in', () => {
    // `absent` outranks every other branch: a pupil whose school switched the community off
    // must not be told there is a door to sign in at.
    expect(learnerPathSurface({ intake: { outcome: 'absent' }, path: undefined }).state).toBe('hidden');
    expect(
      learnerPathSurface({ intake: intakeOk, path: { outcome: 'absent' } }).state
    ).toBe('hidden');
  });

  it('reports the platform detail on an unreachable intake read', () => {
    const surface = learnerPathSurface({
      intake: { outcome: 'unreachable', status: 503, detail: 'HTTP 503' },
      path: undefined
    });
    if (surface.state !== 'unreachable') throw new Error(`expected unreachable, got ${surface.state}`);
    expect(surface.detail).toBe('HTTP 503');
  });
});

// ───────────────────────────────────────────────────────────────────────────────
// 3. No intake is a form, not a missing thing
// ───────────────────────────────────────────────────────────────────────────────

describe('the intake form', () => {
  it('is what a learner with no intake sees — not an error and not an empty path', () => {
    const surface = learnerPathSurface({
      intake: intakeOk,
      path: pathRead({ intake: null, path: null })
    });
    if (surface.state !== 'intake') throw new Error(`expected intake, got ${surface.state}`);
    expect(surface.questions).toHaveLength(3);
    expect(surface.retaking).toBe(false);
    expect(surface.canSubmit).toBe(false);
  });

  it('will not submit a partial set — the platform refuses one rather than merging it', () => {
    const partial = learnerPathSurface({
      intake: intakeOk,
      path: pathRead({ intake: null, path: null }),
      chosen: { experience: 'none', logic: 'visual' }
    });
    if (partial.state !== 'intake') throw new Error(`expected intake, got ${partial.state}`);
    expect(partial.canSubmit).toBe(false);

    const whole = learnerPathSurface({
      intake: intakeOk,
      path: pathRead({ intake: null, path: null }),
      chosen: { experience: 'none', logic: 'visual', building: 'data-app' }
    });
    if (whole.state !== 'intake') throw new Error(`expected intake, got ${whole.state}`);
    expect(whole.canSubmit).toBe(true);
  });

  it('cannot submit when the question set never arrived, even with answers held', () => {
    // 🔴 An empty question list makes `every()` vacuously true. Without the length check a
    // learner whose intake read failed would get an enabled Submit for a form with no
    // questions in it — the classic vacuous-truth pass, and the reason `canSubmit` is not
    // simply `every()`.
    const surface = learnerPathSurface({
      intake: { outcome: 'ok', value: { questions: [], answers: null } },
      path: pathRead({ intake: null, path: null }),
      chosen: { experience: 'none', logic: 'visual', building: 'data-app' }
    });
    if (surface.state !== 'intake') throw new Error(`expected intake, got ${surface.state}`);
    expect(surface.canSubmit).toBe(false);
  });

  it('retaking shows the form over a held path, and says it is a retake', () => {
    const surface = learnerPathSurface({
      intake: intakeOk,
      path: pathRead({ intake: { experience: 'none', logic: 'visual', building: 'interactive' }, path: path() }),
      retaking: true
    });
    if (surface.state !== 'intake') throw new Error(`expected intake, got ${surface.state}`);
    expect(surface.retaking).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────────────────
// 4. "Visibly different" is the omissions, not the shorter list
// ───────────────────────────────────────────────────────────────────────────────

describe('what the intake branched away', () => {
  it('carries the omitted lessons and the platform’s reason for each', () => {
    // 🔴 AC1's word is *visibly*. A filter produces a shorter list, and a shorter list is not
    // visible to a learner who never saw the long one. The omission block is the half a filter
    // cannot produce, so it is asserted directly rather than by comparing lengths.
    const surface = learnerPathSurface({
      intake: intakeOk,
      path: pathRead({
        intake: { experience: 'none', logic: 'visual', building: 'interactive' },
        path: path({
          omitted: [
            {
              slug: 'mapping-to-code',
              title: 'Mapping a graph to code',
              reason: 'You said you would rather wire it up visually, so this one is off your path.'
            }
          ]
        })
      })
    });

    if (surface.state !== 'path') throw new Error(`expected a path, got ${surface.state}`);
    expect(surface.omitted).toHaveLength(1);
    expect(surface.omitted[0].reason).toContain('wire it up visually');
  });

  it('numbers steps from one and carries each step’s own reason', () => {
    const surface = learnerPathSurface({
      intake: intakeOk,
      path: pathRead({
        intake: { experience: 'fluent', logic: 'code', building: 'custom-nodes' },
        path: path({
          steps: [
            step({ slug: 'a', title: 'A', reason: 'Part of the spine everybody walks.' }),
            step({ slug: 'b', title: 'B', reason: 'You asked to build your own nodes.', track: 'custom-nodes' })
          ]
        })
      })
    });

    if (surface.state !== 'path') throw new Error(`expected a path, got ${surface.state}`);
    expect(surface.steps.map((s) => s.position)).toEqual([1, 2]);
    expect(surface.steps[1].reason).toBe('You asked to build your own nodes.');
  });
});

// ───────────────────────────────────────────────────────────────────────────────
// 5. Standing, installability, and the projection offer
// ───────────────────────────────────────────────────────────────────────────────

describe('a step’s standing', () => {
  it('labels all three kinds, and a blocked lesson names the one it waits on', () => {
    expect(standingLabel({ kind: 'ready' })).toBe('Ready');
    expect(standingLabel({ kind: 'in-writing' })).toBe('In writing');
    expect(standingLabel({ kind: 'needs', lesson: { slug: 'state', title: 'Where state lives' } })).toBe(
      'Needs “Where state lives” first'
    );
  });

  it('calls only a `ready` lesson installable — `needs` is not ready', () => {
    const surface = learnerPathSurface({
      intake: intakeOk,
      path: pathRead({
        intake: { experience: 'some', logic: 'visual', building: 'data-app' },
        path: path({
          steps: [
            step({ slug: 'a', standing: { kind: 'ready' } }),
            step({ slug: 'b', standing: { kind: 'in-writing' } }),
            step({ slug: 'c', standing: { kind: 'needs', lesson: { slug: 'a', title: 'A' } } })
          ]
        })
      })
    });

    if (surface.state !== 'path') throw new Error(`expected a path, got ${surface.state}`);
    expect(surface.steps.map((s) => s.installable)).toEqual([true, false, false]);
  });

  it('stops offering a projection once one exists, because a second press cannot make one', () => {
    const surface = learnerPathSurface({
      intake: intakeOk,
      path: pathRead({
        intake: { experience: 'none', logic: 'visual', building: 'interactive' },
        path: path({
          steps: [
            step({ slug: 'a', projection: null }),
            step({ slug: 'b', projection: 'Think of it as your `let x = 0`.' })
          ]
        })
      })
    });

    if (surface.state !== 'path') throw new Error(`expected a path, got ${surface.state}`);
    expect(surface.steps.map((s) => s.projectable)).toEqual([true, false]);
    expect(surface.steps[1].projection).toContain('let x = 0');
  });
});

describe('projectionNote', () => {
  it('says nothing beside a projection that rendered', () => {
    expect(projectionNote({ kind: 'ready', fresh: true })).toBeNull();
  });

  it('words D10’s refusal as a setting, never as a failure', () => {
    const refused = projectionNote({ kind: 'refused', reason: 'org minor' });
    const failed = projectionNote({ kind: 'failed', failure: 'timeout' });

    expect(refused).not.toBeNull();
    // 🔴 The arms must disagree. A client that folded `refused` into `failed` would report a
    // school's policy as a bug in the product, and asserting only that `refused` produces
    // *some* sentence would pass against exactly that.
    expect(refused).not.toBe(failed);
    expect(refused).toContain('switched off');
    expect(refused).not.toMatch(/fail|error|wrong/i);
    expect(refused).toContain('complete');
  });

  it('says a failure will not retry itself, because it will not', () => {
    expect(projectionNote({ kind: 'failed', failure: 'timeout' })).toContain('not be retried');
  });

  it('distinguishes "nobody configured a model" from "we refused you"', () => {
    expect(projectionNote({ kind: 'unavailable', reason: 'no projector' })).not.toBe(
      projectionNote({ kind: 'refused', reason: 'org minor' })
    );
  });
});

describe('durationLabel', () => {
  it('never claims a precision the estimate does not have', () => {
    expect(durationLabel(35)).toBe('35 minutes');
    expect(durationLabel(60)).toBe('about an hour');
    expect(durationLabel(150)).toBe('about 2.5 hours');
    expect(durationLabel(240)).toBe('about 4 hours');
    // 2.7 hours is a number a machine produced from a guess in curriculum.json.
    expect(durationLabel(162)).not.toContain('2.7');
  });
});
