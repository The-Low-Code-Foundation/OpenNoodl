# Phase 67 — next session prompt

Paste the block below into a fresh session.

---

Continue phase 67 (NodeGX Community), `dev-docs/tasks/phase-67-nodegx-university/`.

**Read first, in this order:** §"THE HONEST READ" below — it is the reason this prompt is shaped the
way it is and it changes what you should pick. Then `RULINGS.md` (the queue is **EMPTY**; D15/D16/D17
ruled 2026-08-16, D18 2026-08-17 — ⚠️ **read the postscript at the end of the D15/D16/D17 section**),
then §"WHERE THE PHASE IS", then `TASKS.md`'s table, then your task file.
`PRIOR-ART-RECONCILIATION.md` if you have not read it.

🔴 **Two repos.** Editor work is this checkout. Platform work is
`/Users/richardosborne/vscode_projects/nodegx-community` — a **sibling directory, never nested** —
pushing to `The-Low-Code-Foundation/nodegx-community`. None of this checkout's gates, peers or traps
apply there.

---

# 🔴 THE HONEST READ — the phase cannot be "knocked out" by sessions alone

The remainder splits in two, and the split is the most useful thing in this document:

| | Tasks | Who |
|---|---|---|
| **Buildable now, blocked on nobody** | **UNI-012**, (probably) UNI-007's intake | **a session** |
| **Blocked on a purchase, an account, an artwork or a decision** | UNI-009 AC1+AC3, UNI-011 AC1+AC6, UNI-001's remainder, UNI-004's revenue, UNI-013 slice 4, UNI-008, deployment | **Richard, and only Richard** |

🔴 **Six of the seven blocked items trace to four asks**, listed in §"FOR RICHARD" at the bottom in
the order of how much each unblocks. **A forum is the big one — it alone gates three tasks.**

⚠️ **The useful shape of the next few sessions: finish the buildable set, and shrink the ask list to
something Richard can act on in an afternoon.** Do not open a blocked task hoping the block has
moved — check the ask list first, it is one `dig`, one `gh api` and one question each.

---

# WHERE THE PHASE IS — re-measured 2026-08-17 (session 24), not remembered

| Track | Tasks | State |
|---|---|---|
| **Platform** | UNI-001 (AC3), 002–006, 009 content cut, **011 slice 1** | 🟢 pushed. `main` == `origin/main` |
| **Platform** | **UNI-013 slice 1** — the token substrate | 🟢 **BUILT + pushed `f64f138`.** AC1/AC2/AC3/AC5 met |
| **Platform** | **UNI-013 slices 2–3** — type and rhythm, the six components | ✅ **BUILT `d205b47`** — display face served, mono meta, hover ladder, gradient avatar |
| **Platform** | UNI-007 intake / personalised path | 🟡 The one platform-side piece nobody has looked at. ⚠️ Check whether it needs an issuer *before* opening it |
| **Platform** | UNI-008 | 📋 Tier 3, deliberately last. D9's obligations include a DPA and a retention policy — **policy text is Richard's** |
| **Platform** | UNI-009 AC1 + AC3 | 🔴 Discourse, SSO, webhook receiver — **a purchase nobody has made** |
| **Platform** | **deployment** | 🔴 **Owned by NO TASK, and needs a decision before it can be scoped** |
| **Editor** | UNI-011 slice 1, AC2, AC3 | 🟢 `f7b0b280`, `f73b1bd6`, `f72799b7` — **the editor-only half is COMPLETE** |
| **Editor** | UNI-011 AC1 + AC6 | 🔴 Needs a forum. D16's gate cannot be met without one |
| **Editor / MCP** | UNI-007 slices 1–4, UNI-010 slices 1–2 | 🟢 Built and driven. UNI-010's five slices **KEEP** |
| **Editor / MCP** | **UNI-012** | ✅ Ruled (ship the harness), scoped, **NOT built. Buildable now** |

## Measured this session, with the instrument

