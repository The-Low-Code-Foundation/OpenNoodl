# Phase 67 — next session prompt

Paste the block below into a fresh session.

---

Continue phase 67 (NodeGX Community), `dev-docs/tasks/phase-67-nodegx-university/`.

**Read first, in this order:** **[README.md](README.md) §"What closes this phase"** — the alpha
bar, now **ten items**, and it decides which task you pick — then §"WHERE THE PHASE IS" below,
then `TASKS.md`'s table, then your task file.

🔴 **Two repos.** Editor work is this checkout. Platform work is
`/Users/richardosborne/vscode_projects/nodegx-community` — a **sibling directory, never nested** —
pushing to `The-Low-Code-Foundation/nodegx-community`. None of this checkout's gates, peers or
traps apply there.

---

# ✅ E1 IS BUILT. THE BOTTLENECK MOVED, AND IT MOVED TO RICHARD.

**Session 29 built UNI-001's issuer, both halves.** Before it, the only `insert into sessions`
statements in the whole platform repository were **in test files** — so `readCommunitySession()`
returned `null` for every human alive and *nothing UNI-015 or UNI-016 built was reachable by a
real person*. That is no longer true.

🔴 **And it still is not reachable, for a completely different and much smaller reason: there is
no GitHub OAuth App.** `githubOAuthConfig()` reads two environment variables; without them
`/api/auth/github/start` answers **503 with a plain sentence** — deliberately, because a button
that redirects into a provider error page is a failure nobody can report. **That is E10, it is
Richard's, it is free, and it is one form.** It is now the first domino in the whole phase.

> ⚠️ **Do not "work around" it.** A dev-only issuer, a paste-your-token box, a seeded session in
> production — each is a back door, and `communitysession.ts` warns against exactly that shape in
> its own header. The correct state of a deployment with no credential is **503**.

## 🟢 THE ORDER FOR THE NEXT SESSION

1. 🔴 **E4 — UNI-013 slice 5, the page archetypes.** **Now the largest remaining code item, and
   it is the one to start.** Scoped session 28 from a driven review; findings table in
   [UNI-013](UNI-013-THE-COMMUNITY-SITE-IN-NODEGX-CLOTHES.md) §"Slice 5". **Three archetypes —
   index, list, detail — not eight restyles.** The profile is already the detail one.
2. **E3 — UNI-009 AC1**, the home shows real threads signed out. ⚠️ **Do it inside E4**, not
   before: it is a composition change to the page E4 redesigns, and doing it twice is doing it
   twice.
3. **UNI-001 AC2's launcher affordance** — small, and see the honest gap below.
4. **E2 — deployment**, once Richard answers E5.

---

# 🔴 CHECK THIS HANDOVER'S PREMISES. Session 28's was right; session 27's was wrong in three places.

Session 29 verified session 28's three central claims before writing code — *"no issuer"*, *"the
composer branches on the session"*, *"the seam is one function"* — and **all three held**. That is
worth recording, because the session before it had three false premises and the habit that caught
them is the same one: **grep for the callers of every function a handover says is ready.** Two
greps, before any code.

⚠️ **The one thing session 28's handover got wrong was small and is fixed here:** it said the
editor's sign-in button *"renders D2's string and is inert"*. There is **no button in the editor at
all** — the inert one was in the *site's* header (`src/app/layout.tsx`), and it is live now.

---

# ⚠️ TWO SESSIONS WORKED THIS LANE AT ONCE, AND ONE OVERWROTE THE OTHER'S NOTE

**Recorded because the silent version of this is how a shared checkout rots.** At **13:57** a peer
session committed **`32a143cf`** — 24 lines onto this file's LANE A section reading *"🔴 CHECK IF
IT IS ALREADY DONE BEFORE YOU START"*, with an inventory of uncommitted files by mtime and a
warning not to run the platform suite while that work was moving. **The work it inventoried was
this session's**, in flight. The peer was right, and its instruction — *"`git log` and `git status`
in BOTH repos before writing a line"* — is the correct one.

🔴 **This session then rewrote the whole file with `cat >` and discarded those 24 lines.** The
*substance* is genuinely superseded (E1 is built and committed, so "check whether it is done" has
an answer now), but the overwrite was not a decision, it was a side effect of rewriting a file
wholesale that somebody else had edited in the meantime.

