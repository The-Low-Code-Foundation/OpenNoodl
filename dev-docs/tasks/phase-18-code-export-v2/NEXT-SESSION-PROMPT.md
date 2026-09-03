# Next session — EXP-013 is 🟢 (session 78, 2026-09-03): the badge, the cascade, the verdict — built, gated, driven. Next = EXP-011 Tier 2.8 row 1, `Component Children`, in §3's order

## 🔴 Read this first — Richard, 2026-09-02: *"Stop fucking up the CPU."*

One heavy job at a time on this 16 GB box. Session 78 ran every gate alone (the full suite in the
background while only files were written; the arms sequential; the dev stack only after every suite
had exited, and `dev:stop` the moment the third screenshot was read). Memory:
`do-not-pile-cpu-work-on-a-shared-box`.

## The board, re-derived from the task files

| task | status |
|---|---|
| EXP-001 `@nodegx/core` | ✅ Published `0.1.0` |
| EXP-002 / 003 / 005 / 006 / 007 | unchanged |
| EXP-004 | 🟡 built + driven; drill-down panel + three lines for Richard remain |
| EXP-008 | ✅ `export-ledger:check` OK — 176 types, 99 translated |
| EXP-009 backend connection | 🟢 |
| EXP-010 | 🟢 |
| EXP-011 picker coverage | 🟡 **92/127** — §50 re-ruled the list; **Tier 2.8 row 1 is next** |
| EXP-012 | 🟢 |
| EXP-013 "Not exportable yet" | 🟢 **s78 — all 7 ACs, 6/6 arms, driven on the picker card, the property header and the pre-flight** |

## What session 78 did (EXP-013)

1. **Measured before building** (`EXPECTED13.md`, then `probe13-reverted.log`): on
   `tests/fixtures/task-desk` (button → `Run Tasks` → `Cloud Function` → `Navigate`; `Run Tasks` →
   `Set Variable` ← `String`; `Variable` → `Text`) the committed exporter wrote seven notes and
   **never named the Run Tasks node** — its id lived only inside wire keys, which
   `sweepUnreportedDeferrals` counts as "reported". The five nodes behind it were refused as **three
   different sentences**, and the `Variable` nothing translatable writes was one of them, so the
   `Text` bound to it goes blank in the exported page. The task file's "three dependants" was five.
2. **`RefusedNode` rows from `dispositions`** (`collectRefusals`, all three plan exits), `causedBy`
   resolved **by graph** to the roots (trigger wires; a constant's consumers; a Variable's setters),
   `pathway` from the verb tables (`isPathwayType`). `cascadeOf` / `pathwayVerdict` /
   `refusedNodeLines` / `plainReason` in report.ts, read by the pre-flight, the report, the README's
   first step, and the modal. `src/ledger.ts` reads the coverage ledger for the badge.
3. **Editor**: `utils/codeExport/exportBadge.ts`, `views/common/ExportBadge` (no hooks, no `Icon`),
   `PickerItem.exportBadge`, the card (a dot in the ⏎ slot), the preview pane, the property header,
   and `CodeExportModal` (verdict first, "1 node … and 5 more", roots with cascades, nodes per
   component, *Export anyway — choose folder…*). `tsconfig` paths + jest mapper for
   `@nodegx/export/*`.
4. **Gates alone**: pkg tsc 0; jest 62 files 1850 green + the two rows that were **red on HEAD**
   fixed (object-store D6 asserted the sentence §50 rewrote; unreported-deferrals counted one report
   line); editor tsc 0 — **it was red on HEAD** (two `'defer' in curve` narrowings from §49, now
   `isDefer()`); tests-unit/exp-013 147/147; ledger OK; picker 92 holds; 6/6 arms killed.
5. **Driven** (`run-editor`, copy of task-desk in recents): panel badge, picker dot + preview reason,
   the modal's verdict and numbers — `drive13-02-panel.png`, `drive13-05-picker-dot.png`,
   `drive13-04-modal.png`. Stack torn down, recents restored.

