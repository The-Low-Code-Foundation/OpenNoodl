# Next session — phase 72

**Written 2026-08-19, sixth session.** **NAT-006's read surface is built and committed.** The
editor can now see people, profiles, RFPs, coaching, University, tutorials and replays — ten
endpoints, one shape, a written contract. What it still cannot do is *write*, and that waits on a
ruling rather than on code.

## Read first, in this order

1. [NAT-006](NAT-006-THE-API-THE-EDITOR-CANNOT-SEE.md) §Status — the AC table, and the two findings.
   **Read the AC4 one even if you never touch this API**: the tidy implementation *was* the
   criterion's failure, and the same trap is waiting in any read API written over these modules.
2. `nodegx-community/docs/API.md` — the contract. §4 (the 404 that means several things) and §6
   (the writes, and what D5 has to decide) are the two sections a Tier-3 task needs.
3. [TASKS.md](TASKS.md) §The order, then [README §4](README.md) — five rulings still open
   (D5, D6, D7, D8, D10).

## What happened this session

**NAT-006 AC1, AC2, AC3, AC4, AC6 and AC7 are closed** — `nodegx-community@126a0b6`. Ten endpoints
under `/api/v1/community/`, each reading through the function its page already calls. The one
page-side query copy left on the platform (`tutorialsList`'s article read, living in `lists.ts`)
moved to `articles.ts` and now has both callers — that is the trap the task calls its
highest-value structural decision, and it was the last instance.

Gates: `tsc --noEmit` clean, vitest **45 files / 1110 tests, 0 failures**. `npm run lint` is not a
working gate in that repo — `next lint` drops into an interactive ESLint setup prompt. Not fixed,
recorded.

### 🔴 The finding worth carrying: the tidy implementation was the AC4 failure

AC4 says the API must not be wider than a signed-out browser. The obvious implementation — return
the shared read modules' own types — **is** wider: `DirectoryEntry`, `PublicProfile`, `RfpListing`
and `CoachingOffer` all carry an internal **account UUID** that no page renders. A React Server
Component emits HTML, so a field it fetches and never prints leaves no trace; the same field in
JSON is published to every client, and it looks like the clean implementation the whole way.

✅ **Ask of any read API: which fields does the page fetch and not print?** That set is the leak.
Every surface is mapped in `apisurfaces.ts` now, each mapper states what it drops, and the spec
asserts over *every* endpoint that no body contains a seeded account id — with a control that
feeds it a leaky body and requires it to fire.

### 🔴 The second finding: a column typed `Date` is sometimes a raw string

`b.earnedAt.toISOString()` died on `2026-08-19 18:58:53.754123+00` — Postgres's own text,
unparsed, from a field declared `Date`.

🔴 **The connection decides, not the query.** Reproduced deterministically: read badges through the
API pool (a `Date`), call `/v1/community/home` — enough concurrent queries to make the pool open
more connections — then read the same badges through a route (a string). ⚠️ **I did not pin the
mechanism down and the note says so**; postgres.js resolves parsers per connection, and that is a
hypothesis, not a measurement.

⚠️ **`lists.ts` had already met this and defended locally without recording it** — every date
comparator there wraps in `new Date(...)`, and one helper is typed `Date | string`. A defence with
no note is a finding the next person has to make again. One site was still exposed: `/people`'s
*"recently active"* sort called `.getTime()` on the raw value, a 500 one pooled connection away.
Fixed. 🔴 **`src/app/orgs/[slug]/assignments/page.tsx:32` is the same hazard, untouched** — 67b
ground, named in the task file rather than repaired from outside.

### ✅ Verified red, and it was worth the four minutes

The envelope check, the account-id check and the rate limiter were each handed their defect back:
**5 of 14 failed**, each by name. Same lesson as session 5's caller census — a green contract spec
on an unbroken tree says nothing about whether it can see a break.

## Where to start

**NAT-007 is now the flagship and the read half is unblocked.** Threads already had an endpoint;
what NAT-007 needs beyond it is the reply, which is AC5/D5 — so the honest shape of that session is
*build the whole reading experience, and land the reply behind the ruling*. NAT-015 rides along in
the same session on the same renderer.

**If you would rather close NAT-006 completely, it is one decision:**

- 🔴 **D5 — what authorises a write from the editor?** `docs/API.md` §6 specifies the three writes
  Tier 3 needs (a Bench reply, an RFP response, a coaching request) and the four things that hold
  whatever D5 decides. The ruling wants Richard; the code after it is small.

**NAT-004** (light by default on the web, S) and **NAT-005** (the tab that is a list of grey lines,
M) are still the unstarted Tier 1 work, and NAT-005 is the vocabulary Tier 3 reuses — building it
before four surfaces reinvent it is still the right order.

🔴 **Do not close NAT-009 AC5, NAT-010 AC5 or NAT-013 AC4 on the strength of NAT-006 either.** They
close when mail reaches a human, which is NAT-014 AC2/AC7 and still needs a deploy.

## Loose ends

- ⚠️ **Nine phase-72 files remain modified and uncommitted** — NAT-006 now among them, because it
  already carried somebody else's unlanded edits when I arrived and a pathspec commit would sweep
  them. My status section is appended to that file in the working tree. Everything of mine that
  stands alone (TASKS.md, this file) is committed.
- ✅ **The shared 55432 Postgres does not need queueing.** The 67b session pointed out the better
  move and it works: `create database nodegx_community_e7` beside the default, then
  `DATABASE_URL=…/<your-db> npx vitest run`. `freshDb()`'s `drop schema public cascade` is then
  scoped to a database only you use. I queued twice today for nothing.
- ⚠️ **`AskAboutNodeDialog.module.scss`, the ~99 fill-role files, and the active-line contrast
  finding** are all unchanged from the last three handovers.

## Verification notes that earned their place

- 🔴 **A route sweep derived from disk fails on a *sibling's* new routes, not only yours.** Mine and
  67b's landed hours apart and each made the other's run red with "these routes have no D15
  verdict". That is the gate working. ✅ Read the names in the failure before believing it is yours.
- ✅ **Two sessions edited one test file cleanly** because both appended to an object literal and
  neither rewrote the file. The peer committed a synthesized blob containing only their own
  recipes, so my working copy kept both. **A wholesale write there would have destroyed one set.**
- 🔴 **A spec can be green because the fixture is broken.** Every dynamic endpoint in the contract
  spec asserts *"this file has a seeded id for you"* before calling — a made-up id 404s for
  everybody, which satisfies half of a gate assertion and fails the other, and reads as a broken
  gate rather than a broken fixture.
