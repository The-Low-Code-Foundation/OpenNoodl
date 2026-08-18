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

# 🟢 EVERY CODE ITEM IN THE CLOSE IS NOW BUILT. WHAT IS LEFT IS RICHARD'S, PLUS TWO SMALL THINGS

**Session 29 built the issuer (E1). Session 31 built UNI-019 (E3). Session 32 built UNI-013 slice 5
(E4).** The site has three page archetypes and every page is an instance of one.

🔴 **And a stranger still cannot make an account, for the same small reason as four sessions ago:
there is no GitHub OAuth App.** `/api/auth/github/start` answers **503** with a plain sentence,
deliberately. **That is E10, it is Richard's, it is free, and it is one form.**

> ⚠️ **Do not "work around" it.** A dev-only issuer, a paste-your-token box, a seeded session in
> production — each is a back door, and `communitysession.ts` warns against exactly that shape in
> its own header. The correct state of a deployment with no credential is **503**.

## 🟢 THE ORDER FOR SESSION 33

1. **UNI-001 AC2's launcher affordance** — the sign-in card in the editor. 🔴 **It is now the only
   code item the close names that a task still owns**, and it is small. ⚠️ See session 29's honest
   gap (D) below: **AC4 needs a ruling, not a run** — do not report it as passing.
2. **E8 — `NOTIFICATION_LINK_SECRET` has a dev default**, so a deployment that does not set it has
   **forgeable unsubscribe links**. Hygiene, and a launch blocker rather than a nice-to-have.
3. ⚠️ **[UNI-023](UNI-023-ONE-FACET-BAR-SIX-LISTS.md) if the look work continues** — the facet bar
   is **drawn, on six pages, with real counts**; UNI-023 wires **search, sort and the price bands**
   `coaching_offers` can already support. 🔴 **Do not draw a second pill style**: `.facet` is the
   one component and the six pages already share it.
4. **E2 — deployment**, once Richard answers E5.

⚠️ **[UNI-020](UNI-020-A-TUTORIAL-THAT-SAYS-WHAT-IT-TEACHES.md),
[UNI-021](UNI-021-REPLAYS-YOU-CAN-ACTUALLY-WATCH.md) and
[UNI-022](UNI-022-THE-SYLLABUS-PUBLISHED.md) are deliberately OUTSIDE the close** — see the
README's *"explicitly NOT in the close"*. **The close list is still ten items.**

> 🔴 **UNI-020 has one concrete hook waiting for it.** `/tutorials` is **the only page on the site
> whose rows do not link**, because `articles.body` is written and `/tutorials/[slug]` does not
> exist. The row TYPE makes an unlinked row impossible without a recorded reason, and
> `tests/uni013-slice5.test.tsx` asserts the set of unlinked rows is **exactly that one page**. The
> day the route lands it is **one line** in `src/lib/lists.ts`, and the suite will then require it.

---

# 🔴 CHECK THIS HANDOVER'S PREMISES — TWO GREPS, BEFORE ANY CODE, EVERY TIME

Session 31 verified session 30's central claim before writing code and it held exactly. Session 32
verified session 31's two central claims — *"the platform suite is 229s"* and *"745 → 773 across 27
files"* — by **taking its own floor first**: **773 passed / 27 files / exit 0 in 248s**, matching
session 31's after-state to the test. **A number quoted from a handover is a number measured under
somebody else's load; take the floor yourself, in the same session, before you change anything.**

---

# WHERE THE PHASE IS — 2026-08-18 (session 32)

| In the close? | Item | State |
|---|---|---|
| ✅ **E1** | **UNI-001's issuer** | ✅ **BUILT (s29).** Sessions minted, GitHub OAuth, device flow for the editor, sign-out revokes. ⚠️ **AC2's launcher affordance still owed; AC4's grep needs a verdict** — that is item 1 above |
| ✅ **E3** | **UNI-009 AC1** — home shows real threads signed out | ✅ **MET (s31), `nodegx-community@636d488`** |
| ✅ **E4** | **UNI-013 slice 5 — the pages** | ✅ **BUILT (s32), `nodegx-community@9df0445`.** Three archetypes; six list pages are three lines of glue each; three detail pages share one head; the facet bar is drawn with **real counts** |
| 🔴 **E10** | **A GitHub OAuth App** | 🔴 **Richard's, and the first domino.** Without it nobody can make an account, which is the criterion's first verb |
| 🔴 **E2** | **deployment** | 🔴 **Owned by no task.** Blocked on Richard (E5) |
| 🔴 **E8** | `NOTIFICATION_LINK_SECRET` | 🔴 **Unclaimed and cheap.** Forgeable unsubscribe links without it |
| 🆕 **out** | UNI-020 · UNI-021 · UNI-022 · UNI-023 | **SCOPED s30, explicitly NOT in the close.** The content half — routes, schema, filters |
| ✅ done | UNI-001 E1, 002–006, 009 cut, 011 s1–s2b, **013 s1–s3 + s5**, 014, 015, 016, 019 | 🔴 **013 slice 4 — the twelve badge artworks — is Richard's and is the one slice that is not code** |
| ⛔ **out** | UNI-017 · UNI-018 · UNI-007 intake · UNI-006 bridge · UNI-011 views · UNI-008 · UNI-010 · UNI-012 | See the README's *"explicitly NOT in the close"* |

