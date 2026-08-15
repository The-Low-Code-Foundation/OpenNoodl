# LB-006 — assignments and live sessions

**Surface:** platform · **Tier 2** · **Effort:** M · **Blocked on:** LB-001's `kind` enum;
UNI-006's state machine existing (🔴 reused, never forked — the D13 note in UNI-006)

## Premise

The two special thread kinds. An **assignment** thread carries responsibility: the coachee must
reply, and the coach must **validate** the reply — until then the thread, its module, and its
program can never mark complete (LearnBook's completion-integrity rule). A **live-session**
thread anchors a synchronous meeting: a video call URL (L6 — bought, never run by us) plus
attendance marks, living in the tree so the session's before/after discussion has a home.

## Scope (v1)

- **Assignment threads** (`kind: assignment`): the opening post states the work. The state
  machine is UNI-006's — assigned → submitted → validated/returned — with **the coach as the
  grader** (UNI-006 built the human-grader path first-class; this task is its second consumer,
  which is the proof it wasn't an escape hatch). "Returned with feedback" reopens the coachee's
  turn. A validated assignment marks the thread done; 🔴 **no manual done-marking bypass exists
  for assignment threads** — LB-001's roll-up treats an unvalidated assignment as a hard block on
  its ancestors.
- **Optional due date** per assignment, surfaced in LB-005's overviews and LB-003 notifications
  (due-soon, overdue — digest-rated, not naggy).
- **Live-session threads** (`kind: live-session`): scheduled datetime, video call URL, agenda in
  the opening post. Participants **mark their own attendance** in the thread while present
  (LearnBook's model — self-declared, coach can correct); the marks render as a simple roll.
  Scheduling produces an LB-003 notification; the session row is exactly a thread — no calendar
  engine here (Cal.com integration stays in UNI-004's booking side).
- **Completion interplay**: a live-session thread completes on coach's mark (attendance is a
  record, not a gate); assignment completion is validation-only, per above.

## Acceptance criteria

1. The full assignment round trip — assign → coachee replies → submit → coach returns with
   feedback → coachee resubmits → validate — with each transition notified to the right party
   and the module's done-state blocked until the final validate. One test walks the whole path.
2. Grep-provable reuse: the assignment states import from UNI-006's machinery; no
   parallel state enum exists in the LB codebase.
3. A program containing one unvalidated assignment can never reach done, whatever else is marked.
4. Attendance: two participants mark present, one doesn't; the roll shows exactly that; the coach
   corrects one mark and the change is attributed to the coach.

## Not in v1

Rubrics/scores on assignments (validate/return is the whole v1 verdict), file-typed submission
slots (a reply with LB-007 attachments suffices), recurring session series, calendar (.ics)
export, in-platform video.
