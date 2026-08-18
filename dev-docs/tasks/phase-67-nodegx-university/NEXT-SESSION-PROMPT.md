# Phase 67 — next session prompt

Paste the block below into a fresh session.

---

Continue phase 67 (NodeGX Community), `dev-docs/tasks/phase-67-nodegx-university/`.

**Read first, in this order:** **[README.md](README.md) §"What closes this phase"** — the alpha
bar, **ten items** — then §"WHERE THE PHASE IS" below, then `TASKS.md`'s table, then your task file.

🔴 **Two repos.** Editor work is this checkout. Platform work is
`/Users/richardosborne/vscode_projects/nodegx-community` — a **sibling directory, never nested** —
pushing to `The-Low-Code-Foundation/nodegx-community`. None of this checkout's gates, peers or
traps apply there.

---

# 🟢 THE CLOSE IS RICHARD'S NOW — THERE IS NO CODE ITEM LEFT IN IT

Session 33 built E1's last owed piece and closed E8. **Session 34 settled AC4, which was the only
editor work the close still named — and it needed a ruling, not a run.** Everything remaining in
the ten items is E2, E5, E6, E7, E9, E10: a deployment decision, a form, a domain, and a smoke
drive that needs the first three.

🔴 **A stranger still cannot make an account, for the same small reason as six sessions ago: there
is no GitHub OAuth App.** `/api/auth/github/start` answers **503** with a plain sentence,
deliberately. **That is E10, it is Richard's, it is free, and it is one form.**

> ⚠️ **Do not "work around" it.** A dev-only issuer, a paste-your-token box, a seeded session in
> production — each is a back door, and `communitysession.ts` warns against exactly that shape in
> its own header. The correct state of a deployment with no credential is **503**.

## 🟢 THE ORDER FOR SESSION 35

1. **[UNI-023](UNI-023-ONE-FACET-BAR-SIX-LISTS.md) is the cheapest remaining build, and it got
   cheaper on 08-18.** It wires **search, sort and the price bands** into the facet bar. 🔴 **Its
   node filter wanted a closed vocabulary and UNI-020 built one** — `article_nodes` is a table
   with an index, and `tutorialsList` already filters on it. ⚠️ **Do not draw a second pill
   style**: `.facet` is the one component and **seven** pages now share it.
2. **[UNI-021](UNI-021-REPLAYS-YOU-CAN-ACTUALLY-WATCH.md)** or
   **[UNI-022](UNI-022-THE-SYLLABUS-PUBLISHED.md)** if content is the priority instead. ⚠️ Both,
   like UNI-020, are **deliberately OUTSIDE the close** — see the README's *"explicitly NOT in the
   close"*. **The close list is still ten items.**
3. ⚠️ **A look, in the LIGHT theme, in a real browser.** Now three sessions overdue and the one
   thing no instrument here substitutes for. `localStorage['nodegx-theme'] = 'light'`.

---

# 🔴 CHECK THIS HANDOVER'S PREMISES — BEFORE ANY CODE, EVERY TIME

Session 34 took its own floor in both repos and it mattered in both directions: **the editor's
floor was CLEANER than session 33's after-state** (a peer had fixed phase 69's red and added a
suite in between), and **the platform's floor matched session 33's after-state to the test**.

✅ **Quote the count or do not claim the run.** A number quoted from a handover is a number
measured under somebody else's load.

---

# WHERE THE PHASE IS — 2026-08-18 (session 34)

| In the close? | Item | State |
|---|---|---|
| ✅ **E1** | **UNI-001 — issuer + launcher** | ✅ **COMPLETE. AC4 settled s34** — the criterion was re-worded to the property it meant and is now a gate. **No editor code item is left in E1** |
| ✅ **E3** | UNI-009 AC1 | ✅ MET (s31), `nodegx-community@636d488` |
| ✅ **E4** | UNI-013 slice 5 | ✅ BUILT (s32), `nodegx-community@9df0445` |
| ✅ **E8** | `NOTIFICATION_LINK_SECRET` | ✅ CLOSED (s33), `10e05d4`. ⚠️ Richard must still **set the variable** |
| 🔴 **E10** | **A GitHub OAuth App** | 🔴 **Richard's, and the first domino.** Without it nobody can make an account |
| 🔴 **E2** | deployment | 🔴 Owned by no task. Blocked on Richard (E5) |
| 🔴 **E9** | the smoke drive on the deployed box | 🔴 Blocked on E2 |
| 🆕 **out** | **UNI-020 ✅ BUILT s34** · UNI-021 · UNI-022 · UNI-023 | **NOT in the close.** UNI-020 landed because it was the cheapest thing that makes the site less of a placeholder |
| ✅ done | UNI-001, 002–006, 009 cut, 011 s1–s2b, **013 s1–s3 + s5**, 014, 015, 016, 019, **020** | 🔴 **013 slice 4 — the twelve badge artworks — is Richard's** |

