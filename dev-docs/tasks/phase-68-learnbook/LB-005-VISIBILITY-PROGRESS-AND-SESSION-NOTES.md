# LB-005 — visibility, progress, and session notes

**Surface:** platform · **Tier 2** · **Effort:** M · **Blocked on:** LB-001 (the flags live
there), LB-003 (the reveal notification)

## Premise

Three things turn the tree into *coaching*: the coach **paces** the material (reveal modules as
the coachee is ready — LearnBook's visibility model), **sees** where everyone is (individually
and as a group), and **remembers** what happened (post-session notes that point at the next
session). All three are coach-side; the coachee's experience is the reveal notification and an
honest progress view of their own.

## Scope (v1)

- **Reveal flow**: coach toggles module/program visibility (LB-001's flags); the coachee gets an
  LB-003 notification ("Module 3 is now open"). Un-revealing is allowed but never silently hides
  work-in-progress — a thread with coachee replies warns the coach before hiding.
- **Progress overview, individual**: per coachee per program — modules/threads done vs visible,
  assignments pending whose action (waiting-on-coachee vs waiting-on-coach-validation — the two
  states LearnBook's model makes meaningful), last activity date.
- **Progress overview, group**: the same, as a members × modules grid — the "who is stuck"
  at-a-glance view. Derived from LB-001's roll-up; **no second bookkeeping**.
- **Session notes**: coach-private notes attached to a program (optionally pinned to a module or
  a live-session thread): free rich text (LB-002's composer) with a "path for next session"
  convention in the template. 🔴 **Never visible to the coachee, and excluded from the coachee's
  E5 export** — they are the coach's professional notes, not the exchange. They *are* personal
  data about the coachee under GDPR: they appear in LB-010's data inventory and are deletable
  when a coachee invokes deletion.
- **Waiting-on indicators** in the tree UI: each thread shows whose move it is, derived from last
  poster + assignment state.

## Acceptance criteria

1. Reveal → notification → coachee's tree updates: the round trip proved end-to-end.
2. The group grid agrees with the individual views and with LB-001's roll-up on a seeded fixture
   (one derivation, three renderings).
3. Session notes are absent from every coachee-facing endpoint — proved the UNI-005-criterion-3
   way: a written check over the API surface, not UI spot-checks.
4. A coachee's own progress view never shows hidden modules, including in counts ("3 of 5" where
   5 is the *visible* total — hidden scope is also information, LB-001 criterion 1's rule).

## Not in v1

Progress emails/weekly summaries, streaks/nudges, goal-setting features, coachee-visible session
notes ("shared notes" — a real feature, later), analytics beyond the grid.
