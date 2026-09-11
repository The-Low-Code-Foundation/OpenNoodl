# VFN-012 — The blocks the app already has

**Status:** ✅ **ALL THREE SECTIONS BUILT — nothing dropped.** §1 `96869d5f`; §2/§3 `69a13622` /
`a3556bd7` on `vfn-g-config`, merged `082e2c37` · ✅ **SPEC-PROVED** — 85 new specs for §2/§3, **8
negative controls watched red** · 🟡 **DRIVEN in part: §1's flyout renders its labels and button, and
*Open app settings* reaches the panel** (DRIVE-C). 🔴 **§2 and §3 have never been driven at all** ·
🔴 **OWED:** §1 items 3–5, all of §2/§3's eight, and above all — **measure the `Libraries & Browser`
label against the pane width** · **Tier 3** · no dependencies

> **2026-08-13, branch `vfn-g-config`.** §2 (**registered libraries**) and §3 (**`window`**) are
> now built and gated, on top of §1. **Nothing was dropped.** Write-up: the second half of
> [`NOTES-config.md`](./NOTES-config.md).
>
> - The layout question §1 refused to answer silently is **settled**: one new category,
>   **`Libraries & Browser`**, directly below `App Config`. §1's placement stands; the task file's
>   original `App & Browser` merge is not adopted, because re-siting a merged, driven feature is
>   churn. One category for §2 and §3 together, because both generate `window…`.
> - Two blocks. `noodl_library_global` → `window.<global>`; `noodl_window` → `window["a"]["b"]`.
>   No setter for either.
> - 🔴 **The library list is read off disk and is async, and a flyout callback is not.** So there
>   is a real window — the first tick of every session — in which the honest answer is *"I have
>   not looked yet"*. The snapshot is **tri-state** (`unknown` / `loaded` / `unavailable`); a
>   two-state cache would mark every library block `⚠` at the moment the editor opened. That is
>   *"an async injection sampled early looks like a disposal"* as a live defect, not a caution.
> - ⚠️ **The Logic Builder runs in the cloud runtime** (`noodl-runtime.ts:190`, not in the
>   `type !== 'cloud'` subtraction), where there is no `window` and no injected library. Both
>   blocks say so; `window.x` is left to throw rather than guarded into silence.
> - Gates: jest **178/2707** (was 175/2622 — +3 suites, +85 specs, nothing else moved),
>   `cloud-library:check` green, editor `tsc -p tsconfig.json --noEmit` 0 errors.
> - **Eight negative controls, each watched red** and the failing names read off the runner. The
>   one worth remembering: the `window` block is in *every* flyout, so an empty-state predicate
>   written the obvious way reports no empty state, ever.
> - ⚠️ **Nothing is driven.** Criteria 3 and 4 are proved as far as a headless runner reaches;
>   reaching the library and the browser global in the preview is not. 🔴 And the category label
>   `Libraries & Browser` is the longest in this toolbox and has never been measured against the
>   pane width.

> **2026-08-13, branch `vfn-config` — §1.** The **app-config-variables** half, built and gated.
>
> - Category is **`App Config`**, directly below `App Arrays`, where the report asked for it.
> - `App Variables` → **`Runtime Variables`**, label and locale strings only; both block type ids
>   asserted unchanged.
> - One block, `noodl_get_config` → `Noodl.Config["key"]`. No setter: config is immutable.
> - 🔴 **Blockly's stock `FieldDropdown` really does snap an unknown value to the first option**
>   (12.3.1, measured). A saved block reading a deleted config variable would silently start
>   reading a *different* one on open. `ConfigKeyField` overrides two methods to stop it, and a
>   spec builds a stock dropdown beside ours and watches it happen.
> - Gates: jest **159/2303** (was 157/2265, +2 suites/+38 specs), `cloud-library:check` green,
>   editor `tsc --noEmit` 0 errors.
> - ⚠️ **Nothing is driven.** Criteria 1, 5 and 6 are proved as far as a headless runner reaches;
>   the flyout rendering, the settings button and the runtime round trip are not.

## The report

> *"I think the 'global variables' from the app settings aren't in the block menu. Could we also add
> handy stuff like 'window' and any imported SDKs or libraries we've added at the app config?"*

## ⚠️ First, a naming collision that will cause a wrong fix

