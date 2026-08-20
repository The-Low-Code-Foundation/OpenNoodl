# Next session — phase 72

**Written 2026-08-20, tenth session.** **NAT-007 is closed, 8/8.** You can ask a question from the
editor, read every answer, reply, and accept the one that solved it — without opening a browser.
That is the sentence the phase is named after, and it is now true. **Every remaining Tier-3 surface
is a copy of shapes that exist.**

## Read first, in this order

1. [NAT-007 §Status](NAT-007-A-THREAD-YOU-CAN-ACTUALLY-ANSWER.md) — 🔴 **read it before NAT-009/010/011.**
   Four findings they inherit, and the first one is a defect class nothing in this repo was looking
   for.
2. `models/community/threadwrites.ts` — the shape NAT-009 and NAT-010 copy for **their** writes: a
   draft, four failure sentences, and a per-item verb with its own busy and error state.
3. [README §4](README.md) — ✅ **D5's follow-up is done.** D6, D7, D8, D10 remain, and D10 is the
   one that shapes NAT-009/010.

## What happened this session

`bb73b50c` (editor) · `eb563f4` (platform). Gates on the committed trees: `typecheck:editor` and
`typecheck:editor-tests` clean · `test:main` **286 suites / 4657 tests / 0 failures** · core-ui jest
**28 / 521 / 0** · PAIRS **260 assertions** · platform `tsc` clean, vitest **48 files / 1164 tests /
0 failures**. **84 new tests, verified red 42 of 42.**

### 🔴 A screen can be true in every word and still be a lie

Post an answer; the re-read fails. What is left is the cached copy — taken *before* the post, under
a banner saying so. Every sentence accurate. **The answer is missing and nothing says why**, which
reads as *it never sent*: the exact failure AC4 exists to prevent, one step later than AC4 looks.

✅ The fix's shape matters more than its words. `postedNote` asks **"is the answer IN the copy we
are about to draw"** — by post id, against the array — not "is the copy older than the post". That
one predicate also catches the arm a timestamp check calls fine: a re-read that **succeeds** and
comes back without it.

🔴 **NAT-009's brief response and NAT-010's booking have the same shape.** A write, a re-read that
can fail, and a list that will look unchanged. Copy the predicate, not the sentence.

### 🔴 The write routes had no UI caller on the WEB either

`POST /v1/bench/threads/:id/posts` and `.../accept` have existed since UNI-015. Nothing called
them — `src/app/bench/[threadId]/page.tsx` renders read-only, and no client anywhere composed an
answer. **The editor is now the only client that can answer or accept at all.** 19th "build the
caller" in this phase, and the first where neither client had one.

⚠️ Worth expecting again in NAT-009/010: `rfps/{id}/responses` and `coaching/{offerId}/bookings`
are **specified in `docs/API.md` §6 and not built**. NAT-007's half was free because its routes
already existed. Those two are not.

### 🔴 An accept is never offered once one exists, and that is a refusal to decide

The platform *permits* moving an accept. It neither revokes the first award nor tells the first
author they were unaccepted. Nobody ruled that, so the client does not expose it. ⚠️ Read off the
**thread**, not `post.accepted`.

### 🔴 The consent screen authorised a read and now authorises a write

D5 changed **no code**, which is why it needed work. The copy now states the scope (the browser's
reach, no more) rather than a verb list NAT-009/010 would make stale — and states the uncomfortable
half: **the editor is the only place the grant can be ended.** 30-day sessions, no account page, no
session list, no web revoke. A lost laptop holds a 30-day write credential nothing can reach.
🟡 **That is a real gap and it is nobody's task.** It probably belongs to NAT-012 (the door audit)
or a new one.

### ⚠️ Two spec signals answered by fixing code, not assertions

`session-readers.test.ts` counts token uses; three identical client constructions satisfy every
reading of that sentence except its own. And its `isGated` tripwire caught a moved anchor and said
*"this spec is blind, fix it"* — where the old **claim** had also become wrong, not just blind.
**Read that section before editing a red counting assertion anywhere.**

### 🔴 PAIRS: 75 rows, 41 pairings — and handovers quoted the rows

Duplicate rows are wanted; nothing distinguished them from accidental re-measurement.
`DISTINCT_PAIRINGS` is now stated and asserted, and **caught its own constant being wrong on the
first run**. It exposed one real hole: `border-control` on `bg-2` — the rail's ground, where
NAT-008's search box and five pills are edged and were never graded.

## Where to start

🔴 **NAT-009 (the work board) or NAT-010 (coaching).** Both read halves are two files' worth of
copying; both write halves now have a worked example in `threadwrites.ts` **and a platform route
that does not exist yet**. Build the route first — `docs/API.md` §6 specifies both — then the
client. ⚠️ D10 shapes the relay outcome NAT-009 renders; do not guess it.

Otherwise **NAT-004** (light by default on the web, S, `nodegx-community`) — still the only
unstarted Tier-1 task, and independent of everything above.

🔴 **Still do not close NAT-009 AC5, NAT-010 AC5 or NAT-013 AC4** on the strength of NAT-006. They
close when mail reaches a human — NAT-014 AC2/AC7.

## Loose ends

- ✅ **The rail was driven this session** — s9's open loose end. Composer flush at 82→402 in a 378px
  panel, zero overflowing elements. The 14px break-out NAT-008 found does not repeat.
- ⚠️ **To drive any of this you must run the platform locally.** NAT-006's endpoints still **404 in
  production**. `DATABASE_URL=postgres://nodegx:nodegx@localhost:55432/nodegx_community_s46 npx next
  dev -p 3100` in `nodegx-community` (that DB is migrated and seeded). 🔴 `COMMUNITY_URL` is a
  hard-coded constant with **no env override** — edit it and **revert it**.
- 🔴 **The editor's `userData` is `~/Library/Application Support/NodeGX`**, not `OpenNoodl Editor`.
  Writing a drive session to the wrong one does not read as signed-out — the editor keeps using
  **Richard's real production session** and the resulting 401 looks like your bug. Back the file up
  and diff it back. (It was restored byte-identical this session.)
- ⚠️ **NAT-015 still has no producer** and AC5's other half stays open. **D7 (moderation) is still
  open** and nothing renders a moderation affordance.
- ⚠️ **The ports still render twice**, on both clients. Unchanged, still one decision on the
  composer/renderer pair.
- ⚠️ **Seven phase-72 files remain modified and uncommitted from earlier sessions.** Untouched.
  Everything of mine is committed by pathspec.
- ⚠️ A peer is on TUT-003 (phase 73) in the same checkout — `lesson*`, bundles. Untouched.
- ⚠️ **Storybook still does not start** (NAT-005 AC4); the new composer has no story for that reason.
