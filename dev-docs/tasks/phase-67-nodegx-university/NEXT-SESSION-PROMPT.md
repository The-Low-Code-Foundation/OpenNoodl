# Phase 67 — next session prompt

Paste the block below into a fresh session.

---

Continue phase 67 (NodeGX Community), `dev-docs/tasks/phase-67-nodegx-university/`.

**Read first, in this order:** **[README.md](README.md) §"What closes this phase"** — the alpha
bar, and it decides which task you pick — then **[D19](RULINGS.md)**, then §"WHERE THE PHASE IS"
below, then `TASKS.md`'s table, then your task file.

🔴 **Two repos.** Editor work is this checkout. Platform work is
`/Users/richardosborne/vscode_projects/nodegx-community` — a **sibling directory, never nested** —
pushing to `The-Low-Code-Foundation/nodegx-community`. None of this checkout's gates, peers or
traps apply there.

---

# 🎯 THE PHASE NOW HAS AN EXIT CRITERION. IT IS THE ALPHA, AND IT IS NINE ITEMS.

**Set 2026-08-18 (session 28), in [README.md](README.md) §"What closes this phase".** The phase ran
five days without one, which is why *"are we nearly done"* had no answer.

> **Phase 67 closes when a stranger can reach `community.nodegx.io`, make an account, ask a
> question about a node from inside the editor, and get an answer — and when that site does not
> look like a placeholder.**

🔴 **Read that section before choosing a task.** It names four code items (E1–E4), three of
Richard's (E5–E7), two hygiene (E8–E9), and — as importantly — **what is explicitly NOT in the
close**, so UNI-017 and UNI-018 stop reading as unfinished business.

## 🟢 THE ORDER, AND IT IS NOT THE TASK NUMBERS

1. 🔴 **E1 — UNI-001's issuer.** Everything the last three sessions built is **unreachable
   without it**: the only `insert into sessions` in the whole platform repo are in **test files**.
   D19 struck the OIDC provider face, so this is plain session auth — issue a token, store it under
   `nodegx.community.session` (the seam is built and specced), sign in from the editor.
   ⚠️ **Do not build the OIDC provider speculatively.**
2. 🔴 **E4 — UNI-013 slice 5, the page archetypes.** Newly scoped from a driven review, below.
3. **E3 — UNI-009 AC1**, which is small: the home does not link the Bench.
4. **E2 — deployment**, once Richard answers E5.

⚠️ **UNI-017 and UNI-018 are NOT next**, despite being the obvious next task numbers. They are
outside the close.

---

# 🎨 SLICE 5 — THE LOOK. DRIVEN 2026-08-18, AND RICHARD IS RIGHT FOR THE SECOND TIME

**Richard, 08-18:** *"we updated the 'people' detail page but the rest of the app still looks sad,
dark and simple."* He said a version of this on 08-17 too, and slices 1–3 answered the 08-17
version. **The remaining problem is the scope, not the execution.**

**Reviewed properly**: `next start` on a fresh build, DB seeded with four people, four threads and
an answer, screenshotted at 1440×1000. ⚠️ **The served CSS hash was checked against
`ls .next/static/css/` first** — this task's own trap, and an unstyled page is exactly what a "sad"
review misreads. ⚠️ **Content was seeded before looking**, because an empty page looks sad for a
reason that is not design.

**The finding: AC4 named the wrong unit.** It restyled **six components**, and the premise says
*"the other pages inherit from the tokens."* 🔴 **They inherit tokens; they do not inherit a
design.** Eight pages are the same page — `<h1>`, grey two-line sub, filter pills, one stack of
identical `bg-1` rectangles. **The profile page is the proof rather than the exception:** it looks
designed because it is the one page the pitch artifact drew a specimen of.

**Worst first:** the home has **no accent colour anywhere** and shows **none of the four threads
that exist** (which is E3 as well as a design fault) · `/people` has **no avatars** while the
profile does · the Bench renders **two different link styles on one page**, the queue's being raw
underlined browser links · the queue **repeats the list beneath it** · `/replays` is **~90% empty
viewport** under one dashed box.

