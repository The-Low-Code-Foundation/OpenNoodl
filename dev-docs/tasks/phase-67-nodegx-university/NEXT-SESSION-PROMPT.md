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
| **Editor** | **UNI-011 slice 2a — AC2** | 🟢 **BUILT AND DRIVEN**, `f73b1bd6`. 🆕 |
| **Editor / MCP** | UNI-007, UNI-010, UNI-012 | UNI-007 slices 1–5 + tutor overlay; UNI-010 five slices **KEEP**; UNI-012 scoped, not built |

## What the twenty-first session did

**LANE A, narrowed to AC2 rather than the mirror home surface** — and the narrowing is the first
thing to carry. D16's ship order says *surface the mirror last*, and the threshold **cannot** be
met (no forum ⇒ no `weeksWithCallHeld`, no `medianFirstReply`). A mirror home built now is a
surface that must ship switched off, which is the shape the D15/D16/D17 postscript had just
finished writing up. **AC2's entry point — the node context menu — is not gated by D16**, is
editor-only, and its criterion is entirely about the *composer*.

✅ **AC2 MET and driven.** `f73b1bd6`: `nodeexcerpt.ts`, `nodequestion.ts`,
`nodequestioncontext.ts`, the `AskAboutNodeDialog`, the menu item, **31 specs**.

### 🔴 The finding: no payload in this editor had ever had to hide a PORT name

ALPHA-007 (`utils/report/`) already ships a redactor, an allow-listed diagnostics payload, a
hostile fixture and a composer dialog — **most of AC2 was prior art, and finding it was most of
the value.** But its project summary is a **histogram**, so no port name has ever left this
editor. AC2's excerpt is *"types and wiring"*, and wiring **is** port names.

`NodeGraphNode.getPorts()` is `type.ports` ++ `this.ports` ++ `this.dynamicports`. The last two
are user-authored by definition; the **first is user-authored too whenever the type is a component
instance**, because a component's ports are its `Component Inputs` declarations. So the rule
composes with the type rule: **a port name survives only when its node's TYPE survived.**

✅ `bucketTypeName` was **exported and imported**, not reimplemented — two implementations of one
privacy control is where a fix lands on only one of them.

### 🔴 The same helper, two ways, means opposite things

`bucketTypeName(name, null)` returns the type name **verbatim**. ALPHA-007's header names that
branch and accepts it. **Reachable** — the node library arrives asynchronously. This module passes
an **empty set** and gets `<unknown>`.

⚠️ **Recorded as a deliberate divergence, NOT an ALPHA-007 defect.** Its comment names the case
and takes the trade knowingly; calling a documented, accepted trade-off a defect is the over-claim
this phase warns about as loudly as the under-claim — slice 1's `renderMarkdown` precedent, in a
new place. The spec asserts **both** branches, because an empty set reads like a long way of
writing `null` and would otherwise be simplified back.

### 🆕 Two more that generalise

1. **A closed-vocabulary sweep beats a secret search when the payload is STRUCTURE.** A secret
   search is right for a regex redactor — the list of shapes *is* the spec. What leaks out of
   structure is an ordinary string in an ordinary place, and a search for known secrets only
   catches the ones on the list, written by whoever wrote the code. So: collect **every** string
   the output publishes and assert each came from a set the editor owns. Graded from both sides —
   a known-**broken** probe, and an assertion of what **survived**.
2. 🔴 **An ordering trap between two passes that look independent.** `WarningsModel` joins with
   `<br>` so markup must be stripped — but `redact()` **emits** `<url>` and `<path>`. Stripping
   afterwards deletes the very markers that say a secret was removed. **Strip first, redact
   second.**

### The drive

8 consequences written first, 8 observed, against a copy of **ALPHA-007's own hostile fixture**
(wiring and a component instance added so the excerpt had something to bucket):

```
n1: Group   <- this node        n1.hoverStart -> n2.visible
n2: Text                        n1.hoverStart -> n3.<port>
n3: <component>                 n1.hoverStart -> n4.<port>
n4: <unknown>
```

