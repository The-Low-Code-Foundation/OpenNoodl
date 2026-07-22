# LEARN-001: Revive and Modernise the Lessons Engine

## Metadata

| Field | Value |
|-------|-------|
| **ID** | LEARN-001 |
| **Phase** | Phase 17 — Noodl Learn (Revival Track E) |
| **Priority** | 🟠 High |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | 4–6 weeks |
| **Prerequisites** | SUB-002 (must preserve the `lesson` project field); coordinate with PLAT-002 |
| **Branch** | `task/learn-001-lessons-engine-revival` |
| **Recommended executor** | 🟠 **Opus 4.8** — archaeology on dormant subsystems is judgement-heavy: deciding what still works, what to keep, and what to rebuild. Once the assessment is done, individual view conversions drop to Sonnet. |

## Objective

Bring the editor's dormant in-editor lessons system back to working order and modernise it enough to carry a new curriculum.

## Background

Classic Noodl shipped interactive in-editor lessons: guided walkthroughs that ran inside the editor, highlighted parts of the interface, set tasks, and checked whether the learner had actually done them. The machinery for this is still in the codebase — models, views, templates, evaluation conditions, even the checkbox icons — but it is dormant. Nothing in the current product surfaces it, and it has not been exercised in a long time.

That is a fortunate starting position. The hard conceptual work of an in-editor tutorial system — how a lesson describes steps, how completion is detected from editor state, how progress persists — was already solved once by people who understood the product. Rebuilding it from scratch would be a waste, and the assessment's estimate assumes revival rather than invention.

The work is nonetheless real. The system predates the React migration and the v2 project format, so it needs updating on both fronts, and its condition after years of dormancy is unknown until someone runs it. The first two weeks of this task are honest assessment; the remainder is repair and modernisation.

One dependency to respect: v2 export currently drops the project-level `lesson` field. SUB-002 fixes that as part of its fidelity work. If lessons are revived before that lands, migrating a lesson project to v2 will silently discard the thing that makes it a lesson.

## Current State

Existing assets (verified present in the tree):

| Asset | Path |
|---|---|
| Lessons project model | `packages/noodl-editor/src/editor/src/models/LessonsProjectModel.ts` |
| Lesson model | `.../models/lessonmodel.js` |
| Lesson templates model | `.../models/lessontemplatesmodel.js` |
| Lesson layer (TypeScript) | `.../views/lessonlayer2.ts` |
| Lesson layer views (React) | `.../views/lessons/LessonLayerView.jsx`, `LessonItem.jsx` |
| Evaluation conditions | `.../views/lessons/lessonevalconditions.js` (jQuery-era) |
| Project-view lesson state | `.../views/projectsview.lessonstate.ts` |
| HTML templates | `.../templates/lessonlayer.html`, `lessonpopup.html` |
| Icons | `src/assets/icons/lesson-check-{complete,incomplete,...}.svg` |
| CSS | `.../styles/projectsview.lessoncards.css` |

Notable: the system is already partly React (`LessonLayerView.jsx`, `LessonItem.jsx`) and partly legacy jQuery (`lessonevalconditions.js`, the HTML templates) — the same hybrid pattern found throughout the editor. The project model carries a `lesson` field.

Unknown until assessed: whether lessons currently load and run at all, whether the completion-detection conditions still match current editor internals, and whether any lesson content exists in the repository or was hosted externally.

## Desired State

- Lessons load and run in the current editor.
- Lesson content is authorable in a documented format without editing editor source.
- Completion detection works against current editor state.
- Progress persists per user and per lesson.
- The system is React-based and typed, consistent with the rest of the modern editor.
- Lesson projects survive the v2 format migration intact.

## Scope

### In Scope
- [ ] Assessment: what works, what is broken, what is salvageable (deliverable: a written finding)
- [ ] Repair the load-and-run path
- [ ] Update completion-detection conditions against current editor internals
- [ ] Modernise remaining jQuery/template-era pieces to React (coordinate with PLAT-002)
- [ ] Type the models and views
- [ ] Define and document a lesson-content format for LEARN-002's authors
- [ ] Progress persistence
- [ ] Verify lesson projects round-trip through v2 (depends on SUB-002)
- [ ] One end-to-end worked lesson as proof and as the template for curriculum work

