# REL-015 — The shelves you can fill

**Opened** 2026-09-04 from Richard's testing pass · Effort: **M** (three small pieces, one ruling)

> *"There's nothing in the 'Tutorials' tab (if I need to make one, I will), there's no replays (I
> have a couple of YT links I can give you), and there's no people… we currently have no button to
> add a 'person', it should be free for any registered member to do so."*
>
> *"Anyone in the community can list themselves, but they need admin / moderator approval on their
> submission. Simple 'allow' and then they're visible for anyone with the editor please."*
> — Richard, 2026-09-04

## The finding, in one sentence

All three surfaces have **real tables and working read endpoints**. Every gap is on the **write**
side, and in two of three cases the only writer in existence is a hardcoded array in
`scripts/seed.mjs` — which is destructive to the whole database.

⚠️ Platform work lives in the sibling repo `/Users/richardosborne/vscode_projects/nodegx-community`.

---

## §1 People — self-listing with approval

### The bar he will fail without knowing why

`src/lib/profiles.ts` filters the directory on `profile_meets_bar(a.id)`, defined in
`0004_uni004_rfps_and_coaching.sql`: a display name, a non-empty bio, **and**
`profile_has_evidence()` — at least one un-revoked award in the `building` or `learning` family.

So Richard and Dishant can sign up, write bios, set visibility to public, and **still not appear.**

✅ Self-service profile editing already exists on the **web** (`/settings` → `POST /api/v1/me/profile`,
with a `visibility` opt-in). It is the *directory gate* that hides them, and the *editor* that has no
path to it at all.

### 🔴 This reverses ruling D8, and the reversal must be written down

D8 (`phase-67-nodegx-university/RULINGS.md`) chose reactive moderation **on purpose**:

> *"approval-first is a queue only one person can clear, and it is a bottleneck that grows with
> success — the failure mode is that the board looks dead because Richard was busy."*

Richard has now ruled the other way. ⚠️ **Two code comments currently assert "never approval-first"**
— `0003_uni003_profiles.sql` and `src/lib/moderation.ts` — and become lies unless amended. Record the
new ruling **quoting D8**, the way judgement 3 reversed D39 rather than quietly deleting it.

### Acceptance criteria

- **AC1** — a new `profiles.listing_status` (`unlisted` / `pending` / `approved` / `declined`),
  following the vocabulary already proven in `0021_fb005_template_submissions.sql`.
- **AC2** — `listDirectory` filters on `listing_status = 'approved'`, **AND-ed with**, never
  replacing, `visibility = 'public'` and `hidden_at is null`. An approved-then-privated profile must
  disappear.
- **AC3** — 🔴 **`profile_meets_bar` is NOT dropped or redefined.** It has four other callers with
  their own acceptance criteria — `coaching.ts`, `queue.ts` (UNI-017 AC4 asserts the coach queue is
  gated by it *"and by nothing else"*), the `rfp_response_gate` trigger, and the owner's progress
  meter. Redefining it silently changes who may answer an RFP.
- **AC4** — the migration defaults existing rows to **`unlisted`**, not `approved`. ⚠️ Count
  production first: an `approved` default publishes every existing public profile with no review.