---

# 🔴 SESSION 32's FINDINGS — three of them outlive the pages

### A. `--theme-color-primary-bg` IS TRANSLUCENT, and the active filter pill has been ungraded since slice 1

Adding the pill's row to `tests/uni013-contrast.test.ts` did not fail the assertion. **It threw** —
`rgba(21, 112, 239, 0.09)` is not a six-digit hex, and a luminance function takes one. What a reader
sees is the wash **composited over whatever is beneath it**, and *what is beneath it* is a fact
about the LAYOUT that a colour token cannot carry.

✅ The suite grew a `flatten(value, under)` and an **`over:`** field naming the opaque surface.
🔴 **A row whose ground is translucent and names no underlay now FAILS LOUDLY rather than being
skipped** — a pairing nobody could grade is the one that ships.

🔴 **AND THE RULE THE SAME SLICE PROVED TWICE: the trigger for a new contrast row is a new PAIRING,
never a new colour ROLE.** Both gaps found were pairs whose halves were each already graded:

- the active pill (**shipping ungraded for a week**; slice 5 did not introduce the pairing, it
  introduced the row);
- `.chip-accent`'s label — accent on `bg-3`, graded only at **3:1**, because the sole row for that
  pair was the *poster play mark*, which is a triangle. The chip carries words.

⚠️ *"We added no new colours"* is the sentence that hides this.

### B. A link sweep that follows a page into a SHARED module must scope by FUNCTION

Slice 5 moved every list page's hrefs into one `src/lib/lists.ts`. A sweep reading only `page.tsx`
calls six pages dead ends; **a sweep reading the whole module reports `/coaching` as "linked from
/tutorials"** — an instrument that launders a dark branch into a lit one, which is exactly what
UNI-019's reachability control exists to catch. ✅ The page's own `import { peopleList } from
'../lib/lists'` names the functions it calls; read only those bodies.

⚠️ The instrument now lives in **`tests/helpers/routes.ts`** and both suites use it. **Do not copy
it into a third file** — two definitions of "an href resolves" agree until one of them is fixed.

### C. A same-page FRAGMENT href is invisible to every route check in the repo

`resolvesTo` strips the fragment before comparing, so `/replays#nothing` and `/replays` are the same
route. `/replays` links its rows that way, because a replay has no page of its own until UNI-021.
✅ The rows now carry the `id`, and the suite asserts **every same-page fragment lands on an
element** — with a control that renders the same card without one.

### D. ⚠️ NOBODY HAS STILL LOOKED AT ANY PAGE IN THE LIGHT THEME

Unchanged from session 31, and slice 5 touched nine pages. `--force-prefers-color-scheme=light` does
**not** move the theme stamp's `matchMedia` read, so headless screenshots are always dark. Light is
graded by the contrast **arithmetic** only — the stronger instrument, and not a look. To see it: set
`localStorage['nodegx-theme'] = 'light'` in a real browser.

---

# Gates — MEASURED 2026-08-18, session 32

**`nodegx-community`:**

| | Before any edit | After |
|---|---|---|
| vitest | **773 passed / 27 files / exit 0** | ✅ **805 passed / 28 files / exit 0** |
| wall clock | **248s** | **316s** ⚠️ slower because a wait-loop and a build ran beside it — the load lesson still holds |

✅ **The delta reconciles exactly: +21** (`tests/uni013-slice5.test.tsx`) **+11** (5 new contrast
pairs × 2 themes + the `flatten` control) **= 32. Nothing existing moved**, which is UNI-013 AC5's
own control. File count reconciled against `ls tests/*.test.ts*` both times.

`tsc --noEmit` clean · `next build` exit 0 · `check:css` clean over **1107 declarations /
23 components** (was 1083 / 22).

