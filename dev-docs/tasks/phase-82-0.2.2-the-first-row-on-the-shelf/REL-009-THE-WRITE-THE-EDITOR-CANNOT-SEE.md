# REL-009 — The write the editor cannot see

**Opened 2026-09-01** at Richard's request: *"Can we roll the tasks needed to fix this into 0.2.2
phase please?"* — after asking whether the bug where an agent authoring through MCP does not show up
in an open editor had been fixed. It has not. Nothing has ever been built for it.

> 🔴 **SCOPE NOTE — this rides 0.2.2, it does not gate it.** The §4 close condition in the
> [README](README.md) names four things, and this is none of them. It is carried here on the
> [REL-008](TASKS.md) precedent — *"I think it can ride 0.2.2"* — so that a launch session may build
> it without opening another phase, **and so that a launch session may drop it without debate if the
> cut is ready first.** If Richard wants it gating instead, that is a one-line change to the board
> row and this note; nobody should infer it.

---

## §1 What is actually true at HEAD, measured

Four readings, all taken 2026-09-01 against the working tree, none relayed from a task file.

### §1.1 There is no filesystem watcher in the editor. At all.

`grep -aI` for `chokidar`, `fs.watch(`, `watchFile` and `watch(` across
`packages/noodl-editor/src` and `packages/noodl-platform*/src`, excluding the built
`index.bundle.js` files, returns **nine hits and every one of them is a DOM helper**
(`function watch(node)`) inside the three pre-built viewer bundles under
`packages/noodl-editor/src/external/`. Nothing filesystem, in either process.

The only real watcher in the repository is
[`packages/noodl-preview/src/watcher.ts`](../../../packages/noodl-preview/src/watcher.ts), and it
belongs to the standalone harness — SUB-009 put *"driving the running editor's preview from disk"*
**explicitly out of scope**
([SUB-009 §Scope](../phase-13-format-ai-substrate/SUB-009-LIVE-PREVIEW-HARNESS.md)). `chokidar` is a
dependency of `noodl-preview` **only**; the editor package does not have it.

### §1.2 The fix's seam was built fourteen months ago and has never been called

