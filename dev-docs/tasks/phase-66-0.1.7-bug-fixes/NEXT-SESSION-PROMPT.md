# Phase 66 — next session

**Written 2026-08-14, session 7 (FIX-011 + FIX-019 built and gated, neither driven).** The
seven-ruling backlog is now **2 closed, 2 built-not-driven, 3 to go**. Nothing this session needed
Richard and nothing cost a paid request. ⚠️ **A sibling session was live on this checkout
throughout**, committing phase-67 and phase-68 work and running `test:ci` concurrently — §2 has what
that did to the readings, and it is the trap that cost this session twenty minutes. This file is
rewritten at the end of **every** session — read §0 for how, and replace it rather than appending.

---

## 0. How this file works

One `NEXT-SESSION-PROMPT.md` per phase, overwritten each session (the phase-57/60/61 convention).
It carries exactly four things and nothing else:

1. **Built vs. driven**, per task, as a table — the phase-64 discipline. *Built* is code plus gates;
   *driven* is the app doing it. Never let the two blur into "done".
2. **Gate readings with their date and commit**, so the next session compares NAMES against a
   reading it can trust rather than re-deriving one.
3. **What this session settled**, so nobody re-litigates or re-measures it.
4. **What to do next and why**, ordered, with the rulings still owed by Richard called out
   separately from the work an agent can do alone.

Learnings that outlive the phase go to memory, not here.

---

## 1. Built vs. driven

| Task | Built | Driven | Note |
|---|---|---|---|
| **FIX-020** | ✅ | ✅ **3/3** | five popups, both themes — **CLOSED** |
| **FIX-010** | ✅ | ✅ **3/3** | picker anchors + stickiness survives — **CLOSED** |
| **FIX-018** | ✅ | ✅ **5/5** | chip + stacked edge + freed icon slot + menu — **CLOSED** |
| **FIX-007** | ✅ | ✅ **4/4** | prefix docs, write-time gate, urgent lane, paid drive — **CLOSED** |
| **FIX-009** | ✅ | ✅ **5/5** | one `selection-slot` key; Search keeps its own — **CLOSED** |
| **FIX-012** | ✅ | ✅ **3/3** | None clears + gives the frame back; Delete unchanged — **CLOSED** |
| **FIX-011** | ✅ **this session** | 🔴 **0/5** | commit `519a1e66`; **drive recipe in §4** |
| **FIX-019** | ✅ **this session** | 🔴 **0/4** | same commit; 14(a) scoped to the menu item only |
| **FIX-008** A, B, E | ✅ | ✅ | idempotent Connect, backfill on open, bound directory |
| **FIX-008** C, D | 📋 **not built** | — | C stops it recurring; D removes the class |
| FIX-002/003/014 | 📋 open | — | ✅ **ruled**, buildable by an agent alone |
| everything else | 📋 open | — | see [TASKS.md](TASKS.md) |

🔴 **FIX-011 and FIX-019 are built, gated and committed but NOT driven.** They are not closed. The
drive was deliberately not attempted — see §2 for why, and §4 for the recipe to run first thing.

🔴 **FIX-002 is still not the S it was filed as** — the `TextArea` Enter flip hits ~9 more `onEnter`
call sites. Unchanged from session 6; treat as **M**.

---

## 2. Gate readings

| Gate | Reading (2026-08-14, session 7, on top of `519a1e66`) |
|---|---|
| `test:ci` | ✅ **2779 total / 6 failed** — all six inherited, by name (**seed 67911**) |
| `test:main` (jest) | ✅ **190 suites / 2932 tests, 0 failed** |
| `tsc -p packages/noodl-editor/tsconfig.json --noEmit` | ✅ **0 errors** |
| `tsc -p packages/noodl-editor/tsconfig.tests.json --noEmit` | ✅ **0 errors** |
| MCP suite | not run — **no MCP file touched this session** |
| catalog trio, `cloud-library:check` | unchanged — **no catalog, node or library file touched** |

The six `test:ci` failures, by name: `AIX-006 style vocabulary` ×4 · `AI model registry` ×2 — the
same six as sessions 2–6.

✅ **2757 → 2779 is exactly the 22 new specs.** A copy of the results file this reading came from is
at `scratchpad/my-test-results-2257.json`, because the sibling started its own `test:ci` minutes
later and the on-disk file is now contested.

⚠️ **`test:main`'s 188/2880 → 190/2932 is the SIBLING's work, not this session's.** No jest spec was
added here. Compare names, not counts, if it matters.