🔴 **The rule it generalises to:** every surface built *after* slice 3 — the Bench, the attachment
renderers, the notification surfaces — reaches for `bg-1` and a bordered rectangle. **A design
system with no worked example of its page shapes gets read as a colour palette.**

✅ **So slice 5 is not "restyle eight pages".** It is **draw three archetypes — index, list, detail
— and make every page an instance of one.** The profile is already the detail archetype. Full
findings table in [UNI-013](UNI-013-THE-COMMUNITY-SITE-IN-NODEGX-CLOTHES.md) §"Slice 5".

⚠️ **AC1, AC3 and AC5 still bind**: no hardcoded colour, contrast rows split per theme, and the
suites must pass unchanged.

---

# 🔴 CHECK THIS HANDOVER'S PREMISES. THE ONE IT REPLACED WAS WRONG IN THREE PLACES.

Session 27's handover said UNI-016 had *"one thing left — the editor's POST"*, that *"the platform
can receive artifact posts and nothing sends them"*, and that *"the bearer token the dialog
already holds is the credential."* **All three were false**, and twenty minutes of grepping before
writing any code is what found it:

| Claimed | Measured |
|---|---|
| the platform can receive artifact posts | 🔴 `POST /api/v1/bench/threads` took `{section, title, body}`. **`attachToPost` had NO caller in `src/`** — only its own spec |
| the dialog already holds a bearer token | 🔴 No token, no store anywhere in the editor, and **`CommunityApiClient` had no caller outside its own spec** — and was GET-only |
| …so the credential exists | 🔴 **No issuer.** The only `insert into sessions` in the whole platform repo are **in TEST FILES** |

*Build the caller*, **ninth and tenth** instances in this phase — and the tenth is the one where
the missing caller **was the reason the task existed**. ✅ **The habit that worked: grep for the
callers of every function a handover says is ready, before believing the handover.** Two greps.

---

# WHERE THE PHASE IS — 2026-08-18 (session 28)

✅ **UNI-016 is built. D19's tranche is four-fifths landed** (014, 015, 016 done; 017 half
pre-built; 018 not started). 🔴 **But four-fifths of a tranche is not the phase** — read the alpha
bar above, which puts UNI-017 and UNI-018 *outside* the close.

| In the close? | Task | State |
|---|---|---|
| 🎯 **E1** | **UNI-001's issuer** | 🔴 **NOT BUILT, and it is the critical path.** Resolution is built; only *minting* is missing. **LANE A** |
| 🎯 **E4** | **UNI-013 slice 5 — the pages** | 🔴 **SCOPED session 28** from a driven review. The largest remaining piece. **LANE B** |
| 🎯 **E3** | **UNI-009 AC1** — home shows real threads | 🔴 **NOT MET** — observed: the home links neither `/bench` nor any thread. Small. **LANE C** |
| 🎯 **E2** | **deployment** | 🔴 **Owned by no task.** Blocked on Richard (E5). **LANE D** |
| ✅ done | UNI-001 (AC3), 002–006, 009 cut, 011 s1–s2b, 013 s1–s3, **014**, **015**, **016** | 🟢 pushed |
| ⛔ **out** | UNI-017 — the queue and *same here* | 🟡 Half pre-built (`unansweredQueue()` + the clock). ⚠️ **NOT the next task**, despite the number |
| ⛔ **out** | UNI-018 — pull a graph | 🔴 Not built. 🔴 **Read its §"THE HAZARD" before scoping** — arbitrary JS on the puller's machine |
| ⛔ **out** | UNI-007 intake · UNI-006 bridge · UNI-011 views · UNI-008 · UNI-010 · UNI-012 · UNI-013 s4 | See the README's *"explicitly NOT in the close"*. ⚠️ UNI-011's views are unbuilt **deliberately** — D16's ship order is the reverse of its build order |

⛔ = outside the alpha bar. **Not abandoned** — a 67b or folded into phase 68, and that is Richard's
call at the close rather than something to decide by drift.

## 🔴 THE ONE THING THAT CHANGED SHAPE: UNI-001's ISSUER IS NOW THE BOTTLENECK