[`ProjectModel.reloadComponentFromDisk()`](../../../packages/noodl-editor/src/editor/src/models/projectmodel.ts#L786)
exists, is complete, and its own docstring says what it is for:

> *"This is the surgical-reload seam for file-watch and future live-collab: when a component's files
> change underneath us (a peer's edit synced in), call this to refresh just that component."*

It suspends `saveOnModelChange` across the swap so the reload cannot schedule a save-back, removes
the old `ComponentModel`, adds the rebuilt one, and fires `componentReloadedFromDisk`. It is v2-only
and returns `false` otherwise.

**Callers in the editor source: zero.** `grep` over the non-bundle editor tree returns exactly one
hit — the definition. It arrived with `ac1908bc` *feat(SUB-001): wire v2 decomposed format into
editor save/load*, 2026-07-23, and has been dead code for every day since.

Its partner is already wired underneath it:
[`ProjectStructure.reloadComponent()`](../../../packages/noodl-editor/src/editor/src/services/ProjectStructure/index.ts#L149)
invalidates the loader cache, re-reads the component, **and calls
[`ComponentSaver.noteExternalWrite()`](../../../packages/noodl-editor/src/editor/src/services/ProjectStructure/ComponentSaver.ts#L155)**
so the save baseline advances to the external content and the next autosave neither clobbers nor
echoes it.

**So the missing piece is genuinely just the watcher and the path→component mapping.** This is not a
"build a live-collab layer" task. Everything below the seam is done.

### §1.3 🔴 The clobber-on-quit claim we have been relaying for months is WRONG for v2 projects

Five phase-55 handoff files carry this, and it is repeated as standing guidance
([HANDOVER.md:77](../phase-55-llm-authoring-support/HANDOVER.md#L77)):

> *"An MCP write reaches disk and is invisible to a running editor, and quitting the editor can
> flush its stale copy back over your work."*

The first half is true. **The second half does not survive a reading of the saver.**

`ProjectStructure.saveProject()` is **incremental and hash-baselined**, not a full write. The chain:

| step | what it does | consequence for an MCP write |
|---|---|---|
| `seedFromProject()` at load | stores `hashComponent()` per component path as the **disk baseline** | baseline = what the editor loaded |
| `getChangedComponents()` at save | writes only components whose **in-memory hash differs from the baseline** | a component the human never touched is **not in the change set, so it is not written** |
| `changeSet.removed` | baseline paths absent from the in-memory project | an MCP-**added** component was never in the baseline either, so it is **not** proposed for deletion |
| `updateRegistry()` | **reads `registry.json` from disk** and merges the change set into it | an MCP-added component's registry entry **survives** a subsequent editor save |
| `saveComponent()` | two-phase temp-write + atomic rename, per component | cannot half-write a component |

So on a v2 project the failure mode is **not** a blanket flush. It is narrower and it is real:

- 🔴 **A component the human also edits is silently last-writer-wins.** The editor's copy is dirty
  against a baseline that no longer describes the disk, so it writes, and the MCP's version of that
  component is gone with no conflict, no prompt and no diagnostic.
- 🔴 **The legacy path is a genuine full clobber.** When `_projectFormat !== 'v2'`,
  [`toDirectory()`](../../../packages/noodl-editor/src/editor/src/models/projectmodel.ts#L697) falls
  through to writing the whole monolithic `project.json` from memory. Whether MCP ever authors into a
  legacy project is **unmeasured** — see §4 U1.
- ⚠️ Project-level files (`project.json`/`routes.json`/`styles.json` in v2) go through
  `projectLevelHashes` on the same principle, but that path was **read, not driven** — see §4 U2.

**This correction is the reason REL-009a exists as its own row and comes first.** The anti-clobber
machinery we would have built from the relayed claim — conflict detection on every component, a
merge UI — is mostly unnecessary. What is necessary is much smaller, and we would not have known
that without reading the saver.

### §1.4 `IFileSystem` has no watch API, and this is the same trap AIX-009 hit

[`IFileSystem`](../../../packages/noodl-platform/src/filesystem/common.ts#L20) has 25-odd members and
**no watch of any kind**; `file(path)` returns a `FileStat`. AIX-009 met this exactly and chose a 2s
content poll over extending the interface, on the grounds that *"extending the cross-platform
interface would have been bigger than the feature"*
([AIX-009-NOTES.md:50](../phase-15-ai-collaboration/AIX-009-NOTES.md#L50)).

**Do not extend `IFileSystem` for this.** `reloadComponentFromDisk` is already gated on
`_retainedProjectDirectory`, which only exists on Electron, so the watcher may use node `fs.watch` or
`chokidar` directly on the editor side without touching the platform abstraction. That is a decision,
recorded, not a preference to re-litigate — see §3 D1 for the one open sub-question.

---

## §2 REL-009a — Does a quit eat the agent's work? Measure, then fix only what fired

🔴 **This row is a measurement first and a build second, and it may correctly build nothing.**
§1.3 says most of the danger we have been warning about is not there. Do not build to the warning.

**ACs**

1. **The clobber matrix is driven, not reasoned**, on a real v2 project copy with a real MCP server
   over stdio, four arms, each arm ending in a genuine editor quit (the `before-quit` flush path,
   not a kill):

   | arm | human does | MCP does | expected at rest |
   |---|---|---|---|
   | A | nothing | edits component X | X on disk is the MCP's |
   | B | edits component Y | edits component X | X is the MCP's, Y is the human's |
   | C | edits component X | edits component X | **the finding** — record what actually happens |
   | D | nothing | **adds** component Z | Z survives, and `registry.json` lists it |

   Arms A, B and D are **presence controls**: if any of them loses the write, §1.3's reading of the
   saver is wrong and this whole task re-scopes. Read them *before* believing arm C.
2. **Arm C's real behaviour is written down as a mechanism**, naming the line that does it — not
   *"it clobbers"*. If it is silent last-writer-wins as §1.3 predicts, that is the defect.
3. **The legacy-format question in §4 U1 is answered** — either MCP cannot author into a legacy
   project (in which case the full-write path is not reachable this way, and that is recorded as the
   reason no work is owed), or it can, and the full clobber is a real product defect with an owner.
4. **Only what arms A–D actually caught is built.** The candidate fix for arm C is small and local:
   `getChangedComponents` already has the baseline hash, so the saver can detect that **the disk no
   longer matches the baseline** for a component it is about to write, and refuse-and-report rather
   than overwrite. Anything larger than that needs a reading that demands it.
5. 🔴 **The five phase-55 handoff files are corrected**, or the claim is corrected once in a place
   they can be pointed at. A wrong warning that has been relayed five times will be relayed a sixth.

## §2.1 ✅ THE MATRIX WAS DRIVEN — 2026-09-03. §1.3's reading holds, and arm C is real

**Fixture**: `NodeGX test projects/REL-009a Clobber Drive`, a **copy** of `Deadline Desk` (v2, 2
components), never the original. **Agent side**: the real `nodegx` MCP server over stdio, bound with
`open_project`. **Human side**: the editor launched with `npm run dev:debug -- --quiet
--inspect-main`, the project opened through the product's own door
(`LocalProjectsModel.openProjectFromFolder` then a real `cdp click` on its launcher card), edits made
by **clicking the node on the canvas and typing into the property panel**, committed by blur or
Enter. **The quit is a real `app.quit()` evaluated in the MAIN process over the node inspector on
9229**, so `before-quit`'s `preventDefault` → flush handshake → `stopAll` → `app.quit()` all run.
Three editor sessions, one per arm group. Every reading is `md5 + mtime` of all 21 files before and
after each step.

| arm | human | MCP | expected | **measured** |
|---|---|---|---|---|
| **A** | nothing | edits X (`Pages/Home`) | X is the MCP's | 🟢 **PASS** — the quit wrote **nothing at all**, 21/21 files byte-identical |
| **B** | edits Y (`Pages/Second`) | edits X | X MCP's, Y human's | 🟢 **PASS** — autosave wrote **only** `Second/{component,nodes}.json` + `_registry.json`; X untouched |
| **C** | edits X | edits X | *the finding* | 🔴 **SILENT LAST-WRITER-WINS — confirmed twice** |
| **D** | nothing | **adds** Z (`Pages/Third`) | Z survives, registry lists it | 🟢 **PASS** — Z intact, `_registry.json` lists 4 components |

🔴 **The presence controls were read first, and they passed**, so §1.3's reading of the saver stands
and the anti-clobber machinery the relayed warning implied is **not** owed.

### The quit path is armed — the control that makes arm A/D's silence mean something

Arm A's headline is an **absence** (the quit wrote nothing), and an absence is worthless without a
known-firing signal beside it. Session 2 supplied one: a human edit followed by `app.quit()` **inside
the 1 s save debounce**, which put the log line

```
[renderer:info] (projectmodel.ts:1537) Pending project save flushed to disk Thu Sep 03 2026 07:22:24
```

on the record and wrote `Second/{component,nodes}.json` + `_registry.json` — **and nothing else**. So
the handshake runs, it does write, and session 1's silence is a real no-op rather than a handler that
never fired.

### 🔴 Arm C, driven with a disk read between the two writes

The first run of arm C was suggestive; the second is airtight, because the file was read **after**
MCP wrote and **before** the human touched anything:

| step | `Pages/Home/nodes.json` on disk |
|---|---|
| MCP sets `sameMsText` | `sameMsText = 'MCP-C2-WROTE-THIS'` — md5 `6a56894c…` |
| human edits **`tokyoFmt`**, a *different node in the same component* | `sameMsText = 'Both stamps are the same instant.'` — md5 `25283230…` |

**The MCP's write is gone. No conflict, no prompt, no diagnostic, no log line.** And the value it
reverted to is not the newer of the two — it is the value the editor read **at load**, which was
already stale.

**The mechanism, named.**
[`ComponentSaver.getChangedComponents`](../../../packages/noodl-editor/src/editor/src/services/ProjectStructure/ComponentSaver.ts#L180)
asks `this.diskHashes.get(path) !== hash`. `diskHashes` is a **memory of what this editor last read
or wrote**, and the code reads it as *a statement about the file*. The human's edit puts `Pages/Home`
in `changeSet.changed`;
[`saveComponent`](../../../packages/noodl-editor/src/editor/src/services/ProjectStructure/ComponentSaver.ts#L209)
then stages and renames all three files from memory. **Nothing on that path ever reads the file it is
about to replace.** The unit of the write is the whole component, so a one-node edit by the human
overwrites every other node an agent touched.

### 🔴 Arm C2 — the same collision on the ROUTER, where the loss is a page, not a string

Arm C loses a string. The realistic version loses a page, and it was driven in the same session:

1. MCP `create_component('Pages/Fourth')` — which, as its response says, also **registers the page in
   the `Main` router inside `/App`**. Disk: `routes: [Home, Second, Third, Fourth]`.
2. The editor's in-memory `/App` still reads `routes: [Home, Second, Third]` — it cannot see the write.
3. The human renames the router in the property panel. `/App` is now dirty, so it is written.

**Result on disk:** `routes: ['/Pages/Home', '/Pages/Second', '/Pages/Third']`.

| where `Pages/Fourth` still is | where it is not |
|---|---|
| its three files, intact (`MCP-C2-PAGE` present) | the router |
| `_registry.json`, listed | — |
| the editor's components panel | the running app |

🔴 **So the page exists, is listed, is visible in the panel, and can never be reached.** That is a
worse failure than a lost string because **nothing in the product looks wrong**: every surface that
enumerates components still shows it.

### Two behaviours nobody had written down

1. 🔴 **Opening the project WRITES.** The first open rewrote `Pages/Home`, `Pages/Second`,
   `_registry.json` and `nodegx.project.json` — content, not just timestamps: the `Page` node gained a
   `dynamicports` block, and child nodes lost their `x`/`y` (`normalizeComponentForV2`, documented and
   intentional). Session 2's open rewrote **only `Pages/Third`**, the one component the editor had
   never normalised, and session 3's open rewrote **only `nodegx.project.json`**'s `modified` stamp.
   ✅ **The open rewrites exactly the components whose on-disk form differs from the editor's canonical
   export, and it is idempotent.** MCP-authored content is normalised, not damaged — every marker
   survived every open.
2. ⚠️ `nodegx.project.json`'s `modified` is rewritten on any save even when nothing about the project
   changed, because `saveProjectLevelFiles` builds with a live timestamp and the hash that gates it
   excludes `modified`. Diff noise, not a defect. **Register, do not chase.**

### AC3 / U1 — answered by driving, with a control

| command | result |
|---|---|
| the real `noodl-mcp.cjs` against **legacy** `fix012-drive` | **EXIT=2**, *"holds a legacy monolithic project.json. Migrate it to the v2 format … before using the MCP server."* |
| the same binary against the **v2** drive project | **EXIT=0**, *"serving … (read-write) on stdio"* |

🔴 **MCP cannot author into a legacy project at all**, so `projectmodel.toDirectory()`'s monolithic
full-write is **not reachable this way** and no work is owed for it in this row. ⚠️ The first reading
of this was taken through `| head`, which reported `EXIT=0` — **the exit status of `head`**. The pair
above was re-run without a pipe.

### AC4 — what is owed, and what is not — ✅ BUILT

Only arm C fired, so only arm C's fix is in scope, and it is the one §2 already named. ⚠️ Arm C2 is
the same defect, not a second one — `/App` is just another component — so one fix covers both, and
REL-009b AC4 must answer it the same way.

**What was built.**
[`ProjectStructureService.findExternallyChanged`](../../../packages/noodl-editor/src/editor/src/services/ProjectStructure/index.ts)
re-reads **only the components already in the change set** — usually one, so three extra file reads
per save, not a pass over the project — and compares the freshly loaded content against
`saver.getDiskHash(path)`, the same quantity `getChangedComponents` compares against. A mismatch means
somebody else wrote the file, so that component is dropped from the write, its baseline is left
untouched (**the next save retries**), and it comes back in `SaveResult.refused`.
[`projectmodel.toDirectory`](../../../packages/noodl-editor/src/editor/src/models/projectmodel.ts)
emits `ProjectModel.saveRefusedExternalChange`, and
[`EditorPage`](../../../packages/noodl-editor/src/editor/src/pages/EditorPage/EditorPage.tsx) shows it
as an error toast beside the existing `saveFailedRetryScheduled` one.

🔴 **Reporting is not decoration here.** A refusal the user is not told about is the same silent data
loss wearing a nicer name: their edit is still only in memory. The toast names the component and says
their version is still open.

⚠️ **Three decisions worth not re-litigating.**
- **A component with no baseline is written, not refused.** No baseline means the saver has never seen
  that path on disk — a component created in this editor since the load. Refusing it would lose the
  user's work to protect nothing.
- **An unreadable component is written, not refused.** Same reasoning; a read failure is not evidence
  of a competing writer.
- **The probe invalidates the loader cache on the way out.** The read is a probe, and a save that then
  proceeds is about to make anything it cached wrong.

### 🔴 The guard's own regression, and the spec that caught it

The first `test:ci` after the guard landed came back **2933 specs, 5 failures**: the four AIX-006
floor failures **by name**, and **one of mine** — the *pre-existing* spec
*"rolls back baselines on a mid-save failure so a retry redoes everything"*.

It was right. `saveProject` deliberately **rewinds baselines** when a save dies part-way, so the retry
redoes the write. But the component files had already landed, so on that retry the disk **legitimately
disagrees with the baseline** — and the first draft of the guard read our own write as somebody else's,
refused it, and stranded the retry forever with a permanently stale registry.

✅ **Fixed with a second clause**: if the content on disk is already exactly what this save would
write, there is nothing to lose, so proceed. A spec of its own now grades that clause directly, so it
cannot be quietly dropped. **Second run: 2934 specs, 4 failures — all four AIX-006, by name.**

⚠️ **The lesson is the one this row keeps meeting from the other side.** A new check does not have to
be wrong to be dangerous; it has to be unable to tell two situations apart. This one could not
distinguish *"an agent wrote this"* from *"we wrote this and then rewound our own bookkeeping"*, and
only an **old** spec knew the difference.

### ✅ Verified in the real product, not just the fixture — 2026-09-03

A guard that refuses everything would pass every positive spec above and destroy the editor, so it
was driven in the running app with a **negative control first**:

| | measured |
|---|---|
| **CONTROL — an ordinary save, no other writer** | the edit **landed on disk**; **0** `Project save skipped` lines. The guard is silent when nothing moved |
| **arm C, re-run with the fix** | MCP wrote `sameMsText = 'MCP-AFTER-FIX-WROTE-THIS'`; the human then edited `tokyoFmt` in the same component; **MCP's write survived**, the human's edit did **not** reach disk, and it still reads `MCP-AFTER-FIX-WROTE-THIS` after a real quit |
| **the report reached a person** | console: `Project save skipped 1 component(s) changed on disk by something else: Pages/Home`, and the toast, read out of the live DOM: *"Not saved: Pages/Home changed on disk outside the editor. Your changes to it are still open here — reopen the project to see the other version."* |

⚠️ **Read from the DOM, not photographed** — the toast's 10 s window had closed by the time the
screenshot was taken. The console line and the DOM text are the evidence.

🔴 **The honest cost of this fix, stated plainly.** Once a component is refused, **every later save of
it is refused too**, until the project is reopened — the editor has no way to take the other version.
That is better than silent loss and it is not good enough. **[REL-009b](#3-rel-009b--the-editor-sees-the-write)
is what removes it**: with a watcher, `reloadComponentFromDisk` advances the baseline as the write
lands, so the disagreement never forms. Do not close REL-009b believing this row already solved it.

**Grading.** Five specs in
[`ProjectStructureService.test.ts`](../../../packages/noodl-editor/tests/services/ProjectStructure/ProjectStructureService.test.ts),
including **two negative controls** — an ordinary save must report `refused: undefined`, and a
brand-new component with no file must still be written. Without those the guard could refuse
everything and every positive spec would still pass. `typecheck:editor` **exit 0**; `typecheck:editor-tests` **exit 0** before a peer's live `nodegx-export`
edit put four `TS2367`s in `plan.ts` at 07:44:45 — **none in any file this row touches**.

---

## §3 REL-009b — The editor sees the write

**ACs**

1. A watcher on the open project's directory calls `reloadComponentFromDisk(componentPath)` for each
   changed component, debounced, ignoring `.git`, `*.tmp`, backup and build paths. 🔴 **The
   editor's own two-phase save writes `<file>.tmp` then renames** — a watcher that does not ignore
   `.tmp` and does not suppress its **own** writes will feed the editor its own saves in a loop.
   That is the first thing to get right, and the first thing to test.
2. **The canvas shows it.** Open `Pages/Home` in the editor, have MCP add a node, and the node
   appears without reopening the project. The swap goes through `removeComponent`/`addComponent`, so
   the AC is not *"the model updated"* — it is **a screenshot of the canvas with the node on it**.
   🔴 `componentReloadedFromDisk` fires but **nothing subscribes to it yet**; whether the canvas
   view and the open-component tab survive a model swap underneath them is §4 U3, and it is the
   likeliest place for this task to get expensive.
3. **The preview shows it.** The viewer is driven by `ViewerConnection` streaming diffs from the
   in-memory `ProjectModel`, so a correct model swap should propagate for free — **verify that it
   does**, and if it does not, name the seam. Do not assert it from the architecture.
4. **A component with unsaved editor edits is not silently discarded.** If the human has X dirty and
   MCP writes X, the reload must not throw the human's work away without saying so. The minimum
   honest behaviour is: do not reload that component, and tell someone. This is arm C from
   REL-009a wearing its other face, and the two rows must not answer it differently.
5. **The dead seam stops being dead**: after this, `reloadComponentFromDisk` has a caller, and a
   spec that mutation-fails if the wiring is removed.

**The drive**: a real MCP server over stdio against a **copy** of a real project — never a project
anyone is using — editor launched via the `run-editor` skill, canvas
screenshotted before and after the MCP write. Source-text assertions do not grade this — the whole
defect is that the model and the disk disagree, and only a render can see that.

---

## §4 Registered, unmeasured — do not build on these without reading them first

| id | the question | why it is not answered here |
|---|---|---|
| ~~**U1**~~ | ~~Can MCP author into a **legacy** (non-v2) project at all?~~ | ✅ **ANSWERED 2026-09-03 BY DRIVING, with a control** — no. The real `noodl-mcp.cjs` refuses a legacy directory at spawn (**EXIT=2**, naming the migration path) and serves the v2 one (**EXIT=0**). See §2.1. So `toDirectory()`'s monolithic full-write is **not reachable this way** and no work is owed for it here. |
| **U2** | Do the v2 **project-level** files (`routes.json`, `styles.json`) clobber? | 🟡 **PARTLY ANSWERED, and the question was pointed at the wrong file.** In the drive project **MCP registering a page did not write `routes.json` at all** — that project has none, and the `Router` lives in the `/App` **component**, so page registration is a component write. That path *was* driven, as **arm C2 in §2.1**, and it clobbers: the added page is dropped from the router. ⚠️ `saveProjectLevelFiles` is hash-baselined on `projectLevelHashes` exactly as the component path is, so the same defect shape should apply to a real `routes.json`, but **that was read, not driven** — say which you have before quoting it. A project that does carry `routes.json` is the fixture that would settle it. |
| **U3** | Does the canvas survive `removeComponent`/`addComponent` on the component it is currently showing? | Never done at runtime — the seam has no callers. If the canvas holds a stale `ComponentModel` reference this becomes the real work of REL-009b. |
| **U4** | `fs.watch` recursive vs `chokidar` in the editor package | See D1. |

**D1 — the watcher implementation.** `chokidar` is not an editor dependency; adding one to
`noodl-editor` is a supply-chain and build-size decision, and node's `fs.watch` with
`{recursive: true}` covers macOS and Windows natively. **Not ruled.** Whoever builds REL-009b picks
one and records why; do not add a dependency silently.

---

## §5 Why this is worth a row at all

The MCP server is how an agent builds a NodeGX app, and the editor is how a person watches. Today
those two things cannot be pointed at the same project at the same time, and our own guidance is to
**close the editor before letting the agent work** — which is to say, the product's headline
capability and its main surface are mutually exclusive. That is a strange thing to ship on a shelf
whose first row is *"an app an agent can build with you."*

It is still not a launch blocker, and this file says so at the top.
