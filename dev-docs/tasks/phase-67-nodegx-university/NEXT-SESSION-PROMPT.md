# Phase 67 — next session prompt

Paste the block below into a fresh session.

---

Continue phase 67 (NodeGX Community), `dev-docs/tasks/phase-67-nodegx-university/`.

**Read first, in this order:** `RULINGS.md` — the queue is EMPTY (D15/D16/D17 ruled 2026-08-16),
and ⚠️ **read the postscript at the end of the D15/D16/D17 section**. Then §"WHERE THE PHASE
ACTUALLY IS" below, then `TASKS.md`'s table, then your task file. `PRIOR-ART-RECONCILIATION.md`
if you have not read it.

🔴 **Two repos.** Editor work is this checkout. Platform work is
`/Users/richardosborne/vscode_projects/nodegx-community` — a **sibling directory, never nested** —
pushing to `The-Low-Code-Foundation/nodegx-community`. None of this checkout's gates, peers or
traps apply there.

---

# WHERE THE PHASE ACTUALLY IS — measured 2026-08-16, not remembered

| Track | Tasks | State |
|---|---|---|
| **Platform** | UNI-001 (AC3), 002–006, 009, **011 slice 1** | 🟢 **SEVEN COMMITS.** `7193f92`, **pushed** |
| **Platform** | UNI-008 | 📋 **One task, not started** — Tier 3, deliberately last |
| **Platform** | UNI-001 (the rest) | 🔴 **Blocked on Richard**: OAuth callbacks need `community.nodegx.dev`, still unregistered |
| **Editor** | UNI-011 slice 1 | 🟢 `f7b0b280` — the client and the post-body boundary |
| **Editor** | UNI-011 slice 2a — **AC2** | 🟢 **BUILT AND DRIVEN**, `f73b1bd6` |
| **Editor** | UNI-011 slice 2b — **AC3** | 🟢 **BUILT AND DRIVEN**, `f72799b7`. 🆕 |
| **Editor / MCP** | UNI-007, UNI-010, UNI-012 | UNI-007 slices 1–5 + tutor overlay; UNI-010 five slices **KEEP**; UNI-012 scoped, not built |

🔴 **UNI-011's editor-only half is COMPLETE.** AC2 and AC3 are the two criteria D14 calls *"the
reason to transition"*, and both are met and driven. **Everything still open in that task needs a
forum (UNI-009) or an issuer (UNI-001) that does not exist** — so do not open UNI-011 looking for
work. There is none in it that a session can do.

## What the twenty-second session did

**LANE A — UNI-011 AC3, *"share what you're seeing"*.** A capture of the running preview plus the
live port values behind it, with a **toggle per port**, the default **off** for anything
record-shaped, and nothing leaving the machine before the button. Built into the **AC2 composer**
rather than a second dialog, because the criterion's own verb is *attached* and two composers means
two payloads and two chances for the string shown to stop being the string sent.

`f72799b7`: `portshare.ts`, `nodesharecontext.ts`, `isLibraryPort` exported from `nodeexcerpt.ts`,
the composer's attachment section, `VisualCanvas`'s registration, **23 specs**.

### 🔴 The finding: AC3 cannot use AC2's instrument, and the reason generalises

`nodeexcerpt.ts` can claim *"every string it emits is chosen from a set the editor owns"*, and that
is strong **precisely because a graph's structure has an editor-owned form**. A live port value has
none. It **is** the user's data — the entire reason anyone would attach it — so a closed vocabulary
would either publish nothing or be a vocabulary of one entry per value.

⚠️ **The trap is that AC2's instrument is right there and looks reusable.** Copying it would have
produced a sweep with AC2's shape that asserts nothing, because there is no set to check against.

The instrument becomes **provenance under consent**: every published string must trace to a port
whose toggle was **on**, in the form the composer displayed. Graded from both sides — a
known-**broken** probe that publishes an unticked row, and an assertion of what survived.