---

# 🔴 SESSION 34's FINDINGS — four, and all four outlive their tasks

### A. AC4 was a WORDING defect, and two sessions had called it "needs a verdict" without giving one

*"`grep` the editor for reads of the session outside the launcher/account module comes back
empty"* has returned **one file since UNI-016** — the composer — before UNI-001 had an issuer at
all. 🔴 **A location test never expressed "gates nothing" and fails in both directions**: a read
*inside* the launcher could withhold a feature and stay invisible, while the composer's read
withholds nothing — it **chooses a transport** (post directly, or hand off to the browser, which
needs no account and is the signed-out **CTA**) and adds an offer.

✅ **Replaced by `tests-unit/uni-001/session-readers.test.ts`:** a reader set walked **from disk**
(`packages/*/src`, 2548 files, so a reader in a directory that did not exist is still caught),
each of four entries carrying **a reason that must answer *"what does this read withhold?"***, plus
**no capability inside a session branch** — with the signed-in post button as the **known-firing
control**, because a checker that cannot see a gate that IS there cannot be trusted to report its
absence. 🔴 **Proven to fail before it was believed**: an unlisted reader planted in *another
package* turned exactly one test red and named the file.

⚠️ **What it cannot prevent** is somebody adding a row to turn the suite green. The assertion says
so in its own comment, which is where that person will be looking.

### B. 🔴 THE FREE-TEXT CENSUS WAS BLIND TO ARRAY-TYPED COLUMNS

`tests/uni005-data-inventory.test.ts` selects columns whose `data_type` is `text`/`jsonb`/etc.
**A `text[]` reports as `ARRAY`** with the element type in `udt_name`, so `articles.outcomes` was
invisible — and the census reported the classification as **stale** rather than grading it, which
reads like *"delete this row"*. ✅ Widened, floor **94 → 108**. 🔴 **It had caught nothing before
only because no array column existed anywhere in the schema**: the day somebody adds `tags text[]`
to a table a pupil can write, that silence would have been the answer.

### C. The DRIVE caught what no spec would have

The level printed **twice** on the new tutorial page — in the meta line and again as a chip two
lines below — with **every suite green**. 🔴 **UNI-019's lesson, again: a page's markup is outside
every gate this repository has.** Curl the page and read it.

### D. A premise inside a task file is still a premise

UNI-020's scope said the route half was nearly free because *"the bodies are already written"*.
True of the **column**; false of the **content** — every seeded body was `'Placeholder body.'`.
Shipping the route alone would have put a literal placeholder page on a phase closing on *"does
not look like a placeholder"*. ⚠️ **And the first spec written against it went red on this task's
own comment describing the history** — a file that MENTIONS a defect is not a file that has one.

---

# Gates — MEASURED 2026-08-18, session 34

**This checkout (editor):**

| | Before any edit | After |
|---|---|---|
| `test:main` | ✅ **0 failed / 3816 passed / 3816, 249 suites** | ✅ **0 failed / 3826 passed / 3826, 250 suites** |

✅ **Delta: +1 suite, +10 tests, all this session's.** 🔴 **The floor was CLEANER than session
33's after-state** (1 failed / 3808 / 3809 across 248) — a peer fixed phase 69's `cn-002` red and
added a suite in between, which is exactly why the floor gets re-measured rather than quoted.
`npx tsc -p tsconfig.json --noEmit` **exit 0**. ⚠️ **`test:ci` was NOT run** — peers were live all
session, one of them mid-flight on CN-017 across ~20 editor source files.

**`nodegx-community`:**

| | Before any edit | After |
|---|---|---|
| vitest | **813 passed / 29 files / exit 0** (249s) | ✅ **847 passed / 30 files / exit 0** (298s) |

✅ **The floor matched session 33's after-state to the test.** ✅ **The delta reconciles per file:
+20** (uni020's spec), **+12** (six contrast pairings × two themes), **+2** (two new tables in the
drift check) — **nothing existing moved.** `tsc --noEmit` clean · `next build` exit 0 ·
`check:css` exit 0. ⚠️ **Driven over real HTTP**: five rows link, an unknown slug 404s, and
level/category/node each narrow the real page.

---

# 🔴 THE MACHINE'S STATE — measured 2026-08-18 ~20:30, session 34

