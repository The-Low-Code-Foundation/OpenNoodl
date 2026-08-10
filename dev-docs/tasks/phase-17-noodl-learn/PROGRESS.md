# Phase 17 Progress — Noodl Learn

**Created:** 2026-07-22, from [NOODL-REVIVAL-ROADMAP.md](../../reviews/NOODL-REVIVAL-ROADMAP.md) Track E
**Last updated:** 2026-08-09
**Overall status:** 🟡 In progress — LEARN-001 substantially complete (engine revived & wired end-to-end); **LEARN-002's design is reviewed and accepted (2026-08-09) — authoring is unblocked**; the generated-lessons arc (LEARN-007…010) is specced with its open questions answered; 4 original tasks not started

## What changed on 2026-08-09

The learning designer (Richard) reviewed the design gate and answered every open
question in one session. Nine decisions are recorded in
[CURRICULUM-DESIGN.md §10](./CURRICULUM-DESIGN.md) (D1–D6 as drafted; D7–D9 new),
and four more in [EXPERIMENT-GENERATED-LESSONS.md §8](./EXPERIMENT-GENERATED-LESSONS.md).

The substantive changes, as opposed to confirmations:

- **L8 moves to the built-in backend** (D8) — persistence replaces "lists grow
  and shrink" as the felt problem. Cost recorded: L8 is now the first lesson
  that will not run in a browser, so it is the first lesson LEARN-003's web
  viewer cannot carry.
- **Logic Builder joins as an optional visual-code track** (D9), blocked on
  phase 59 surfacing a node that has been unfindable since phase 3.
- **Phase 60 owns the beginner wording for "signal"** (D7) — and the glossary's
  existing line is probably false.
- **Generated lessons are to reach learners through a free hosted endpoint**, not
  BYO API key — stubbed as [LEARN-011](./LEARN-011-THE-FREE-LESSON-ENDPOINT.md),
  deferred behind LEARN-010's verdict. This is what keeps the classroom audience
  reachable.
- **Node names in the spine were rebased** against `node-catalog.json`: five had
  drifted, and the two-vocabulary rule (prose = display name, conditions = type
  name) is now written into [LESSON-FORMAT.md §3](./LESSON-FORMAT.md). A lesson
  authored against the old names would have told learners they failed steps they
  had completed.

⚠️ **Three items block the first authored lesson** — none is a design question.
[CURRICULUM-DESIGN.md §11](./CURRICULUM-DESIGN.md).

## Status vocabulary

Not started · In progress · **Built–not wired** · Complete · Superseded

## Tasks

| ID | Title | Status | Estimate | Notes |
|---|---|---|---|---|
| LEARN-001 | Lessons engine revival | In progress (revival done; format-validation gate open) | 4–6 wks | **Engine revived and wired end-to-end** (verified in the running editor 2026-07-25). Evaluator typed + de-eval'd + tested; new declarative `lesson.json` format + compiler + docs; legacy `lesson.html` compat path; Learn-tab entry UI (list → clone → open); progress persists. Remaining: **validate the format with a non-programmer author** (the one unmet success criterion), full `lessonlayer2.ts` typing/tidy, and curriculum hosting (LEARN-002). See status below |
| LEARN-002 | Curriculum v1 | **In progress — design ACCEPTED 2026-08-09; authoring not started** | 8–10 wks | **Learning designer: Richard.** [CURRICULUM-DESIGN.md](./CURRICULUM-DESIGN.md) (outcomes, 12-lesson progression, assessment layers) reviewed and accepted; **D1–D9 answered** (§10). [TUTOR-BOUNDARY.md](./TUTOR-BOUNDARY.md) unchanged. The design-before-content gate is now open, but §11's three items come first. Follow-ons still owed: tutor lesson-context overlay (small AIX-004 ext), template-chaining check, hosting decision |
| LEARN-007…010 | Generated-lessons experiment | Specced 2026-08-02, **open questions answered 2026-08-09**; nothing built | 4 wks (hard box) | [EXPERIMENT-GENERATED-LESSONS.md](./EXPERIMENT-GENERATED-LESSONS.md). Concept = lists/repeaters; 6 picked + 6 real goals; testers = Richard + 1–2 community members; **the spine is authored either way**. Runs from a script against fixtures — no editor change, nothing ships to a learner |
| LEARN-011 | Free lesson endpoint | 🟠 Stub — decided, not specced | — | Deferred behind LEARN-010's verdict. A hosted endpoint so a learner needs no API key |
| LEARN-003 | Web read-only viewer | Not started | 6–8 wks | The distribution unlock for classrooms |
| LEARN-004 | Web editor spike | Not started | 4 wks (time-boxed) | Deliverable is a go/no-go decision document |
| LEARN-005 | Classroom mode | Not started | 6–8 wks | Depends on AIX-001's local-model (Ollama) support |
| LEARN-006 | Pilots | Not started | Ongoing | **Produces Gate G2 evidence** — the phase's most important output |

## LEARN-001 status (2026-07-25)

Delivered in five committed, tested slices; the whole flow was verified in the
running editor (Learn tab → Start → clone 01_basics → lesson runs → progress
persists).

