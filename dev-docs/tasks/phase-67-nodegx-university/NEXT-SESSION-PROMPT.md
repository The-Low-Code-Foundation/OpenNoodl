# Phase 67 — next session prompt

Paste the block below into a fresh session.

---

Continue phase 67 (NodeGX Community), `dev-docs/tasks/phase-67-nodegx-university/`.

**Read first, in this order:** **[D19](RULINGS.md)** — ruled 2026-08-18, it reverses a prior ruling
and re-shapes the back half of the phase. Then §"THE HONEST READ" below, then §"WHERE THE PHASE IS",
then `TASKS.md`'s table, then your task file. `PRIOR-ART-RECONCILIATION.md` if you have not read it.

🔴 **Two repos.** Editor work is this checkout. Platform work is
`/Users/richardosborne/vscode_projects/nodegx-community` — a **sibling directory, never nested** —
pushing to `The-Low-Code-Foundation/nodegx-community`. None of this checkout's gates, peers or traps
apply there.

---

# 🔴 D19 — READ THIS BEFORE ANYTHING ELSE

**The forum is BUILT, not bought.** Discourse is out. Ruled 2026-08-18, reversing UNI-009's
*"bought, not built"*.

🔴 **The ruling is not "build a forum" — that framing is what makes this kind of project fail.**
It is: **the unit of content is not a post, it is a graph with a question attached.** Everything in
the tranche follows from the payload staying structured. Discourse's generic 80% (trust levels,
reply-by-email, digests, RSS, DMs, polls, wiki posts, revisions, user tags, plugins, themes) is a
**chosen absence**, listed in D19 so it cannot arrive later as a bug report.

