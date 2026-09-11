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

## 4b. What was built — 2026-09-10, session 2 🟢 **BUILT** (`4068d139`)

`views/VisualCanvas/previewRoutePath.ts` — one pure function, the path half of the route — and
**both** writers in `CanvasView.ts` now call it (lines 59 and 203). The second writer is half the
story and §2 only noted it in passing: `setCurrentRoute` wrote the route *untruncated*, so the
global the evaluator reads meant two different things depending on which write landed last.

### The sweep — AC3, and the number is 1, not "most of them"

`scripts/fld-007-lesson-route-conditions.mjs` is re-runnable and fetches the live set:

```
8 hosted lessons; 9 in-repo bundles
8 route conditions (0 of them in bundles)
```

Every `viewerpatheq` in the shipped set, with the sentence the learner is given:

| lesson | condition | what the step says | before this fix |
|---|---|---|---|
| 01_basics | `/task-page` | "Type a name … click the Get Started button" | ✅ ticked |
| 02_layout | `/task-page` | "Select the /task-page path in the Path Dropdown" | ✅ ticked |
| 03_components | `/task-page` | "…select that in the Path Dropdown" | ✅ ticked |
| 04_data-driven-components | `/task-page` | "Navigate to it using the Path Dropdown" | ✅ ticked |
| 05_page-navigation | `/details-page` | "Select the /details-page path in the Path Dropdown" | ✅ ticked |
| 05_page-navigation | `/task-page` | **"Click the button to navigate back to the Task Page"** | ❌ **dead** |
| 06_store-user-data | `/create-card-page` | "…select the /create-card-page path in the Path Dropdown" | ✅ ticked |
| 07_logic-components | `/task-page` | "Select the /task-page path in the Path Dropdown" | ✅ ticked |

🔴 **§3's hypothesis was wrong, and the reason it was wrong is the finding.** Six of the eight
steps ask the learner to pick a route in the **Path Dropdown**, which goes
`EditorTopbar → onRouteChanged → canvasView.setCurrentRoute`
(`EditorDocument.tsx:199-205`) — the *untruncated* writer, which emits `viewer-navigated`
synchronously, so `lessonlayer2`'s refresh (`:171`) evaluates the condition against the full route
and the step advances. The webview's `load-commit` then fires and clobbers the global back to `''`,
but the step has already ticked. Those six were passing on a **race between two writers**, not on a
comparison. The seventh (01_basics) is an in-app click, and it survived only because that
navigation carries a page parameter — `RouterNavigate` on the Start Page sets `pm-User Name`, so
the URL has a `?` and the truncation happened to be a no-op. Measured in all seven lesson project
zips: **`/Start Page → /Task Page` is the only navigation in the shipped set that carries a param.**

The eighth is the reported one, and it is the only step in the set that asks the learner to click a
button whose navigation has no parameters (`/Details Page → /Task Page`, `params={}`). No `?`, so
`substring(0, -1)`, so `''`, so never.

**Zero of the nine in-repo `lesson.json` bundles use `previewRouteEquals` at all**, so the
declarative format has never exercised this verb — which is why nothing in `tests-unit` caught it.

### AC4 — a should-fail arm, so a green AC2 means something

`tests-unit/fld-007/preview-route-path.test.ts` runs the **real** `evaluateSingleCondition` over a
context built the way `lessonevalconditions.live.ts` builds it. Eight arms, all green: the fixed
case, the with-query case, a fragment left alone, **two reverted arms** restating the old
expression (query-less → `''`, and the step therefore `false`), and three should-fail cases
(`/create-card-page`, `/`, `/task-page-two`).

### AC5 — where a lesson is patched (the half of #5 nobody answered)

Two places, and they are different repositories:

- **The hosted legacy lessons** — hand-authored HTML, one file per lesson, at
  `nodegx-content/static/lessons/<slug>/lesson.html`, with the project starter beside it as
  `project.zip`. Steps are split on `<!-- # -->` and graded by `data-conditions` attributes. This
  is where all eight conditions above live, and it is **not** this repo.
- **The in-repo bundles** — `project-examples/lessons/<slug>/lesson.json`, a declarative manifest
  (`models/lessonformat.ts`, conditions compiled at `:290`, `:588-612`). `previewRouteEquals` is
  the authored spelling; it compiles to `viewerpatheq`.

### Found while building — not chased here

- 🔴 **Hash routing defeats every `viewerpatheq`, fix or no fix.** `navigationPathType` defaults to
  `'hash'` (`noodl-viewer-react/src/nodes/navigation/router.tsx:806-812`), which produces routes
  shaped `/#/task-page` with the query placed *before* the fragment. No authored condition matches
  that, and stripping the fragment would yield `/`. The seven lesson projects all set
  `navigationPathType: 'path'`, which is why the verb works at all. The correct fix is to read the
  fragment as the path when the project is hash-routed. **Register row, owner NONE.**
- ⚠️ **`getRelativeURL` returns `undefined` when a page has no `path` parameter**
  (`router.tsx:610-611`), yet every Page node in all seven lesson projects has `path: undefined`
  and the routes plainly work — so the default is filled in elsewhere. Not chased; noted because a
  reader of that function alone would conclude the lessons cannot navigate.

### AC1 — driven in the real editor, 2026-09-10

