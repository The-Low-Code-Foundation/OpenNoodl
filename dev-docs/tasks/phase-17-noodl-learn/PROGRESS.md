# Phase 17 Progress — Noodl Learn

**Created:** 2026-07-22, from [NOODL-REVIVAL-ROADMAP.md](../../reviews/NOODL-REVIVAL-ROADMAP.md) Track E
**Last updated:** 2026-07-25
**Overall status:** 🟡 In progress — LEARN-001 substantially complete (engine revived & wired end-to-end); LEARN-002 design phase started (Richard is the learning designer); 4 tasks not started

## Status vocabulary

Not started · In progress · **Built–not wired** · Complete · Superseded

## Tasks

| ID | Title | Status | Estimate | Notes |
|---|---|---|---|---|
| LEARN-001 | Lessons engine revival | In progress (revival done; format-validation gate open) | 4–6 wks | **Engine revived and wired end-to-end** (verified in the running editor 2026-07-25). Evaluator typed + de-eval'd + tested; new declarative `lesson.json` format + compiler + docs; legacy `lesson.html` compat path; Learn-tab entry UI (list → clone → open); progress persists. Remaining: **validate the format with a non-programmer author** (the one unmet success criterion), full `lessonlayer2.ts` typing/tidy, and curriculum hosting (LEARN-002). See status below |
| LEARN-002 | Curriculum v1 | In progress — design docs drafted, awaiting designer review | 8–10 wks | **Learning designer engaged: Richard (2026-07-25).** [CURRICULUM-DESIGN.md](./CURRICULUM-DESIGN.md) (outcomes, 12-lesson progression, assessment layers, 6 designer decisions D1–D6) + [TUTOR-BOUNDARY.md](./TUTOR-BOUNDARY.md) (will/won't table, Socratic ladder, prompt overlay spec, adversarial test plan) drafted per the design-before-content gate. No lesson authored until review. Follow-ons identified: tutor lesson-context overlay (small AIX-004 ext), template-chaining check, hosting decision |
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
