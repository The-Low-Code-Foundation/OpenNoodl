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
