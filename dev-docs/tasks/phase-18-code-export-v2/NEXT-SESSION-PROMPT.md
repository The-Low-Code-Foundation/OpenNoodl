# Next session — §54 `On App Error` is 🟢 (session 82, 2026-09-03): picker 96/127. Next = EXP-011 Tier 2.8 row 5, `Create New Array` — a DESIGN session first (§7.3, §50.4)

## 🔴 Read this first — Richard, 2026-09-02: *"Stop fucking up the CPU."*

One heavy job at a time on this 16 GB box. Session 82 ran every gate behind a wait-for-quiet loop and
**handed the box to a peer by message** (opennoodl-ab ran a site-builder look harness between my editor
`tsc` and my arms). Tell the peer what you hold and for how long; default to letting them go first; never
start an arm while their webpack or backend is up. Memory: `do-not-pile-cpu-work-on-a-shared-box`,
`the-editor-test-ci-webpack-typechecks-a-sibling-packages-tests` (a spec in this package's `tests/` is
typechecked by the editor's `test:ci` webpack — save specs whole).

## The board, re-derived from the task files

| task | status |
|---|---|
| EXP-001 `@nodegx/core` | ✅ Published `0.1.0` (its file carries an uncommitted peer note — not in this commit) |
| EXP-002 / 003 / 005 / 006 / 007 | unchanged |
| EXP-004 | 🟡 built + driven; drill-down panel + three lines for Richard remain |
| EXP-008 | ✅ `export-ledger:check` OK — 176 types, 103 translated |
| EXP-009 backend connection | 🟢 |
| EXP-010 | 🟢 |
| EXP-011 picker coverage | 🟡 **96/127 (75.6%)** — §54 built Tier 2.8 row 4; **row 5 `Create New Array` is next, design first** |
| EXP-012 | 🟢 |
| EXP-013 "Not exportable yet" | 🟢 s78 |

## What session 82 did (EXP-011 §54 — `On App Error`; the type id IS the display name)

1. **Read the runtime, predicted, measured the reverted arm** (`EXPECTED17.md`, graded at its foot;
   `probe17-reverted.log`): both boundaries refused — the shell's as "node beside the router shell", the
   page's as `logic node (On App Error)` — two pathway roots, the verdict "Without them, the app has no
   error pathway"; the cloud call's failure wrote its row and **told nobody**.
2. **Built two things**: `src/lib/errors.ts` (`src/emit/errorsLib.ts` — `runtimeerror.ts` transcribed:
   the sync bus, the depth-2 guard, a throwing subscriber isolated, the console default at module load;
   `useAppError({ filter }, onError)` armed in a **layout effect**, `last` current before the listener,
   the Filter coerced as the setter coerces) AND **the raise at every site the runtime raises** — the six
   request catch sites (after the Error row, before the chain, with `nodeId`/`nodeType`/`componentName`),
   the Run Tasks host (`useRunTasks({ label, nodeId, componentName }, …)`), a Script's load failure
   (`defineScript(…, at)`), the http module's `HttpError` codes and the `!ok` arm's `http/error-status`.
3. **The router shell keeps a file** when a boundary sits beside its Router: `components/<Name>Shell.tsx`
   (`plan.shell`, rootId null, only the Router disposed), rendered by the scaffold's `App.tsx` as the first
   child of `BrowserRouter`. Without a boundary it is the scaffold skip it always was (the §I control).
4. **Gates alone**: pkg tsc 0 · jest 66 files (66 on disk) 2125 · editor tsc 0 (16.3 s) · ledger OK 103
   translated · picker 96 `--check` exit 0 · emitted apps typecheck 0 (alarm/batch/script/call-desk) ·
   arms: 13/13 red (M1–M14 minus M13; M10 re-armed on the concatenation spelling).
5. **Driven** (§54.6): the `On App Error` card's dot gone (Sign In With still dotted), the pre-flight *"16 files — 1 page, 1 component… Everything translates"*, the real write path, **16 files all byte-identical to `emitApp`** (`compare17.ts`). Stack torn down (26 processes), recents restored. ⚠️ the Settings panel must be OPENED through the route seam (`settings17.js`) before the section lookup (`settings17b.js`), and `patchfs17.js` installs that seam — order: patchfs → settings → settings-b.

## 🔴 Do this next — EXP-011 Tier 2.8, row 5: `Create New Array` — DESIGN FIRST

§50.4 and §7.3: an array minted with a generated Id whose only consumer is another node's `Array Id` **by
wire** — the named-array model keys on a literal name, and §7.3 measured that minting ids buys nothing on
its own. Read §7.3, §30 (the array vocabulary and its three gates), `array-vocabulary.test.ts`, and the
runtime (`grep -rna "Create New Array\|NewArray" packages/noodl-runtime/src`) BEFORE writing any code;
write the design into a §55.0 in EXP-011 (what a wire-fed Array Id means in the emitted app — an anonymous
collection store? a local?), then `EXPECTED18.md`, the fixture, the reverted arm, the arms, the drive.
Then `Filter Records`, `Repeater Item`, the streaming trio, … `Sign In With` stays OUT.

🔴 **Every exporter change owes the editor `tsc` — and the editor `test:ci` webpack.**
🔴 **A new chain owner must be added to BOTH walkers** (`scanActions` AND the session walker) and to
`fillMaterialize` — §53.4.1, §54.3.
🔴 **A node with NO trigger input registers in the early trigger-compile loop** (plan.ts ~12100), or the
dropped-wire pass re-enters it as "its trigger chain is cyclic" — §54.4.1, memory
`a-subscriber-node-has-no-trigger-side`.
🔴 **A refusal's sentence depends on which side asks first** (§52.4, §54.4.2) — predict the sentence.

## Open residuals (registered, none blocks an AC)

- §54.7: the http answer's `error` typed optional (a union is the fix; `?? ''` in the raise); a Filter
  fed by a Text Input refused with the fallback sentence (files B13's controlled-state seam would host it);
  Function/Expression throws NOT on the bus (a raise per render through a state-setting chain is a loop —
  memoise per input tuple first); a Query Records failure has no emitted catch site at all (pre-existing);
  `image/load-failed` not raised. All owner NONE.
- §53.7 rows unchanged (the template's error VALUE output, `*`-typed contract ports, the Script walkers —
  owner P18). P80 `UNOWNED-ROWS-TO-MEASURE.md` §10 — unchanged.

## The numbers (last honest readings, s82)

```
packages/nodegx-export: tsc 0 · jest 66 files (66 on disk) 2125 rows · on-app-error.test.ts 41
noodl-editor: tsc -p tsconfig.json --noEmit 0 (16.3 s real; empty log)
export-ledger:check OK — 176 types, 103 translated · picker 96/127 (75.6%), floor 96, --check exit 0
arms: M1 3 · M2 2 · M3 2 · M4 2 · M5 1 · M6 4 · M7 8 · M8 13 · M9 1 · M10 3 · M11 2 · M12 1 · M14 1 — all restored, md5 unchanged
drive: 16 files, 16 same, 0 diff (compare17.ts); AppShell.tsx + errors.ts on disk; App.tsx renders <AppShell />
```

## Instruments (s82 scratchpad `7346e801-0faf-438f-a784-ca6c5ee16806/scratchpad`)

`EXPECTED17.md` (graded), `mkfixture17.js` (`--root=` for a drive copy), `probe17.ts` + `probe17-reverted.log` /
`probe17-after.log`, `tsn17.sh`, `typecheck17.ts` (emitted apps as real programs), `patch17-plan.py` /
`patch17-emit.py` / `patch17-specs.py` / `patch17-specs2.py` (the anchored edits, re-runnable against HEAD
d4d3400c), `mut17.py` (`check` / `apply` / `restore`) + `runmut17.sh` (`ARMS="M1 M2" …`) + `mut17-summary.txt`
+ `arm17-*.log`, `suite17.sh` / `jest17-full2.log`, `tsc17-editor.log`, the drive scripts `drive17.sh` /
`drive17b.sh` / `open17.js` / `settings17b.js` / `patchfs17.js` / `readmodal17.js` / `readtoast17.js` /
`reg17.sh` / `compare17.ts`, `drive17-project/`, `drive17-out/`, `drive17-0N-*.png`.

## 🔴 What session 82 would tell you if it could only say three things

1. **A boundary over an empty bus is nothing.** The row was not the hook; it was the raise at every site
   the runtime raises. Count the request verbs' catch blocks before you count the boundary's rows.
2. **The natural placement had no file.** The app-wide boundary sits beside the Router, and the router
   shell emitted nothing but `App.tsx`. Ask where a *person* would place the node before asking how to
   compile it.
3. **"Cyclic" was pass order.** A node registered lazily "by whichever side asks first" is re-entered when
   the first asker is a read inside a sink compile; a subscriber has no trigger side, so give it one.

## Standing practice

`cline-dev`; commit by exact pathspecs; `git status | grep '^??'` first (`git add` untracked before
a pathspec commit or they are skipped silently); delete probe specs before committing; reconcile
the suite count against disk (66); `grep -a`; absolute paths — **the shell cwd resets between
calls**; `json.dumps(…, ensure_ascii=True)` on the ledger; **`vm_stat` + `ps` before any suite, never
more than one of mine, wait for a peer's webpack to idle, tear servers down the moment the drive is read.**
