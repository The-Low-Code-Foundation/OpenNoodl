# Phase 84 — next session

**Phase:** 84, *the defects the field report found*. **Prefix `FLD`.** Scoped 2026-09-09.
Read [README.md](./README.md) first — §2 carries six rulings and four of them still gate tasks.

## 1. The board — re-derived from the task FILES, 2026-09-10 (end of session 3)

Seventeen files, each grepped for its own `🟢 **BUILT**` marker. **Three built, fourteen never
built.** That is the file count, not a copied status.

**Track A — it went wrong and said nothing** (outranks track B in every ordering decision)

| id | task | issue | state | depends on |
|---|---|---|---|---|
| FLD-001 | The Columns node measures itself | #21 | 🟢 **BUILT** `3c13818d` | — |
| FLD-004 | A wire into a dimension port is honoured, or refused out loud | #26 | ⬜ never built | R4 |
| FLD-005 | A column of Groups does not multiply out | #35 | ⬜ never built | 🔴 **P13 collision** |
| FLD-006 | Fit view fits | #33 | ⬜ never built | — |
| FLD-007 | A lesson step that can be completed | #5 | 🟢 **BUILT** `4068d139` | — |
| FLD-008 | An aggregation that cannot answer says so | #14 | ⬜ never built | — |
| FLD-009 | The editor does not overwrite what an agent wrote | #41 | 🟢 **BUILT** `fa227028`, driven | — |
| FLD-012 | The empty-box warning stops crying wolf | #32 | ⬜ never built | — |

**Track B — it costs too much to install and to drive**

| id | task | issue | state | depends on |
|---|---|---|---|---|
| FLD-002 | The Columns node says which breakpoint it is at | #22 | ⬜ never built | FLD-001 ✅ **now unblocked** |
| FLD-003 | Advanced Columns, as a prefab | #22 | ⬜ never built | FLD-002, FLD-004, **R3** |
| FLD-010 | An agent can ask whether a human has the project open | #41 | ⬜ never built | FLD-009 ✅ **now unblocked**, **R6** |
| FLD-011 | The render report writes to disk and stops sleeping | #40 | ⬜ never built | — |
| FLD-013 | An agent learns what will not translate before it designs | #37 | ⬜ never built | — |
| FLD-014 | The MCP surface stops costing a round trip | #43 | ⬜ never built | — |
| FLD-015 | Charts that export | #39 | ⬜ never built | **R2**, 🔴 **P9 collision** |
| FLD-016 | The Linux install works on a current distribution | #29 | ⬜ never built | — |
| FLD-017 | The release stops shipping what it never runs | #42 | ⬜ never built | R5 (minify only) |

## 2. The next task to build — FLD-008, then FLD-006 or FLD-012

Track A outranks track B, and of the five track-A tasks left, two are gated or collided:

1. **[FLD-008 — an aggregation that cannot answer says so](./FLD-008-AN-AGGREGATION-THAT-CANNOT-ANSWER-SAYS-SO.md)**
   (#14). Nothing gates it, and it is the purest track-A shape in the phase: a filter is dropped and
   the node answers anyway.
2. **[FLD-006 — fit view fits](./FLD-006-FIT-VIEW-FITS.md)** (#33), or
   **[FLD-012 — the empty-box warning stops crying wolf](./FLD-012-THE-EMPTY-BOX-WARNING-STOPS-CRYING-WOLF.md)**
   (#32). Both ungated. FLD-012's §3 already records that #32's own proposed discriminator misses
   the slider thumb — do not build the reporter's suggestion as stated.

🔴 **FLD-004 needs R4 and FLD-005 needs P13 resolved. Do not start either without the ruling.**

**FLD-010 is now unblocked** by FLD-009, and its §3 argument got stronger, not weaker: the editor
already refuses to clobber project files as well as components, so R6 ("does FLD-010 include the
advisory lock") can reasonably be answered *no*. Ask before building a locking protocol.

## 3. What session 3 learned that the next one should not re-learn

🔴 **An acceptance criterion can be green before the work, and FLD-009's AC1 was.** It asked for
"agent binds a backend, person touches a component, autosave fires". Measured against HEAD before a
line was written: **the binding survives that sequence and always would** — the project-level save
compares content built from memory and skips the file when it has not moved, and a component edit
never moves it. The loss needs an editor change to a *project-level* file. **Measure the AC's own
sequence against HEAD before you build the thing it grades**, and if it is green, the AC is wrong,
not the defect.

🔴 **Two register rows were stale, in both directions.** **N1** was right about the missing guard and
wrong about when it fires (above). **P15** — "there is no Make Home in the component context menu" —
is simply **wrong at HEAD**: it is there, it fires, and it refuses out loud with a reason. Both are
now corrected in §1/§6 of the register. That is the **sixth and seventh** time a row in this repo has
outlived its own measurement. **Re-measure before inheriting.**

✅ **The webpack module registry is how you get a reverted arm in a running editor without a rebuild.**

```js
let wr; window.webpackChunknoodl_editor.push([['probe'], {}, (r) => { wr = r; }]);
const svc = wr('./src/editor/src/services/ProjectStructure/index.ts');
const PM  = wr('./src/editor/src/models/projectmodel.ts').ProjectModel;
```

2942 modules, keyed by source path. Shadow the function the fix added, drive, restore from the saved
original. FLD-009's arms 2 and 3 are that pair on an identical payload, seconds apart.

⚠️ **`cdp click` and `getBoundingClientRect` are in different coordinate spaces once anything is
zoomed.** With `document.body.style.zoom` set, `cdp click` landed ~20 px off what `elementFromPoint`
agreed was the element. Reset the zoom, or click through the element's own handler and say in the
write-up that you did.

⚠️ **A menu that opens off the bottom of the window is the normal case at 1368×784.** The context
menu is anchored near the pointer and the window is only 784 px tall; `remote.getCurrentWindow()
.setSize()` will not grow past the 900 px display. Hit-scan with `elementFromPoint` down a column to
find what is actually reachable.

✅ **The workaround for a live editor on a project you control still works, unchanged** — copy a
project into the scratchpad, write `<scratchpad>/userdata/recently_opened_project.json`, launch with
`NOODL_USER_DATA_DIR=<scratchpad>/userdata npm run dev:debug -- --quiet`, then **click the launcher
card** (it does not auto-open). Richard's config and his 79 projects are never touched. **P14
("New project → Quick Start" hangs) is still unmeasured and still owned by NONE.**

## 4. Gates, as they stood at the end of session 3

`typecheck:editor` **exit 0** · `test:main` **446 suites / 7359 passing, exit 0** ·
`test:ci` **2962 specs, 4 failures — the named AIX-006 floor, unchanged**.

⚠️ `typecheck:editor-tests` read **2 errors in `packages/nodegx-export/src/cli/run.ts`** during this
session. **They were not ours and not HEAD's** — a third session was mid-build on phase 83's HLS-007
with six uncommitted files. A typecheck reads the **working tree**; the commit hash you print beside
it does not. Do not file that as a register row and do not "fix" those files.

## 5. 🔴 Rulings still needed — do not guess

R1 which release · R2 charts as a kit or core nodes · R3 the Advanced Columns prefab · R4 does the
units-port fix ship in a patch · R5 is minification in scope · R6 does FLD-010 include the lock
(**FLD-009 makes the answer "probably not" — confirm**). Full wording in [README.md](./README.md) §2.

## 6. The end condition has not moved

The phase closes when the fifteen issues are each **fixed and closed, or answered on the thread with
the measurement that changed our mind**. §5 of the [register](./DEFECTS-THE-FIELD-REPORT-FOUND.md)
is a table of fourteen replies owed, **all still `⬜`**.

Distance: **3 of 17 tasks built. 0 of 14 replies sent.** 🔴 Three issues are now answerable with a
measurement — **#21 (FLD-001), #5 (FLD-007, reply drafted in its §4c), #41 (FLD-009)**. A session
that sends those three costs an hour and moves the only number that closes this phase.
