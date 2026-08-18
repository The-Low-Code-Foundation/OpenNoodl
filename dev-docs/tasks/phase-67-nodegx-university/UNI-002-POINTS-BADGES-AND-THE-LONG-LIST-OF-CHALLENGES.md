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
> 🔴 **AMENDED 2026-08-18 by D19.** Every *"via Discourse"* / *"Discourse webhook"* below is
> historical. The accepted-answer award becomes a call **in the same transaction as the accept**
> (UNI-015 AC2), and `src/lib/discourse-webhook.ts` + its route + its specs are **deleted, not
> re-pointed**. ✅ **The ENGINE does not change** — `event_key` selection, the integrity trigger,
> the price/cap/rate-limit read by the database, and AC4's *challenge invented at runtime* all
> stand, and **their specs must pass unchanged**, which is exactly what proves UNI-015 is a new
> caller rather than a new mechanism. ⚠️ The evidence table's row 1 records a webhook drive that
> really happened; it stays as a record of what was proved, not as a description of the system.

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

---

# ✅ BUILT 2026-08-16 (fifteenth session) — all four acceptance criteria met

**Repo:** `nodegx-community` (the sibling checkout), not this one. **Gates:** `105 specs / 8 files,
all pass` (baseline `57 / 5` ⇒ **+48 specs, +3 files**); `tsc --noEmit` **clean**; `next build`
succeeds. ⚠️ **`npm run lint` is not a gate in that repo** — there is no ESLint config, so the script
drops into an interactive setup prompt. It has never run there, and saying so is cheaper than a
column that reads green.

## Where each acceptance criterion is discharged

| AC | Met by | Evidence |
|---|---|---|
| **1** — manual, platform-event and stubbed bridge-event all land and derive balance + badge | `grantManual` / `recordEvent` in `src/lib/contribution.ts`; the Discourse receiver in `src/lib/discourse-webhook.ts` | 12 specs, **plus the route driven with `curl`** — signed body → `200` and 45 points on the ledger, forged → `401`, missing header → `401`, unconfigured → `503`, and the balance after all four is exactly one delivery's worth |
| **2** — revocation reverses points **and badge** without editing history | a revocation is an **INSERT** of the exact inverse carrying `revokes_id` | 6 specs. Badges are derived from *live* awards, so the badge half falls out of the same row rather than needing a second thing remembered |
| **3** — a repeatable challenge respects its cap; a once-challenge refuses a second | `max_awards` + the trigger, under a `pg_advisory_xact_lock` | 6 specs including **a real two-connection race** |
| **4** — the registry is editable without a schema migration or a deploy | `challenges` is a table; the engine selects by `event_key` and never by `slug` | a challenge **invented at runtime with a random slug** awards. No source file can contain a case for a string that did not exist when it was written |

## The three design calls worth not re-deriving

**1. 🔴 The rules live in the trigger, and the reason is NOT D14's.** The spine put its rulings in the
database because two clients can disagree. This engine has a second and sharper reason: one of the
three mechanisms is `bridge_event`, and **the bridge is the user's own editor**. An award path where
the client names the points value is a client that can award itself ten thousand points. So the
price, the mechanism allowed to claim a challenge, its cap and its rate limit are read from the
registry *by the database* at insert time, and a caller that disagrees is refused rather than
believed. `src/db/sql/0002_uni002_contribution_engine.sql` states the split out loud: the **database
enforces integrity**, the **module enforces eligibility**, and a caller that skips the module cannot
skip the database.

**2. 🔴 `points_ledger.challenge_id` is NOT NULL.** Every point in the system traces to a registry
row; there is no "manual adjustment" back door that the price, cap and mechanism rules cannot see.
That is the auditability half of D3 made structural — *"a ledger you cannot recount"* is exactly what
one untyped adjustment column produces.