- **AC5** — an approval mechanism Richard can actually run. Cheapest credible: a script beside
  `scripts/promote-template-submission.ts`, whose own header argues this exact case — *"promotion
  needs a DATABASE CREDENTIAL, not a session token. An admin route would need its own authorisation
  model … which is a decision nobody has made."* Verbs: `list` / `approve <handle>` / `decline
  <handle> --note`.
- **AC6** — approval is **revocable**.
- **AC7** — `src/db/schema.ts` is updated by hand alongside the migration or
  `tests/db-schema-drift.test.ts` goes red.

### 🔴 Leak flags — approval-gating the directory is not enough

- `coaching.ts`'s `OFFER_LISTABLE` lists people **without** going through `listDirectory`.
- `publicProfile` / `hasPublicProfile` gate on visibility alone — `/u/<handle>` never honoured the
  bar and will not honour approval.
- `personSummary` publishes handle, bio, skills and rate band to **unauthenticated** callers, so a
  wrongly-approved row leaks all of it.
- `home.ts` and `lists.ts` both call `listDirectory` and inherit the gate — keep that one choke point.

### Sequencing

**The editor button is not needed for 0.2.2.** Migration + the one-line filter swap + the approval
script gets Richard and Dishant listed, using the web settings page that already exists. An editor
"list me" control (a client method on `communityapi.ts`, a `POST /api/v1/me/listing` through
`serveCommunityWrite` with the existing `editProfile` capability, and a button in `Community.tsx`'s
People pane) follows after.

---

## §2 Replays — a publisher, and nothing else

✅ **The model is already YouTube-aware.** `replays` carries `provider` / `provider_id` /
`duration_seconds`, plus `replay_topics`, `replay_speakers` and `replay_chapters`; `src/lib/replays.ts`
exports `splitVideoUrl`, which parses a YouTube URL into provider and id. The player, poster and badge
all read those columns.

The only writer is `scripts/seed.mjs`. `UNI-021` says so deliberately: *"No upload or admin UI.
Replays are seeded and inserted by hand."*

- **AC8** — a `scripts/publish-replay.ts` taking `slug title heldOn videoUrl [description]`, using
  `splitVideoUrl` and the same insert `seed.mjs` performs, **without** touching any other table.
- **AC9** — Richard's two YouTube links are live and playable, driven in a browser, not asserted.

## §3 Tutorials — the same shape

`articles` exists with working endpoints; the only writer is the hardcoded array in `seed.mjs`.
`scripts/publish-tutorial-bundle.ts` **does not create a tutorial** — it attaches a bundle to an
existing slug and throws otherwise. `UNI-020` scoped this out on purpose: *"No authoring UI. Articles
are seeded and inserted by hand."*

- **AC10** — a `scripts/publish-tutorial.ts` peer to `publish-project-template.ts`, creating one
  `articles` row from arguments, with `--publish` opt-in and category validated before any write.
- **AC11** — one real tutorial published, and the editor's Community → Tutorials tab shows it.

⚠️ **Tutorial *content* is FB-012's**, phase 75, blocked on Richard's brief. This row owns only the
mechanism that lets content exist at all.

---

## §4 Chat is NOT in this row

Richard reported *"I still can't add Chat"* in the same breath. That is **FB-013**, phase 75, whose
board row already reads *"The launcher composer is unbuilt; free tags are unruled."* Posting is fully
built on the web; the editor client has `chat()` and `chatThread()` and no write method. ⚠️ Channels
are a **closed set of four** (`lounge, templates, tutorials, collab`), so "adding a chat" is a code
change either way. Left with its owner deliberately.

---

# §5 Findings — the build, 2026-09-04

> All code is in `/Users/richardosborne/vscode_projects/nodegx-community` (branch `main`, clean
> before this session — nothing uncommitted, no peer holding work). **Nothing was run**: no
> migration, no suite, no `tsc`, no build, no database write. The only thing executed was
> `esbuild --outfile=/dev/null` on the fourteen touched TS/TSX files as a **syntax parse**
> (~2ms each, no project build) — all fourteen parse. `node --check` on `seed.mjs` passes.
> ⚠️ **That is a parse, NOT a typecheck and NOT a test run.** Nothing below is measured.

## The ruling, recorded

**D8 is reversed for one surface, and the reversal is written down three times.**

* `0025_rel015_listing_approval.sql` header quotes D8 verbatim — *"approval-first is a queue only
  one person can clear…"* — states what is reversed (the people directory), what is **not**
  (every reactive path: `profile_reports`, `content_reports`, `hidden_at`), and why the cut falls
  there: **D8's argument is about speech**, and a directory row is not perishable. `0021`'s
  *"a template is not speech"* is the same cut, one surface along.
* `src/lib/moderation.ts` header — **amended, D8's argument kept**, on judgement 3's D39
  precedent. Records that D8's failure mode is still live and names the three mitigations.
* `src/lib/coaching.ts` header — amended, because it claimed *"one function… with three callers"*
  gates a listing. There are now two gates.

### 🔴 `0003_uni003_profiles.sql` was **NOT** amended, and this is a deviation you should rule on

The row asked for both comments amended. I amended one. **Editing `0003` would break the
deploy**, and the mechanism is the one `migrate.ts` was written to provide:

> `migrateToLatest` stores a **sha256 of each migration's bytes**. `ops/deploy.sh:353` runs
> `scripts/migrate.ts`, which calls it. A comment-only edit changes the checksum, and the next
> deploy stops with `[migration-changed] 0003_uni003_profiles.sql has already been applied…`.

Fixing that means a hand-written `UPDATE schema_migrations` against **production**, for a comment.
I did not do it and could not (no DB writes). Two mitigating facts:

1. The sentence in `0003` sits above `create type profile_report_state` and is **about reports**,
   which are still reactive — so it is narrowly still true of what it annotates. What is now false
   is only its sweeping *"never approval-first"* read as the platform's posture.
2. `src/db/schema.ts`'s `profiles` mirror and `0025` both point at the reversal, and `0025` is an
   `alter table profiles` that anyone tracing these columns must read.

**If you want it amended anyway**: edit the comment, then run
`update schema_migrations set checksum = '<new sha256>' where name = '0003_uni003_profiles.sql'`
on nexus-1 **before** the next deploy. Your call — I would not.

## Files changed

**`nodegx-community`** (17 files — 12 modified, 5 new). Nothing touched outside this repo except
this row file.

| New | Why |
|---|---|
| `src/db/sql/0025_rel015_listing_approval.sql` | AC1/AC4 — the column, the three constraints, the queue index |
| `scripts/approve-listing.ts` | AC5/AC6 — `list` / `show` / `approve` / `decline` / `revoke` |
| `scripts/publish-replay.ts` | AC8 |
| `scripts/publish-tutorial.ts` | AC10 |
| `tests/rel015-listing-approval.test.ts` | grades AC1–AC6 + two leak flags. **Never run.** |

| Modified | Why |
|---|---|
| `src/db/migrate.ts` | registers `0025` (else `db-schema-drift` goes red on the directory listing) |
| `src/db/schema.ts` | **AC7** — five columns added by hand to the `profiles` mirror |
| `src/lib/profiles.ts` | `ListingStatus`; 5 writers + `pendingListings`; **AC2** filter; `OwnProfile.listing`; 3 refusal tags |
| `src/lib/coaching.ts` | leak flag 1 — `OFFER_LISTABLE` gated; header amended |
| `src/lib/moderation.ts` | the D8 amendment |
| `src/app/api/v1/me/profile/route.ts` | `listing: 'requested' \| 'withdrawn'` |
| `src/app/settings/page.tsx` + `src/components/AccountForm.tsx` | the self-listing checkbox and the moderator's answer |
| `scripts/seed.mjs` | **edited, never run** — seeds `approved`, or a seeded site renders an empty `/people` |
| `tests/helpers/db.ts` | `makeListedBuilder` **and** `makeUnlistedBuilder` now approve |
| `tests/uni003-profiles.test.ts` | `makeProfiled` approves, holding the new variable constant |
| `tests/uni005-data-inventory.test.ts` | the census — see the sweep below |

### 🔴 The fixture change is the load-bearing one

`listDirectory` gained a predicate whose column defaults to `unlisted`, so **every spec with a
positive directory arm would have gone red**. `makeListedBuilder` is the single fixture eleven
test files build listable people with, so approving *there* is one edit instead of forty.

`makeUnlistedBuilder` is approved **too**, and that is the careful half: it is the *negative* arm
of *"the bar keeps somebody out"*. Left unapproved it would be absent for **two** reasons, and
those specs would then pass against a build with `profile_meets_bar()` deleted — a hole shaped
like the defect. Approving it leaves the bar as the only variable.

## Per-AC

| AC | State | Note |
|---|---|---|
| AC1 vocabulary | **BUILT** | `unlisted`/`pending`/`approved`/`declined`, `text`+CHECK per `0021`; **not** a `listed` boolean (`0003` refuses one, and `uni003`'s `/listed/` column scan still passes — checked by hand) |
| AC2 `listDirectory` | **BUILT** | `and p.listing_status = 'approved'` **added**, nothing removed. All four conditions AND-ed |
| AC3 `profile_meets_bar` | **BUILT (as an absence)** | Function untouched. Spec reads `pg_get_functiondef` and asserts the body does **not** contain `listing_status` |
| AC4 default `unlisted` | **BUILT** | Spec reads `column_default` from `information_schema` (not from an inserted row — that would pass against a default of `approved`) |
| AC5 approval script | **BUILT** | `scripts/approve-listing.ts`, five verbs |
| AC6 revocable | **BUILT** | `revoke` → `declined` **with a note**, not back to `unlisted` — see below |
| AC7 `schema.ts` by hand | **BUILT** | 5 columns mirrored |
| AC8 `publish-replay.ts` | **BUILT** | uses `splitVideoUrl`; touches `replays` only |
| AC9 two replays live | **BLOCKED ON RICHARD** | needs your two YouTube URLs |
| AC10 `publish-tutorial.ts` | **BUILT** | category+level validated **before** the transaction |
| AC11 one tutorial live | **BLOCKED ON RICHARD** | needs real prose |

**Everything above is BUILT, not MEASURED.** No suite ran.

### AC6 — why `revoke` goes to `declined` and not `unlisted`

`0025`'s review-timestamp check keeps `unlisted` on the **null** side. Revoking that way would
**delete** the timestamp and the reason — the two facts the person is owed. `declined` keeps both,
and `requestListing` still lets them fix it and ask again. `decline` refuses a non-`pending` row
and `revoke` refuses a non-`approved` one, so a reviewer clearing the queue cannot un-list a live
person with a mistyped handle.

## The four leak flags

| Flag | Disposition |
|---|---|
| **`coaching.ts` `OFFER_LISTABLE`** | **GATED.** `and p.listing_status = 'approved'` AND-ed into the fragment. It reaches `listOffers` **and** `isOfferListed`, which is the point of FB-003 having extracted one fragment — a second copy would have gone on telling a coach their offer was live. Spec asserts both. |
| **`publicProfile` / `hasPublicProfile`** | **DELIBERATELY NOT GATED — 🔴 your ruling.** D8's own distinction: *"to list"* is appearing before people who did not ask for you; somebody opening `/u/<handle>` **was given the address**. UNI-003 AC1 already keeps the bar out of this reader. **What it costs:** a public-but-unapproved profile is reachable at a guessable URL. If you read your ruling as *"nothing is VISIBLE until I allow it"* rather than *"nothing is LISTED"*, it is one predicate in `publicProfile` **and the same one in `hasPublicProfile`** — both, or `fb010-account-page.test.ts` goes red holding them equal. Written into the query as a comment, and asserted in the spec so reversing it is a decision. |
| **`personSummary`** | **NO CHANGE — verified, not assumed.** It is a **pure mapper** whose only input is a `DirectoryEntry`; it issues no query and has no other caller path. It cannot bypass `listDirectory`; it can only publish what `listDirectory` returned. It now inherits the approval gate. |
| **`home.ts` / `lists.ts`** | **NO CHANGE — inherit the gate.** Both call `listDirectory`; the choke point is kept. `grep` over `src/` for `visibility = 'public'` finds exactly **five** sites: `publicProfile`, `hasPublicProfile`, `listDirectory`, `OFFER_LISTABLE`, and the `0003` index. Two gated, two ruled above, one is an index. There is no sixth. |

## The migration filename, and how the number was checked

**`0025_rel015_listing_approval.sql`.** `ls src/db/sql/` — highest on disk is `0024_fb013_chat.sql`.
`find . -name "0025*"` (excluding `node_modules`/`.git`) returns **nothing**. `grep '0025'` over
`src/db/migrate.ts` and `scripts/seed.mjs` returns nothing. Registered as the last entry of
`MIGRATIONS`, which `db-schema-drift.test.ts` asserts equals the sorted directory.

## Sweeps done (UNI-001's obligation — a new column owes them)

* **`db-schema-drift`** — `schema.ts` mirrored by hand (AC7); `MIGRATIONS` list updated. Table
  floor (56) unchanged — no new table.
* **`uni005-data-inventory` — 🔴 would have gone red and was fixed.** Its census is over **every
  text/jsonb/array column in the live schema**, and both `listing_status` and `listing_review_note`
  are `text`. Classified: `listing_status` → `minor-refused` (`profile_not_for_org_minor`, the
  whole row is refused) and added to the existing profiles probe's `covers`, on the file's own
  convention that a second probe of the same insert is a duplicate dressed as coverage;
  `listing_review_note` → `platform-content` (a moderator's words, read by their subject), which
  needs no probe. ⚠️ Its non-vacuity floor (`>= 108`) is **stale** — unraised since UNI-020 while
  `0021`–`0024` added text columns. Left alone rather than guessed at. Not mine; worth a row.
* **`uni003-profiles`'s `/point|badge|balance|score|rank|listed/` column scan** — checked by hand:
  none of the five names contains `listed`. It still passes, and the criterion it defends (no
  `listed` boolean) is honoured rather than dodged.
* **Route/API shape** — no route added; `OwnProfile` is consumed **only** by `/settings` (grepped),
  so no API contract test sees the new `listing` field. `DirectoryEntry` unchanged, so
  `nat006`'s set-difference on `personSummary` is untouched.
* **Client islands** — `uni023`'s enumeration lists client component **files**; `AccountForm.tsx`
  is already on it and no new island was added.
* **`scripts/`** — no test enumerates it.

## 🔴 The consequence you still owe a ruling on

**Approval is NECESSARY AND NOT SUFFICIENT.** `listDirectory` now ANDs `listing_status='approved'`
**with** `profile_meets_bar()`. AC2 says *"AND-ed with, never replacing"* and AC3 says the function
must not be repurposed, so that is what I built — but it means **approving you and Dishant will
still not put you on `/people`** unless you each hold a `building` or `learning` award. That is the
exact surprise this row opens with.

Approval-first arguably makes the automated bar redundant *there* — a human now looks at every row
— but that is a **second reversal** and it is yours, not a line of code's. `scripts/approve-listing.ts`
makes it impossible to miss: `list`, `show` and `approve` all print **which of the four conditions
are false**, and `approve` **re-reads the row afterwards** and says `⚠️ still NOT on /people — …`.

**If you rule that way, the change is one line:** delete `and profile_meets_bar(a.id)` from
`listDirectory`. The **function stays** for its other four callers, so AC3 holds either way. The
line is commented in place saying exactly this. One spec (`rel015`'s *"approval does not defeat the
bar"*) would then need inverting.

## Commands, in the order I would run them (you gate; one at a time)

```sh
cd /Users/richardosborne/vscode_projects/nodegx-community