The toolbox already has a category called **App Variables**
([`BlocklyToolbox.ts:117`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/BlocklyToolbox.ts))
and **it is not the thing the report means.** It generates
([`NoodlGenerators.ts:125-137`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/NoodlGenerators.ts)):

```js
Noodl.Variables["name"]
```

— the *runtime* variables written by Variable nodes. Richard's "global variables from the app
settings" are the **app-config variables** edited in
[`VariablesSection.tsx`](../../../packages/noodl-editor/src/editor/src/views/panels/SettingsPanel/sections/VariablesSection.tsx),
which are a different thing entirely: declared, typed, immutable at runtime, and exposed as
`Noodl.Config`.

Three vocabularies with three lifetimes, and the toolbox currently names one of them in a way that
claims a second. **Renaming the existing category is part of this task**: `App Variables` →
**`Runtime Variables`** (or whatever survives review), so the new one can be `App Config` without the
two reading as the same shelf.

🔴 A category rename is copy, not a type id — the block types `noodl_get_variable` /
`noodl_set_variable` are in every saved project and **do not change**. Only the label and the locale
strings.

## The three sources, and what each can honestly offer

### 1. App config variables → a **read** block

```ts
export interface ConfigVariable {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'color' | 'array' | 'object';
  value: unknown;
  description?: string;
  category?: string;
}
```

[`config/types.ts:19-26`](../../../packages/noodl-runtime/src/config/types.ts), reachable as
`ProjectModel.instance.getAppConfig().variables` and already wrapped by
`getConfigVariables()`/`setConfigVariable()` on the model
([`projectmodel.ts:1198-1230`](../../../packages/noodl-editor/src/editor/src/models/projectmodel.ts)).

Generates `Noodl.Config["key"]`, which is a real, immutable API
([`viewer-react/src/api/config.ts`](../../../packages/noodl-viewer-react/src/api/config.ts) —
`Noodl.Config` is a flattened, frozen read of app config).

🔴 **Read only. There is no set block**, because there is no runtime setter — config is configuration.
Offering a `set` that silently did nothing would be the worst available shape.

**This is the one place in the phase where a dropdown is both possible and right.** Every other name
field in this language is a free `FieldTextInput`
([`NoodlBlocks.ts:328-350`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/NoodlBlocks.ts)),
because Noodl variables are created by being used. Config variables are *declared*, so the set of
valid keys is known, finite, and typed — a `FieldDropdown` over them is honest, and it turns "did I
spell it right" into a non-question.

⚠️ A dropdown must survive a key being renamed or deleted in app settings while the block exists.
Keep the stored value as the key string and render an unknown key **as itself, marked** — never
silently snap to the first valid option, which would change a program by opening it.

### 2. Registered libraries → a `window.<global>` block

```ts
export interface RegisteredLibrary {
  moduleName: string;
  displayName: string;
  global: string;        // ← the name the library installs on window
  dependencies: string[];
  stylesheets: string[];
  runtimes: string[];
  vendored: boolean;
}
```

[`projectmodules.ts:450-461`](../../../packages/noodl-editor/src/shared/utils/projectmodules.ts),
listed by `listRegisteredLibraries()` and edited in
[`LibrariesSection.tsx`](../../../packages/noodl-editor/src/editor/src/views/panels/SettingsPanel/sections/LibrariesSection.tsx).

A dropdown over the registered libraries' `global` names, generating `window.<global>` as a value
block. That single block plus the existing member-access shape is enough to reach a library's API.

⚠️ `runtimes` matters: a library registered for the browser is not present in a cloud function. The
block is offered where it exists and the flyout says which runtimes it covers.

> **Built 2026-08-13.** Two things this section did not anticipate, both of which decided the code:
>
> 1. 🔴 **`listRegisteredLibraries` is async and a flyout callback is not.** The whole tri-state
>    snapshot exists because of this. §1 had no equivalent — `getConfigVariables()` is synchronous.
> 2. 🔴 **"Offered where it exists" is not implementable.** The block editor does not know which
>    node it is editing on behalf of, let alone where that node will run, so there is no per-runtime
>    toolbox. The block is offered everywhere and *says* which runtimes it covers. Hiding it would
>    be a guess presented as a fact.
>
> Also: a library registered with **no `global`** is real and cannot be read. It is named in the
> flyout with what to do about it rather than dropped.

### 3. `window` → one escape hatch, deliberately blunt

One value block: `window`, with a text field for a property path, generating `window["a"]["b"]`.

