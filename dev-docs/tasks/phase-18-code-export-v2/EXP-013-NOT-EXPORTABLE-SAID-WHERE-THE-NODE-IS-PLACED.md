# EXP-013 — "Not exportable yet", said where the node is placed

**Status:** 🟢 **BUILT, GATED, DRIVEN — session 78, 2026-09-03.** All seven ACs below carry their grade; the record is at the end of this file.
**Owner:** P18. **Opened by:** Richard's ruling, 2026-09-03 (EXP-011 §50): *"we need to be super clear
when someone is doing code export which nodes can't be exported and what will happen, because if it's
'well your whole error pathway will just not work, sorry bud' then there's no point in exporting."*
**Priority:** 🔴 High. **Difficulty:** 🟡 Medium — the attribution half is the work; the badge is a wire.

## Objective

A person learns that a node will not export **at the moment they place it**, not at the moment they
export. And when they do export, the pre-flight names the nodes, says what each refusal silences
downstream, and gives a plain verdict when the loss is a pathway rather than a node: *change these
nodes, or wait for a release that translates them.*

## What is true today (measured, §50.2)

1. **A refusal cascades.** `analyze/plan.ts` refuses every node whose only trigger is a refused node,
   with the reason *"its Do is never fired by a translatable trigger"* — the record verbs, `Navigate`,
   `HTTP Request`, `Cloud Function`, the files. One `Run Tasks` in a flow silences everything behind
   it; one refused `On App Error` removes the whole error pathway. The pre-flight's sentence *"left
   out, never translated wrongly"* is true of the node and silent about the pathway.
2. **Nothing in the editor reads the ledger.** No badge in the node picker, nothing in the property
   panel. The first a person hears is `CodeExportModal`, which lists **components with refusal
   counts**, not node names. Names and reasons arrive in `EXPORT-REPORT.md` after the write.
