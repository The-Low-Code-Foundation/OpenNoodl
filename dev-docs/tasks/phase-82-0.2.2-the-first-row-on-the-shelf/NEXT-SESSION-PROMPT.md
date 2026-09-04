# Phase 82 — next session

## The board, re-derived from [`TASKS.md`](TASKS.md) at 2026-09-04, session 28

🔴 **Re-derive it again yourself.** This phase has now been overtaken nine times by a ruling or a
row that landed after a handoff was written. **The task files are the board; this section is a
convenience.** ⚠️ s20 said *"there is no fully-buildable row left"*, s22 said *"every row is CLOSED
or waiting on Richard"*, s23–s26 each said the same, and **s25, s26, s27 and s28 each built a whole
session out of a finding the previous handoff had registered with owner `NONE` and not built.**
✅ **Read the FINDINGS a row owns, not only its status.** Four sessions running, the next job was
sitting in the previous handoff's "⬅️ What is left" list.

| # | row | state |
|---|---|---|
| 6 | REL-002c — every page as good as the homepage | 🟢 **Everything a session can do is done.** ⏳ **RICHARD'S LOOK** + the four judgements §7.3 names |
| 6b | [REL-010](REL-010-AS-GOOD-AS-THE-PAGE-HE-RATED.md) | ⏳ **RICHARD'S LOOK.** AC1–AC5 met s15, AC6 is a person. Pictures current as of s26 |
| 7 | REL-001 — publish the members' area | ⏳ **RICHARD.** *fix first, publish once*. ✅ Nothing stands against this row |
| 8 | REL-004 — cut and tag `v0.2.2` | 🔴 **Blocked**: `cline-dev` unpushed (**672** at s28 close — re-derive at cut time), CI has run on none of it. ⚠️ **s28 found a release-gate drive RED at HEAD** — see below |
| 9a / 9b / 10 | REL-011a / REL-011b / REL-009b | 🟢 CLOSED s17 / s19 / s21 |
| 9c | REL-011c — the three surfaces reach PASSABLE | 🟡 AC1 + AC2 met, all findings built, **plus s27's public outline and s28's admin outline**. ⏳ AC3 is Richard's ruling |

## 🟢 What session 28 did

One job, taken from s27's §"What is left" item 3 — registered, owner `NONE`, explicitly not built.
Write-up: **[REL-011 §6](REL-011-THE-SITE-BUILDER-SHIPS.md)**.

**The six admin screens' rendered outline had never been looked at by anything.** Measured before a
line was written: a repo-wide sweep for a rendered `<main>` returned **exactly two files** — the
public-site drive and the members' drive. The three drives that actually load an admin screen
matched nothing for `main`, `h1`, `nav`, `landmark` or `outline`. (The sweep was run against a
known-firing control first.)

**Four of the six are now graded at render time**, on page loads the drives were already making:

| gate | screens | HEAD | reverted arm |
|---|---|---|---|
| `sbr010-messages-drive` **§7** | `/admin/signin`, `/admin/pages`, `/admin/messages`, each twice (empty + with rows) | **6 of 6** loads: one `<main>`, one `<h1>`, `<h1>` inside it | **0 of 3** |
| `sbr009ThemeEditorDrive` **§4** | `/admin/theme` | 1 / 1 / inside | 0 / 0 / 0 |

Both reverted arms strip **13 of 13** `as` tags, asserted exactly.

### The instrument is now one module, and it grades itself

