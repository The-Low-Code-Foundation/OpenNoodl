# FB-001 — the post you cannot take back

**Filed:** 2026-08-22, from Richard's item 1a. **Status: ✅ BUILT 2026-08-23 (session 9), both
surfaces. NOT YET DRIVEN.** Ruling D7 landed 2026-08-22; scope-3 ruling landed 2026-08-23.
Size: M.

✅ **D7, as ruled:** *edit own post body* and *delete own thread while nobody else has answered* —
exactly scope items 1 and 2 below. Richard **declined** the wider options: **no report/flag** and
**no hide-after-answers**, so an answered thread is simply undeletable and the refusal says so.
D19's no-revision-history exclusion stands: `updated_at` is the whole history. **Build scope 1–3
as written; do not grow a fourth verb without a new ruling.**

> *"Right now in the community I can't edit or delete the questions I added to the bench."*

---

## What exists (swept 2026-08-22)

- **No mutation surface at all.** `nodegx-community/src/app/api/v1/bench/**` has no PATCH and no
  DELETE on threads or posts (only `same-here` has a DELETE). `src/lib/bench.ts` exports no
  edit/delete function.
- **The absence was chosen, twice.** `UNI-015-THE-BENCH.md` "Not in v1": *"no drafts, no edit
  history beyond an `updated_at`"*; P67 D19's Discourse exclusion list names *post revisions*.
- **The ruling that owns this is D7** (`phase-72-nobody-has-to-leave/README.md` ~200):
  *"Report/flag/delete-own — which of these ship."* Still open.

So this is not a regression — it is the chosen absence meeting its first real user. The task is
to answer D7 and then build the smallest honest version.

## Scope (proposed, pending D7)

1. **Edit own post body** — PATCH, author-only, stamps `updated_at`, no revision history (v1
   keeps D19's exclusion). The web thread shows "edited" from `updated_at`.
2. **Delete own thread** — only while it has **no answers from others**; after that it is part of
   someone else's record and the verb becomes *hide* or nothing (D7 decides). An accepted answer
   makes the thread definitively undeletable.
3. Editor mirror gets the same verbs or deliberately doesn't — **D15: both surfaces must agree**;
   shipping it web-only is a decision to record, not an accident.

## Acceptance criteria

- AC1: The author of a thread can edit their own question body; a non-author gets a tagged
  refusal, not a 404-shaped lie (D15 governs what a hidden thread reveals).
- AC2: The author can delete their own thread while it is unanswered; the list stops showing it;
  the refusal for an answered thread names why.
- AC3: Refusals follow the migration-tag pattern — and remember NAT-009's finding: **the refusal
  surface is bigger than its doc**; sweep the migration per function and state the bound in the
  spec.
- AC4: New routes comply with the `/v1` envelope (`tests/nat006-api-contract.test.ts` will
  enforce it) and get a route-inventory D15 verdict; writes go through the byte-capped
  `apiwrite.ts` path.

## Traps

- The four derived-from-disk platform gates fire on any new route; run the suite early, after
  `npm run build`.
- `updated_at` is the only history v1 keeps — do not quietly grow a revisions table; that
  reverses D19 and belongs in a ruling.

---

## What was built — 2026-08-23, session 9

✅ **Scope 1, 2 and 3, and scope 3 was RULED: the editor gets the same verbs.** Richard chose
verb parity over web-only. The reasoning that decided it: the editor is *already* a full writing
client — it asks, answers and accepts — so "the post you cannot take back" reproduces inside it
exactly, and a web-only fix would have left the complaint standing in the surface Richard was
using when he filed it.

### The platform

| Piece | Where |
|---|---|
| `editPost` / `deleteThread` / `postSourceFor` | `src/lib/bench.ts` |
| `PATCH` + author-only `GET` | `.../bench/threads/[threadId]/posts/[postId]/route.ts` |
| `DELETE` | `.../bench/threads/[threadId]/route.ts` |
| Refusal verdicts | `src/lib/bench-http.ts` — 4 new tags |
| **Migration `0018`** | the ban, on the path that did not exist when the ban was written |
| `bodyOptional` | `src/lib/apiwrite.ts` |

- ✅ **AC1** — the author edits their own post body; a non-author gets **403 with a sentence**,
  never a 404-shaped lie. A hidden post and a missing one answer **identically** on purpose.
- ✅ **AC2** — the author deletes an unanswered thread (**204**, no body). Their *own* follow-up
  does not lock it; **somebody else's answer does**, and so does a hidden one — otherwise getting
  an answer hidden becomes a way to unlock the delete. **409**, and the sentence names why.
- ✅ **AC3** — the refusal sweep reads the tags **off `bench.ts` per function**, with a
  known-firing control (an invented tag must fall to the catch-all, and every real tag must
  differ from it — `refusalResponse` has a total default, so a mapping check over it passes on an
  EMPTY table). **Bound stated in the file**: the two FB-001 functions only; UNI-015's insert path
  is swept in its own suite.
- ✅ **AC4** — `/v1` envelope, recipe verdict, byte-capped write path. `updated_at` is still the
  whole history; no revisions table.

### 🔴 Three findings, and the first is the one worth carrying

1. **A BAN DID NOT REACH THE EDIT VERB, AND NOTHING ABOVE THE DATABASE WOULD HAVE CAUGHT IT.**
   `bench_posts_author_eligible` is **`BEFORE INSERT`** — correct and complete for as long as a
   post could only be *created*. Above it, `communityGate` refuses D15's `absent` (a school
   switch, not a ban) and `serveCommunityWrite`'s capability check reads `communityVisibility`,
   whose viewer kinds are anonymous / individual / org_minor — **a banned account is an
   `individual` and holds every write capability**. So shipping the edit verb without `0018`
   would have turned a ban from *"you may not post"* into *"you may not post anything NEW"*: an
   unbounded content channel out of a sanction.
   - 🔴 **And the obvious fix was wrong in a way only an arm would find.** A plain
     `BEFORE UPDATE` gate refuses `upholdReport`'s hide — making a banned account's posts **the
     only ones a moderator cannot hide**, which inverts the rule. `when (new.body is distinct
     from old.body)` is the whole guard, and the spec row that would go red if somebody
     simplified it is *"a moderator can still hide a banned account's post"*.
   - Mutation-checked: unregistering `0018` turns exactly **2** rows red, both behavioural.
