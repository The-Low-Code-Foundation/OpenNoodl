# CN-006 — Scaffold a kit

| Field | Value |
|---|---|
| **Tier** | 2 |
| **Effort** | M |
| **Surface** | `mcp`, `editor` |
| **Rulings** | ✅ **D1** (editor create command) · ✅ **D2** (JS + JSDoc types) · ✅ **D8** (tokens by default) |
| **Depends on** | CN-005 (the types the scaffold annotates against) |

## The job

Two entry points onto one generator:

- **`create_node_kit`** in `noodl-mcp` — so Claude Code can make a kit, which ✅ D1 and the phase's
  §6 both treat as a first-class use rather than an afterthought.
- **"New node kit"** in the editor — writes the scaffold and **opens `index.js`** in the code
  editor, per D1.

Output: `noodl_modules/<kit>/manifest.json`, `index.js`, `README.md`.

## What the generated kit must look like

This is the most consequential paragraph in the task. **The scaffold is what everyone copies**, so it
is the phase's main lever on whether kits are any good — more than any doc.

✅ **It must model P2** — *ports are the product; JavaScript is the escape hatch*:

- Every visual decision is a **port**: colour, radius, size, spacing, font size, and any threshold.
- ✅ **D8** — colour and spacing ports default to `var(--token)` values, not hex. AIB-001's
  passthrough in `react-component-node.ts` already handles a `var(--token)` string on a units-typed
  port (it must reach the style un-suffixed, or you get `var(--space-4)px`). The scaffold makes that
  the path of least resistance rather than a thing to discover. **Nothing validates it** — an author
  may hardcode, and brand colours and data-viz palettes are legitimate.
- **No buried constants.** If the example node needs a rule, the generated README shows it wired to
  a stock `Function`/`Expression` node rather than written in the component.
- ✅ **D2** — the definition carries the JSDoc `@type` annotation so autocomplete works immediately,
  with no build.
- The example uses `window.React` and a hook, so the single-React guarantee is exercised from line
  one rather than assumed.

⚠️ **A scaffold that emits a node with three hardcoded hex colours teaches the opposite of this
phase's second principle, forever.** Review the generated output against P2 as an acceptance
criterion, not as taste.

## Acceptance criteria

1. Scaffold a kit, reload the preview, and the example node is **in the picker and placeable** with
   no further edits.
2. The generated `index.js` produces autocomplete in VS Code with no `tsconfig` and no
   `node_modules`.
3. Every colour/spacing input in the generated node defaults to a `var(--token)`, and the rendered
   result **actually picks up the token** — verify the computed style, not the parameter value.
   ⚠️ `an-icon-host-that-sets-fill-sets-nothing` is the local precedent for a style that is set and
   does nothing.
4. The generated kit passes CN-004's validation clean. A scaffold that emits a kit our own validator
   complains about is not shippable.
5. Kit names collide safely: scaffolding twice with the same name refuses rather than overwriting.
6. **Build the caller**: scaffold a kit *through the MCP tool*, from a real session, and place the
   node. Generating files is not the feature; the feature is that the node arrives.

## Traps

- ⚠️ **The MCP tool surface budget — numbers corrected 2026-08-15.** The bar is **8,280**, the last
  measurement **8,223**, so there are **57 tokens** free, not zero: LEG-001's original 58 were spent
  by P67 / UNI-010's `lesson` group and the bar was renegotiated to restore the slack. One new tool
  must fit inside those 57. State what it costs, and if it does not fit, say what it displaces —
  **CN-009 is competing for the same 57**, and the test note forbids a third renegotiation.
- ⚠️ **`scripts/` is not in `build.files`.** If any part of the generator lives under `scripts/`, it
  is dead for real users and no gate will catch it.
- ⚠️ The editor command writes into the project directory. **Opening a project already writes three
  files**; adding a fourth write path needs the same care about dirtying and undo.

## Out of scope

- The kits list and provenance UI — that is **CN-006b**.
- The published reference kit — ✅ **D5** makes that a separate, deliberately minimal artefact under
  CN-016. This task generates a *starting point*, which is a different job with a different reader.

---

# BUILT — MCP half session 9, editor half session 10, 2026-08-16.

