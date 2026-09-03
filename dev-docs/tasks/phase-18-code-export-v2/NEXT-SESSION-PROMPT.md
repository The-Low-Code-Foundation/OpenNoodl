# Next session — §52 `Script` is 🟢 (session 80, 2026-09-03): picker 94/127. Next = EXP-011 Tier 2.8 row 3, `Run Tasks`, in §50's order

## 🔴 Read this first — Richard, 2026-09-02: *"Stop fucking up the CPU."*

One heavy job at a time on this 16 GB box. Session 80 ran every gate behind a wait-for-quiet loop
(`waitrun15.sh` / `gates15.sh`: no start while any webpack/tsc/jest is above 30% CPU for three
consecutive checks), one chain at a time: the arms, then the editor tsc, then the full suite. A peer's
`dev:debug` stack (opennoodl-71, P82 REL-009b) held port 9222 and the webpack for the whole
afternoon. Memory: `do-not-pile-cpu-work-on-a-shared-box`.

## The board, re-derived from the task files

| task | status |
|---|---|
| EXP-001 `@nodegx/core` | ✅ Published `0.1.0` (its file carries an uncommitted 09-01 note listing four `0.1.1` rows — a peer's, left in place, **not in this commit**) |
| EXP-002 / 003 / 005 / 006 / 007 | unchanged |
| EXP-004 | 🟡 built + driven; drill-down panel + three lines for Richard remain |
| EXP-008 | ✅ `export-ledger:check` OK — 176 types, 101 translated |
| EXP-009 backend connection | 🟢 |
| EXP-010 | 🟢 |
| EXP-011 picker coverage | 🟡 **94/127 (74.0%)** — §52 built Tier 2.8 row 2; **row 3 `Run Tasks` is next** |
| EXP-012 | 🟢 |
| EXP-013 "Not exportable yet" | 🟢 s78 |

## What session 80 did (EXP-011 §52 — `Script`, type id `Javascript2`)

1. **Read the runtime, then predicted** (`EXPECTED15.md`): `javascriptnodeparser.js` compiles the
   code once as `new Function('define','script','Node','Component', prefix + code)` and calls it once;
   three DSL generations declare a lifecycle object; `javascript.ts` registers output accessors only
   for the ports on disk, runs setup then change (every boot input marked changed), coalesces a
   signal's function per pass, destroys on delete. `strictprobe.js`: 15 distinct bodies on disk, all
   compile sloppy and strict, 13 gen-3, every real one stateful and browser-coupled.
2. **Measured the reverted arm** (`probe15-reverted.log`): five `logic node (Javascript2)`, every
   wire dropped, the constants attributed by graph to their Script, five comment blocks.
3. **Built** the host, not a wrapper: `src/analyze/script.ts` (the gate: only `Noodl.`,
   `Component.`, createComponent, `import()`, Use External File, ports-undiscovered), plan.ts
   (`script-out`, `script-signal`, `ScriptPlan`, `scriptPlanOf` in `statesPlanOf`'s shape,
   `isTriggerInto`), component.ts (the hook, the imports, `scriptFileSource` with `// @ts-nocheck`),
   `src/emit/scriptLib.ts` (`src/lib/script.ts`: `defineScript`, `useScript`, the three DSLs and the
   lifecycle transcribed). Ledger `translated`, floor 94, both pins moved.
4. **Gates alone**: pkg tsc 0 · jest 64 files (64 on disk) 1981 · editor tsc 0 (2,815 files) ·
   ledger OK · picker 94 `--check` exit 0 · arms 9/9 red on behaviour rows, all restored.
5. **Driven** (§52.6): badge gone from the `Script` card by itself (`Run Tasks` still dotted), the
   pre-flight's one refusal named with no verdict, the real `writeExport` path through the
   `FileSystem.instance.chooseDirectory` seam, 18 files, **all 18 byte-identical to `emitApp`**
   (`compare15.ts`). Stack torn down, recents restored. ⚠️ Settings' export button is found by
   its *section* (`Export as code`) now — s79's text lookup returned nothing.

## 🔴 Do this next — EXP-011 Tier 2.8, row 3: `Run Tasks`

Read **EXP-011 §3 Tier 2.8**, **§50**, **§51**, **§52** first. Then `Run Tasks` in the same shape: the
runtime file first (`grep -rna "'Run Tasks'" packages/noodl-runtime/src packages/noodl-viewer-react/src`
— it runs a worker component per array item; read how it instantiates the worker, what it passes
in, how it collects Done/Failure, whether it runs items in parallel or in sequence), the ports as
the catalog declares them, `EXPECTEDnn.md` before any run, a fixture on disk with the shape an
MCP-built project uses (grep the test projects for `"Run Tasks"` first — §50 measured that a
refused one silences everything behind it, so this row is the cascade's headline), the reverted
arm measured, the arms, the drive with a `dev:stop` teardown, commit by pathspec. Then `On App
Error`, `Create New Array` (design session first — §7.3's anonymous-Id-by-wire), … `Sign In With`
stays OUT.

🔴 **Every exporter change owes the editor `tsc` too** (EXP-012's trap; s80 ran it: 0).
🔴 **The port set of a runtime-discovered node is the one ON DISK** (§52.1) — never run user code to
find ports; a node the editor has not opened has none, in the running app too.
🔴 **A refusal's sentence depends on which side asks first** (§52.4): predict the sentence, not just
the disposition kind, and check the sink's port kind before the chain compile speaks.

## Open residuals (registered, none blocks an AC)

- P80 `UNOWNED-ROWS-TO-MEASURE.md` **§10**: the MCP's script-port backstop is `JavaScriptFunction`
  only — an MCP-authored Script has no ports on disk until the editor opens the project (owner NONE,
  source-read not driven).
- §52.7: a `Noodl.Files` facade in the host (three of def036's ten bodies); a Text Input's `text` into
  a Script input (controlled-state seam); Use External File; Script not an `isPathwayType`.
- §51.7 / EXP-013 / §49.3 … unchanged.

## The numbers (last honest readings, s80)

```
packages/nodegx-export: tsc 0 · jest 64 files (64 on disk) 1981 rows · script.test.ts 74
noodl-editor: tsc -p tsconfig.json --noEmit 0 (2,815 files; the working tree holds peers' uncommitted editor edits)
export-ledger:check OK — 176 types, 101 translated · picker 94/127 (74.0%), floor 94, --check exit 0
arms: M1 3(+5 typing) · M2 3 · M3 1 · M4 5 · M5 5 · M6 1(+5) · M7 1+5 typecheck · M8 3 · M9 2 — all restored, md5 unchanged
```

## Instruments (s80 scratchpad `7a8f3b73-0360-4c47-89b5-200b42ca2d75/scratchpad`)

`EXPECTED15.md` (with a graded section), `strictprobe.js` (the corpus compile probe), `mkfixture15.js`
(`--uploader` adds the refused node; `--root=` for a drive copy; `--print-uploader`), `probe15.ts` +
`probe15-reverted.log` / `probe15-after.log`, `tsn.sh`, `patch15-plan.py` / `patch15-emit.py` (the
anchored edits, re-runnable against HEAD e1a92d95), `mut15.py` / `runmut15.sh` / `waitrun15.sh` /
`mut15-summary.txt` / `arm15-*.log`, `gates15.sh` / `gates15.log` / `tsc15-editor.log` /
`jest15-full.log`, the drive scripts `open15.js` / `settings15.js` / `readmodal15.js` /
`readpicker15.js` / `patchfs15.js` / `reg15.sh` / `cdpeval.js`, `drive15-project/` (with the uploader).

## 🔴 What session 80 would tell you if it could only say three things

1. **Read the corpus before choosing the target.** Every real Script body reaches a timer, the DOM or
   a media device; the Function node's purity gate would have refused all of them and the ledger
   would have read "translated" over a node that never exports. The host is the honest target.
2. **A mutant the compiler kills is not killed.** `|| true` is TS2872 now; ts-jest reports it as
   "Tests: 0 total", which reads as a pass to a tally and as a kill to nobody. Arm at the value level.
3. **The corpus control is a contract on fixtures.** A fixture may not carry a refused script-bearing
   node; the refused shape lives in the spec by mutation.

## Standing practice

`cline-dev`; commit by exact pathspecs; `git status | grep '^??'` first (`git add` untracked before
a pathspec commit or they are skipped silently); delete probe specs before committing; reconcile
the suite count against disk (64); `grep -a`; absolute paths — **the shell cwd resets between
calls, and a relative `cat >>` appends nowhere**; a `$VAR` holding a command with spaces is NOT
word-split in zsh — put it in a script; **`vm_stat` + `ps` before any suite, never more than one of
mine, wait for a peer's webpack to idle, tear servers down the moment the drive is read.**
