# FLD-009 — The editor does not overwrite what an agent wrote

🔴 **This task is not in the issue it came from.** #41 asked for a status tool. Measuring what
actually happens when an agent writes while the editor is open found that **component files are
fully protected** — and that project-level files have none of that protection, while the MCP server
writes one of them through three methods.

## 1. The person sentence

**An agent provisions a backend while a person has the project open, and the binding is still there
afterwards.**

## 2. What was reported, and what the code says

[#41](https://github.com/The-Low-Code-Foundation/NodeGX/issues/41) assumed the worst: that an
`apply_plan` races the editor's debounced autosave and there is no way to know. **Half of that was
fixed in P82 and the reporter's AppImage predates it.**

For **component files**, measured 2026-09-09, the editor cannot clobber:

- `ProjectFileWatcher/index.ts:59` — native recursive `fs.watch`, 250 ms coalescing, wired at
  `EditorPage.tsx:239-260`. It **reloads into the canvas** (`projectmodel.ts:859-905`).
- `ProjectFileWatcher/decide.ts:88-113` — a three-hash decision
  (`baselineHash`/`inMemoryHash`/`diskHash`) → `reload` | `skip-unchanged` | `refuse-dirty`. On
  `refuse-dirty` the baseline is deliberately **not** advanced and a toast fires.
- `ProjectStructure/index.ts:265-268` — autosave calls `findExternallyChanged` (`:326-364`), which
  **re-reads each component before writing** and refuses any whose disk hash moved off the baseline.

🔴 **Project-level files have none of it.**

- `decide.ts:41-57` — `componentPathFromRelativePath` returns `null` for anything that is not
  `components/<path>/{component,nodes,connections}.json` (`parts.length < 3`, then a
  `COMPONENT_FILES` membership test). So `nodegx.project.json`, the routes file, the styles file and
  `components/_registry.json` are **not watched at all**.
- `ProjectStructure/index.ts:391-417` — `saveProjectLevelFiles` compares only against its own
  in-memory `projectLevelHashes` and calls `writeFileAtomic` unconditionally when its own hash moved.
  **There is no `findExternallyChanged` equivalent on this path.**
- `noodl-mcp/src/project/ProjectStore.ts:164`, `:190`, `:234` — the MCP server writes
  `nodegx.project.json` through `writeDesignTokens`, `writeProjectSettings` and `writeCloudServices`.

So an agent that provisions a backend or writes design tokens while the editor holds the project has
that write **silently reverted by the next autosave**, with nothing reported to either side.

⚠️ **A correction to an earlier reading of this, recorded so it is not repeated:** page registration
does **not** trigger it. `pageRegistration.ts:263` writes the **router component's** files via
`store.writeComponent`, which is watched and guarded. The exposure is the three project-file writers
above, not the router.

⚠️ **Read from source; not yet driven.** Both halves are verified in code. The drive is AC1.

## 3. Scope

- Extend the watcher's path mapping to report project-level file changes, and give
  `saveProjectLevelFiles` the same re-read-and-refuse guard `findExternallyChanged` gives components.
- Decide what the editor does on an external project-file change: reload, or refuse and toast. The
  component path has a three-way decision already; copy its shape rather than inventing a second one.
- `components/_registry.json` is written by the MCP store too (`ProjectStore.ts:559`) and is excluded
  by the same `parts.length < 3` test. Cover it or say why not.
- ⚠️ `relay-token` is **written but never unlinked on quit**, so its presence proves nothing about a
  live editor. Do not build liveness on it. (Recorded here because it is the obvious wrong turn.)

## 4. Acceptance criteria

1. **(person, and this is a drive)** Open a project in the editor. From an MCP client, write a cloud
   service binding. Touch a component in the editor so autosave fires. **The binding is still on
   disk.** 🔴 Run this arm **against HEAD first and watch it fail** — a green that was never red
   grades nothing here.
2. A spec asserts `saveProjectLevelFiles` refuses to write a project-level file whose disk hash has
   moved off the baseline, and reports the refusal. Reverted arm: remove the guard and the write
   lands over the external change.
3. The watcher reports a project-level change at all — asserted directly, because today it returns
   `null` and every downstream assertion would pass vacuously on a watcher that sees nothing.
4. A **presence control**: an editor-originated change to the same file still saves normally. A
   guard that refuses everything looks identical to a guard that works.
5. The component path is asserted unchanged — its three-hash decision and its refusal toast still
   behave as they do at HEAD. This task must not weaken the half that already works.

## 4b. What was built — 2026-09-10, session 3

🔴 **The first thing measured contradicts AC1, and it would have graded green before the work.**

Before writing a line, the sequence AC1 asks for was run against HEAD on a `MemFs` double: load the
project, have an agent write `metadata.cloudservices` into `nodegx.project.json` exactly as
`ProjectStore.writeCloudServices` does, then edit a **component** and save.

| arm | what the editor changed | binding on disk after the save |
|---|---|---|
| A — **AC1 as written** | one component (`Pages/Home`) | 🟢 **still there** |
| B | `rootNodeId` (the app root moves) | 🔴 **gone, silently** |
| C — tokens instead of a binding | `rootNodeId` | 🔴 **gone, silently** |

Arm A does not lose the binding **and never could**, because `saveProjectLevelFiles` compares the
project-level content *built from memory* against its own baseline and `continue`s when they match —
a component edit does not move that hash, so the file is not opened, let alone written. **The
trigger is not autosave. It is any editor change to a project-level file while an agent's change to
the same file is unread.** N1 said "writes unconditionally", and that is true only *once its own
copy has moved*; the register row is right about the missing guard and wrong about when it fires.

Both halves are now pinned by specs, so the distinction cannot be lost again — the arm-A case is the
first spec in `projectLevelGuard.test.ts` and it asserts the file is untouched **byte for byte**,
with the save's own `changed: ['Pages/Home']` beside it as the known-firing signal.

### What the fix is

- **`ProjectStructure/projectLevel.ts`** (new) — the pure half: `hashProjectLevel`,
  `decideProjectLevelReload`, and `applyProjectLevelSlice`, which copies **only the fields one
  project-level file owns**. That last one is the reverse of `ProjectExporter`'s split and has to
  stay that way: adopting a whole reconstructed project would overwrite an unsaved colour edit with
  the disk copy the moment an agent wrote an unrelated backend binding — this task's data loss
  wearing the other face.
- **`ProjectStructureService`** — a **second** baseline map, `projectLevelDiskHashes`, and a
  `projectLevelFileMovedOnDisk` check before every project-level write, mirroring
  `findExternallyChanged` including both of its escapes. ⚠️ **Two maps, not one, and that is the
  whole of AC4.** `projectLevelHashes` holds the hash of the *export of the in-memory project*;
  the disk map holds the hash of *the bytes we last read or wrote*. They are different quantities —
  a project loaded and exported straight back is not guaranteed identical — so comparing disk
  against the built baseline would read "someone else wrote this" on the first save of an untouched
  project, and a guard that refuses everything is indistinguishable from a guard that works.
- **`ProjectFileWatcher/decide.ts`** — `projectLevelFileFromRelativePath`. This is the hole: at HEAD
  the watcher asked `componentPathFromRelativePath` about every event, which answers `null` for
  every path outside `components/<path>/`, so an agent's project-file write reached the editor
  through **no channel at all**.
- **`ProjectModel.reloadProjectLevelFromDisk`** — 🔴 **the half that makes the guard usable rather
  than merely correct.** Without it the refusal is permanent: the editor's copy never learns what
  the agent wrote, so every save finds the file moved and declines again, and the person's own
  change never lands. Adopting the disk copy closes the loop. Decision per **file**, with the same
  three-way shape and the same "do not advance the baseline on a refusal" rule as the component path.
- **`EditorPage`** — two toasts, matching the two the component path already has: one when a save is
  refused, one when the write lands and the person has unsaved project changes.

`components/_registry.json` is **covered by being excluded, with a reason** (§3's third bullet, and
P11): `ComponentSaver.updateRegistry` re-reads the registry off disk and merges its change set into
it, so an entry an agent added is not lost by the editor's next save. It is the one project-level
file that was never exposed. A component an agent *adds* still reaches the canvas by its own three
files, which the component mapping already reports.

### The reverted arms

- **AC2** — `projectLevelFileMovedOnDisk` stubbed to `false` (the one check taken back out), same
  save: `refusedProjectFiles` is `undefined` and the binding is **gone from disk**. The spec asserts
  the loss, not just the absence of a refusal.
- **AC3** — no stub needed: the function did not exist at HEAD, and
  `componentPathFromRelativePath('nodegx.project.json')` returning `null` is asserted in the same
  file, so the "before" is on the record beside the "after".

### The presence controls — AC4

Four, because "the binding survived" passes just as well on a guard that refuses everything and on a
save that never ran:

1. an editor-originated `rootNodeId` change with nothing external in play **saves normally**;
2. two such changes back to back both land;
3. after the external write is **adopted**, the editor's change saves *and* the binding survives —
   the refusal is a pause, not a wall;
4. the watcher's project-level callback is **not** called for a component-only batch.

### Gates

`typecheck:editor` **exit 0**. `test:main` **446 suites / 7359 passing, exit 0** (7350 before; the
nine new ones are the watcher specs, including a real-`fs.watch` arm proving node reports a
root-level file as a bare filename — the assumption the whole mapping rests on).

## 5. Traps

- 🔴 **Do not "fix" this by making the MCP server stop writing project files.** It writes them for
  good reasons; the editor is the side missing a guard.
- 🔴 **An absence assertion needs a known-firing signal beside it.** "The binding survived" passes
  just as well when the autosave never ran. Assert the autosave fired.
- ⚠️ Debounce is 1000 ms (`projectmodel.ts:1802-1807`). A drive that checks too early reads a pass
  that has not happened yet.
- ⚠️ This is data loss, so the drive is the deliverable, not the spec. A spec proves the guard; only
  the drive proves the sequence.
