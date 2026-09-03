# Next session — §53 `Run Tasks` is 🟢 (session 81, 2026-09-03): picker 95/127. Next = EXP-011 Tier 2.8 row 4, `On App Error`, in §50's order

## 🔴 Read this first — Richard, 2026-09-02: *"Stop fucking up the CPU."*

One heavy job at a time on this 16 GB box. Session 81 ran every gate behind a wait-for-quiet loop
(`waitrun16.sh` / `gates16.sh`), one chain at a time, and **handed the box back and forth by message**
with a peer (opennoodl-de) running the editor's `test:ci`. Two things that peer measured for us:
🔴 **a spec under `packages/nodegx-export/tests/` is typechecked by the editor's `test:ci` webpack**
(through `CodeExportModal.tsx` → `nodegx-export/src/index.ts`) while `tsc -p noodl-editor` and
`tsc -p nodegx-export` both read 0 — two strict-null lines in the new spec reddened their run, and a
**mutant written into `src/` mid-flight killed it** (the arms chain must not run while
`webpack.test-ci` is up); 🔴 a red leaves a **poisoned `packages/noodl-editor/.webpack-cache`**
("TypeScript emitted no output" with no error above it) — `rm -rf` it. Memory:
`the-editor-test-ci-webpack-typechecks-a-sibling-packages-tests`, `do-not-pile-cpu-work-on-a-shared-box`.

## The board, re-derived from the task files

| task | status |
|---|---|
| EXP-001 `@nodegx/core` | ✅ Published `0.1.0` (its file carries an uncommitted peer note — not in this commit) |
| EXP-002 / 003 / 005 / 006 / 007 | unchanged |
| EXP-004 | 🟡 built + driven; drill-down panel + three lines for Richard remain |
| EXP-008 | ✅ `export-ledger:check` OK — 176 types, 102 translated |
| EXP-009 backend connection | 🟢 |
| EXP-010 | 🟢 |
| EXP-011 picker coverage | 🟡 **95/127 (74.8%)** — §53 built Tier 2.8 row 3; **row 4 `On App Error` is next** |
| EXP-012 | 🟢 |
| EXP-013 "Not exportable yet" | 🟢 s78 |

## What session 81 did (EXP-011 §53 — `Run Tasks`, type id `RunTasks`)

1. **Read the runtime, then predicted** (`EXPECTED16.md`, graded at its foot): `runtasks.ts` makes a
   component instance per item, pulses the template's start input once, matches success/failure by
   STRING, runs at most Max Running Tasks, `_endRun` fires outcome + Completed **per token**. Found that
   §5.7's `foreachTemplateHosts` matched the display name `'Run Tasks'` and read `template` (the node
   carries `taskTemplate`) — never fired; fixed and pinned.
2. **Measured the reverted arm** (`probe16-reverted.log`): one root, eight silenced, the template
   skipped as logic-only with four refusals of its own.
3. **Built both sides**: `planProject` plans templates BEFORE hosts (deepest first; cycles refused); a
   logic-only component a Run Tasks names statically gets a file and renders `null`, its start chain a
   once-guarded mount effect; the host gets `useRunTasks(label, config, listeners)` from
   `src/lib/runTasks.ts` (`src/emit/runTasksLib.ts`, the state machine transcribed) and renders one
   template element per task in flight as the root container's last child; `runTasksPlanOf` refuses
   in `run()`'s own order (§53 table of sentences); a verdict sweep for an unfired node. Ledger
   `translated`, floor 95, the three floor pins moved, cascade's task-desk count 7 → 8.
4. **Gates alone**: pkg tsc 0 · jest 65 files (65 on disk) 2066 · editor tsc 0 (11.6 s — s80 read
   14 s, the normal reading) · ledger OK · picker 95 `--check` exit 0 · arms 10/10 red (M8b dropped
   as an equivalent mutant; one arm re-armed after a compiler kill).
5. **Driven** (§53.6): the Run Tasks card's dot gone (Sign In With still dotted), pre-flight "16
   files — 1 page, 1 component… Everything translates", the real write path, **16 files all
   byte-identical to `emitApp`** (`compare16.ts`). Stack torn down, recents restored. ⚠️ the Settings
   export button is found by its SECTION text, and `patchfs16.js` must run BEFORE `settings16b.js`.

## 🔴 Do this next — EXP-011 Tier 2.8, row 4: `On App Error`

