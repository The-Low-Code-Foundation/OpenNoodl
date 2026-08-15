# Phase 66 — next session

**Written 2026-08-15, session 11 (the second drive session).** Nothing was built today either. The
session drove what session 10 said was the critical path, and it closed most of it.

✅ **FIX-003 criteria 1, 3 and 4 are driven and pass. FIX-002 criterion 4 is driven and passes.**
🔴 **FIX-003 criterion 2 FAILS — and not for the reason the lane was about.** Text selects fine;
**⌘C copies the selected canvas node instead of the selected text.** New defect, fully pinned,
reproducible by the most natural user flow in the feature. It needs a ruling before a fix.

---

## 0. How this file works

One `NEXT-SESSION-PROMPT.md` per phase, overwritten each session. It carries exactly four things:

1. **Built vs. driven**, per task, as a table — *built* is code plus gates; *driven* is the app
   doing it. Never let the two blur into "done".
2. **Gate readings with their date and commit**, so the next session compares NAMES against a
   reading it can trust rather than re-deriving one.
3. **What this session settled**, so nobody re-litigates or re-measures it.
4. **What to do next and why**, ordered, with rulings owed by Richard called out separately.

Learnings that outlive the phase go to memory, not here.

---

## 1. Built vs. driven

| Task | Built | Driven | Note |
|---|---|---|---|
| **FIX-007** | ✅ | ✅ 4/4 | **CLOSED** |
| **FIX-009** | ✅ | ✅ 5/5 | **CLOSED** |
| **FIX-010** | ✅ | ✅ 3/3 | **CLOSED** |
| **FIX-011** | ✅ | ✅ 4/4 | **CLOSED** |
| **FIX-012** | ✅ | ✅ 3/3 | **CLOSED** |
| **FIX-018** | ✅ | ✅ 5/5 | **CLOSED** |
| **FIX-019** | ✅ | ✅ 4/4 | **CLOSED** — 🟡 14(a) vocabulary sweep still owed |
| **FIX-020** | ✅ | ✅ 3/3 | **CLOSED** |
| **FIX-002** | ✅ | 🟡 **3.5 / 4** | 1 ✅, 2 **half — ruling owed**, 3 ✅, **4 ✅ NEW** |
| **FIX-003** | ✅ | 🔴 **3 pass, 1 FAILS, 1 unrun** | drag plan ✅ (s10); **c1 ✅ ×2 surfaces**, **c2 🔴 FAIL**, **c3 ✅**, **c4 ✅**, c5 not re-run |
| **FIX-014** | ✅ | 🔴 **0/1** | not started; ⚠️ MCP half is **blocked on a repackage**, see §5 |
| **FIX-008** A, B, E | ✅ | ✅ | C, D not built |
| everything else | 📋 open | — | see [TASKS.md](TASKS.md) |

**Eight closed, two part-driven with one real failure, ten open.**

---

## 2. Gate readings