UNI-016's POST path is built, specced and typed end to end — **and no human being can reach it**,
because `readCommunitySession()` returns `null` for everybody and nothing mints a session. The
browser hand-off is the only route a real user has. That is AC5 working exactly as written, and it
means **the next unit of user-visible value in this tranche is not UNI-017 or UNI-018 — it is
plain session auth on the platform plus a sign-in in the editor.** D19 struck the OIDC provider
face (there is no second system to federate with), so what is left is small: issue a token, store
it under `nodegx.community.session`, done.

✅ **That weighing is now DONE rather than left to the reader** — it is why the exit criterion puts
the issuer at E1 and UNI-017 outside the close. **Do not re-litigate it; build LANE A.**

## What session 28 did

**Platform** — `parseAttachments` (the boundary), an `attachments` field on both write routes,
`attachAll` **inside `askQuestion`/`answerThread`'s own transaction**, and three 0009 constraint
names mapped to 400s in `bench-http.ts`. Plus `resetApiSql()` — see the harness trap below.

**Editor** — `nodeartifact.ts` (the structured payload), `communitysession.ts` (the token seam),
`CommunityApiClient.askQuestion`/`.answer` with a five-outcome `Write` union, and the composer's
two routes. 🔴 **The browser hand-off is kept and now asserted**, with a negative control.

**Documents** — 🎯 **the phase's first written exit criterion** ([README.md](README.md)), and
🎨 **UNI-013 slice 5**, scoped from a driven review of the running site. Both are above.

⚠️ **What session 28 did NOT do: a drive.** The composer's button was never clicked — there is no
DOM in this checkout's jest runner, and a real drive needs a token no issuer can mint. **LANE A is
what makes that drive possible**, which is most of why it is first.

---

# 🔴 SESSION 28's FINDINGS — three, and two are about instruments that lied

### A. AC2's assertion was on a population where it could not fail

Session 27 asserted AC2 — *"a withheld port's name and value appear nowhere"* — against the
served page. **But the withheld name is never in the request**: the editor buckets it away before
sending, so **no implementation of that route could have emitted it**. True by construction, and
an absence check that cannot fail is not evidence.

✅ It now lives in `tests-unit/uni-016/nodeartifact.test.ts`, where the withheld port **is** an
input row the user left unticked, so dropping it is work the code does. The platform's copy is
**kept and relabelled as the weak form** — it still proves the renderer does not *invent* a name
out of `withheldPorts`. 🔴 **The general rule: an absence assertion is only worth its ink if the
string could have been present. Ask which side of the wire the fixture puts it on.**

### B. 🔴 `apiSql()`'s CACHED POOL DOES NOT SURVIVE `resetSchema`, AND THE SYMPTOM IS A GREEN SUITE

postgres.js resolves user-defined type OIDs — every enum — when a connection is established.
`freshDb()` does `drop schema public cascade`, so those OIDs stop existing while the pooled
connection stays open, and **every route-handler call after the first in a file** fails with
`XX000: cache lookup failed for type <oid>`. `refusalResponse` maps an unrecognised message to a
**400 with no detail, by design** — so a spec asserting *"this input is refused"* goes green
**without the route ever running**.

✅ Fixed with `resetApiSql()`, called by `freshDb()` so no spec has to remember. ⚠️ **It flipped
no existing test** (692 → 706 = exactly the 14 new ones), so it had bitten only the new file —
but it was one route-handler refusal spec away from being permanently invisible.
🔴 **It was found by a known-firing control**: the refusal specs were green and the control
asserting the *same* request SUCCEEDS was red.

### C. An escaped quote made an absence assertion pass trivially

A text preview value carries literal double quotes (`previewValue()` renders `"Invoice for Acme"`
that way). Asserted against `JSON.stringify(payload)`, JSON escapes them to `\"` — so
`expect(serialised).not.toContain('"ACME-1183-INVOICE"')` **passes whether or not the value is
in there.** ✅ **Compare values via an enumeration (`artifactStrings`), never against serialised
text.** Found by the same shape of control as B: the positive arm asserting the string IS present
once the row is ticked.