- **`nodegx-community`: HEAD `d205b47`, `main` == `origin/main`, working tree clean.**
- **Suite: 532 specs / 21 files** — 462 pre-existing (measured fresh at 21:46 *before* any edit, so
  AC5's control is a measurement rather than a carried number) + 22 drift + 48 contrast.
- `tsc --noEmit` clean. `next build` clean, **21 routes**. `npm run check:css` clean over **751
  built declarations**.
- **Lint on the platform: `package.json` HAS a `lint` script (`next lint`) and there is NO ESLint
  config anywhere in the repo.** The script exists, has never run, and running it starts Next's
  interactive setup. ⚠️ **"There is a lint script" is not "there is a lint gate".**
- 🔴 **Deployment artefacts: still none.** No `Dockerfile`, no `.github/`, no `ops/`, no `fly.toml`.
  There IS a `docker-compose.yml` — **dev/test Postgres only** (port 55432, one `db` service). A
  session skimming for "is there a compose file" will find one and mis-read it.

## NOT re-measured — do not quote these as current

- `dig +short community.nodegx.io` and `gh api …/nodegx-community` were **not** re-run this session.
  As of 08-17 they were `49.12.102.195` (nexus-1) and `has_pages: false`. ⚠️ **Resolving is not being
  served**, and 🔴 **a Caddy response proves nothing** — it 308s every Host, including invented ones.
  Read `127.0.0.1:2019/config/`.
- **No `test:ci` was run this session or last.** Do not quote one from a handover — there isn't one.

---

# What the twenty-fourth session did

**UNI-013 slice 1** — the community site now consumes the editor's canonical tokens.
`scripts/sync-tokens.mjs` vendors `colors.css`/`fonts.css`/`spacing.css` byte-identically into
`src/styles/tokens/` with a `source-sha256` header; `globals.css` declares **no colour of its own**;
`tests/uni013-token-drift.test.ts` fails when the copy diverges.

**Then slices 2 and 3** (`d205b47`), after Richard looked at slice 1 and said *"I thought the style
was redone??"* — 🔴 **and he was right. Slice 1 is nearly invisible by design, and it was the wrong
half to land first against a complaint that was explicitly about appearance.** The ordering was
defensible on engineering grounds and wrong on the grounds that mattered. **When an ask is about how
something looks, ship something that looks different in the same session.** Slices 2–3 served the
display face, put `.meta` in mono with `tabular-nums`, made chips and pills uppercase mono, unified
the card and row onto a `bg-1` → `bg-2` hover ladder, and gave the profile the editor's gradient
avatar. Full detail in the task file.

**Six findings that generalise past this task:**

🔴 **A criterion that is a NUMBER catches what a criterion that is a LOOK cannot.** The first draft
pointed all secondary copy at `--theme-color-fg-muted` — the obvious token by name, and an editor
*chrome label* colour that scores **3.19:1** on the light page ground, below AA, on the lede of every
page. **Two screenshots of the two themes said the site was fine.** The fix was a stronger token, not
a new colour; the durable output is `tests/uni013-contrast.test.ts`, which resolves the site's role
layer against the vendored palette and asserts the ratios in both themes.

🔴 **A control pair needs its arms pinned, not merely required to differ.** Every contrast ratio
passes in the dark theme. A `tokensFor('light')` that silently returned the dark palette would have
gone green while measuring one theme twice — so the test pins six tokens to their distinct resolved
values in each theme.

🔴 **A Map-based diff collapses a duplicate key silently.** The first rename probe renamed
`--theme-color-primary` → `--theme-color-accent`, which is **a real token thirty lines further
down**; the rename became a duplicate, the duplicate collapsed, and one declaration stopped being
compared *at all*. ⚠️ **A probe that lands on an occupied name measures the collision, not the
mutation.** Now asserted empty.

🔴 **`pkill -f "next start"` matches nothing** — Next renames the process to `next-server (v15.x)`.
The stale server kept the port, the new one failed to bind *silently in the background*, and the old
process served HTML pointing at a **CSS hash that no longer existed on disk**: a 404 stylesheet and a
totally unstyled page. **Every gate stayed green through it** — build clean, sweep clean, the whole suite
green. ✅ **Kill by port (`lsof -nP -iTCP:<port> -sTCP:LISTEN -t`), and diff the served HTML's CSS
href against `ls .next/static/css/` before believing a screenshot.**

🔴 **A token can name an asset that is not served.** `--font-family-display` named Bricolage
Grotesque and silently resolved to its **system fallback** on the web for as long as the site
existed — the editor loads the woff2 from its own assets folder and there is no web equivalent.
Correct-looking source, wrong render, no error anywhere.

🔴 **A theme-INVARIANT ground given theme-DEPENDENT ink passes in one theme and fails in the other.**
`--theme-color-on-primary` flips (`#071627` dark, `#ffffff` light); `--theme-color-avatar-gradient`
does not. The avatar was white-on-azure at **2.63:1** in light only. ⚠️ **And `bg-page` is DARKER
than `bg-0` in the light theme** — it is the page's floor, not a chrome surface; a sticky header on
it cost 0.03 of the AA bar.

⚠️ **Also, unchanged and still unowned:** **noodl-core-ui cannot be eslinted at all** (its
`eslintConfig` extends `react-app`, which is not installed; confirmed against an untouched control
file). *"eslint clean on every touched file"* in past handovers was never true of core-ui files.

---

# THE PLAN — do these in this order

## ✅ LANE A IS CLOSED — UNI-013 slices 1–3 all built (`f64f138`, `d205b47`)

**Only slice 4 remains and it is Richard's** (the twelve badge artworks). Do not reopen this task
looking for work; read its file for the traps before touching any stylesheet.

🔴 **If you DO touch the site's CSS, three cheap gates, and they are not optional:**
`npm run check:css` (AC1 — catches a hardcoded colour the moment you write one, and carries its own
known-bad probes), `npx vitest run tests/uni013-contrast.test.ts` (AC2 — 🔴 **add a `PAIRS` entry for
any new foreground/ground combination you introduce**; it grades the palette, it does not crawl the
DOM), and the full suite for AC5.

⚠️ **AC5's control is "the 462 specs that predate UNI-013 pass unchanged"** — **532** total now.
Count by name, do not copy a total.

🔴 **Three UNI-013 findings that will bite outside it:**
1. **`--theme-color-on-primary` FLIPS per theme; `--theme-color-avatar-gradient` does not.** Any
   theme-invariant ground given theme-dependent ink passes in one theme and fails in the other.
2. **A token can name an asset that is not served.** `--font-family-display` resolved to its system
   fallback on the web for as long as the site existed — correct-looking source, wrong render.
3. **`bg-page` is DARKER than `bg-0` in the light theme.** It is the page's *floor*, not a chrome
   surface; putting header text on it cost 0.03 of the AA bar.

## 🟢 LANE B — UNI-012, F4 on a packaged install

**Ruled (ship the harness), scoped, not built, blocked on nobody to build.**

⚠️ **Verifiable only against a packaged build, and *"a shipping claim nobody exercised"* is the
artifact this phase has found wrong four times** — the packaged verification is the task, not a
formality. 🔴 **Two measured facts qualify the ruling**: the harness probes for a **system Chrome**
and refuses without one, so shipping it makes `allow_unrendered` *rare* rather than unnecessary
(**both halves of the either/or are probably wanted**); and rendering through the sidecar's own
Electron is closed by `ELECTRON_RUN_AS_NODE=1`, which is load-bearing and measured.
✅ CN-001 already did the structural half (`@nodegx/render-measure`).
⚠️ The **F4 scope call** is still Richard's — but it does not block the build.

## 🟡 LANE C — UNI-007's intake and personalised path

⚠️ **First question, before anything else: does intake need an issuer?** If a path can be produced
for an anonymous visitor it is buildable now; if it hangs off an account it joins the blocked pile
and you should say so and stop. **Ten minutes to answer, and the answer decides whether this is a
lane at all.**

## 🔴 LANE D — deployment: scope it, do not build it

**Still the phase's real gap.** No task owns it, and a grep across all twelve task files for
deploying the platform returns **zero hits**. UNI-008 is about hosting *users'* apps, not this.

🔴 **Same shape as UNI-011 slice 1's finding** — D14 said the API was a deliverable, no task owned
it, so it did not exist. ⚠️ **Needs a decision from Richard first** (does it go on nexus-1?), so
**write the task file and stop**. That box is all-or-nothing on Caddy config and it is a bigger call
than a DNS record.

## ⛔ LANES THAT ARE BLOCKED — check the ask list, do not open these

- **UNI-009 AC1/AC3** — Discourse, SSO, webhook receiver. A purchase.
- **UNI-011 AC1/AC6** — needs a forum. D16's gate cannot be met (no forum ⇒ no `weeksWithCallHeld`,
  no `medianFirstReply`), and its ship order says last.
