# TUT-003 — the tutorial itself

**Surface:** content + editor · **Tier 3** · **Effort:** M · ✅ **R3 answered 2026-08-20** (§R3 below)

## The premise

The first community tutorial, and the one that teaches [README §0](README.md)'s ruling: **the
Visual Function computes; the canvas does the async work; the signal wire is the await.**

It is deliberately the tutorial *and* the argument. A builder who finishes it should be able to
answer "how do I call the database from blocks?" with "you don't — and here is what you do instead",
without having read a design note.

## What it builds

A one-page "log a thing" app:

```
Button onClick ──▶ Visual Function          (validate + shape the input — SYNCHRONOUS)
                     │
                     ├─ send signal "ok"   ──▶ Create Record ──▶ Done ──▶ Query Records ──▶ list
                     └─ send signal "bad"  ──▶ Text (the reason)
```

Every claim in §0 is exercised: the fan-out (`send signal` registering signal outputs on demand),
the ordering guarantee (the graph sequences on `Success`, and the values are already up to date
because [`logic-builder.ts:400-406`](../../../packages/noodl-runtime/src/nodes/std-library/logic-builder.ts)
flags outputs before firing it), and the round trip back into a second Visual Function if the
learner goes on.

🔴 **It must also teach the cost, not hide it.** README §0's accepted cost is that state gets
re-threaded through ports across the split. The step that would otherwise be painful is the one
where `Noodl.Variables` blocks earn their place — teach that in the same breath, or the pattern
reads as a workaround rather than a design.

## 🔴 A bundle without a `solution/` is not a bundle

[`lessonbundleread.ts`](../../../packages/noodl-editor/src/editor/src/models/lessonbundleread.ts):
without a solution there is **no F2 replay, no F3 decoy and no F4 render** — three of the four
machine-checkable classes go dark, and `installable` is a separate field from `ok` precisely so that
"nothing failed because nothing was checked" cannot read as a pass.

So: bundle root = the starter the learner opens; `solution/` = the finished graph; `lesson.json` =
the steps.

## R3 — answered 2026-08-20: **the learner creates it**

Richard's call, and the machinery had already narrowed it to one arm. What the session measured
before asking:

| | |
|---|---|
| A project's backend lives at `~/.noodl/backends/<id>` | [`BackendManager.js:73`](../../../packages/noodl-editor/src/main/src/local-backend/BackendManager.js) |
| A lesson bundle is a **project directory** | [`lessonbundleread.ts`](../../../packages/noodl-editor/src/editor/src/models/lessonbundleread.ts) |
| `LearningFolderModel.install` has **no** backend or database handling at all | [`learningfolder.ts`](../../../packages/noodl-editor/src/editor/src/models/learningfolder.ts) — zero matches for backend/database/sqlite |
| Nothing anywhere seeds a backend | no `seedBackend`/`seedDatabase`/`backendSeed` in `src/` |

So **"pre-made" was never a pedagogy trade-off; it was unimplemented mechanism.** A bundle cannot
ship a collection, and README §1D forbids this phase building the install side to let it.

⚠️ **One near-miss worth not misreading.** `nodegx.project.json` carries a `metadata.dbCollections`
array (see `Puppy test 3`), which *looks* like a shipped schema. It is a cached view for the
editor's Data panel; the grader reads a snapshot of the **running backend**, so a collection listed
there and absent from the backend still answers `collectionExists: false`. It is not a seeding
route.

**What this decides for the manifest:** the step body names the collection **verbatim**, and the
first data condition is `collectionExists` so a mistyped name surfaces at step 2 rather than three
steps later. `hasColumns` and `rowCountAtLeast` come after it.

🔴 **Do not grade `hasColumns` against a table the backend created itself.** TUT-002's drive:
`/admin/schema` pairs `sqlite_master` with `_Schema` by exact name, so a self-created table returns
`columns: []` and `hasColumns` answers false forever. `User`, `Conversation` and one `Puppy` all did
this on this machine.

## 🔴 What the F2′ fix changed for this task

`check_lesson --backend_id` used to refuse a correct data lesson: it hands one live snapshot to both
the starter and the solution context, so a step whose conditions are **all** data conditions read as
`already-satisfied-in-starter` — AC5's step, exactly. Fixed in `b5058f3b`; F2′ now reports
`not-checked` per step for database-graded steps and says so. Six specs in
`tests-unit/tut-003/f2-prime-and-the-database.test.ts`.

So AC2 and AC5 are now reachable **with** `backend_id`, which is the route that actually grades the
data conditions.

## The graph, in the type names it is actually saved under

Derived from runtime source 2026-08-20 — **none of these are guessable, and three are traps.**

