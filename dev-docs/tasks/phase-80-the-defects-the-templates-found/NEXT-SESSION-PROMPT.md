# Phase 80 — next session

🔴 **The next session MUST BUILD.** Session 39 measured and rewrote criteria; it shipped no
product change. **DEF-036's acceptance criteria are now correct and its three seams are located
by file and line** — the hunting is done, and what is left is plumbing. Do not spend this session
re-measuring part 3; it has been driven twice now and the answer did not move.

🔴 **Read [RICHARD-RULINGS-2026-08-31.md](RICHARD-RULINGS-2026-08-31.md) §1 first**, then
**DEF-036 §4** (the Option B criteria) and **§5's seams table**. ⚠️ **§8 is the OVERRULED Option A
set, kept only as evidence — do not build it.**

---

## The board

**37 rows. 35 ✅ · DEF-007 🟡 · DEF-036 ⬜.**

🔴 **Derive it from the STATUS COLUMN, never `grep -av '✅'`** (a ✅ in prose filters the row out):

```
grep -aE '^\| DEF-0[0-9]{2} \|' TASKS.md | awk -F'|' '{gsub(/^ +| +$/,"",$2); print $2" :: "$3}'
```

🔴 **Re-derive any "owed" list from the ROW FILES, never from this handoff.**

---

## What session 39 did

- ✅ **Drove DEF-036 part 3, and s38's source reading holds.** §6's boundary said *"read at HEAD,
  not driven — do that before relaying 'already ships' as fact."* It has been driven, with
  controls in both directions. Details below and in §6.
- ✅ **Rewrote §4's acceptance criteria for Option B** — the thing s38 flagged as blocking anyone
  who builds. Option A is parked verbatim in **§8**, marked do-not-build.
- ✅ **Located the three seams Option B needs** (§5), including the one that decides it: the
  sentence AC1 wants **is already computed and then discarded**.
- ⬜ **Built nothing.** Said plainly rather than dressed up.

### The drive, in one table

Fixture `NodeGX test projects/def036-dash-drive` — a copy of `Noodl projects/LearnBook`
(`md5 2bd73d17…`) with `dbCollections` / `systemCollections` / `dbVersionMajor` **deleted from
`project.json` before it was ever opened**. Real `dev:debug` editor.
`NodeGraphEditorConnection.prototype.paint` wrapped to record every `setLineDash` argument passed
**while that one wire was painting**.

| Richard's clause | driven |
| --- | --- |
| *"it would remain"* | ✅ still in `comp.graph.connections`, still painted |
| *"but be a dotted line"* | ✅ **`setLineDash([5])` inside its own paint** |
| *"the errors would flag …"* | ✅ `con-no-source-port` · `error` · `showGlobally` · **⚠ 174** in the topbar |
| dropped from the **build** | ✅ **2,587 → 2,573 — 14 lost by name, 0 gained** |

**Controls, both directions.** Nine healthy wires in the *same paint pass* recorded no dash. The
*same wire* goes solid, loses its warning and drops the error total **178 → 164** when the schema
is restored — only the schema cache was varied.

🔴 **So *"today they are dropped, not dashed"* is confirmed HALF right — dropped from the BUILD
only.** The canvas already remains, already dashes, already flags.

---

## The plan

### DEF-036 — ⬜ **BUILD parts 1 and 2. This is the job.**

The ACs in §4 are Option B and are ready to build against. Shortest honest path:

1. **AC1 first, because it closes the person sentence.** `schemahandler.ts:213`'s
   `fetchBuiltInSchema` already returns an outcome whose `reason` distinguishes *no backend
   attached* from *attached but not running*. 🔴 **`_fetch` at `:140` drops it** — it reads
   `decision.write`, a boolean, and keeps nothing. **Retain the last outcome; that is the change
   that makes every other part possible.** ⚠️ **Do not recompute "is there a backend" in the
   panel** — two answers drift.
2. **AC2** — no `prop-*` ports and no Add button in that state. That half is already how it
   behaves; what is being added is that it now *says why*.
