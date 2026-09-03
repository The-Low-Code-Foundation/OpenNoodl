# Next session — §51 `Component Children` is 🟢 (session 79, 2026-09-03): picker 93/127. Next = EXP-011 Tier 2.8 row 2, `Script`, in §50's order

## 🔴 Read this first — Richard, 2026-09-02: *"Stop fucking up the CPU."*

One heavy job at a time on this 16 GB box. Session 79 ran every gate alone: the full suite in the
background while only files were written; then the two pinned files → the editor tsc → the seven
arms as one sequential chain; the dev stack only after every suite had exited, `dev:stop` the
moment the toast and the files were read. Eight other Claude sessions held this checkout the whole
time. Memory: `do-not-pile-cpu-work-on-a-shared-box`.

## The board, re-derived from the task files

| task | status |
|---|---|
| EXP-001 `@nodegx/core` | ✅ Published `0.1.0` (its file carries an uncommitted 09-01 note listing four `0.1.1` rows — not this session's, left in place) |
| EXP-002 / 003 / 005 / 006 / 007 | unchanged |
| EXP-004 | 🟡 built + driven; drill-down panel + three lines for Richard remain |
| EXP-008 | ✅ `export-ledger:check` OK — 176 types, 100 translated |
| EXP-009 backend connection | 🟢 |
| EXP-010 | 🟢 |
| EXP-011 picker coverage | 🟡 **93/127 (73.2%)** — §51 built Tier 2.8 row 1; **row 2 `Script` is next** |
| EXP-012 | 🟢 |
| EXP-013 "Not exportable yet" | 🟢 s78 |

## What session 79 did (EXP-011 §51 — `Component Children`)

1. **Read the runtime, then predicted** (`EXPECTED14.md`): `nodescope.ts:217` creates no node for
   the marker and sets its parent as the instance's child root; `componentinstance.ts:250`
   `setChildRoot` inserts the placed children at the marker's index, in order; the last marker's
   parent wins, the first marker in it is the position; a parentless marker does nothing.
2. **Measured the reverted arm** (`probe14-reverted.log`): the placed children were dispositioned
   `static`, listed in `childrenOf[instance]`, and never emitted — no note, *0 refusals*. The
   wrapper's marker was refused as a visual with no generator, its AC3 marker printed after the
   footer rather than where it sat.
3. **Built**: `RenderRole 'slot'`, `chooseChildSlot`/`parentMapOf`/`CHILD_SLOT_TYPE` (plan.ts),
   `ComponentPlan.childSlot` set from the pure rule *before* the walk; `dropSubtree` for a
   marker-less or unresolvable target; markers the walk never reached named after it.
   component.ts: `{children}` at the slot, the instance's `renderChildBlocks` as JSX children
   (a dropped child's marker lands inside the element), `children?: ReactNode` on the interface,
   destructured only when rendered, `ReactNode` in the React import, `children` reserved. Ledger
   `translated`, floor 93, the two floor pins moved.
4. **Gates alone**: pkg tsc 0 · jest 63 files (63 on disk) 1889 · editor tsc 0 · ledger OK · picker
   93 `--check` exit 0 · arms M1–M7 all red, all restored.
5. **Driven**: badge gone from the `Component Children` card by itself (Run Tasks still dotted),
   the pre-flight's one refusal named, the real `writeExport` path through the
   `FileSystem.instance.chooseDirectory` seam, 16 files, `Panel.tsx` byte-identical to the golden.
   Stack torn down, recents restored.

## 🔴 Do this next — EXP-011 Tier 2.8, row 2: `Script`

Read **EXP-011 §3 Tier 2.8**, **§50** and **§51** first. Then `Script` in the same shape: the
runtime file first (`grep -rna "'Script'" packages/noodl-runtime/src/nodes` — it is the escape
hatch, so read what it can reach: inputs/outputs declared by the script, `this.setOutputs`,
signals), `EXPECTEDnn.md` before any run, a fixture on disk with two or three of the shapes an
MCP-built project actually uses (ten `Script` nodes sit in one drive project on disk — read them
for the real shapes before inventing any), the reverted arm measured, the arms, the drive with
a `dev:stop` teardown, commit by pathspec. Then `Run Tasks`, `On App Error`, `Create New Array`
(design session first — §7.3's anonymous-Id-by-wire), … `Sign In With` stays OUT.

🔴 **Every exporter change owes the editor `tsc` too** (EXP-012's trap, recurred in s78).
🔴 **A contract decided by two rules on two sides disagrees at the corner** (§51.4): if the wrapper
and the instance ever read the marker differently, the exported app fails its own typecheck on a
shape no fixture has. Keep both on `chooseChildSlot`.

## Open residuals (registered, none blocks an AC)

- §51.7: `droppedChildMarkers` loses a dropped child's position among rendered siblings (owner
  NONE); the `_props:` signature branch has no driving row; the preview said *"No HOME component
  selected"* on the generated fixture copy — unmeasured whether generator or preview.
- EXP-013: no canvas mark. §49.3 / §48.6 / §47.3 / §46.6 / §45.3 / §44.3 / §43.3 / §41.3 unchanged.

## The numbers (last honest readings, s79)

```
packages/nodegx-export: tsc 0 · jest 63 files 1889 rows · component-children.test.ts 19
noodl-editor: tsc 0 (the working tree, holding peers' uncommitted editor edits)
export-ledger:check OK — 176 types, 100 translated · picker 93/127 (73.2%), floor 93, --check exit 0
arms: M1 8 · M2 3 · M3 5 · M4 5 · M5 6 · M6 2 · M7 1 — all red as intended, all reverted (no .mutbak left)
```

## Instruments (s79 scratchpad `15960aae-035b-4940-b382-c240405a9d2c/scratchpad`)

`EXPECTED14.md`, `mkfixture14.js`, `probe14.ts` + `probe14-reverted.log` / `probe14-after.log`,
`tsn.sh` (ts-node with the compiler options the repo's tsconfig chain refuses), `tsc14-*.log`,
`jest14-*.log`, `mut14.py` / `runmut14.sh` / `mut14-summary.txt` / `arm14-*.log`, `cdpeval.js`,
`patchfs14.js` (the folder-dialog seam), `open14.js` / `settings14.js` / `readmodal14.js` /
`readpicker14.js`, `reg14.sh` (recents, with `restore`), `drive14-0{1..4}-*.png`,
`drive14-project/`, `drive14-out/` (the written export), `recents.backup.json`.

## 🔴 What session 79 would tell you if it could only say three things

1. **A `static` disposition on a node that is never emitted is invisible to every instrument
   built on `dispositions`** — including EXP-013's cascade rows. Read the emitted file.
2. **Decide a two-sided contract with one function.** The wrapper's prop and the instance's
   children must come from the same rule; the corner where two rules disagree is exactly the one
   no fixture has.
3. **Two clicks on a toggle is open-then-close.** The "click twice" rule is for the Modal ghost,
   not the picker's plus; the picker opened on one click.

## Standing practice

`cline-dev`; commit by exact pathspecs; `git status | grep '^??'` first (`git add` untracked before
a pathspec commit or they are skipped silently); delete probe specs before committing; reconcile
the suite count against disk (63); `grep -a`; absolute paths; a `$VAR` holding a command with
spaces is NOT word-split in zsh — put it in a script; **`vm_stat` + `ps` before any suite, never
more than one of mine, tear servers down the moment the drive is read.**