Read **EXP-011 §3 Tier 2.8**, **§50**, **§52**, **§53** first. Then `On App Error` in the same shape:
the runtime file first (`grep -rna "'On App Error'" packages/noodl-runtime/src packages/noodl-viewer-react/src`
— it is the app-wide error boundary: read what it catches (`raiseRuntimeError`? uncaught throws?
the error bus the Run Tasks host now writes to with `console.error`), what it publishes (message,
stack, source node?), whether more than one may exist), the ports as the catalog declares them,
`EXPECTEDnn.md` before any run, a fixture on disk, the reverted arm measured, the arms, the drive
with a `dev:stop` teardown, commit by pathspec. It is an `isPathwayType` — a refused one removes the
error pathway, so the pre-flight verdict already names it (cascade.test.ts has a synthetic row). Then
`Create New Array` (design session first — §7.3's anonymous-Id-by-wire), `Filter Records`, … `Sign In
With` stays OUT.

🔴 **Every exporter change owes the editor `tsc` — and the editor `test:ci` webpack** (§53.4.5).
🔴 **A new chain owner must be added to BOTH walkers**: the trigger/registration side AND
`scanActions` (the attachment sweep that earns api exports and Error rows) — §53.4.1; `component.ts`
still walks `plan.scripts` in neither `allActions` nor `hookExprSources` (owner P18, §53.7).
🔴 **A refusal's sentence depends on which side asks first** (§52.4) — predict the sentence.

## Open residuals (registered, none blocks an AC)

- §53.7: the template's error VALUE output unread (the console report carries the index only);
  `*`-typed contract ports (every corpus instance — the MCP writes `*`) refused with the fix named;
  a non-container host root untested; nested Run Tasks in a template untested beyond the cycle row;
  Run Tasks not an `isPathwayType`. All owner NONE except the Script walkers (P18).
- P80 `UNOWNED-ROWS-TO-MEASURE.md` §10 (MCP script-port backstop), §52.7 rows — unchanged.

## The numbers (last honest readings, s81)

```
packages/nodegx-export: tsc 0 · jest 65 files (65 on disk) 2066 rows · run-tasks.test.ts 67
noodl-editor: tsc -p tsconfig.json --noEmit 0 (11.6 s real; empty log; s80 read 14 s)
export-ledger:check OK — 176 types, 102 translated · picker 95/127 (74.8%), floor 95, --check exit 0
arms: M1 4 · M2 2 · M3 2 · M4 8 · M5 1 · M6 1 · M7 5 · M8 1 · M9 1 · M9b 1 — all restored, md5 unchanged
drive: 16 files, 16 same, 0 diff (compare16.ts)
```

## Instruments (s81 scratchpad `68353a21-61bd-41b6-a78d-829c9b8f88e2/scratchpad`)

`EXPECTED16.md` (graded), `mkfixture16.js` (`--root=` for a drive copy; `--star` types the contract ports
`*`), `probe16.ts` + `probe16-reverted.log` / `probe16-after2.log`, `tsn16.sh`, `patch16-plan.py` /
`patch16-emit.py` (the anchored edits, re-runnable against HEAD 7d651798 — plus the two later
one-line patches recorded in §53.3), `mut16.py` / `runmut16.sh` (`ARMS="M3 M7" …` runs a subset) /
`waitrun16.sh` / `mut16-summary*.txt` / `arm16-*.log`, `gates16.sh` / `gates16.log` / `jest16-full2.log`
/ `tsc16-editor.log`, the drive scripts `drive16.sh` / `drive16b.sh` / `open16.js` / `settings16b.js`
/ `readmodal16.js` / `patchfs16.js` / `readtoast16.js` / `reg16.sh` / `compare16.ts`, `drive16-project/`,
`drive16-out/`, `drive16-0N-*.png`.

## 🔴 What session 81 would tell you if it could only say three things

1. **Two walkers, both owe every new chain owner.** The registration compiled the template's chain
   perfectly and the emitted file still lacked its import and its state row, because the attachment
   sweep is a separate enumeration of where chains live. Read `scanActions`'s caller list before
   adding an owner.
2. **The transcription corrects the prediction, not the other way round.** "Completed twice" was the
   prediction; the harness read `done, completed, done, completed`, and the runtime agrees — per
   token. Grade the prediction file; do not bend the lib to it.
3. **Your package's tests are someone else's gate.** Save specs whole, run them at once, and never
   write a mutant into `src/` while a peer's editor webpack is compiling.

## Standing practice

`cline-dev`; commit by exact pathspecs; `git status | grep '^??'` first (`git add` untracked before
a pathspec commit or they are skipped silently); delete probe specs before committing; reconcile
the suite count against disk (65); `grep -a`; absolute paths — **the shell cwd resets between
calls**; BSD `sed` has no `\|` — a copy step that renames files with it silently leaves the old
names in the script; **`vm_stat` + `ps` before any suite, never more than one of mine, wait for a
peer's webpack to idle, tear servers down the moment the drive is read.**
