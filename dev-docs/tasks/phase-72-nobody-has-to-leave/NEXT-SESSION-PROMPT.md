# Next session — phase 72

**Written 2026-08-20, eleventh session.** **NAT-009's platform half is done and the editor's half is
the client and every sentence on it.** What is missing is a screen: `rfpboardview.ts` returns the
exact types `CommunityDirectoryView` and `CommunityThreadView` already place, and nothing places
them yet. **Nothing has been driven.**

## Read first, in this order

1. [NAT-009 §Status](NAT-009-WORK-YOU-CAN-TAKE-FROM-THE-EDITOR.md) — 🔴 **read the first two
   findings before writing any spec anywhere.** A guard whose test passes with the guard deleted,
   and why the route could not have caught it.
2. `models/community/rfpboardview.ts` — the shape a view places, and the three sentences that are
   deliberately not there.
3. [README §4](README.md) — **D6, D7, D8, D10 remain.** D10 got sharper this session and D7 now owns
   a line of SQL.

## What happened this session

`6b2360b` (platform) · `638c82cc` (editor). Gates on the committed trees: platform `tsc` clean and
vitest **51 files / 1225 tests / 0 failures** · `typecheck:editor` and `typecheck:editor-tests`
clean · `test:main` **290 suites / 4746 tests / 0 failures**. **92 new tests; 18 mutations run, 16
went red** — and the two that did not are the session's main finding.

### 🔴 The capability model expressing D15 had never gated anything

`WRITE_CAPABILITIES` has existed since D15 was ruled. **No route had ever checked one** — every
reference in the repository is a test asserting `communityVisibility`'s output, or `/v1/me`
publishing the list. And it was not cosmetic: `communityGate` refuses `surface: 'absent'`, which
for an org-minor means `access: 'off'` **only**, so a **read-only** minor passed the gate and
reached `serve` with a **201**. The board was safe because `board_actor_is_eligible` refuses them
under the insert — a *board* guard. A community write whose domain module had no equivalent would
have had nothing above it. `serveCommunityWrite` now takes the capability the write needs.

🔴 **NAT-010's booking write inherits this and there is no capability named for it.**
`WRITE_CAPABILITIES` is `postThread`, `postReply`, `react`, `directMessage`, `contactViaRfp`,
`editProfile`. Booking a coaching session is none of those. **Do not reuse `directMessage` because
it is nearest** — that is the guessed-vocabulary failure NAT-008 recorded four times. Either add
one to `community-visibility.ts` (and `d15-visibility.test.ts` quantifies over the list, so it is
governed the day it is added) or rule that it is out of scope, in the task file.

### 🔴 And the route's own spec could not have found it

The route test says an org-minor gets a bare 404. **It passes with `communityGate` deleted** — the
database refuses the same population and the translator maps it to the same bytes. *"The route
applies D15"* is a claim about the route that the route's test cannot make. ✅ So
`nat009-write-wrapper.test.ts` drives the wrapper with the domain removed.

⚠️ **One assertion in that file was wrong and is kept as a record.** It claimed the gate runs before
the 401. The order is **unobservable**: a token that does not resolve produces no viewer, and an
anonymous viewer is `surface: 'present'`, so the two branches are disjoint. What does bind is the
**capability check's** position — after the 401, or every signed-out caller reads "not found".

### 🔴 §6 specified one refusal; the migration raises eighteen

`board-http.ts` maps them, swept off the migration **per function** with a known-firing control
(the translator has a catch-all default, so a totality check over it passes with an empty table).
⚠️ Thirteen relay guards answer **500** rather than the 400 default: this write runs a five-table
transaction through a subsystem the caller never names, so a 4xx blames the caller for our outage.

### 🔴 `acceptConnection` has no caller, so a response's state can never move

The double-blind relay's connect step is unreachable from any page, route or client. `connectedAt`
is null on every response that will ever exist. ✅ The client reports what happened and offers no
next step. 🔴 **NAT-010 has the same shape**: a booking has `requested`/`confirmed`/`declined`, and
`confirmBooking`/`declineBooking` need a caller check before any UI promises a coach will answer.

### 🔴 Two holes that are nobody's task

- **The four bench write routes take no rate-limit token at all** — no middleware exists, and
  NAT-007's composer posts to two of them. `docs/API.md` §5 states the limit as a property of the
  API; it is a property of the routes that remembered. **Not fixed — it is NAT-007's ground.**
- **A lost laptop still holds a 30-day write credential nothing can reach** (s10's finding).
  Unchanged.

## Where to start

🔴 **NAT-009's view and the drive.** NAT-008's arc is the template and every type already lines up:
a core-ui view, a `useCommunityRfps` hook, the launcher tab and the rail panel. Then drive it — and
🔴 **run the platform locally**, `DATABASE_URL=postgres://nodegx:nodegx@localhost:55432/nodegx_community_s49 npx next dev -p 3100` (that DB is migrated). `COMMUNITY_URL` is a hard-coded constant with no env override — edit it and **revert it**.

Otherwise **NAT-010** (`serveCommunityWrite` and `board-http.ts` are built for it — the booking
route is `respondToRfp`'s shape one surface over) or **NAT-004** (light by default on the web, S,
still the only unstarted Tier-1 task).

🔴 **Still do not close NAT-009 AC5, NAT-010 AC5 or NAT-013 AC4** on the strength of NAT-006 or
NAT-014's drainer. The relay's `Reply-To` is on `relay.nodegx.dev`, **unregistered, with nothing
receiving mail on it**. D10.

## Loose ends

- ⚠️ **A peer was running `next dev` in `nodegx-community` this session** and dropped/recreated a
  database mid-afternoon. **Do not `next build` there without asking** — it stamps on their `.next`,
  and `uni015-bench-http.test.ts`'s kind of spec needs one. Use your own DB name.
- ⚠️ **The double blind's direction is easy to get backwards and I got it wrong twice.**
  `to_address` is the recipient's **real inbox**; `from_address` is one generic address on the relay
  domain; `reply_to` is the recipient's **own** alias. The smuggling vector is the **responder's
  own** address, not the poster's.
- ⚠️ `expect(value, message)` is **vitest's**; the editor's runner is jest. Third time.
- ⚠️ **NAT-015 still has no producer**, **D7 is still open** — and it now owns a specific line:
  `responsesBy` filters `r.hidden_at`, so a moderated-away request takes the responder's own row
  with it, silently. Recorded in `rfps.ts`.
- ⚠️ **The ports still render twice** on both clients. Unchanged.
- ⚠️ **Seven phase-72 files remain modified and uncommitted from earlier sessions.** Untouched.
  Everything of mine is committed by pathspec.
- ⚠️ **Storybook still does not start** (NAT-005 AC4).
