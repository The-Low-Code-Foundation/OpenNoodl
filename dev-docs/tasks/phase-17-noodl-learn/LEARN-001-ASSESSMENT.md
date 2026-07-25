# LEARN-001 — Assessment of the Legacy Lessons Engine

**Task:** [LEARN-001](./LEARN-001-LESSONS-ENGINE-REVIVAL.md) · **Phase:** 17 — Noodl Learn
**Date:** 2026-07-24
**Status:** Assessment complete — this is the written finding that gates Steps 2–8.
**Verdict:** **Revive, do not rebuild.** The runtime is in far better shape than the task brief assumed. The only fully-severed piece is the *entry/discovery UI*, and the only piece that should be deliberately *replaced* is the *content format* — which is also the phase's highest-leverage deliverable (LEARN-002 authors against it).

---

## 1. Executive summary

The lessons subsystem is dormant but not decayed. Three of its four layers still work or need only modernisation; one layer (the UI that lets a user find and start a lesson) is orphaned and must be rebuilt; and the authored-content format is a hand-written-HTML design that is unfit for the non-programmer curriculum authors LEARN-002 assumes.

Two findings materially de-risk the phase versus what the task brief anticipated:

1. **PLAT-002 already did the jQuery conversion.** `lessonevalconditions.js`, `lessonmodel.js`, `lessonlayer2.ts` and the two React views are all jQuery-free. The `templates/lessonlayer.html` / `lessonpopup.html` files named in the brief **no longer exist** — that DOM is now built imperatively in `lessonlayer2.ts` and rendered through React. Step 5 ("modernise remaining legacy views, coordinate with PLAT-002") is therefore *mostly already done*.
2. **The completion-detector already observes the project model and node graph, not the DOM.** The task's Step 3 ("rework completion detection against project-model/graph state rather than view internals") describes work that the legacy code substantially already does. This is the technically awkward part of the whole system, and it is sound in principle.

The revival is consequently weighted away from "make the runtime work again" and toward two things: **(a) build a modern entry point**, and **(b) design a curriculum-author-friendly content format**. That is a better place to be spending Phase 17's budget than repairing an evaluator.

---

## 2. Component-by-component repair-vs-rebuild

| Component | Files | State | Verdict |
|---|---|---|---|
| **Instruction/content model** | `models/lessonmodel.js` | Works; jQuery→`fetch` conversion done. Parses hosted HTML into steps. | **Repair** — type it; keep behaviour |
| **Runtime / rendering** | `views/lessonlayer2.ts`, `views/lessons/LessonLayerView.jsx`, `LessonItem.jsx` | jQuery-free, React-based, live-wired in EditorPage. Heavy `TSFixme`/`any`; dead commented code. | **Repair** — type + tidy |
| **Completion detection** | `views/lessons/lessonevalconditions.js` | Observes `ProjectModel` + node graph (semantic layer). All coupled APIs still exist. Uses `eval()`; untyped. | **Repair** — type, remove `eval`, keep the model |
| **Progress persistence** | `models/LessonsProjectModel.ts` (`_trackLessonProgress`) | Exists — `JSONStorage` key `lessonProgress`, keyed by lesson name. Never exercised (no callers). | **Repair/verify** — wire and test |
| **Entry / discovery UI** | `models/LessonsProjectModel.ts`, `models/lessontemplatesmodel.js`, `views/projectsview.lessonstate.ts` | **Orphaned.** Nothing imports or calls them. No UI lets a user browse or start a lesson. | **Rebuild** — the real missing piece |
| **Authored content format** | (external `lesson.html` convention) | Hand-authored HTML split on `<!-- # -->`, with JSON embedded in `data-conditions` attributes. | **Replace** — unfit for non-programmer authors |
| **HTML templates** | `templates/lessonlayer.html`, `lessonpopup.html` | **Do not exist** (removed; the brief is stale here). | n/a |

---

## 3. Is it wired or dead code?

**The render path is live; the entry path is dead.**