✅ **Two things to carry forward:**
1. **A wholesale `cat >` over a shared file is a merge you did not perform.** Re-read the file
   immediately before writing it, or patch the sections you mean to change.
2. 🔴 **The concurrency was real and probably cost a suite run.** The first full platform run died
   with **`EXIT=137` — SIGKILL** at 9 of 26 files, with another Claude session live on this
   machine. `pkill -f vitest` is a command both sessions had reason to run. **Do not `pkill` by a
   pattern as broad as a test runner's name**, and expect somebody else's run to be what you hit.

---

# WHERE THE PHASE IS — 2026-08-19 (session 29)

| In the close? | Item | State |
|---|---|---|
| ✅ **E1** | **UNI-001's issuer** | ✅ **BUILT.** Sessions minted, GitHub OAuth, device flow for the editor, sign-out revokes. ⚠️ **AC2's launcher affordance still owed; AC4's grep needs a verdict** |
| 🔴 **E10** | **A GitHub OAuth App** | 🆕 **NEW, and now the first domino.** Richard's. Without it nobody can make an account, which is the criterion's first verb |
| 🎯 **E4** | **UNI-013 slice 5 — the pages** | 🔴 **NOT STARTED. The largest remaining code item. START HERE** |
| 🎯 **E3** | **UNI-009 AC1** — home shows real threads | 🔴 **NOT MET.** Small; fold into E4 |
| 🎯 **E2** | **deployment** | 🔴 **Owned by no task.** Blocked on Richard (E5) |
| ✅ done | UNI-001 E1, 002–006, 009 cut, 011 s1–s2b, 013 s1–s3, 014, 015, 016 | |
| ⛔ **out** | UNI-017 · UNI-018 · UNI-007 intake · UNI-006 bridge · UNI-011 views · UNI-008 · UNI-010 · UNI-012 · UNI-013 s4 | See the README's *"explicitly NOT in the close"* |

## What session 29 built

**Platform** (`nodegx-community`) — `session.ts` (mint / revoke / cookie), `site.ts` (`SITE_ORIGIN`,
`safeReturnPath`), `githuboauth.ts` (an **injected** code exchange), `signin.ts` (identity → account),
`signin-http.ts` (start / callback / sign-out as plain functions), `devicepairing.ts`, migration
**`0010`** (`device_authorizations`), **six routes**, the `/auth/device` approval page, and a header
that is signed-in-aware. Plus README environment documentation.

**Editor** — `communityorigin.ts` (`COMMUNITY_URL` **moved out of the dialog**),
`writeCommunitySession` / `clearCommunitySession`, `communitysignin.ts` (the device dance and
`signOutOfCommunity`), and a **Sign in to NodeGX** affordance on the composer's signed-out branch
with cancellation on unmount.

⚠️ **What session 29 did NOT do: a drive.** Same reason as session 28 and one step further along —
there is still no credential to sign in *with*. **E10 is what makes the first real drive possible**,
and that drive is E9 in miniature: right-click a node → sign in → ask → post → read it on `/bench`
signed out.

---

# 🔴 SESSION 29's FINDINGS

### A. `signOut` read the COOKIE only, and the editor sends a BEARER — *build the caller*, 11th

`signOut(sql, request)` revoked `cookieValue(request, SESSION_COOKIE)`. That audits clean on the
page: it is a sign-out route, it revokes the session cookie. 🔴 **But an editor has no cookie jar
scoped to our origin** — which is the whole of `apiviewer.ts`'s bearer note, one file away — so
`signOutOfCommunity` would have received **`200 {ok:true}` while revoking nothing**, leaving a live
session behind on *every* editor sign-out.

✅ Fixed by routing it through the same `tokenFromRequest` the `/api/v1` surface already uses, with
a spec that presents a bearer and asserts the token stops resolving. 🔴 **It surfaced in the minute
the editor caller was written, not while writing or reviewing the route.** The general move: when
a module has **two transports for one credential, write the second transport's caller** — and check
whether a shared helper already handles both. This one did; the handler ignored it.

⚠️ It is also an [assert-an-absence] shape from the other side: *revoked nothing* and *revoked
successfully* were the **same 200**.

