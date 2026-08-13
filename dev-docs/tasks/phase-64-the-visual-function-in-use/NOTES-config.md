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
| 6 — empty category explains itself | contents **proved**; that Blockly *renders* `kind: 'label'` and `kind: 'button'` items in a dynamic category flyout is **not driven** |
| 7 — `cloud-library:check` | **proved** |

Specific things a drive should check, in rough order of risk:

1. **The flyout renders labels and a button.** The empty state and the category headings are
   `kind: 'label'`; *Open app settings* is `kind: 'button'` with `callbackkey`. The shape is right
   per Blockly's `ButtonOrLabelInfo`, but nothing here has rendered one.
2. **The button reaches the panel.** `openSettingsPanel('project')` — right helper, never clicked.
3. **The `⚠` mark's legibility on a hue-90 block.** Dark-on-dark is this repo's recurring defect.
4. ⚠️ **A stale mark.** `getText_` reads the provider at render time and Blockly re-renders a
   field on *value* change, not on app settings changing underneath it. A block already on the
   canvas keeps its mark until it is touched or the editor is reopened. Stale in the harmless
   direction — the *stored key* is never wrong, only the warning glyph is late — but if it grates
   in use, the fix is a `forceRerender()` sweep on the `appConfig` metadata event.
5. **A round trip through the runtime**: declare a variable, read it in a Visual Function, run the
   preview, read the value off the node's output.

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