🔴 **The corollary is a deliberate divergence: port names are NOT bucketed here.** The excerpt
hides a user-authored port name because nothing asked the user about that port; here they read name
and value side by side. **A consent screen that hides the thing being consented to is worse than no
consent screen.** AC2's rule becomes **the default** instead — one of two independent grounds.

### 🔴 The drive's finding: the app preview was never in the capture registry

UNI-011's own scope note said *"✅ Both halves already exist"*, naming `livePreviewCapture.ts`.
**True of a different preview.** That registry is BLD-014's and its only registrants were the two
**AI sandbox** surfaces, so `hasLivePreview()` returned **false** with a preview running in front of
the user — on the very surface whose port values the other half reads. Fixed in `VisualCanvas`.

*Build the caller*, **eighth** instance, and the first where the missing caller was asserted present
**in the task's own scope section**. The generalisation is D15's, in a new place: *a note that names
a mechanism is a claim about a place, and the place is not checked by naming it.*

### 🆕 The instrument defect, and the control that caught it

Two of this repo's own traps fired at once. `BaseDialog` renders every dialog **twice**, and
`document.querySelector` returned the **measuring** copy — which sits at *identical coordinates* to
the real one. So every reading was right (same React tree) but every **click** landed on the real
dialog's **differently-scrolled** list and toggled a row nobody touched: `textAlignX` was found ON
having never been clicked.

🔴 **The control that saved the drive was the excerpt checkbox** — the one checkbox in that dialog
that is *not* poll-driven. It toggled with the identical technique, which located the fault in the
instrument rather than in the feature. Without it, the honest write-up would have been *"AC3's
toggles do not work"*, and the fix would have been aimed at code that was correct.

⚠️ **Generalise it:** when a control fails to respond, find something *else* on the same surface
driven by a *different* mechanism and drive that first. A failure shared by both is yours; a failure
only the target shows is the feature's.

---

# What to do next — pick a lane and say which

**LANE A — D17's half: something that serves a curriculum index.** The ruling's v0 is GitHub Pages
on `nodegx-community`, and ⚠️ **`has_pages: false` as of 2026-08-16** (re-measure; it stops being
free after the first deploy). This is the one piece of *ruled, unblocked, unbuilt* work left in the
phase that needs neither a forum nor a domain. 🔴 A lesson must stay installable from a **local
directory with no origin**, whatever else changes.

**LANE B — UNI-012, F4 on a packaged install.** Ruled by Richard (*ship the harness*), scoped, not
built. ⚠️ **Verifiable only against a packaged build** — and a shipping claim nobody exercised is
the artifact this phase has found wrong four times. The F4 packaged-install **scope call is still
Richard's** and still open.

**LANE C — UNI-008, hosted publishing.** Last unbuilt platform task. 🔴 D9 made it a
**data-holding** problem, five obligations including a DPA and a retention policy. Deliberately last.

**LANE D — the smaller editor remainder.** TUTOR-BOUNDARY §5's six adversarial attacks (needs a
live provider); the D5 recents measurement, still spoiled; the `LessonEvidence` field-list pin.

**LANE E — the mirror surface (UNI-011 AC1/AC6).** ⚠️ **Still NOT recommended.** D16's gate cannot
be met — no forum ⇒ no `weeksWithCallHeld`, no `medianFirstReply` — and its ship order says last.

**My recommendation: A.** It is the only ruled work left that is blocked on nobody, and its window
(Pages unattached) is the one thing in this phase that gets *more* expensive by waiting.

## ⚠️ For Richard — item 1 is unchanged and still blocks seven things

1. 🔴 **`community.nodegx.dev` is still not registered.** Blocks UNI-001's OAuth callbacks. **The
   one thing a session cannot do for itself.** It is also `COMMUNITY_URL` in
   `AskAboutNodeDialog.tsx` — the composer's button points at a domain that does not resolve.
