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

# 🟢 NO CODE ITEM IN THE CLOSE BELONGS TO A TASK ANY MORE. WHAT IS LEFT IS RICHARD'S

Session 29 built the issuer (E1). Session 31 built UNI-019 (E3). Session 32 built UNI-013 slice 5
(E4). **Session 33 built E1's last owed piece — AC2's launcher card — and closed E8.**

🔴 **And a stranger still cannot make an account, for the same small reason as five sessions ago:
there is no GitHub OAuth App.** `/api/auth/github/start` answers **503** with a plain sentence,
deliberately. **That is E10, it is Richard's, it is free, and it is one form.**

> ⚠️ **Do not "work around" it.** A dev-only issuer, a paste-your-token box, a seeded session in
> production — each is a back door, and `communitysession.ts` warns against exactly that shape in
> its own header. The correct state of a deployment with no credential is **503**.

## 🟢 THE ORDER FOR SESSION 34

1. ⚠️ **There is no obvious code item left in the close.** E2 (deployment), E5, E6, E7, E9 and E10
   are all Richard's or blocked on him. **Do not invent one** — pick from the list below
   deliberately and say which you picked and why.
2. **[UNI-023](UNI-023-ONE-FACET-BAR-SIX-LISTS.md) if the look work continues** — the facet bar is
   **drawn, on six pages, with real counts**; UNI-023 wires **search, sort and the price bands**
   `coaching_offers` can already support. 🔴 **Do not draw a second pill style**: `.facet` is the
   one component and the six pages already share it.
3. **[UNI-020](UNI-020-A-TUTORIAL-THAT-SAYS-WHAT-IT-TEACHES.md)** if content is the priority — it
   has one concrete hook waiting, below.
4. ⚠️ **A ruling, not a run: UNI-001 AC4.** *"Reads of the session outside the launcher/account
   module come back empty."* There are now three readers — the composer, the launcher hook, the
   sign-in model — and two of them are inside what the criterion names. **It needs re-wording or a
   verdict; do not report it as passing and do not delete it.**

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

# 🔴 CHECK THIS HANDOVER'S PREMISES — BEFORE ANY CODE, EVERY TIME

Session 32 verified session 31's two central claims by taking its own floor first. **Session 33 did
the same and found the editor's floor was NOT CLEAN** — three failures in a tree it had not touched,
two of them caused by session 29 and sitting red for a day (finding B below). **A number quoted from
a handover is a number measured under somebody else's load, and a suite reported by NAME rather
than by COUNT is a suite nobody can check.**

✅ **Quote the count or do not claim the run.**

---

# WHERE THE PHASE IS — 2026-08-18 (session 33)

| In the close? | Item | State |
|---|---|---|
| ✅ **E1** | **UNI-001 — issuer + launcher** | ✅ **COMPLETE as far as a task can take it.** s29 built the issuer; **s33 built AC2's launcher card and drove it**. ⚠️ **AC4 needs a ruling** (item 4 above) |
| ✅ **E3** | **UNI-009 AC1** — home shows real threads signed out | ✅ **MET (s31), `nodegx-community@636d488`** |
| ✅ **E4** | **UNI-013 slice 5 — the pages** | ✅ **BUILT (s32), `nodegx-community@9df0445`** |
| ✅ **E8** | `NOTIFICATION_LINK_SECRET` | ✅ **CLOSED (s33), `nodegx-community@10e05d4`.** ⚠️ Richard must still **set the variable** on the deployment — the code now makes forgetting it loud |
| 🔴 **E10** | **A GitHub OAuth App** | 🔴 **Richard's, and the first domino.** Without it nobody can make an account, which is the criterion's first verb |
| 🔴 **E2** | **deployment** | 🔴 **Owned by no task.** Blocked on Richard (E5) |
| 🔴 **E9** | the smoke drive on the deployed box | 🔴 Blocked on E2 |
| 🆕 **out** | UNI-020 · UNI-021 · UNI-022 · UNI-023 | **SCOPED s30, explicitly NOT in the close.** The content half — routes, schema, filters |
| ✅ done | UNI-001 (E1 + AC2), 002–006, 009 cut, 011 s1–s2b, **013 s1–s3 + s5**, 014, 015, 016, 019 | 🔴 **013 slice 4 — the twelve badge artworks — is Richard's and is the one slice that is not code** |
| ⛔ **out** | UNI-017 · UNI-018 · UNI-007 intake · UNI-006 bridge · UNI-011 views · UNI-008 · UNI-010 · UNI-012 | See the README's *"explicitly NOT in the close"* |

---

# 🔴 SESSION 33's FINDINGS — three of them outlive the card

### A. The editor's session store is a PLAINTEXT FILE in `userData`, and the module said `localStorage`