# 1. Typecheck. Cheapest first, and it is where a mistake in 600 lines of new TS shows up.
npx tsc --noEmit -p tsconfig.json

# 2. The new spec alone — the migration runs here for the first time, in a throwaway db.
npx vitest run tests/rel015-listing-approval.test.ts

# 3. The suites the fixture change and the census change reach. Serially.
npx vitest run tests/db-schema-drift.test.ts tests/e2-migration-ledger.test.ts
npx vitest run tests/uni003-profiles.test.ts tests/fb010-account-page.test.ts
npx vitest run tests/uni004-coaching.test.ts tests/fb003-composers.test.ts
npx vitest run tests/uni005-data-inventory.test.ts
npx vitest run tests/uni023-facet-bar.test.tsx tests/nat006-api-contract.test.ts
npx vitest run tests/uni019-home.test.tsx tests/uni013-slice5.test.tsx

# 4. Only when 1–3 are green: the full suite.
npx vitest run
```

Then, against the real database (**`DATABASE_URL` set to nexus-1, deliberately never defaulted**):

```sh
npx tsx scripts/migrate.ts                      # applies 0025 and records it
npx tsx scripts/approve-listing.ts list         # empty until somebody ticks the box
npx tsx scripts/approve-listing.ts show richard # prints WHICH of the four conditions fail
npx tsx scripts/approve-listing.ts approve richard --as richard
```

⚠️ **Count production before migrating.** `0025` sets **every existing row** to `unlisted`, so
whoever is on `/people` today comes off until approved. That is AC4 working, and it is a visible
one-time cost:
`select listing_status, count(*) from profiles group by 1;` after, and
`select count(*) from profiles where visibility='public' and hidden_at is null;` before.

## What you must supply — AC9 and AC11

* **AC9** — your **two YouTube URLs**, plus for each a **slug**, a **title**, the **date the call
  was held** (`YYYY-MM-DD`) and one line of **description**. Duration is optional (`--duration
  <seconds>`) and only draws the badge. Then, per replay:
  `npx tsx scripts/publish-replay.ts <slug> "<title>" <YYYY-MM-DD> <url> "<description>" --publish`
  ⚠️ It writes `replays` **only** (AC8). Topics, speakers and chapters are three more tables and a
  second script; the page draws cleanly without them. **I invented no content.**
* **AC11** — a **real tutorial**: prose in a file (the script **refuses** a body under 200
  characters, because UNI-020 shipped three rows whose body was the string `Placeholder body.`),
  a slug, a title, a summary, and a **category from the closed four**: `data-lists`, `logic`,
  `styling`, `backend`. Optional but wanted: `--level`, `--minutes`, `--outcome` ×3, `--node` ×n
  (the chip is the dimension the tutorials page filters on — the script warns when there are none).
  ⚠️ Tutorial **content** is FB-012's, phase 75. This row built only the mechanism.

Both then need a **drive in a browser**, not an assertion — AC9 and AC11 both say *"driven"*.

---

# §6 — The editor half, and the two rulings that reshaped the platform half

**Session 33, 2026-09-04.** §1's "Sequencing" paragraph said *"the editor button is not needed for
0.2.2"*. **Richard objected to that judgement by name** — *"I still can't add people… I feel like
there's a lot of stuff not done from my original list"* — so it was built. Two of his rulings the
same day (recorded as D3 and D4 in
[`RICHARD-RULINGS-2026-09-04.md`](RICHARD-RULINGS-2026-09-04.md) §8) changed what the platform half
does, and both landed before the button was written.

## 🔴 §6.1 The sequencing plan was WRONG about the route, and the correction is the finding

§1 said the editor half was *"a client method on `communityapi.ts`, a `POST /api/v1/me/listing`
through `serveCommunityWrite` with the existing `editProfile` capability, and a button"*.

**`POST /api/v1/me/listing` was never built, and building it would have been a defect.**
`POST /api/v1/me/profile` **already carries `listing: 'requested' | 'withdrawn'`** through
`serveCommunityWrite` with exactly that capability — REL-015 itself added it, for the web's
checkbox. A second write route would have put two doors on one state: the arrangement
`communityapi.ts`'s own `write()` header calls *"one edit away from disagreeing with itself"*.

✅ **What was actually missing was the READ.** No route let a client ask *"am I listed?"*, and that
is the first thing a button has to know. So the change is a `GET` on the route that already owns
the write — one new export in an existing file, no new path.

## §6.2 What is built

| where | what |
|---|---|
| `src/app/api/v1/me/profile/route.ts` | 🆕 **`GET`** — handle, displayName, bio, visibility, `listing.{status,note}`, profilePath. `item: null` = never created |
| `src/lib/profiles.ts` | **D3**: `and profile_meets_bar(a.id)` removed from `listDirectory`. **D4**: `listing_status = 'approved'` added to `publicProfile` **and** `hasPublicProfile` |
| `src/components/AccountForm.tsx` | copy rewritten in all four listing states — the *"your page is already live"* sentence D4 falsified is gone, and an `unlisted`-while-public state gained a line it never had |
| `communityapi.ts` | `myListing()`, `requestListing(bio)`, `withdrawListing()`, `MyListing` / `MyListingResponse` / `ListingReceipt` |
| `peopleview.ts` | `composeListing()` — pure, and the directory's `emptyLine` no longer describes D8's removed bar |
| `CommunityListingCard.tsx` | 🆕 the card. Five states, no hooks, text-only |
| `useCommunityPeople.ts` | the listing read, the bio derivation, the two writes, the re-read |
| `Community.tsx` | `LauncherCommunityListingPane`, rendered **above the search box** |

⚠️ **`requestListing` sends `visibility: 'public'` and `withdrawListing` sends no visibility at
all**, and the asymmetry is deliberate: `listDirectory` ANDs `visibility = 'public'`, so an ask from
a private profile could never be granted — but withdrawing a listing is not a request to be made
private, and a client that helpfully privated the profile would take an action nobody asked for.

## §6.3 The readings

| gate | reading |
|---|---|
| community `tsc --noEmit -p tsconfig.json` (includes `tests/` and `scripts/` — checked) | **`EXIT=0`, 0 errors** |
| `rel015-listing-approval` (**the migration's first ever application**) | **15/15 `EXIT=0`** before the editor arms |
| the 14 suites the rulings reach, serially | **411 tests, every `EXIT=0`** |

### 🔴 §6.4 The reverted arm — the rulings are load-bearing, measured not assumed

Both predicates were put back (`profile_meets_bar` into `listDirectory`; `listing_status` out of
`publicProfile` **and** `hasPublicProfile`) and the specs re-run:

| suite | with the rulings | reverted |
|---|---|---|
| `rel015-listing-approval` | 15 passed | **2 failed** |
| `uni003-profiles` | 56 passed | **1 failed** |
| `fb010-account-page` | 24 passed | **3 failed** |
| `nat006-api-contract` | 17 passed | 17 passed — **and that is correct**: its `too-new` fixture is now *unapproved*, so it is absent under both rules. It grades *"the API serves no unlisted row"*, not the ruling |

✅ Restored **byte-identical** (`md5 c217e504…` both sides) and re-run green: **95/95 `EXIT=0`**.

### ⚠️ §6.5 The blast radius the rulings had on OTHER phases' specs — four inverted, not deleted

Every one keeps the sentence it used to assert, so the reversal is readable where a reader would
look for it rather than only in this file:

* **`uni003`** — *"a public profile below the bar has a page but is absent from the directory"* was
  UNI-003's own D8 criterion. Inverted, with a `profileBar().meets === false` read **first** (the
  subject really is below the bar) and an un-approve in the same reading as the known-firing
  negative — without it, a `toContain` passing because `listDirectory` lost *every* predicate looks
  identical to one passing because it lost exactly the bar.
* **`fb010`** — three arms. The four-state agreement drive over `publicProfile`/`hasPublicProfile`
  🔴 **would have gone green while measuring nothing**: with approval gating both and no approved
  state in the loop, the two agree perfectly at `false` everywhere. A `listed` state was added.
* **`nat006`** — the `too-new` fixture was repointed from *below the bar* to *awaiting approval*,
  because `makeUnlistedBuilder` approves and would have started reaching the API silently.
* **`rel015`** — the *"deliberate non-gate"* test **shipped saying, in as many words, that it was
  the one that would go red if he ruled this way.** It did, on purpose.

## §6.6 Per-AC, updated

| AC | State |
|---|---|
| AC1–AC8, AC10 | **BUILT and now MEASURED** — 15/15 on first application of `0025` |
| AC2 | 🔴 **AMENDED BY D3** — three conditions, not four. The bar is out |
| AC3 | **HOLDS, and now matters more**: `pg_get_functiondef` is the only thing pinning that the function survived the removal |
| AC9, AC11 | ⏳ **STILL BLOCKED ON RICHARD** — two YouTube URLs, one real tutorial |
| §1 "editor button follows after" | ✅ **BUILT** |

## 🔴 §6.7 What is NOT done

1. **Nothing is deployed and no migration has run against production.** `0025` sets every existing
   row to `unlisted`, so **whoever is on `/people` today comes off until approved** — count first:
   `select count(*) from profiles where visibility='public' and hidden_at is null;`
2. ⚠️ **D4 makes that migration take pages down too**, which was not true when REL-015 wrote its
   deploy note. Every currently-public profile's `/u/<handle>` 404s from the moment `0025` applies
   until somebody approves it. **Approve before anyone notices, or approve first and migrate second
   is not an option — the column does not exist yet.** This is a one-time cost and it is visible.
3. **The card has never been driven in a running editor.** It is graded by element-tree walk and by
   a round trip through the real route against a real database; neither is a person clicking it.
4. **`uni005`'s non-vacuity floor (`>= 108`) is still stale**, unraised since UNI-020. Owner `NONE`.