2. 🔴 **A Paddle account (D7)** still stands between coaching and revenue. `recordPayment` has no
   caller.
3. **The twelve badge artworks still need drawing.** D4 ruled ~12 flat SVGs in the editor's idiom.
4. ⚠️ **GitHub Pages still unattached** (`has_pages: false`, 2026-08-16) — D17's v0 remains free to
   set up. **It stops being free after the first deploy.**
5. ⚠️ **The F4 packaged-install scope call** (UNI-012) is still yours and still open.
6. **UNI-011 slice 1's judgement call**, reversible, one line: the assignments endpoint is **not**
   subject to D15.
7. ⚠️ **AC2 and AC3 both hand off to the browser rather than posting**, because there is no forum
   and no issuer. 🆕 **AC3 additionally writes the capture PNG to your Documents folder** so it can
   be dragged into a browser composer. `saveCaptureNextTo` is the single function that becomes an
   upload when there is somewhere to upload to.
8. ⚠️ **Carried and still open:** UNI-006's three calls, UNI-005's two, UNI-004's *"responding to an
   RFP requires clearing D8's bar"*, and UNI-003's change to UNI-002's catalogue.

## Gates (2026-08-16, twenty-second session)

- **This checkout: `test:main` 227 suites / 3527 specs, all pass** — measured this session, on a
  tree carrying **other sessions' uncommitted work**, so the total is not purely mine. My own delta
  is measurable and small: `tests-unit/uni-011/` went **86 → 109** specs, +1 suite.
- **eslint clean on every touched file.** ⚠️ `VisualCanvas.tsx` reports **two**
  `react/no-unknown-property` errors on its `<webview>` attributes — **pre-existing**, verified by
  running eslint on the file *as it is at HEAD*, which reports the identical two.
- **`tsc --noEmit -p tsconfig.tests-main`: 31 errors**, the same pre-existing count slices 1 and 2a
  recorded, **none in these files**.
- **Three control runs, each proved to bite**: consent set ignored → **6** fail; defaults rule
  removed → **5**; strict fallback flipped to `scalar` → **6**.
  🔴 **The first control found one of my own specs dead** — its "unticked rows are not published"
  assertion used a *path-shaped* marker, which `redact()` removes on its own, so it passed with the
  consent set ignored entirely. Fixed to a marker the redactor does not touch; the control then went
  5 → 6. *A spec whose absence is already guaranteed by a different mechanism cannot detect the
  removal of the mechanism it names.*
- ⚠️ **No `test:ci` was run.** Do not quote one from this handover — there isn't one.
- ⚠️ **A `mcp-004/mcpRuntime` failure was seen mid-session and is NOT mine and NOT flaky** — a peer
  was editing `mcpCommands.ts` live (mtimes minutes old). It passed once they finished. **Do not
  record it as a load-sensitive test.**
- **`nodegx-community`: 462 specs / 19 files, `tsc` clean, `next build` 21 routes** — carried from
  the twentieth session, **NOT re-measured**. Run `npm run db:up && npm test` from the sibling
  checkout. ⚠️ `npm run lint` is **STILL not a gate there** — no ESLint config; it has never run.

## Standing constraints

- Editor work on `cline-dev`. 🔴 **Never `git stash`** — ⚠️ **there is already a stash on this
  checkout that is not yours** (`stash@{0}`, WIP on `ff74bcc9`). Leave it alone.
  ✅ **`git commit <pathspecs>`, never stage.** ⚠️ Untracked files are the one case needing
  `git add` — put add and commit in **one chain** with the message **already in a file**.
- 🔴 **`cd` does not persist between tool calls here**, and a `cd` inside one does not leak out.
  ✅ **Run jest as `npm --prefix packages/noodl-editor run test:main -- <path>`** — invoking `jest`
  from the repo root silently picks the wrong config.