`communitysession.ts` carried a long, careful security note whose first sentence was wrong:
*"THE STORE IS `JSONStorage`, WHICH IS `localStorage` IN THE RENDERER."* It is not.
`@noodl/platform-electron` calls `setStorage(new StorageNode())` at import, and `StorageNode`
writes `<userData>/<key>.json`. **Measured, not reasoned:**
`~/Library/Application Support/NodeGX/nodegx.community.session.json` appears when a session is
written and is deleted when Sign out is clicked.

✅ The conclusion survived — a plaintext file readable by any process running as this user is still
the wrong home for a credential of value — **but the reasoning had to be redone to know that**,
which is what makes a wrong premise inside a right-sounding note expensive.

⚠️ **UNI-001's scope says the token is stored `0600`. It is not.** `StorageNode` writes with the
process umask. Recorded rather than fixed inside a launcher task: narrowing it changes
`StorageNode` for every caller, which is a platform-layer decision.

### B. A RENAME blinded a spec, and the red baseline hid behind "the suite was re-run"

The floor taken **before any edit** was **3 failed / 3786 passed / 3789 across 247 suites**. Two of
the three were `uni-016/composer-sends-what-it-shows.test.ts` asserting
`platform.openExternal(COMMUNITY_URL)` — and session 29 had imported that constant as
`COMMUNITY_URL as COMMUNITY_ORIGIN`. **The call site never moved and the feature never broke**; the
instrument could no longer see it, and its negative control failed too, loudly and for the wrong
reason (`source.replace` matched nothing, so `expect(mutated).not.toBe(source)` threw).

🔴 **Session 29's handover said *"`test:main` was re-run this session"* and quoted no count.** ✅
Fixed by dropping the alias — one name for one thing in a file — rather than teaching the spec the
alias, which leaves the next rename to break it again. ✅ **When you rename something a
source-analysis spec watches, grep `tests-unit/` for the old name: `tsc` cannot see it.**

### C. The launcher header's avatar belongs to GITHUB, and the community chip deliberately is not there

There are now two identities in this editor with no relationship to each other — the GitHub OAuth
account used for cloning, and the NodeGX community account — and **one round avatar in the header**.
Putting the handle there makes *"whose face is that?"* unanswerable, so the chip lives on the card
with Sign out beside it. 🔴 A later task that wants identity in the header has to decide **which
identity the header is about** first; that is a design decision, not a placement.

### D. ⚠️ NOBODY HAS STILL LOOKED AT ANY PLATFORM PAGE IN THE LIGHT THEME

Unchanged from sessions 31 and 32. `--force-prefers-color-scheme=light` does **not** move the theme
stamp's `matchMedia` read, so headless screenshots are always dark. Light is graded by the contrast
**arithmetic** only — the stronger instrument, and not a look. To see it: set
`localStorage['nodegx-theme'] = 'light'` in a real browser.

---

# Gates — MEASURED 2026-08-18, session 33

**This checkout (editor):**

| | Before any edit | After |
|---|---|---|
| `test:main` | 🔴 **3 failed / 3786 passed / 3789, 247 suites** | ✅ **1 failed / 3808 passed / 3809, 248 suites** |

✅ **The delta reconciles: +1 suite** (`tests-unit/uni-001/launcher-offers-signin.test.ts`, 20 tests)
**and −2 failures** (the uni-016 pair, finding B). 🔴 **The remaining failure is
`cn-002/unknown-type-check-skipped.test.ts` — phase 69's, and it was red in the
before-measurement.** Do not attribute it to this work and do not "fix" it blind.

`npx tsc -p tsconfig.json --noEmit` **exit 0**. ⚠️ **`test:ci` was NOT run** — four peer sessions
were live on this checkout all session and two of them were driving editor stacks.
🔴 **Re-measure before quoting an editor `test:ci` baseline; this session's evidence says nothing
about it.**

**`nodegx-community`:**

| | Before any edit | After |
|---|---|---|
| vitest | **805 passed / 28 files / exit 0** (289s) | ✅ **813 passed / 29 files / exit 0** (240s) |

✅ **The floor matched session 32's after-state to the test** — the handover's number verified
rather than believed. The delta is exactly `tests/uni014-link-secret.test.ts` (8) and **nothing
existing moved**. `tsc --noEmit` clean · `next build` exit 0.

⚠️ **A drive, in a real editor** (`npm run dev:debug`, CDP): the card renders signed out with D2's
button; a session written to the store brings up the chip on reload; **Sign out removes the store
file**; a sign-in click runs the real device flow and reports
*"The community could not be reached"* — which is E2 and E10 in one sentence, not a defect.

---