3. **AC4's button** — ⚠️ **measure first**: `backendSurfaces.tsx:111` registers the `data`
   surface and `openSurface('data')` opens it, but **no table-selection argument was found**.
   AC4 says the front door is not good enough. If the argument does not exist, adding it is part
   of this job, not a surprise inside it.

⚠️ **Our internal DB only** — Richard's explicit rider. A project pointed at an external Parse or
REST backend has no schema editor to jump into, and `fetchBuiltInSchema` already labels that case
`not-applicable`.
🔴 **Do NOT re-open the ruling by re-arguing the 271 dropped wires.** Under Option B they still
leave the build, and the row closes with that true.

### DEF-036 part 3 — 🧭 **one question for Richard, and it is now well posed**

Part 3 is **satisfied on the canvas, measured twice**. The only thing left it could mean is
*"and the wire should also survive the export"* — which **reverses DEF-034**, ruled deliberately
(an `error` means *"this cannot work at all"* and still deletes). Under Option B the column
genuinely does not exist, so an exported wire would deliver a value to nothing.

**Ask it as: did you mean the canvas, or the build?** Read as the canvas — his words are *"it
would remain … and the errors would flag"* — it is done and should be closed, not built.

### DEF-007 — 🟡 **one AC left, still BLOCKED**

**AC2 alone**: a curated template installed **through the picker** opens on its home component.
The picker cannot reach a curated template until one is published. **Unchanged this session, and
not workable from this lane.** ⚠️ Do not close the row on s38's work and do not re-do the two
built items. 🧭 Whether to keep the row open on AC2 alone is worth putting to Richard.

---

## Needs a human — do not decide these alone

1. 🧭 **DEF-036 part 3: canvas or build?** Framed above. Everything needed to answer it is
   measured; nothing more should be spent measuring.
2. 🧭 **DEF-007 AC2** stays open until a curated template can be installed through the picker.

---

## Still owed on rows marked ✅ — say this before quoting them

- ⚠️ **DEF-007's wiring is graded by the DRIVE ALONE.** `EditorClipboard` **cannot be imported
  under this jest** — it reaches `bugtracker.ts`, which calls `platform.getUserDataPath()` at
  module scope. A pure-module spec here passes against a module nobody calls.
- ⚠️ **DEF-007: the publish refusal was never driven through the real share UI** — it needs a
  signed-in community session and a live route. The dialog sentence is graded by the exhaustive
  `EVERY_OUTCOME` test only.
- ⚠️ **DEF-007 AC4's scan cannot see a reader that never constructs a `ProjectModel`** — code
  export, the MCP server, template generation. Prose in `NON_FROMJSON_READERS`; nothing enforces it.
- ⚠️ **DEF-037's deployed-app arm is untested end to end**; **`borderColor` on Checkbox and Radio
  Button were not driven.**
- ⚠️ **DEF-036's drive covered the `User` path only.** The `SignUp` path (`signup.ts`, keyed on
  `systemCollections`) loses its wires in the same export — they are among the 14 by name — but no
  `SignUp` wire was watched being painted. The canvas code is shared and family-blind, so nothing
  suggests it differs; it is unmeasured, not doubted.
- ⬜ **DEF-031's and DEF-029's panel halves** both still need the property panel read out of the
  DOM. ✅ **`cdp click` takes a SELECTOR — stamp an id first.** A `cdp canvasclick` helper is
  still unbuilt.
- ⬜ **DEF-005's `Roles` output has still not been driven** in a real editor.

---

## Gates

🔴 **NOT RE-RUN THIS SESSION, and that is not a pass — it is an absence.** Session 39 changed two
markdown files and no source, so **s38's readings at `457e34f8` still describe the code**:

| gate | result at `457e34f8` | exit |
| --- | --- | --- |
| `npx jest` in `packages/noodl-editor` | 6517 passed, 5 failed | 1 |
| `npx tsc --noEmit -p packages/noodl-editor` | clean, 0 `error TS` | 0 |

The 5 are `sb-007` (2), `sb-018` (2), `aib-007` (1) — **the floor exactly, somebody else's open
work; do not read them as this phase's and do not "fix" them.**

