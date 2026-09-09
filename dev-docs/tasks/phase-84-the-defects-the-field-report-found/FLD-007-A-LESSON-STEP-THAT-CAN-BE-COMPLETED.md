# FLD-007 — A lesson step that can be completed

One line, wrong since the initial commit, and it silently breaks every lesson step keyed to a route
without a query string. Reported in **November 2024** and never answered.

## 1. The person sentence

**Someone finishing a lesson does what the step tells them to do, and the step ticks.**

## 2. What was reported, and what the code says

[#5](https://github.com/The-Low-Code-Foundation/NodeGX/issues/5): the final task of *Data Driven
Pages* says *"Click the button to navigate back to the Task page"*. Doing that navigates correctly
and does **not** complete the task. It completed only via the Start Page.

Measured 2026-09-09:

- The lesson is `lesson_05_page-navigation`, served from the content CDN
  (`getContentEndpoint()` → `nodegx-content/static`), not from this repo.
- Its final step's condition is literally `data-conditions='[{ "viewerpatheq":"/task-page" }]'`.
- `views/VisualCanvas/CanvasView.ts:58`:
  ```js
  window.noodlEditorPreviewRoute = state.route.substring(0, state.route.indexOf('?'));
  ```
  With no `?`, `indexOf` returns `-1` and `substring(0, -1)` returns **`''`**. Verified:
  `'/task-page'.substring(0, '/task-page'.indexOf('?')) === ''`.
- The condition is strict equality — `lessonevalconditions.ts:643` — against `viewerPath` read from
  that same global (`lessonevalconditions.live.ts:67`). So `'/task-page' === ''` is false, forever.

🔴 **The asymmetry is the proof.** The lesson's *other* `viewerpatheq` step is `"/details-page"`, and
the Details page is navigated to **with a page parameter** — which is what the lesson teaches. Its
URL carries `?`, the truncation works, and that step ticks. The Task page carries none.

The sibling assignment at `CanvasView.ts:200` (`setCurrentRoute`) writes the route **untruncated**,
which is why editor-driven navigation behaves differently from in-app navigation — consistent with
the reporter's "it only completed from the Start Page".

Unchanged since the initial commit; every commit touching this file since is unrelated.

## 3. Scope

- Fix the line: keep the whole route when there is no query.
- 🔴 **Sweep, do not spot-fix.** This breaks *every* `viewerpatheq` condition on a query-less route,
  which is most of them. Enumerate the conditions across the shipped lesson set and the in-repo
  bundles and report how many were dead. That count is the finding.
- **Answer the contributor's other question**, which is half the issue and has never been answered:
  where a lesson is patched. There are now two places — the hosted legacy lessons in the separate
  content repo under `static/lessons/<slug>/`, and the newer in-repo bundles under
  `project-examples/lessons/<slug>/` with a declarative `lesson.json` (`models/lessonformat.ts`,
  conditions compiled at `:290`, `:588-612`).

## 4. Acceptance criteria

1. **(person)** Run the *Data Driven Pages* lesson to its final task, click the button the step names,
   and the task completes.
2. A unit arm on the `-1` case: a route with no query returns itself; a route with a query returns
   the part before it. Reverted arm: restore the `substring` and the query-less case returns empty.
3. 🔴 **The sweep is reported as a number**: how many shipped lesson conditions were unreachable
   before this fix, named. A fix with no count leaves us unable to say what we repaired.
4. A condition that *should* fail still fails — navigate somewhere else and the step does not tick.
   Without this, "everything completes now" is indistinguishable from a broken condition evaluator.
5. The reply to [#5](https://github.com/The-Low-Code-Foundation/NodeGX/issues/5) answers both halves,
   including where to patch a lesson.

## 5. Traps

- ⚠️ `CanvasView.ts` is **not reachable from the jest runner** — the same constraint FIX-025 records
  at `lessonlayer2.ts:355-362`. Put the arm on an extracted pure function, not on the class.
- ⚠️ The blast radius is lesson conditions only: this global is read in exactly one place
  (`lessonevalconditions.live.ts:67`). Confirm that is still true before widening the claim.
- ⚠️ The lesson content is in **another repository**. The fix here is in the editor; do not edit the
  lesson to work around a client bug, which would leave the next lesson broken.
