/**
 * FLD-007 — a lesson step keyed to a query-less route can complete.
 *
 * Issue #5 (November 2024): the final task of *Data Driven Pages* says "click the button to
 * navigate back to the Task page". Doing that navigates correctly and the step never ticks.
 *
 * The cause is one expression in `views/VisualCanvas/CanvasView.ts`, which wrote the global the
 * lesson evaluator reads as `route.substring(0, route.indexOf('?'))`. `'/task-page'.indexOf('?')`
 * is `-1`, and `substring(0, -1)` is `''`, so `viewerpatheq` compared the authored path against
 * the empty string — forever, for every route the learner reaches without a page parameter.
 *
 * 🔴 The arms below grade the **consequence**, not the string operation: the last two run the real
 * `evaluateSingleCondition` from `views/lessons/lessonevalconditions.ts` over a context built the
 * way `lessonevalconditions.live.ts` builds it, so a repair that fixed the substring while leaving
 * the condition unsatisfiable would still be red here. The reverted arm restates the old
 * expression and shows the step could not tick under it.
 */
import { evaluateSingleCondition } from '../../src/editor/src/views/lessons/lessonevalconditions';
import type { LessonEvalContext } from '../../src/editor/src/views/lessons/lessonevalconditions';
import { previewRoutePath } from '../../src/editor/src/views/VisualCanvas/previewRoutePath';

/** What `CanvasView.ts:58` did before this task. Kept only so the reverted arm can be honest. */
const revertedPreviewRoutePath = (route: string) => route.substring(0, route.indexOf('?'));

/**
 * The context the live evaluator builds, reduced to the one field `viewerpatheq` reads.
 * Everything else is unread by this verb, and a fuller fake would only hide that.
 */
const contextForRoute = (route: string) =>
  ({ viewerPath: previewRoutePath(route) } as unknown as LessonEvalContext);

describe('FLD-007 — previewRoutePath', () => {
  it('keeps the whole route when there is no query string', () => {
    expect(previewRoutePath('/task-page')).toBe('/task-page');
    expect(previewRoutePath('/')).toBe('/');
    expect(previewRoutePath('/details-page/17')).toBe('/details-page/17');
  });

  it('returns the part before the query when there is one', () => {
    expect(previewRoutePath('/details-page?Card%20Id=17')).toBe('/details-page');
    expect(previewRoutePath('/task-page?User%20Name=Your&x=1')).toBe('/task-page');
    expect(previewRoutePath('/?a=1')).toBe('/');
  });

  it('leaves a fragment alone — hash routing is a different defect with a different fix', () => {
    expect(previewRoutePath('/#/task-page')).toBe('/#/task-page');
  });

  it('🔴 the reverted arm: the old expression returned the empty string for every query-less route', () => {
    expect(revertedPreviewRoutePath('/task-page')).toBe('');
    expect(revertedPreviewRoutePath('/create-card-page')).toBe('');
    // ...and got the with-query case right, which is exactly why the defect hid for two years:
    // the only shipped step that ticked reliably was one whose navigation carried a page parameter.
    expect(revertedPreviewRoutePath('/details-page?Card%20Id=17')).toBe('/details-page');
  });
});

describe('FLD-007 — the lesson condition the learner actually meets', () => {
  it("completes the step after the navigation issue #5 names (Details Page → Task Page, no params)", () => {
    expect(evaluateSingleCondition({ viewerpatheq: '/task-page' }, contextForRoute('/task-page'))).toBe(true);
  });

  it('still completes a step whose route carries a page parameter', () => {
    expect(
      evaluateSingleCondition({ viewerpatheq: '/details-page' }, contextForRoute('/details-page?Card%20Id=17'))
    ).toBe(true);
  });

  it('🔴 a condition that should fail still fails — otherwise "everything completes" proves nothing', () => {
    expect(evaluateSingleCondition({ viewerpatheq: '/task-page' }, contextForRoute('/create-card-page'))).toBe(false);
    expect(evaluateSingleCondition({ viewerpatheq: '/task-page' }, contextForRoute('/'))).toBe(false);
    expect(
      evaluateSingleCondition({ viewerpatheq: '/task-page' }, contextForRoute('/task-page-two'))
    ).toBe(false);
  });

  it('🔴 the reverted arm: under the old expression that same step could never tick', () => {
    const revertedContext = { viewerPath: revertedPreviewRoutePath('/task-page') } as unknown as LessonEvalContext;
    expect(evaluateSingleCondition({ viewerpatheq: '/task-page' }, revertedContext)).toBe(false);
  });
});
