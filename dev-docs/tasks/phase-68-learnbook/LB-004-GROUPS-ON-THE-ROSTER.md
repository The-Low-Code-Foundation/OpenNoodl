# LB-004 — groups on the roster

**Surface:** platform · **Tier 1** · **Effort:** M · **Blocked on:** UNI-005's roster existing;
ships with L5's org-minor gate (LB-010 deepens it)

## Premise

LearnBook's coach abilities: *"make groups, add coachees, create and invite them by email, manage
group composition."* UNI-005 already built exactly this shape for orgs — one roster table, two
membership sources, invite-by-email included. 🔴 **A coaching group is a use of that roster, never
a second group system** (D13 consequence, written into UNI-005). Solo coach↔coachee programs need
none of this — LB-001's participant list covers a pair — so this task is only about *groups*.

## Scope (v1)

- **Coaching group**: a roster-backed collection owned by a coach; membership source
  `coach-invite` joins UNI-005's `github` / `invite-list` as a column value, not a new table.
- **Invite by email**: an invited address that has no NodeGX account gets a sign-up-then-land
  invite (UNI-001's flow with a destination); one that has an account gets a join notification
  (LB-003). Invites expire and are revocable.
- **Composition management**: add/remove members, promote a co-coach; removal follows LB-001
  criterion 4 (access gone on next request) plus a roster-side record of when and by whom.
- **Group ↔ program attachment**: a program's participant list can *be* a group (membership
  changes flow through) or a frozen copy (a cohort snapshot) — coach chooses at attach time, the
  UI says which is which plainly.
- 🔴 **The org-minor gate (L5)**: an org-owned pseudonymous account (D10) **cannot be added to
  any coaching group or program** — the add fails with a stated reason, logged. This ships here,
  with the group machinery, not in LB-010 later: the gate must exist from the first day groups
  do. E3's ruling later decides what, if anything, opens.

## Acceptance criteria

1. A coach invites a fresh email address; the invitee signs up and lands in the group; the
   roster row records source `coach-invite`. No branch on membership source anywhere downstream
   (the D6 rule, re-proved here).
2. A live-attached group propagates a member removal to the program's access immediately; a
   frozen cohort does not.
3. Adding an org-minor account to a group fails closed, with the refusal logged — proved with a
   test org from UNI-005's D10 fixtures.
4. A removed member's threads remain visible to the group (history is the group's too), but the
   removed member loses all access (E5's export path, once built, still applies to their own
   contributions).

## Not in v1

Coachee-initiated join requests, public/discoverable groups, group-to-group operations, waitlists,
seat limits/billing.
