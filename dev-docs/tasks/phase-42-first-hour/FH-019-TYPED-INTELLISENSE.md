# FH-019 — Autocomplete that knows your project

**Created:** 2026-08-05, out of [TALK-002](TALK-002-THE-CODE-EDITOR-IS-NOT-DIY.md) decision 3.
**Status:** **slices 1 and 2 shipped 2026-08-06; slice 3 measured and deferred — one decision needed
from a human, see [The spike, and what it decided](#the-spike-and-what-it-decided).** Criteria 1–6
met; criterion 5 met by construction rather than by four edits.
**Depends on:** [FH-017](FH-017-CODE-EDITOR-FIXES.md) (same files).

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
  (`JavaScriptEditor.tsx:136-164` — the doc said `:147-174`) and the callbacks it closes over are
  read through refs. A context prop that changes must go through a `Compartment`, not a remount —
  remounting loses the document.
- **`scopeCompletionSource(globalThis)` in the editor completes the *editor's* globals**, not the
  viewer's. The `Noodl` object the user's code runs against lives in the preview frame. Verify
  which object you are enumerating before believing a green result.
- Register beside the language data (`javascriptLanguage.data.of({ autocomplete })`), never as a
  replacement — that is what keeps CM's own local-variable and keyword completion alive
  (CED-001 A2, and the reason `noodl-completions.ts` is registered the way it is).
- HMR will not reach a mounted popout; restart the editor before concluding anything.

---

## The spike, and what it decided

Run before any of the above was built, per this task's own instruction. A replica of the editor's
renderer — `target: 'electron-renderer'`, `output.libraryTarget: 'commonjs2'`, externals from
`get-externals-modules.js`, a `file://` document, `nodeIntegration: true` — under the same Electron
43.2.0 binary. Four results, and the first one changes the question.

### 1. A worker is not needed. The renderer thread is fast enough by two orders of magnitude.

Measured, in the replica, with a `LanguageService` over a hand-written ambient surface and the 14
`lib.*.d.ts` files a JavaScript service loads:

| | |
|---|---|
| `require('typescript')`, parse + eval | **100 ms**, once |
| create service + load 2.1 MB of libs + first completion | **152–181 ms** |
| completion one keystroke later | **3 ms** |
| semantic diagnostics on a typo | **6 ms** |
| hover type | works — `(property) customerName: string` |

`Inputs.custmerName` produced *"Property 'custmerName' does not exist… Did you mean
'customerName'?"*. The whole "nothing is ever wrong" gap closes at 3 ms per keystroke, which is
inside the 750 ms lint debounce this editor already has. **The worker was a performance mitigation
for a cost that is not there.**

### 2. The worker *does* load — the premise that it is the unfixed Monaco wall is wrong as stated.

A separately-built `target: 'webworker'` bundle with `typescript` compiled in (8.64 MiB) loaded from
the `file://` document and answered in **97 ms**, first try. What fails is reusing the *shared
renderer config* for a worker chunk, and it fails twice, both times at the very end of the chunk:

- `output.libraryTarget: 'commonjs2'` appends `module.exports = …` → `ReferenceError: module is not
  defined`;
- `target: 'electron-renderer'` compiles in Node globals → `ReferenceError: global is not defined`.

Because both throw *after* the worker's own top-level code has run, a worker built this way installs
its `onmessage` handler and still replies — a half-working worker that reports an uncaught error.
That is a much more confusing failure than "workers don't load", and is a plausible reading of what
Monaco actually hit. A worker here needs its own config; it does not need a new capability.

### 3. `worker_threads` in the renderer is impossible, permanently.

`new Worker()` from `require('worker_threads')` throws *"The V8 platform used by this instance of
Node does not support creating Workers"*. Not a configuration problem — do not spend time on it.

### 4. What slice 3 now costs, and the one decision it needs

Option (a) is viable and option (b) is no longer the safe default so much as the smaller one. The
remaining cost is not CPU, it is **shipping `typescript`**:

- `typescript` is a **devDependency** of `packages/noodl-editor`, and `build.files` has no
  `!node_modules/…` exclusions, so `get-externals-modules.js` externalises it in every build. It is
  a runtime `require` that resolves today in development and **would not resolve in the packaged
  app**, where electron-builder ships production dependencies only.
- Making it resolve means moving `typescript` to `dependencies` — ~9.1 MB for `lib/typescript.js`
  plus ~2.1 MB of `lib.*.d.ts` that must be readable at runtime, against a package that is 23 MB on
  disk. That is a dependency and a packaging change, so it is **a human's call, not a task's**.
- Editor startup cost is nil either way: nothing loads `typescript` until a code editor is opened,
  and the first open pays ~250 ms once.

**Slice 3 is therefore specified, measured and blocked on that one decision.** Slices 1 and 2 took no
dependency and shipped, and they are what criteria 1–5 were actually asking for; the `.d.ts`
assembly buys type *checking* and hover types on top, which ESLint's `no-undef` (FH-017) partly
covers already.

## What shipped, and where the plan changed

Both departures were forced by the code rather than chosen, and both made the result smaller.

**Slice 1 is a registry, not a prop.** `noodl-core-ui/src/components/code-editor/authoringContext.ts`
holds a plain-data surface; the editor fills it from `models/CodeAuthoringContext` at boot (the
`ProjectDocs/install.ts` seam, for the same reason). Completion sources read it *when asked*, so
there is no `Compartment`, no reconfigure, and nothing that can go stale — and criterion 5 ("all
four call sites behave identically") holds by construction instead of by four hand-maintained
edits. All four call sites are inside `views/panels/propertyeditor/**`; none was touched.

**Slice 2's `Inputs.` needs no context at all.** A Function node's ports *are* its script text:
`JavascriptNodeParser.parseAndAddPortsFromScript` (`javascriptnodeparser.js:293-387`) mines
`Inputs.x` / `Outputs.y` out of the source and pushes a port per unique name. `utils/scriptPorts.ts`
copies those six patterns exactly, so a name completed is a port that will exist. "Renaming a port
changes what completes" then holds for the strongest reason available: renaming it in the code *is*
renaming the port.

### Premises in this doc that did not survive verification

1. **`scopeCompletionSource(globalThis)` for `Noodl.`** — slice 2 called it "strictly better and
   costs nothing, the API is on the object". It is on `window.Noodl` **in the preview frame**;
   `globalThis.Noodl` in the editor renderer is undefined, so it would have enumerated `React` and
   `webpackJsonp`. This doc's own trap list says exactly this. The trap list is right and slice 2 was
   wrong. `noodl-api-surface.ts` declares the surface instead, citing the runtime file per entry.
2. **"`Inputs`/`Outputs`/`Props`/`State`… come from the component's declared ports via slice 1's
   context."** `Props` and `State` are in scope **nowhere**: a Function body is compiled
   `new AsyncFunction('Inputs', 'Outputs', 'Noodl', 'Component', …)`
   (`simplejavascript.ts:446-453`). Completing them was inviting code that throws. They are gone,
   not threaded.
3. **One `Noodl`.** There are two. An Expression's `Noodl` is `createNoodlContext()`
   (`expression-evaluator.ts:243-289`) — four properties. A Function's is `window.Noodl` — nineteen.
   The old array offered one conflated list to both, and the fifteen maths helpers with it, which in
   a Function node are genuinely undefined names. Completions are now per mode.
4. **`noodl-completions.ts:21-54`** — the array was at `:23-56` after FH-017. Cosmetic; noted so the
   next reader does not think they are in the wrong file.
5. **`JavaScriptEditor.tsx:147-174`** for the `[]`-deps effect — it is `:136-164`.

`CodeEditorType.ts:143-223`, `codemirror-extensions.ts`'s `ExtensionOptions`, the
`library-completions.ts` "NOT WIRED IN" header, and `noodl-runtime/dist-types/noodl-runtime.d.ts`'s
existence all checked out as described.

### Live-QA recipe

HMR does not reach a mounted popout and the editor caches the boot path — **restart the editor**
before believing any of this. Open a project that has at least one `Variable` node with a name set.

1. Drop a **Function** node, open its `Run` → script popout.
2. Type `Noodl.` — expect ~19 members including `Records`, `Users`, `CloudFunctions`, not three.
3. Type `Noodl.Variables.` — expect the project's real variable names.
4. Type `Inputs.customerName` on one line, then `Inputs.` on the next — expect `customerName`.
   Change the first line to `Inputs.clientName` and retry: the list must follow.
5. Type `Outputs.Done()` then `Outputs.` — `Done` must appear as a function, not a variable.
6. Type `ro` — **nothing** should offer `round`; it is not defined in a Function node.
7. Open an **Expression** port instead. `ro` must now offer `round`, `Variables.` must complete
   without the `Noodl.` prefix, and `Noodl.` must offer exactly four members.
8. Settings → Libraries, register a library with a global. Without closing the editor, type that
   global's first letters in a still-open popout — it must complete, and using it must stop drawing
   a `no-undef` warning.
9. **Both themes.** Toggle light/dark with a popout open and re-run steps 2 and 4: the completion
   tooltip and the selected row must be legible in each. A hardcoded `dark: true` was one of
   FH-017's bugs in this exact component, so the theme is never incidental here.
