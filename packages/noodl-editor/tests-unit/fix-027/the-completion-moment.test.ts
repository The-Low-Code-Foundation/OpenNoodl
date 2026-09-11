/**
 * FIX-027 §19 and §20 — finishing a lesson says so, and offers more than the door.
 *
 * ───────────────────────────────────────────────────────────────────────────────
 * 🔴 THE DEFECT, FROM DRIVING BOTH SHIPPED LESSONS.
 *
 * `loadSteps` gives a step a popup button only when `shouldButtonRender = !step.conditions`.
 * So the completion moment was a property of how the author happened to end the lesson:
 *
 *  - **Log a thing** ends on a narrative popup, so it got an `EXIT LESSON` button — §20: exit
 *    was the *only* thing offered, and reset lived on a launcher card the learner had left.
 *  - **State on a page** ends on a graded card, so it got no button and **no completion moment
 *    whatsoever** — §19. The learner satisfied the last condition and the bar stopped changing.
 *
 * ⚠️ **The two lessons finish by opposite rules, and that is the trap this file guards.**
 * `refresh()` sets `isComplete = false` on every step with no conditions, so a rule that simply
 * asked `isComplete` would report *Log a thing* unfinished forever — §19's bug inverted, and it
 * would look correct against the graded lesson, which is the one everybody checks.
 *
 * ⚠️ **What this file cannot reach, and where that is covered instead.**
 * The banner is `LessonLayerView.jsx`, which requires `electron` and `popuplayer` at module
 * scope; no runner in this repo compiles it (recorded 2026-08-25 — it is not in the jasmine
 * bundle either). So the *rule* is graded here, the *register's* half in
 * `tests-unit/uni-007/learningfolder.test.ts` (`canReset`), and the rendering is driven in the
 * real editor. Nothing here should be read as proof the banner appeared.
 */
import { isLessonFinished, stepFlowAction } from '../../src/editor/src/views/lessons/lessonstepflow';
import type { StepFlowInput } from '../../src/editor/src/views/lessons/lessonstepflow';
import {
  resetLauncherHandoff,
  stashLessonReset,
  takeLessonReset
} from '../../src/editor/src/utils/launcher/launcherHandoff';

function at(overrides: Partial<StepFlowInput> = {}): StepFlowInput {
  return { hasCurrentStep: true, hasConditions: true, isComplete: false, index: 0, stepCount: 4, ...overrides };
}

describe('§19 — a lesson that ends on a GRADED step has a completion moment', () => {
  it('🔴 "State on a page": four steps, the last one graded and now satisfied', () => {
    expect(isLessonFinished(at({ index: 3, stepCount: 4, isComplete: true }))).toBe(true);
  });

  it('is NOT finished while the last graded step is unsatisfied — arriving is not finishing', () => {
    expect(isLessonFinished(at({ index: 3, stepCount: 4, isComplete: false }))).toBe(false);
  });

  it('is NOT finished on a satisfied step that has another one after it', () => {
    expect(isLessonFinished(at({ index: 2, stepCount: 4, isComplete: true }))).toBe(false);
  });
});

describe('§20 — a lesson that ends on a NARRATIVE step finishes by the opposite rule', () => {
  /*
   * 🔴 The row that catches the inverted fix. `refresh()` never sets `isComplete` on a step with
   * no conditions, so `isComplete: false` here is not a mistake in the fixture — it is the state
   * the real layer is in when a learner is standing on *Log a thing*'s last card.
   */
  it('🔴 "Log a thing": eight steps, the last one narrative — arriving IS finishing', () => {
    expect(isLessonFinished(at({ index: 7, stepCount: 8, hasConditions: false, isComplete: false }))).toBe(true);
  });

  it('is not finished on an earlier narrative step', () => {
    expect(isLessonFinished(at({ index: 5, stepCount: 8, hasConditions: false, isComplete: false }))).toBe(false);
  });
});

describe('the edges, where a wrong answer is a banner over a lesson still in progress', () => {
  it('answers no when there is no current step', () => {
    expect(isLessonFinished(at({ hasCurrentStep: false, index: 3, stepCount: 4, isComplete: true }))).toBe(false);
  });

  it('🔴 answers no when the model reports no steps — `numberOfLessons ?? 0` before it loads', () => {
    // The layer renders before `instructionsFetched`; index 0 of 0 steps is `-1 === 0`, false by
    // arithmetic, but a `stepCount` of 0 is asserted explicitly because the honest answer there
    // is "nothing has started", not "everything is done".
    expect(isLessonFinished(at({ index: 0, stepCount: 0, hasConditions: false }))).toBe(false);
  });

  it('answers no past the end, rather than treating any overrun as completion', () => {
    expect(isLessonFinished(at({ index: 9, stepCount: 4, isComplete: true }))).toBe(false);
  });
});

/**
 * 🔴 The two answers are built from one input on purpose (`LessonLayer._flowInput`), and this is
 * the property that makes that matter: the bar must never both congratulate the learner and move
 * them on. `stepFlowAction` returns `'advance'` only where `isLessonFinished` is false.
 */
describe('the flow and the completion moment cannot disagree about the end', () => {
  it('never advances a lesson it has just called finished', () => {
    const rows: StepFlowInput[] = [];
    for (const stepCount of [1, 4, 8]) {
      for (let index = 0; index < stepCount; index++) {
        for (const hasConditions of [true, false]) {
          for (const isComplete of [true, false]) {
            rows.push({ hasCurrentStep: true, hasConditions, isComplete, index, stepCount });
          }
        }
      }
    }

    const both = rows.filter((r) => isLessonFinished(r) && stepFlowAction(r) === 'advance');
    expect(both).toEqual([]);

    // 🔴 A known-firing control beside the absence: without it, "no row does both" would also
    // pass if the grid never reached a finished row at all.
    expect(rows.filter(isLessonFinished).length).toBeGreaterThan(0);
    expect(rows.filter((r) => stepFlowAction(r) === 'advance').length).toBeGreaterThan(0);
  });
});

/**
 * FIX-027 §20 — the hand-off that lets *Start again* reset a project it is standing inside.
 *
 * 🔴 **The reset cannot run in the lesson**, because `Learning/<slug>/` IS the open project and
 * a live `ProjectModel` would write its graph back over the fresh copy. So the id is stashed,
 * the project is closed, and the launcher performs the reset. See `launcherHandoff.ts`.
 */
describe('§20 — the reset request survives the route and is consumed once', () => {
  beforeEach(() => resetLauncherHandoff());

  it('hands the lesson id to the launcher', () => {
    stashLessonReset('state-on-a-page');
    expect(takeLessonReset()).toBe('state-on-a-page');
  });

  it('🔴 is consumed on read, so a second mount does not reset the lesson AGAIN', () => {
    // Not tidiness. React 18 double-invokes mount effects, and the launcher reads this in one —
    // a second answer here would delete the learner's fresh copy a second time.
    stashLessonReset('log-a-thing');
    expect(takeLessonReset()).toBe('log-a-thing');
    expect(takeLessonReset()).toBeUndefined();
  });

  it('answers undefined when nobody asked, so an ordinary exit resets nothing', () => {
    expect(takeLessonReset()).toBeUndefined();
  });

  it('does not disturb the landing-page stash beside it', () => {
    const { stashLauncherLanding, takeLauncherLanding } = require('../../src/editor/src/utils/launcher/launcherHandoff');
    stashLauncherLanding('learning');
    stashLessonReset('log-a-thing');
    expect(takeLauncherLanding()).toBe('learning');
    expect(takeLessonReset()).toBe('log-a-thing');
  });
});