`packages/noodl-mcp/tests/documentOutline.ts` — the expression, the type, a `NO_LANDMARKS` sentinel,
`outlineFault()` and `stripOutlineTags()`. `sb008` §6 was refactored onto it (24/24, unchanged,
which is the refactor's control). `documentOutline.test.ts` runs the probe against a **stub
document** in 0.3 s and catches the two ways it could be silently wrong: answering "inside" when
there are two `<main>`s, and asking the document rather than the `<main>`.

🔴 **`NO_LANDMARKS` is `-1`, not `0`.** Zeroes are what a *reverted* arm is supposed to read, so a
never-ran arm leaving zeroes would pass as a working negative control **by not happening**.

## 🔴 Two gates were STALE, and both were found by running them

Neither template was wrong. Both gates were, and each had been wrong for days behind a green board.

### 1. `sbr010`'s D42 pinned `#pick` — FIXED

The drive was **red on the first run of this session**, on a spec §7 never touched. The MCP door
enforces node ids unique **across the whole project** (`graph.ts:186`) and suffixes the loser of a
collision in authoring order. Commit **`3f95a804`** (2026-09-03) added a node called `pick` to
`/Admin/PresetChip` — a preset chip, unrelated to the contact form — which took the name and
silently renamed `__cloud__/site/ContactRecipient`'s node to **`pick-2`**.

The fix is **not** `#pick-2` (the same fragility, fresh literal): D42 now matches the id **base**,
verified against both the Sep 2 step list and today's, so it is not tuned to the reading that
provoked it. **The door's renaming is registered as a product question, owner `NONE`.**

### 2. `ac2-page-editor-drag-drive` is RED at HEAD — 23 of 23

Carried unmeasured since s23 as *"judged not worth a drive, **not** measured"*. Run once this
session as a baseline: **EXIT=1, 23 failed of 23**, throwing in `beforeAll`'s `setParams` helper.
It asserts `runOnChange-in-image` is present-and-false on the node labelled *Fold the edits back
into data* — but the picture handling was split into a separate `absorb` node by `bc012147`
(2026-09-01), taking that input with it. The drive last changed **2026-08-30**.

⚠️ **This is why `/Pages/PageEditor` is still ungraded.** A `beforeAll` that throws means no arm
runs, so the outline capture could not have ridden it. **Repairing the drive is a P77/AC2 job**: the
other 22 specs have never been observed passing in this tree, so its cost is unknown, not small.

## The readings, with their exit statuses

⚠️ **Gate on an exit file the run writes itself.** The task-completion notice said *"exit code 0"*
for a drive that was still executing — the wrapper's status, not the command's. Four sessions
running.

| gate | reading |
|---|---|
| `documentOutline.test.ts` | **11/11, EXIT=0** (new) |
| `sbr010-messages-drive.test.ts` | **22/22, EXIT=0** — 17 before §7's five |
| `sbr009ThemeEditorDrive.test.ts` | **13/13, EXIT=0** — 9 before §4's four |
| `sb008-public-site-drive.test.ts` | **24/24, EXIT=0** — unchanged; the refactor's control |
| `noodl-mcp` full jest | **93 suites / 1257 tests, EXIT=0** |
| `tsc --noEmit -p packages/noodl-mcp` | **0 errors, EXIT=0**; `--listFiles` confirms both new files are in the program |
| `ac2-page-editor-drag-drive.test.ts` | **EXIT=1, 23 failed of 23** — a baseline, see above |

🔴 **`tsc -p packages/nodegx-backend` is NOT a reading of a test file.** Its `include` is `src/**/*`
and it **excludes `**/*.test.ts`** — it returned EXIT=0 having checked none of the edited files.
`typecheck:backend-tests` covers them and **could not complete**: EXIT=**134** (OOM) at a 3 GB heap
with **0 `error TS` in the log**, which reads exactly like a pass, and a timeout with **no exit file
at all** at 5 GB. CI runs it; this box cannot.

✅ **Neither editor suite was run, and neither needed to be.** No editor source, no template
component and no node-count literal was touched, and the editor's webpack provably does not reach
`noodl-mcp` — nothing under `packages/noodl-editor/src` imports it as a module (only string paths to
the built server), so the `nodegx-export` sibling-typecheck hazard does not apply. **Checked, not
assumed.**

## ⬅️ What is left

1. ⏳ **Rows 6, 6b, 7 and 9c are RICHARD'S**, and nothing stands against 6/6b/7.
2. 🔴 **`ac2-page-editor-drag-drive` is red at HEAD, 23 of 23**, diagnosed above. It is a **P77/AC2**
   job and it is the **strongest buildable candidate left** — it is a release-gate drive, the cause
   is known and one-line-shaped, and the unknown is only whether the other 22 specs pass behind it.
   **Owner: `NONE`.**
3. 🔴 **Row 8 needs a push**: **672** commits ahead of `origin/cline-dev`, CI has run on none.
4. ⚠️ **`/Pages/Setup` has no drive that loads it at all.** The site is claimed over HTTP before any
   browser opens, so grading its outline needs a new arm, not a rider. **Owner: `NONE`.**
5. ⚠️ **The MCP door renames node ids project-wide, silently.** Defensible for uniqueness,
   indefensible for anything that refers to a node by id — and nobody has asked which it should be.
   **Owner: `NONE`.**
6. ⚠️ **`<h2>` order is unchecked in BOTH templates.** Every section kind carries one; nothing
   asserts a page's headings descend without skipping a level. **Owner: `NONE`.**
7. ⚠️ **Registered, owner `NONE`**: `/Site/ContactForm`'s stale comment block in
   `sb006Components.ts` (near line 702). Stale prose, not a defect.
8. ⚠️ **REL-010 AC4 and REL-002c §8.5 both say "the nine chrome pages"; the artefact says EIGHT.**
   The gate asserts eight. `README.md` carries a peer's uncommitted paragraph; REL-010's own text is
   Richard's reading material. Neither was edited.

## Working rules for this tree — carried forward, plus what s28 earned

1. 🔴 **A GATE NOBODY RUNS DECAYS AGAINST THE ARTEFACT IT DRIVES, AND ITS DECAY IS INVISIBLE.** Both
   stale gates above broke because an *unrelated, correct* change moved something they name by
   literal. ✅ **A literal id in a gate is a dependency on the authoring order of every other
   component.** Match a base, a type or a role.
2. 🔴 **A NEARLY-COMPLETE VERSION OF A THING IS HARDER TO MEASURE THAN AN ABSENT ONE** (s27).
3. 🔴 **A CENSUS COUNTS THINGS; IT CANNOT SEE A RELATIONSHIP BETWEEN THEM** (s26).
4. 🔴 **A PARAMETER IS AN INTENTION** (s26). ✅ **Take the claim one layer down where a harness
   already goes** — s28's two sections cost one `evaluate` per page load and no new navigation.
5. 🔴 **A CONTAINMENT CHECK NEEDS A THING DELIBERATELY OUTSIDE, IN THE SAME DOCUMENT** (s26).
   ⚠️ s28 found the case that proves it tracks the document: `/admin/signin` has **no** rail, so its
   `navsInDoc` is 0 while every signed-in screen reads 1. Recorded first, asserted second.
6. 🔴 **A SENTINEL MUST NOT COLLIDE WITH A REAL READING.** `NO_LANDMARKS` is `-1` because `0` is what
   a working reverted arm reads; a never-ran arm leaving `0` would pass by not happening.
7. 🔴 **A `tsc` EXIT=0 PROVES NOTHING UNTIL YOU CHECK WHAT THE CONFIG INCLUDES**, and an **OOM logs
   0 `error TS`**. ✅ `--listFiles | grep` is the control. Gate on the exit status, always.
8. 🔴 **A LITERAL COUNT GATE ONLY WORKS IF SOMEBODY RUNS IT** (s23). Touch either template artefact
   ⇒ mcp jest + its drives + `test:main` **and** `test:ci`. s28 touched **no** template component,
   and says so with the check that establishes it rather than the assumption.
9. 🔴 **CHECK WHOSE VERDICT DIRECTORY YOU ARE ABOUT TO WRITE INTO** (s24). `judge()` keys by `today()`.
10. 🔴 **COMMIT BY PATHSPEC, NEVER `git add`** — except untracked paths, which a pathspec commit
    **skips silently**. ⚠️ `phase-82/README.md`, `packages/noodl-mcp/tests/sbr011LivePreview.test.ts`,
    `packages/noodl-editor/tests-unit/rel-002a/` and several more carry peers' work; **s28 left all
    of them alone**, as s24–s27 did.
11. 🔴 **NEVER OPEN `templates/members-area` OR the site-builder template IN THE EDITOR.** Work
    through `npm run template:members` / `template:site-builder`.
12. ⚠️ **A task-completion notice's "exit code 0" is the WRAPPER's status.** It misreported again
    this session, on a drive that was still running. ✅ **Write your own exit file and read that.**
13. ⚠️ **`test:ci`'s readout is `packages/noodl-editor/tests/test-results.json`**, not
    `packages/noodl-editor/test-results.json`.
14. ⚠️ **`typecheck:backend-tests` cannot complete on this 16GB box** — tried twice more at s28
    (EXIT=134 at 3 GB; no exit file at 5 GB). CI runs it. `electron/dist` in `ps` matches the MCP
    servers: **four "editors" were all `noodl-mcp.cjs`** at s28 open. Read `ps -o command=` first.
