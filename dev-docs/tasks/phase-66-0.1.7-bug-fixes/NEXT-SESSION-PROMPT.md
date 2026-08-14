# Phase 66 — next session

**Written 2026-08-14, session 8 (FIX-011 and FIX-019 driven and CLOSED; the launch sweep defanged).**
The seven-ruling backlog is now **4 closed, 0 built-not-driven, 3 to go** (FIX-002/003/014, all
ruled, all buildable by an agent alone). This session ran **zero paid requests** and wrote **one
line of product-adjacent code** (a sweep exclusion in `scripts/devtools/dev-processes.js` — §3).
⚠️ **Three sessions were live on this checkout tonight**; coordination was by direct
session-to-session messages and it worked — §4 has the protocol that emerged.

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
| **FIX-020** | ✅ | ✅ 3/3 | **CLOSED** |
| **FIX-010** | ✅ | ✅ 3/3 | **CLOSED** |
| **FIX-018** | ✅ | ✅ 5/5 | **CLOSED** |
| **FIX-007** | ✅ | ✅ 4/4 | **CLOSED** |
| **FIX-009** | ✅ | ✅ 5/5 | **CLOSED** |
| **FIX-012** | ✅ | ✅ 3/3 | **CLOSED** |
| **FIX-011** | ✅ | ✅ **4/4 this session** | **CLOSED** — drive record in the task file |
| **FIX-019** | ✅ | ✅ **4/4 this session** | **CLOSED** — 🟡 14(a) vocabulary sweep still owed (§5) |
| **FIX-008** A, B, E | ✅ | ✅ | idempotent Connect, backfill on open, bound directory |
| **FIX-008** C, D | 📋 not built | — | C stops the report recurring; D removes the class |
| FIX-002/003/014 | 📋 open | — | ✅ ruled, buildable by an agent alone; 002 is an **M**, not S |
| everything else | 📋 open | — | see [TASKS.md](TASKS.md) |

**Eight of 21 tasks are now fully closed.** Nothing in this phase is built-but-not-driven.

🔴 **FIX-002 is still not the S it was filed as** — the `TextArea` Enter flip hits ~9 more `onEnter`
call sites. Unchanged since session 6; treat as **M**.

---

## 2. Gate readings

| Gate | Reading |
|---|---|
| `test:ci` | ✅ **2779 total / 6 failed — the floor exactly, by name** (4 × `AIX-006 style vocabulary`, 2 × `AI model registry`), **seed 81235**, run by the phase-67/68 session on the settled tree at HEAD (`bc373e16` + their `b9664822`), finished 23:19. Reported to this session directly; treat as the trusted baseline. |
| `test:main` (jest) | ✅ 190 suites / 2932 tests, 0 failed (session 7 reading; nothing jest-adjacent changed since) |
| typechecks | ✅ 0 errors both configs (session 7 reading, commit `519a1e66`; nothing TS changed since) |
| MCP suite / catalog trio / `cloud-library:check` | not run — no MCP, catalog, node or library file touched |

This session changed **no gated code**: the only source edit is `scripts/devtools/dev-processes.js`
(dev tooling, no suite covers it; verified live instead — §3).

⚠️ The sibling's **run 1** tonight (seed 66177, 9 failures) was a **stale bundle**, not a
regression: `test:ci` webpacks *first*, and `519a1e66` renamed three `BEN-001` specs out from
under a bundle built mid-edit. The one-step diagnostic — grep a failing spec name across
`packages/noodl-editor/tests/`; **no match ⇒ you measured a bundle, not the checkout** — is now in
memory (`a-failing-spec-name-absent-from-the-tree-means-a-stale-bundle`). It looks identical in
the log to the seed-order cluster; re-running fixes only the seed-order kind.

---

## 3. What this session settled — do not re-derive

### Both benches drives passed on the first attempt, with all three controls load-bearing

Full per-criterion records live in the two task files. What matters beyond "passed":

