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

Richard asked for a prompt that gets the rest of the phase done. Measured against the twelve task
files, **that is not a thing a session can deliver, and the prompt would be lying if it implied
otherwise.** The remainder splits cleanly in two, and the split is the most useful thing in this
document:

| | Tasks | Who |
|---|---|---|
| **Buildable now, blocked on nobody** | UNI-013 slices 1–3, UNI-012, (probably) UNI-007's intake | **a session** |
| **Blocked on a purchase, an account, an artwork or a decision** | UNI-009 AC1+AC3, UNI-011 AC1+AC6, UNI-001's remainder, UNI-004's revenue, UNI-013 slice 4, UNI-008, deployment | **Richard, and only Richard** |

🔴 **Six of the seven blocked items trace to four asks**, listed in §"FOR RICHARD" at the bottom in
the order of how much each unblocks. **A forum is the big one — it alone gates three tasks.** If you
read one section of this file to Richard, read that one.

⚠️ **So the useful shape of the next few sessions is: finish the buildable set, and shrink the ask
list to something Richard can act on in an afternoon.** Do not open a blocked task hoping the block
has moved — check the ask list first, it is one `dig`, one `gh api` and one question each.

---

# WHERE THE PHASE IS — re-measured 2026-08-17 (session 23), not remembered

| Track | Tasks | State |
|---|---|---|
| **Platform** | UNI-001 (AC3), 002–006, 009 content cut, **011 slice 1** | 🟢 **SEVEN COMMITS, pushed.** HEAD `7193f92`, `main` == `origin/main`, **working tree clean** — verified 08-17 |
| **Platform** | **UNI-013** — the site's look | 🆕 **SCOPED, D18 ruled (azure). Blocked on nobody. This is the lane.** |
| **Platform** | UNI-007 intake / personalised path | 🟡 **The one platform-side piece nobody has looked at.** ⚠️ Check whether it needs an issuer *before* opening it |
| **Platform** | UNI-008 | 📋 Tier 3, not started, deliberately last. D9's five obligations include a DPA and a retention policy — **policy text is Richard's, not a session's** |
| **Platform** | UNI-009 AC1 + AC3 | 🔴 **Discourse, SSO, webhook receiver — a purchase nobody has made** |
| **Platform** | **deployment** | 🔴 **Owned by NO TASK, and needs a decision before it can be scoped** |
| **Editor** | UNI-011 slice 1, AC2, AC3 | 🟢 `f7b0b280`, `f73b1bd6`, `f72799b7` — **the editor-only half is COMPLETE** |
| **Editor** | UNI-011 AC1 + AC6 (the mirror surface) | 🔴 Needs a forum. D16's gate cannot be met without one |
| **Editor / MCP** | UNI-007 slices 1–4, UNI-010 slices 1–2 | 🟢 Built and driven. UNI-010's five slices **KEEP** |
| **Editor / MCP** | **UNI-012** | ✅ **Ruled (ship the harness), scoped, NOT built. Buildable now** |

🔴 **UNI-011's editor half is done — do not open it looking for work.** AC2 and AC3 are the two
criteria D14 calls *"the reason to transition"*, both met and driven. Everything still open in it
needs a forum (UNI-009) or an issuer (UNI-001).

## Re-measured this session, with the instrument

- `dig +short community.nodegx.io` → **`49.12.102.195`** (nexus-1). Still resolves.
  ⚠️ **Resolving is not being served** — nexus-1 runs the static landing page and two of Richard's
  sites; Caddy has no site block for this host. 🔴 **A response proves nothing** — Caddy 308s every
  Host, including invented ones. Read `127.0.0.1:2019/config/`.
- `gh api repos/The-Low-Code-Foundation/nodegx-community` → **`has_pages: false`**,
  `pushed_at: 2026-08-16T19:23:45Z`. D17's v0 is still free to set up; **it stops being free after
  the first deploy.**
