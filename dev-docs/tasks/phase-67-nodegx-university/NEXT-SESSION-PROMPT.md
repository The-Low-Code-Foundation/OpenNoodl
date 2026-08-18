# Phase 67 — next session prompt

Paste the block below into a fresh session.

---

Continue phase 67 (NodeGX Community), `dev-docs/tasks/phase-67-nodegx-university/`.

**Read first, in this order:** **[README.md](README.md) §"What closes this phase"** — the alpha
bar, **ten items**, and it decides which task you pick — then §"WHERE THE PHASE IS" below, then
`TASKS.md`'s table, then your task file.

🔴 **Two repos.** Editor work is this checkout. Platform work is
`/Users/richardosborne/vscode_projects/nodegx-community` — a **sibling directory, never nested** —
pushing to `The-Low-Code-Foundation/nodegx-community`. None of this checkout's gates, peers or
traps apply there.

---

# 🟢 E1 AND E3 ARE BUILT. THE LOOK IS HALF-BUILT. THE BOTTLENECK IS STILL RICHARD.

**Session 29 built the issuer (E1). Session 31 built UNI-019 (E3).** The home page is no longer a
menu of six things that do not click — it is the index archetype, showing real threads, with
`/bench` in the nav.

🔴 **And a stranger still cannot make an account, for the same small reason as three sessions ago:
there is no GitHub OAuth App.** `/api/auth/github/start` answers **503** with a plain sentence,
deliberately. **That is E10, it is Richard's, it is free, and it is one form.**

> ⚠️ **Do not "work around" it.** A dev-only issuer, a paste-your-token box, a seeded session in
> production — each is a back door, and `communitysession.ts` warns against exactly that shape in
> its own header. The correct state of a deployment with no credential is **503**.

## 🟢 THE ORDER FOR SESSION 32