- **80 is the clamp floor; 150 is the bug.** A drag that bottoms out reads **80**
  (`MIN_BENCH_HEIGHT`, `previewScope.ts:58`; max 4096). A frame measuring **150** unprompted is
  the `<webview>` UA default — the exact signature of FIX-011 regressing — **never dismiss it as
  a clamp**. (This bullet originally said the inverse: the drive's 150 was just its commanded
  −89px from 239, no clamp involved, and the build session caught the error against source before
  it could misdirect anyone.)
- **AC3's "exactly one metadata key" cannot be proven against the pre-editor file bytes.** The
  editor's serializer reformats the entire `project.json` on first save, so the honest comparison
  is serializer-to-serializer: save without the key, save with it, diff those two. Done; the diff
  is exactly the `bench.frame` key. The same trick proved the drag wrote *nothing* (SHA identical
  to pre-launch baseline), which is the stronger half of the control.
- **The `<webview>`-swallows-pointer-events claim stays unmeasured** — the shipped
  siblings-plus-shield grips work end-to-end; whether a child grip would have failed was not
  settled and no longer needs to be.

### 🔴 The launch sweep no longer kills Richard's MCP servers — fixed at source, uncommitted until now

All three sweep paths (`dev:stop`, the `dev:debug` startup reap, the watchdog) share
`findDevProcesses` in `scripts/devtools/dev-processes.js`, whose rule 1 (repo path + `electron/dist`)
matched the MCP servers' Electron hosts. One seed exclusion — argv containing `noodl-mcp.cjs` —
now spares them; commented in place, including why age is no heuristic (an MCP server was observed
minutes old). **Verified three ways**: `dev:stop -- --list` dry-run went 7 targets → 4 (the 4 being
a live test:ci tree, correctly still swept); an independent session re-verified the same delta; and
the real launch + real teardown this session left all three MCP pids (34116/37390/4430) untouched
while reaping the dev stack to zero. Trade accepted knowingly: a genuinely orphaned MCP-hosting
Electron from this checkout is now unreapable by `sweep()` — a live connection beats a tidy process
table. ⚠️ `dev:stop` is *safer*, not safe: it still reaps anyone's running `test:ci` tree. The
narrow habit stands — kill the `scripts/start.ts` pid.

### The BaseDialog double-render eats *menu-item* clicks too

FIX-019's drive lost its first click to the `MeasuringContainer` copy of the context menu — same
label, 36px away, click closes the menu and does nothing. This is the known
`basedialog-renders-every-dialog-twice` trap arriving through a new door (text-match instead of
CSS-selector match). Memory updated. Coordinate-vs-consequence checking caught it in one step.

### Observation filed, not fixed: the thumbnail capture floods the log with uncaught rejections

`UseCaptureThumbnails.ts:24` → `CanvasView.captureThumbnail` throws
`GUEST_VIEW_MANAGER_CALL: UnknownVizError` as an **uncaught (in promise)** rejection every capture
tick while the app webview is hidden (bench mode) or the window occluded — 15 in one short drive,
all identical, predating FIX-011/019. Harmless to the drive but it buries real exceptions.
Candidate: catch it in `captureThumbnail` and skip capture while the app stage is hidden. Small,
unruled, worth an S task or a rider on FIX-013.

### Session-to-session coordination worked, and the transcript pattern is worth keeping

Three sessions shared this checkout tonight. What worked: ask `ListAgents`, message the recent
sessions directly, get the test-run owner to declare "run 2 is my last, then it's yours", hold
until the process table *and* the owner agree. What failed silently first: `pgrep -f
"run-electron-tests"` matches other sessions' *watcher shells* — match the real processes
(`Electron test.js --ci`, `node scripts/run-electron-tests.js`) instead. Also: "the sibling" is
never singular on this checkout — attribute observed effects to a session only via `git log`
authorship or the session's own claim, never by who you happen to be talking to.

---