- **Deployment artefacts: still none.** No `Dockerfile`, no `.github/`, no `ops/`, no `fly.toml`.
  🔴 **Correction to the last handover, which listed the absences and omitted this: there IS a
  `docker-compose.yml`.** It is **dev and test Postgres only** (port 55432, one `db` service) and is
  not a deployment artefact. A session skimming for "is there a compose file" will find one and
  mis-read it. `scripts/` holds `seed.mjs`, `wait-for-db.mjs`, `provision-org.mjs` and nothing else.
- **Lint on the platform: `package.json` HAS a `lint` script (`next lint`) and there is NO ESLint
  config anywhere in the repo.** So the script exists, has never run, and running it starts Next's
  interactive setup rather than linting. ⚠️ **"There is a lint script" is not "there is a lint
  gate"** — the previous handover was right about the gate and a reader checking `package.json`
  would conclude it was wrong.

## NOT re-measured — do not quote these as current

- **`nodegx-community`: 462 specs / 19 files, `tsc` clean, `next build` 21 routes.** Carried from the
  twentieth session. 🔴 **UNI-013's AC5 is "the existing specs pass unchanged", so a stale baseline
  makes that criterion unfalsifiable.** Measure it *before* you touch a stylesheet:
  `npm run db:up && npm test` from the sibling checkout. **Write the number you got, not this one.**
- **No `test:ci` was run this session or last.** Do not quote one from a handover — there isn't one.

---

# What the twenty-third session did

**Not phase 67.** Richard asked, at the end of session 22, for the launcher's Learning section to
move into its own tab. Done, driven, committed `7b7a7784`, and filed as **FIX-024 in phase 66** —
not as a UNI number, because the complaint is about the launcher's opening screen and phase 66 is the
current phase scoped from a user test. See
`dev-docs/tasks/phase-66-0.1.7-bug-fixes/FIX-024-THE-LAUNCHER-OPENS-ON-LEARNING.md`.

**Two findings from it that generalise past the launcher:**

🔴 **The tab affordance already existed.** `HEADER_TABS`, the accent underline, `aria-current`, the
persisted tab and a deep-link parser all shipped with PAR-001. The ask read like "build tabs in the
launcher" and was one table entry plus a view. *The same shape as this phase's repeated finding: a
note that names a mechanism is a claim about a place, and naming it does not check it — except
inverted. **Check for the mechanism before building it, not only before trusting it.***

🔴 **`'learn'` and `'learning'` are two different launcher pages, one letter apart.** `'learn'` is
POL-002's retired lesson catalogue, kept compiled and reachable from nothing; `'learning'` is D5's
installed-lessons section. Reusing the id would have put the dead catalogue behind the live tab.
⚠️ **The spec asserts both directions** — accepts `'learning'`, still rejects `'learn'` — because one
that only checked the first would pass just as happily with both accepted. *A spec over a
discriminator must grade the discrimination, not one side of it.*

⚠️ **Also found, unowned:** **noodl-core-ui cannot be eslinted at all.** Its `eslintConfig` extends
`react-app`, which is not installed; every file in the package fails identically, confirmed against
an untouched control file. Pre-existing. It means *"eslint clean on every touched file"* in past
handovers was never true of core-ui files — it could not have been.

---

# THE PLAN — do these in this order

## 🟢 LANE A (do this first) — UNI-013, the community site in NodeGX clothes

**Blocked on nobody. D18 ruled azure. Scoped 2026-08-17.** Three of its four slices are a session's
work; the fourth is Richard's.

🔴 **Read the task file's §"The load-bearing question" before writing any CSS.** The site has **no
design system** — seven custom properties, all fourteen pages built on them, accent `#4b9fff` against
the editor's `#4da3ff`. **Those four hex digits are the diagnosis**: someone aimed at the editor by
eye, nothing was imported, nothing stayed in sync. **A second hand-made copy drifts exactly as the
first one did**, so the deliverable of slice 1 is the *drift test*, not the paint.