| Entry point | State |
|---|---|
| `create_node_kit` (`noodl-mcp`) | ✅ **Built, and proven end-to-end** — a kit scaffolded through the tool is extracted by CN-003's real extractor and answers `get_node_type` |
| "New node kit" (editor, ✅ D1) | ✅ **Built** — s10. Writes the scaffold, re-reads the project's modules, and opens `index.js` in a **real in-app file editor**, which is what Richard ruled the clause to mean |

The generator is `@nodegx/kit-scaffold` — one no-build workspace package, so the two entry points
cannot drift into teaching different things. **66 tests** in the package, **6** driving the
generated kit against the real runtime bridge, **9** driving it through the server, **8** driving it
through a webpack bundle. **31 more** in the editor.

## 🔴 Two silent runtime holes, both found before the scaffold existed

Both were found by reading the path D8 commits the scaffold to and then *probing it*, not by
building something and watching it fail.

### 1. `var(--token)` defaults were dead — and D8 asks for exactly those

This task's own spec states the premise that AIB-001's passthrough "already handles a `var(--token)`
string on a units-typed port". **Half true, and the wrong half.** AIB-001 guarded `input.set` — the
path a *set parameter* takes. A port's declared `default` never goes through `set`; it is unit-fitted
at definition time (`startStyle`) and at instance time (`props`). Measured before anything was
written:

```
STYLE = {"paddingLeft":"var(--space-3)px", "backgroundColor":"var(--surface-raised)"}
PROPS = {"fontSize":"var(--text-sm)px"}
```

`var(--space-3)px` is invalid CSS. The browser drops the declaration with no error, and the property
panel still shows the correct token. ⚠️ **The asymmetry that hid it: a colour port has no units**, so
the colour arm always worked — a scaffold reviewed by eye, or a test asserting the *parameter value*,
reports "tokens working".

Two guards added to `react-component-node.ts`, each mutation-proven against its own test, plus a
third mutation (removing unit-fitting entirely) proving the controls bite.
`tests/cn-006-token-defaults.test.ts`, 5 tests.

### 2. A kit scaffolded mid-session was invisible to the server that scaffolded it

`installProjectOverlay` is idempotent per directory and runs **once at bind**. `create_node_kit`
writes a kit into the bound project *after* that, so the tool reported four files written and the
agent's very next `get_node_type` answered **"Unknown node type"**. Nothing broke, nothing logged,
and the success payload was accurate — the kit really was on disk. AC6 is written against precisely
this gap. `refreshProjectOverlay` is called from the one door that knows the kit set changed;
deliberately not a poll or an mtime sweep, which ✅ D3 argues against.

## The tool-surface budget — measured, not argued

Baseline re-measured at **8,223 / 57 under the 8,280 bar**, matching the handover's figure.

| placement | surface | cost |
|---|---|---|
| baseline | 8,223 | — |
| **in the existing deferred `project` group** | **8,223** | **0** ✅ |
| a new deferred `kit` group | 8,249 | 26 |
| resident | 8,464 | 241 — **184 over the bar on its own** |

**It costs nothing, and CN-009 still has all 57.** The only resident trace of a deferred group is
`find_tools`' `(N tools)`, and "3 tools" and "4 tools" are the same length.

🔴 **What the placement costs instead:** `project`'s `purpose` line does not mention kits, and that
line is the only description a model reads before choosing a group. `find_tools`' `query` matches
tool *names*, so `query: "kit"` reveals it from anywhere — asserted in `tests/kitTools.test.ts`,
**with a control asserting that a query about what it *does* finds nothing**. That control fails the
day somebody widens the purpose line, so the trade-off gets re-decided rather than drifting.

✅ **Also landed, because the budget test asked for it in writing:** the surface test now prints
`[surface] N tokens … M under the budget` **on a passing run**. Its own header says *"a budget
assertion with no reported margin cannot distinguish 'we have room' from 'we had room'"* — that is
how 56 of LEG-001's 58 banked tokens were spent by work that never knew it was spending them.

## Acceptance criteria