**3. ⚠️ `awarded_by` has NO foreign key, and it is a decision rather than an oversight.** The only
lifecycles a reference to `accounts` could have are `set null` (an UPDATE, which D3 refuses
absolutely — *including inside an erasure*, which the spine proved deliberately), `restrict` (which
would make any admin who has ever granted a point unerasable, breaking UNI-001 AC3) or `cascade`
(which would delete other people's awards along with the admin). **An immutable audit record cannot
hold a reference whose upkeep requires rewriting it.** The recorded consequence: after an admin is
erased, their id survives in `awarded_by` pointing at no row in any table — two grants by the same
erased granter remain visibly the same granter, which is what an audit trail is for, and there is no
re-identification path left. **There is a spec asserting this**, so it reads as chosen.

## ✅ Nine control runs — every mechanism proved to bite

A green suite says only that nothing ran. Each row disables **one** thing and reports the whole
suite; every file was restored and `git status` confirmed afterwards.

| Control | Result |
|---|---|
| advisory lock removed | **exactly 1 fails** — the race spec, and nothing else. The strongest single row: without the lock two concurrent inserts of a once-only challenge both succeed |
| cap check disabled | 6 fail |
| points-mismatch check disabled | 2 fail |
| mechanism-mismatch check disabled | 1 fails |
| revocation-amount check disabled | 1 fails |
| rate limit disabled | 1 fails |
| **the whole integrity trigger never created** | **17 fail**, 88 still pass |
| webhook signature verification neutered | 2 fail |
| `badgesFor` stops excluding revoked awards | 1 fails — AC2's *badge* half, independent of its points half |

⚠️ **Two vacuity holes were found by the controls and closed**, which is the controls earning their
cost rather than confirming a prior: the leaderboard spec asserted `board[0]` and so was coupled to
every sibling test's balance (control 3 broke it for an unrelated reason); and two catalogue
assertions — *"every badge is reachable"* and *"challenges sharing a key agree"* — are queries that
**return nothing when the table is empty**, so both now assert a known-firing precondition first.

## 🔴 Findings worth carrying out of this task

**1. A BEFORE ROW trigger runs ahead of NOT NULL *and* foreign-key checks.** Two specs asserted
`23502` and `23503`; both got `P0001` from the trigger. Both guards refuse the row — but writing down
which one *speaks* is the difference between a spec that describes the system and one that describes
an assumption. Corrected by measuring, and the NOT NULL is now asserted directly from
`information_schema` rather than inferred from a refusal it did not produce.

**2. A type that lies survives because nothing exercises it.** `ledgerId` was typed `number`;
postgres.js returns `int8` as a **string** (`Number()` loses integers past 2^53). Every spec passed,
because an id is only ever carried and compared, never added to. ⚠️ And the fix exposed a third thing
the Drizzle mirror cannot express: `bigserial` accepts only `'number' | 'bigint'`, so `schema.ts`
*cannot say* what the driver returns. Both files are now correct **for their own reader** and say so.

**3. 🔴 A default-argument idiom turned a negative test into a positive one, silently.** The webhook
helper read `signature ?? signBody(body, SECRET)` — so the spec passing `null` to mean *"no signature
header at all"* was handed a correctly signed body and asserted the happy path while claiming to
assert a refusal. `=== undefined` now. **This is the phase's own shape** (*a failure indistinguishable
from a missing mechanism measures nothing*) arriving through a language feature rather than through a
weak assertion — and it failed loudly only because the test expected a rejection.

**4. `scripts/seed.mjs` named `0001_init.sql` directly** and would have seeded a database with this
entire engine missing, with nothing failing. It reads the directory now, and
`tests/db-schema-drift.test.ts` asserts `MIGRATIONS` equals that same sorted listing — so the three
descriptions of the migration set cannot drift apart again. **The spine's own guard, one level up:
two hand-maintained lists of one thing.**

**5. 🔴 D4's absence spec was asserted on the wrong table.** The existing spec checked `points_ledger`
for a `badge_id`. D4's words are *"a schema where **a challenge** carries a `badgeId` re-couples
them"* — and `challenges` did not exist when that spec was written, so the ruling's actual subject was
unguarded the moment it did. Both are now asserted, plus that `badges` is the twelve-row
cross-product **derived from the enums** rather than hand-listed, so a fifth family fails on the day
it is added.

## ⚠️ Cut deliberately, with the reason, so it reads as a decision

- **Threshold challenges** (*"published 5 prefabs"*, *"ten accepted answers"*) award **manually** at
  launch. A `requires_prior_awards` column was designed and dropped: several challenges legitimately
  share one `event_key` (a once-only badge beside a repeatable award), so a threshold counted in
  *awards* on that key counts the ladder's own rungs and is ambiguous. It is outside the scope list
  this task states, and D3's note already sanctions the manual route — *"Richard granting points by
  hand for a month is a fine v1 ledger writer"*. **The badge ladder is reachable today**; only its
  automation is deferred.
- **No admin route for manual grants.** `grantManual()` is a library function. An admin endpoint
  before UNI-001 issues sessions is a grant-points-to-anyone endpoint; it arrives with auth or not at
  all.
- 🔴 **The twelve badge artworks do not exist.** `badges.artwork` holds paths
  (`badges/learning-bronze.svg` …) and no SVG has been drawn. D4 asked for ~12 flat SVGs in the
  editor's icon idiom; that is design work, and it is the one part of D4 this task did not do.
  **UNI-003 renders the profile and will be the first thing to notice.**
- **The currency's name** is still unpicked, exactly as D3 left it. Nothing is blocked on it.