### 🔴 The twenty minutes this cost, so the next session does not repeat it

The **first** `test:ci` run came back **13 failures**: the inherited six, one genuine bug of this
session's own, and **six `BEN-001` failures that were not real**. A clean re-run at a different seed
returned exactly six. What made the phantoms diagnosable rather than a panic:

- **The seed is in the results file and the floor is seed-specific.** Run one was seed **35665**;
  the floor of six is pinned to **39386**. Adding 22 specs reshuffles a randomised order.
- **The failing subset had a shape.** Within one `describe`, the failures were *exactly* the specs
  that need ports/types to resolve, while the ones checking names and summary text passed. That is
  order-dependent global registry state, not a code change — and the change under suspicion was a
  type-only deletion that cannot touch `rootComponent`, `rootNode` or the interface.
- **A sibling `test:ci` was running.** Confirmed later by `ps`: pid 1016/1452, `test.js --ci`. Two
  Electron suites against one `tests/testfs` is its own phantom source.

**Do not chase a `BEN-001` cluster before re-running.** One re-run is cheaper than the investigation.

⚠️ The backgrounded run reported **`exit code 0`** while its log ended in `npm error code 1` and the
results file said 13. The results file is the only readout that tells the truth, and **its mtime has
to be younger than your run** — this session found session 6's 21:32 file still sitting there.

---

## 3. What this session settled — do not re-derive

### FIX-011 — the height was missing from the *type*, and the CSS was cancelling itself

`.Frame` carried `margin: auto`. Per flexbox §8.1 an **auto cross-axis margin cancels
`align-items: stretch`**, so the frame shrink-fitted to its content and the `<webview>`'s UA default
replaced-element height (**150px**) leaked through. The `768 × 150` read-out was honest measurement
of a box nothing had ever sized. `margin: 0 auto` + `align-self: stretch` is the fix; restoring the
vertical `auto` silently brings the sliver back.

**The size read-out needed no change at all.** It already printed `measured.height` — it was
reporting 150 correctly. The fix direction's "extend `benchSizeLabel`" was struck as unnecessary
rather than done for appearance.

**Two 🟡 sub-rulings were taken**, as FIX-011 permitted:

- **Scenarios gained height**, stored as an **absent key** for "fill the stage" rather than `null`.
  That is what keeps every pre-FIX-011 scenario meaning what it meant: absent reads as fill on both
  sides, so none of them shows the modified dot on open.
- **`Stretch` stays one toggle**, width axis only. The height axis already fills by default, so a
  second toggle would ship switched on and spend width the 30px strip has been measured short of.
  Clearing the height field is the way back to fill; the placeholder says so.

### The strip's width budget — settled once, as both tasks demanded

**The caption is the only thing that shrinks.** Every control is `flex-shrink: 0`. What a narrow
panel costs is the explanatory sentence — and the component's name is in the scope chip on the left
anyway, so the caption is the one genuinely redundant thing in the strip. FIX-011 spends ~74px;
FIX-019's chip spends **zero in the common case**, which is what made the assertive ruling
affordable. Written into `VisualCanvas.module.scss` as a rule, not left to be inferred from four
files.

### 🔴 A dead type that cost a file-read to disprove

`BenchMount.frame` / `BenchExport.frame` were **accepted and echoed straight back** by
`buildBenchExport` — and no caller ever passed one, no reader ever read one. An early note in this
session's own commit said they were "never echoed"; that was wrong, and the code proved it. Both are
deleted. **The spec that asserted the echo looked like frame coverage and was coverage of an echo**;
it passed for as long as the feature did not exist. What was load-bearing in it — that no wrapper is
injected into the graph — remains.

### 🔴 A spec caught a real bug in its own implementation

`clampBenchHeight(undefined, 400)` returned `null` instead of `400`. The first cut read "anything
that stringifies to empty means fill the stage", which wrongly swept in `undefined`. **An emptied
*field* is someone asking for the stage; `undefined` is nobody having said anything.** Now keyed on
`typeof raw === 'string'`. This is the one genuine failure of the first `test:ci` run.

---

## 4. What to do next