| In the picker | `type` in `nodes.json` | The ports this lesson uses |
|---|---|---|
| Visual Function | **`Logic Builder`** ⚠️ *frozen type id; only the label changed* | program is `parameters.workspace`, a Blockly workspace JSON **string** |
| Create Record | **`NewDbModelProperties`** | in `store` ("Do"), in `prop-<field>` per column, out **`done`** + `failure`, `error` |
| Query Records | **`DbCollection2`** | in `storageFetch` ("Do"), out `items`, `fetched` |
| Repeater | **`For Each`** | in `items`; `parameters.template` names a **component**, so the row needs its own component |
| Button | `net.noodl.controls.button` | out `onClick`; label port `label` |
| Text Input | `net.noodl.controls.textinput` | out **`onTextChanged`** (displayed "Text"), out `textChanged` (signal) |
| Text / Group / Page / Router | `Text` / `Group` / `Page` / `Router` | — |

🔴 **THE TWO NODES IN THIS LESSON NAME THEIR TERMINAL SIGNAL DIFFERENTLY, AND BOTH NAMES ARE RIGHT.**

| Node | Port | Shown as |
|---|---|---|
| **Visual Function** (`Logic Builder`) | `success` — `logic-builder.ts:693`, fired at `:405` | **Success** |
| **Create Record** (`NewDbModelProperties`) | `done` — `dbmodelcrudbase.ts:145`, via `outcomeOutputs({done})` | **Done** |

README §0's sentence — *"a graph sequenced on `Success` reads values that are already up to date"* —
is about the **Visual Function** and is correct as written. This file's diagram said `Success` on the
**Create Record** arrow, and that one was wrong: ERG-001 collapsed `created` and its three siblings
into one displayed **"Done"**, so a step telling the learner to "wire the Success output of Create
Record" sends them hunting for a port that is not there. Diagram corrected above.

⚠️ Worth a sentence of prose in the lesson rather than silence: the learner will see both words on
one canvas, two nodes apart, and nothing on screen explains why.

**The Visual Function's blocks**, by block type (`NoodlBlocks.ts`, and `logic-builder-io.ts:436-481`
is what mints ports from them):

- `noodl_when_signal` — the hat; field `NAME` is the signal **input** it runs on
- `noodl_get_input` / `noodl_define_input` — field `NAME`; `noodl_define_input` also has `TYPE`
- `noodl_define_output` (fields `NAME`, `TYPE`) / `noodl_set_output` (field `NAME`, input `VALUE`)
- `noodl_define_signal_output` / **`noodl_send_signal`** (field `NAME`) — the fan-out §0 is about
- `noodl_set_variable` / `noodl_get_variable` (field `NAME`) — the state re-threading §0 owes the learner

A worked workspace to copy the envelope from:
`NodeGX test projects/cn019-drive/components/Components/Header/nodes.json`.

## Acceptance criteria

1. The bundle installs through `LearningFolderModel.install` and appears in the launcher's Learning
   section with its metadata, absent from the normal picker flow (D5).
2. `lessonbundleverify` scores it **`ok` and `installable`**, with all four classes actually checked
   — a run where F2/F3/F4 report `not-checked` does not satisfy this.
   ⚠️ **Read this at the class level.** Since `b5058f3b` the F2′ half emits a per-step `not-checked`
   *info finding* on every database-graded step, by design. `classes.F2` must still be `pass`; those
   findings are the harness saying which half it could not answer, not a class going dark.
3. Every step's conditions are reachable: `verifyLessonManifest` returns no F1, including for the
   TUT-002 data conditions.
4. Driven end-to-end in the real editor: a learner following the steps completes every step, and
   **"Check my work" grades a deliberately-wrong attempt differently from a correct one** — the
   wrong attempt being a *plausible* error (the Visual Function wired to `Do` on the wrong branch),
   not an empty project.
5. 🔴 **The data condition is observed failing first.** Complete the graph but create no record; the
   data step must stay red. A data condition that has only ever been seen green proves nothing —
   this is the same rule NAT-001 was built under.
6. The tutorial's own backend is created on install and is **not** shared with any other project —
   README §1B. Asserted, not assumed.
7. It reads correctly in both themes; the lesson layer is one of the surfaces NAT-002/003 moved.

## Watch out for

- 🔴 **Opening a project writes three files into it.** Author and drive against a **copy**, and
  expect the bundle's own starter to be dirtied by the act of opening it — bake the bundle from a
  clean source, not from the directory you drove.
- The starter must not inherit another project's backend config. The FIX-004 §C drive hit exactly
  this: a copied project raised `EADDRINUSE 127.0.0.1:8581` because it carried the original's
  backend binding.
- `suggestedNodes` on the data steps should surface the Record family, or the learner hunts the
  picker for a node the step just named.

---

