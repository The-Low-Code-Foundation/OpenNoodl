# VFN-012 — The blocks the app already has

**Status:** 📋 open · **Tier 3** · ~1 day · no dependencies · scope can be cut cleanly

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

### 3. `window` → one escape hatch, deliberately blunt

One value block: `window`, with a text field for a property path, generating `window["a"]["b"]`.

That is the whole feature. Resist the temptation to enumerate browser APIs into a category — the
category would be enormous, permanently incomplete, and would read as an endorsement of whatever
happened to be in it. `window` plus the existing blocks is a complete escape hatch, and a Function
node is right there for anything more.

## Where they go in the toolbox

A new category — **`App & Browser`**, or similar — below the Noodl seam categories and above the
stock Blockly ones, with three sub-groups. It is dynamic like `VARIABLE`, `PROCEDURE` and `MY_BLOCKS`,
because its contents change whenever app settings change, and Blockly rebuilds a `custom` category on
every flyout open.

Empty state matters here more than usual: a project with no config variables and no libraries must
say *what to do to have some* and where — that is the only signpost from the block editor back to
app settings.

## Acceptance criteria

1. A config variable declared in app settings appears in the category, and its block generates
   `Noodl.Config["key"]` that reads correctly in the running app.
2. Renaming or deleting a config variable leaves existing blocks holding the old key, visibly marked,
   and changes no program.
3. A registered library appears with its `global`, and its block reaches the library in the preview.
4. The `window` block reaches a browser global.
5. The existing `App Variables` category is renamed and **no block type id changed** — an old project
   opens with identical `workspace` and `generatedCode` bytes.
6. Empty categories explain themselves and name where to go.
7. ⚠️ `npm run cloud-library:check` passes — it is a required PR gate and drifts red on port-group
   changes.

## How to prove it

Generator specs in the plain-Node runner: each new block type in, expected JavaScript out, including
the unknown-key case.

A drive for the round trip: declare a config variable, build a program that reads it, run the preview,
and read the value out of the node's output. Verify the consequence in the app, not that the generator
emitted a string.

🔴 Then reopen an old project and diff `project.json` for criterion 5. A category rename that touched
a block type would be invisible until someone's program stopped loading.
