# Phase 67 — next session prompt

Paste the block below into a fresh session.

---

Continue phase 67 (NodeGX Community), `dev-docs/tasks/phase-67-nodegx-university/`.

**Read first, in this order:** `RULINGS.md` — ⚠️ **the queue is EMPTY; D15/D16/D17 were ruled
2026-08-16** and the note at the end of D17 explains what to re-check if a *parent* ruling is ever
amended. Then §"WHERE THE PHASE ACTUALLY IS" below, then `TASKS.md`'s table, then your task file.
`PRIOR-ART-RECONCILIATION.md` if you have not read it before.

🔴 **Two repos now.** Editor work is this checkout. Platform work is
`/Users/richardosborne/vscode_projects/nodegx-community` — a **sibling directory, never nested** —
pushing to `The-Low-Code-Foundation/nodegx-community`. None of this checkout's gates, peers or traps
apply there.

---

# WHERE THE PHASE ACTUALLY IS — measured 2026-08-16, not remembered

| Track | Tasks | State |
|---|---|---|
| **Platform** | UNI-001 (AC3), 002, 003, 004, 009 (content cut) | 🟢 **ALL FOUR TIER-1 TASKS BUILT.** `2410070`, fourth commit, **pushed** |
| **Platform** | UNI-005, 006, 008 | 📋 **Three tasks, not started** — UNI-005 (orgs) is next on the platform track |
| **Platform** | UNI-001 (the rest) | 🔴 **Blocked on Richard**: OAuth callback URLs need `community.nodegx.dev`, still unregistered |
| **Editor / MCP** | UNI-007, UNI-010, UNI-012 | UNI-007 slices 1–5 + tutor overlay; UNI-010 five slices, **KEEP**; UNI-012 scoped, not built |
| **Editor + bridge** | UNI-011 | ✅ **Fully unblocked to build AND to ship** — D15 and D16 are ruled |

**The seventeenth session built UNI-004 — the work board and the coaching rail.** Eight of the
phase's twelve tasks now have a platform surface, and the community has a revenue rail attached.

## What UNI-004 added, and the shape of it

**Gates:** `245 specs / 12 files` in `nodegx-community` (baseline **164 / 9**), `tsc --noEmit`
clean, `next build` succeeds with **11 routes** (was 8). ⚠️ **`npm run lint` is STILL not a gate
there** — no ESLint config, so the script drops into an interactive setup prompt. It has never run.

**AC1's *"provably absent"* is a TRIGGER, not a renderer.** A renderer that carefully omits an
address is a promise about the renderer; a database that refuses to store a row containing one is a
proof about the row. The guard searches **`to_jsonb(new)` — the whole row** — rather than the fields
anyone remembered, so a column added to `outbound_emails` next year is covered on the day it is
added. 🔴 **And it catches the bypass nobody designs for:** a responder who types their own address
into the message body, to get round the relay, has the response **refused and not stored** — the
response, the thread and the first email are one transaction.

**D7's *"build so payment can be absent"* is a MISSING constraint.** Nothing ties
`coaching_bookings.state` to `payment_state`, so a **£120** offer reaches `confirmed` with
`payment_state = 'not_required'` and nothing objects. 🔴 `recordPayment` has **no caller outside the
suite**, which is what AC2's *"(once D7 lands)"* honestly means today.

**AC4 is an absence with three witnesses:** `createOffer` is the only writer and takes no privileged
argument; `coaching_offers` has no `featured`/`approved`/`rank` column, asserted against
`information_schema`; and an account handled `richard` is shown ordered **behind** `ada-builds` by
the same rule as everybody else.

**D8's bar was written three times and is now written once.** UNI-003 had it in `profileBar()` and
inline in `listDirectory()`; this task needed a third reader and a fourth. It is now
`profile_has_evidence()` and `profile_meets_bar()` in `0004`, with four callers. ✅ **Proved by
UNI-003's 56 specs passing unchanged** — and by the control that makes the function always-true,
which fails **UNI-003's own** directory spec alongside two of this task's.

### 🔴 Two controls worth carrying past this task

**One measured nothing, and it looked emphatic.** The first *"make `profile_meets_bar` always
true"* run used `perl -0pi -e` with a replacement string containing **`$$`** — which perl expands to
the **process id**. It wrote a garbage dollar-quote delimiter, the migration failed to apply, and
**71 specs "failed" with 148 skipped**. Every one of those failures says *"the schema did not
build"*. The tell was in the result: whole **suites** failed rather than specs, including
`db-schema-drift` and both UNI-002 files, which have no opinion about D8's bar. Redone with the
delimiter escaped **and the patched function printed before the run**: the real answer is **3 failed
/ 242 passed**.

