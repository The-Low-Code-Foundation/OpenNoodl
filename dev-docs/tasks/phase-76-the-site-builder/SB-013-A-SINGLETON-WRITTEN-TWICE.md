# SB-013 — A singleton written twice

**Status: ⬜ MEASURED s8 (SB-008 F21), not fixed.** One `claimSite` call leaves **two identical
`SiteSettings` rows** on a fresh backend. The mechanism is measured with two one-edge arms; the fix
is a choice between two, which is why it is filed rather than taken.

Probe: `packages/nodegx-backend/tests/sb008-public-site-drive.test.ts`, describe **"🔴 F21"**.

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
of the same rule, which is why `BACKEND-AUTHORING-MODEL.md` §"Four things a deployed graph does not
do the way the canvas does" should gain the third case: **a query with its `runOnChange` boxes on and
an explicit `storageFetch` fires `fetched` twice.**
