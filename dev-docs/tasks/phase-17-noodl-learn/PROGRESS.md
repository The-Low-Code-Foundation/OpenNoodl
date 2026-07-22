# Phase 17 Progress — Noodl Learn

**Created:** 2026-07-22, from [NOODL-REVIVAL-ROADMAP.md](../../reviews/NOODL-REVIVAL-ROADMAP.md) Track E
**Overall status:** 🔴 Not started — 0 / 6 tasks

## Status vocabulary

Not started · In progress · **Built–not wired** · Complete · Superseded

## Tasks

| ID | Title | Status | Estimate | Notes |
|---|---|---|---|---|
| LEARN-001 | Lessons engine revival | Not started | 4–6 wks | Substantial legacy machinery exists (models, views, templates, icons) — revival, not invention |
| LEARN-002 | Curriculum v1 | Not started | 8–10 wks | Needs a learning designer. The core deliverable of the phase |
| LEARN-003 | Web read-only viewer | Not started | 6–8 wks | The distribution unlock for classrooms |
| LEARN-004 | Web editor spike | Not started | 4 wks (time-boxed) | Deliverable is a go/no-go decision document |
| LEARN-005 | Classroom mode | Not started | 6–8 wks | Depends on AIX-001's local-model (Ollama) support |
| LEARN-006 | Pilots | Not started | Ongoing | **Produces Gate G2 evidence** — the phase's most important output |

## Inherited assets

The lessons system is not a greenfield build. Present in the editor today:

| Asset | Path |
|---|---|
| Lessons project model | `packages/noodl-editor/src/editor/src/models/LessonsProjectModel.ts` |
| Lesson model | `.../models/lessonmodel.js` |
| Lesson templates model | `.../models/lessontemplatesmodel.js` |
| Lesson layer views | `.../views/lessonlayer2.ts`, `.../views/lessons/LessonLayerView.jsx`, `LessonItem.jsx` |
| Lesson evaluation conditions | `.../views/lessons/lessonevalconditions.js` (jQuery-era; coordinate with PLAT-002) |
| Project-view lesson state | `.../views/projectsview.lessonstate.ts` |
| Templates | `.../templates/lessonlayer.html`, `lessonpopup.html` |
| Icons | `src/assets/icons/lesson-check-*.svg` |
| Project `lesson` field | Present on the project model (`io/ProjectExporter.ts` legacy project type) — **currently dropped by the v2 exporter; SUB-002 fixes this** |

LEARN-001's first job is to assess how much of this still works.

## Dependencies outside this phase

- **SUB-002** (Phase 13) must preserve the `lesson` project field, or lessons cannot survive the v2 format migration.
- **AIX-004** (Phase 15) provides explain mode — the AI-as-tutor capability LEARN-002's curriculum is built around.
- **AIX-001** (Phase 15) provides local-model support, without which LEARN-005's classroom deployment is not viable in most schools.
- **PLAT-002** (Phase 14) is converting jQuery views; `lessonevalconditions.js` is on both lists — coordinate before either touches it.