**One is nondeterministic on purpose.** Removing the advisory lock from `rfp_response_gate()` does
not fail every time — *that is the defect*. Measured five runs each way: **lock off → 3 of 5 race
runs slip; lock on → 5 of 5 hold.** 🔴 **When a control's mechanism is a race, one run is not a
measurement** — and the arm that passes is the one that gets believed, because *"the lock is
unnecessary"* is the cheaper conclusion.

### ✅ Driven over HTTP, against consequences written before the drive

Thirteen written first, **13/13 passed**: a moderated request **404s on its own URL** and is absent
from the list; the board publishes a response **count and never a response body**; no
`@example.invalid` appears anywhere on a public page; an offer whose owner is **below D8's bar
exists and is not listed**; `Free` sorts before `£120.00`.

⚠️ **Method carried from UNI-003 and it mattered again:** React interleaves `<!-- -->` between text
nodes, so the drive strips HTML comments before grepping. 🆕 **A second instrument caveat found this
time:** `grep -c` counts matching **lines**, and a rendered page is one line — so every count is 0
or 1 whatever the page contains. Presence/absence is sound; **never read a `grep -c` on HTML as an
occurrence count.**

---

# What to do next — pick a lane and say which

**LANE A — UNI-005, the org workspace. Recommended.** It is the last Tier-1-adjacent platform task
with nothing in front of it, and D6 already rules the shape: **GitHub org for companies, invite list
/ email domain for schools, ONE roster** — `org_members.source` is a column and 🔴 **roles,
assignment and grading must never branch on it**. D10 rules the handles pseudonymous. `orgs` and
`org_members` already exist from UNI-001's spine, and `minor_community_access` is already the D15
switch — so this task is mostly the shelf, the invite flow and the admin surface. ⚠️ **Phase 51 /
COL-004 (advisory component claiming) is the prior art it builds on**, per the reconciliation's F2.

**LANE B — make the login real.** Finish UNI-001: OAuth, sessions, the consent screen, the editor
half. 🔴 **Blocked on Richard, not on work** — callback URLs need `community.nodegx.dev` and the
domain **is not registered**. ⚠️ It is now blocking **four** things: the admin routes UNI-002,
UNI-003 and UNI-004 all deliberately did not build, and UNI-003's owner-facing account page. 🔴 **And
the cost has changed shape since the last handover:** UNI-004 built two marketplaces whose every
*write* path is specced and reachable only from a test. The board can be read by anyone and posted
to by nobody.

**LANE C — UNI-011, the editor mirror.** D15 and D16 are ruled, so it can be built *and* shipped.
🔴 The renderer is `nodeIntegration: true` **and so is the launcher** (same `BrowserWindow`): **no
post body may render as HTML in it.** ⚠️ **UNI-004 just widened the stranger-authored corpus again**
— RFP titles and descriptions, response bodies, coaching offer descriptions — on top of UNI-003's
bios and links. Prove the boundary with a known-**BAD** corpus, not a clean one. D15 says the
visibility rule lives **behind the API** — do not reimplement it in the editor client.