### B. Two decisions were FORCED by this task's own scope, and reading them as choices will waste a session

1. **The device flow, not a loopback listener and not a `nodegx://` handler.** UNI-001's scope says
   *"no listener is opened"* — that kills the loopback redirect outright — and a protocol handler is
   an OS registration a dev build, a portable build and a second install all fight over, with the
   winner receiving a URL containing a live credential. ⚠️ **This is NOT D19's struck "browser
   handoff ticket" returning**; that one handed an editor session to *Discourse*, and there is no
   Discourse. The argument is written into `0010`'s header where it cannot be lost.
2. **GitHub only; no email/password.** The scope asks for both and for *password reset* — and
   **nothing on this platform sends mail** (E6, the condition D19 was ruled under). A password flow
   whose reset arm cannot be delivered locks people out. `accounts` grew no `password_hash`.

### C. The site is now entirely server-rendered, and that is a deliberate cost

`cookies()` in the **root layout** opts the whole app out of static generation: `next build` reports
**every route as `ƒ`**, where most were prerendered before. A signed-in header cannot be a static
file, and the alternative — rendering the chip client-side from `/api/v1/me` — trades it for a flash
of the wrong state on every navigation. ⚠️ **Recorded so it is not read as a regression.** If a page
ever genuinely needs static delivery, move the read into a client island; do not stop reading it.

### D. An honest gap: AC4's grep now needs a verdict rather than a run

UNI-001 AC4 asks that *"reads of the session outside the launcher/account module come back empty"*.
The composer reads it — which **UNI-016 made true before this session** — and is arguably exactly
what the criterion means to permit. 🔴 **It needs re-wording or a ruling. Do not report it as
passing**, and do not delete it: the principle it protects (*the editor is fully functional signed
out, forever*) is one of the phase's two.

---

# ⚠️ FOR RICHARD — the asks, and one is new and now first

1. 🔴 **E10 — a GitHub OAuth App. NEW, cheapest, and now the first domino.** Homepage
   `https://community.nodegx.io`, callback **`https://community.nodegx.io/api/auth/github/callback`**.
   ⚠️ **Byte for byte** — GitHub reports a mismatch as `redirect_uri_mismatch` *without saying which
   side is wrong*. Set `GITHUB_OAUTH_CLIENT_ID` and `GITHUB_OAUTH_CLIENT_SECRET`. Without them
   **nobody can make an account**, which is the exit criterion's first verb. ⚠️ Intersects E5/E2 —
   the callback has to point at wherever the platform is actually served.
2. 🔴 **E5 — does the platform go on nexus-1?** Still the domino behind deployment (E2) → the smoke
   drive (E9). **E10 needs its answer too**, so this now has two things queued behind it.
3. 🔴 **E6 — a transactional sending account + domain.** **D19 was ruled *on the condition* that
   email lands.** `log` delivery covers dev and cannot ship.
4. **E7 — where capture images live.** Cheap, genuinely deferrable; nothing migrates whenever it is
   decided.

**Not in the close, still open:** the twelve badge artworks (UNI-013 slice 4) · a Paddle account
(D7) · GitHub Pages unattached · the F4 packaged-install scope call (UNI-012) · UNI-006's three
calls, UNI-005's two, UNI-004's D8-bar question, UNI-003's catalogue change.

🔴 **And the decision that arrives at the close:** UNI-017, UNI-018, UNI-007's intake, UNI-006's
bridge, UNI-011's views, UNI-008, UNI-010 and UNI-012 become **a phase 67b or fold into phase 68**.
Richard's call, made deliberately rather than by drift.

---

# Gates — measured 2026-08-18/19, session 29

**`nodegx-community`:** vitest **745 passed across 26 files, zero failures, zero skips**;
`tsc --noEmit` clean; `next build` **exit 0**; `check:css` clean over **1008 declarations /
21 components** (was 971 / 19).

🔴 **READ HOW THAT 745 WAS MEASURED BEFORE QUOTING IT — it is the UNION OF TWO RUNS, and that is
stated rather than smoothed over.** The first full run was **SIGKILLed at 50 minutes with only
9 of 26 files done** (`EXIT=137`, and **no summary line at all** — which is the honest version of
the trap: a killed run can otherwise look like a passing one). The second run took **the 17 files
that never ran, plus the one that had failed**, and reported **18/18 files, 494/494**. The tree
did not change between them.