- **UNI-001's remainder** — DNS resolves, so callbacks *can* be registered, but the OAuth app and its
  secrets are Richard's.
- **UNI-004's revenue path** — `recordPayment` has no caller and needs a Paddle account (D7).
- **UNI-008** — Tier 3; D9's five obligations include a DPA and a retention policy.

---

# ⚠️ FOR RICHARD — four asks, ordered by how much each unblocks

1. 🔴 **A forum (Discourse). The big one — it alone gates three things:** UNI-009 AC1+AC3, UNI-011's
   mirror surface (AC1+AC6), and D16's whole gate, which cannot be evaluated without
   `weeksWithCallHeld` and `medianFirstReply`. Everything else here unblocks one task each.
2. 🔴 **Does the platform go on nexus-1 at all?** Deployment is owned by no task and cannot be scoped
   without this. ⚠️ nexus-1 is **all-or-nothing on Caddy config** and already serves the landing page
   plus two of your sites — a bigger call than the DNS record was, and the one that decides whether
   anyone ever sees any of this.
3. **The twelve badge artworks.** D4 ruled ~12 flat SVGs in the editor's idiom. **UNI-013 slice 4,
   and the one slice that is not code.** ⚠️ It degrades rather than blocks — the profile draws a
   family mark and a tier colour. 🆕 **Now also the last literal colour on the site**:
   `--site-tier-bronze` is allow-listed in the AC1 sweep because the editor palette has no bronze,
   and it retires when the artworks land.
