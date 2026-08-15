# Phase 66 — next session

**Written 2026-08-15, session 10 (the first drive session since FIX-002/003/014 landed).** Nothing
was built today. The session did what session 9 said was the critical path: **it drove**.

✅ **FIX-003's drag-surface regression — the one the ruling knowingly accepted the risk of — is
measured and clean.** That was the phase's largest open risk and it is now closed.
🔴 **FIX-002 criterion 2 is half-met**: the composer does not grow. That is a new finding and it
needs a ruling, not a fix-on-assumption.

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
| **FIX-002** | ✅ | 🟡 **2.5 / 4** | 1 ✅, 2 **half — see §3**, 3 ✅ (+ BLD-010 reversal driven), 4 ❌ |
| **FIX-003** | ✅ | 🟡 **drag plan ✅, criteria 0/5** | the accepted-risk half is **done**; links/⌘C/citations/markdown owed |
| **FIX-014** | ✅ | 🔴 **0/1** | not started — needs the editor window |
| **FIX-008** A, B, E | ✅ | ✅ | C, D not built |
| everything else | 📋 open | — | see [TASKS.md](TASKS.md) |

**Eight closed, three part-driven, ten open.** The built-not-driven column has stopped growing and
started shrinking for the first time in this phase.

---

## 2. Gate readings

| Gate | Reading | When |
|---|---|---|
| `test:ci` (jasmine) | ✅ **2779 specs / 6 failures — the floor exactly, by name**, seed **39393** | 09:42:55, HEAD `3ac5f660` |
| `test:main` (jest, editor) | ✅ **199 suites / 3072 tests, 0 failed** | phase-67 session, after its UNI-007 commits |
| editor `tsc --noEmit` | ✅ 0 errors | same |
| `lint:ci` | 877 errors, **unmoved** (baseline 3916) | same |
| `noodl-mcp` jest | ✅ 43 suites / 494 tests | session 9 |
| `noodl-core-ui` jest | ✅ 23 suites / 369 tests | session 9 |

✅ **Session 9's in-flight `test:ci` is RESOLVED and it was a real run.** It belonged to a *third*
session, not phase-66 — but there is one working tree, so it webpacked HEAD `3ac5f660` (FIX-014
merged). Freshness was established properly: the file did not exist at 09:35, appeared with mtime
09:42:55, and was read 20 seconds later. Seed `39393` differs from both prior readings (81235 stale,
75857 last good), so it is not a recycled file. **FIX-014's `candidate.ts` change costs the electron
suite nothing.**

🔴 **`test:main`'s floor moved to 199 / 3072** — phase-67 landed three `tests-unit/uni-007` suites
(+50 tests) on top of our 196/3022. Compare against **199/3072** next time, and note phase-67 also
*measured* 196/3022 rather than inheriting it, so that number is now confirmed rather than relayed.

⚠️ **`lint:ci` cannot see a `.jsx` file either.** Phase-67 added ~11 `react/prop-types` errors in new
`.jsx` markup and the ratchet did not move: `eslint <dir>` resolves `.js`/`.ts`/`.tsx` and **not
`.jsx`**. The standing trap was "a `.jsx` file is invisible to `tsc` and to jest" — it is invisible to
the **lint gate's directory scan** as well. `test:ci`'s webpack is genuinely the only gate that reads
one.

---

## 3. What this session settled — do not re-derive

### ✅ FIX-003's drag-surface plan: three surfaces, all clean

The live stylesheet is the shape the build record claims — `:root { user-select: text }`, **zero
bare-`div` `user-select` rules**, and the `body.noodl-dragging *` guard present (61 `user-select`
rules total). Each surface was driven with a real `Input.dispatchMouseEvent` drag, and in every case
`getSelection().toString()` came back **empty**, which is the regression under test:

| Surface | Evidence |
|---|---|
| Canvas node drag | moved exactly +100,+50 (`-209,-345` → `-109,-295`), restored afterwards |
| Panel tree row | `pointerdown`/`mousedown` fired, row count unchanged — nothing reparented |
| Frame divider | canvas `y 537→457`, `h 244→324` — exactly the 80px dragged |