# Session 5, 2026-08-20 — the bundle exists

**The artefact:** [`project-examples/lessons/log-a-thing/`](../../../project-examples/lessons/log-a-thing/)
— 35 files: the starter at the root, `lesson.json`, and `solution/`. Eight steps, six of them graded.

## What it is, in the type names it is saved under

Three components, and the count is the first decision session 4 left open. The Repeater's
`parameters.template` names a **component**, so the list is two components and never one:

| Component | What is in it |
|---|---|
| `/App` | the Router, one route |
| `/Pages/Home` | `Page` → `Group` → heading, intro, `net.noodl.controls.textinput`, `net.noodl.controls.button`, status `Text`, card `Group` → `For Each`; and three parentless logic nodes: `Logic Builder` "Check the entry", `NewDbModelProperties` "Save the entry", `DbCollection2` "Read the entries" |
| `/Components/LogRow` | the Repeater's template: `Group` → `Text`, plus a `Component Inputs` node whose `title` port is declared in **`ports`** (not `dynamicports` — UNI-010 §8.1) |

Every node a step addresses carries a **label**, and every condition addresses it as `#Label`.
That is what keeps F3 clean: not one `%Type` segment in the manifest, so the decoy test has nothing
to displace and there is not a single `fragile-type-address` warning.

## The Visual Function's program, and the one line that would have broken it

```
define input entry (string) · define output title (string) · define output message (string)
define signal output ok · define signal output bad
if NOT (get input entry):  set output message = "Type something first…" ; send signal bad
else:  set variable lastEntryTitle = get input entry
       set output title  = get variable lastEntryTitle
       set output message = ""
       send signal ok
```

🔴 **`workspace` and `generatedCode` were not hand-written.** The node type's own brief says to treat
them as an editor-managed pair. They were **generated headlessly**: `NoodlBlocks.initNoodlBlocks()` +
`NoodlGenerators.initNoodlGenerators()` load in plain Node, so a script loads the workspace JSON into
a real `Blockly.Workspace` and calls `javascriptGenerator.workspaceToCode`. The same script prints
`detectIO(workspace)`, which is how the port set was checked *before* the node was written:
`inputs [entry] · outputs [title, message] · signalOutputs [ok, bad]`. That is worth keeping — it turns
"is my workspace JSON well-formed?" from a drive question into a two-second one.

🔴 **THE CONDITION IS `NOT entry`, AND THE OBVIOUS VERSION IS A BUG.** The first draft was
`isEmpty(trim(get input entry))`. Blockly's `text_trim` generates a bare `.trim()` with no `String()`
coercion, and `registerInputIfNeeded` (`logic-builder.ts:231`) gives an unconnected value input **no
default** — so `Inputs["entry"]` is `undefined` until the learner types, and the *first* thing a
learner does is press the button. `undefined.trim()` throws into `logic-builder/blocks-threw`.
`String(…)` does not fix it either: `String(undefined)` is `"undefined"`, which is not empty, so the
lesson would have saved a record called `undefined`. `logic_negate` is one block, catches
`undefined`/`null`/`""`, and was **verified in the drive** — a reloaded preview, field never touched,
press Log it: the status line reads the complaint and the row count stays put.

## Readings

### The harness — `project-examples/lessons/log-a-thing`, 2026-08-20 10:23

| | |
|---|---|
| classes | **F1 pass · F2 pass · F3 pass · F4 pass** |
| `ok` / `installable` | **true / true** — AC2 |
| graded steps | 6 |
| F2 info findings | `not-checked` on steps 2 and 7 only — the two database-graded steps, which is the `b5058f3b` behaviour AC2's caveat describes |
| whole solution | `valid: true, rendered: true, drawnElementCount: 5, renderDefects: []` |
| database snapshot | `LogEntries · columns [title] · rowCount 3` |

🔴 **Run from SOURCE, not through the registered MCP server.** `packages/noodl-mcp/dist/noodl-mcp.cjs`
was built **07:26**; `b5058f3b` landed **08:58**. Probed with a known-firing control: the dist carries
the old F2′ message (`"so it will tick itself the"` — 1 hit) and **not** the new guard
(`"never as it will be when a learner opens the starter"` — 0 hits, 1 in source). So `check_lesson`
through the live server would have refused this lesson for the defect session 4 fixed. The runner
calls the same functions the tools call, off `packages/noodl-mcp/src`, under `ts-node --transpile-only
-P packages/noodl-mcp/tsconfig.json` with `NODE_PATH` at the repo's `node_modules`.

### Two controls, so the green means something

| Varied | Reading |
|---|---|
| deleted the 3 rows | **F2 FAIL**, `dead-on-solution` on step 7 |
| `prop-title` → `prop-titel` in one condition | **F2 FAIL**, `dead-on-solution` on step 5 |
| restored | back to 4/4 pass |