4. **A Paddle account (D7)**, which still stands between coaching and revenue.

**Smaller, still open, carried:**

- ⚠️ **GitHub Pages still unattached** (`has_pages: false` as of 08-17). D17's v0 is free to set up
  **until the first deploy**.
- ⚠️ **The F4 packaged-install scope call** (UNI-012) — does not block the build, does shape it.
- **UNI-011 slice 1's judgement call**, reversible, one line: the assignments endpoint is **not**
  subject to D15.
- ⚠️ **UNI-011 AC2 and AC3 both hand off to the browser rather than posting**, because there is no
  forum and no issuer. **AC3 additionally writes the capture PNG to your Documents folder.**
  `saveCaptureNextTo` is the single function that becomes an upload when there is somewhere to
  upload to.
- **Carried and still open:** UNI-006's three calls, UNI-005's two, UNI-004's *"responding to an RFP
  requires clearing D8's bar"*, and UNI-003's change to UNI-002's catalogue.

---

# Gates

**`nodegx-community` (session 24, all re-measured):** 516 specs / 21 files, `tsc` clean,
`next build` clean at 21 routes, `check:css` clean over 713 declarations. Working tree clean,
`main` == `origin/main`, HEAD `f64f138`.

**This checkout (session 24):** ⚠️ **nothing was run** — session 24 touched only
`dev-docs/tasks/phase-67-nodegx-university/`. The last measured numbers are session 23's:
`tsc --noEmit -p tsconfig.tests-main` **31 errors** (pre-existing, none in touched files); no full
`test:main`; **no `test:ci`**. 🔴 **Do not quote any of these as current.**

---

# Standing constraints

- Editor work on `cline-dev`. 🔴 **Never `git stash`** — ⚠️ **there is already a stash on this
  checkout that is not yours** (`stash@{0}`, WIP on `ff74bcc9`). Leave it alone.
  ✅ **`git commit <pathspecs>`, never stage.** ⚠️ Untracked files are the one case needing
  `git add` — put add and commit in **one chain** with the message **already in a file**.
- 🔴 **`cd` does not persist between tool calls here**, and a `cd` inside one does not leak out.
  ✅ **Run jest as `npm --prefix packages/noodl-editor run test:main -- <path>`** — invoking `jest`
  from the repo root silently picks the wrong config.
- 🔴 **Port 55432 for the platform's Postgres, never 5432.**
- 🔴 **This checkout is SHARED.** Peer messages are for **blocking or hazardous** things only.
  Announce **source edits**, not just runs. ⚠️ At session 24's start the tree carried six files
  modified by other sessions — **use explicit pathspecs, always.**
- ✅ **Before launching the editor: `npm run dev:stop -- --list`**, and check nobody is mid-`test:ci`
  (`ps -Ao pid,ppid,args | grep -a run-electron-tests`).

---

# Things the next person will otherwise re-derive

**Driving the site** (new, session 24):

- 🔴 **`pkill -f "next start"` matches nothing.** See the finding above. Kill by port; verify the
  served CSS href exists on disk.