✅ **The `noodl-dragging` lifecycle is clean.** A `MutationObserver` on `body.className` recorded
`["", "noodl-dragging", ""]` — added on drag start, lifted on mouseup — **including when the release
landed outside the window** (`907,-120`).

⚠️ **The honest limit of that last result.** CDP delivers the mouseup regardless of coordinates, so
it proves the handler copes with out-of-frame *coordinates*, **not** that a physically-lost mouseup
releases. The stronger test — press, move, never release — could not be run cleanly: holding the
button mid-drag on the divider makes `cdp eval` hang until you release. If that scenario matters,
it needs a real pointer, not CDP.

### ✅ The per-grid opt-out rule is vindicated by evidence, not just argument

Both launcher grids carry `user-select: none` (`Projects-module__Grid` and
`LearningSection-module__Grid` — the merge did add the second). Prose *outside* the grids is `text`,
and that list includes **`LearningSection`'s empty-state paragraph** ("Lessons you install appear
here…") — exactly the copy a hoisted `.Main` opt-out would have swallowed. A real drag across launcher
prose selected **68 characters**; the same drag across a project card name selected **nothing**.

### 🔴 FIX-002 criterion 2: the composer does not grow — it scrolls

Driven with real trusted keys. **Enter submits** (composer cleared, thread grew) and **Shift+Enter
inserts a newline and does not submit**, so the reversal is real and **BLD-010's recorded send key is
now wrong**, as the task predicted. Backspace deletes. At 194 characters the caret line sat at 74–91
inside a 39.5–90.5 viewport plus 8px padding — **visible**, with the box auto-scrolled to keep it so.

But criterion 2 says "the composer **grows** to show it", and it does not.
`TextArea.module.scss` is `min-height: 51px; resize: vertical` with **no JS auto-grow anywhere**.
Four lines of content left the height at 51px with `scrollHeight 82`.

⚠️ **This is a half-met criterion, not a bug.** The reported defect — the composer you cannot type in
— is fixed. Whether "grows" is still wanted is **a ruling for Richard**; if it is, it is a small
auto-grow bounded by a max-height, and that max-height is its own number.
⚠️ **51px is two lines** (16.8 line-height + 16 padding), so a two-line message shows no growth even
if auto-grow existed — test with four or you measure nothing.

### 🔴 The harness trap that nearly became a false bug report

Keys dispatched over CDP arrive `isTrusted: true` and **not** `defaultPrevented` — every listener
fires — but Chromium runs **no editing command** when the window is not OS-focused. No character
inserts, Backspace deletes nothing, Cmd+C copies nothing. I nearly filed "Backspace is broken".

✅ **A control test with a plain `a` key is what caught it**, and the fix is
`Emulation.setFocusEmulationEnabled {enabled:true}` **on the same CDP session that dispatches the
keys** — it is session-scoped, so `npm run cdp -- eval` (one connection per command, closed after)
cannot carry it. `cdp.js type` works throughout because `Input.insertText` bypasses that path, and
**that asymmetry is the trap**: typing works, so you blame the key. Harness written this session:
`scratchpad/drive.js`. `w.show()`/`w.focus()`/`app.focus({steal:true})` and `osascript` activation all
failed — don't spend time there.

### ⚠️ The Build composer authors on a one-character prompt

A literal `"a"`, sent only to test the send key, returned **"Applied — 2 components changed."** There
is no "that wasn't a real request" guard.

The fixture ended **clean** — but that had to be proved, not assumed. Method worth repeating:
`cp -R` the project before the drive, then `diff -rq` after. The files the editor wrote **on quit**
were byte-identical apart from two `modified` timestamps, restored from the snapshot; the rewritten
comment text that *looked* like my damage was **already on disk before my call** (`find -newermt`
showed only the thread transcript, and `git show HEAD:` proved the tree already carried both copies).
🔴 **`ed.undo()` does not undo an AI apply** — it is the editor's undo *method*, it pops the canvas
stack, and it silently reverted a node drag I had already restored by hand.

