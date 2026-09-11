# EL-007 — The nudge machine

| Field | Value |
|---|---|
| **Tier** | 4 |
| **Effort** | M |
| **Surface** | `backend`, `templates` |
| **Rulings** | **D5** (runs on the self-hosted backend) |
| **Depends on** | EL-006 (the schema it reads; AC4's seam is built for this task) |

## The job

The "learning software that learns back" demo, as template backend workflows on the LMS starter:

- **Enrollment welcome** — learner joins a cohort, gets the onboarding message with their
  assignments.
- **Deadline reminders** — approaching due date, unfinished assignment.
- **Inactivity nudges** — enrolled, started, gone quiet for N days.
- **Completion notifications** — learner finishes; the trainer hears.
- **Trainer digest** — weekly cohort progress summary (completions, laggards, average scores).

All five are template content a user can open, read and reshape — the nudge thresholds, copy and
cadence are the org's, not ours. Email is the v1 channel, via configurable SMTP/provider settings.

## Premises to measure before building

1. 🔴 **What scheduling primitive does the self-hosted backend actually have?** Reminders and
   digests need time-triggered execution (cron-shaped), not just request-triggered cloud
   functions. Establish what exists on the backend the LMS template targets *before* designing
   any workflow — if there is no scheduler, the honest v1 shapes are (a) a documented external
   cron hitting a trigger endpoint, or (b) evaluation-on-access. Pick from measurement; a designed
   workflow with no trigger is the failure mode.
2. What email-sending path exists server-side, and where do provider credentials live safely.

## Acceptance criteria

1. Each of the five workflows drives end to end on a real LMS-starter instance with a seeded
   cohort: the triggering condition is *created* (due date approaching, N quiet days — seeded
   data, since `Date.now` games are how these tests lie), and the message arrives with correct
   contents.
2. **The absence controls**: a learner who finished gets no reminder; a trainer whose cohort is
   fully complete gets a digest that says so rather than noise — asserted beside the firing case,
   never alone (`assert-an-absence-with-a-known-firing-signal-beside-it`).
3. Idempotence: the same trigger evaluated twice sends once — measured by running the schedule
   tick twice.
4. Thresholds and copy are data/settings a template user can edit without touching workflow
   logic — driven, per EL-006 AC5's pattern.
5. The scheduling answer from premise 1 is documented in the template with its failure mode (what
   happens when the cron doesn't fire — silence is the default, so the trainer digest doubles as
   the liveness signal, and the docs say so).

## Traps

- 🔴 **No kit nodes in any server-side workflow** (CN-012 — a cloud function using a kit node
  hangs, timeout not error, which in a scheduled job is invisible). Built-ins and plain code only.
- ⚠️ Email is the org's deliverability problem, but *our* template defaults decide whether they
  start in spam: plain transactional copy, no image-heavy digests, provider config documented.
- ⚠️ Nudge fatigue is a pedagogy failure dressed as a feature: defaults err quiet (one reminder,
  one inactivity nudge), and the tutorial says why. This is the kind of opinion the ID audience
  will judge us by.
- ⚠️ Time-zone honesty in due dates and digests — store UTC, render local, and say which.

## Out of scope

- Push/SMS/Slack channels — the workflow shape is channel-agnostic; email proves it.
- Adaptive release (unlocking content on performance) — the data-loop phase, later; the seam it
  needs (queryable progress) is EL-006 AC4.
- Any messaging *between* learners — the LMS is not a social product; that ground is P67/P68's.