Not the whole 15-minute lesson: the seam the lesson grades, reached by a real click in the running
app. The project is a scratchpad copy of the hosted **lesson 07** starter — it ships the same three
navigations the lessons use, including the two with **no page parameters** that #5 is about, opened
through a seeded `recently_opened_project.json` under `NOODL_USER_DATA_DIR` so nothing touched
Richard's launcher config.

| # | what was done | viewer URL | `window.noodlEditorPreviewRoute` |
|---|---|---|---|
| 1 | project opened | `http://localhost:8574/` | `/` |
| 2 | clicked **Get Started** (Start Page → Task Page, carries `pm-User Name`) | `/task-page?User%20Name=Your` | `/task-page` |
| 3 | 🔴 clicked **add** (Task Page → Create Card Page, **no params**) | `/create-card-page` | `/create-card-page` |
| 4 | 🔴 navigated to a bare `/task-page` — #5's literal condition | `/task-page` | `/task-page` |

Row 2 is the control: the one navigation in the shipped lesson set that carries a page parameter,
and the case that always worked. It still works — the fix did not trade one for the other.

Rows 3 and 4 are the defect. Both are query-less routes, and the **reverted arm evaluated in the
same renderer, on the same real route**, reads:

```js
{ globalNow: "/task-page",
  ticksNow: true,                 // window.noodlEditorPreviewRoute === '/task-page'
  ticksUnderOldCode: false }      // '/task-page'.substring(0, '/task-page'.indexOf('?')) === '/task-page'
```

Row 3 is worth its own line: `/create-card-page` is **lesson 06's shipped condition string**,
reached by a real button click, and before this fix that click published `''`.

Screenshot: `fld007-drive.png` in the session scratchpad. Stack torn down (`dev:stop` — "Stopped 26
process(es). Nothing left running"), both peer sessions told.

⚠️ **What the drive did NOT do.** It did not run *Data Driven Pages* end to end, because that lesson
has the learner build the Details Page over fifteen minutes and the shipped starter renders the
Create Card Page blank until they do. What it measured is the seam the step is graded on, with the
real navigation, in the real editor — not the tutorial around it. If someone wants the literal
sentence in AC1, that is a lesson run, and it is cheap now that the mechanism is proven.

### AC status

| AC | state | evidence |
|---|---|---|
| 1 | 🟢 **driven** (with a stated limit) | §4b/AC1 above — real click, query-less route, live reverted arm |
| 2 | 🟢 | `tests-unit/fld-007/preview-route-path.test.ts`, 8/8, two reverted arms |
| 3 | 🟢 | the sweep is **8 conditions, 1 dead** — `scripts/fld-007-lesson-route-conditions.mjs` |
| 4 | 🟢 | three should-fail arms through the real evaluator |
| 5 | 🟡 **drafted, not sent** | §4c — needs a human to post it |

## 4c. The reply owed to #5 — AC5, ready to send

@VitoMinheere — draft, not yet posted. It answers both halves, which is what the issue asked and
never got.

> You were right, and it was one line.
>
> `views/VisualCanvas/CanvasView.ts` published the preview route to the lesson grader as
> `route.substring(0, route.indexOf('?'))`. For `/task-page` there is no `?`, so `indexOf` returns
> `-1`, and `substring(0, -1)` returns the **empty string**. The step's condition is a strict
> equality against that value, so `"/task-page" === ""` was false forever.
>
> That also explains the detail you noticed — that it completed via the Start Page. The Start Page's
> navigation passes a page parameter (`User Name`), so that URL *does* carry a `?`, the truncation
> does what it was meant to do, and the step ticks. The button on the Details Page passes no
> parameters, so it never could. Fixed in `4068d139`: the route keeps its whole path when there is
> no query, and the two places that publish it now share one function instead of disagreeing.
>
> **Where to patch a lesson** — your second question, and there are now two answers depending on
> which kind you have:
>
> - **The hosted lessons** (Basics, Layout, Data Driven Pages, …) are not in this repository. They
>   live in `nodegx-content` under `static/lessons/<slug>/`, as a hand-authored `lesson.html` split
>   into steps on `<!-- # -->` comments, with the starter project beside it as `project.zip`. The
>   grading lives in `data-conditions` attributes on the step markup — the one you hit reads
>   `[{ "viewerpatheq": "/task-page" }]`. The editor fetches these from the content CDN at runtime,
>   so a change there ships without an editor release.
> - **Newer lessons** are bundles in this repo at `project-examples/lessons/<slug>/lesson.json`, a
>   declarative manifest instead of HTML. The same condition is authored as
>   `previewRouteEquals` and compiled by `models/lessonformat.ts:290`.
>
> Please do open an issue if a step still refuses to tick — a step that cannot complete is worth
> more to us than it looks, and this one had been sitting since 2024.

## 5. Traps

- ⚠️ `CanvasView.ts` is **not reachable from the jest runner** — the same constraint FIX-025 records
  at `lessonlayer2.ts:355-362`. Put the arm on an extracted pure function, not on the class.
- ⚠️ The blast radius is lesson conditions only: this global is read in exactly one place
  (`lessonevalconditions.live.ts:67`). Confirm that is still true before widening the claim.
- ⚠️ The lesson content is in **another repository**. The fix here is in the editor; do not edit the
  lesson to work around a client bug, which would leave the next lesson broken.
