# Phase 17: Noodl Learn (Revival Track E)

**Phase:** 17
**Track:** E — Pedagogy as a product line
**Source:** [NOODL-REVIVAL-ROADMAP.md](../../reviews/NOODL-REVIVAL-ROADMAP.md) Horizon 2, Track E
**Status:** Not started (created 2026-07-22)

## Why this phase exists

The 2026-07-22 viability assessment ranked the three surviving arguments for Noodl's existence and reached an uncomfortable conclusion: **pedagogy is the strongest reason for the product to exist and the one the roadmap served least.**

The argument for it is straightforward. AI coding assistants have made it possible to produce working software without understanding it, and a generation of learners is now growing up able to prompt but not to explain. There is a real and widening gap between Scratch — which teaches sequencing and events but not architecture — and professional tooling, which assumes you already know. Noodl's model of explicit state, explicit data flow, and explicit events is honest engineering made visible: you cannot hide state in a node graph, because state is a node you placed. That is a genuine teaching medium, and it is *more* valuable now than before AI coding, not less.

The argument against, which the assessment made bluntly: the existing roadmap serves a professional developer, not a learner. Advanced GitHub integration scoped at 501–662 hours, backend adapters, cloud functions with container deploys, execution monitoring — a fifteen-year-old building their first app needs none of it. And education is fundamentally a *distribution* problem, which no phase of the original roadmap addressed at all.

This phase treats pedagogy as a product line with its own team, its own users, and its own success measures — because that is what taking it seriously requires. It is also where Gate G2's evidence comes from: LEARN-006's pilots are how the project finds out whether anyone actually wants this.

## Task Table

| ID | Title | Priority | Estimate | Prerequisites | Executor |
|---|---|---|---|---|---|
| [LEARN-001](./LEARN-001-LESSONS-ENGINE-REVIVAL.md) | Revive and modernise the lessons engine | 🟠 High | 4–6 wks | SUB-002 (preserves the `lesson` field) | 🟠 Opus 4.8 |
| [LEARN-002](./LEARN-002-CURRICULUM-V1.md) | Curriculum v1: 10–15 lessons | 🔴 Critical | 8–10 wks | LEARN-001; AIX-004 (explain mode) | 🔵 Fable 5 |
| [LEARN-003](./LEARN-003-WEB-VIEWER.md) | Browser-based read-only graph viewer | 🟠 High | 6–8 wks | SUB-001 (v2 files) | 🟠 Opus 4.8 |
| [LEARN-004](./LEARN-004-WEB-EDITOR-SPIKE.md) | Web editor feasibility spike → go/no-go | 🟡 Medium | 4 wks (time-boxed) | LEARN-003 | 🔵 Fable 5 |
| [LEARN-005](./LEARN-005-CLASSROOM-MODE.md) | Classroom mode | 🟡 Medium | 6–8 wks | LEARN-002, AIX-001 (local models) | 🟠 Opus 4.8 |
| [LEARN-006](./LEARN-006-PILOTS.md) | Two instrumented real-world pilots | 🔴 Critical | Ongoing | LEARN-002 minimum | 🔵 Fable 5 |

## Sequencing notes

- **LEARN-001 before LEARN-002.** There is no point authoring curriculum for an engine that does not run. Note that a real lessons system already exists in the codebase — this is revival, not invention.
- **LEARN-002 is the substantive work** and needs a learning designer, not an engineer. The roadmap says this explicitly and it should be taken literally: engineers write bad curriculum, confidently.
- **LEARN-003 is the distribution unlock.** The editor is Electron-only; a school cannot install it on managed Chromebooks. A read-only web viewer costs roughly a tenth of a web editor and makes lessons, shared projects, and AI-built pages one link away.
- **LEARN-004 is a spike with a decision as its deliverable** — not an implementation. If the answer is "go", that is a 6–12 month project requiring its own phase, and the spike's job is to make that call on evidence.
- **LEARN-006 runs alongside everything** once there is enough to pilot. Its output is evidence for Gate G2, not code.

## Exit criterion

A learner with no programming background can install (or open) OpenNoodl, work through a curriculum that teaches real engineering concepts, ask an AI tutor to explain what they are looking at without having it build things for them, and come away understanding how their application works — and two real pilot cohorts have generated evidence about whether they return.

## The tension this phase must hold

Every task here has to resist a specific gravitational pull: making the AI do the work. The pedagogy thesis is that learners should build *with* engineering concepts intact rather than by prompting and never understanding the machine. An AI that authors their app for them is the failure mode, not the feature — which is why AIX-004 (explain mode, read-only) is the prerequisite for the curriculum work rather than AIX-002 (authoring). The AI's role in Noodl Learn is tutor, never ghostwriter.

## References

- [Viability report — §2.2 (pedagogy thesis, ranked and stress-tested)](../../reviews/NOODL-VIABILITY-REPORT.md)
- [Revival roadmap — Horizon 2, Track E, and Gate G2](../../reviews/NOODL-REVIVAL-ROADMAP.md)
- Existing lessons code: `packages/noodl-editor/src/editor/src/models/{LessonsProjectModel.ts,lessonmodel.js,lessontemplatesmodel.js}`, `views/lessons/`, `views/lessonlayer2.ts` (the two lesson HTML templates the roadmap references were removed by PLAT-002; the DOM is now built in `lessonlayer2.ts`)
- **LEARN-001 assessment (2026-07-24):** [LEARN-001-ASSESSMENT.md](./LEARN-001-ASSESSMENT.md) — verdict *revive, don't rebuild*; runtime intact and jQuery-free; entry/discovery UI is the missing piece; content format needs replacing; the legacy 8-lesson curriculum is still hosted and downloadable