- **Slice 1 — the token substrate.** Sync script, vendored `colors.css` + `fonts.css`, drift test,
  `globals.css` rewritten to consume them. **No markup touched. Most of the win.**
  🔴 **The drift test must compare every declared property AND its value.** It inherits the schema
  drift spec's known hole — that one compares tables and columns *and not enum names*, and a half-done
  rename passed it. **A check that compares how many tokens exist passes on two files with the same
  number of different colours.**
  🔴 **Non-vacuity floor: change one hex in the vendored copy and show it go red, in the same commit.**
- **Slice 2 — type and rhythm.** ⚠️ **`Bricolage Grotesque 600` is a bundled woff2** — on the web it
  needs serving and a fallback, and it is the one asset that does not travel as a token.
- **Slice 3 — the six components that carry identity** (profile header, badge, people card, replay
  row, RFP row, org shelf item).
- **Slice 4 — the twelve badges. 🔴 Richard's to draw or delegate. It is the one slice that is not
  code.** The profile currently renders a family mark and a tier colour rather than a broken image,
  which was deliberate — so this degrades, it does not block.

⚠️ **AC1 wants a sweep over the BUILT CSS for hex literals and raw `px` font sizes, with a known-bad
probe.** Not inspection. ⚠️ **AC2's specific bug to test for is a token defined *only* inside a media
query** — it renders one theme's text on the other theme's ground.
🔴 **Do not let A quietly become the deployment lane.** They are adjacent, C is bigger, and C needs
Richard.

## 🟢 LANE B — UNI-012, F4 on a packaged install

**Ruled (ship the harness), scoped, not built, blocked on nobody to build.**

⚠️ **Verifiable only against a packaged build, and *"a shipping claim nobody exercised"* is the
artifact this phase has found wrong four times** — so the packaged verification is the task, not a
formality. 🔴 **Two measured facts qualify the ruling**: the harness probes for a **system Chrome**
and refuses without one, so shipping it makes `allow_unrendered` *rare* rather than unnecessary
(**both halves of the either/or are probably wanted**); and rendering through the sidecar's own
Electron is closed by `ELECTRON_RUN_AS_NODE=1`, which is load-bearing and measured.
✅ CN-001 already did the structural half (`@nodegx/render-measure`).
⚠️ The **F4 scope call** is still Richard's — but it does not block the build.

## 🟡 LANE C — UNI-007's intake and personalised path

The one platform-side piece of UNI-007 nobody has opened. ⚠️ **First question, before anything else:
does intake need an issuer?** If a path can be produced for an anonymous visitor it is buildable now;
if it hangs off an account it joins the blocked pile and you should say so and stop. **Ten minutes to
answer, and the answer decides whether this is a lane at all.**

## 🔴 LANE D — deployment: scope it, do not build it

**Measured again 2026-08-17 and it is still the phase's real gap.** No task owns it, and a grep across
all twelve task files for deploying the platform returns **zero hits**. UNI-008 is about hosting
*users'* apps, not this.

🔴 **This is the same shape as UNI-011 slice 1's finding** — D14 said the API was a deliverable, no
task owned it, so it did not exist. ⚠️ **Needs a decision from Richard first** (does it go on
nexus-1?), so **write the task file and stop**. That box is all-or-nothing on Caddy config and it is
a bigger call than a DNS record.

## ⛔ LANES THAT ARE BLOCKED — check the ask list, do not open these

- **UNI-009 AC1/AC3** — Discourse, SSO, webhook receiver. A purchase.
- **UNI-011 AC1/AC6** — needs a forum. D16's gate cannot be met (no forum ⇒ no `weeksWithCallHeld`,
  no `medianFirstReply`), and its ship order says last.
- **UNI-001's remainder** — DNS resolves, so callbacks *can* be registered, but the OAuth app and its
  secrets are Richard's.