⚠️ **B and C are the same lesson twice in one session.** An absence assertion needs a positive
arm that fails when the mechanism is broken — and in both cases the positive arm was the only
thing that spoke.

---

# 🔴 SESSION 27's FINDINGS — still current, read before touching any of it

### 1. `recordEvent` could not be called inside a transaction, and the symptom was a lost QUESTION

`tryAward` catches a refusal and reports it as an outcome, which is correct **standalone**. Inside
a caller's transaction a `raise exception` has **already aborted Postgres**, and catching it in
TypeScript does not un-abort it. `bench.thread.created` has two listeners — `first-thread` (capped
at 1) and `thread-started` (repeatable) — so **the second question anybody asked failed outright**
with `[cap-reached]`.

✅ Fixed with a **savepoint per award** in `contribution.ts` (`isolated()`). **Per challenge**,
because a savepoint around the whole of `recordEvent` would forfeit the sibling awards and
`thread-started` would never pay out again after a person's first thread — a quieter version of
the same bug. 🔴 **UNI-002's 38 specs pass with those files byte-unchanged in git**, which is
exactly the proof UNI-015 AC2 asks for that this is a new caller and not a new mechanism.

⚠️ **`savepoint` exists only on a `TransactionSql`, never on a pool** — that is what makes the
branch a reliable discriminator rather than a guess.

### 2. `alter type … add value` is unusable in a migration here

Measured on **PG 16.14**: adding an enum value and naming it in a CHECK constraint in the same
migration is refused (*"unsafe use of new value"*), and `applySchema` runs each migration as one
implicit transaction. 🔴 **The `subject_kind::text = 'x'` workaround parses fine and is worse than
the problem** — a mistyped literal is not an error, it is a clause that silently never matches,
which is the *check that cannot fail* this phase has now found five times. **Recreate the enum**
(drop the constraint, rename, create, alter the columns, drop the old type, re-add the constraint).

### 3. AC4's `grep -ril discourse` instrument is TOO STRONG and was not implemented literally

Taken at its word it forbids a comment **saying what was removed**: `0001` still creates
`forum_threads` because a migration is history, and `0008` must name `discourse.post.created` to
migrate away from it. ✅ What is asserted instead is sharper — **no live CODE anywhere in `src/`,
comments stripped first** (with a control proving the stripper does not strip code), plus the
named files are gone and the **live database** has no `forum_threads` and no `discourse.*` event
key. **Prose keeps the record; code keeps nothing.**

### 4. Two shipping palette tokens fail WCAG AA in the LIGHT theme — fifth instance

`--theme-color-danger` scores **4.26** and `--theme-color-success` **3.55** on `bg-0` in light —
and they are exactly the tokens the queue clock and the accepted-answer mark would reach for. The
pitch artifact hand-mixed its own colours (`#a33228`, `#1f6d52`) for those two roles, which is
what a designer does when the system token looks wrong — **and it looked wrong because it IS
wrong** at that size on that ground. ✅ `--site-fg-alert` and `--site-fg-good` are **split by
theme**; `--site-fg-warn` needed no split (10.51 / 4.79). All three are now rows in
`tests/uni013-contrast.test.ts`. 🔴 **A role with no pair in that table is a colour nobody
measured.**

### 5. The SQL re-point of the challenge registry matches ZERO ROWS

`challenges` is empty in a fresh schema — the registry loads from `challenge-catalogue.json` via
`syncCatalogue()` — and **nothing is deployed anywhere**, so no database holds a `discourse.*` row.
The JSON is the half that binds. Written into `0008`'s comment out loud so the block is never read
as evidence that anything was migrated.

---

# 🔴 THREE HARNESS TRAPS. The first is session 28's and is the worst of them.

1. 🔴 **`freshDb()` + a ROUTE HANDLER = a suite that PASSES WITHOUT RUNNING THE ROUTE.** Described
   in full as finding B above; repeated here because the next person to write a route-handler spec
   will hit it and will not have read a findings section first. ✅ **Already fixed** — `freshDb()`
   calls `resetApiSql()`. ⚠️ **A second cached pool anywhere needs the same treatment**, and the
   failure will look like a passing test.