| # | Criterion | State |
|---|---|---|
| 1 | Scaffolded node in the picker and placeable, no further edits | ⚠️ **Partial, unchanged by s10.** The node registers, the bridge accepts it, every documented port arrives, and it renders — asserted against the real bridge and real React. The editor half now exists, but **the picker has still not been driven in a running editor** — see §Owed |
| 2 | Autocomplete with no `tsconfig` and no `node_modules` | ✅ **Met.** CN-005's language-service instrument, pointed at the bytes the scaffold writes. 0 diagnostics, definition fields offered, **`document` absent** — and a control stripping the annotation gets `document` back |
| 3 | Colour/spacing defaults are tokens **and the render picks them up** | ✅ **Met at the style layer** — an instance with no parameters set carries `padding: 'var(--space-4)'`, and the rendered markup contains `margin-top:var(--space-1)` with no `)px` anywhere. ⚠️ Computed style in a browser is **not** measured; that is the editor drive |
| 4 | Passes CN-004's validation clean | ✅ **Met**, against the same project's summary before the kit. 🔴 This assertion was a **false pass** first time — the tool was deferred, every call returned "Tool disabled", and "same summary before and after" was trivially true. It now asserts the kit landed before grading its effect |
| 5 | Names collide safely | ✅ **Met**, including two names that slug to one directory, and asserting the author's edited file survives the refusal |
| 6 | **Build the caller** — through the MCP tool, from a real session | ✅ **Met for the server**: `create_node_kit` → `get_node_type` answers with the node, via the extractor that *executes* the generated `index.js`. This is what found hole 2. ⚠️ "Place the node" in the editor is the editor half |

## What the generated kit teaches, asserted rather than intended

`EXAMPLE_PORTS` is the single table the code and the README are both built from, so a port table
cannot drift from its code. On top of it:

- **Every colour and length port defaults to a `var(--token)`** — and every token it emits is checked
  against the editor's `DefaultTokens.ts` registry. 🔴 That check earns its place: CN-005's annotated
  fixture defaults a colour to `var(--color-surface-2)`, **which is not a token in this product**.
  Harmless in a type fixture, fatal in a scaffold, and invisible to every other assertion because
  `var(--anything)` is well-formed CSS that resolves to nothing.
- **No raw hex anywhere** in the generated node — D8's named failure, asserted.
- **No relational operator against a number literal** in `index.js`. The example's one threshold
  (*when is this tile highlighted?*) is an input, and the README shows it wired to a stock
  `Expression` node, with the shortcut quoted as the mistake. Asserted behaviourally too: flipping
  the input changes the colour, **and the other arm does not**.

## The types copy, and the staleness question the handover left open

A kit carries its own `types/node-kit.d.ts` because CN-005 measured that a bare specifier cannot
resolve without `node_modules`. The copy is unavoidable; the question is whether its age is
*answerable*. Three things, none of them "remember to update it":

1. **No second copy in the repository** — the bytes are read from the installed
   `@nodegx/node-kit-types` at scaffold time, asserted.
2. **The written copy is stamped** with the version, and `manifest.json` carries `nodeKitTypes` so a
   kit's types version is readable without opening the `.d.ts`.
3. **`typesCopyStatus(contents)` answers it for any kit's copy**, including hand-made ones. It
   compares the **body**, not the stamp — a lying stamp is reported beside the verdict, never
   *as* it, because deciding staleness from a stamp is the frozen figure this exists to avoid.

✅ **It immediately caught a real one.** The cashflow kit's copy was **not current** — it predated
CN-005's own React-collision warning by one session, drift inside a day. Refreshed and re-stamped;
the kit still reports **0 diagnostics** through the language service.

---

# The editor half — BUILT, session 10, 2026-08-16

**D1's open clause was put to Richard rather than picked quietly, and he ruled for the literal
reading: build a real in-app file editor.** So the editor now has one, and it is the first
file-backed code surface in the application — every other CodeMirror in it is bound to a node
*parameter*.

| Piece | Where |
|---|---|
| The command | `SettingsPanel/sections/KitsSection.tsx`, beside `LibrariesSection` |
| The generator seam | `createNodeKit()` in `shared/utils/projectmodules.ts`, beside `registerLibrary` |
| The file model | `models/ProjectFiles/ProjectCodeFileModel.ts` |
| Shared primitives | `models/ProjectFiles/projectFileIo.ts` — **extracted from `ProjectDocsModel`, not copied** |
| The editing surface | `views/documents/CodeFileDocument/`, registered in `router.setup.ts` |