---

## 4. What to do next and why

1. 🔴 **Finish FIX-003's five criteria.** The blocker is gone — `drive.js` gives you real keys, so
   ⌘C is now straightforward. Needed: a URL opens in the system browser from each of four surfaces;
   text selects and ⌘C yields it; `noodl-node:` citations still navigate; the Build panel renders
   **rich** markdown. ⚠️ `AiMarkdown` **is** mounted (5 roots live in the Build thread) but the one
   response obtained carried no bold/list/link, so rich rendering is **unproven** — ask a question
   whose answer must contain a link and a list.
2. 🔴 **FIX-002 criterion 4** (a Send button submits) — small, and the harness is built.
3. 🔴 **FIX-014 criterion 1** — untouched. Ask the internal AI *and* the MCP for a page with a visual
   tree plus 3 logic nodes; logic must land in its own column with no overlap. The provider
   prerequisite is **verified**: `editorSettings.json` has `ai.provider: anthropic`,
   `ai.hasKey.anthropic: true`, `ai.verified.anthropic: true` (all nested under the `settings` key).
   ⚠️ **Drive it in a scratch copy**, not a shared fixture — see the composer warning above.
4. **FIX-001** (Tier 1, the explainer) — still the biggest remaining user-visible win and the only
   Tier 1 task with no code.
5. **FIX-008 fix C** (`--scope project`) — read §5first; Richard owes a measurement on C's copy.

**Do not start** FIX-015 or FIX-021's brainstorm halves — they need Richard, not an agent.

---

## 5. Rulings still owed by Richard

- 🔴 **NEW — FIX-002 criterion 2**: should the composer auto-grow at all, and to what max height? It
  currently scrolls and is drag-resizable. Nothing should be built here on assumption.
- ⚠️ **The four live `noodl-mcp.cjs` servers still need restarting.** `packages/noodl-mcp/dist` was
  rebuilt this morning (by the phase-67 session, covering FIX-014's `src/tools/author.ts` +
  `src/instructions.ts`), but **the running servers are Richard's and killing them is his call** —
  they are pids 130, 4430, 9171, 34116, 37390. Until they restart, FIX-014 has not reached the MCP
  client, which is half of its criterion 1.
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

**Coordinating with live sessions worked well again today, and it mattered.** There were **at least
three** other sessions on this checkout. Announce before **and after** any `test:main`, `test:ci` or
**editor launch**; use `ListAgents` + `SendMessage`; match **real runner processes**
(`node scripts/run-electron-tests.js`, `Electron test.js`) and **print the pids**.
🔴 **`dev:stop` does not separate sessions on the same checkout** — its "only this checkout" safety is
useless when we share one, so stop your own stack rather than leaving it, and never run it while a
peer's editor is alive. Pick an explicit `NOODL_REMOTE_DEBUG_PORT` (9333 and 9444 were used today).
⚠️ **We all commit as "Richard Osborne"** — `git log --format='%an'` cannot tell sessions apart;
`ListAgents` plus file mtimes can.

⚠️ **The memory index needs a prune.** `MEMORY.md` is **19.3 KB** against a 17.1 KB target (24.4 KB
hard read limit). I compacted the verbose entries this session and it is still over, because getting
under would mean **dropping live trap entries**, not rewording — that is Richard's call about his own
knowledge base, not an agent's. Ask him which sections have gone cold.

**Drive fixtures:** the launcher's "Kiln & Co." **is** `leg003-drive`, a fixture — but it is a git
repo carrying **other sessions' uncommitted work**, so never `git checkout .` to tidy up after
yourself. `fix012-drive` has the `/Probe` with 6 typed inputs. `BaseDialog` renders every dialog
**twice** — filter `:not([class*=MeasuringContainer])`. A React state write is **invisible in the same
`eval`**. ⚠️ The launcher re-renders as its connect-status resolves, so an element measured in one
call can be **unmounted by the next** — a drag that hits nothing reads as a selection failure.