| Step (assessment §9) | State | Where |
|---|---|---|
| 1. Assessment | ✅ | [LEARN-001-ASSESSMENT.md](./LEARN-001-ASSESSMENT.md) |
| 2. Restore load-and-run | ✅ verified in editor | 01_basics runs (intro popup + task timeline) |
| 3. Type + de-eval completion detection | ✅ | `views/lessons/lessonevalconditions.ts` (+33 unit tests). Pure fn of (conditions, injected context); `eval()` gone |
| 4. New content format + docs | ✅ format/compiler/docs; ⚠️ **non-programmer validation pending** | `models/lessonformat.ts`, [LESSON-FORMAT.md](./LESSON-FORMAT.md) (+18 tests). Legacy `lesson.html` kept as compat path |
| 5. Modernise/type legacy views | ◑ models typed; `lessonlayer2.ts` still TSFixme-heavy | `models/lessonmodel.ts` (js→ts) done; `lessonlayer2.ts` tidy is a remainder |
| 6. Progress persistence | ✅ verified | `lessonProgress.json` updated live; lesson field also saved into the cloned `project.json` (resume works) |
| 7. Worked lesson (template + regression) | ✅ | `tests/lessons/fixtures/worked-lesson.json` (new format) + `worked-lesson.test.ts` |
| 8. v2 round-trip | ✅ | strengthened `roundtrip-fidelity` `carries project.lesson` to the real `LessonModel.toJSON()` shape |
| Entry/discovery UI (the missing piece) | ✅ built + verified | core-ui `LearningCenter` + `ProjectsPage` wiring (LessonTemplatesModel/LessonsProjectsModel/getLessonsState un-orphaned) |

**Open remainders (not blocking a working system):**
1. **Validate the `lesson.json` format with a real non-programmer author** before LEARN-002 authors 10–15 lessons — the one success criterion not yet met.
2. Finish typing/tidying `lessonlayer2.ts` (still `TSFixme` + dead commented code).
3. Decide where OpenNoodl's *own* curriculum is hosted (LEARN-002 / distribution) — the engine still reads the legacy 8 lessons from the third-party `the-low-code-foundation` GitHub Pages site; the new format isn't hosted anywhere yet (the worked lesson is the in-repo template).

## Inherited assets

The lessons system is not a greenfield build. Present in the editor today (verified 2026-07-24 by the LEARN-001 assessment):

| Asset | Path | State |
|---|---|---|
| Lessons project model | `packages/noodl-editor/src/editor/src/models/LessonsProjectModel.ts` | Orphaned — no callers |
| Lesson model | `.../models/lessonmodel.js` | Works; jQuery→`fetch` conversion done |
| Lesson templates model | `.../models/lessontemplatesmodel.js` | Orphaned — `fetch()` runs at startup into the void |
| Lesson layer views | `.../views/lessonlayer2.ts`, `.../views/lessons/LessonLayerView.jsx`, `LessonItem.jsx` | React, live-wired in EditorPage; untyped |
| Lesson evaluation conditions | `.../views/lessons/lessonevalconditions.js` | **Already jQuery-free (PLAT-002 done).** Observes project-model/graph state, not the DOM. Untyped; uses `eval()` |
| Project-view lesson state | `.../views/projectsview.lessonstate.ts` | Orphaned — no importers |
| ~~Templates~~ | ~~`.../templates/lessonlayer.html`, `lessonpopup.html`~~ | **Removed — no longer exist.** DOM now built in `lessonlayer2.ts` |
| Icons | `src/assets/icons/lesson-check-*.svg` | Present |
| Project `lesson` field | `io/ProjectExporter.ts` / `io/ProjectImporter.ts` | **SUB-002 satisfied — field now round-trips through v2** |

The assessment's verdict: **revive, don't rebuild.** The runtime is intact; the only fully-severed piece is the entry/discovery UI, and the authored-content format (hand-written HTML with JSON-in-attributes) should be *replaced* rather than repaired. See [LEARN-001-ASSESSMENT.md](./LEARN-001-ASSESSMENT.md).

## Dependencies outside this phase

- **SUB-002** (Phase 13) — ✅ **satisfied.** The `lesson` field now round-trips through the v2 exporter/importer ([ProjectExporter.ts:371](../../../packages/noodl-editor/src/editor/src/io/ProjectExporter.ts), [ProjectImporter.ts:306](../../../packages/noodl-editor/src/editor/src/io/ProjectImporter.ts)). LEARN-001 Step 8 is now a verification, not a fix.
- **AIX-004** (Phase 15) — ✅ **landed** (commit `fcd8a5a`). Provides explain mode — the AI-as-tutor capability LEARN-002's curriculum is built around.
- **AIX-001** (Phase 15) — ✅ **complete.** Provides local-model support, without which LEARN-005's classroom deployment is not viable in most schools.
- **PLAT-002** (Phase 14) — ✅ **complete.** The jQuery conversion of `lessonevalconditions.js` and `lessonmodel.js` is already done and the two lesson HTML templates were removed; no further coordination needed. LEARN-001 owns the lessons views from here.