2. 🔴 **`tests/api-malformed-id.test.ts` HAD A HOLE SHAPED LIKE THIS TASK.** It discovered a
   route by its `[…Id]` segments and then drove only `GET` and `POST` — the two verbs it was
   born knowing. A **`PATCH`-only route was discovered and driven zero times**, and the
   non-vacuity floor (`driven >= 9`) is satisfied by the GETs alone, so it passed. Widened to all
   four verbs, **and given a row that asserts the ARM** (at least one route of each mutating verb
   in scope) — because narrowing `VERBS` back would otherwise go quiet rather than red. Verified
   by mutation: stripping `isId` from the new PATCH now fails the sweep; before, it could not.
3. ⚠️ **`/api/v1/me` nests the handle under `viewer`, and reading it flat FAILS SILENTLY.** The
   first `PostControls` read `body.handle`; `undefined === handle` is false, so the controls
   simply never appeared and nothing threw. Caught by checking the route rather than the
   component. Pinned by a spec that asserts both halves — `viewer.handle` is the handle, **and
   there is no top-level one** — plus a source-text row on the component.

### What is NOT done

- 🔴 **NEITHER SURFACE HAS BEEN DRIVEN.** Everything above is specs — 34 rows against a real
  database on the platform, 18 decision rows in the editor — and this phase's standing lesson is
  that a spec asserting a mechanism passes on dead code. Specifically undriven:
  - the **web** controls (`PostControls`): the `/me` fetch, the source fetch, the save, the
    `confirm` + delete + redirect;
  - the **editor** pane: `editFor` is graded, but nothing has watched the panel place the verbs,
    and **no editor bench WRITE has ever been driven** (NAT-012 AC4's other half is the same gap).
  - ⚠️ The editor drive needs a signed-in editor against the live platform, which is the thing
    NAT-012 AC4 is still waiting on — so these two are one drive, not two.
- **Not deployed.** nexus-1 is still `8d40b63`; this lands behind `9ecec25` and `fd695ae`, which
  were already unshipped. Deploying changes the live site — **Richard's call**.

### Measurements — 2026-08-23, session 9

- **Community suite**: see the session log; run after `npm run build` so the real-HTTP file does
  not self-skip.
- **Editor `tests-unit`**: **292 suites / 4759 specs, 0 failures.** Reconciles exactly against
  session 8's 291 / 4741 — **+1 suite / +18 specs**, both `fb-001/editverbs.test.ts`.
- `typecheck:editor`, `typecheck:editor-tests`: 0. `typecheck:core-ui`: **44 pre-existing
  `TS2307`**, unchanged, nothing else.