🔴 **Rows 7 and 8 are the two the unit specs structurally cannot reach** — they are about
`libraryPorts()` and `graphInputs()` reading the real `NodeLibrary` and `NodeGraphModel`, which
the pure half exists to avoid.

---

# What to do next — pick a lane and say which

**LANE A — UNI-011 AC3, "share what you're seeing."** The other editor-only feature, and the one
UNI-011 calls *"the single feature no browser-based forum can copy."* ✅ Both halves already
exist: `livePreviewCapture.ts` calls `capturePage()` on the preview webview and the bytes never
leave the machine; live port values come off the observe relay that feeds Provenance. Needs
per-port share toggles **defaulting to off for anything record-shaped** — which is the same
allow-list-versus-filter question AC2 just answered, on values instead of names.
⚠️ **Read `nodeexcerpt.ts`'s header first**; the argument transfers and the vocabulary should too.

**LANE B — make the login real.** Finish UNI-001. 🔴 **Blocked on Richard, not on work** —
callbacks need `community.nodegx.dev` and the domain **is not registered**. Blocks seven things.

**LANE C — UNI-008, hosted publishing.** Last unbuilt platform task. 🔴 D9 made it a
**data-holding** problem, five obligations including a DPA and a retention policy.

**LANE D — D17's half, and the editor remainder.** Nothing serves a curriculum index; the
ruling's v0 is GitHub Pages on `nodegx-community`, and ⚠️ `has_pages: false` as of 2026-08-16, so
attaching it is still free. Plus UNI-012; TUTOR-BOUNDARY §5's six adversarial attacks (needs a
live provider); the D5 recents measurement, still spoiled; the `LessonEvidence` field-list pin.

**LANE E — the mirror surface (UNI-011 AC1/AC6).** ⚠️ **Deliberately NOT recommended yet.** D16's
gate cannot be met and its ship order says last. Worth doing when there is a forum.

**My recommendation: A.** AC3 is the last untouched criterion in UNI-011, it is the feature D14
says is the reason to transition, both of its halves already exist, and AC2 just built the
vocabulary its redaction question needs.

## ⚠️ For Richard — item 1 is unchanged and still blocks seven things

1. 🔴 **`community.nodegx.dev` is still not registered.** Blocks UNI-001's OAuth callbacks.
   **The one thing a session cannot do for itself.** 🆕 It is now also the value of
   `COMMUNITY_URL` in `AskAboutNodeDialog.tsx` — the composer's "open the community" button
   points at a domain that does not resolve. One constant, one line, deliberately in one place.
2. 🔴 **A Paddle account (D7)** still stands between coaching and revenue. `recordPayment` has no
   caller.
3. **The twelve badge artworks still need drawing.** D4 ruled ~12 flat SVGs in the editor's idiom.
4. ⚠️ **GitHub Pages still unattached** (`has_pages: false`, 2026-08-16) — D17's v0 remains free
   to set up. It stops being free after the first deploy.
5. ⚠️ **The F4 packaged-install scope call** (UNI-012) is still yours and still open.
6. **UNI-011 slice 1's judgement call**, reversible, one line: the assignments endpoint is **not**
   subject to D15.
7. 🆕 ⚠️ **AC2 hands off to the browser rather than posting**, because there is no forum to post
   to and no issuer to authenticate with. If you would rather it did nothing at all until both
   exist, that is a one-function change — but the composition is the editor-only value and it
   works today.
8. ⚠️ **Carried and still open:** UNI-006's three calls, UNI-005's two, UNI-004's *"responding to
   an RFP requires clearing D8's bar"*, and UNI-003's change to UNI-002's catalogue.

## Gates (2026-08-16, twenty-first session)

