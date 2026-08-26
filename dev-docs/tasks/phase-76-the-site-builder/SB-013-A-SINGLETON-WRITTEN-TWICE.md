# SB-013 — A singleton written twice

**Status: ✅ FIXED s10 — and the fix is not the one this file recommended.** One `claimSite` call
left **two identical `SiteSettings` rows**; it now leaves one. §4's recommendation (drop the
explicit `storageFetch`) was measured against the row count only, and the row count is not the
property this endpoint is for: §6 below is the reading that decided it, in which the recommended
arm passes and an adjacent one **puts an outsider in the `admin` role on an already-claimed site**.

Arms: `packages/nodegx-backend/tests/sb004-publication-invariant.test.ts`, describe **"SB-013 — the
second claim, and the two barriers that refuse it"** (5 arms). The original reading stays in
`sb008-public-site-drive.test.ts` describe **"✅ F21"**, now asserting 1.

## 1. What was measured

One `POST /functions/claimSite` with the right token, on a backend that has never been claimed, over
a bundle authored by the real MCP door:

```
[{ objectId: a60f…, createdAt: …07.720Z, siteName: "My site", homeSlug: "home", ACL: {role:admin rw, * r} },
 { objectId: 27d2…, createdAt: …07.731Z, siteName: "My site", homeSlug: "home", ACL: {role:admin rw, * r} }]
```

Eleven milliseconds apart, byte-identical apart from the id. The `admin` role has **one** member in
every arm, which is why nothing downstream ever complained.

## 2. Where the second write comes from — two arms, one edge each

Each arm mutates the deployed bundle by removing a single wire and changes nothing else, so the pair
is a comparison rather than two anecdotes.

| arm | wire removed | `SiteSettings` rows | role members |
|---|---|---|---|
| shipped | — | **2** | 1 |
| A | `grant.unchanged → mark.store` | **1** | 1 |
| B | `secret.done → settings.storageFetch` | **1** | 1 |

The outcome contract fires exactly one of `done` / `unchanged` / `failure` per invocation
(`node.ts:866-905`; a second report raises `outcome/duplicate` rather than winning quietly). So two
rows means **two invocations of the whole gate → grant → mark chain**, not one node firing twice.

**Arm B says where the two invocations come from.** The gate runs on `settings.fetched`. That query
is the *unfiltered singleton* shape SB-004 s4 arrived at — both `runOnChange-*` boxes left **on**,
because with them off there is no filter parameter left to trigger it and `claimSite` never decides
at all. So the query fetches **at graph-build time** and **again** on the explicit `storageFetch`:
two `fetched` pulses, two gate runs, two grants, two stores.

**Arm A says what turns the second pass into a record.** `grant.done` and `grant.unchanged` are both
wired into `mark.store`, and the comment on those two lines is explicit about why: *"already being in
the role is the post-condition already holding, by explicit contract, so a re-run must not go red."*
The second invocation finds the caller already in the role, reports `unchanged` — and writes a second
row.

🔴 **The wire that makes a re-run safe is the wire that makes a re-run duplicate.** Both halves are
correct in isolation and the pair is the defect.

## 3. Why it matters

`SiteSettings` is a singleton by convention and by nothing else. Both readers take `rows[0]`:
`readSettings` on the public site (`sb006Components.ts`) and `readSettings` in the panel's setup page
(`sb005Components.ts`). Nothing orders that list and nothing constrains which row a given query
returns first, so **the panel can edit one row while the site reads the other** — a Save that appears
to do nothing, on the first screen a new owner touches, with no error anywhere.

⚠️ It also means `claimSite`'s own "is this site unclaimed" reading is taken against a collection it
is in the middle of writing. The second gate run saw `isEmpty === true` because the first store had
not landed yet — which is the race, and it is why a third pulse would produce a third row rather than
a refusal.

## 4. Three candidate fixes, and what each costs

1. **Stop the double fetch.** The explicit `storageFetch` exists because SB-004 s4's rule said an
   unfiltered query with the boxes off has no trigger — but the boxes are *on* here, so the
   load-time fetch already runs and the explicit one is redundant. Arm B is this fix, and it is one
   wire. ⚠️ It makes `claimSite` depend on the load-time fetch having completed before `receive`,
   which is true today and is not written down anywhere. **This is the recommendation**, with the
   dependency stated on the wire.
2. **Make the write idempotent.** `mark` becomes an upsert keyed on the collection being empty, or
   `unchanged` stops feeding `store`. Arm A is the second half of this, and it re-opens exactly the
   scenario the original comment named: a role created by hand with the owner already in it, and no
   settings row yet, would then leave the site with no settings row at all.
3. **Gate the store on the outcome.** Keep both wires, add a `Condition` that only stores when the
   settings query was empty *at the moment of the store*. Most correct, most nodes, and it needs a
   value the graph does not currently carry.