### The drive — real editor, `dev:debug`, 2026-08-20

| AC | Reading |
|---|---|
| **1** | Installed through the launcher's real "Install a lesson…" route. `[Learning] Checked as local-ai: F1, F2, F3 passed; F4 not checked.` Card renders in the Learning section as *Log a thing / Written locally*; **absent** from the Projects picker (control: `tut001-drive` present in the same list) |
| **2** | above |
| **3** | no F1 |
| **4** | ✅ **both arms, varying one wire.** `bad → Do` instead of `ok → Do` (the plausible error TUT-003 named): **"5 of 6 checked steps are done. Step 5 — 'Do the saving on the canvas' is the first one still to do."** Correct wiring restored: advanced to step 8 of 8, all six graded steps complete |
| **5** | ✅ **observed failing first.** Graph complete, zero records: the five structural steps go green and **"Log something" stays incomplete**. Then one entry typed into the preview → `rows now: 1` → 6 of 6 |
| **6** | ✅ **asserted.** The bundle ships **no** `cloudservices` and **no** project `id`. The lesson project got `backend_mt18kzpf2usu6` on **8586**, `reused: false, adopted: false` — distinct from the authoring solution's `backend_mt17opj2xbxsi` on 8585. The editor started it on project open |
| **7** | ⚠️ **measured, and it found something — see below** |

**And the app actually works.** Typed an entry, pressed Log it: the Visual Function ran, sent `ok`,
Create Record wrote the row, its `Done` refreshed the Query, and the row appeared in the list. The
canvas screenshot shows the Visual Function carrying `Run`/`entry` in and `title`/`ok`/`message`/`bad`
out — the ports minted from the generated workspace, on a real canvas.

## Three findings

🔴 **1. The derived starter carries the solution's project `id`, and so does every learner's copy.**
`create_project` stamps an `id`; `derive_starter` copies it; `create_lesson` copies it again. So the
bundle root, `solution/`, the authoring project and every installed copy shared
`620eff71-718e-4be7-a39b-462eafcdeb23`. `findReusableBackend` matches on backend **name plus
ownership**, and ownership is *"this project id appears in the backend's `projectIds`"* — which is
README §1B's two-apps-one-datastore defect with the ownership check intact but useless. **Fixed in the
bundle by removing `id` from both project files** (`ensureProjectId` mints one on demand — an absent
id is the supported pre-DSG-007 state). The general fix belongs at install: `LearningFolderModel.install`
should mint a fresh project id into the copy it writes. **That is a line inside a caller that already
exists, not a new mechanism — TUT-004.**

⚠️ **2. The lesson format's Markdown has no blockquote.** `renderMarkdown` handles headings, lists,
paragraphs and inline; a `> ` line renders with the `>` visible. Caught by *looking at the screenshot*
— every gate was green with it in. Both occurrences rewritten as bold.

⚠️ **3. A completed task card's title fails AA, in both themes.** Measured off computed styles with the
theme flipped by `data-theme` and read in a **second** call:

| | dark | light |
|---|---|---|
| lesson prose (popup body) | **9.64:1** ✅ | **13.33:1** ✅ |
| CHECK MY WORK button | **6.94:1** ✅ | **4.57:1** ✅ |
| `.lesson-item.completed h3` | **1.76:1** ❌ | **2.47:1** ❌ |

The content passes comfortably in both. The failure is the lesson layer's own *completed* styling
(`rgba(240,247,249,0.5)` over the card), not this bundle's. ⚠️ **Only the `completed` state was
measured** — all six cards were complete by then, so the active/incomplete state is **untested**, and
the earlier screenshots suggest it is fine. Belongs to NAT-002/003's palette work, not here.

## What was NOT verified, and should be said

- **The Data-panel route to creating the collection.** The panel would not open under CDP (clicks
  produced the tooltip and no panel), so the backend and the `LogEntries`/`title` collection were
  created by calling `provisionBackend` — the same function the panel's route ends in, but not the
  panel. What that leaves open is TUT-002's own warning: a table the **backend** creates registers in
  `_Schema` and answers `hasColumns` (proven — step 2 went green live against the real backend); a
  table created by some *other* route may not. Step 2 is `collectionExists` + `hasColumns:["title"]`,
  and if a learner's Data-panel route ever returns `columns: []`, **drop `hasColumns` and keep
  `collectionExists`** — the prose already names the column and `prop-title` cannot be wired without it.
- **`authoredBy: "ai"`** is in the manifest and is true today. It only ever tightens the gate
  (`local-ai` requires F1+F2+F3 to *pass*, which they do). Worth revisiting when Richard signs the
  copy off — at that point it is co-authored, and the field is his call.