## 🔴 Do this next — EXP-011 Tier 2.8, row 1: `Component Children`

Read **EXP-011 §3 Tier 2.8** and **§50** first. Then row 1, same shape as §41–§49: runtime file first
(`componentchildren` in the runtime's node library), `EXPECTEDnn.md` before any run, refusals by
name, a fixture on disk (a wrapper component placing `Component Children`, an instance with visual
children), the reverted arm measured, the arms, the drive with a `trap` teardown, commit by pathspec.
Then `Script` (ten in one MCP-built project), `Run Tasks`, `On App Error`, `Create New Array` (design
session first — §7.3's anonymous-Id-by-wire), … in §3's order. `Sign In With` stays OUT.

🔴 **Every exporter change owes the editor `tsc` too** — the package's strict `tsc` cannot see a
narrowing that only types under `strictNullChecks`; s77's did not run it and HEAD was red for a
session. And when a node moves to `translated`, the badge disappears from the picker by itself (the
ledger is the only list) — but the row that asserts `exportBadgeFor('RunTasks')` is scheduled
(`tests-unit/exp-013/exportBadge.test.tsx`) will need its example moved to a node still deferred.

## Open residuals (registered, none blocks an AC)

- EXP-013: no canvas mark (property panel + picker only; a `WarningsModel` triangle per node would
  mark every project that never exports — owner NONE). The report names a refused node twice (row +
  note) on purpose.
- §49.3 / §48.6 / §47.3 / §46.6 / §45.3 / §44.3 / §43.3 / §41.3 unchanged. String-only Variable
  typing; the HTTP body on the control-mint clause; the transform family — still open, still small.

## The numbers (last honest readings, s78)

```
packages/nodegx-export: tsc 0 · jest 62 files 1852 rows (1850 + 2 fixed, rerun green) · cascade.test.ts 35
noodl-editor: tsc 0 · tests-unit/exp-013 147/147 (2 files)
export-ledger:check OK — 176 types, 99 translated · picker 92/127 (72.4%), floor 92, --check exit 0
arms: M1 8 · M2 8 · M3 4 · M6 2 · M4 13 · M5 1 — all red as intended, all reverted (no .mutbak left)
```

## Instruments (s78 scratchpad `a33b955f-d378-49f6-9963-6dd571050ec2/scratchpad`)

`EXPECTED13.md` (+ the measured corrections), `mkfixture13.js`, `probe13.ts` + `probe13-reverted.log`
/ `probe13-after.log`, `tsc13-*.log`, `jest13-*.log`, `mut13.py` / `runmut13.sh` / `mut13-summary.txt`
/ `arm13-*.log`, `cdpeval.js`, `open13.js` / `seam13.js` / `switch13.js` / `select13.js` /
`readpanel13.js` / `plus13.js` / `stampsearch13.js` / `readcards13.js` / `settings13.js` /
`readmodal13.js` / `esc13.js` / `restore13.js`, `drive13-0{1..5}-*.png`, `drive13-project/`,
`recents.backup.json`.

## 🔴 What session 78 would tell you if it could only say three things

1. **A sweep's "does any note mention this node" counts a wire key as a mention.** The root of a
   cascade was the one node the report never named. Build the list from the table every gate writes
   (`dispositions`), not from the prose only some gates write.
2. **Attribute by graph, never by sentence.** One cause arrived as three different reasons; a
   text-keyed rule would have missed two silently on the day one was reworded.
3. **Read the first drive frame before believing the DOM.** The card's badge was in the DOM,
   reachable-by-query, and clipped to nothing behind an ellipsis. The dot is what a person sees.

## Standing practice

`cline-dev`; commit by exact pathspecs; `git status | grep '^??'` first (`git add` untracked before
a pathspec commit or they are skipped silently); delete probe specs before committing; reconcile
the suite count against disk (62); `grep -a`; absolute paths; **`vm_stat` + `ps` before any
suite, never more than one of mine, tear servers down the moment the drive is read.**