- **Live:** [EditorPage.tsx:235-247](../../../packages/noodl-editor/src/editor/src/pages/EditorPage/EditorPage.tsx) instantiates `LessonLayer` on mount, but only `if (ProjectModel.instance.isLesson())`. `isLesson()` ([projectmodel.ts:760](../../../packages/noodl-editor/src/editor/src/models/projectmodel.ts)) is true **only when the loaded project JSON already carries a `lesson` field** ([projectmodel.ts:178](../../../packages/noodl-editor/src/editor/src/models/projectmodel.ts)).
- **Dead:** the component that *produces* such a project — `LessonsProjectsModel` (`loadLessonProject` → `_cloneLessonIntoDirectory`, which synthesises the `lesson` field at clone time) — is **never imported or called anywhere** except its own file.
- **Dead:** `LessonTemplatesModel.instance.fetch()` runs at startup ([router.tsx:109](../../../packages/noodl-editor/src/editor/src/router.tsx)) and fires `templatesChanged`, but **no one consumes `getTemplates()` / `getCategories()` / the event**. It is a fetch into the void.
- **Dead:** `views/projectsview.lessonstate.ts` (`getLessonsState`) has **zero importers**.

Net: a normal user has no way to reach a lesson today. The runtime would only light up for a project hand-authored on disk with a `lesson` block. **Rebuilding the entry point is the single largest chunk of new work.**

---

## 4. The external content is still alive — there is a real curriculum to revive against

The content was hosted externally (never bundled), and the host is still up. `getDocsEndpoint()` resolves to `https://the-low-code-foundation.github.io/opennoodl-docs`, and `lessontemplatesmodel.js` fetches `/lessons/index.json`.

Verified 2026-07-24 (all HTTP 200):

- **`/lessons/index.json`** — 8 lessons: `ai_walkthrough`, `01_basics`, `02_layout`, `03_components`, `04_data-driven-components`, `05_page-navigation`, `06_store-user-data`, `07_logic-components`.
- **`/lessons/01_basics/project.zip`** — 3.9 MB, downloads cleanly (contains `project.json`, assets, fonts, `noodl_modules/`).
- **`/lessons/01_basics/lesson.html`** — 26 KB, **31 steps** (split on `<!-- # -->`).

This is decisive for the repair verdict: there is a complete, real legacy curriculum to test the revived engine against, so Step 2 ("restore load-and-run for a minimal lesson") can use `01_basics` directly rather than inventing a fixture.

> **Operational note / risk:** the curriculum lives on a third-party GitHub Pages site (`the-low-code-foundation`) outside this repo. Reviving against it makes the classroom experience depend on infrastructure the project does not control. Recommend, as part of LEARN-001, **vendoring at least one lesson into the repo** as the worked-lesson fixture (Step 7) so the regression test has no network dependency, and treating "where does OpenNoodl's own curriculum get hosted" as an explicit LEARN-002/distribution decision.

---

## 5. Completion detection — coupling is semantic and current (good news)

`lessonevalconditions.js` evaluates an array of conditions against editor state. Every API it reads still exists:

| Condition | Reads | Still present? |
|---|---|---|
| `hastype` / `haslabel` / `exists` / `hasport` / `hasparams` / `paramseq` | `ProjectModel.instance.components`, node `type/label/ports/parameters` | ✅ node-graph model |
| `hasconnection` | `node.forAllConnectionsOnThisNode` (`fromId/toId/fromProperty/toProperty`) | ✅ `NodeGraphNode.ts` |
| `isvisualroot` | `ProjectModel.instance.getRootNode()` | ✅ `projectmodel.ts:242` |
| `metadata` | `ProjectModel.instance.getMetaData()` | ✅ `projectmodel.ts:980` |
| `viewerpatheq` | `window.noodlEditorPreviewRoute` | ✅ set by `CanvasView.ts` |
| `activecomponentnameeq` | `NodeGraphContextTmp.nodeGraph.getActiveComponent()` | ✅ `nodegrapheditor.ts:579` |

Node addressing uses a path grammar (`Component:#label:%type:idx`, resolved by `findNodeWithPath`) that walks `component.graph.roots`. This is semantic (label/type/component names), not DOM/view-coupled — exactly the stability the task asks for.

**Two concrete defects to fix during repair (not rebuild):**
1. **`eval()` on parameter values** ([lessonevalconditions.js:100-105](../../../packages/noodl-editor/src/editor/src/views/lessons/lessonevalconditions.js)) for `array`-typed port comparison — it `eval`s both the node's stored value and the lesson-author's expected value. This is an injection/robustness hazard and should become a real JSON/structured comparison.
2. **Untyped throughout** — the module is plain JS with `underscore` + `assert`. Typing it against the real `NodeGraphNode`/`ProjectModel` interfaces will also surface the shape assumptions that are the actual fragility here.

---

## 6. The content format is the phase-critical redesign

The authored format for a lesson is a single `lesson.html` document, split into steps on `<!-- # -->` comments. Each step is raw HTML containing:

- a `<div data-template="item">` (the timeline card) and/or `<div data-template="popup">` (the modal),
- media as `<video src>` / `<image src>` resolved relative to the lesson's `baseURL`,
- completion logic as a **JSON blob inside a `data-conditions` HTML attribute**, e.g.:

```html
<div data-conditions='[{ "activecomponentnameeq":"/Start Page" }]'>
  <div data-template="item"><header>Task</header><h3>Select the Start Page component…</h3></div>
  ...
</div>
```

- optional `data-actions` (editor side-effects: `selectNode`, `navigatePreview`, `selectComponent`), `data-suggested-nodes`, `data-disable-icons`.

This works, but it is **exactly the programmer-hostile format the task warns about** (README §"LEARN-002 needs a learning designer, not an engineer"). Authoring requires writing HTML *and* hand-writing JSON-in-an-attribute *and* knowing the node-path grammar. A non-programmer cannot maintain 10–15 lessons in it, and — per the brief — changing the format after LEARN-002 has authored against it means rewriting every lesson.

**Recommendation:** treat the content-format design (Step 4) as the primary deliverable of LEARN-001, co-designed with LEARN-002's author before any curriculum is written. Direction: declarative step objects (data, not HTML), human-readable completion conditions, prose separated from logic. The legacy `data-conditions` vocabulary (§5 table) is a good *semantic* starting point for the condition language — reuse the meanings, drop the HTML-attribute-JSON encoding. The revived engine should keep the legacy HTML reader working as a *compatibility path* (so the 8 hosted lessons still run) while new curriculum targets the new format.

---

## 7. Format / v2 round-trip status (Step 8 dependency)

- Hosted lesson `project.json` is **classic format** (`version: 4`) and contains **no `lesson` field** on disk — the field is synthesised at clone time by `_cloneLessonIntoDirectory` ([LessonsProjectModel.ts:83-93](../../../packages/noodl-editor/src/editor/src/models/LessonsProjectModel.ts)) and only persisted once the in-progress project is saved.
- SUB-002 is **satisfied**: the v2 exporter/importer both round-trip the field — [ProjectExporter.ts:371](../../../packages/noodl-editor/src/editor/src/io/ProjectExporter.ts) (`if (project.lesson !== undefined) file.lesson = project.lesson`) and [ProjectImporter.ts:306](../../../packages/noodl-editor/src/editor/src/io/ProjectImporter.ts). Step 8 becomes a *verification*, not a fix.

---

## 8. Test coverage

**None.** No `*.test.*` / `*.spec.*` references `lesson` anywhere under `src`. `getLessonsState` — the most unit-testable pure function in the subsystem — has neither tests nor callers. The worked lesson (Step 7) plus a typed condition-evaluator are where the first tests should land.

---

## 9. Recommended plan (revised from the task's Implementation Steps)

1. **Restore load-and-run** against the live `01_basics` lesson via a temporary dev entry point (prove the runtime end-to-end before touching format). — *low effort, high signal*
2. **Type + de-`eval` the completion evaluator**; first tests here.
3. **Design the new content format** *with* the curriculum author; keep the legacy HTML reader as a compat path. — *the consequential deliverable*
4. **Build the entry/discovery UI** (the genuinely missing piece): a launcher/menu affordance → template list → clone → open-as-lesson, reusing `LessonsProjectsModel`/`LessonTemplatesModel` which already implement the plumbing.
5. **Verify progress persistence** end-to-end (already implemented, never exercised).
6. **Vendor one lesson in-repo** as the worked-lesson fixture + regression test (no network dependency).
7. **Verify v2 round-trip** of a saved lesson project (SUB-002 already landed).

Steps 2, 4, 5, 7 are repair/verify. Steps 3 and (the UI half of) 4 are the real new build. Nothing here warrants a from-scratch rewrite of the runtime.

---

## Appendix — files touched by this assessment (read-only)

`models/LessonsProjectModel.ts`, `models/lessonmodel.js`, `models/lessontemplatesmodel.js`, `views/lessonlayer2.ts`, `views/lessons/{LessonLayerView.jsx, LessonItem.jsx, lessonevalconditions.js}`, `views/projectsview.lessonstate.ts`, `pages/EditorPage/EditorPage.tsx`, `models/projectmodel.ts`, `router.tsx`, `utils/getDocsEndpoint.ts`, `io/ProjectExporter.ts`, `io/ProjectImporter.ts`. Live content probed at `the-low-code-foundation.github.io/opennoodl-docs/lessons/`.