🧭 **Not ours to pick unilaterally**: 1 and 2 change `sb004Components.ts`, which is a **closed** task
with 29 specs and five graded mutants, and 2 changes behaviour the original author wrote a paragraph
to justify. Whichever is taken, SB-004's suite gains the assertion that was missing: **count the
rows.**

## 5. The wider shape, worth reading before fixing anything else

This is the third defect in the phase whose cause is *a signal firing more times than the author
counted*, and the second where SB-004's own rules were involved:

- **F11** — a signal is not a promise that the values beside it arrived.
- **F12** — a query fetches once, unfiltered, at graph-build time.
- **F21** — and when you also trigger it by hand, it fetches **twice**, and everything downstream
  runs twice.

F12's fix (turn the boxes off) and F21's cause (leave them on and trigger by hand) are the two ends
of the same rule, which is why `BACKEND-AUTHORING-MODEL.md` §"Five things a deployed graph does not
do the way the canvas does" should gain the third case: **a query with its `runOnChange` boxes on and
an explicit `storageFetch` fires `fetched` twice.**

## 6. What s10 measured, and why §4's recommendation was not taken

🔴 **The arms in §2 varied a wire and counted rows. Neither asked the question the endpoint
exists to answer: does an already-claimed site still refuse?** That reading turns out to separate
the candidates, and §4's recommended fix is on the wrong side of it.

Each row is one claim by an owner, then a second claim by a **different** user with the **correct**
token, on a backend of its own. `outsider admin` is the only column that distinguishes a refusal
from a refusal-shaped breach — every arm answered `This site cannot be claimed.` with a 400.

| arm | `SiteSettings` | `Theme` | 1st answer | outsider admin |
|---|---|---|---|---|
| shipped (before s10) | 2 | 0 | `claimed: true` | no |
| §4.1 — drop `secret.done → storageFetch` | 1 | 0 | `claimed: true` | no |
| load-time fetch off, nothing else | 2 | 0 | `undefined` | 🔴 **YES** |
| **s10's fix** — load-time fetch off, gate boxes off, readiness guard | **1** | **1** | `claimed: true` | no |

**The third row is the finding.** It is one checkbox away from §4.1 and it opens the door, because
`Run` is **purely additive** (`run-on-value-change.ts`, constraints 1 and 2): wiring
`fetched → Run` adds a trigger and unticks nothing, so the gate *also* re-ran as each input value
arrived — and the run carrying the secret happens before the query answers, where `isEmpty` is
`true` for a collection with rows in it (`dbcollectionnode2.ts:410-421`).

🔴 **So §4.1 passes on a race it does not own.** With only the load-time fetch, the gate's decisive
run is still a value-change run; nothing orders it after the query, and the fetch scheduled at
graph-build time simply tends to win. The arm above is what that hazard looks like when it loses.
The graph now closes it twice, and the two are graded independently against that same failure:

- **A — the gate's `runOnChange-in-*` boxes are off**, so `fetched` really is its only trigger.
  Removing the guard with A in place: still refused, still one row.
- **B — the script returns unless `Inputs.rows` is defined.** `items` is the only output of a
  Query Records node that separates *matched nothing* (`[]`) from *has not run* (`undefined`).
  Turning the boxes back on with B in place: still refused.
- **Neither**: the outsider is an admin, and there are three `SiteSettings` rows.

⚠️ **B alone also costs the answer**, which is why both ship rather than the cheaper one: with the
boxes on the gate runs more than once, and the run that publishes `claimed` is not the run the
Response sends on — the caller is told `claimed: undefined` by a site that IS claimed, which is how
an owner comes back and claims again.

⚠️ **And the row half is finer than §2 said.** With the gate deciding on `fetched` alone, turning
the load-time fetch back **on** changes nothing — still one row. So the second row was never "two
fetches" as such; it was the second *gate run*, and that run was the value-change one. The fix
belongs on the consumer, not only on the query.

✅ §4's closing ask is met: SB-004's suite counts the rows, and now the themes
(`🔴 writes exactly ONE of each singleton`).

## 7. What the reference doc had to change

`BACKEND-AUTHORING-MODEL.md` §"Five things a deployed graph does not do the way the canvas does"
(renamed from Four) carries two corrections rather than an addition:

- **Rule 3's ⚠️ was a misattribution.** It read *"do the opposite for an unfiltered query — with
  those boxes off the `isEmpty` output is never flagged"*. Measured: with the boxes off and an
  explicit `storageFetch`, the query **does** fetch and `isEmpty` **is** flagged. What read a
  claimed site as unclaimed was the consumer, every time. The table gains the row this endpoint is:
  *unfiltered, read by a consumer that must not decide early → boxes off, `Do` wired*.
- **Rule 5 is new** and is the general form: `Run` is additive, and every output with a pre-fetch
  default — `isEmpty`, `count`, `firstItemId` — answers before there is anything to answer about.
  Take readiness from `items` and the answer from the output you wanted.

Both are in `BACKEND_DOCTRINE_MD`, which also finally carries rule 3's second half — s8's named
debt, and this task is a fair measure of what leaving it out cost.