That is the whole feature. Resist the temptation to enumerate browser APIs into a category — the
category would be enormous, permanently incomplete, and would read as an endorsement of whatever
happened to be in it. `window` plus the existing blocks is a complete escape hatch, and a Function
node is right there for anything more.

> **Built 2026-08-13, exactly as written**, plus a second reason not to enumerate that this section
> does not give: **`Object.keys` is not a survey of an API.** `Object.keys(window)` answers with
> whatever *this renderer* happens to have and misses everything on `Window.prototype`, so a
> generated category would ship one machine's globals to every project. This register has already
> paid for that mistake once in this phase.
>
> 🔴 Two things found in the building:
>
> - **A pasted `window.` prefix.** The block reads `🌐 window.` + field and an author will still
>   paste the whole path in. The naive parse gives `window["window"]["location"]["href"]`, which
>   **works**, because `window.window === window` — so a value-based test would pass forever and the
>   parse would stay broken until the first path whose head is not self-referential. One leading
>   `window` is stripped, and the spec asserts the *string*, against the exact string the bug emits.
> - **`window` does not exist in a cloud function**, and the Logic Builder runs there. It is left to
>   throw a `ReferenceError`: a `typeof window` guard turns a wrong program into a silently empty
>   one, and `globalThis` would quietly succeed against something that is not a browser window.

## Where they go in the toolbox

> 🔴 **Superseded by what was built, 2026-08-13.** The single `App & Browser` category below is
> **not** what shipped. §1 put `App Config` beside `App Arrays`, where the report asked for it, and
> merged; §2/§3 went into a second category, **`Libraries & Browser`**, directly below it. Two
> categories, not one, because re-siting a merged and driven feature to satisfy a layout sketch is
> churn. The rest of this section — dynamic, and the empty state — held and was built as written.

A new category — **`App & Browser`**, or similar — below the Noodl seam categories and above the
stock Blockly ones, with three sub-groups. It is dynamic like `VARIABLE`, `PROCEDURE` and `MY_BLOCKS`,
because its contents change whenever app settings change, and Blockly rebuilds a `custom` category on
every flyout open.

Empty state matters here more than usual: a project with no config variables and no libraries must
say *what to do to have some* and where — that is the only signpost from the block editor back to
app settings.

## Acceptance criteria

1. 🟡 A config variable declared in app settings appears in the category, and its block generates
   `Noodl.Config["key"]` that reads correctly in the running app.
   — *category projection and generated string proved; the reading-in-the-app half needs a drive.*
2. ✅ Renaming or deleting a config variable leaves existing blocks holding the old key, visibly marked,
   and changes no program. — *proved headless, with Blockly's own snapping behaviour as the control.*
3. 🟡 A registered library appears with its `global`, and its block reaches the library in the preview.
   — *the projection, the dropdown, the marked-when-removed rule and the generated `window.<global>`
   are proved, including against an in-flight scan; **reaching it in the preview needs a drive**.*
4. 🟡 The `window` block reaches a browser global.
   — *the path grammar and the generated `window["a"]["b"]` are proved, including that a pasted
   `window.` prefix is stripped and that nothing typed in the field can escape the expression;
   **reaching a real global needs a drive**.*
5. 🟡 The existing `App Variables` category is renamed and **no block type id changed** — an old project
   opens with identical `workspace` and `generatedCode` bytes.
   — *renamed; type ids asserted unchanged for `Runtime Variables`, `App Objects` **and**
   `App Arrays`; the byte diff on a real old project not done.*
6. 🟡 Empty categories explain themselves and name where to go.
   — *contents proved, and for §2 in **three** states rather than two — "not read yet", "there are
   none" and "could not be read" are told apart, with a spec asserting exactly one holds. That
   Blockly renders label/button items in a dynamic flyout is still not driven.*
7. ✅ ⚠️ `npm run cloud-library:check` passes — it is a required PR gate and drifts red on port-group
   changes.

## How to prove it

Generator specs in the plain-Node runner: each new block type in, expected JavaScript out, including
the unknown-key case.

A drive for the round trip: declare a config variable, build a program that reads it, run the preview,
and read the value out of the node's output. Verify the consequence in the app, not that the generator
emitted a string.

🔴 Then reopen an old project and diff `project.json` for criterion 5. A category rename that touched
a block type would be invisible until someone's program stopped loading.