The other two are in `tests/uni015-bench-http.test.ts`, and both bite anyone who spawns a server
in a spec:

2. **`next start` SURVIVES `child.kill()`.** We spawn `npx`; the real listener is a **grandchild**
   (`next-server`). A survivor holds a pool against the database every other suite drops, and the
   symptom is **51 failures in five unrelated files** reading `type "badge_family" does not exist`.
   ⚠️ **`pkill -f "next start"` matches NOTHING.** Kill by port.
3. 🔴 **`lsof -ti :3987` MATCHES CLIENTS TOO** — including the vitest worker that just ran the
   fetches. Killing that PID **SIGKILLs the process running the tests**: the file vanishes from the
   report with an *"unhandled error"* from tinypool, the summary reads **`23 passed (24)`**, and
   **nothing names the file that did not run.** ✅ **`lsof -ti tcp:<port> -sTCP:LISTEN`.**
   **A suite that was killed looks almost exactly like a suite that passed — always reconcile the
   file count.**

---

# THE PLAN — the four code items in the alpha bar, in order

⚠️ **This section was rewritten in session 28.** It previously said *"LANE A — finish UNI-016,
start here"* and described a credential that does not exist. UNI-016 is built; that lane is gone.

## 🟢 LANE A — E1: UNI-001's issuer. **Start here, and it unblocks everything else.**

Plain session auth. **Not** the OIDC provider face — D19 struck it, because there is no second
system to federate with, and building it speculatively is explicitly warned against in UNI-001.

What exists already, measured session 28:
- `sessions` rows, `hashSessionToken()`, and `viewerFromToken()` — the *resolution* half is built
  and every route uses it. **Only minting is missing.**
- `apiviewer.ts` accepts a **bearer token** as well as a cookie, against the same rows, with no
  second issuer — the desktop-client story D14 asked for.
- Editor side: `readCommunitySession()` reads `nodegx.community.session` from `JSONStorage`, is
  specced (9 cases incl. a throwing store), and **returns `null` for everybody today**. It is the
  one place to write to.
- The composer already branches on it: signed in → POST, signed out → the browser hand-off.

So the work is: an OAuth callback (or whatever D-ruling you land on), a row insert, and a sign-in
affordance in the editor that writes that key. ⚠️ **Callback URLs need the domain**, which is why
UNI-001 stalled in the first place — `community.nodegx.io` resolves now, so that blocker is gone.

🔴 **The moment it lands, drive the whole loop end to end**: right-click a node → ask → post →
read it on `/bench` signed out. **That is the drive session 28 could not do**, and it is E9 in
miniature.

## 🟢 LANE B — E4: UNI-013 slice 5, the page archetypes

Scoped from the driven review above. **Three archetypes — index, list, detail — not eight
restyles.** The profile is the detail one already. ⚠️ AC1/AC3/AC5 still bind: no hardcoded colour,
contrast rows split per theme, suites unchanged.

## 🟢 LANE C — E3: the home shows real threads signed out

UNI-009's D19-rewritten AC1, and it is small: `listThreads()` exists, `/bench` exists, and
`src/app/page.tsx` links to neither. ⚠️ **Do it as part of LANE B, not before it** — it is a
composition change on the page LANE B is redesigning, and doing it twice is doing it twice.

## 🔴 LANE D — E2: deployment. **Blocked on Richard (E5).**

Still owned by no task. **Write the task file** — and read
[the nexus-1 memory](../../../.claude/projects) first if you have it: the box runs two other live
sites and Caddy is all-or-nothing, so it is a drop-in site block only, and you **curl the
neighbours before and after**. ⚠️ **A 308 proves nothing** — read `:2019/config/`.

🔴 **E8 belongs to this lane and is a launch blocker, not hygiene**:
`NOTIFICATION_LINK_SECRET` has a dev default, and a deployment that does not set it has
**forgeable unsubscribe links**.

---

# ⚠️ FOR RICHARD — three of these are now IN THE EXIT CRITERION, so they gate the alpha