- **This checkout: `test:main` 225 suites / 3489 specs, all pass** — measured this session, on a
  tree carrying other sessions' work. Without this session's two spec files: 223/3458, which is
  exactly slice 1's figure. eslint clean on all nine touched files. `tsc --noEmit -p
  tsconfig.tests-main` reports **31 errors, the same pre-existing count slice 1 recorded**, none
  in these files.
  ⚠️ **One run saw `bld-004/reasoningChannel` fail.** It passes **8/8 in isolation, three times**,
  and the full suite is green on re-run — so it is **load-sensitive**. 🔴 This session's two new
  suites *add* load, so do not relay this as "unrelated"; the honest claim is that nothing it
  imports was changed.
  ⚠️ **No `test:ci` was run.** Do not quote one from this handover — there isn't one.
- **`nodegx-community`: 462 specs / 19 files, `tsc` clean, `next build` 21 routes** — carried from
  the twentieth session, **NOT re-measured today**. Run `npm run db:up && npm test` from the
  sibling checkout. ⚠️ `npm run lint` is **STILL not a gate there** — no ESLint config, so the
  script drops into an interactive setup prompt. It has never run.

## Standing constraints

- Editor work on `cline-dev`. 🔴 **Never `git stash`**; `cd` to the repo root in every git call.
  ✅ **`git commit <pathspecs>`, never stage.** ⚠️ Untracked files are the one case needing
  `git add` — put add and commit in **one chain** with the message **already in a file**.
- 🔴 **`cd` does not persist between tool calls here**, and a `cd` inside one does not leak out.
  ⚠️ This bit twice today: a `jest` invocation from the repo root silently used the **wrong
  config** and reported a parse error that did not exist.
- 🔴 **Port 55432 for the platform's Postgres, never 5432.**
- 🔴 **This checkout is SHARED.** Peer messages are for **blocking or hazardous** things only.

## Things the next person will otherwise re-derive

- 🆕 🔴 **Driving the editor: `require('./src/...')` does not work in the renderer** — it is a
  webpack bundle. Push a fake chunk to reach the registry:
  `window.webpackChunknoodl_editor.push([['probe'],{},r=>{wr=r}])`, then
  `wr('./src/editor/src/…​.ts')`. Module ids are the source paths.
- 🆕 🔴 **`LocalProjectsModel.openProjectFromFolder()` opens the MODEL and does not ROUTE.** The
  launcher stays on screen and `NodeGraphContextTmp.nodeGraph` stays null. It does add the project
  to recents, so the working path is: open it, reload, **click the project card**.
- 🆕 ⚠️ **The graph editor's handle is `NodeGraphContextTmp.nodeGraph`**, set only while the
  editor page is mounted. `ed.contextMenu.getContextMenuActions()`, `ed.findNodeWithId(id)`,
  `ed.selectNode(n)`, `ed.addNodeToSelection(n)`, `ed.model.forEachNode(…)`.
- 🆕 🔴 **`document.querySelectorAll('input[type=checkbox]')` in an open dialog returns the
  PROPERTY PANEL's checkboxes first.** Taking `[0]` ticks a property on the selected node instead
  of the control you meant — filter by the component's own class.
- 🆕 ⚠️ **Reloading during a webpack recompile leaves React unmounted** with no exception in the
  log. Check for `compiled successfully` before concluding a boot crash.
- 🔴 **`forEachNode` STOPS on a truthy return.** Use a **block body** — an arrow with an
  expression body returns `push`'s new length, which is 1, and the walk halts at the first node.
- 🔴 **Never generate DDL from `src/db/schema.ts`.** It is a query mirror; rulings live in
  `src/db/sql/`.
- 🔴 **The drift spec checks tables and columns ONLY — including NOT enum names.** Non-vacuity
  floors: drift **32**, free-text census **80**, AC3 sweep exports **40**, route sweep **6 routes**.
- 🔴 **A route handler is outside every sweep this phase built** — they quantify over module
  exports. `tests/uni011-mirror-api.test.ts` reads routes **off disk**.
- 🔴 **A literal NUL byte in a `.ts` file makes git call it binary and grep skip it.** 🆕 The same
  goes for a stray **U+FFFC**, which can be typed into JSX without any tool complaining — scan new
  files for control and replacement characters before committing.
- ⚠️ **`expect(value, message)` is vitest, not jest.** The platform suite takes the second
  argument; this checkout's `test:main` does not, and it fails at compile.
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