- **UNI-004's revenue path** — `recordPayment` has no caller and needs a Paddle account (D7).
- **UNI-008** — Tier 3, and D9's five obligations include a DPA and a retention policy. **Policy text
  is not a session's output.**

---

# ⚠️ FOR RICHARD — four asks, ordered by how much each unblocks

1. 🔴 **A forum (Discourse). This is the big one — it alone gates three things:** UNI-009 AC1+AC3,
   UNI-011's mirror surface (AC1+AC6), and D16's whole gate, which cannot be evaluated without
   `weeksWithCallHeld` and `medianFirstReply`. Everything else on this list unblocks one task each.
2. 🔴 **Does the platform go on nexus-1 at all?** Deployment is owned by no task and cannot be scoped
   without this. ⚠️ nexus-1 is **all-or-nothing on Caddy config** and already serves the landing page
   plus two of your sites — so this is a bigger call than the DNS record was, and it is the one that
   decides whether anyone ever sees any of this.
3. **The twelve badge artworks.** D4 ruled ~12 flat SVGs in the editor's idiom. Degrades rather than
   blocks (the profile draws a family mark and a tier colour), but it is UNI-013 slice 4 and it is
   not code.
4. **A Paddle account (D7)**, which still stands between coaching and revenue.

**Smaller, still open, carried:**

- ⚠️ **GitHub Pages is still unattached** (`has_pages: false`, re-measured 08-17). D17's v0 is free
  to set up **until the first deploy**.
- ⚠️ **The F4 packaged-install scope call** (UNI-012) — does not block the build, does shape it.
- **UNI-011 slice 1's judgement call**, reversible, one line: the assignments endpoint is **not**
  subject to D15.
- ⚠️ **AC2 and AC3 both hand off to the browser rather than posting**, because there is no forum and
  no issuer. **AC3 additionally writes the capture PNG to your Documents folder** so it can be
  dragged into a browser composer. `saveCaptureNextTo` is the single function that becomes an upload
  when there is somewhere to upload to.
- **Carried and still open:** UNI-006's three calls, UNI-005's two, UNI-004's *"responding to an RFP
  requires clearing D8's bar"*, and UNI-003's change to UNI-002's catalogue.

✅ **Closed since last time:** the domain. `community.nodegx.io` resolves (A → nexus-1). 🔴 **The
blocker was mis-stated for four days** — never *"a domain needs registering"* (`nodegx.io` was
already registered and serving), but *"a subdomain needs an A record"*. D2 flagged its own subdomain
as *"a choice, not a fact"* and six handovers turned it into a fact anyway. **The check was one
`dig`.**

---

# Gates

**This checkout (2026-08-17, session 23):**

- `test:main` — only the launcher spec was run (`tests-unit/launcher/`, 3 specs, pass, control run
  1/3 red). 🔴 **No full-suite number was taken this session. Do not quote one.**
- `tsc --noEmit -p tsconfig.tests-main`: **31 errors**, the same pre-existing count slices 1, 2a and
  2b recorded, none in touched files.
- ⚠️ **eslint: the editor package is clean; noodl-core-ui CANNOT BE LINTED** (see above). If you
  touch core-ui, say so honestly rather than claiming a clean lint.
- ⚠️ **No `test:ci`.**

**`nodegx-community` (session 23):** working tree clean, `main` == `origin/main`, HEAD `7193f92`.
🔴 **Suite NOT re-measured** — see §"NOT re-measured".

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
  Announce **source edits**, not just runs. ✅ Answering a peer who asks whether the 9222 stack is
  yours, and pinging them on teardown, is right; broadcasting a launch to twenty peers is not.
- ✅ **Before launching the editor: `npm run dev:stop -- --list`**, and check nobody is mid-`test:ci`
  (`ps -Ao pid,ppid,args | grep -a run-electron-tests`). Both were clean this session.