- ✅ **Headless screenshots of both themes:**
  `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu
  --hide-scrollbars --window-size=1280,820 --blink-settings=preferredColorScheme=0|1
  --screenshot=out.png <url>` — `0` is dark, `1` is light. ⚠️ **Two identical output sizes means the
  flag did nothing OR the page is unstyled — `cmp` them and look at one before concluding.**
  ✅ `--dump-dom` with `--virtual-time-budget=3000` confirms the stamped `data-theme` independently.
- ⚠️ **`npx tsx --eval` cannot use top-level `await`** ("cjs output format"). Put throwaway probes in
  a `tests/*.test.ts` and run vitest, or use `node --input-type=module -e`.

**Driving the editor** (all still true, all cost a session each):

- 🔴 **`BaseDialog`'s two copies sit at IDENTICAL coordinates.** `querySelector` takes the measuring
  one. Filter properly — `roots[i].closest('[class*=MeasuringContainer]')` must be **falsy**.
- 🔴 **When a control does not respond, drive something else on the same surface with a DIFFERENT
  mechanism first.** A failure shared by both is your instrument's.
- 🔴 **A CDP click into an `overflow: auto` list can hit a different row.** Verify with
  `document.elementFromPoint(...)` and `row.contains(hit)` **before** clicking.
- ⚠️ **A poll-driven React list replaces its DOM every tick.** Tag and click **in one shell chain**.
- 🔴 **`LocalProjectsModel.openProjectFromFolder()` does not route**, and a **reload returns you to
  the launcher**. Working path: open → reload → click the card → `switchToComponent`.
- ⚠️ **A node that is not mounted answers `exists: false` for every port.**
- 🔴 **`require('./src/...')` does not work in the renderer.** Push a fake chunk:
  `window.webpackChunknoodl_editor.push([['probe'],{},r=>{window.__wr=r}])`. ⚠️ Lost on every reload.
- 🔴 **`forEachNode` STOPS on a truthy return.** Use a **block body**.

**The platform repo:**

- 🔴 **Never generate DDL from `src/db/schema.ts`.** It is a query mirror; rulings live in
  `src/db/sql/`.
- 🔴 **The schema drift spec checks tables and columns ONLY — including NOT enum names.** Non-vacuity
  floors: drift **32**, free-text census **80**, AC3 sweep exports **40**, route sweep **6 routes**,
  🆕 **token drift 390/36/84 declarations**, 🆕 **built-CSS sweep 200 declarations**.
- 🔴 **A route handler is outside every sweep this phase built** — they quantify over module exports.
  `tests/uni011-mirror-api.test.ts` reads routes **off disk**.
- 🔴 **`created_at` is not an ordering key** — `submission_gradings.seq` is a `bigserial`.
- 🔴 **PostgreSQL does not guarantee short-circuit `or`**, and reading `OLD` during an INSERT is a
  runtime error rather than a null.
- 🔴 **A backtick inside a SQL comment nested in a tagged template literal opens a new template.**
  🆕 **And the same family bit again in plain JS: a `*/` written inside a JSDoc comment closes it
  early**, and the syntax error surfaces forty lines later on an innocent template literal.
- 🔴 **postgres.js has no nested `begin`.** 🔴 **`gen_random_bytes` needs pgcrypto.**
- ⚠️ **`expect(value, message)` is vitest, not jest.** The platform suite takes the second argument;
  this checkout's `test:main` does not, and it fails at compile.

**Both:**

- 🔴 **`/usr/bin/grep -a`, always.** Plain `grep` here is ugrep and silently skips `.ts` as binary.
  ⚠️ Quote your globs — `--include=*.ts` unquoted is expanded by zsh and the call dies.
  🆕 ⚠️ **BSD `sed` has no `\b`** — `s/--site-link\b/…/` silently matches nothing.
- 🔴 **A literal NUL byte in a `.ts` file makes git call it binary and grep skip it.** Same for a
  stray **U+FFFC**.
- 🔴 **`ports`, not `dynamicports`, is how a `Component Inputs` node declares its interface.**
- 🔴 **The `lesson` MCP group is DEFERRED** — `find_tools({group:"lesson"})` first.
- 🔴 **A ruling names a PLACE; ruling it does not CHECK the place.** D15/D16/D17 all said *"behind the
  API"* and there was no API. Derive from **disk**, not from module exports.
- `suggestedNodes` is still **dead** — no callers.