### Out of Scope
- Writing the curriculum (LEARN-002 — this task delivers exactly one example lesson)
- Classroom/teacher features (LEARN-005)
- Web delivery of lessons (LEARN-003)
- AI tutoring (AIX-004 provides it; the curriculum uses it)

## Technical Approach

### Method

Start with archaeology, not code. Get the existing system to run — even partially, even ugly — before deciding what to rebuild. A dormant system that mostly works needs repair; one that is fundamentally incompatible with the current editor needs a rewrite of specific parts, and you cannot tell which without running it. Budget the first two weeks for this and produce a written assessment before committing to an approach.

The **lesson-content format is the most consequential deliverable** for the phase, because LEARN-002 will author 10–15 lessons against it and changing it later means rewriting all of them. Design it for a curriculum author who is not a programmer: declarative steps, human-readable completion conditions, and text content separated from logic. Review it with whoever will write the curriculum before finalising.

Completion detection is the technically awkward part: it must observe editor state (has the learner created a Group node? connected these two ports?) without coupling the lessons system to editor internals so tightly that ordinary editor changes break every lesson. Prefer observing the project model and the node graph — stable, semantic — over observing DOM or view internals, which are neither.

## Implementation Steps

1. **Assessment**: run what exists, document what works and what does not, and recommend repair-versus-rebuild per component. Written finding as the gate to step 2.
2. **Restore the load-and-run path** for a minimal hard-coded lesson.
3. **Rework completion detection** against project-model/graph state rather than view internals.
4. **Design the lesson-content format** with LEARN-002's author in the room; document it.
5. **Modernise the remaining legacy views** (coordinating with PLAT-002 so the work is not done twice).
6. **Progress persistence** per user and lesson.
7. **Build one complete worked lesson** end to end — this becomes the template and the regression test.
8. **Verify v2 round-trip** of a lesson project once SUB-002 has landed.

## Testing Plan

- The worked lesson runs start to finish in the current editor.
- Completion detection fires correctly for each step, and does *not* fire on near-misses.
- Progress survives restart.
- A lesson project exports to v2 and re-imports with its lesson data intact.
- A non-programmer can author a simple lesson from the format documentation alone (test this with a real person).

## Success Criteria

- [ ] Written assessment of the legacy system published
- [ ] Lessons load and run in the current editor
- [ ] Completion detection works against current editor state, decoupled from view internals
- [ ] Lesson-content format documented and validated with a non-programmer author
- [ ] Progress persists
- [ ] Remaining legacy views modernised and typed
- [ ] One complete worked lesson shipped as template and regression test
- [ ] Lesson projects survive v2 round-trip

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| The legacy system is too broken to revive economically | Step 1 is an explicit assessment with a repair-vs-rebuild recommendation; a "rebuild the evaluation layer" outcome is legitimate and should be reported, not absorbed silently |
| Completion detection couples tightly to editor internals and breaks constantly | Observe project-model and graph state, not views or DOM; test against editor changes |
| The content format proves unusable for curriculum authors | Design it *with* the author (step 4); validate with a non-programmer before LEARN-002 starts |
| Duplicated work with PLAT-002 on `lessonevalconditions.js` | Coordinate explicitly; this task should own the lessons views |
| v2 migration silently drops lesson data | Hard dependency on SUB-002; verify explicitly in step 8 |

## References

- [Viability report — §2.2 (pedagogy thesis)](../../reviews/NOODL-VIABILITY-REPORT.md)
- [Revival roadmap — Track E](../../reviews/NOODL-REVIVAL-ROADMAP.md)
- Related: SUB-002 (lesson field preservation), PLAT-002 (jQuery conversion), LEARN-002 (consumer of the content format)

## Checklist

- [ ] Branch `task/learn-001-lessons-engine-revival`
- [ ] Run and assess the legacy system; publish the written finding
- [ ] Restore load-and-run; rework completion detection against model state
- [ ] Design and document the lesson-content format with the curriculum author
- [ ] Modernise remaining legacy views (coordinate with PLAT-002)
- [ ] Progress persistence; one complete worked lesson
- [ ] Verify v2 round-trip; CHANGELOG; open PR