# 🔴 THE MACHINE'S STATE — measured 2026-08-18 ~18:30, session 33

| Port | What | Do what with it |
|---|---|---|
| 🔴 **3111** | The `next-server`, pid **62819**, still up — **now ~19 hours old** | 🔴 **STILL SERVING THE PRE-UNI-019 PAGE.** Anybody reviewing a look on this port will conclude the last three sessions did nothing. Kill it or ignore it; left because it is not known to be ours |
| ✅ 3210 | free | Start your own |
| ✅ 9222 | free | The editor stack was launched and torn down this session; `dev:stop` reports nothing running |

✅ **Kill by port, never by name:** `lsof -nP -iTCP:<port> -sTCP:LISTEN -t`. 🔴 **`pkill -f "next
start"` matches NOTHING** — the process is `next-server`.

✅ **Postgres:** `nodegx-community-db` up and healthy, **port 55432**, seeded.
⚠️ Dev session tokens: `Cookie: nodegx_session=dev-session-nia` (also `-ada`, `-tom`, `-teacher`,
`-pupil`).

⚠️ **`nodegx-community` `main` is now AHEAD 4 AND UNPUSHED** — `df61abc` (s30), `636d488` (s31),
`9df0445` (s32), `10e05d4` (s33). **Four consecutive sessions have not pushed. It is a call, not an
oversight.**