| Port | What | Do what with it |
|---|---|---|
| ✅ **3210** | **`next start` LEFT RUNNING, STARTED AFTER THE SEED** — serving the real seeded site including the new `/tutorials/[slug]` | Yours. 🔴 **If you run `npm test`, RESEED AND RESTART IT** — the suite drops the schema and the running pool then 500s |
| 🔴 **3111** | a `next-server`, pid **62819**, now **~21 hours** old | 🔴 **STILL SERVING A PRE-UNI-019 PAGE.** Anybody reviewing a look on this port will conclude four sessions did nothing. Not known to be ours |
| ✅ 9222 | free | No editor stack was launched this session |

✅ **Kill by port, never by name:** `lsof -nP -iTCP:<port> -sTCP:LISTEN -t`. 🔴 **`pkill -f "next
start"` matches NOTHING** — the process is `next-server`.

✅ **Postgres:** `nodegx-community-db` up and healthy, **port 55432**. **Seeded at ~20:29**
(5 articles now, not 3). 🔴 **THE ORDER THAT ALWAYS WORKS: `npm test` → `npm run db:seed` →
`npm start -- -p <port>`.** Reseeding under a running server gives `cache lookup failed for type`,
`XX000`, which reads exactly like an application bug and is not one.

⚠️ **`nodegx-community` `main` is now AHEAD 5 AND UNPUSHED** — `df61abc`, `636d488`, `9df0445`,
`10e05d4`, **`767b670`**. **Five consecutive sessions have not pushed. It is a call, not an
oversight.**

⚠️ **A peer was mid-flight on phase 69's CN-017 all session** — ~20 modified editor sources and an
untracked `tests-unit/cn-017/`. Nothing of theirs was swept: every commit here used explicit
pathspecs. **Re-read `git status` yourself; never a handover's list.**

---

# Standing constraints

- Editor work on `cline-dev`. 🔴 **Never `git stash`.** ✅ **`git commit <pathspecs>`, never stage
  broadly**; untracked files need `git add` in the **same chain**.
- ✅ **`npm --prefix packages/noodl-editor run test:main -- <path>`** — jest from the repo root
  silently picks the wrong config.
- 🔴 **Port 55432 for the platform's Postgres, never 5432.** 🔴 **BSD `xargs` has no `-r`.**
- ⚠️ **The platform suite is ~4–5 minutes** and slower under load. Do not start a build beside it.
- 🔴 **Do not edit sources while a suite is in flight** — in either repo.

# Things the next person will otherwise re-derive

**Platform:**

- 🔴 **THE KIT IS `src/components/Kit.tsx`** — `ListView` + `src/lib/lists.ts` for a list,
  `DetailHead` for a detail, `Home.tsx` for the index. A page declaring its own `className="card"`
  fails `tests/uni013-slice5.test.tsx`, deliberately.
- 🔴 **A new PAGE needs a way in** (`tests/uni019-home.test.tsx`) **and a verdict in slice 5's
  archetype table**; **a new FACET needs a real count**; **a new API route needs a RECIPE** in
  `tests/uni011-mirror-api.test.ts`; **a new free-text column needs a CLASSIFICATION** in
  `tests/uni005-data-inventory.test.ts` (floor **108**, and it now sees `text[]`); **a new colour
  PAIRING needs a row** in `tests/uni013-contrast.test.ts`, with an **`over:`** if its ground is
  translucent.
- 🔴 **A facet's href carries ITS OWN dimension and nothing else** — that is what keeps the count
  beside it honest, because slice 5 runs every href back through the builder. ⚠️ **And
  `listAtHref` in that suite must learn any new parameter**, or every new count fails for the
  helper's fault rather than the code's.
- 🔴 **Never generate DDL from `src/db/schema.ts`** — but a new table must still be declared there,
  and the migration must be registered in `MIGRATIONS`.
- 🔴 **CHECK constraints, not enum types**, for a vocabulary that will grow: `alter type … add
  value` used in the same migration is **refused**, and this repo has hit it.
- ⚠️ `originIsSecure()` reads the **scheme**, never `NODE_ENV` — `next start` runs with
  `NODE_ENV=production` on a laptop.

**Editor:**

- 🔴 **D2's string has ONE owner: `noodl-core-ui/src/constants/communityCopy.ts`.**
- 🔴 **The launcher's host-state seam is `LauncherContext`**; `noodl-editor → noodl-core-ui` is the
  only import direction that exists.
- 🔴 **No DOM and no React in this checkout's jest runner** — a rendered surface can only be
  asserted by **source analysis with negative controls**, and then **driven**.
