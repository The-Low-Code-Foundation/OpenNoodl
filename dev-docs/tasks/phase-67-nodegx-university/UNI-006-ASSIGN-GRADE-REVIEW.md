# UNI-006 — assign, grade, review

**Surface:** platform + bridge · **Tier 2 (R6)** · **Effort:** M/L · **Blocked on:** ~~D10~~ ✅ **ruled
2026-08-14** (org-owned pseudonymous accounts), ~~D12~~ 🔴 **struck — already ruled 2026-08-09**;
consumes UNI-007's lesson format and grading runner

> **Three corrections from [PRIOR-ART-RECONCILIATION.md](PRIOR-ART-RECONCILIATION.md) (2026-08-14):**
> - **D12 does not exist.** LEARN-002's D1–D9 were answered 2026-08-09
>   ([CURRICULUM-DESIGN §10](../phase-17-noodl-learn/CURRICULUM-DESIGN.md)). What actually gates the
>   curriculum is §11's three authoring blockers, two of which wait on phases 60 and 61.
> - **No live co-editing.** R6's "old scoping" resolves to [phase 51](../phase-51-collaboration/README.md)
>   (async git-merge); [ECO-001](../phase-20-ecosystem/ECO-001-COLLABORATIVE-EDITING.md) is parked.
>   🔴 ECO-001's headline education pitch — *"a teacher watching twenty-five student graphs update
>   live"* — is **not available to this task** and must not appear in its scope. The results view is
>   a submission dashboard, not a live window.
> - **D10's obligations** (pseudonymity must be real; LEARN-005 gets amended; tier-1 AI projection
>   off by default for org-minor accounts) are listed in
>   [UNI-005](UNI-005-AN-ORG-IS-A-ROSTER-AND-A-SHELF.md) and apply here too — this is the task that
>   actually stores graded results about minors.

## Premise

The teaching layer on top of orgs (R6): an org admin (teacher, team lead) **pushes lessons and
assignments** to members, **views graded results**, and can **grade manually instead of the AI**
— the human override is a first-class path, not an escape hatch. This is the surface schools
actually buy consulting around, and the twin of the "corporate onboarding" offer.

## Scope (v1)

- **Assignment model**: an org admin assigns a lesson (from the curated catalogue or the org's
  own, in UNI-007's lesson format) to members or the whole roster, with an optional due date.
- **Delivery over the bridge, pull-only**: the member's signed-in editor sees the assignment and
  pulls the lesson project into the Learning folder (UNI-007's mechanics — nothing new here, an
  assignment is a lesson with an audience and a deadline).
- **Results view**: per-member, per-assignment: state (not started / in progress / submitted),
  the machine-grading report (from the editor-side runner: validate + render evidence), score,
  feedback.
- **Manual grading**: the admin opens a submission's evidence (graph summary, render report,
  the runner's findings), sets/overrides the score, writes feedback. AI-graded results are
  labelled as such and always overridable. The audit trail keeps both gradings.
- **The submission artifact**: what "submit" uploads is the runner's evidence bundle, not the
  raw project by default — D10-friendly (minimal data), bandwidth-friendly, and enough for a
  human to grade. A "request full project" escalation exists for when evidence isn't enough,
  visible to the student.

## Acceptance criteria

1. Assign → member's editor pulls it (outbound) → member completes → submit → machine grade
   lands in the admin's results view — one full round trip on a test org.
2. Manual override changes the score, preserves the machine grade in the trail, and notifies
   the member with the feedback text.
3. A member outside the org (or removed mid-assignment) cannot pull the assignment or submit.
4. The evidence bundle contains no more than the documented field list (spec-pinned, the
   export-allow-list discipline applied to submissions).

## Not in v1

Live proctoring/observation of a student editor (explicitly never — the bridge is pull-only),
plagiarism detection, gradebook export/LMS integration (SCORM/LTI — a school will ask; noted,
deferred), peer review.
