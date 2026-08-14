# UNI-003 — the profile that follows you

**Surface:** platform · **Tier 1** · **Effort:** M · **Blocked on:** D8 (who may list a public/dev profile)

## Premise

The profile is the connective tissue: it displays what UNI-002 records (points, badges), what the
prefab shelf publishes, and what UNI-004 sells (availability for work, coaching offers). Richard's
phrase: "the profile that follows you" — one identity visible across forum, RFPs, showcase, and
(later) certification.

## Scope (v1)

- **Private-by-default account page**: display name, avatar, bio, links. Public visibility is an
  explicit opt-in toggle.
- **Public profile page** (opted-in): badges, points, published prefabs/templates (wired when the
  shelf exists — placeholder section until UNI-005), showcase links, and the two professional
  flags:
  - **"Available for work"** — makes the profile discoverable from the RFP board (UNI-004).
  - **"Offers coaching"** — lists their coaching offer (UNI-004's booking rail).
- **Moderation minimum**: admin unpublish, a report button, display-name rules. D8 rules whether
  listing professionally requires anything (points floor, account age) beyond the toggle.

## Acceptance criteria

1. A fresh account has no public page; opting in creates one; opting out returns 404 (not a
   stub page).
2. Badges and points render from the UNI-002 ledger live — no copied denormalised state.
3. The two professional flags are independent of each other and of public visibility rules per
   D8's ruling.
4. Admin unpublish hides the page immediately and the owner sees why.

## Not in v1

Certification display, prefab install counts, endorsements/reviews of devs (a moderation
minefield — deliberately deferred), custom profile URLs.