- 🔴 **`expect(value, message)` is VITEST. This checkout is JEST.**
- 🔴 **The session store is a PLAINTEXT FILE in `userData`**, not `localStorage`. UNI-001's scope
  says `0600`; **it is not** — `StorageNode` writes with the process umask, and narrowing it is a
  platform-layer decision.

**Both:** 🔴 **`/usr/bin/grep -a`, always** — plain `grep` here is ugrep and silently skips `.ts`
as binary.

---

# ⚠️ FOR RICHARD — the asks, unchanged and now the whole of the close

> 📋 **These are written out for him, in order, with the exact values and the two real decisions,
> in [CLOSING-THE-PHASE-RICHARDS-LIST.md](CLOSING-THE-PHASE-RICHARDS-LIST.md).** 🔴 **Read it
> before answering "what is left" — it is the one that splits *decisions* (his) from *work* (ours,
> and E2 is a build rather than a button: there is no Dockerfile, no CI and no `ops/`).**

0. 🟢 **Nothing below is waiting on code.** The sign-in loop was driven end to end on localhost in
   session 33; session 34 removed the last editor item the close named.
1. 🔴 **E10 — a GitHub OAuth App. Cheapest, and the first domino.** Homepage
   `https://community.nodegx.io`, callback **`https://community.nodegx.io/api/auth/github/callback`**
   — ⚠️ **byte for byte**; GitHub reports a mismatch without saying which side is wrong. Set
   `GITHUB_OAUTH_CLIENT_ID` and `GITHUB_OAUTH_CLIENT_SECRET`. Without them **nobody can make an
   account**.
2. 🔴 **E5 — does the platform go on nexus-1?** The domino behind E2 → E9. **E10 needs its answer
   too**, because the callback has to be where the platform is actually served.
3. 🔴 **E6 — a transactional sending account + domain.** D19 was ruled *on the condition* that
   email lands.
4. **Set `NOTIFICATION_LINK_SECRET` on the deployment** — one `openssl rand -base64 32`. Until it
   exists, **no notification email goes out at all**, which is E8 working as designed.
5. **E7 — where capture images live.** ⚠️ **It now blocks a second thing**: UNI-020's
   *"Download the starter project"* button is built and renders only when there is a URL, and
   **nothing can supply one** until artefacts have a home.
6. ⚠️ **`nodegx-community` main is ahead 5 and unpushed.** A call, not an oversight.
7. 🆕 **A look, in the LIGHT theme, in a real browser.** Every visual review of this site has been
   dark. Three sessions overdue.

**Not in the close, still open:** the twelve badge artworks (UNI-013 slice 4) · a Paddle account
(D7) · GitHub Pages unattached · UNI-012's scope call · UNI-006's three calls, UNI-005's two,
UNI-004's D8-bar question, UNI-003's catalogue change.

🔴 **And the decision that arrives at the close:** UNI-017, UNI-018, UNI-007's intake, UNI-006's
bridge, UNI-011's views, UNI-008, UNI-010 and UNI-012 become **a phase 67b or fold into phase 68**.
Richard's call, made deliberately rather than by drift.

---

# 🔴 EARLIER FINDINGS STILL LIVE

### `signOut` read the COOKIE only, and the editor sends a BEARER — *build the caller*, 11th (s29)

`signOut(sql, request)` revoked the session **cookie**, which audits clean on the page — but an
editor has no cookie jar scoped to our origin, so `signOutOfCommunity` would have received
**`200 {ok:true}` while revoking nothing**. ✅ Fixed by routing it through the same
`tokenFromRequest` the `/api/v1` surface uses. **When a module has two transports for one
credential, write the second transport's caller.**

### Two decisions were FORCED by UNI-001's own scope (s29)

1. **The device flow**, not a loopback listener and not a `nodegx://` handler — the scope says *"no
   listener is opened"*, and a protocol handler is an OS registration three installs fight over,
   with the winner receiving a URL containing a live credential.
2. **GitHub only; no email/password** — **nothing on this platform sends mail** (E6), and a
   password flow whose reset arm cannot be delivered locks people out.

### The site is entirely server-rendered, and that is a deliberate cost (s29)

`cookies()` in the **root layout** opts the whole app out of static generation: `next build`
reports **every route as `ƒ`**. ⚠️ Recorded so it is not read as a regression.

### A wholesale `cat >` over a shared file is a merge you did not perform

A peer session once committed 24 lines onto this file and the next session rewrote it with `cat >`,
discarding them. ✅ **`git log -5 -- <path>` and re-read immediately before writing**, or patch the
sections you mean to change.
