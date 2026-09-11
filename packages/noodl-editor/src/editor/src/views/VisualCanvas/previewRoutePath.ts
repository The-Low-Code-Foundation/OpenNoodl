/**
 * FLD-007 — the path half of the preview route, which is what a lesson condition compares against.
 *
 * ───────────────────────────────────────────────────────────────────────────────
 * 🔴 THIS EXISTS BECAUSE ONE `substring` RETURNED THE EMPTY STRING FOR EVERY ROUTE WITHOUT A
 * QUERY, AND A LESSON STEP KEYED TO SUCH A ROUTE COULD THEN NEVER TICK.
 *
 * `CanvasView` wrote the global that `views/lessons/lessonevalconditions.live.ts` reads as
 * `route.substring(0, route.indexOf('?'))`. With no `?` in the route, `indexOf` is `-1` and
 * `substring(0, -1)` is `''` — so `viewerpatheq` (strict equality, `lessonevalconditions.ts:643`)
 * compared the authored path against nothing. Reported as
 * [#5](https://github.com/The-Low-Code-Foundation/NodeGX/issues/5) in November 2024: the last task
 * of *Data Driven Pages* says "click the button to navigate back to the Task page", the learner
 * does exactly that, and the step does not complete.
 *
 * ⚠️ **Both writers use this, and that is the point.** `CanvasView` set the same global in two
 * places with two different meanings — truncated on `load-commit` (line 58) and untruncated in
 * `setCurrentRoute` (line 200). Six of the eight shipped lesson conditions were passing only
 * because the *untruncated* write happened to land last for the way their step is phrased ("select
 * the /task-page path in the route dropdown"), and `load-commit` then clobbered it back to `''` a
 * moment later. A global that means two things is a coin toss dressed as a comparison; see
 * `a-field-that-means-two-things-breaks-on-a-fallback`.
 *
 * ⚠️ **A pure function in its own module, ON PURPOSE.** `CanvasView.ts` reaches Electron's
 * `webview`, `EventDispatcher` and `PreviewTokenInjector`, so nothing in it is reachable from the
 * jest runner — the same constraint FIX-025 records for `lessonlayer2.ts`. The rule that was wrong
 * is one string operation; putting it where a spec can call it is the difference between a
 * regression guard and a comment saying there ought to be one. See
 * `tests-unit/fld-007/preview-route-path.test.ts`.
 *
 * ⚠️ **The hash is deliberately left alone.** A project whose `navigationPathType` is `hash` (the
 * runtime default, `noodl-viewer-react/src/nodes/navigation/router.tsx`) produces routes shaped
 * `/#/task-page`, which no authored `viewerpatheq` matches either — stripping the fragment here
 * would turn that into `/` and fix nothing. That is a separate defect with a separate fix (read the
 * fragment as the path), registered rather than smuggled in here.
 *
 * @module views/VisualCanvas/previewRoutePath
 */

/**
 * The route with any query string removed, and **nothing else removed**.
 *
 * @param route the viewer route as the editor sees it — everything after `http://localhost:<port>`,
 *   so a leading `/`, optionally a `?query`, optionally a `#fragment`.
 * @returns the part before the first `?`; the whole route when there is none.
 */
export function previewRoutePath(route: string): string {
  if (typeof route !== 'string') return '';

  const query = route.indexOf('?');
  return query === -1 ? route : route.substring(0, query);
}
