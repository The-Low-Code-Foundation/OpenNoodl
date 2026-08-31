# Phase 80 — next session

**Two rows left on the board, and neither is a build-it-now job any more.**
DEF-007 is down to a single AC that is **blocked on the picker**. DEF-036's part 3 turned out to
be **largely already shipped**, and what remains of it is a question for Richard.

🔴 **Read [RICHARD-RULINGS-2026-08-31.md](RICHARD-RULINGS-2026-08-31.md) first**, then
**DEF-036 §6 and §7** — §7 says the row's own acceptance criteria describe the option Richard
overruled. A session that reads §4 top-down will build the wrong thing.

---

## The board

**37 rows. 35 ✅ · DEF-007 🟡 · DEF-036 ⬜.**

🔴 **Derive it from the STATUS COLUMN, never `grep -av '✅'`** (a ✅ in prose filters the row out):

```
grep -aE '^\| DEF-0[0-9]{2} \|' TASKS.md | awk -F'|' '{gsub(/^ +| +$/,"",$2); print $2" :: "$3}'
```

🔴 **Re-derive any "owed" list from the ROW FILES, never from this handoff.**

---

## What session 38 did

- ✅ **DEF-007's two ruled items — BUILT, DRIVEN, COMMITTED** (`457e34f8`). Row file §7 has the
  record, including the drive table and the boundary on what is graded how.
- 🔴 **DEF-036 part 3 — MEASURED, NOT BUILT**, and the measurement changes the job. Row file §6.
- 🔴 **A new defect found while driving** — undo does not restore the home page.
  [UNOWNED-ROWS-TO-MEASURE.md](UNOWNED-ROWS-TO-MEASURE.md) **row 8**.

---

## The plan — read the two findings before picking

### DEF-007 — 🟡 one AC left, and it is BLOCKED

**Both ruled items are done.** What is left is **AC2 alone**: *a curated template installed
**through the picker** opens on its home component.* The picker cannot reach a curated template
until one is published, so this is **not workable from this lane today**.

⚠️ **Do not close DEF-007 on session 38's work**, and do not re-do the two items — they are built,
driven and gated. If AC2 is still unreachable, the honest move is to say so and leave the row 🟡.

### DEF-036 — 🧭 a question for Richard, then parts 1 and 2

🔴 **Part 3 is mostly already true, and the ruling summary's phrasing is what hid that.** Measured
at HEAD (§6): a wire to an absent schema field **already** remains on the canvas, is **already**
drawn dashed, and **already** raises an error.

| Richard's clause | today |
| --- | --- |
| *"it would remain"* | ✅ already true — nothing prunes it |
| *"but be a dotted line"* | ✅ already true — `NodeGraphEditorConnection.ts:960`, and the canvas passes **no** level filter |
| *"the errors would flag …"* | ✅ already true — `con-no-target-port`, `error`, `showGlobally` |
| dropped from the **build** | 🔴 true — `exporter/util.ts`, `{ levels: ['error'] }`. **The only gap.** |

**So *"today they are dropped, not dashed"* is half right: dropped from the BUILD only.**

🧭 **The question for Richard, and it should not be guessed at.** The only thing left to change is
whether such a wire **survives the export** — and that **contradicts DEF-034**, which was ruled
deliberately (an `error` means *"this cannot work at all"* and still deletes). Under Ruling B the
column genuinely does not exist, so an exported wire would deliver a value to nothing.
**Read narrowly, part 3 is already satisfied and should be closed rather than built.**