**31 new tests** in the editor (3 suites), **8** in `@nodegx/kit-scaffold`.

## 🔴 A third silent hole, and this one only exists on the far side of a bundler

Found by probing the path *before* building the caller, the same way the first two were.

`@nodegx/kit-scaffold` reads the published `.d.ts` at call time through
`require.resolve('@nodegx/node-kit-types/package.json')`. The MCP server is plain Node, where that is
honest. **The editor renderer is a webpack bundle, where it is not.** Webpack resolves the specifier
at build time, pulls the `package.json` in as a module, and rewrites the call site to the *module
id*:

```js
const pkgPath = /*require.resolve*/(/*! … */ "../nodegx-node-kit-types/package.json");
```

`fs.readFileSync` then resolves that as a **relative path against `process.cwd()`**. So whether the
scaffold worked at all became an accident of where the process was started. The line carried a
comment claiming the opposite — *"keeps working from a packaged build"* — which is true of npm
layout and false of a bundler.

⚠️ **Nothing in the repository could have caught it.** The package's suite is plain Node; the
editor's suite never executes a bundle. `resolvePublishedPackageJson` now proposes candidates and
**verifies each one is an absolute path that exists** before returning it.

### 🔴 The gate was written twice, because the first one graded a broken build as passing

`tests/webpack-caller.test.js` builds this package through webpack with the editor's own target and
externals, then calls the result. Mutating the fix away left it **green**, twice:

1. Jest's cwd is `packages/nodegx-kit-scaffold`, and `"../nodegx-node-kit-types/package.json"` is a
   valid *relative* path from there. The broken build read the right file by coincidence.
2. So is the editor's — `packages/noodl-editor` is a **sibling** of `packages/nodegx-node-kit-types`.
   Moving the call to the editor's working directory, the obvious correction, reproduced the same
   accident.

The layout with neither coincidence is the one that ships: a bundle **beside its `node_modules`**,
with no sibling `packages/` above it. Against that, the mutation fails with the production `ENOENT`
while all five controls stay green — including one asserting the two coincidences are real and
absent here, so nobody "simplifies" the fixture away.

⚠️ **Not graded: a real `app.asar`.** The remaining risk is asar path handling, not the resolution
strategy.

## What the editor half does after writing the files

Writing four files is not the feature; the node arriving is. Three things, and the middle one is the
editor twin the handover told this session to expect:

1. **`index.js` opens in `CodeFileDocument`** — D1's clause, honoured literally. Done *last*, so a
   failure to open a document can never cost the author a kit that was written successfully.
2. **`ProjectModel.readModules()` is called** — `ProjectModel.modules` is filled once at project
   load, so a kit written after that is on disk and absent from the model. One re-read at the single
   door that knows the kit set changed; deliberately not a poll or an mtime sweep, per ✅ D3.
   ⚠️ **Still to measure in a running editor** — see §Owed.
3. **The author is told to reload the preview.** ✅ D3 puts node definitions in the viewer's gift:
   the picker lists what a *running runtime* registered and sent over `sendNodeLibrary`, so a kit
   that has never been executed cannot be in it. ⚠️ Related: `ViewerConnection.sendRefresh()` exists,
   emits `'reload'`, **and nothing anywhere listens for it** — dead at both ends, so there is no
   in-app reload to call. Worth a task.

## Why a document rather than a popout

The editor had three ways to show code and none could show a *file*: `CodeEditorType` is a `TypeView`
bound to `getParameter`/`setParameter`, and both propertyeditor modals are portals over a node
parameter. All three are anchored to a graph object; a kit's `index.js` is not one.

`ProjectDocsModel`'s discipline was adopted wholesale, because every word of AIX-009's reasoning
applies harder here — the author *will* have the kit open in VS Code at the same time, since that is
where this phase told them to edit it. Baseline-checked writes, atomic rename, and a
content-comparing poll (`IFileSystem` has no watcher and no mtime; `FileStat` is `{ size }`).