🔴 **The asks are no longer a wishlist.** E5, E6 and E7 are items in
[README.md](README.md) §"What closes this phase", which means **the phase cannot close until they
are answered** — they are not deferrable the way they were last session.

1. 🔴 **E5 — does the platform go on nexus-1?** **The first domino**: it blocks deployment (E2),
   which blocks the smoke drive (E9), which is the last item in the close. Everything else in the
   bar can proceed in parallel; this one has a queue behind it.
2. 🔴 **E6 — a transactional sending account** (Postmark / SES / Resend) + a sending domain.
   ⚠️ **Sharper than it reads, and sharper than last session.** **D19 was ruled *on the condition*
   that email lands** — *"a forum where 'someone answered you' never reaches an inbox is a forum
   nobody returns to"* — so this is not a nice-to-have attached to UNI-014, it is **the condition
   the build-don't-buy decision was made under.** `log` delivery covers dev and cannot ship.
3. **E7 — where do capture images live?** **Cheap, and genuinely deferrable within the bar.** A
   `capture` stores dimensions and a consent record and **no image**, which is exactly what the
   editor publishes today, so **nothing has to be migrated** whenever you decide — an `image_url`
   column and a writer are the whole change. ⚠️ Intersects E5.

**Not in the close, still open:** the twelve badge artworks (UNI-013 slice 4 — degrades rather
than blocks; the profile renders a family mark and a tier colour, not a broken image) · **a Paddle
account (D7)**, still between coaching and revenue · GitHub Pages unattached (`has_pages: false`
as of 08-17) · the F4 packaged-install scope call (UNI-012) · UNI-006's three calls, UNI-005's two,
UNI-004's *"responding to an RFP requires clearing D8's bar"*, UNI-003's change to UNI-002's
catalogue.

🔴 **And one decision that only arrives at the close:** UNI-017, UNI-018, UNI-007's intake,
UNI-006's bridge, UNI-011's views, UNI-008, UNI-010 and UNI-012 are **explicitly outside the
alpha**. At the close they become **a phase 67b, or they fold into phase 68** — your call, and
worth making deliberately rather than by drift.

---

# Gates

**`nodegx-community`:** HEAD **`a10ad9b`**, clean, `main` == `origin/main`. **Measured on that
tree, this session:** vitest **708 / 708 across 25 files, zero failures, zero skips** — ✅ **file
count reconciled (25 listed = 25 reported)** and `uni015-bench-http` **ran rather than skipped**;
`tsc` clean; `next build` clean; `check:css` clean over **971 declarations / 19 components**.
The floor this replaced was 692 / 24, and 708 = 692 + 14 (the intake suite) + 2 (the HTTP
consequences). 🔴 **Re-measure; never quote a handover's number.**

⚠️ **The build reports 26 route entries by `grep -cE "[○ƒ] /"`; session 27's handover said 24.**
**No route was added this session** — only a field on two existing POST handlers — so the delta is
a counting method, not a surface change. Flagged rather than smoothed over: if it matters, count
it the same way twice.

**This checkout:** phase-67's session-28 work is `179c6432` (code) + `4c23f869`, `3482c1da`,
`44411ff3` (docs — the handover, the gates, and the exit criterion + slice 5) on `cline-dev`. 🔴 **Do NOT read those as HEAD** — this checkout is shared and peers commit
constantly (`c6dcb3a2`, CN-013, landed immediately before). **Measured this session:** `test:main`
**3752 / 3752 across 244 suites**, `tsc -p packages/noodl-editor` clean, `tsc -p
packages/noodl-editor/tsconfig.tests.json` clean. `tests-unit/uni-016` **42 across 3 files**.
⚠️ **No `test:ci` this session** — no `.jsx` and no renderer-only surface changed, but that means
**this session's evidence says nothing about the Electron suite.**

⚠️ **Peers had uncommitted work all session** in `nodegx-backend`, `nodegx-module-inject`,
`CloudFunctionDeployer.ts`, `cloudFunctions.ts`, `projectmodules.ts`, `noodl-viewer-cloud`,
`scripts/library/check.ts` and four phase directories. **All left untouched** — every commit here
used explicit pathspecs and nothing was staged broadly.

