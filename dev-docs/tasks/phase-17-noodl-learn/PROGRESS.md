# Phase 17 Progress — Noodl Learn

**Created:** 2026-07-22, from [NOODL-REVIVAL-ROADMAP.md](../../reviews/NOODL-REVIVAL-ROADMAP.md) Track E
**Last updated:** 2026-07-24
**Overall status:** 🟡 In progress — 0 / 6 complete; LEARN-001 assessment done

## Status vocabulary

Not started · In progress · **Built–not wired** · Complete · Superseded

## Tasks

| ID | Title | Status | Estimate | Notes |
|---|---|---|---|---|
| LEARN-001 | Lessons engine revival | In progress | 4–6 wks | Assessment complete ([LEARN-001-ASSESSMENT.md](./LEARN-001-ASSESSMENT.md)) — **verdict: revive, don't rebuild.** Runtime intact and jQuery-free; only the entry/discovery UI is orphaned; the content format needs replacing. Live legacy curriculum (8 lessons) still hosted |
| LEARN-002 | Curriculum v1 | Not started | 8–10 wks | Needs a learning designer. The core deliverable of the phase |
| LEARN-003 | Web read-only viewer | Not started | 6–8 wks | The distribution unlock for classrooms |
| LEARN-004 | Web editor spike | Not started | 4 wks (time-boxed) | Deliverable is a go/no-go decision document |
| LEARN-005 | Classroom mode | Not started | 6–8 wks | Depends on AIX-001's local-model (Ollama) support |
| LEARN-006 | Pilots | Not started | Ongoing | **Produces Gate G2 evidence** — the phase's most important output |

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
