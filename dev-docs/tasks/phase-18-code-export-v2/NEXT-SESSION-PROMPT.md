# Next session — §57 + §58 + §59 are 🟢 (session 85, 2026-09-05): picker 105/127 (82.7%). Next = EXP-011 Tier 2.8 row 10, the component-object trio — and the three drives session 85 did not run

## 🔴 Read this first — Richard, 2026-09-02: *"Stop fucking up the CPU."*

One heavy job at a time on this 16 GB box. Session 85 ran THREE sub-agents at once because Richard asked for it, each in
its own worktree (`scripts/devtools/make-worktree.sh`), each limited to package tsc + single specs + ONE whole-package
jest; the orchestrator ran the editor tsc and `test:ci` alone, after merging. Five peer sessions were live. Memory:
`do-not-pile-cpu-work-on-a-shared-box`, `parallel-worktree-traps`.

## The board, re-derived from the task files

| task | status |
|---|---|
| EXP-001 `@nodegx/core` | ✅ Published `0.1.0` |
| EXP-002 / 003 / 005 / 006 / 007 | unchanged |
| EXP-004 | 🟡 built + driven; drill-down panel + the comprehension test remain (Richard's) |
| EXP-008 | ✅ `export-ledger:check` OK — 176 types, 112 translated; floor + total held by `--check` |
| EXP-009 backend connection | 🟢 |
| EXP-010 | 🟢 |
| EXP-011 picker coverage | 🟡 **105/127 (82.7%)** — Tier 2.8 rows 1–9 built; **row 10 (the component-object trio) is next**; rows 11–13 + Tier 3.11 remain |
| EXP-012 | 🟢 — the alpha notice now reads 105/82% off the ledger; the 0.2.2 release notes updated to match |
| EXP-013 "Not exportable yet" | 🟢 — `tests-unit/exp-012+013` 157/157 on the merged tree (pinned to `Drag`, still scheduled) |

## What session 85 did — three rows in parallel, merged sequentially

1. **§57 `Repeater Item`** (type id `For Each Actions`; branch `p18-row7`, commit `e2cba9d3`, merged `09b6be63`): the row's
   Item Id as a string prop the host For Each binds from `item.id` in all four feed branches; Added as a once-on-mount
   effect behind a ref; the exit handshake (Try Remove / Remove Completed / Done-Unchanged-Completed) refused by name; a
   feed with no string `id` drops the prop with a sentence. Fixture `roster-desk`, spec `repeater-item.test.ts` 29 rows,
   15/15 arms.
2. **§58 the streaming trio** (`p18-row8`, `0e4a7ff6`, merged `149bfc2f`): `src/lib/streaming.ts` (emitter
   `streamingLib.ts`) — the three runtime machines as pure cores + `useJsonStreamParser` / `useStreamBuffer` /
   `useTextAccumulator`; data read at the pulse, config live, failures on `errors.ts`. Fixture `stream-desk`, spec
   `streaming-trio.test.ts` 59 rows, 13/13 arms.
3. **§59 `Hash` · `Random Bytes` · `Screen Resolution`** (`p18-row9`, `a53cc415`, merged `a94c8394`): `src/lib/crypto.ts`
   (`tryHash` awaited / `tryRandomBytes` sync, encodings transcribed) + `src/lib/screen.ts` (`useScreenResolution`);
   a `crypto-call` action in UUID's two-arm shape. Fixture `utility-desk`, spec `browser-utilities.test.ts` 55 rows, 15/15 arms.
4. **Merge findings**: the floor conflicts three ways (99/101/101 → 105 with the ratchet comment carrying all three
   sentences); `component.ts`'s hook-gap `||` chain and `plan.ts`'s `resolveExpr` branches were interleaved conflicts
   (stitched by hand, then the package tsc caught two mis-stitches); FOUR specs had borrowed `net.noodl.Hash` as "a node
   with no rule" (three found by the row-9 agent, one more after the merge) — all re-pointed to `net.noodl.PatternExtractor`;
   one `x !== undefined && 'defer' in x` narrowing typed in the package and NOT in the editor's non-strict tsc.
5. **Gates on the merged tree, alone**: pkg tsc 0 · jest 71 files (71 on disk) 2443 · editor tsc 0 · exp-012/013 157/157 ·
   ledger OK 112 translated · picker 105 floor 105 `--check` 0 · editor `test:ci` 2943 specs, 4 failures = AIX-006 ×4 by name (the known floor; seed 75372, HEAD a94c8394, fresh `tests/test-results.json`).

## 🔴 Do this next

**First, the three drives session 85 owes** (the brief forbade drives from the agents; the box had no room for them after):
the editor write path on ONE of the three fixtures (badge gone from the three cards, pre-flight "everything translates",
files byte-identical to `emitApp`; instruments in the s84 scratchpad `a2aa95be-…`: `drive19.sh`/`open19.js`/
`patchfs19.js`/`compare19.ts`), and a BUILT app for `utility-desk` (headless Chrome: SHA-256 of a typed string, Random
Bytes on a click, the viewport numbers) and `stream-desk` (chunks through the accumulator and the parser). Then
**EXP-011 Tier 2.8 row 10**: `Set Component Object Properties` (own store = local state), `Parent Component Object` +
`Set Parent Component Object Properties` (React context). Read §47 (the named Object) and §16.2 first, then write §60.0.

🔴 **Every exporter change owes the editor `tsc` AND the editor `test:ci`, run by YOU** — and the editor's tsc has no
`strictNullChecks`: `x !== undefined && 'defer' in x` narrows in the package and not there (third recurrence; split it).
🔴 **A spec that needs "a node with no rule" must take one from §50's out-of-scope list** (`net.noodl.PatternExtractor`),
never a scheduled node — four specs borrowed `net.noodl.Hash` and went red the session it was translated.
🔴 **Parallel rows conflict in exactly four places**: the floor (+ its ratchet comment), the six pins, the `||` chain of
hook gaps in `component.ts`, and `resolveExpr`'s if-ladder in `plan.ts`. Merge one branch at a time; run the package
tsc after every stitch; re-run the six pinned specs + every new spec before committing the merge.
🔴 **A sub-agent that "arms a monitor" and goes idle is waiting for nothing** — read its `*.exit` file and resume it.

## Open residuals (registered, none blocks an AC; owner NONE unless said)

- §57.5: a number-typed static `id` drops Item Id rather than coercing; a Repeater Item nested one component below the
  template refuses; `foreach.tsx` feeds a template input named `Id` that `template-inputs` never supplies (pre-existing).
- §58.5: **a boundary's wired Filter is never walked by `hookExprSources`** (a latent §54 hole; owner P18); the
  set-then-parse one-click order; the transports that would feed these nodes are Tier 3.11.
- §59.5: a Digest/Value/Error read from a sibling handler before the attach pass refuses as "never fired" even when Do
  is fired (inherited from the id nodes' `rowIsReadable`); `UUID`'s Failure arm does not raise while its runtime does.
- §56.7, §55.7, §54.7, §53.7 rows unchanged.

## Instruments

Agents' scratch dirs (outside the repo, survive worktree removal): `/Users/richardosborne/vscode_projects/OpenNoodl-worktrees/p18-scratch-row{7,8,9}/`
(`EXPECTED.md`, `probe-reverted.log`, `probe-built.log`, `mut.py`, `mut-summary.txt`, `suite.log`/`whole-suite.log`).
Orchestrator logs in the s85 scratchpad `3b1e55b7-…`: `COMMON-BRIEF.md` (the agent brief — reuse it), `editor-tsc.log`, `testci.log`.
The three worktrees were removed after the merge; branches `p18-row7/8/9` kept.

## Standing practice

`cline-dev`; commit by exact pathspecs; `git add` untracked first; delete probe specs before committing; reconcile the
suite count against disk (71); `grep -a`; absolute paths — **the shell cwd resets between calls**; `with open(...)`
for every file write; **`vm_stat` + `ps` before any suite, never more than one of mine, wait for a peer's suite,
announce launches and teardowns, tear servers down the moment the drive is read.**