| Gate | Reading | When |
|---|---|---|
| `test:ci` (jasmine) | ⚠️ **2779 / 9**, seed **50405** — 6 floor names + a 3-member `BEN-001` cluster | 10:28:45, tree `393ec7bf` (phase-67's) |
| `test:ci` **re-run** | ⚠️ **2779 / 9**, seed **73375** — same tree, **different cluster members** | 11:00:56, `393ec7bf` (phase-67's) |
| `test:main` (jest, editor) | ✅ **199 suites / 3072 tests, 0 failed** | phase-67 session, earlier |
| editor `tsc --noEmit` | ✅ 0 errors | s10 |
| `lint:ci` | 877 errors, **unmoved** (baseline 3916) | s10 |
| `noodl-mcp` jest | ✅ 43 suites / 494 tests | s9 |
| `noodl-core-ui` jest | ✅ 23 suites / 369 tests | s9 |

🔴 **No gate was run by this session.** Everything above is inherited, and both `test:ci` rows are
**phase-67's tree, not ours** — they grade nothing phase-66 changed today (we changed no source).
Freshness is trustworthy on both: the results file was deleted before each run, mtimes match, and the
seeds differ from each other and from all prior readings.

🔴 **The `BEN-001` cluster is DISCHARGED, and by a better argument than a clean re-run.** Two runs on
the identical tree `393ec7bf` both gave **9**, but the three cluster members **changed** — seed 50405
failed `the component interface, as the bench reads it` ×3, seed 73375 failed `the harness export`
×3. **Changing membership on identical code proves order-dependence directly**; a deterministic
regression breaks the same specs every time. The structural half agrees — `tests/ai/component-bench.test.ts`
shares no module with anything phase-67 edited.

⚠️ **This revises a floor we have all been quoting.** The flat "**6**" was measured **once**, at seed
39393. Two independent seeds today both produced **9**. Record the floor as **"6 known-failing names,
plus a `BEN-001` cluster of ~3 present at most seeds"** — not as a flat 6, or the next session reads
9 and starts hunting a regression that isn't there. ⚠️ The runner takes **no `--seed` flag**, so the
ideal control (same seed, pre-change tree) does not exist; the substitutes are the membership check
above and "does the failing spec file share a module with my change".

---

## 3. What this session settled — do not re-derive

### 🔴 The finding: ⌘C copies the canvas node, not the selected text

**FIX-003 criterion 2 fails, and the cause is not `user-select`.** Selection works everywhere it was
measured. The copy does not:

> With a node selected on canvas and a live text selection in a panel, ⌘C puts
> `{"nodes":[…],"connections":[],"comments":[]}` on the clipboard.

Measured on **both** the Explain answer and the Build thread, so it is not one panel's problem.
`execCommand('copy')` returns the correct text on the same selection in both cases — which is what
proves the selection is genuinely copyable and the fault is purely **which handler wins the key**.

- `EditorDocument.tsx:562-564` binds `CtrlCmd | KEY_C` → `nodeGraph.copy()` → `EditorClipboard.ts:61`
  `clipboard.writeText(JSON.stringify(…))`. That is byte-for-byte what appeared on the clipboard.
- The guard is `keyboardhandler.ts:165` and it is **focus**-based (`INPUT`/`TEXTAREA`/`SELECT`). A
  text selection inside a `<div>` — every panel's prose — classifies as `'none'`, so canvas commands
  run.
- 🔴 **The guard asks the wrong question**: ⌘C's contract depends on the *selection*, not on what is
  *focused*. That is why a lane entirely about making text selectable never touched it.
- 🔴 **Clicking an Explain citation selects the cited node** (criterion 3, working correctly), so
  "click citation → read → select the sentence → ⌘C" reproduces it **every time**.
- ✅ **Control:** with nothing selected on canvas, ⌘C copies nothing — so the canvas handler is
  demonstrably the winner, not a general copy failure.

### ✅ Criterion 1 was graded on the consequence, not a spy

A stub on `platform.openExternal` would pass on an app whose links open nothing. Instead a local HTTP
server logged the hits: **Firefox 153**, `sec-fetch-mode: navigate`, plus a `/favicon.ico` follow-up,
for both the Build thread (`/probe-build`) and the Explain answer (`/probe-explain`) — while the
editor stayed on `file://…/index.html`. The URL left the app, reached the OS, and a real browser
outside Electron fetched it.

⚠️ **But neither drive exercised the `will-navigate` guard.** Both surfaces `preventDefault()` in the
renderer and route through `platform.openExternal`. The **launcher scoping chat is the only surface
with no renderer handler** (`ScopingStep.tsx:98,122`, plain `Markdown`), so it is the only one that
depends on the main-process guard — and that guard is still unproven in use.

### 🔴 A bare URL is never a link, anywhere

`linkify` is off in both Remarkable instances (2.0.1's default, never overridden). Only
`[text](url)` and `<https://…>` produce an `<a>`; `https://example.com` as prose is inert text.
Criterion 1 says "**any** URL the AI emits", so as built it holds only for URLs the model writes as
markdown links. ⚠️ **This is a ruling, not a quiet fix** — enabling `linkify` widens what becomes a
clickable anchor in untrusted model output, on the surface this lane just hardened.

### ⚠️ The modal surface is not drivable in a dev build at all

`UpdateDialog` is the only modal rendering markdown, and it opens only from the title-bar update
affordance, which needs an available update — but `main.js:440` skips `AutoUpdater.setupAutoUpdate`
when `devMode`. There is no user path to it. Don't spend a session looking for one.

### ⚠️ ⌘C is only half-drivable over CDP, and the report depends on knowing which half

Electron serves ⌘C from the app menu (`main.js:759` → macOS `copy:` selector) and **CDP cannot fire a
native menu accelerator**. So "⌘C did nothing" over CDP proves nothing. The node-selected case is a
real driven observation (the editor's own JS keybinding ran); the empty-canvas case is a harness
limit. ✅ **The control that separates them is `execCommand('copy')` on the same selection** —
key ✗ / exec ✓ means the key never reached the copy path; key ✗ / exec ✗ would mean genuinely
uncopyable. Run it before ever filing "copy is broken".

### ⚠️ `TextArea.module.scss:37` — a red herring, now measured

It sets `user-select: none` on the `<textarea>` itself and survived the inversion (an explicit rule
on the element beats `:root`). **It blocks nothing** — Chromium special-cases form controls; a real
drag selected the composer's full contents and copied them exactly. Latent wrong-ness, not a defect.
Don't re-file it.

### Harness notes

- ✅ Working scripts in this session's scratchpad: `linkprobe.js` (the browser-fetch witness),
  `copypath.js` (separates copy path from selection gesture), `selectcopy.js`, `drive.js`.
- 🔴 **A leftover tooltip ate a click.** Hovering the sidebar rail to identify panels leaves a
  `Tooltip-module__Root` on top of the panel content; `cdp click` then reports success on the wrong
  element. `document.elementFromPoint` caught it. Dismiss with `mouseout`/`mouseleave` first.
- 🔴 **My own `pgrep -f "run-electron-tests"` wait-loop matched its own command string** and would
  never have exited — the recorded self-match trap, hit live. Use `ps -p <pid>` on real runner pids.
- ⚠️ **The sidebar rail buttons carry no label, title or testid.** Identify them by hovering and
  reading the tooltip. Order today: 1 Components, 2 ⌘+F, **3 Explain**, 4 Build, 5 Problems,
  6 Docs, 7 Version control, 8 Backend Services, 9 Execution History, 10 Workflows, 11 Provenance.
- ⚠️ **Switching panels deselects the canvas node**, so a repro needing "node selected + panel text"
  must select the node **after** the panel is open.
- ⚠️ `ed.origin` is **not** the canvas pan — it stayed `0,0` across a citation jump that visibly moved
  the view. Screenshot rather than trusting it.
- ⚠️ Registering a fixture in the launcher: append to
  `~/Library/Application Support/NodeGX/recently_opened_project.json` and reload. Give the copy a
  **fresh project id**, or it collides with the project it was copied from.

---

## 4. What to do next and why

1. 🔴 **Get a ruling on the ⌘C defect, then fix it.** It is the one thing standing between FIX-003
   and closure, and it is the original bug report's own complaint in a second form. The obvious
   repair — teach `keyboardhandler.ts` about a non-collapsed `getSelection()` — is one condition, but
   it changes a global keybinding's precedence; scoping the canvas commands to the canvas may be the
   better shape. **Do not build either on assumption.**
2. 🔴 **Drive the launcher scoping chat** (FIX-003 criterion 1, last reachable surface). It is worth
   the project-creation flow specifically because it is the only surface with no renderer handler, so
   it is the only test of the `will-navigate` guard. Recipe: local HTTP server + a scoping reply
   containing `[x](http://127.0.0.1:PORT/probe-launcher)`, then check the server log for a browser
   User-Agent.
3. 🔴 **FIX-014 criterion 1** — untouched. Drive the **Build panel half** (which runs from the repo
   and has the pass); record the MCP half as **blocked**, see §5.
4. **FIX-001** (Tier 1, the explainer) — still the biggest remaining user-visible win and the only
   Tier 1 task with no code.
5. **FIX-008 fix C** (`--scope project`) — Richard owes a measurement on C's copy first.

**Do not start** FIX-015 or FIX-021's brainstorm halves — they need Richard, not an agent.

---

## 5. Rulings still owed by Richard

- 🔴 **NEW — the ⌘C precedence defect** (§3). Should a live text selection suppress the canvas copy
  command, or should the canvas commands be scoped to the canvas? This decides the shape of the fix.
- 🔴 **NEW — `linkify`**: should a bare URL in AI output become a clickable link? Today it does not,
  on any surface. Enabling it widens the clickable-anchor surface in untrusted model output, so it is
  a security-relevant call, not a formatting one.
- 🔴 **FIX-002 criterion 2**: should the composer auto-grow at all, and to what max height? It
  currently scrolls and is drag-resizable. Unchanged from session 10.
- 🔴 **FIX-014's MCP half is blocked on a REPACKAGE, not a rebuild.** Every running server executes
  `/Applications/NodeGX.app/Contents/Resources/noodl-mcp/noodl-mcp.cjs` — the **packaged app**, dated
  2026-08-13, which does not contain `layoutAuthoredNodes`. The repo's `packages/noodl-mcp/dist` was
  rebuilt and *does* have it, so checking `dist` gives the wrong answer about what the servers run.
  Reaching them means repackaging and restarting — Richard's call, and bigger than "restart the
  servers". ⚠️ There are now **six** live `noodl-mcp.cjs` servers.
- 🟡 **FIX-019 14(a)** — is the surface called *the workbench* everywhere? Loose thread.
- **FIX-004** conversion block shape, log level, Msg keys · **FIX-005** the category name (reverses
  VFN-012) · **FIX-006** demote Script from the AI-authorable set? · **FIX-013** what a data-reading
  component shows on the bench · **FIX-016** signal-input semantics.
- **FIX-008 leftovers:** cleanup of stale user-scope registrations, and whether two visible NodeGX
  servers in one session is better or worse for the model — that second one is a **measurement**, so
  take it before shipping C's copy.
- The two big ones (**FIX-015**'s eight style-token rulings, **FIX-021**'s six memory-doc rulings)
  are their own sessions and their output is a new phase, not code in this one.

---

## 6. Standing constraints — unchanged, do not relearn

Work on `cline-dev`; **never `git stash`**; `cd` to the repo root in every git call; **pathspec-scope
every `git add`**. ⚠️ `dev-docs/tasks/phase-65-the-library/` is untracked and belongs to **neither**
this phase nor phase 67 — `MEMORY.md` links into it, so it is one `git clean` from gone. Leave it.

**Coordinating with live sessions worked again, and it mattered twice today.** Announcing *before*
launching caught a live `test:ci` that would have been corrupted by a dev stack; announcing *after*
stopping handed phase-67 its re-run window immediately. There were **nine** peers on this checkout.
Announce before **and** after any `test:ci`, `test:main` or **editor launch**; use `ListAgents` +
`SendMessage` (peers need their ` [ref]` on first contact).

🔴 **`dev:stop --list` labels a running `test:ci` as "dev stack"** — it matches on the Electron binary
path, and a suite's own `Electron test.js --ci` looks identical to a dev Electron. Plain `dev:stop`
would have **killed the suite**. Read the process *parent*, not the port: a test host binds no ports
at all, so "fresh Electron + all ports free" is the signature of the **suite**, not of a booting
stack. Kill your own pids by pid; this session killed exactly two (`52973`, `54160`) and left the six
MCP servers alone.

⚠️ **A different CDP port does not let two editors coexist** — the app takes a single-instance lock
that ignores the port. What makes a launch safe is that nobody else's stack is up.

**Drive fixtures:** `fix003-drive` is this session's — a `cp -R` of `leg003-drive` with a **fresh
project id**, registered in the launcher's recents as "FIX003 Drive". It is a scratch copy precisely
because **the Build composer authors on a one-character prompt**; the copy absorbed one AI turn today
and nothing of value is in it. `leg003-drive` ("Kiln & Co.") is a git repo carrying other sessions'
uncommitted work — never `git checkout .` there. `fix012-drive` has the `/Probe` with 6 typed inputs.
`BaseDialog` renders every dialog **twice** — filter `:not([class*=MeasuringContainer])`.

⚠️ **The memory index still needs a prune.** `MEMORY.md` is over its 17.1 KB target and getting under
means **dropping live trap entries**, which is Richard's call about his own knowledge base. Ask him
which sections have gone cold.
