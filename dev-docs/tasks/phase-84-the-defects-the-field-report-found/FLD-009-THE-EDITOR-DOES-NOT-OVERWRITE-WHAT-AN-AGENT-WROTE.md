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

## 5. Traps

- 🔴 **Do not "fix" this by making the MCP server stop writing project files.** It writes them for
  good reasons; the editor is the side missing a guard.
- 🔴 **An absence assertion needs a known-firing signal beside it.** "The binding survived" passes
  just as well when the autosave never ran. Assert the autosave fired.
- ⚠️ Debounce is 1000 ms (`projectmodel.ts:1802-1807`). A drive that checks too early reads a pass
  that has not happened yet.
- ⚠️ This is data loss, so the drive is the deliverable, not the spec. A spec proves the guard; only
  the drive proves the sequence.