## 4. What to do next and why

1. **Build the three remaining ruled tasks.** **FIX-003** is the big one (the global `user-select`
   inversion — enumerate the opt-*out* list before flipping `style.css:205`; the drag-surface test
   plan is in scope per the ruling). **FIX-014** is independent (x/y authoritative; fill gaps +
   collisions only). **FIX-002** is an M (§1). All three are agent-runnable without Richard.
2. **FIX-008 fix C** (`--scope project`) if the report should stop recurring. Five `noodl-mcp.cjs`
   servers are still registered against `Puppy test 3` user-scope. ⚠️ But read §5 — Richard owes a
   measurement on C's copy first; build behind it, don't ship past it.
3. **FIX-001** (Tier 1, the explainer) — only minor rulings outstanding; the M-sized live-value
   layer is the phase's biggest remaining user-visible win.
4. **Repackage the app** (or say so out loud) if FIX-008 fix E is to reach the running servers.

**Drive protocol for whoever drives next** (all confirmed working this session): check
`ListAgents` + message any recent session before launching; wait for real test processes, not
watcher shells; `NOODL_REMOTE_DEBUG_PORT=9333`; fixture `fix012-drive` (v1 — opening writes
nothing, which keeps no-dirty controls clean); `BaseDialog` menus need the
`:not([class*=MeasuringContainer])` filter; kill the `scripts/start.ts` pid to stop; restore
`recently_opened_project.json` (this session left it at 28 entries, fix012-drive removed;
fixture left clean: `/Probe` metadata `{}`, no `bench.frame` key, editor-serialized formatting).

**Do not start** FIX-015 or FIX-021's brainstorm halves — they need Richard, not an agent.

---

## 5. Rulings still owed by Richard

- 🟡 **FIX-019 14(a)** — the surface's caption still says *"— isolated component, not the app"*
  and the docstrings still say "isolation", while the menu item now says **workbench**. Is the
  surface called *the workbench* everywhere? The sweep was deliberately not done; the task is
  otherwise closed, so this is now a loose thread rather than a blocker.
- **FIX-004** conversion block shape, log level, Msg keys · **FIX-005** the category name
  (reverses VFN-012) · **FIX-006** demote Script from the AI-authorable set? · **FIX-013** what a
  data-reading component shows on the bench · **FIX-016** signal-input semantics.
- **FIX-008 leftovers:** cleanup of stale user-scope registrations, and whether two visible NodeGX
  servers in one session is better or worse for the model — that second one is a *measurement*, so
  take it before shipping C's copy.
- The two big ones (**FIX-015**'s eight style-token rulings, **FIX-021**'s six memory-doc rulings)
  are their own sessions and their output is a new phase, not code in this one.

---

## 6. Standing constraints — unchanged, do not relearn

Work on `cline-dev`; **never `git stash`**; `cd` to the repo root in every git call; pathspec-scope
every `git add` — ⚠️ the phase-67/68 session left a one-line UNI-007 row edit **uncommitted in
phase-67's TASKS.md deliberately** (it links untracked `phase-68-learnbook/`); do not sweep it into
a phase-66 commit. Check `git log` before assuming the parent commit is where you left it. The
sweep fix (§3) makes launching and stopping the dev stack MCP-safe, but `dev:stop` still kills a
live sibling `test:ci` — prefer the `start.ts` pid. ⚠️ Do not restore `~/.claude.json` from a
backup. Full list in the [README](README.md) § "Standing constraints inherited".

**Drive fixtures:** `fix012-drive` remains the one project whose `/Probe` has 6 typed inputs and a
real placed instance; `vfn64-drive`'s `/Components/Product photo` is the only other component with
ports. ⚠️ Before any paid drive, verify the provider from `editorSettings.json`, not localStorage —
`ai.provider`, `ai.hasKey.anthropic`, `ai.verified.anthropic`. Neither of this session's drives
needed one, and none of the three remaining ruled builds should either.