✅ **Its two shared primitives were extracted rather than copied.** `writeTextAtomic` and the
relative-path helper were private to `ProjectDocsModel`; they now live in `projectFileIo.ts` and both
models import them. A second copy of "temp file, then rename" stays right for about a month.

⚠️ **Both halves of the concurrent-edit guard are needed, and guarding one just picks who loses.**
The poll refuses to clobber an unsaved buffer *and* the save is refused against a moved baseline.
Asserted with a control proving the refusal is total — a guard that throws *after* writing passes a
naive `rejects.toThrow` and has still destroyed the other side's work.

## 🔴 A cross-package golden that no package's own gate can see

`test:ci` came back **2843 / 7 @ seed 39393**. Six are the floor by name. The seventh is
`projectmodules — injectIntoHtml snapshot … byte-identical HTML to the committed golden`, in the
file this session edited — so it was treated as mine until proven otherwise. It is not:

- `@nodegx/module-inject` and the golden are both **clean** in the working tree;
- the only commit touching `__noodl_module_name` is **`f7da52d1`** (*"fix(cn-003): a kit can say its
  own name"*, 16:39 today), which is an **ancestor of this session's starting HEAD**;
- reproduced in plain Node: the generator now emits one extra
  `<script>window.__noodl_module_name = "code-a";</script>` per prefix block, and the committed
  golden has neither.

⚠️ **`f7da52d1` updated `@nodegx/module-inject`'s own tests and not the editor's golden**, and the
package's suite is green. So a package changed its output, its own gate agreed, and the only thing
that noticed was a *different* package's snapshot — visible in `test:ci` alone. **Deliberately not
fixed here**: regenerating another lane's golden would launder their semantic change through this
commit. It wants a one-line fix from whoever owns CN-003.

## Gate readings — s10

| Gate | Reading |
|---|---|
| `packages/noodl-editor` jest (`test:main`) | ✅ **220 suites / 3396 — 0 failures**, on the settled tree |
| `@nodegx/kit-scaffold` jest | ✅ **5 suites / 66** (was 4 / 58) |
| `packages/noodl-editor` `tsc --noEmit` | ✅ **0 errors**, and `--listFiles` confirms all five new files are actually reached |
| `test:ci` @ `NOODL_SPEC_SEED=39393` | ⚠️ **2843 / 7** — the floor six, plus the pre-existing golden above |

🔴 **An earlier `test:main` in this session read 219/1 failed, and that failure was also not mine** —
`fix-005/dropdown-contrast.spec.ts` reads `BlocklyWorkspace.module.scss`, which a peer had
mid-edit; its `.blocklyTreeLabel` rule resolved at HEAD and had been deleted in the working tree.
The peer committed during the session and the re-run is clean. ⚠️ **The count moved 3379 → 3396 in
the same session** for the same reason — re-measure, never subtract.

## §Owed — what s10 built but did not drive

🔴 **No editor was launched this session, so nothing below has been seen in a browser.** This is
stated plainly rather than softened: the code typechecks, its logic is unit-tested against a real
filesystem, and its bundling is tested against a real webpack build — but a React surface that has
never been mounted is not a surface that is known to render.

Three specific things want a drive, and they are the same three the handover named:

1. **AC1 — the scaffolded node in the picker, placeable.** Needs a scaffold, a preview reload, and a
   drag. The runtime half is asserted; the picker half is not.
2. **AC3 — the *computed* style, not the parameter value.** The style layer is asserted (an instance
   with no parameters carries `padding: 'var(--space-4)'`, and the rendered markup contains
   `margin-top:var(--space-1)` with no `)px`). ⚠️ `an-icon-host-that-sets-fill-sets-nothing` is the
   local precedent for a style that is set and does nothing, and only a browser closes it.
3. 🔴 **The `ProjectModel.modules` staleness twin — measured, not assumed.** `readModules()` is
   called after a scaffold *because* the MCP side had exactly this hole. Whether the model was
   actually stale without it has **not been measured**, and the handover's own warning applies to
   this session too: *the MCP side looked fine too.* The call is cheap and correct either way, but
   "the hole existed here as well" is currently a hypothesis, not a finding.

⚠️ Also unmeasured: **`CodeFileDocument` mounting at all**. It is registered, typechecked and
reachable from `KitsSection`, and no test mounts React.
