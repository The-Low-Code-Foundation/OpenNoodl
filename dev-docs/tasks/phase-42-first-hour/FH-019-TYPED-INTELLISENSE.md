# FH-019 — Autocomplete that knows your project

**Created:** 2026-08-05, out of [TALK-002](TALK-002-THE-CODE-EDITOR-IS-NOT-DIY.md) decision 3.
**Status:** specified, not started. **Depends on:** [FH-017](FH-017-CODE-EDITOR-FIXES.md) (same files).

Richard's item 18 was reported as "autocomplete is broken". FH-017 fixes the broken part — a guard
that made `Noodl.` unreachable. This task is the part underneath: **completion today comes from a
hardcoded list, not from knowledge of anything.** It is the reason Monaco was originally wanted,
and the last real argument for a switch. Closing it closes that argument for good.

## What "it doesn't know your project" means, concretely

`noodl-completions.ts:21-54` is a **25-string literal array**. Everything it can ever offer is
typed into that file. Consequences, all of them live today:

- Your component's actual inputs are unknown. `Inputs.` offers nothing — `Inputs` is one entry in
  the list, with no properties. The same for `Outputs.`, `Props.`, `State.`.
- `Noodl.Variables.` offers nothing. Nor does any variable name in the project.
- A registered library's global is unknown. `library-completions.ts` was built for exactly this
  (ERG-002 §2 finding #4) and its own header says **"NOT WIRED IN"** — because wiring it needs the
  open project threaded into `noodl-core-ui`, which no one has built. It has sat unreachable since.
- Nothing is ever wrong. There is no type information anywhere in the editing path, so
  `Inputs.custmerName` is as valid as `Inputs.customerName` until the app runs.

The 25 strings are also stale by construction: they are a snapshot of the `Noodl` API as of the
day the file was written, maintained by nobody.

## The seam that has to exist first

There is no way to pass project knowledge into the editor. Trace it:

- `CodeEditorType.onLaunchClicked` ([CodeEditorType.ts:143-223](../../../packages/noodl-editor/src/editor/src/views/panels/propertyeditor/CodeEditor/CodeEditorType.ts#L143-L223))
  **has** the context — `this.parent.model` is the node model, `nodeId` at `:145`, and through it
  the component, its ports and the `ProjectModel`.
- It passes `JavaScriptEditor` eight props (`:207-222`): value, handlers, `validationType`, size,
  `historyProvider`. **No project context.**
- `createExtensions` (`codemirror-extensions.ts:209`) takes `ExtensionOptions` and registers
  completions from the module-level import. Nothing per-instance.

So slice 1 is plumbing, and both the `.d.ts` work and the never-wired library completions land on
it. The other two call sites (`AiChat.tsx`, `GeneratedCodeModal.tsx`, `ExpressionEditorModal.tsx`)
must get the same context or they regress to the hardcoded list.

## Slices

### Slice 1 — a context prop, and the library twin retired

Add an optional `authoringContext` prop to `JavaScriptEditor` → `createExtensions` → a
`Compartment` so it can be reconfigured without remounting. Populate it at all four call sites from
the node model. First consumer: `createLibraryCompletionSource` — the function that has been built
and unreachable since ERG-002. Wiring it here is what FH-017 slice 1 deliberately left alone;
delete the "NOT WIRED IN" header when it goes.

Criterion: a project with a registered library completes its global; a project without one is
unchanged.

### Slice 2 — completions from the live objects

`scopeCompletionSource(globalThis)` from `@codemirror/lang-javascript` completes from a **real
object** rather than a list. For `Noodl` specifically that is strictly better than the 25 strings
and costs nothing — the API is on the object.

For `Inputs`/`Outputs`/`Props`/`State` there is no live object at authoring time; those come from
the component's declared ports via slice 1's context. Build a completion source over them
(label + the port's type + its tooltip as `info` — the property panel already has all three).

Criterion: `Inputs.` lists this component's actual inputs, with types. Renaming a port changes what
completes. **Delete `noodlCompletions[]`** — the 25-string array does not survive this slice.

### Slice 3 — `.d.ts` and real diagnostics

`packages/noodl-runtime/dist-types/noodl-runtime.d.ts` already exists (PLAT-003 emits it; the
`copy-handwritten-types.js` step is what makes it non-dangling). Assemble it with a generated
project surface — `Inputs`/`Outputs` from the component's ports, variable names, the database
schema, cloud-function signatures — into the ambient text a language service needs.
`utils/CodeEditor/typescript/viewer/index.ts`'s `GetSource()` did exactly this assembly by hand;
it was deleted in DEBT-013 and is worth recovering from git history **for its shape only** — it
reflected over `ProjectModel` ad hoc, and the point of PLAT-003 is that it no longer has to.

Then the real decision, which
[TYPED-INTELLISENSE-REVIVAL.md](../../future-projects/TYPED-INTELLISENSE-REVIVAL.md) frames and
does not settle:

| | Option (a) TypeScript LS in a worker | Option (b) parse the `.d.ts` into completions |
|---|---|---|
| Gives | Real type checking, hover types, go-to-definition | Names and shapes, no checking |
| Costs | A worker + `typescript` in the bundle — **and web-worker loading in this Electron+CommonJS build is the unfixed reason Monaco was removed** | Small; sits beside slice 2's sources |
| Verdict | Prove the worker loads *before* designing anything on it | The safe default if it doesn't |

**Do the spike first.** A throwaway worker that loads `typescript` in the packaged Electron build,
run before any design work, is what decides (a) vs (b). If it fails, that is the same wall Monaco
hit, and (b) ships instead — with `eslint-linter-browserify` (arriving in FH-017 slice 3) already
covering the "is this code wrong" half at the syntax level.

## Criteria

1. `Inputs.` completes this component's real inputs; renaming a port changes the list.
2. `Noodl.Variables.` completes real variable names from the project.
3. A registered library's global completes; `library-completions.ts` has no "NOT WIRED IN" header.
4. `noodlCompletions[]`'s 25-string array is deleted, not supplemented.
5. All four editor call sites behave identically — no "works in the property panel, dead in AI chat".
6. The worker spike is recorded with its result either way, before slice 3 designs on it.

## Traps

- **The popout mounts once.** `JavaScriptEditor`'s CodeMirror effect is `[]`-deps by design
  (`JavaScriptEditor.tsx:147-174`) and the callbacks it closes over are read through refs. A
  context prop that changes must go through a `Compartment`, not a remount — remounting loses the
  document.
- **`scopeCompletionSource(globalThis)` in the editor completes the *editor's* globals**, not the
  viewer's. The `Noodl` object the user's code runs against lives in the preview frame. Verify
  which object you are enumerating before believing a green result.
- Register beside the language data (`javascriptLanguage.data.of({ autocomplete })`), never as a
  replacement — that is what keeps CM's own local-variable and keyword completion alive
  (CED-001 A2, and the reason `noodl-completions.ts` is registered the way it is).
- HMR will not reach a mounted popout; restart the editor before concluding anything.