**LANE D — the editor remainder.** UNI-012 with a packaged build budgeted; TUTOR-BOUNDARY §5's six
adversarial attacks (needs a live provider, and §6's AIX-004 tuning is the same sitting); the D5
recents measurement, still spoiled.

**My recommendation: A.** UNI-005 unblocks UNI-006, which unblocks phase 68 — and it is the only
remaining platform task that does not need the domain.

## ⚠️ For Richard — the first is unchanged and now blocks four things

1. 🔴 **`community.nodegx.dev` is still not registered.** It blocks UNI-001's OAuth callback URLs.
   **This is the one thing a session cannot do for itself.** Four built-but-unroutable things now
   sit behind it (see Lane B), including a work board and a coaching rail that nobody can post to.
2. 🔴 **A Paddle account (D7) is now the thing standing between coaching and revenue.** UNI-004
   built the booking machine so payment can be absent, and it is absent: a receipt has a shape and a
   constraint, and `recordPayment` has no caller. ⚠️ **Not urgent in the way item 1 is** — a booking
   that ends in an email is the ruled v0 and it works — but it is the next commercial step.
3. **The twelve badge artworks still need drawing.** D4 ruled ~12 flat SVGs in the editor's icon
   idiom. The profile renders the family mark and the tier colour instead, so nothing is broken —
   but it is deliberately *not* a placeholder pretending to be a badge.
4. ⚠️ **GitHub Pages is still unattached** (`has_pages: false` as of 2026-08-16), so D17's v0 remains
   free to set up. It stops being free after the first deploy.
5. ⚠️ **The F4 packaged-install scope call** (UNI-012) is still yours and still open.
6. 🆕 **A judgement call in UNI-004 you may want to take back:** **responding to an RFP requires
   clearing D8's bar** — a public profile with a name, a blurb, and one published prefab or finished
   lesson. The ruling's words are *"to list"* and the task's premise says *"listed devs respond"*, so
   this is a defensible reading and it doubles as the spam shield. But the other reading — the bar
   gates only the directory, and anyone may respond — is coherent too, and it is a **product** call.
   It is one line in `rfp_response_gate()`.
7. 🆕 **Carried from the sixteenth session and still open:** UNI-003 changed UNI-002's challenge
   catalogue so *"saving your first project"* keeps its 20 points and awards no badge. If you want
   first-save to carry a badge, it needs a family D4 does not currently give it.

## Gates (2026-08-16, seventeenth session)

- **`nodegx-community`: 245 specs / 12 files, all pass. `tsc --noEmit` clean. `next build` succeeds**
  (11 routes). Run with `npm run db:up && npm test` from the sibling checkout.
- **The three new routes were driven with `curl` against a seeded database**, not only specced.
  `npm run db:seed` now also seeds four RFPs chosen so every branch is reachable by looking — open
  with a response, open with none, closed, and **hidden by moderation** — and three coaching offers,
  two listed and **one whose owner is below D8's bar**.
- **This checkout: nothing touched but `dev-docs/`.** No editor gate was run and none was needed —
  ⚠️ so do **not** quote a `test:ci` or `test:main` figure from this handover. There isn't one.
  ⚠️ A peer (s38/P66) reported `test:ci` **2843 / 6 @ seed 39393** on **their** tree during the
  fifteenth session. Relayed, not measured here — re-measure before quoting it as a floor.

## Standing constraints

- Editor work on `cline-dev`. 🔴 **Never `git stash`**; `cd` to the repo root in every git call.
  ✅ **`git commit <pathspecs>`, never stage.** ⚠️ Untracked files are the one case needing
  `git add` — put add and commit in **one chain** with the message **already in a file**.
- 🔴 **`cd` does not persist between tool calls here, and a `cd` inside one does not leak out.** Put
  the `cd` in the same command as the run.
- 🔴 **Port 55432 for the platform's Postgres, never 5432** — this machine already runs one on 5432,
  and both `db:seed` and the test suite **drop and rebuild `public`**.
- 🔴 **This checkout is SHARED.** Peer messages are for **blocking or hazardous** things only.
  Findings go in the task file.

## Things the next person will otherwise re-derive

- 🔴 **Never generate DDL from `src/db/schema.ts`.** It is a query mirror; the rulings live in
  `src/db/sql/`. It cannot express CHECK constraints, triggers, or the string type postgres.js
  actually returns for a `bigserial`.
- 🔴 **The drift spec checks tables and columns ONLY — including NOT enum names.** UNI-004 renamed
  `profile_report_state` → `report_state` and the drift test had no opinion about it; `tsc` and
  UNI-003's suite are what would have caught a half-done rename. Its non-vacuity floor is now **22**.
- 🔴 **`MIGRATIONS` is asserted equal to the sorted contents of `src/db/sql/`** — three descriptions
  of one list, and the test is what keeps them agreeing.
- 🔴 **postgres.js has no nested `begin`.** A function that opens its own transaction cannot be
  composed into a larger one, which is why `relayMessage` (top level) and `relayMessageIn` (inside
  an existing transaction) are two exported functions rather than one clever one.
- 🔴 **`gen_random_bytes` needs the pgcrypto extension; `gen_random_uuid` does not.** The relay
  aliases are derived from a uuid for exactly that reason — a generator that needs an extension
  installed works here and fails on a database somebody else provisioned.
- ⚠️ **An invisible-character class must be written as escapes.** UNI-003's display-name rule refuses
  bidi overrides and zero-width characters; written literally it would be unauditable by exactly the
  property that makes it necessary.
- 🔴 **`ports`, not `dynamicports`, is how a `Component Inputs` node declares its interface.**
- 🔴 **`forEachNode` STOPS on a truthy return.** Use a block body.
- 🔴 **`/usr/bin/grep -a`, always.** Plain `grep` here is ugrep and silently skips `.ts` as binary.
- 🔴 **The `lesson` MCP group is DEFERRED** — `find_tools({group:"lesson"})` first.
- `suggestedNodes` is still **dead** — no callers.