**The design is an artifact:
["Every page is the same page"](https://claude.ai/code/artifact/5cc390dd-a8dc-48c9-b960-b74ed89010e6)
— open it before writing markup.** UNI-013's recorded failure applies to every task in this group:
session 24 built slices 2–3 from a task file's prose, never opened the artifact, and Richard's
reaction was *"I don't see the visual changes from the artifact"*.

1. 🔴 **E4 — UNI-013 slice 5's remainder. START HERE. It is now the largest remaining code item and
   the only one in the close that is code.**
   ✅ **Session 31 landed the *index* archetype and three of the four components** — `CardView`
   (with a figure slot), `EmptyState`, `Chip`, plus `Rail` — in
   `nodegx-community/src/components/Home.tsx`, written to be re-cut rather than copied.
   🔴 **What remains is the bigger half:**
   - the **list** archetype over `/tutorials`, `/replays`, `/people`, `/rfps`, `/coaching`,
     `/bench` — six pages that are all still `ul.listing` of bordered rectangles;
   - the **detail** archetype — ⚠️ **`/u/[handle]` already IS one. Copy it**; it is the one page
     anybody drew a picture of before building, which is why it is the one page that looks designed;
   - the **facet bar**, which is **[UNI-023](UNI-023-ONE-FACET-BAR-SIX-LISTS.md)'s** — slice 5 draws
     it, UNI-023 wires it.
   ⚠️ **DO NOT BUILD A FOURTH CARD COMPONENT.** The kit exists now. A page that declares its own
   rectangle is precisely the failure slice 5 is for.
2. ⚠️ **[UNI-023](UNI-023-ONE-FACET-BAR-SIX-LISTS.md) next if the look work continues** — five
   pages wait on the same bar and two pill styles already exist.
3. **UNI-001 AC2's launcher affordance** — small, and see session 29's honest gap (D) below.
4. **E2 — deployment**, once Richard answers E5.

⚠️ **[UNI-020](UNI-020-A-TUTORIAL-THAT-SAYS-WHAT-IT-TEACHES.md),
[UNI-021](UNI-021-REPLAYS-YOU-CAN-ACTUALLY-WATCH.md) and
[UNI-022](UNI-022-THE-SYLLABUS-PUBLISHED.md) are deliberately OUTSIDE the close** — see the
README's *"explicitly NOT in the close"*. **The close list is still ten items.**

---

# 🔴 CHECK THIS HANDOVER'S PREMISES — AND THIS ONE CORRECTS TWO OF ITS OWN PREDECESSORS

Session 29 verified session 28's three central claims before writing code and all three held.
Session 31 verified session 30's central claim — *"six cards, zero anchors"* — and it held exactly.
**Two greps, before any code, every time.**

🔴 **But session 31 also measured two inherited numbers and found both wrong. Neither was a lie;
both were measured under conditions nobody recorded.** See §Gates. In short:

| Inherited claim | Measured, session 31 |
|---|---|
| *"the platform suite is ~8s per test, a full run is the better part of an hour"* | **229 seconds.** Twice, back to back, on a quiet machine |
| *"745 across 26 files"* (the union of two runs; a clean single run was owed) | ✅ **Confirmed by one clean run — 745 / 26 / exit 0** — then **773 / 27** after this session's work |

**The general move both times: re-measure the floor yourself, in the same session, before you change
anything.** A number quoted from a handover is a number measured under somebody else's load.

---

# WHERE THE PHASE IS — 2026-08-18 (session 31)

| In the close? | Item | State |
|---|---|---|
| ✅ **E1** | **UNI-001's issuer** | ✅ **BUILT (s29).** Sessions minted, GitHub OAuth, device flow for the editor, sign-out revokes. ⚠️ **AC2's launcher affordance still owed; AC4's grep needs a verdict** |
| ✅ **E3** | **UNI-009 AC1** — home shows real threads signed out | ✅ **MET (s31), `nodegx-community@636d488`.** Both arms: real threads signed out, **and** every rail still renders with `bench_threads` empty (the D16 arm) |
| 🔴 **E10** | **A GitHub OAuth App** | 🔴 **Richard's, and the first domino.** Without it nobody can make an account, which is the criterion's first verb |
| 🎯 **E4** | **UNI-013 slice 5 — the pages** | 🟡 **PARTLY BUILT (s31): the index archetype + 3 of 4 components.** 🔴 **The list archetype over six pages, the detail archetype, and the facet bar remain.** Richard has said *"sad"* three times |
| 🎯 **E2** | **deployment** | 🔴 **Owned by no task.** Blocked on Richard (E5) |
| 🆕 **out** | UNI-020 · UNI-021 · UNI-022 · UNI-023 | **SCOPED s30, explicitly NOT in the close.** The content half — routes, schema, filters. 🔴 **Slice 5 alone will not answer Richard's complaint**, because its own scope forbids exactly this half |
| ✅ done | UNI-001 E1, 002–006, 009 cut, 011 s1–s2b, 013 s1–s3, 014, 015, 016, **019** | |
| ⛔ **out** | UNI-017 · UNI-018 · UNI-007 intake · UNI-006 bridge · UNI-011 views · UNI-008 · UNI-010 · UNI-012 · UNI-013 s4 | See the README's *"explicitly NOT in the close"* |

---

# 🔴 SESSION 31's FINDINGS

### A. A page's MARKUP is outside every gate — and two of them were, not one

`src/app/page.tsx` was **six `<section class="card">` with zero anchors inside any of them**, and it
passed `tsc`, `next build`, `check:css`, the per-theme contrast suite and **745 specs for five
days**. Every suite in that repo quantifies over **module exports**, **database rows** or **route
handlers**. **None of them could see what a page renders.**

✅ **The fix, and it is reusable for slice 5:** make the composition a **value**
(`src/lib/home.ts` — `homeRails(sql, {asOf})`, with `href` a **required field**, so a card with
nowhere to go does not typecheck), make the components **synchronous and prop-taking**, and leave
`page.tsx` as three lines of glue. Then `tests/uni019-home.test.tsx` renders the **real components**
with the **real composition** against a real database and reads the HTML back.

🔴 **THE SWEEP FOUND A SECOND SURFACE NOBODY HAD LOOKED FOR: `/orgs/[slug]/assignments` was
reachable from nowhere in the entire application.** UNI-006 built assign, grade and review; the only
way in was typing the URL. Same defect as `/bench`, one surface over, and unlike `/bench` **nobody
had noticed**. Fixed with one anchor. **That is what a computed reachability table buys over a fixed
list**, and it is now a standing gate: a page added later fails that suite until somebody gives it a
way in.

### B. Three mechanics that will each cost you a cycle when you write slice 5's tests

1. 🔴 **A `.tsx` test file is INVISIBLE to `include: ['tests/**/*.test.ts']`.** Vitest reports the
   files it *ran* and says nothing about one it never matched — **the suite stays green while the
   criterion is ungraded.** Already widened to `*.test.{ts,tsx}`; do not narrow it back.
2. 🔴 **`esbuild: { jsx: 'automatic' }` in `vitest.config.ts` is load-bearing.** `tsconfig.json` says
   `jsx: "preserve"` because Next's compiler wants it untransformed; vitest's esbuild pass is not
   Next's compiler and dies with **`React is not defined`** at the first element. Already added.
3. ⚠️ **React escapes entities.** `Tutorials & tips` renders as `Tutorials &amp; tips`, so a
   `toContain` on the copy fails — and the tempting fix is to reword the *product* copy until the
   test passes, which is the test editing the product. Decode before asserting; `textOf()` in that
   file does it.

### C. Reachability must come from the LINK GRAPH, not from the path

🔴 **The first version of `reachability()` inferred a detail page's index from its PATH PREFIX and
was wrong.** `/u/[handle]`'s index is `/people` — not its parent directory, and never will be. It
**passed on sixteen of seventeen routes**, which is exactly how a plausible instrument survives
review. It now walks breadth-first from the nav and the home, following the hrefs each page's
**source** actually contains, with `${…}` in a template href collapsed to a wildcard segment.

⚠️ **Templated hrefs are the whole reason it reads source rather than rendered output** — `/people`
links to a profile only when somebody is listed, so a rendered-only sweep calls `/u/[handle]`
unreachable on an empty database and reachable on a seeded one. **Reachability is a property of the
app, not of today's rows.**

⚠️ **Next's build output lists `route.ts` endpoints beside pages.** `/unsubscribe/[token]` appearing
there is **not** a page missing from your walk — check the filename before believing you have a hole.

### D. ⚠️ THE SEED HAD NO BENCH THREADS AT ALL, so every prior visual review saw an empty forum

Session 31 committed three (one accepted, each with a `node_excerpt` attachment so the node chips
render). 🔴 **`npm run db:seed` before you look at anything** — reviewing an empty page produces a
list of fixes that change nothing, which is UNI-013 slice 5's own method note.

⚠️ **This supersedes session 30's machine-state note** that bench threads were written "straight in
SQL and NOT committed". They are committed now.

### E. Two gaps carried forward, stated rather than buried

1. 🔴 **NOBODY HAS LOOKED AT ANY PAGE IN THE LIGHT THEME.**
   `--force-prefers-color-scheme=light` does **not** move the theme stamp's `matchMedia` read, so
   headless screenshots are always dark. Light is graded by the contrast **arithmetic** only — which
   is the stronger instrument, but it is not a look. ⚠️ **Slice 5 touches six pages; do not let this
   ride again.** To see it: set `localStorage['nodegx-theme'] = 'light'` in a real browser.
2. ⚠️ **The weekly-call date is PROJECTED, not stored.** There is no events table, so the home says
   *"next expected Wed 19 Aug"*, derived from the cadence of the calls that actually happened.
   Printing a scheduled date as fact would be the page asserting what the database does not know.
   An events table is the design's wave 2.

---

# 🔴 WHAT SESSION 30's FINDINGS LOOK LIKE NOW — two fixed, two open

Session 30's finding B listed four things that read as design problems and are not. Updated:

1. ✅ **FIXED (s31).** ~~The home cards are not links.~~ Every card region carries an anchor and
   every href resolves to a route on disk, asserted both ways with a known-firing control.
2. ✅ **FIXED (s31).** ~~`/bench` is unreachable.~~ It is first in the nav.
3. 🔴 **STILL OPEN.** `articles.body` is populated and there is **no `/tutorials/[slug]`** — the
   prose is written and there is nowhere to read it. **It is [UNI-020](UNI-020-A-TUTORIAL-THAT-SAYS-WHAT-IT-TEACHES.md)'s,
   by name.** ⚠️ Which is why the home's *Start here* card points at `/tutorials` and not at a
   detail page: **one href for UNI-020 to re-point**, rather than a card that lies.
4. 🔴 **STILL OPEN.** `replays` cannot be embedded — the table is a bare URL with no provider, id or
   duration, and the seeded URLs are `example.invalid`. **UNI-021's.** ⚠️ Which is why the home's
   replay card links to `/replays` rather than to `videoUrl`.

**Session 30's finding C still stands and is worth repeating:** signing in adds a handle to the
header and unlocks the org pages. **Every remaining look complaint is identical signed in.**

---

# ⚠️ FOR RICHARD — the asks, unchanged, and the first is still first

1. 🔴 **E10 — a GitHub OAuth App. Cheapest, and the first domino.** Homepage
   `https://community.nodegx.io`, callback **`https://community.nodegx.io/api/auth/github/callback`**.
   ⚠️ **Byte for byte** — GitHub reports a mismatch as `redirect_uri_mismatch` *without saying which
   side is wrong*. Set `GITHUB_OAUTH_CLIENT_ID` and `GITHUB_OAUTH_CLIENT_SECRET`. Without them
   **nobody can make an account**. ⚠️ Intersects E5/E2 — the callback has to point at wherever the
   platform is actually served.
2. 🔴 **E5 — does the platform go on nexus-1?** Still the domino behind deployment (E2) → the smoke
   drive (E9). **E10 needs its answer too.**
3. 🔴 **E6 — a transactional sending account + domain.** **D19 was ruled *on the condition* that
   email lands.** `log` delivery covers dev and cannot ship.
4. **E7 — where capture images live.** Cheap, genuinely deferrable; nothing migrates whenever it is
   decided.

⚠️ **A fifth, new and small: `nodegx-community` `main` is AHEAD 2 AND UNPUSHED** — session 31's
`636d488` and session 30's `df61abc`. Two consecutive sessions have not pushed, so this is not an
oversight to fix silently; **it is a call.**

**Not in the close, still open:** the twelve badge artworks (UNI-013 slice 4) · a Paddle account
(D7) · GitHub Pages unattached · the F4 packaged-install scope call (UNI-012) · UNI-006's three
calls, UNI-005's two, UNI-004's D8-bar question, UNI-003's catalogue change.

🔴 **And the decision that arrives at the close:** UNI-017, UNI-018, UNI-007's intake, UNI-006's
bridge, UNI-011's views, UNI-008, UNI-010 and UNI-012 become **a phase 67b or fold into phase 68**.
Richard's call, made deliberately rather than by drift.

---

# Gates — MEASURED 2026-08-18, session 31

**`nodegx-community`, and every number below is from a clean single run on a quiet machine:**

| | Before any edit | After |
|---|---|---|
| vitest | **745 passed / 26 files / exit 0** | ✅ **773 passed / 27 files / exit 0** |
| wall clock | **230s** | **229s** |

✅ **The delta reconciles exactly: +20** (`tests/uni019-home.test.tsx`) **+8** (4 new contrast pairs
× 2 themes) **= 28. Nothing existing moved**, which is UNI-019 AC5's control. File count reconciled
against `ls tests/*.test.ts*` **both times**.

`tsc --noEmit` clean · `next build` exit 0 · `check:css` clean over **1083 declarations /
22 components** (was 1008 / 21).

🔴 **THE SUITE IS FOUR MINUTES, NOT AN HOUR — CORRECTING A STANDING CONSTRAINT.** Every prior
handover has said *"roughly 8 seconds per test, a full run is the better part of an hour"*. That was
measured **under load the measuring session had created itself** — session 29 says so in its own
words (*"per-test times went from ~8s to ~400ms"* on the quiet re-run) and then carried the ~8s
figure forward as the standing number anyway. **On a quiet machine it is 229 seconds.** ⚠️ **The
load lesson is still completely true** — do not start a build or a second suite beside it, and
`uni015-bench-http.test.ts` spawns `next start` against `.next`, so rebuilding mid-run swaps the
artefact under a running spec. **But budget four minutes, not an afternoon**, and stop treating a
full run as too expensive to take a floor with.

⚠️ **A drive, over real HTTP, on the seeded database** (`next build` → `next start` → curl): **8
card regions, 23 anchors, all four rails, every internal href 200.** The one non-200 is
`/api/auth/github/start` → **503**, which is E1 correct and E10 outstanding, in one line. Stylesheet
served **200 / 40,475 bytes** — the stale-CSS trap checked, not assumed.

⚠️ **`grep -cE "[○ƒ] /"` on the build output is NOT a stable route count.** It has reported 24
(s27), 26 (s28) and 34 (s29) — and most of that drift is the counting method, not the surface.
🔴 **Count it the same way twice before treating a change in this number as a change in the app.**
The honest count is `find src/app -name page.tsx` (**17 pages**) and `-name route.ts` separately.

**This checkout:** ⚠️ **NOTHING WAS RUN.** Session 31 touched no editor source — no `test:main`, no
`test:ci`, no `tsc`. 🔴 **This session's evidence says nothing about either editor baseline.** The
last measured editor floor is session 29's; re-measure before quoting it.

---

# 🔴 THE MACHINE'S STATE — measured 2026-08-18 17:0x, session 31

| Port | What | Do what with it |
|---|---|---|
| 🔴 **3111** | A `next-server` **~17 hours old**, orphaned (**PPID 1**, parent `npm run start`), from session 28's slice-5 review | 🔴 **KILL IT BEFORE YOU REVIEW ANY LOOK, or ignore it completely.** **Measured, not inherited:** it references `/_next/static/css/5c1e1b5e5c220d35.css` which answers **400**, *and* its home page has **zero `data-home-card` regions** — it is serving the **pre-UNI-019 page, unstyled**. ⚠️ **Anybody who reviews on this port will conclude UNI-019 did not work.** Left running because it is not known to be ours |
| ✅ 3000 · 3117 · 3222 | nothing listening | Session 31's own server was stopped. Start your own |

✅ **Kill by port, never by name:** `lsof -nP -iTCP:<port> -sTCP:LISTEN -t`. 🔴 **`pkill -f "next
start"` matches NOTHING** — the process is `next-server`.

✅ **Postgres:** `nodegx-community-db` up and healthy, **port 55432**.

## ✅ The local database is seeded, and the seed is now honest

`npm run db:seed` covers people, profiles, RFPs, coaching, replays, articles — **and, since session
31, three bench threads** with an accepted answer and node attachments. ⚠️ It also mints **dev
session tokens** (`dev-session-ada` / `-tom` / `-nia` / `-teacher` / `-pupil`) usable as
`Cookie: nodegx_session=dev-session-nia`, which is how the signed-in header is checked without an
OAuth app.

---

# Standing constraints

- Editor work on `cline-dev`. 🔴 **Never `git stash`** — ⚠️ there is a stash that is not yours.
  ✅ **`git commit <pathspecs>`, never stage broadly.** Untracked files need `git add` — put add and
  commit in **one chain**. ⚠️ **Peers always have uncommitted work here** — re-read `git status`,
  never a handover's list. (Session 31 found three peer-modified files at start and left all three.)
- ✅ **`npm --prefix packages/noodl-editor run test:main -- <path>`** — jest from the repo root
  silently picks the wrong config.
- 🔴 **Port 55432 for the platform's Postgres, never 5432.**
- 🔴 **BSD `xargs` has no `-r`.**
- ⚠️ **The platform suite is ~4 minutes** (see §Gates — this corrects every prior handover).
  **Do not start a build or a second suite while it runs**; that is what made it look like an hour.
- 🔴 **Do not edit sources while a suite is in flight.** Vitest imports a module when it reaches the
  file, so a mid-run edit gives results you cannot attribute to either version. ✅ Session 31's
  pattern: start the baseline, write only **new** files while it runs, edit existing ones after.

# Things the next person will otherwise re-derive

**Platform:**

- 🔴 **A new route under `src/app/api` needs a RECIPE** in `tests/uni011-mirror-api.test.ts` or that
  suite fails — it derives the route list from disk. E1's six all carry `gatedByD15: false` with a
  reason: **signing in is not the community surface**, and gating it would mean an org-minor could
  not sign in at all, which is a different ruling from the one D15 made.
- 🔴 **A new PAGE now needs a way in**, or `tests/uni019-home.test.tsx` fails it as `UNREACHABLE`.
  That is deliberate. Give it a link, or add it to `NON_BROWSABLE` **with a reason** — the list is
  an exception list, not a coverage list.
- 🔴 **A new free-text column needs a CLASSIFICATION** in `tests/uni005-data-inventory.test.ts`, and
  the non-vacuity floor moves with it (currently **92**).
- 🔴 **A new colour PAIRING needs a row** in `tests/uni013-contrast.test.ts` — not just a new colour
  *role*. A familiar-looking pair on a new ground is still ungraded; that is the fifth instance of
  that defect on this phase.
- 🔴 **Never generate DDL from `src/db/schema.ts`** — but a new table must still be declared there,
  because the drift spec compares columns.
- ⚠️ `originIsSecure()` reads the **scheme**, never `NODE_ENV`. `next start` on a laptop runs with
  `NODE_ENV=production`, so a `NODE_ENV` test would put `Secure` on a cookie served over plain HTTP
  — browsers drop it silently, and the symptom is a sign-in that appears to work and does not.
- ⚠️ **Two `set-cookie` headers need `Headers.append`, not `set`.**
- ⚠️ **`freshDb()` calls `resetApiSql()` first** — a cached pool outlives the schema it resolved, and
  specs then pass unrun. Do not add a second module-level pool without the same treatment.

**Editor:**

- 🔴 **`expect(value, message)` is VITEST. This checkout is JEST.** Put the failing value *inside*
  the assertion.
- 🔴 **No DOM and no React in this checkout's jest runner.** ⚠️ **The platform repo is the opposite
  now** — vitest renders React fine there (see finding B). Do not carry the constraint across.
- ⚠️ **`test:main` collects its file list at start.** Reconcile the suite count.
- ⚠️ **Running the two `uni-001` spec files together prints *"a worker process has failed to exit
  gracefully"*.** Each file alone is clean, two pre-existing suites in the same family are clean,
  and `--detectOpenHandles` reports **no handles**. Both files pass either way. **Not chased;
  recorded so the next person does not re-derive it.**

**Both:**

- 🔴 **`/usr/bin/grep -a`, always.** Plain `grep` here is ugrep and silently skips `.ts` as binary.
- 🔴 **`forEachNode` STOPS on a truthy return.** Use a block body.

---

# 🔴 SESSION 29's FINDINGS — still live, kept in full

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

⚠️ It is also an absence-assertion shape from the other side: *revoked nothing* and *revoked
successfully* were the **same 200**.

### B. Two decisions were FORCED by UNI-001's own scope, and reading them as choices will waste a session

1. **The device flow, not a loopback listener and not a `nodegx://` handler.** UNI-001's scope says
   *"no listener is opened"* — that kills the loopback redirect outright — and a protocol handler is
   an OS registration a dev build, a portable build and a second install all fight over, with the
   winner receiving a URL containing a live credential. ⚠️ **This is NOT D19's struck "browser
   handoff ticket" returning**; that one handed an editor session to *Discourse*, and there is no
   Discourse. The argument is written into `0010`'s header where it cannot be lost.
2. **GitHub only; no email/password.** The scope asks for both and for *password reset* — and
   **nothing on this platform sends mail** (E6, the condition D19 was ruled under). A password flow
   whose reset arm cannot be delivered locks people out. `accounts` grew no `password_hash`.

### C. The site is entirely server-rendered, and that is a deliberate cost

`cookies()` in the **root layout** opts the whole app out of static generation: `next build` reports
**every route as `ƒ`**. A signed-in header cannot be a static file, and the alternative — rendering
the chip client-side from `/api/v1/me` — trades it for a flash of the wrong state on every
navigation. ⚠️ **Recorded so it is not read as a regression.** If a page ever genuinely needs static
delivery, move the read into a client island; do not stop reading it.

### D. An honest gap: UNI-001 AC4's grep needs a verdict rather than a run

AC4 asks that *"reads of the session outside the launcher/account module come back empty"*. The
composer reads it — which **UNI-016 made true before session 29** — and is arguably exactly what the
criterion means to permit. 🔴 **It needs re-wording or a ruling. Do not report it as passing**, and
do not delete it: the principle it protects (*the editor is fully functional signed out, forever*)
is one of the phase's two.

---

# ⚠️ TWO SESSIONS ONCE WORKED THIS LANE AT ONCE, AND ONE OVERWROTE THE OTHER'S NOTE

**Kept because the silent version of this is how a shared checkout rots.** A peer session committed
24 lines onto this file; the next session rewrote the whole file with `cat >` and discarded them —
not a decision, a side effect.

✅ **Two things to carry forward:**
1. **A wholesale `cat >` over a shared file is a merge you did not perform.** Re-read the file
   immediately before writing it, or patch the sections you mean to change. ✅ Session 31 rewrote
   this file, and checked `git log` + `git status` + mtime on it first to confirm it was still the
   last committer.
2. 🔴 **Do not `pkill` by a pattern as broad as a test runner's name** — expect somebody else's run
   to be what you hit.

✅ **Session 31's lane check:** five peer sessions were live on this machine; one was named
`comcoi-v2-65` and was asked directly. It answered that it is scoped to a **different repo**
(`comcoi-v2`) and had no phase-67 work queued. **The `nodegx-community` tree was clean and untouched
for three hours.** Ask, do not assume — and ask the peer, not the tree.