🔴 **ONE SIDE EFFECT TO KNOW ABOUT: the local dev database is SEEDED with fake content.** The
slice-5 review needed it — four people (`nia-builds`, `tom-reilly`, `sam-vega`, `priya-r`), four
bench threads and an answer — because an empty page looks sad for a reason that is not design.
⚠️ **It is on `localhost:55432`, and the first `freshDb()` any spec runs will drop it.** That is
harmless; it is recorded so nobody mistakes it for real data, and so the next person reviewing the
look knows they must **re-seed before believing a screenshot of an empty page**. The seed script
was deliberately **not committed** — it is throwaway, and a committed one becomes a fixture nobody
maintains.

⚠️ **`npm run lint` is still not a gate on the platform** — the script exists, there is no ESLint
config, and running it starts Next's interactive setup.

---

# Standing constraints

- Editor work on `cline-dev`. 🔴 **Never `git stash`** — ⚠️ **there is a stash that is not yours**
  (`stash@{0}`, WIP on `ff74bcc9`). Leave it alone. ✅ **`git commit <pathspecs>`, never stage
  broadly.** ⚠️ Untracked files need `git add` — put add and commit in **one chain**.
  ⚠️ **Peers always have uncommitted work here** — session 28's set is listed in §Gates, and it
  was left untouched. **Do not read the list; re-read `git status` — it changes hourly.**
- 🔴 **`cd` does not persist between tool calls** — except it DOES persist in this harness's Bash
  tool. ⚠️ A failed `cd` in a chain leaves you where the last successful one put you.
- ✅ **`npm --prefix packages/noodl-editor run test:main -- <path>`** — jest from the repo root
  silently picks the wrong config.
- 🔴 **Port 55432 for the platform's Postgres, never 5432.**
- 🔴 **BSD `xargs` has no `-r`** — `lsof -ti :p | xargs -r kill` errors out and the rest of the
  chain silently does not run. Cost one lost suite run.

---

# Things the next person will otherwise re-derive

**The editor repo (session 28):**

- 🔴 **`expect(value, message)` is VITEST. This checkout is JEST**, and the second argument is a
  hard compile error in a `.test.ts` that `tsc -p tsconfig.tests.json` will catch — but only if
  you run it. Put the failing value **inside** the assertion (`expect({value, ok}).toEqual({value,
  ok: true})`) or the report says `false !== true` and names nothing.
- 🔴 **There is NO DOM and NO React in this checkout's jest runner.** A rendered component test is
  not available. The established response is source analysis with negative controls derived from
  the **real current source** — `base-dialog/measuring-copy.test.ts` is the precedent and
  `uni-016/composer-sends-what-it-shows.test.ts` follows it. ⚠️ **Say in the file what that does
  not prove**, or a source read gets counted as a drive.
- ⚠️ **`test:main` collects its file list at start.** A spec written while it is running is not in
  the run, and the summary looks complete. **Reconcile the suite count**, exactly as the
  `lsof` trap requires for vitest.


- 🔴 **HOW TO REVIEW THE LOOK, because LANE B is a design task and all three steps are traps.**
  1. **Seed content first.** An empty page looks sad for a reason that is not design, and a review
     of empty states produces a list of fixes that change nothing. Four people, four threads and
     an answer was enough. ⚠️ The seed script was **not committed** deliberately — throwaway, and
     a committed one becomes a fixture nobody maintains. Write a fresh one; the helpers in
     `tests/helpers/db.ts` show the column names (⚠️ `challenges` has **no `repeatable` column** —
     it is `mechanism` + `max_awards` + `min_interval_seconds`).
  2. 🔴 **Check the served CSS hash against `ls .next/static/css/` BEFORE believing a screenshot.**
     A stale `next start` serves HTML pointing at a hash that no longer exists → 404 stylesheet →
     a completely unstyled page. **Every gate stays green through it**, and it is indistinguishable
     from "the design is bad". `curl -s localhost:PORT/ | grep -oE '/_next/static/css/[a-z0-9]+\.css'`.
  3. **Kill by port, `lsof -nP -iTCP:<port> -sTCP:LISTEN -t`.** `pkill -f "next start"` matches
     **nothing** — the process is `next-server`.
  ✅ System Chrome screenshots headlessly with no extra dependency:
  `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu
  --hide-scrollbars --virtual-time-budget=4000 --window-size=1440,1000 --screenshot=out.png URL`.
  ⚠️ Use a port nobody else uses and **do not** open a CDP port — a stray Chrome steals 9222.