3. **The ledger already carries the sentence per type** — `coverage-ledger.json`, 60 `deferred`
   rows, every exemption enforced to start *"scheduled — "* or *"deliberately out of scope — "*.
   The editor reaches `@nodegx/export` already (EXP-012's webpack alias), so the ledger is one import.

## Acceptance criteria

1. ✅ **The badge.** Every picker card and property-panel header for a type whose ledger status is not
   `translated` carries *"Not exportable yet"* (scheduled) or *"Not exportable"* (deliberately out of
   scope), with the ledger's reason on hover or expand, **read from `coverage-ledger.json`** — never a
   second list. Graded by a `tests-unit` spec that renders one card of each status and one
   `translated` control (jest can grade React here — memory `this-jest-can-grade-a-react-component`).
2. ✅ **The pre-flight names nodes.** `PreflightSummary` carries, per component, the refused nodes by
   type and label, not only a count; the modal renders them. Same list in `EXPORT-REPORT.md`.
3. ✅ **The cascade is attributed.** A refusal whose reason is *"never fired by a translatable trigger"*
   names the refused node that starves it (the `ctx.defer` sites in `plan.ts` carry no cause today —
   that is the code change). The pre-flight then says, per root refusal, *"…and N nodes are left out
   only because this one fires them"*, and the headline separates the two numbers: **N things the
   export has no rule for; M more silenced by them.** Assert cardinality: a fixture with one root
   refusal and three dependants reads 1 + 3, never 4.
4. ✅ **The verdict.** When a root refusal's cascade holds a backend verb, a navigation, or an
   `On App Error`, the modal leads with a plain sentence: *"This export would be missing a pathway,
   not a node: <the root>. Replace it or wait for a release that translates it."* Graded on two
   fixtures — one that trips it and one that does not — and the button text changes with it.
5. ✅ **The report file says the same** as the modal; `readme.ts`'s next steps list the root refusals
   first, since fixing a root fixes its cascade.
6. ✅ **Gates.** Editor `tsc -p tsconfig.json --noEmit` 0 (the editor compiles `@nodegx/export` non-strict
   — EXP-012's trap); `nodegx-export` tsc 0 and jest with the cascade rows; the `tests-unit` badge
   spec; `export-ledger:check` OK; picker floor unchanged (no translation moves).
7. ✅ **Driven.** The editor opened on a copy of a fixture holding a `Run Tasks` (or `On App Error`)
   feeding a `Cloud Function`: the badge shows on the placed node; the pre-flight reads *1 + N* and
   the verdict; screenshots in the scratchpad. `run-editor`, one heavy job at a time.

## Not in scope

- Translating any node (EXP-011).
- A picker filter that hides non-exportable nodes — Richard's ruling is *warn*, not *hide*.

## Where the pieces are

| piece | file |
|---|---|
| the ledger | `packages/nodegx-export/coverage-ledger.json` — `entries[].status`, `entries[].exemption` |
| the pre-flight data | `packages/nodegx-export/src/emit/preflight.ts` — `summarizePreflight`, `attention[]` |
| the modal | `packages/noodl-editor/src/editor/src/views/PopupLayer/CodeExportModal.tsx` |
| the cascade sites | `packages/nodegx-export/src/analyze/plan.ts` — `grep -na 'never fired by a translatable trigger'` |
| the report + readme | `packages/nodegx-export/src/emit/report.ts`, `readme.ts` |
| the picker card | `packages/noodl-editor/src/editor/src/views/NodePicker/components/NodePickerCard/` |

## The record — session 78 (2026-09-03), build to commit

### What was measured before anything was built (the reverted arm, `probe13-reverted.log`)

`tests/fixtures/task-desk` — a button fires a `Run Tasks`, whose `Done` calls a `Cloud Function`
whose `Done` navigates, and whose `Completed` fires a `Set Variable` fed by a `String`, read by a
`Text` through a `Variable`. The committed exporter said, in full: **seven notes, none naming the Run
Tasks node.** Its id appeared only inside two dropped-wire keys, and `sweepUnreportedDeferrals`
takes any mention — a wire key included — as the node having been reported. The five nodes behind it
were refused as **three different sentences**: *"the trigger is not a rendered element event or a
receiver"* (Cloud Function, Set Variable), the catch-all *"logic node (RouterNavigate)"* (the wire
into it was never attached, so it fell through), and *"no static binding"* (the constant). And the
`Variable` — written by nothing translatable — was refused too, so the `Text` reading it was dropped:
**the cascade reaches five nodes, not the three the task file guessed, and it reaches a visual
binding.** The pre-flight modal said *"Pages/Tasks — 7 refusals"*. §50.2's sentence *"never fired by
a translatable trigger"* is one of the family, not the one this shape produces.

🔴 **So the attribution could not be keyed on reason text**, which is how the task file framed it
("the `ctx.defer` sites carry no cause"). Three sentences, one cause, and any rewording of any of
them would have made a text-keyed rule miss a victim silently.

### What was built

- **`RefusedNode` rows (`ir/types.ts`), built from `dispositions` at each of `planComponent`'s three
  exits** (`collectRefusals`, plan.ts) — one row per refused node whether or not any note names it,
  with the picker's `displayName`, the author's label, the reason, `pathway`, and `causedBy`: the
  **roots** of the cascade, resolved by graph (every incoming signal wire from a refused node; a
  constant whose every consumer is refused; a `Variable` whose every same-named `Set Variable` is
  refused), through intermediates, with a visiting set for cycles. `isPathwayType` exported beside the
  verb tables.
- **`cascadeOf` / `pathwayVerdict` / `refusedNodeLines` / `plainReason` (report.ts)** — one
  computation read by the pre-flight (`summary.cascade`, `summary.verdict`, `attention[].nodes`),
  `renderPreflight`, `EXPORT-REPORT.md` (the verdict, the two numbers, the roots, and a *"Nodes left
  out"* list under each component), and `nextSteps` (the roots are step 1). An `On App Error` alone
  is a root with an empty cascade and the verdict *"the app has no error pathway"*.
- **`src/ledger.ts`** — `exportBadgeOf(typeName)` reads `coverage-ledger.json`; the kind is the
  exemption's opening phrase, the one `export-ledger:check` enforces. `stubbed`/`backend-only`/
  unknown → nothing.
- **Editor**: `utils/codeExport/exportBadge.ts` (the seam), `views/common/ExportBadge` (no hooks, no
  `Icon`), `PickerItem.exportBadge`, the picker card (a **dot** in the ⏎ slot — the words were
  clipped by the name's ellipsis on the drive, `drive13-03-picker.png`), the preview pane (the
  full reason in the LGC-001 frame), the property header (beside the type chip), and
  `CodeExportModal` (the verdict, *"1 node … and 5 more"*, the roots and their cascades, the nodes
  under each component, *"Export anyway — choose folder…"*).

### Gates (each run alone)

```
nodegx-export: tsc 0 · jest 62 files, 1850/1852 at the full run — the 2 red were BOTH on HEAD before this session
  (object-store D6 asserted the §7.3 sentence §50 rewrote; unreported-deferrals counted 1 report line) — fixed, rerun green
  cascade.test.ts 35 rows; the five affected specs 403/403; export-ledger:check OK 176; picker 92/127 holds, --check exit 0
noodl-editor: tsc 0 (🔴 it was RED on HEAD: two `'defer' in curve` narrowings from §49 only typed strict — `isDefer()` now)
  tests-unit/exp-013: 147/147 (badge over the real ledger — 56 deferred + 88 translated placeable types — the modal on both fixtures)
arms 6/6 killed: M1 one-hop attribution (8 red, goHome names sync) · M2 victims counted on both sides (8) · M3 no pathway family (4)
  · M6 reason not plain (2) · M4 badge kinds swapped (13) · M5 button text constant (1)
```

### The drive (`run-editor`, `dev:debug`, on a copy of `task-desk` registered in recents, torn down after)

- **Property panel**: selecting the placed Run Tasks node reads `Run the batch · RUN TASKS · DATA ·
  NOT EXPORTABLE YET`, the badge reachable by `elementFromPoint`, its title the ledger's sentence
  (`drive13-02-panel.png`).
- **Picker**: `Run` → the Run Tasks card carries the 14×14 dot, reachable; Expression / Visual
  Function / Function beside it carry none; the preview pane reads *NOT EXPORTABLE YET — You can
  place and run it, but "Export as React code" leaves it out — and every node it fires — until a
  release translates it. …* (`drive13-05-picker-dot.png`).
- **Pre-flight**: Settings → Project → *Export as React code…* → the modal leads with *This export
  would be missing a pathway, not a node: "Run the batch" (Run Tasks) in Pages/Tasks. Without it,
  "Sync tasks" (Cloud Function), "Go home" (Navigate) never run. Replace it or wait…*, then **1 node …
  and 5 more**, the root row with its five, *7 things will not translate in all*, and the button
  **Export anyway — choose folder…** (`drive13-04-modal.png`). Cancelled; nothing written.

### What this found that was not in the task file

1. 🔴 **A refused node named only inside wire keys is never named as a node**, and the sweep that
   exists to stop that counts a wire-key mention as a report. The rows are built from
   `dispositions`, which every gate writes; the notes are left as they were (no golden moved).
2. 🔴 **The cascade reaches stores and bindings, not only triggers.** A `Variable` nothing
   translatable writes is refused, and the `Text` bound to it goes blank in the exported page —
   the fixture's status line. Rule 3 in `collectRefusals` is that case.
3. 🔴 **The editor's `tsc` was red on HEAD** from §49 (two `'defer' in x` narrowings). The package's
   strict `tsc` cannot see it; EXP-012 recorded exactly this trap and it recurred one session later.
   Any exporter change owes the editor `tsc` too.
4. ⚠️ The card is ~150px with an ellipsised name: a text badge there is clipped before it is read.
   Measured on the first drive frame; the dot is the fix, the words ride on `title`.
5. ⚠️ `text()` in `renderElements` prints a node's own text before its children's, so a sentence
   spanning a `<strong>` boundary cannot be asserted as one substring.

### Left open

- The canvas itself carries no mark (the property panel and picker do). A warning-level
  `WarningsModel` entry per non-exportable node would put a triangle on every project that never
  exports — not added; owner NONE until someone asks for it.
- `EXPORT-REPORT.md` now names refused nodes twice (the row and the note). Deliberate; the two say
  different things (what, and why by wire).