---

# Things the next person will otherwise re-derive

**Driving the editor** (all still true, all cost a session each):

- 🔴 **`BaseDialog`'s two copies sit at IDENTICAL coordinates.** `querySelector` takes the measuring
  one. Filter properly — `roots[i].closest('[class*=MeasuringContainer]')` must be **falsy** —
  because reading the wrong copy gives *correct values* and *misdirected clicks*.
- 🔴 **When a control does not respond, drive something else on the same surface with a DIFFERENT
  mechanism first.** A failure shared by both is your instrument's; a failure only the target shows
  is the feature's. This saved session 22's drive from publishing *"AC3's toggles do not work"* about
  correct code.
- 🔴 **A CDP click into an `overflow: auto` list can hit a different row.** Verify with
  `document.elementFromPoint(...)` and `row.contains(hit)` **before** clicking, and diff the whole row
  set afterwards rather than only the row you aimed at.
- ⚠️ **A poll-driven React list replaces its DOM every tick**, so a `data-*` tag you set is gone a
  second later. Tag and click **in one shell chain**, or select by text each time.
- 🔴 **`LocalProjectsModel.openProjectFromFolder()` does not route**, and a **reload returns you to
  the launcher**. The working path is: open → reload → click the card → `switchToComponent`.
- ⚠️ **A node that is not mounted answers `exists: false` for every port**, which renders as an empty
  list and looks exactly like a broken channel.
- 🔴 **`require('./src/...')` does not work in the renderer.** Push a fake chunk:
  `window.webpackChunknoodl_editor.push([['probe'],{},r=>{window.__wr=r}])`, then
  `__wr('./src/editor/src/….ts')`. ⚠️ **The handle is lost on every reload — re-push.**
- 🔴 **`forEachNode` STOPS on a truthy return.** Use a **block body**.

**The platform repo:**

- 🔴 **Never generate DDL from `src/db/schema.ts`.** It is a query mirror; rulings live in
  `src/db/sql/`.
- 🔴 **The schema drift spec checks tables and columns ONLY — including NOT enum names.** Non-vacuity
  floors: drift **32**, free-text census **80**, AC3 sweep exports **40**, route sweep **6 routes**.
- 🔴 **A route handler is outside every sweep this phase built** — they quantify over module exports.
  `tests/uni011-mirror-api.test.ts` reads routes **off disk**.
- 🔴 **`created_at` is not an ordering key** — `submission_gradings.seq` is a `bigserial`.
- 🔴 **PostgreSQL does not guarantee short-circuit `or`**, and reading `OLD` during an INSERT is a
  runtime error rather than a null.
- 🔴 **A backtick inside a SQL comment nested in a tagged template literal opens a new template.**
- 🔴 **postgres.js has no nested `begin`.** 🔴 **`gen_random_bytes` needs pgcrypto.**
- ⚠️ **`expect(value, message)` is vitest, not jest.** The platform suite takes the second argument;
  this checkout's `test:main` does not, and it fails at compile.

**Both:**

- 🔴 **`/usr/bin/grep -a`, always.** Plain `grep` here is ugrep and silently skips `.ts` as binary.
  ⚠️ And **quote your globs** — `--include=*.ts` unquoted is expanded by zsh and the call dies.
- 🔴 **A literal NUL byte in a `.ts` file makes git call it binary and grep skip it.** Same for a
  stray **U+FFFC**, which can be typed into JSX without any tool complaining.
- 🔴 **`ports`, not `dynamicports`, is how a `Component Inputs` node declares its interface.**
- 🔴 **The `lesson` MCP group is DEFERRED** — `find_tools({group:"lesson"})` first.
- 🔴 **A ruling names a PLACE; ruling it does not CHECK the place.** D15/D16/D17 all said *"behind the
  API"* and there was no API. Derive from **disk**, not from module exports.
- `suggestedNodes` is still **dead** — no callers.
