# EL-008 — The tutorials

| Field | Value |
|---|---|
| **Tier** | 5 |
| **Effort** | M |
| **Surface** | `platform` (curriculum), `docs` |
| **Rulings** | **D7** (curated, via P67 D17 hosting — needs P67 sign-off) · **D2** |
| **Depends on** | everything it teaches (EL-001 – EL-006); each tutorial lands with, not after, its feature |

## The job

The migration path from Articulate, taught in our own learning system — which is also the phase
eating its own cooking in public. The series, in learner order:

1. **Your first course** — the deck template, end to end to a deployed course. The script is
   EL-003 AC1's drive, verbatim: that drive was performed under the no-graph constraint precisely
   so it could become this tutorial.
2. **Quizzes that are data** — question banks, pooling, the Score node; why a question is a row.
3. **The branching scenario** — EL-004's template; the pedagogy (decisions over slides) taught
   alongside the mechanics. The chapter where the product's opinion lives.
4. **Beyond the template** — the graph itself: what the shell does, how to change navigation, the
   first custom component. The off-ramp from "template user" to "NodeGX author".
5. **Into your LMS** — SCORM packaging, upload to Moodle/SCORM Cloud, what the LMS sees and why.
6. **The LMS you own** — standing up EL-006's starter; the script is EL-006 AC1's cold-start
   drive, verbatim.

These tutorials ARE UNI-007 lessons (the editor-lesson format) *about building courses* — the one
sentence where both vocabularies legitimately appear, which is exactly why D2's separation must be
airtight everywhere else: the product's unit is a **course**; the thing teaching you is a
**lesson**.

## Acceptance criteria

1. Each tutorial is driven end to end by someone (or an agent persona) who is *not* its author,
   producing the intended artifact — a deployed course, a working package, a running LMS — from
   the tutorial text alone. Divergences fix the tutorial, not the driver.
2. Tutorials install and verify clean as lessons — including the ones whose steps place
   `nodegx.learn.*` nodes: **confirm the lesson-verify path resolves kit types via CN-003's
   overlay built from the bundle's own files** (the seam exists — slice 4's lesson vocabularies —
   but confirm on *these* lessons; a refused install under F1 is the recorded failure shape).
3. The series is served through the D17 curriculum pipeline and reachable from the University
   surface, with P67's sign-off recorded (D7 spends their curriculum capacity).
4. Tutorial 3 lands the pedagogy claim on a real instructional designer (the student who started
   this phase is the obvious reviewer) — their assessment recorded, changes made or rebutted.
5. Vocabulary audit across all six: "lesson" appears only meaning UNI-007 lessons; course /
   activity / learner / cohort used per D2 throughout.

## Traps

- 🔴 **A lesson that teaches a kit node meets the strictest catalog consumer** — `lessonverify.ts`
  errors (F1) on unknown types for **every** provenance. CN-003/CN-004 built the overlay seams;
  AC2 exists because "the seam exists" and "these lessons pass" are different claims.
- ⚠️ Tutorials rot against a moving product — each is owned by the task that ships its feature
  (a change to the deck template that breaks tutorial 1 is EL-003 regression, not EL-008's), and
  this file records that ownership so the rot has a name.
- ⚠️ D17's obligation travels: a lesson must remain installable from a local directory with no
  origin — don't build these to assume the hosted pipeline.
- ⚠️ Screenshots date fastest; prefer the lesson format's live-condition checks (UNI-007's
  grading runner evaluates against the live graph) over pixel references wherever possible.

## Out of scope

- Marketing/landing content for the eLearning story (nodegx.io) — related, separately owned.
- Community/forum seeding around courseware — P67's ground.
- Certification of course authors — far future, and a P67 conversation anyway.