🔴 **FOUR PEER SESSIONS were live on this checkout all session** and the etiquette worked: the
launch was announced to all four, one of them (phase-69's closing campaign) was **waiting to launch
its own stack** and held; the teardown was announced back. ✅ **Announce launch AND teardown, and
name your uncommitted files when asked** — a peer had to ask whose three modified editor files were.

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
- ⚠️ **The platform suite is ~4 minutes on a quiet machine.** Do not start a build or a second suite
  beside it.
- 🔴 **Do not edit sources while a suite is in flight**, and 🔴 **do not edit a bundled source while
  a peer's editor stack is between launch and `reactMounted`** — it wedges their renderer and only
  a relaunch clears it.

# Things the next person will otherwise re-derive

**Editor:**

- 🔴 **D2's string has ONE owner: `noodl-core-ui/src/constants/communityCopy.ts`.** It is the only
  module the launcher card and the composer can both reach — `noodl-editor → noodl-core-ui` is the
  only direction that exists. `constants/externalLinks.ts` is the precedent. **Do not re-type the
  words**; two specs assert that neither surface does.
- 🔴 **The launcher's host-state seam is `LauncherContext`.** A card in `noodl-core-ui` gets its
  behaviour from the editor as a `…HostState` object (`connectAgent`, now `community`), because
  that package renders in Storybook where `noodl-editor` does not exist.
- ⚠️ **`community` is supplied even when the platform is unreachable**, unlike `connectAgent` which
  is `undefined` when it cannot work. A community that is down now is up in ten minutes; hiding the
  account on a failed fetch makes signing in look like a feature that comes and goes.
- 🔴 **`expect(value, message)` is VITEST. This checkout is JEST.** Put the failing value *inside*
  the assertion.
- 🔴 **No DOM and no React in this checkout's jest runner.** ⚠️ The platform repo is the opposite.
  A launcher card can only be asserted by **source analysis with negative controls**
  (`base-dialog/measuring-copy.test.ts` is the precedent) — and then **driven**, which is what makes
  the claim real.
- ⚠️ **Running the two `uni-001` spec files together prints *"a worker process has failed to exit
  gracefully"***. Both pass either way; not chased, recorded.

**Platform:**

- 🔴 **THE KIT IS `src/components/Kit.tsx`** — `ListView` + `src/lib/lists.ts` for a list,
  `DetailHead` for a detail, `Home.tsx` for the index. A page declaring its own `className="card"`
  fails `tests/uni013-slice5.test.tsx`, deliberately.
- 🔴 **A new PAGE needs a way in** (`tests/uni019-home.test.tsx`) **and a verdict in slice 5's
  archetype table**; **a new FACET needs a real count**; **a new API route needs a RECIPE** in
  `tests/uni011-mirror-api.test.ts`; **a new free-text column needs a CLASSIFICATION** in
  `tests/uni005-data-inventory.test.ts` (floor **92**); **a new colour PAIRING needs a row** in
  `tests/uni013-contrast.test.ts`, with an **`over:`** if its ground is translucent.
- 🔴 **`NOTIFICATION_LINK_SECRET` is read PER CALL, not at import**, and the dev default is scoped
  to insecure origins. A module-level `const` made *"is this configured?"* a question about import
  order and unanswerable from a spec.
- 🔴 **`notify` composes into the CALLER'S transaction**, so anything that can fail there must
  return an outcome rather than throw — a throw rolls back the answer or the award that occasioned
  the notification. `'no-address'` and now `'unconfigured'` are both that shape.
- ⚠️ `originIsSecure()` reads the **scheme**, never `NODE_ENV` — `next start` on a laptop runs with
  `NODE_ENV=production`.
- ⚠️ **`freshDb()` calls `resetApiSql()` first** — a cached pool outlives the schema it resolved.
- ⚠️ **Two `set-cookie` headers need `Headers.append`, not `set`.**
- 🔴 **Never generate DDL from `src/db/schema.ts`** — but a new table must still be declared there.

**Both:**

- 🔴 **`/usr/bin/grep -a`, always.** Plain `grep` here is ugrep and silently skips `.ts` as binary.
- 🔴 **`forEachNode` STOPS on a truthy return.** Use a block body.

---

# ⚠️ FOR RICHARD — the asks, and the first is still first

1. 🔴 **E10 — a GitHub OAuth App. Cheapest, and the first domino.** Homepage
   `https://community.nodegx.io`, callback **`https://community.nodegx.io/api/auth/github/callback`**.
   ⚠️ **Byte for byte** — GitHub reports a mismatch as `redirect_uri_mismatch` *without saying which
   side is wrong*. Set `GITHUB_OAUTH_CLIENT_ID` and `GITHUB_OAUTH_CLIENT_SECRET`. Without them
   **nobody can make an account**.
2. 🔴 **E5 — does the platform go on nexus-1?** Still the domino behind deployment (E2) → the smoke
   drive (E9). **E10 needs its answer too.**
3. 🔴 **E6 — a transactional sending account + domain.** **D19 was ruled *on the condition* that
   email lands.** `log` delivery covers dev and cannot ship.
4. 🆕 **Set `NOTIFICATION_LINK_SECRET` on the deployment.** E8's code now refuses to sign or honour
   an unsubscribe link without it, which is safe — but it also means **no notification email goes
   out at all** until the variable exists. One `openssl rand -base64 32`.
5. **E7 — where capture images live.** Cheap, genuinely deferrable.
6. ⚠️ **`nodegx-community` main is ahead 4 and unpushed.** A call, not an oversight.
7. 🆕 **A look, in the LIGHT theme, in a real browser.** Every visual review of this site has been
   dark. `localStorage['nodegx-theme'] = 'light'`.

**Not in the close, still open:** the twelve badge artworks (UNI-013 slice 4) · a Paddle account
(D7) · GitHub Pages unattached · the F4 packaged-install scope call (UNI-012) · UNI-006's three
calls, UNI-005's two, UNI-004's D8-bar question, UNI-003's catalogue change.

🔴 **And the decision that arrives at the close:** UNI-017, UNI-018, UNI-007's intake, UNI-006's
bridge, UNI-011's views, UNI-008, UNI-010 and UNI-012 become **a phase 67b or fold into phase 68**.
Richard's call, made deliberately rather than by drift.

---

# 🔴 EARLIER FINDINGS STILL LIVE

### `signOut` read the COOKIE only, and the editor sends a BEARER — *build the caller*, 11th (s29)

`signOut(sql, request)` revoked `cookieValue(request, SESSION_COOKIE)`. That audits clean on the
page: it is a sign-out route, it revokes the session cookie. 🔴 **But an editor has no cookie jar
scoped to our origin**, so `signOutOfCommunity` would have received **`200 {ok:true}` while revoking
nothing**. ✅ Fixed by routing it through the same `tokenFromRequest` the `/api/v1` surface uses.
**When a module has two transports for one credential, write the second transport's caller.**

### Two decisions were FORCED by UNI-001's own scope (s29)

1. **The device flow, not a loopback listener and not a `nodegx://` handler.** UNI-001's scope says
   *"no listener is opened"*; a protocol handler is an OS registration a dev build, a portable build
   and a second install all fight over, with the winner receiving a URL containing a live credential.
2. **GitHub only; no email/password.** The scope asks for both and for *password reset* — and
   **nothing on this platform sends mail** (E6). A password flow whose reset arm cannot be delivered
   locks people out.

### The site is entirely server-rendered, and that is a deliberate cost (s29)

`cookies()` in the **root layout** opts the whole app out of static generation: `next build` reports
**every route as `ƒ`**. ⚠️ Recorded so it is not read as a regression.

### A wholesale `cat >` over a shared file is a merge you did not perform

A peer session once committed 24 lines onto this file and the next session rewrote it with `cat >`,
discarding them — not a decision, a side effect. ✅ Re-read the file immediately before writing it,
or patch the sections you mean to change. 🔴 And **do not `pkill` by a pattern as broad as a test
runner's name** — expect somebody else's run to be what you hit.