⚠️ **A drive, over real HTTP, on the seeded database** (`next build` → `next start -p 3210` → curl):
the six list pages and three detail pages all **200**, filters real (`/people?for=coaching` → 1 card,
`/bench?section=meetups` → 0 with the **no-match** state, `/tutorials?kind=tip` → 1), **28 internal
hrefs swept and every one 200**. The one non-200 is `/api/auth/github/start` → **503**, which is E1
correct and E10 outstanding, in one line. Stylesheet **200 / 41,451 bytes** — the stale-CSS trap
checked, not assumed.

**This checkout:** ⚠️ **NOTHING WAS RUN.** Session 32 touched no editor source — no `test:main`, no
`test:ci`, no `tsc`. 🔴 **This session's evidence says nothing about either editor baseline.**
Re-measure before quoting one.

---

# 🔴 THE MACHINE'S STATE — measured 2026-08-18 17:3x, session 32

| Port | What | Do what with it |
|---|---|---|
| 🔴 **3111** | The `next-server` — **`etime` 17:55:05, i.e. ~18 hours**, pid 62819, measured not inherited (session 32) | 🔴 **STILL RUNNING, AND IT SERVES THE PRE-UNI-019 PAGE WITH A 400 STYLESHEET.** Anybody who reviews a look on this port will conclude the last two sessions did nothing. Kill it or ignore it; left because it is not known to be ours |
| ✅ 3210 | session 32's own server | **Stopped** (`lsof -nP -iTCP:3210 -sTCP:LISTEN -t` → empty). Start your own |

✅ **Kill by port, never by name:** `lsof -nP -iTCP:<port> -sTCP:LISTEN -t`. 🔴 **`pkill -f "next
start"` matches NOTHING** — the process is `next-server`.

✅ **Postgres:** `nodegx-community-db` up and healthy, **port 55432**. The local database is seeded
(`npm run db:seed`), including three bench threads with an accepted answer and node attachments.
⚠️ It also mints dev session tokens (`dev-session-ada` / `-tom` / `-nia` / `-teacher` / `-pupil`),
usable as `Cookie: nodegx_session=dev-session-nia`.

⚠️ **`nodegx-community` `main` is now AHEAD 3 AND UNPUSHED** — `df61abc` (s30), `636d488` (s31),
`9df0445` (s32). **Three consecutive sessions have not pushed. It is a call, not an oversight.**

---

# Standing constraints

- Editor work on `cline-dev`. 🔴 **Never `git stash`** — ⚠️ there is a stash that is not yours.
  ✅ **`git commit <pathspecs>`, never stage broadly.** Untracked files need `git add` — put add and
  commit in **one chain**. ⚠️ **Peers always have uncommitted work here** — re-read `git status`,
  never a handover's list. (Session 32 found peer edits across phase-69 and left all of them.)
- ✅ **`npm --prefix packages/noodl-editor run test:main -- <path>`** — jest from the repo root
  silently picks the wrong config.
- 🔴 **Port 55432 for the platform's Postgres, never 5432.**
- 🔴 **BSD `xargs` has no `-r`.**
- ⚠️ **The platform suite is ~4 minutes on a quiet machine** and stretches to ~5½ with anything
  beside it. **Do not start a build or a second suite while it runs.**
- 🔴 **Do not edit sources while a suite is in flight.** ✅ Session 32's pattern: start the baseline,
  write only **new** files while it runs, edit existing ones after.

# Things the next person will otherwise re-derive

**Platform:**

- 🔴 **THE KIT IS `src/components/Kit.tsx` AND IT IS THE ANSWER TO "how do I build a page here".**
  `ListView` + `src/lib/lists.ts` for a list, `DetailHead` for a detail, `Home.tsx` for the index.
  🔴 **A page that declares its own `className="card"` fails `tests/uni013-slice5.test.tsx`**, which
  is deliberate: *"a component earns its place by being used on three pages or more; everything else
  stays in the page that needs it."*
- 🔴 **A new PAGE needs a way in** (`tests/uni019-home.test.tsx`) **and a verdict in slice 5's
  archetype table** — either it is an instance, or it is on `OUTSIDE_SLICE_5` **with a reason**.
  Both lists are exception lists, not coverage lists.
- 🔴 **A new FACET needs a real count.** The suite runs each facet's own href back through the
  builder and compares row counts. A decorative count is a lie with a number in it.
- 🔴 **A new route under `src/app/api` needs a RECIPE** in `tests/uni011-mirror-api.test.ts` or that
  suite fails — it derives the route list from disk.
- 🔴 **A new free-text column needs a CLASSIFICATION** in `tests/uni005-data-inventory.test.ts`
  (non-vacuity floor currently **92**).