**The pitch is an artifact and it is the design:**
**["Questions Made of Nodes"](https://claude.ai/code/artifact/7ac9fdff-757c-4cd0-8a94-879ba5fa1509)**
— thread and queue specimens in full CSS. 🔴 **Read it before writing markup.** UNI-013 lost a
session to building from a task file's prose when the design was an artifact.

⚠️ **D19 is CONDITIONAL on email landing first** (UNI-014). Every other gap in the tranche degrades
gracefully; that one does not.

---

# 🔴 THE HONEST READ — it changed, and mostly in the good direction

D19 moved four items **out of the "blocked on Richard" column** — not by buying anything, but by
making them ours to build. The buildable set is now large enough to fill many sessions.

| | Tasks | Who |
|---|---|---|
| **Buildable now, blocked on nobody** | **UNI-014** → **UNI-015** → **UNI-016** → UNI-017 → UNI-018 · **UNI-012** · (probably) UNI-007's intake | **a session** |
| **Was blocked on a purchase, now blocked on US** | UNI-009 AC1+AC3 (rewritten), UNI-011 AC1+AC6, D16's whole gate | **a session, in sequence** |
| **Still blocked on Richard** | deployment · UNI-013 slice 4 (artworks) · UNI-001's remainder · UNI-004's revenue · UNI-008 | **Richard** |

🔴 **The ask list went from four items to three, and the biggest one is gone.** A forum purchase
gated three things; it no longer exists. See §"FOR RICHARD".

⚠️ **The one that got sharper: deployment.** It is owned by no task, it needs a decision before it
can be scoped, and **a forum has to be somewhere**. It was the second ask before D19; it is the
first now.

---

# WHERE THE PHASE IS — 2026-08-18 (session 25)

| Track | Tasks | State |
|---|---|---|
| **Platform** | UNI-001 (AC3), 002–006, 009 content cut, 011 slice 1, **013 s1–s3** | 🟢 pushed, `201a71a` |
| **Platform** | **UNI-014** — the mail room | 🔴 **NOT BUILT. D19's condition. Start here.** |
| **Platform** | **UNI-015** — the Bench (ask/read/answer/accept) | 🔴 **NOT BUILT.** ⚠️ **Must not ship alone** — see its file |
| **Platform + editor** | **UNI-016** — artifact posts | 🔴 **NOT BUILT. This is the task D19 exists for** |
| **Platform** | UNI-017 — the queue and the signal | 🔴 NOT BUILT. Needs a backlog first |
| **Editor** | UNI-018 — pull a graph | 🔴 NOT BUILT. 🔴 **Read its §"THE HAZARD" before scoping** |
| **Platform** | UNI-007 intake / personalised path | 🟡 Still the one platform piece nobody has looked at |
| **Platform** | UNI-008 | 📋 Tier 3. D9's obligations include a DPA and a retention policy — **Richard's** |
| **Platform** | **deployment** | 🔴 **Owned by NO TASK. Now the top ask** |
| **Editor** | UNI-011 slice 1, AC2, AC3 | 🟢 met and driven. ⚠️ AC2/AC3 gain a posting path under UNI-016 |
| **Editor / MCP** | UNI-012 | ✅ Ruled, scoped, **NOT built. Buildable now** |
| **Platform** | UNI-013 slice 4 (12 badge SVGs) | 🔴 Richard's. Degrades rather than blocks |

## What session 25 did — scoping only, no code

D19 ruled and written up. **Five new task files** (UNI-014 … UNI-018). **UNI-009's AC1 and AC3
struck and rewritten.** Amendment banners added to **UNI-001, UNI-002, UNI-011** — each carried the
Discourse premise in its body, and *a premise surviving in a file nobody re-opened is this phase's
most-repeated failure*. `TASKS.md` gained five rows and four amended ones; `README.md` fixed.

🔴 **Nothing was built and no gate was run.** The platform tree is untouched at `201a71a`.

**Two things measured while scoping, both worth carrying:**

1. 🔴 **A pulled graph fragment is executable code from a stranger.** `simplejavascript.ts`: the
   node displayed as **`Function`** is `JavaScriptFunction` and carries **`functionScript`, a string
   that becomes executable JavaScript**; `Script` carries the same under `code`. The editor is
   Electron, so that is not a sandbox — and the delivery is perfectly disguised, arriving as *the
   answer to a question the victim asked*. This is why UNI-018 refuses code-bearing nodes at **two**
   enforcement points and derives its allow-list from parameter schemas rather than a deny-list.
2. 🔴 **`{forum: 'absent'}` loses its referent.** UNI-011 slice 1 shipped it as a 200 distinct from
   `{threads: []}`, because an unconfigured webhook made emptiness a fact about *our deployment*.
   Once we own the forum, an empty Bench is just empty. **Remove the branch; do not leave it
   unreachable** — a branch nothing can produce is a check that cannot fail, which this phase has
   now found four times.

---

# THE PLAN — do these in this order

## 🟢 LANE A — UNI-014, the mail room. **Start here.**

D19 is conditional on it, and it is owed to UNI-004 and UNI-006 anyway. 🔴 **Build the ROW first,
not the provider** — a notification is a row, email is one delivery of a row, and an org-minor
account *cannot hold an address* (`org_minor_holds_no_pii`), so notification-as-email is broken for
exactly the users D10 exists to protect. ✅ **Richard's sending account does not block it**: the
`log` transport is the default and the real one is a file behind an interface.

## 🟢 LANE B — UNI-015 then UNI-016, back to back

⚠️ **Do not ship UNI-015 alone.** Plain-text Q&A on our own stack is strictly worse than what we
chose not to buy; shipping it by itself is the one outcome that proves the buy case right. UNI-016
is the reason to build.

🔴 **UNI-015 carries the Discourse decommission — 11 files inventoried by path in its file.**
`forum_threads` is a six-column stub that existed only so D16 had something to read: **drop it, do
not migrate it.**

🔴 **The three-copy trap is the sharpest reuse question in the tranche** — `parsePostBody` →
`Block[]` lives in the **editor** checkout. Ruled: platform-side canonical, plus a shared golden
corpus whose hash is asserted in *both* repos. This pattern has bitten twice already
(`LessonEvidence`, `renderMarkdown`).

## 🟡 LANE C — UNI-012 (unchanged), UNI-007's intake (unchanged)

Both still buildable, both unaffected by D19. UNI-007's intake still wants its ten-minute question
answered first: **does it need an issuer?**

## 🔴 LANE D — deployment: scope it, do not build it

**Now the phase's top gap.** Needs Richard's nexus-1 decision first, so **write the task file and
stop.** That box is all-or-nothing on Caddy config and already serves the landing page plus two of
his sites.

---

# ⚠️ FOR RICHARD — three asks now, down from four

1. 🔴 **Does the platform go on nexus-1?** Deployment is owned by no task and cannot be scoped
   without it. **A forum has to be somewhere**, which is what promoted this to first.
2. **The twelve badge artworks** (UNI-013 slice 4). Degrades rather than blocks — the profile draws
   a family mark and a tier colour. `--site-tier-bronze` is the last literal colour on the site and
   retires when they land.
3. **A Paddle account (D7)**, still between coaching and revenue.

**Small, and none of them block a build:**

- **A transactional sending account** (Postmark / SES / Resend) + sending domain, for UNI-014. The
  `log` transport covers everything until it exists.
- **Where do capture images live?** UNI-016 turns `saveCaptureNextTo` into an upload. Blob column,
  object storage, or the deployment box — **it intersects ask 1**.
- ⚠️ **GitHub Pages still unattached** (`has_pages: false` as of 08-17). D17's v0 is free to set up
  until the first deploy.
- ⚠️ **The F4 packaged-install scope call** (UNI-012) — does not block the build, does shape it.
- **Carried and still open:** UNI-006's three calls, UNI-005's two, UNI-004's *"responding to an RFP
  requires clearing D8's bar"*, UNI-003's change to UNI-002's catalogue, and UNI-011 slice 1's
  *"assignments is not subject to D15"*.

⚠️ **Gone from this list, and worth saying so: the forum purchase.** It gated UNI-009 AC1+AC3,
UNI-011's mirror surface and D16's whole gate. D19 did not defer it — it removed it.

---

# Gates

🔴 **SESSION 25 RAN NOTHING — it was scoping only, in `dev-docs/` alone. Every number below is
inherited. Re-measure before you quote one.**

**`nodegx-community`:** HEAD **`201a71a`**, working tree clean, `main` == `origin/main`. Session
24's last measured figures were **548 specs / 21 files**, `tsc` clean, `next build` clean at **21
routes**, `check:css` clean over **775 declarations / 15 components**. ⚠️ **UNI-015 AC5 says count
by name against that floor and re-measure it first** — do not copy 548 forward.

**This checkout:** ⚠️ nothing run in sessions 24 or 25. The last measured numbers are session 23's:
`tsc --noEmit -p tsconfig.tests-main` **31 errors** (pre-existing, none in touched files); no full
`test:main`; **no `test:ci`**. 🔴 **Do not quote any of these as current.**

⚠️ **`npm run lint` is still not a gate on the platform** — `package.json` has the script, the repo
has no ESLint config, and running it starts Next's interactive setup. **State which artefact you
looked at.**

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