1. 🔴 **Drive FIX-011 and FIX-019 first.** They are built and gated; only the app can close them.
   Both drives are free. The nine acceptance criteria are in the two task files. Notes:
   - **Do not launch a dev stack while a sibling `test:ci` is running** — check
     `pgrep -fl "run-electron-tests"` first. That is why this session did not drive.
   - **Never `dev:stop`** — it kills Richard's MCP servers (three were up all session). Kill the
     `scripts/start.ts` pid instead.
   - `NOODL_REMOTE_DEBUG_PORT=9333` — a stray Chrome steals 9222.
   - Entry to the bench: the scope chip `[data-test="preview-scope-chip"]` then
     `[data-test="preview-scope-target-<legacyName>"]`; or the components-panel right-click, which
     now reads **"Show in workbench"**.
   - New test ids: `bench-frame-height`, `bench-frame-set-default`, `bench-diverged`,
     `bench-resize-right`/`-bottom`/`-corner`, `bench-drag-shield`.
   - **FIX-011 AC1** is the reported bug: bench a card component, measure the frame — it must fill
     the stage, not sit at 150. **AC4 is the control**: drag a handle, then confirm `project.json`
     is *not* dirtied. Only the pin button writes.
   - **FIX-019 AC3 is the control**: canvas on the benched component → **no** chip.
   - ⚠️ **The `<webview>` claim in FIX-011's fix direction is untested.** The grips are built as
     siblings stacked above the webview with a drag shield, which should hold either way — but
     whether a child would have worked was never measured, and the drive is where that is settled.
2. **Build the three remaining ruled tasks.** **FIX-003** is the big one (the global `user-select`
   inversion — enumerate the opt-*out* list before flipping `style.css:205`). **FIX-014** is
   independent. **FIX-002** — see §1, it is an M.
3. **FIX-008 fix C** (`--scope project`) if the report should stop recurring. Five `noodl-mcp.cjs`
   servers are still registered against `Puppy test 3` user-scope.
4. **Repackage the app** (or say so out loud) if FIX-008 fix E is to reach the running servers.

**Do not start** FIX-015 or FIX-021's brainstorm halves — they need Richard, not an agent.
**Do not rebuild** FIX-007 fix 3 or re-file its rider; both are struck with evidence.

---

## 5. Rulings still owed by Richard

- 🟡 **FIX-019 14(a)** — **now the one blocking a finish rather than a start.** The menu item says
  "Show in workbench"; the surface's own caption still says *"— isolated component, not the app"*
  and the docstrings still say "isolation". Is the surface called **the workbench** everywhere, or
  only in that menu item? Sweeping it was deliberately not done, because doing so would pre-empt
  the ruling.
- **FIX-004** conversion block shape, log level, Msg keys · **FIX-005** the category name (reverses
  VFN-012) · **FIX-006** demote Script from the AI-authorable set? · **FIX-013** what a data-reading
  component shows on the bench · **FIX-016** signal-input semantics.
- **FIX-008 leftovers:** cleanup of stale user-scope registrations, and whether two visible NodeGX
  servers in one session is better or worse for the model — that second one is a *measurement*, so
  take it before shipping C's copy.
- The two big ones (**FIX-015**'s eight style-token rulings, **FIX-021**'s six memory-doc rulings)
  are their own sessions and their output is a new phase, not code in this one.

---

## 6. Standing constraints — unchanged, do not relearn

Work on `cline-dev`; **never `git stash`**; `cd` to the repo root in every git call; pathspec-scope
every `git add`. ⚠️ **The sibling session committed four times mid-session** (`15763dd7`,
`dd81401c`, and phase-67/68 docs) and has uncommitted work across `lessongrading.ts`,
`tests-unit/uni-007/`, `packages/noodl-mcp/src/lessons/` and `dev-docs/tasks/phase-68-learnbook/`.
Check `git log` before assuming the parent commit is where you left it, read untracked files rather
than assuming they are yours, and **name every path in `git add`** — this session's commit staged
17 files by name for that reason. **`dev:stop` kills Richard's MCP servers.** Restore
`recently_opened_project.json` after any launcher drive. ⚠️ **Do not restore `~/.claude.json` from a
backup.** Full list in the [README](README.md) § "Standing constraints inherited".

**Drive fixtures:** `fix012-drive` is a scratch copy of `erg005-qa` and is the one project on this
machine whose `/Probe` component has **6 typed inputs**, which is what makes the bench's inputs rail
non-empty. It also holds a real component **instance** (`/Probe` placed in `/App`). Only two
projects on disk have a `Component Inputs` node with actual ports — that one and `vfn64-drive`'s
`/Components/Product photo`.

⚠️ **Before any paid drive, verify the provider from `editorSettings.json`, not localStorage** —
`ai.provider`, `ai.hasKey.anthropic`, `ai.verified.anthropic`. It was live on 2026-08-14. Neither
drive in §4 needs one.