🔴 **Gate on the EXIT STATUS.** An error-line count only confirms a run that finished, and a
trailing `echo` makes a backgrounded command report exit 0 while jest exited 1. Capture `EXIT=$?`
from the command you actually care about. ⚠️ `typecheck:backend-tests` **cannot complete on this
box** (OOM, exit 134, zero `error TS` lines — it reads as a pass). CI runs it.

---

## Traps this session added

- 🔴 **A COUNTER THAT READS ZERO IN BOTH ARMS IS NOT A MEASUREMENT.** The export counter keyed on
  `k.fromProperty`; `exportConnection` emits **`sourcePort` / `targetPort`**
  (`utils/exporter/util.ts:7`). It returned **0 user wires in the arm where they are dropped AND
  in the arm where all 38 are present** — and "0 exported, confirmed" is exactly what it would
  have been quoted as. ✅ **Read the control first. A zero in both arms names a broken instrument,
  never a finding.**
- 🔴 **UNDOING A SETUP STEP MID-SESSION DOES NOT RESTORE THE COLD STATE.**
  `setMetaData('dbCollections', undefined)` left the already-minted ports on the nodes and the
  export still read 2,587. **The empty arm is only real on a COLD LOAD** of a project whose
  `project.json` never had the key. ✅ Reload the renderer and reopen.
- 🔴 **A SOURCE READING CAN BE RIGHT AND ITS POINTERS WRONG.** §6's readings all held, but it cited
  `exporter/util.ts` (it is `utils/exporter/util.ts`) and `NodeGraphEditorConnection.ts:960` (that
  is `restoreWireDash`; the paint-time dash is `:1081`). Corrected in place. **A wrong path costs
  the next session the same search.**
- ✅ **A PAINT SPY BEATS RE-DERIVING THE CONDITION.** Swapping `ctx.setLineDash` for the duration
  of one wire's `paint` and restoring it in a `finally` reads the real canvas in the real frame.
  Re-evaluating `getHealth()` in a console would only have re-run the code under test.
- 🔴 **THE SENTENCE A USER NEEDS IS SOMETIMES ALREADY COMPUTED AND THROWN AWAY.**
  `fetchBuiltInSchema` has drawn AC1's exact distinction since DEF-035; `_fetch` reduces it to a
  boolean. ✅ **Before designing a new diagnostic, grep for the function that already decided.**

---

## The drive harness

- ✅ **The webpack seam works**: `window.webpackChunknoodl_editor.push([[id],{},(r)=>{window.__req=r;}])`,
  then `__req('./src/editor/src/models/projectmodel.ts')`. Module ids are readable source paths.
  ⚠️ **`LocalProjectsModel` is under `utils/`, not `models/`.** It survives a `cdp reload` only if
  you push again.
- ⚠️ **`cdp eval` shares one scope between calls** — a bare `const` collides with the last call's.
  ✅ **Wrap every expression in an IIFE**, and pass long scripts as
  `node scripts/devtools/cdp.js eval "$(cat file.js)"` rather than through `npm run`.
- ✅ **To force a canvas repaint headlessly**: a `WheelEvent` dispatched at the canvas works;
  `window.resize` and a plain click do **not**.
- ✅ **To open a project**: stamp the launcher card (`div[class*=Card--]`), `scrollIntoView` — the
  grid is thousands of px tall and the card is off-screen — then `cdp click`.
  🔴 **Settle which project is loaded by `_retainedProjectDirectory`, never the card title.**
- ⚠️ **`~/Documents` is iCloud-backed** — drive from `vscode_projects/NodeGX test projects/`.
  `def036-dash-drive` is this session's fixture and is reusable: it is a LearnBook copy with the
  schema cache absent from disk, which is the cold arm ready-made.
- ✅ `npm run dev:stop` reaped 26 of its own processes and shielded three peers' MCP servers.

## Unowned rows — eight

[UNOWNED-ROWS-TO-MEASURE.md](UNOWNED-ROWS-TO-MEASURE.md). **Row 8 is the strongest**: *undo
restores the deleted home NODE and leaves the project with no home*, so the damage is not fully
undoable. **Measure one row fully before starting the next.**
⚠️ Next free id is **`DEF-038`**.