- 🔴 **A new colour PAIRING needs a row** in `tests/uni013-contrast.test.ts` — and if its ground is
  translucent, an **`over:`** naming the surface beneath it. See finding A.
- 🔴 **Never generate DDL from `src/db/schema.ts`** — but a new table must still be declared there,
  because the drift spec compares columns.
- ⚠️ `originIsSecure()` reads the **scheme**, never `NODE_ENV`.
- ⚠️ **Two `set-cookie` headers need `Headers.append`, not `set`.**
- ⚠️ **`freshDb()` calls `resetApiSql()` first** — a cached pool outlives the schema it resolved.
- ⚠️ **`src/lib/content.ts` is GONE** (s32). Its two reads moved into `lists.ts` beside the page
  that uses them; two modules defining "which replays are public" is one predicate too many.

**Editor:**

- 🔴 **`expect(value, message)` is VITEST. This checkout is JEST.** Put the failing value *inside*
  the assertion.
- 🔴 **No DOM and no React in this checkout's jest runner.** ⚠️ **The platform repo is the opposite**
  — vitest renders React fine there. Do not carry the constraint across.
- ⚠️ **`test:main` collects its file list at start.** Reconcile the suite count.
- ⚠️ **Running the two `uni-001` spec files together prints *"a worker process has failed to exit
  gracefully"***. Each file alone is clean, `--detectOpenHandles` reports none, both pass either
  way. **Not chased; recorded so the next person does not re-derive it.**

**Both:**

- 🔴 **`/usr/bin/grep -a`, always.** Plain `grep` here is ugrep and silently skips `.ts` as binary.
- 🔴 **`forEachNode` STOPS on a truthy return.** Use a block body.

---

# ⚠️ FOR RICHARD — the asks, and the first is still first

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
4. **E7 — where capture images live.** Cheap, genuinely deferrable.
5. ⚠️ **`nodegx-community` main is ahead 3 and unpushed.** A call, not an oversight.
6. 🆕 **A look, in the LIGHT theme, in a real browser.** Nine pages changed and every visual review
   of this site has been dark. `localStorage['nodegx-theme'] = 'light'`.

**Not in the close, still open:** the twelve badge artworks (UNI-013 slice 4) · a Paddle account
(D7) · GitHub Pages unattached · the F4 packaged-install scope call (UNI-012) · UNI-006's three
calls, UNI-005's two, UNI-004's D8-bar question, UNI-003's catalogue change.

🔴 **And the decision that arrives at the close:** UNI-017, UNI-018, UNI-007's intake, UNI-006's
bridge, UNI-011's views, UNI-008, UNI-010 and UNI-012 become **a phase 67b or fold into phase 68**.
Richard's call, made deliberately rather than by drift.

---

# 🔴 SESSION 29's FINDINGS — still live, kept because two of them are rulings in disguise

### A. `signOut` read the COOKIE only, and the editor sends a BEARER — *build the caller*, 11th

`signOut(sql, request)` revoked `cookieValue(request, SESSION_COOKIE)`. That audits clean on the
page: it is a sign-out route, it revokes the session cookie. 🔴 **But an editor has no cookie jar
scoped to our origin**, so `signOutOfCommunity` would have received **`200 {ok:true}` while revoking
nothing**. ✅ Fixed by routing it through the same `tokenFromRequest` the `/api/v1` surface uses.
**The general move: when a module has two transports for one credential, write the second
transport's caller.**

### B. Two decisions were FORCED by UNI-001's own scope, and reading them as choices will waste a session

1. **The device flow, not a loopback listener and not a `nodegx://` handler.** UNI-001's scope says
   *"no listener is opened"*; a protocol handler is an OS registration a dev build, a portable build
   and a second install all fight over, with the winner receiving a URL containing a live credential.
2. **GitHub only; no email/password.** The scope asks for both and for *password reset* — and
   **nothing on this platform sends mail** (E6). A password flow whose reset arm cannot be delivered
   locks people out.

### C. The site is entirely server-rendered, and that is a deliberate cost

`cookies()` in the **root layout** opts the whole app out of static generation: `next build` reports
**every route as `ƒ`**. ⚠️ Recorded so it is not read as a regression.

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
   immediately before writing it, or patch the sections you mean to change. ✅ Session 32 checked
   `git log` + `git status` + mtime on this file first, and patched `README.md`, `TASKS.md` and
   `UNI-013` surgically rather than rewriting them.
2. 🔴 **Do not `pkill` by a pattern as broad as a test runner's name** — expect somebody else's run
   to be what you hit.
