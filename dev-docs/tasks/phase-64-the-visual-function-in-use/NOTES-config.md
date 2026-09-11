# NOTES — VFN-012, the app-config half

**Session 2026-08-13, branch `vfn-config`.** Built the app-config-variables half of VFN-012
complete and gated. The registered-libraries and `window` halves are **not** built — see
[What is deliberately not here](#what-is-deliberately-not-here).

---

## The naming decision, and why

Three vocabularies were in play, and the toolbox had one of them wearing another's name.

| What | Reached as | Lifetime | Toolbox category |
| --- | --- | --- | --- |
| Variable nodes' global bag | `Noodl.Variables["x"]` | mutable at runtime, created by being used | **`Runtime Variables`** (was `App Variables`) |
| App settings' declared variables | `Noodl.Config["x"]` | declared, typed, **immutable** at runtime | **`App Config`** ← new |
| Blockly's own locals | `x` | one program, one run | `Variables` (unchanged) |

**`App Config`** for the new one, because that is where they are declared and it cannot be
misread as either of the other two. It sits directly below `App Arrays`, which is where Richard
asked for it (*"an option next to App Arrays or App Objects"*).

**`Runtime Variables`** for the old one. `App Variables` is precisely the phrase a builder reads
as *"the variables I declared in app settings"* — it is what sent Richard looking in the wrong
category and finding nothing. The rename is **copy only**: `noodl_get_variable` /
`noodl_set_variable` are unchanged and are asserted unchanged
(`app-config-block.spec.ts` → *"🔴 changes no block type id"*). Six locale bundles were updated
alongside `DEFAULT_TOOLBOX_LABELS`; `ToolboxLabels` is a total interface, so a bundle that missed
the new key would not compile.

---

## 🔴 The defect that decided the implementation

The task file said a dropdown *"must survive a key being renamed or deleted in app settings"* and
*"never silently snap to the first valid option, which would change a program by opening it."*

That is not a hypothetical. **Blockly 12.3.1's stock `FieldDropdown` does exactly that.** Measured,
in the plain-Node runner:

```
save a block on "maxItems" → delete maxItems in app settings → reload
  console.warn: Cannot set the dropdown's value to an unavailable option. … Value: maxItems
  field value:  "apiUrl"          ← somebody else's variable
```

It logs the objection and then commits the change anyway. Every block reading a deleted config
variable would silently start reading whichever key sorts first, at the moment the project was
opened.

So `ConfigKeyField` (in `NoodlBlocks.ts`) is a two-method subclass:

- `doClassValidation_` accepts any string — the field is a *picker*, not the authority on which
  keys exist, so the stored value is always the key the author chose;
- `getText_` renders an undeclared key **as itself, marked** (`⚠ maxItems`).

`app-config-block.spec.ts` builds a **stock** dropdown beside ours in the same suite and watches
it snap. That test is the control: if Blockly ever fixes this, that test goes red and the subclass
can be deleted — which is the only honest way to hold a workaround for someone else's default.

---

## What was built

| File | What |
| --- | --- |
| `views/BlocklyEditor/appConfig.ts` | **new** — everything except the field. No Blockly, no `ProjectModel`: the projection, the options, the display rule, the tooltip, the generated expression, the flyout contents. |
| `views/BlocklyEditor/NoodlBlocks.ts` | `ConfigKeyField` + the `noodl_get_config` block. |
| `views/BlocklyEditor/NoodlGenerators.ts` | `Noodl.Config["key"]`, `Order.MEMBER`. |
| `views/BlocklyEditor/BlocklyToolbox.ts` | the `App Config` dynamic category; the `Runtime Variables` rename. |
| `views/BlocklyEditor/BlocklyLocale.ts` | the new label in all six translated bundles + the rename. |
| `views/BlocklyEditor/BlocklyWorkspace.tsx` | points the provider at `ProjectModel`, registers the category callback and the *Open app settings* button. |
| `views/BlocklyEditor/myblocks/shape.ts` | `noodl_get_config` as a value block with no value inputs, so My Blocks can inline it. |
| `tests-unit/vfn-012/` | **new** — 38 specs across two files. |

### One block, and one is the whole feature

There is no `noodl_set_config`. `Noodl.Config` is a proxy whose `set` trap logs an error and
returns `false` (`noodl-viewer-react/src/api/config.ts`), so a setter block would generate code
that silently does nothing. The spec asserts the absence.

### Why the provider seam exists

`appConfig.ts` is in `initialize.ts`'s import graph, which is reachable from the plain-Node
`tests-unit` runner — and `ProjectModel` is not. So the project is reached through a settable
provider defaulting to "no variables", and `BlocklyWorkspace` (React, has a project) points it at
`ProjectModel.instance.getConfigVariables()`. Read live on every flyout open, so a variable
declared in Settings while the block editor is open shows up on the next click, with no
invalidation to get wrong.

A throwing provider answers empty rather than taking out the flyout — an exception there would
surface as a category that does not open, with no clue why.

---

## How it was proved

**Two suites, 38 specs, `packages/noodl-editor/tests-unit/vfn-012/`.**

- `app-config-projection.spec.ts` (21) — pure: `project.json` → category contents. Malformed
  documents, duplicate keys, grouping, the empty state, the provider seam.
- `app-config-block.spec.ts` (17) — real headless Blockly, real generator: the block's shape,
  what it generates, the probe path, the delete/reload round trip, the toolbox placement.

### 🔴 The negative controls, and that they were shown red

*A suite of absences is indistinguishable from an instrument that measured nothing*, so each
control was verified by sabotaging the source and watching the intended tests fail, then
restoring:

| Sabotage | Went red |
| --- | --- |
| `appConfigKeyDisplay` snaps an unknown key to the first declared one | 3 specs, incl. *"🔴 renders a key app settings no longer declares as itself, with a mark"* |
| the empty category returns `[]` instead of explaining itself | 3 specs, incl. *"🔴 negative control: an empty category and a category that never built are told apart"* |
| `ConfigKeyField.doClassValidation_` removed | 5 specs, incl. *"generates the same code it generated before the deletion"* |

All three restored to 38/38 green.

`hasAppConfigEmptyState` is the instrument that separates *"this project has no config variables"*
from *"the category failed to build"* — the two look identical otherwise. It is asserted **both
ways round**: `true` for the real empty category, `false` for `[]`.

### Gates

| Gate | Result |
| --- | --- |
| `cd packages/noodl-editor && npx jest` | **159 suites / 2303 passing** — baseline 157/2265 plus this task's 2 suites and 38 specs, no other suite moved |
| `npm run cloud-library:check` | green — *"Committed cloud node library is up to date"* |
| `cd packages/noodl-editor && npx tsc -p tsconfig.json --noEmit` | 0 errors (covers `BlocklyWorkspace.tsx`, which jest does not reach) |

⚠️ **`tsc` was nearly a gate that lied.** The first two attempts were spelled
`timeout 600 npx tsc … | grep …`; **macOS has no `timeout`**, so the command failed instantly and
the grep matched nothing, which reads exactly like "clean". Re-run without it, then proved the
program actually covers the file by planting a type error in `BlocklyWorkspace.tsx` and watching
`tsc` name it.

---

## What still needs a live drive

I cannot drive the editor from this worktree (`npm run dev` resolves through `lerna` to the
primary checkout). Everything below is unproven **in the running app**:

| Criterion | Status |
| --- | --- |
| 1 — block generates `Noodl.Config["key"]` | generated string **proved**; *"reads correctly in the running app"* **not driven** |
| 2 — deleted key stays, marked, program unchanged | **proved** headless, including the stock-dropdown control; the *rendered* `⚠` mark is unproven visually |
| 5 — old project opens with identical bytes | block type ids **proved** unchanged; the `project.json` byte diff on a real old project is **not done** |
| 6 — empty category explains itself | ✅ **DRIVEN (session C)** — the flyout rendered both `kind: 'label'` items and the `kind: 'button'` |
| 7 — `cloud-library:check` | **proved** |

⚠️ **Updated after DRIVE-2026-08-13-C: items 1 and 2 below are closed; 3, 4 and 5 are still owed.**

Specific things a drive should check, in rough order of risk:

1. ✅ **CLOSED — the flyout renders labels and a button.** Selecting *App Config* with no variables
   declared rendered *"This app has no config variables yet."*, *"Declare them in Settings → Project
   → Custom Variables."*, and an **Open app settings** button at `[477, 361, 130, 23]`.
2. ✅ **CLOSED — the button reaches the panel**, and it found a defect on the way.
   `openSettingsPanel('project')` opened Settings → Project. 🔴 **The panel opened *behind* the
   Logic Builder window the button was pressed from** — this feature's own call to action landing
   somewhere the feature is hiding. That is VFN-005's occlusion with a concrete in-feature
   consequence, and it is why VFN-005 built the **yield**. The yield itself is undriven.
3. 🔴 **OWED — the `⚠` mark's legibility on a hue-90 block.** Dark-on-dark is this repo's recurring
   defect. Needs a config variable declared and then deleted. Take it together with §2/§3's item 7
   (the same reading on hue 355).
4. 🔴 **OWED — a stale mark.** `getText_` reads the provider at render time and Blockly re-renders a
   field on *value* change, not on app settings changing underneath it. A block already on the
   canvas keeps its mark until it is touched or the editor is reopened. Stale in the harmless
   direction — the *stored key* is never wrong, only the warning glyph is late — but if it grates
   in use, the fix is a `forceRerender()` sweep on the `appConfig` metadata event.
5. 🔴 **OWED — a round trip through the runtime**: declare a variable, read it in a Visual Function,
   run the preview, read the value off the node's output.

---

## What is deliberately not here

The **registered-libraries** and **`window`** halves of VFN-012. The task file says the scope cuts
cleanly and it does. Reasons, so the next session does not have to re-derive them:

- Richard's words *today* were about the config variables only.
- The task file proposes lumping all three into **one** `App & Browser` category with three
  sub-groups. That is incompatible with what he asked for today — an option *beside App Arrays* —
  and I built the latter. Choosing between those two layouts is a decision he should see, not one
  to make silently while adding a feature.
- The seam is now cheap: `setConfigVariablesProvider` + a `custom` category + a pure module with
  its own specs is a pattern a follow-up can copy in an afternoon.
  `listRegisteredLibraries()` lives in `src/shared/utils/projectmodules.ts` and imports only Node
  built-ins and `ajv`, so its pure half is reachable from `tests-unit` the same way.
- ⚠️ `RegisteredLibrary.runtimes` matters and is easy to miss: a library registered for the
  browser is not present in a cloud function, so the block must say which runtimes it covers.

---

## Two things found on the way, neither mine to fix

1. 🔴 **The settings panel documents an API that does not exist.**
   `VariablesSection.tsx:407` reads *"Define custom config variables accessible via
   `Noodl.Config.get('key')`"*. There is no `get` — `createConfigAPI` returns a `Proxy` with a
   property `get` *trap*, so `Noodl.Config.get('key')` evaluates `flat['get']`, which is
   `undefined`, and logs `Noodl.Config.get is not defined` on the console. The working spelling is
   `Noodl.Config.key` / `Noodl.Config["key"]`, which is what this task's blocks generate. The
   panel is teaching the one spelling that silently fails.
2. `RESERVED_CONFIG_KEYS` (identity/SEO/PWA) are flattened into `Noodl.Config` too, and are **not**
   in this category — it lists only `variables`. Reading `Noodl.Config["appName"]` works and there
   is no block for it. Arguably right (they are not variables), worth a ruling if anyone asks.

---

# NOTES — VFN-012 §2 and §3, the libraries and `window`

**Session 2026-08-13, branch `vfn-g-config`, commits `69a13622` + this one.** The two halves this
file's *"What is deliberately not here"* section left open are now **built and gated**. Nothing was
dropped; the reasons that section gave for stopping are answered below rather than overruled.

> **Everything below is proved headless.** ⚠️ Nothing is driven. See *What a drive owes this*.

## The layout question the previous session refused to answer silently

That refusal was right, and it is now settled — by what shipped, not by a new preference.

§1 put **`App Config`** directly below `App Arrays`, which is where Richard asked for it. Re-siting
it into the task file's proposed `App & Browser` would be churn on a merged, driven feature. So §2
and §3 go into **one new category, `Libraries & Browser`, directly below `App Config`** — the same
shape as §1, one shelf lower.

**One category for both, not two.** They are the same escape hatch at two levels of ceremony: a
registered library generates `window.<global>` and the browser block generates `window["a"]["b"]`.
The report asked for them in one sentence too. The seam now reads:

```
Inputs / Outputs · Signals · Runtime Variables · App Objects · App Arrays · App Config · Libraries & Browser
```

Hue **355**, by §1's arithmetic: the taken hues are 20, 55, 90, 120, 160, 180, 210, 230, 260, 290,
330; the widest remaining gap is the wrap from 330 to 20, and 355 is 25° from either neighbour.

## 🔴 The constraint that decided this half: the source is on disk, and async

`listRegisteredLibraries()` reads `noodl_modules/` off the filesystem and returns a promise. A
Blockly flyout callback and a `FieldDropdown`'s option generator are **both synchronous** and are
called during rendering. §1 had no such problem — `getConfigVariables()` is a synchronous read of a
model already in memory — so this is genuinely a different feature wearing the same clothes.

That turns *"an async injection sampled early looks like a disposal"* from a caution into a live
defect. A two-state cache (`RegisteredLibrary[]`, empty until the read lands) would, at the moment
the editor opens:

1. tell a project with five libraries that it has none, and name a settings page the author has
   already used; and
2. render **every** library block on the canvas as `⚠ PocketBase` — an accusation of deletion, made
   from ignorance.

So the cache is a **tri-state snapshot**:

| status | means | flyout says | field says |
| --- | --- | --- | --- |
| `unknown` | the scan has not landed | *Reading this project's libraries…* | the global, **unmarked** |
| `loaded` | the scan landed; here is the list, possibly empty | the libraries, or *add some* | marked iff absent |
| `unavailable` | no project directory, or the scan threw | *could not read them*, and why | the global, **unmarked** |

🔴 **The third state is not padding.** `scanModuleManifests(undefined)` returns `[]`
(`projectmodules.ts:192`), so a project with no directory on disk is *indistinguishable* from a
project with no libraries if you only look at the array. The loader `BlocklyWorkspace` installs
therefore **throws** rather than passing `undefined` down. That is `hasAppConfigEmptyState`'s lesson
from §1 with one more way to be wrong, and there are now three predicates instead of one —
`hasLibrariesLoadingState` / `hasLibrariesEmptyState` / `hasLibrariesUnavailableState` — with a spec
asserting **exactly one** holds in each state.

A `generation` counter (the device from `CodeAuthoringContext/install.ts`) stops a slow read of the
project that just closed becoming the answer for the one that just opened.

## ⚠️ The cloud function nobody remembers

`noodl-runtime.ts:190` registers the Logic Builder **unconditionally** — it is *not* in the
`type !== 'cloud'` subtraction — so a visual function can run inside a cloud function, where
`noodl-viewer-cloud/src/sandbox.isolate.js` has **no `window`** and no injected library script.

Both blocks say so, in the tooltip and in the flyout. `libraryRuntimeNote` reads the manifest's
`runtimes` rather than assuming it (every library `registerLibrary` writes is `['browser']`, but a
hand-authored manifest need not be).

🔴 **`window.x` is left to throw a `ReferenceError` there, on purpose.** A
`typeof window !== 'undefined' ? … : undefined` guard turns a wrong program into a silently empty
one, and `globalThis` would quietly succeed against an object that is not a browser window. A thrown
error naming `window` is the only outcome that tells the author what is true.

## Two smaller things, both of which a value-based test would have missed

- **A pasted `window.` prefix.** The block reads `🌐 window.` + field, and an author will still paste
  `window.location.href` into it. The naive parse produces `window["window"]["location"]["href"]`,
  which **works** — `window.window === window` — right up until the first path whose head is not
  self-referential. One leading `window` is dropped, and the spec asserts the *string*, against the
  exact string the bug would have emitted.
- **A library registered with no `global`.** `listRegisteredLibraries` maps it to `global: ''`, and
  it genuinely cannot be read. It is **named in the flyout** with what to do about it rather than
  silently dropped — "my library isn't in the list" is the worst question a tool can provoke.

## What was built

| File | What |
| --- | --- |
| `views/BlocklyEditor/appLibraries.ts` | **new** — §2 and the shared category. No Blockly, no `ProjectModel`: the tri-state snapshot, the async seam, the options, the display rule, the tooltip, the runtimes note, the generated expression, the flyout, the three instruments. |
| `views/BlocklyEditor/windowAccess.ts` | **new** — §3. The path grammar, the expression, the cloud warning. Imports nothing. |
| `views/BlocklyEditor/NoodlBlocks.ts` | `LibraryGlobalField` + the `noodl_library_global` and `noodl_window` blocks. |
| `views/BlocklyEditor/NoodlGenerators.ts` | `window.<global>` and `window["a"]["b"]`, both `Order.MEMBER`. |
| `views/BlocklyEditor/BlocklyToolbox.ts` | the `Libraries & Browser` dynamic category, hue 355. |
| `views/BlocklyEditor/BlocklyLocale.ts` | the new label in all six translated bundles. |
| `views/BlocklyEditor/BlocklyWorkspace.tsx` | installs the async loader, kicks the eager refresh, registers the category and button callbacks. |
| `views/BlocklyEditor/myblocks/shape.ts` | both types as value blocks with no value inputs, so My Blocks can inline them. |
| `tests-unit/vfn-012/` | **3 new files, 85 specs** (123 in the directory with §1's 38). |

🔴 Registered from `BlocklyWorkspace.tsx`, **not** `initialize.ts` — VFN-003's lesson. `appLibraries.ts`
and `windowAccess.ts` are in `initialize.ts`'s import graph and stay reachable from the plain-Node
runner; `listRegisteredLibraries` (which needs `fs`) is imported only by the React file. The
`RegisteredLibrary` import in `appLibraries.ts` is `import type`, which is fully erased — that is
what also keeps `BlocklyToolbox.ts` importable by the Settings panel without dragging Node built-ins
into the main bundle.

### One block each, and no setter

There is no `noodl_set_library_global` and no `set window`. Assigning a browser global from a visual
function is a way to break a page with no way to see it happened. Both absences are asserted.

## 🔴 The negative controls, and that they were watched red

Eight sabotages, each applied to the source, run, and the failing test **names read off the runner**
before restoring. All eight restored to 123/123.

| # | Sabotage | Went red |
| --- | --- | --- |
| 1 | `libraryGlobalDisplay` marks against any snapshot, not only a `loaded` one | **3** — *"does not mark a global while the libraries are still being read"*, *"…when the libraries could not be read at all"*, *"ours survives the identical treatment"* |
| 2 | `unknown` collapses into `loaded: []` in the flyout | **4** — *"tells 'not read yet' apart from the other two"*, *"the loading sentence and the empty sentence are not the same sentence"*, and both poll tests |
| 3 | `hasLibraryBlock` counts `kind === 'block'` instead of the library type | **6** — all three state tests, plus *"a loader that throws produces `unavailable`, never `loaded: []`"* |
| 4 | the `generation` guard removed | **1** — *"a slow read cannot land on top of a newer one"* |
| 5 | the `window` block gated behind having a library | **2** — *"offers `window` in every state…"*, *"gives the window block a path to start on"* |
| 6 | the leading `window.` no longer stripped | **4** — all three paste tests plus *"canonicalises what was typed"* |
| 7 | `LibraryGlobalField.doClassValidation_` removed | **3** — *"ours survives the identical treatment"*, *"marks it once a completed scan says the library is gone"*, *"generates the same code it generated before the library was removed"* |
| 8 | the generator consults the async scan | **1** — *"generates the same code it generated before the library was removed"* |

⚠️ Sabotage 3 is the one worth remembering. The `window` block is in **every** flyout, so a predicate
written the obvious way (`items.some(i => i.kind === 'block')`) reports *no empty state, ever* — and
every "the category explains itself" test would have passed while measuring nothing.

Sabotage 8 is the async trap in its second form: `browser-blocks.spec.ts` asserts the generated
string is unchanged across `loaded → loaded-without-it → unknown`, so a generator that read the
snapshot would rewrite a saved program depending on when the debounced save happened to fire.

**The stock-dropdown control is rebuilt for this half, and it is worse here than in §1.**
`browser-blocks.spec.ts` builds a stock `FieldDropdown` beside ours, saves a block on `PocketBase`,
resets to the `unknown` state — *the first tick of every editor session*, not a contrived scenario —
and watches Blockly rewrite the stored value to `''`. Ours does not.

## Gates

| Gate | Result |
| --- | --- |
| `cd packages/noodl-editor && npx jest --config jest.config.js tests-unit/vfn-012` | **123 passed** (§1's 38 + this task's 85), 5 suites |
| `cd packages/noodl-editor && npx jest --config jest.config.js` | see the commit body — compared against the 175 suites / 2622 baseline |
| `cd packages/noodl-editor && npx tsc -p tsconfig.json --noEmit` | 0 errors (covers `BlocklyWorkspace.tsx`, which jest does not reach) |
| `node scripts/cloud-node-library/generate.js --check` | green — *"Committed cloud node library is up to date"* |

⚠️ Run `tsc` **without a pipe**, or read `$pipestatus`. §1's notes record the same trap from the
other direction (`timeout` does not exist on macOS); a piped `echo $?` reports the exit code of the
last command in the pipe, not `tsc`'s.

## What a drive owes this

I cannot drive the editor from this worktree. Everything below is unproven **in the running app**,
in rough order of risk:

1. 🔴 **The category label may not fit.** `Libraries & Browser` is 19 characters — the longest in
   this toolbox by four (`Inputs / Outputs` is 15). Nothing here has measured a category label
   against the pane width, and VFN-011's strip sentence was ellipsised for exactly this reason.
   **Measure it; if it clips, shorten the label, not the feature.**
2. **The first flyout open.** `BlocklyWorkspace` calls `refreshRegisteredLibraries()` at injection,
   long before a click, so in practice the category should already be `loaded`. If it says
   *"Reading this project's libraries…"* on a real project's first open, the eager refresh is not
   landing and the sequencing needs looking at. **The loading state is correct behaviour, not a
   bug — but seeing it in normal use means the eager read is not working.**
3. **A real registered library end to end.** Register one in Settings → Project → Libraries, build a
   program that reads it, run the preview, read the value off the node's output. Criterion 3 says
   *"reaches the library in the preview"* and only the generated string is proved.
4. **`window` reaching a browser global** — criterion 4, same shape. `window.location.href` in the
   preview.
5. ⚠️ **A stale mark**, inherited from §1: `getText_` reads the snapshot at render time and Blockly
   re-renders a field on *value* change. A block already on the canvas keeps its mark until it is
   touched or the editor is reopened. Stale in the harmless direction — the stored global is never
   wrong — but if it grates, a `forceRerender()` sweep when the snapshot transitions is the fix.
6. ⚠️ **Two Logic Builder windows open at once.** Each injection calls
   `setRegisteredLibrariesLoader`, which resets the snapshot to `unknown` and re-reads. The other
   window's category would briefly say *"reading…"*. Harmless, unmeasured, and the fix (skip the
   reset when the loader is equivalent) is worse than the symptom until somebody sees it.
7. **The `⚠` mark's legibility on a hue-355 block**, and the flyout's label contrast. §1 owes the
   same reading on hue 90; take both together.
8. **The *Open app settings* button** — `openSettingsPanel('project')`, the same helper §1 uses and
   the same one still never clicked.

## What is deliberately **not** here, and why

- **No per-runtime toolbox.** A library registered `['browser']` is offered inside a visual function
  that might run in a cloud function, because the block editor does not know which node it is
  editing on behalf of, let alone where that node will run. The block *says* which runtimes it
  covers; it does not hide itself. Hiding it would be a guess presented as a fact.
- **No enumeration of browser APIs**, per the task file — and for a second reason it does not give:
  `Object.keys(window)` answers with whatever *this renderer* happens to have and misses everything
  on `Window.prototype`, so a generated category would ship one machine's globals to every project.
  This register has already paid for treating `Object.keys` as a survey of an API.
- **No `RESERVED_CONFIG_KEYS` block** — still §1's open question, still unruled.
- **No library *stylesheets* surface.** `RegisteredLibrary.stylesheets` is read and normalised but
  there is nothing for a block to do with it. Left in the type rather than dropped so the tooltip
  can grow into it.