⚠️ **The measurement is READ AT HEAD, not driven.** Settle it by opening a project with a
`net.noodl.user.*` node, emptying the schema cache (DEF-035 §6's recipe) and looking at the canvas.
**Do that before relaying "already ships" as fact.**

**What is left with real value is parts 1 and 2** — and the ruling itself says part 2 is the half
that matters: *"an empty schema today produces no ports **and no explanation**."* The explanation
is still missing, and nothing measured this session changes that.

1. **No backend attached / not running ⇒ no Add button, no field list, an explicit warning.**
   🔴 **This is the part that closes the person-sentence.**
2. **An "Add a field" button on the data node**, jumping into the schema editor for the table
   already chosen in that node's dropdown.

⚠️ **Parts 1–2 are our internal DB only.** Do not generalise to external backends without asking.
🔴 **Do NOT re-open the ruling by re-arguing the 271 dropped wires.**

🔴 **§4's AC1/AC2/AC3 are Option A and were overruled — rewrite them before building (§7).**
AC4 and AC5 survive.

---

## Needs a human — do not decide these alone

1. 🧭 **DEF-036 part 3: is it done?** If Richard meant the canvas, it already behaves that way and
   the row should close it. If he meant the wire should also survive the build, that reverses
   DEF-034 and is a different, larger change.
2. 🧭 **DEF-007 AC2** stays open until a curated template can be installed through the picker —
   whether to keep the row open on that alone is a call worth putting to Richard.

---

## Still owed on rows marked ✅ — say this before quoting them

- ⚠️ **DEF-007's wiring is graded by the DRIVE ALONE.** `EditorClipboard` **cannot be imported
  under this jest** — it reaches `bugtracker.ts`, which calls `platform.getUserDataPath()` at
  module scope. A pure-module spec here passes against a module nobody calls.
- ⚠️ **DEF-007: the publish refusal was never driven through the real share UI** — it needs a
  signed-in community session and a live route. The decision function was driven against the real
  project's manifest in a running editor; the dialog sentence is graded by the exhaustive
  `EVERY_OUTCOME` test only.
- ⚠️ **DEF-037's deployed-app arm is untested end to end**; **`borderColor` on Checkbox and Radio
  Button were not driven.**
- ⚠️ **DEF-007 AC4's scan cannot see a reader that never constructs a `ProjectModel`** — code
  export, the MCP server, template generation. Prose in `NON_FROMJSON_READERS`; nothing enforces it.
- ⬜ **DEF-031's and DEF-029's panel halves** both still need the property panel read out of the
  DOM. ✅ **`cdp click` takes a SELECTOR — stamp an id first.** A `cdp canvasclick` helper is
  still unbuilt.
- ⬜ **DEF-005's `Roles` output has still not been driven** in a real editor.

---

## Gates — measured this session at `457e34f8`

| gate | result | exit |
| --- | --- | --- |
| `npx jest` in `packages/noodl-editor` | **6517 passed, 5 failed** | **1** |
| `npx tsc --noEmit -p packages/noodl-editor` | clean, 0 `error TS` | **0** |

The 5 are `sb-007` (2), `sb-018` (2), `aib-007` (1) — **the floor exactly, somebody else's open
work; do not read them as this phase's and do not "fix" them.**

🔴 **Gate on the EXIT STATUS.** An error-line count only confirms a run that finished — and note
that a trailing `echo` makes a backgrounded command report exit 0 while jest exited 1. Capture
`EXIT=$?` from the command you actually care about.

⚠️ `typecheck:backend-tests` **cannot complete on this box** (OOM, exit 134, zero `error TS`
lines — it reads as a pass). CI runs it; never promise a local reading.

---

## Traps this session added

- 🔴 **A guard whose module cannot be imported is graded by nothing but a drive.** Say which half
  a spec covers, out loud, rather than letting a green pure-module suite imply the wiring works.
- 🔴 **Run the control FIRST and take it from the searched population.** The control here was a
  node that is a *descendant of the home* — it tests the predicate, not the boundary. It raised no
  dialog while the delete plainly worked, which is what excluded a broken harness.
- 🔴 **Prove the CONFIRM branch too.** A spec that only shows the dialog appears passes equally
  against a refusal — and a refusal is the thing this design deliberately is not.
- 🔴 **A ruling SUMMARY can carry a phrase the code contradicts.** *"Dropped, not dashed"* was half
  right and would have sent a session hunting for a dash that already ships. **Check the clause,
  not the sentence.**
- 🔴 **A row's ACs can outlive the option they were written for.** DEF-036 §4 is Option A after
  Richard chose B — the second time this phase (DEF-037 AC3 was the first). **When a ruling
  reverses a recommendation, rewrite the ACs in the same session.**
- 🔴 **`git commit <pathspecs>`, never stage.** A peer's P81 commits landed between this session's
  work, and two peer files (`AskAboutNodeDialog.module.scss`, a `border-sweep` spec) sat dirty
  throughout. Both survived.
- ⚠️ **`cd` persists between Bash calls, and zsh needs globs quoted** (`--include='*.ts'`).
- ⚠️ **`$PIPESTATUS` is bash; zsh is `$pipestatus[1]`.** An empty `EXIT=` is not a pass.

---

## The drive harness

- ✅ **The webpack seam still works and survives in-app navigation**:
  `window.webpackChunknoodl_editor.push([[id],{},(r)=>{window.__req=r;}])`, then
  `__req('./src/editor/src/models/projectmodel.ts')`. Module ids are readable source paths.
- ✅ **To get the live `NodeGraphEditor`**: patch its prototype (`paint`/`repaint`/`selectNode`) to
  stash `this`, then click the canvas. `ng.selector._selected` is the selection (**not**
  `ng.selection`), `ng.clipboardActions` is the `EditorClipboard`, `ng.roots` are the view nodes.
- ✅ **To open a project**: `LocalProjectsModel.instance.openProjectFromFolder(dir)` adds it to
  recents but does **not** set `ProjectModel.instance` — clicking the launcher card does.
  🔴 **Settle which project is loaded by `_retainedProjectDirectory`, never the card title.**
- ✅ **`PopupLayer` is `./src/editor/src/views/popuplayer.ts`** (`.ts`, not the extensionless
  path), and wrapping `showConfirmModal` to record its options is a clean way to read a dialog
  without depending on the DOM.
- ⚠️ **`~/Documents` is iCloud-backed** — drive from `vscode_projects/NodeGX test projects/`.
  `def007-drive` is this session's fixture (a copy of `DEF-015 Card Drive`).
- ✅ `npm run dev:stop` reaped 26 of its own processes and shielded the peer MCP servers.

## Unowned rows — eight

[UNOWNED-ROWS-TO-MEASURE.md](UNOWNED-ROWS-TO-MEASURE.md). **Row 8 is new this session** and is the
strongest of them: *undo restores the deleted home NODE and leaves the project with no home*, so
the damage is not fully undoable. **Measure one row fully before starting the next.**
⚠️ Next free id is **`DEF-038`**.