**The platform repo:**

- 🔴 **Never generate DDL from `src/db/schema.ts`.** It is a query mirror; rulings live in
  `src/db/sql/`. ⚠️ **But the drift spec compares COLUMNS**, so a generated column must still be
  declared in the mirror — with a comment saying it must never be written.
- 🔴 **A GENERATED column is the strongest form of "derived, not typed"**: `insert` and `update`
  are both refused, and **their error messages DIFFER** (*"cannot insert a non-DEFAULT value"* vs
  *"can only be updated to DEFAULT"*). Match them separately; one loose alternation matches far
  too much.
- 🔴 **`board_actor_is_eligible()` is where D15 and D8's ban live**, in the database. The bench
  calls it from a trigger on both tables. ⚠️ **Both tables** — a probe that only exercises the
  parent proves nothing about the child, and UNI-005's census caught exactly that.
- 🔴 **UNI-005's census classes are not interchangeable.** `machine-derived` means *a minor CAN
  write here*; `minor-refused` means they cannot. Claiming the former where the latter holds
  claims a **weaker** guarantee, and the census catches it by demanding a probe the class cannot
  supply.
- 🔴 **A route handler is outside every module sweep.** `tests/uni011-mirror-api.test.ts` reads
  routes **off disk**, and now handles **dynamic segments**: a recipe declares its `params`, and a
  real thread is seeded so the "gate opens" half of the assertion can be true. ⚠️ **A dynamic
  route imported via `pathToFileURL` fails** — it percent-encodes `[` and `]`. Decode those two.
- 🔴 **Drive routes over real HTTP** for anything a criterion says is driven — `npx next start -p
  <port>`, and read the two traps above about killing it.
- 🔴 **`points_ledger.id` is a `bigserial`** — the one non-uuid key in the schema.
- ⚠️ **Nulls are DISTINCT in a Postgres unique constraint** — use two partial unique indexes.
- 🔴 **`created_at` is not an ordering key**; `bench_threads.seq` / `bench_posts.seq` are.
- 🔴 **postgres.js has no nested `begin`** — a function that opens its own transaction cannot be
  composed. ✅ **It DOES have `tx.savepoint()`**, which is how `contribution.ts` was fixed.
- ⚠️ **`expect(value, message)` is vitest, not jest.**
- ✅ **Node 22 strips types natively** — `node --experimental-strip-types script.ts` imports a
  `.ts` directly, which is how the corpus is generated. ⚠️ Extensionless imports still fail; a
  scratchpad file still cannot resolve the repo's `node_modules` (put it in the repo root).

**Both:**

- 🔴 **`/usr/bin/grep -a`, always.** Plain `grep` here is ugrep and silently skips `.ts` as binary.
- 🔴 **The corpus contract:** `postbody-corpus.json` is **byte-identical** in both checkouts and
  **both** specs pin the same sha256 (`d59d6095…`). To change it: regenerate with
  `scripts/gen-postbody-corpus.mjs` in the platform repo, copy it here, and update **both**
  constants in the same commit. ⚠️ It catches **divergence**, not a bug in both parsers — the
  safety property is asserted separately in each repo.
- 🔴 **A corpus of only hostile payloads witnesses only the refusals.** Two parsers can agree
  perfectly about what to REJECT and disagree about everything they accept, which is all a reader
  sees. 15 hostile + 20 grammar.
- 🔴 **`forEachNode` STOPS on a truthy return.** Use a block body.
- 🔴 **The `lesson` MCP group is DEFERRED** — `find_tools({group:"lesson"})` first.
- `suggestedNodes` is still **dead** — no callers.
