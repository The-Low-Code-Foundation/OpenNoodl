# UNI-002 — points, badges, and the long list of challenges

**Surface:** platform · **Tier 1 (R1 — the big focus)** · **Effort:** M/L · ✅ **UNBLOCKED — D3 and D4 ruled 2026-08-14**

> **What the rulings fix here** ([RULINGS.md](RULINGS.md)):
> - **D3 — earn-only at launch.** Points accrue and display on the leaderboard and profile; nothing
>   is redeemable. No fulfilment, no shipping, no refund policy, no tax question in v1. 🔴 **But the
>   event ledger must be append-only and auditable from day one** — retro-fitting redemption onto a
>   ledger you cannot recount is the expensive version of this decision, and it is the one corner v1
>   must not cut. ⚠️ The currency's *name* is deliberately unruled: a copywriting choice with no
>   architectural consequence, pick it when the UI is written, do not let it block the engine.
> - **D4 — four families × three tiers** (Learning, Building, Contributing, Community;
>   bronze/silver/gold), ~12 flat-SVG artworks in the editor's existing icon idiom.
>   🔴 **The consequence is a schema constraint, not a decoration:** a challenge awards into a
>   **(family, tier)** — it does **not** carry a `badgeId`. That is precisely what makes R2's
>   deliberately-long challenge list affordable: the badge table stays twelve rows while the
>   challenge registry grows, and no new challenge is ever blocked on a drawing. A per-challenge
>   `badgeId` re-couples them — **do not build that.**

## Premise

Richard's ruling (R2): points and badges reward **contribution as well as consumption** — the
Backendless insight (progress → points → a $1 cap that mints a fan) extended so that answering a
forum question or publishing a prefab earns like completing a lesson does. The design centre is a
**challenge registry**: a long, growing list of named, repeatable-or-once achievements, each with
a points value, an optional badge, and an award mechanism.

## Scope (v1)

- **The ledger.** Append-only points events: `(account, challenge_id, source, awarded_by,
  timestamp, points)`. Balances and badge grants are *derived* from the ledger, never stored as
  the source of truth — disputes and de-duplication stay tractable.
- **The challenge registry** as data, not code: id, title, description, points, badge (optional),
  cardinality (once / repeatable / capped), award mechanism (see below). Adding a challenge is a
  content change, not a deploy.
- **Three award mechanisms**, in cost order:
  1. **Manual** — an admin grants it (meetup attendance, "helped a newcomer"). This is the v1
     workhorse: Richard granting points by hand after each meetup is a fine ledger writer.
  2. **Platform-event** — the platform observes it itself (forum answer accepted via Discourse
     webhook, prefab published, profile completed, RFP fulfilled).
  3. **Bridge-event** — the signed-in editor reports it (lesson graded, first component built).
     Consumes UNI-007's grading runner; stubs until it exists.
- **Badges**: earned via challenges, displayed on the profile (UNI-003). Launch set per D4 —
  draft the long candidate list in this task, let the ruling pick.
- **Anti-gaming basics**: per-challenge caps, admin revocation (a negative ledger entry),
  rate limits on platform-events.

## The challenge list — draft long, launch curated

Draft ≥40 candidates across: learning (lessons, paths, capstones), community (answers, accepted
answers, meetup attendance, replay watch-throughs), publishing (prefabs, templates, showcase
apps), helping (newcomer welcomes, bug reports that reproduce), org/education (class completed,
student cohort finished). The list is a living asset — it seeds certification later.

## Acceptance criteria

1. A manual grant, a platform-event grant (Discourse webhook fired in a test), and a stubbed
   bridge-event grant all land as ledger rows and derive the correct balance and badge state.
2. Revocation reverses points and badge without editing history.
3. A repeatable challenge respects its cap; a once-challenge refuses a second award.
4. The registry is editable without a schema migration or deploy.

## Not in v1

Redemption (merch, coaching discounts — D3 recommends earn-only at launch), leaderboards beyond
a simple top list, certification, seasonal/limited challenges.
