# LB-010 — safeguarding, moderation, and exit

**Surface:** platform · **Tier 2** (the gate itself ships in LB-004; this is the full treatment) ·
**Effort:** M · **Blocked on:** E3 (org-minor posture) for the gate's final shape, E5 (exit
window) for export — L5's default-off holds meanwhile

## Premise

A coaching space is an adult in ongoing private exchange with someone who trusts them — the
platform surface where D8's "reactive moderation" is least sufficient on its own and D10's
seriousness most applies. Three obligations, stated at scoping time per the D9 lesson:
**safeguarding** (who may be in a space with whom, and what oversight exists), **moderation**
(reporting works inside private threads too), and **exit** (ECO-004: the coachee's work remains
theirs and retrievable — D9 obligation 2 extended this to hosted records; coaching threads and
media are exactly that).

## Scope (v1)

- **The org-minor gate, finalised**: LB-004 shipped it closed (L5). This task implements E3's
  ruling — if E3 opens anything (e.g. group-only spaces inside a school org with org-admin
  visibility), it lands here with its own acceptance criteria; if E3 keeps it closed, this task
  records that and the gate's tests move here as its permanent home.
- **Reporting inside spaces**: report a post, a thread, or a participant, from either role —
  🔴 including coachee-reports-coach, which must not notify the reported party (the imbalance of
  the coaching relationship is the threat model). Reports land in the D8 admin review queue —
  the same reactive pipeline, one more source, not a second system.
- **Admin action set**: hide a post, freeze a space (read-only for all parties pending review),
  remove a participant, ban — each attributed and logged.
- **Export (E5)**: any participant exports *their* view of a space — the exchange they could see,
  their own media, in a portable form (HTML + files archive). 🔴 Session notes are excluded
  (LB-005's rule — they are the coach's), but they **are** in the deletion scope below.
- **Deletion**: a participant's GDPR deletion request removes their personal data — their
  account-linked identity on posts (content is anonymised or removed per the ruling recorded
  here at build time, argued to legal standards, not improvised), their media, and coach session
  notes about them. The **data inventory** habit from UNI-005 criterion 4 applies: a written
  inventory of every table/log/blob a coaching relationship touches, kept current.
- **Retention on space end**: E5's window enforced — after a program ends, read+export access
  per the ruling; a deletion event is notified in advance (the D9-obligation-1 pattern: expiry
  warns before it fires).

## Acceptance criteria

1. The report round trip from the coachee role, with the coach provably un-notified, through to
   an admin hide — end-to-end on a seeded space.
2. A frozen space rejects writes from every role including the coach-owner, while remaining
   readable and exportable.
3. An export archive opens offline and contains exactly the reporter's-eye view: nothing hidden
   from them, nothing of the coach's notes, all their media playable.
4. A deletion request against a seeded space leaves no orphaned identity in any table, log, or
   blob path — checked against the written data inventory, which the test forces to exist.
5. If E3 opened school spaces: org-admin visibility works exactly as ruled and not one endpoint
   further (the UNI-005 inspection-boundary standard).

## Not in v1

Proactive content scanning, identity verification/DBS-style checks for coaches (a real question
for a later, larger platform — noted), automated abuse detection, legal-hold tooling.