✅ **The reconciliation, so the next person does not redo it:** 9 + 18 − 1 shared file = **26**,
which is exactly the number of `tests/*.test.ts` on disk. **251** tests from the first run's eight
clean files + **494** = **745**. And **745 = 708 (the prior baseline) + 36 (`uni001-issuer`) + 1** —
that last one is `db-schema-drift`'s `it.each(tableNames)` gaining a case for
`device_authorizations`. **Every test in the delta is accounted for.**

⚠️ **A clean single full run is still owed**, and it is cheap to want and expensive to get (~50
minutes). Do one before treating 745 as the floor.

⚠️ **`grep -cE "[○ƒ] /"` now reports 34 route entries** (session 28 reported 26 by the same method,
session 27 reported 24). **Six routes and one page were genuinely added this session**; the rest of
the delta is the counting method, which the last handover already flagged. 🔴 **Count it the same
way twice before treating a change in this number as a surface change.**

**This checkout:** `tsc -p packages/noodl-editor` **clean**; `tsc -p
packages/noodl-editor/tsconfig.tests.json` **clean** (both run unpiped — ⚠️ `tsc | head; echo $?`
reports *head's* status). `tests-unit/uni-001` **24 passed across 2 files**, file count reconciled.

⚠️ **NO `test:main` full run and NO `test:ci` this session.** The editor changes are three model
modules and one dialog; **that means this session's evidence says nothing about either baseline**,
and UNI-001 **AC1 names the full baseline as its regression gate**. 🔴 **Run both before believing
"gates nothing".**

🔴 **THE THREE FAILURES IN THE FIRST RUN WERE MINE, AND THEY WERE NOT ASSERTIONS.** All three were
`Hook timed out in 30000ms` in `uni015-bench.test.ts` — the `beforeEach(freshDb)` hook, under load
**I created** by running `next build` and two jest suites against the same database and the same
`.next` while the suite was in flight. ⚠️ **`uni015-bench-http.test.ts` spawns `next start` against
`.next`**, so rebuilding mid-run is not merely slow, it swaps the artefact under a running spec.
The same file passed **63/63** on the quiet re-run, and per-test times went from ~8s to ~400ms.
**Do not start a build or a second suite while this one runs.**

⚠️ **One warning, attributed rather than waved away:** running the two `uni-001` spec files together
prints *"a worker process has failed to exit gracefully"*. **Each file alone is clean**, two
pre-existing suites in the same family are clean, and `--detectOpenHandles` on the suspect file
reports **no handles**. Both files pass either way. **Not chased further; recorded so the next
person does not re-derive it.**

---

# 🔴 THE MACHINE'S STATE RIGHT NOW — and the first item is a landmine for LANE B

**Left running at the end of session 29, deliberately, so the site could be shown.** Read this
before you review the look, because **step zero of a look review is checking the served CSS hash**
and one of these two servers will fail it.

| Port | What | Do what with it |
|---|---|---|
| **3222** | `next start`, session 29's build. **Served hash `37460e78f1988423.css`, verified against disk, 200.** | Yours to use or kill |
| 🔴 **3111** | A `next-server` **~15 hours old**, from session 28's slice-5 review. It predates two rebuilds | ⚠️ **DO NOT REVIEW THE LOOK ON THIS ONE.** Its HTML points at a CSS hash that no longer exists ⇒ **404 stylesheet ⇒ completely unstyled page**, which is indistinguishable from "the design is bad" — the exact misread LANE B exists to fix. It is not known to be mine; leave it or attribute it by PPID first |

✅ **Kill by port, never by name:** `lsof -nP -iTCP:<port> -sTCP:LISTEN -t`. **`pkill -f "next start"`
matches NOTHING** — the process is `next-server`.

## ⚠️ The local database is SEEDED WITH FAKE CONTENT

`npm run db:seed` (committed) plus **four bench threads and an accepted answer written straight in
SQL, which were NOT committed** — throwaway, because a committed seed becomes a fixture nobody
maintains and **the first `freshDb()` any spec runs drops the lot**.

🔴 **Re-seed before believing any screenshot of an empty page.** The committed seed covers people,
profiles, RFPs, coaching, replays and articles — **it does NOT create bench threads**, so `/bench`
is empty out of the box and looks like a design problem when it is a data problem. ⚠️ It also mints
**dev session tokens** (`dev-session-nia`, `dev-session-tom`, …) usable as
`Cookie: nodegx_session=dev-session-nia` — which is how the signed-in header was checked without an
OAuth app.

## ✅ What was confirmed on the running site, session 29

- signed out → header offers **Sign in to NodeGX** → `/api/auth/github/start`
- signed in → `whoami` chip → `/u/<handle>`, a **Sign out** button, and the device form
- `/api/auth/github/start` → **503 `{"error":"sign-in is not configured on this deployment"}`**,
  which is E1 correct and E10 outstanding, in one line

🔴 **And the look review reproduced BOTH recorded slice-5 findings**, so they are not stale: the
home shows **none of the four threads that exist** (E3), and the Bench renders **two link styles on
one page** with **the queue repeating the list beneath it**.

---

# Standing constraints

- Editor work on `cline-dev`. 🔴 **Never `git stash`** — ⚠️ there is a stash that is not yours.
  ✅ **`git commit <pathspecs>`, never stage broadly.** Untracked files need `git add` — put add and
  commit in **one chain**. ⚠️ **Peers always have uncommitted work here** — re-read `git status`,
  never a handover's list.
- ✅ **`npm --prefix packages/noodl-editor run test:main -- <path>`** — jest from the repo root
  silently picks the wrong config.
- 🔴 **Port 55432 for the platform's Postgres, never 5432.**
- 🔴 **BSD `xargs` has no `-r`.**
- ⚠️ **The platform suite is SLOW** — roughly **8 seconds per test**, because almost every one calls
  `freshDb()` and that reapplies ten migrations. A full run is **the better part of an hour**, and
  more under load. Budget for it; do not start one and then start two other heavy jobs.
- 🔴 **Do not edit sources while a suite is in flight.** Session 29 did once and **discarded the
  run** — vitest imports a module when it reaches the file, so a mid-run edit gives you results you
  cannot attribute to either version.

# Things the next person will otherwise re-derive

**Platform:**

- 🔴 **A new route under `src/app/api` needs a RECIPE** in `tests/uni011-mirror-api.test.ts` or that
  suite fails — it derives the route list from disk. E1's six all carry `gatedByD15: false` with a
  reason: **signing in is not the community surface**, and gating it would mean an org-minor could
  not sign in at all, which is a different ruling from the one D15 made.
- 🔴 **A new free-text column needs a CLASSIFICATION** in `tests/uni005-data-inventory.test.ts`, and
  the non-vacuity floor moves with it (**92 → 94** this session).
- 🔴 **Never generate DDL from `src/db/schema.ts`** — but a new table must still be declared there,
  because the drift spec compares columns.
- ⚠️ `originIsSecure()` reads the **scheme**, never `NODE_ENV`. `next start` on a laptop runs with
  `NODE_ENV=production`, so a `NODE_ENV` test would put `Secure` on a cookie served over plain HTTP
  — browsers drop it silently, and the symptom is a sign-in that appears to work and does not.
- ⚠️ **Two `set-cookie` headers need `Headers.append`, not `set`.** `set` overwrites, and the
  survivor is whichever was written last — leaving either no session or a live state nonce.

**Editor:**

- 🔴 **`expect(value, message)` is VITEST. This checkout is JEST.** Put the failing value *inside*
  the assertion.
- 🔴 **No DOM and no React in this checkout's jest runner.** Source analysis with negative controls
  derived from the real current source is the established response —
  `uni-001/composer-offers-signin.test.ts` follows `uni-016`'s precedent. ⚠️ **Say in the file what
  it does not prove**, or a source read gets counted as a drive.
- ⚠️ **`test:main` collects its file list at start.** Reconcile the suite count.

**Both:**

- 🔴 **`/usr/bin/grep -a`, always.** Plain `grep` here is ugrep and silently skips `.ts` as binary.
- 🔴 **`forEachNode` STOPS on a truthy return.** Use a block body.