- 🔴 **Port 55432 for the platform's Postgres, never 5432.**
- 🔴 **This checkout is SHARED — 21 peers were live this session.** Peer messages are for
  **blocking or hazardous** things only. ✅ **A peer asked whether the 9222 stack was mine; answering
  and pinging on teardown was right. Broadcasting a launch to 21 peers would not have been.**

## Things the next person will otherwise re-derive

- 🆕 🔴 **`BaseDialog`'s two copies sit at IDENTICAL coordinates.** `querySelector` takes the
  measuring one. Filter properly — `roots[i].closest('[class*=MeasuringContainer]')` must be
  **falsy** — because reading the wrong copy gives *correct values* and *misdirected clicks*.
- 🆕 🔴 **A CDP click into an `overflow: auto` list can hit a different row.** Verify with
  `document.elementFromPoint(...)` and `row.contains(hit)` **before** clicking, and diff the whole
  row set afterwards rather than only the row you aimed at.
- 🆕 ⚠️ **A poll-driven React list replaces its DOM every tick**, so a `data-*` tag you set is gone
  a second later. Tag and click **in one shell chain**, or select by text each time.
- 🆕 🔴 **`LocalProjectsModel.openProjectFromFolder()` does not route**, and a **reload returns you
  to the launcher**. The working path is: open → reload → click the card → `switchToComponent`.
- 🆕 ⚠️ **A node that is not mounted answers `exists: false` for every port**, which renders as an
  empty list and looks exactly like a broken channel. The fixture's component was never placed on
  the page; the port channel was fine the whole time.
- 🔴 **Driving the editor: `require('./src/...')` does not work in the renderer.** Push a fake
  chunk: `window.webpackChunknoodl_editor.push([['probe'],{},r=>{window.__wr=r}])`, then
  `__wr('./src/editor/src/…​.ts')`. ⚠️ **The handle is lost on every reload — re-push.** Module ids
  are source paths; `Object.keys(__wr.m)` finds one when you guess wrong.
- 🔴 **`forEachNode` STOPS on a truthy return.** Use a **block body**.
- 🔴 **Never generate DDL from `src/db/schema.ts`.** It is a query mirror; rulings live in
  `src/db/sql/`.
- 🔴 **The drift spec checks tables and columns ONLY — including NOT enum names.** Non-vacuity
  floors: drift **32**, free-text census **80**, AC3 sweep exports **40**, route sweep **6 routes**.
- 🔴 **A route handler is outside every sweep this phase built** — they quantify over module
  exports. `tests/uni011-mirror-api.test.ts` reads routes **off disk**.
- 🔴 **A literal NUL byte in a `.ts` file makes git call it binary and grep skip it.** Same for a
  stray **U+FFFC**, which can be typed into JSX without any tool complaining.
- ⚠️ **`expect(value, message)` is vitest, not jest.** The platform suite takes the second argument;
  this checkout's `test:main` does not, and it fails at compile.
- 🔴 **`created_at` is not an ordering key** — `submission_gradings.seq` is a `bigserial`.
- 🔴 **PostgreSQL does not guarantee short-circuit `or`**, and reading `OLD` during an INSERT is a
  runtime error rather than a null.
- 🔴 **A backtick inside a SQL comment nested in a tagged template literal opens a new template.**
- 🔴 **postgres.js has no nested `begin`.** 🔴 **`gen_random_bytes` needs pgcrypto.**
- 🔴 **`ports`, not `dynamicports`, is how a `Component Inputs` node declares its interface.**
- 🔴 **`/usr/bin/grep -a`, always.** Plain `grep` here is ugrep and silently skips `.ts` as binary.
  ⚠️ And **quote your globs** — `--include=*.ts` unquoted is expanded by zsh and the call dies.
- 🔴 **The `lesson` MCP group is DEFERRED** — `find_tools({group:"lesson"})` first.
- `suggestedNodes` is still **dead** — no callers.
