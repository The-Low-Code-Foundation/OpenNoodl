# Next session — §61 is 🟢 and DRIVEN (session 87, 2026-09-05): Tier 2.8 rows 1–13 ALL BUILT, picker 114/127 (89.8%). Next = the three drives session 86 owes (panel-desk, link-desk, board-desk) + the editor write path, then Tier 3.11 (the three transports)

## 🔴 Read this first — Richard, 2026-09-02: *"Stop fucking up the CPU."*

One heavy job at a time on this 16 GB box; five Claude sessions were live in session 87 and a peer held the box for a
30-minute browser drive ("hold suites until I announce teardown") — honour that, queue behind a load gate, and never
run a package jest beside the editor's `test:ci`. Memory: `do-not-pile-cpu-work-on-a-shared-box`, `parallel-worktree-traps`.

## The board, re-derived from the task files

| task | status |
|---|---|
| EXP-001 `@nodegx/core` | ✅ Published `0.1.0` |
| EXP-002 / 003 / 005 / 006 / 007 | unchanged |
| EXP-004 | 🟡 built + driven; drill-down panel + the comprehension test remain (Richard's) |
| EXP-008 | ✅ `export-ledger:check` OK — 176 types, 121 translated; floor + total held by `--check` |
| EXP-009 backend connection | 🟢 |
| EXP-010 | 🟢 |
| EXP-011 picker coverage | 🟡 **114/127 (89.8%)** — Tier 2.8 rows 1–13 ALL built (§51–§63); **Tier 3.11's three transports are the only scheduled nodes left** (ceiling 117); the §60–§63 fixtures and the editor write path are UNDRIVEN |
| EXP-012 | 🟢 — the alpha notice reads 114/89% off the ledger; the 0.2.2 release notes match |
| EXP-013 "Not exportable yet" | 🟢 — `tests-unit/exp-012+013` 157/157 on 414b99a9 (pinned to `net.noodl.SSE`) |

## What session 87 did

1. **The row-11 agent finished on its own after the rate-limit reset** (`e6199fee` on `p18-row11`: 50/50 rows, 15/15 arms, whole
   package 72 files 2512 in its worktree). Its report landed as a task-notification in the cleared session — a `/clear` does not
   lose a sub-agent's result.
2. **Merged it** as `414b99a9` — 13 conflicts, all additive, by script (`resolve61.py`, s87 scratchpad `fde4ba8c-…`): the floor
   108+111 → 114 with the ratchet sentence renumbered, twelve pins (the new spec pins its own ratchet SENTENCE too —
   `toContain('114 after Tier 2.8 row 11')`), `component.ts` ×17 (a `break` restored in the effect-dependency switch — keep-both
   would have fallen from the component-object case into the stack case), `plan.ts` ×11 (the stack cases printed before
   `case 'component-object-out':` so both fall to `return true`; two role `if` blocks sharing a tail). Package tsc 0 after the stitch.
3. **Folded §61 into EXP-011** before §62 (`1d3fdde2`), ticked row 11, PROGRESS + release notes at 114.
4. **Gates on 414b99a9**: pkg tsc 0 · ledger check OK 121 · picker 114 floor 114 · the 13 pinned/stack specs 641/641 ·
   editor tsc 0 · exp-012/013 157/157 · whole package jest **75 files (75 on disk) 2724, exit 0** (on 3a412ade) · editor `test:ci`:
   **2943 specs, 5 failures = AIX-006 ×4 + SB-017 acceptance 6 "Expected 39 to be 38" — the known floor** (seed 31999, HEAD 45dac86f, fresh `test-results.json` 14:39; the FIRST run died on a poisoned `.webpack-cache` — "TypeScript emitted no output" ×2, no results file — `rm -rf` and re-run, as memory says) (session 86's run at c18d8481 read 2943/5 = AIX-006 ×4 + SB-017 acceptance 6 "Expected 39 to be 38", a peer's template count).
5. **The wizard-desk drive, BOTH ARMS** (`drive61-a.log`, `drive61-b.log`, `drive61-b2.log`; `EXPECTED61-drive.md` written first):
   arm a (the session-86 emit) confirmed the divergence read off the files — the pusher's component unmounted under the page it
   pushed, its rendered Back Result always empty; **fixed as `3a412ade`** (the row renders every entry, `display: contents` on top,
   `none` below — the runtime keeps the covered page's node as `top.from`); arm b every row as predicted, the wrapper does not paint
   (`innerText`, computed display, `offsetParent`). Written up as §61.6.

## 🔴 Do this next

**The drives nobody ran**: `panel-desk` (§60), `link-desk` (§62), `board-desk` (§63) BUILT (recipe = `drive61.sh`:
`emit61.ts <fixture> <out>` with the ts-node `-O` flags in it, `npm install`, `npm run build`, `vite preview --port`,
Chrome `--headless=new --remote-debugging-port`, `NOODL_REMOTE_DEBUG_PORT=<port> node scripts/devtools/cdp.js eval
--target=<title word> "<js>"`; write EXPECTED first), and the editor write path on one fixture (the s84 `drive19` instruments
are GONE with their scratchpad — re-derive: launch the editor on a COPY of the fixture, export from Settings, compare bytes
to `emitApp`). **Then Tier 3.11**: `net.noodl.SSE`, WebSocket, the third transport — read §3 Tier 3 and §58's "what this
number cannot see" first.

🔴 **Every exporter change owes the editor `tsc` AND the editor `test:ci`, run by YOU, alone.** 🔴 **`ts-node` on this
package needs `-O '{"module":"commonjs","moduleResolution":"node","esModuleInterop":true,"resolveJsonModule":true}'`** —
the NodeNext tsconfig trips it (TS5109). 🔴 **A merge renumbers COMMENT pins too** (`toContain('NNN after Tier 2.8 row N')`).
🔴 **Keep-both is wrong where a `break` or a `return` sits between two cases** — read the line AFTER the hunk.

## Open residuals (registered, none blocks an AC; owner NONE unless said)

- §61.5: no transition emitted (recorded per node); a Back Result read from a sibling handler before the attach pass takes
  "never fired" (E5); `useRoutes` refuses the stack; two same-named stacks disagreeing on a target refuse the pusher;
  the covered page's DOM is kept here and removed-then-re-added there (scroll position, focus) — §61.6.
- §60.5 / §62.5 / §63.5 as written in session 86 (see EXP-011); §57.5–§59.5 unchanged.

## Instruments

s87 scratchpad `fde4ba8c-…`: `resolve61.py`, `pins.log`, `stack2.log`, `gates-a.sh` + `editor-tsc.log` + `exp0123.log`,
`emit61.ts`, `drive61-out/` (arm a) + `drive61b-out/` (arm b), `drive61.sh [a|b]`, `gates-b.sh` (the paint check), `EXPECTED61-drive.md`, `drive61-{a,b,b2}.log`, `whole.log`, `testci.log`.
Row-11 agent scratch (outside the repo): `/Users/richardosborne/vscode_projects/OpenNoodl-worktrees/p18-scratch-row11/`
(`EXPECTED.md`, `probe-*.log`, `mut.py`, `mut-summary.txt`, `whole-suite.log`); the session-86 agent brief survives beside them as
`p18-COMMON-BRIEF-s86.md` — reuse it for any further parallel row. Worktrees `p18-row10..13` were removed in session 87; the branches are kept.

## Standing practice

`cline-dev`; commit by exact pathspecs; `git add` untracked first; delete probe specs before committing; reconcile the
suite count against disk (75); `grep -a`; absolute paths — **the shell cwd resets between calls**; `with open(...)`
for every file write; **`vm_stat` + `ps` before any suite, never more than one of mine, wait for a peer's suite,
announce launches and teardowns, tear servers down the moment the drive is read.**
