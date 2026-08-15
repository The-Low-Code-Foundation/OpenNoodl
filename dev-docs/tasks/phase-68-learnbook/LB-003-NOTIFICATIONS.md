# LB-003 — notifications

**Surface:** platform (**platform-wide subsystem**, not LearnBook-only) · **Tier 1** ·
**Effort:** M/L · **Blocked on:** E6 (channel scope — recommendation: email v1, push flagged)

## Premise

Nothing in the platform has notification infrastructure: UNI-004's double-blind relay is the only
email machinery specced anywhere, and UNI-006 hand-waves "notifies the member". LearnBook cannot
exist without it — *"notified when a section has a new message they didn't write"* and *"notified
when visibility changes"* are core LearnBook behaviours — so this phase builds it, but 🔴 **as a
platform subsystem: events in, channels out.** A LearnBook-only notifier would be forked within a
month by UNI-006 and D8, which is exactly the principle-3 defect.

## Scope (v1)

- **The event→notification pipeline**: a typed event (`thread.replied`, `module.revealed`,
  `assignment.validated`, …) fans out to per-user notification rows honouring per-user,
  per-space preferences. Consumers this phase: LB-002 (new reply, **excluding the author** —
  LearnBook's rule), LB-005 (visibility reveals), LB-006 (assignment submitted/validated,
  live-session scheduled).
- **Email channel**: transactional sender with the D8 discipline — 🔴 no participant's address
  ever appears to another participant in a header, reply-to, or bounce; mail comes from the
  platform and links back into it.
- **PWA push channel behind a flag** (E6): service-worker + subscription storage built so the
  channel is a config switch, shipped dark if E6 says email-first.
- **Digest/batching**: per-space immediate vs daily-digest choice; a burst of replies in one
  thread collapses to one email (the anti-noise rule that keeps coaching threads usable).
- **Unread/read state**: consumes LB-002's per-thread unread; an in-app notification list with
  mark-read; opening the thread clears it.
- **Mutes**: per-thread and per-program.

## Acceptance criteria

1. A reply by A in a 3-person space notifies B and C and never A, over email, within the
   batching rules; headers/bounces contain no other participant's address (wire-level check, the
   D8 standard).
2. Ten rapid replies in one thread produce one digest email, not ten.
3. A muted thread produces no email but still accrues in-app unread.
4. A second producer (a fake UNI-006 `assignment.graded` event) flows through with **zero changes
   to the pipeline** — proving the subsystem is platform-wide, not LearnBook-shaped.
5. Push, if flagged on, delivers to an installed PWA with the same exclusion/mute rules.

## Not in v1

Mobile native push, per-notification-type preference matrix (immediate/digest/mute is enough),
weekly summaries, notification analytics.
