# VFN-003 — The dialog Electron does not have

**Status:** ✅ **BUILT** (`0067304d`, `d9f41d20`) · ✅ **SPEC-PROVED** (10 specs) · ✅ **DRIVEN
2026-08-13 — criteria 1, 2, 3, 5 pass; 4 passes at the seam** · 🔴 **OWED:** the full *delete a
variable in use* gesture · **Tier 1**

> ## ✅ Driven 2026-08-13. The silence is gone, and the control proves it was there.
>
> ### The negative control first, because it is what makes the rest mean anything
>
> Blockly's documented default was re-registered for one click —
> `setPrompt((m, d, cb) => cb(window.prompt(m, d)))` — and *Create variable…* was clicked:
>
> ```
> dialogs: []        variables before=["score","item"]  after=["score","item"]
> ```
>
> ✅ **Nothing opened and nothing was created.** That is the reported bug, reproduced on demand, and
> it establishes that the dialog seen below is ours rather than something that was always there.
>
> ### Criterion 1 ✅
> One click → **exactly one** dialog card. Typed `score`, Enter: variable created, and the **flyout's
> own workspace** (not the main one) then contained `["variables_set", "math_change",
> "variables_get", "math_number"]` — both `get` and `set`.
>
> ### Criterion 2 ✅
> Cancel and Escape each created nothing, and **no empty-named variable exists** after either — the
> `callback(null)` ≠ `callback('')` distinction holds where it can be observed.
>
> ### Criterion 3 ✅
> `Variables.renameVariable` opened our themed dialog; renamed `score` → `points`; the
> `variables_get` block bound to it re-labelled itself to `points` in the same gesture.
>
> ### Criterion 5 ✅
> Duplicate name submitted. `"A variable named 'counter' already exists."` shown on our own surface,
> **no** duplicate created, and after clicking the alert's OK the **prompt re-opened** — so Blockly's
> `alert(msg, () => d(g))` callback fires and the gesture continues instead of ending.
>
> ### Criterion 4 ⚠️ proved at the seam, not through the full gesture
> `Blockly.dialog.confirm` was called directly: the eval **returned in 2ms** (a native `confirm()`
> would not have returned at all), rendered `"Delete 1 use of the variable "points"? | Cancel |
> Confirm"` as an in-app card, and honoured the contract — **accept → `callback(true)`,
> cancel → `callback(false)`**. That is the single seam all four gestures route through.
> 🔴 **The "delete a variable that is in use" gesture itself was not driven** — `deleteVariableById`
> bypasses the confirm, so a caller-level drive is still owed.
>
> ### 🔴 Instrument warning, which cost this drive about an hour
> `BaseDialog` renders its children **twice**: a zero-height `MeasuringContainer` plus the visible
> `ChildContainer`. So `document.body.innerText` reports every dialog's text **twice**, and every
> button exists twice with the phantom copy **above** the real one — a click at its centre lands on
> a `<p>` and does nothing. Three separate "the prompt did not re-open" readings in this session were
> that, not a defect. Filter with `:not([class*=MeasuringContainer])` and hit-test with
> `elementFromPoint` before every click. The same trap produced VFN-007's actual defect.
>
> ⚠️ **Do not instrument by wrapping `Blockly.dialog.prompt`.** `B.dialog.prompt` is the public
> dispatcher; calling it from inside a replacement `setPrompt` recurses and kills the button, which
> reads exactly like the bug being fixed.

> **What landed.** Two modules, not one:
> [`blocklyDialogHandlers.ts`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/blocklyDialogHandlers.ts)
> holds the callback contract with no React in it, so all three registered functions can be
> asserted headlessly — which is what the *How to prove it* section asks for and what a single
> `.tsx` module would have made impossible. [`BlocklyDialogs.tsx`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/BlocklyDialogs.tsx)
> is the surface: a prompt dialog, a one-button alert dialog, and `DialogLayerModel.showConfirm`
> for the confirm. 10 specs in `tests-unit/vfn-003/`, including the whole
> prompt → taken → alert → re-prompt → accepted gesture.
>
> 🔴 **Registered from `BlocklyWorkspace`, not from `initBlocklyIntegration()`.** The task said
> the latter, and doing it there **broke two `tests-unit` suites to run**: `initialize.ts` is
> deliberately reachable from the plain-Node runner (LGC-007's inliner and save specs import it
> for the block definitions), and a `@noodl-core-ui` import anywhere in its graph fails them
> before a test executes. `BlocklyWorkspace` is React already, is the only thing that injects a
> workspace, and runs ahead of anything that could prompt.
>
> ✅ **Ephemeral focus is handled**, per Blockly's own warning on `setPrompt`: the dialogs take
> `getFocusManager().takeEphemeralFocus(...)` while open, or the `FocusManager` takes focus
> straight back off the text field.
>
> 🔴 **Not driven.** The failure being fixed is *silence*, and a spec cannot see silence —
> criteria 1–5 need the drive described below.

## The report

> *"Clicking 'create variable' does nothing."*

## The mechanism

The Variables category is one of Blockly's dynamic categories
([`BlocklyToolbox.ts:186`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/BlocklyToolbox.ts)):

```ts
{ kind: 'category', name: labels.variables, colour: HUE.blocklyVariables, custom: 'VARIABLE' },
```

Blockly fills that flyout itself, and the button at the top of it calls
`Blockly.Variables.createVariableButtonHandler`, which asks for the name through `Blockly.dialog.prompt`.

**Nothing in this repo ever replaces that implementation.** `grep -rn "setPrompt\|Blockly.dialog"` over
`views/BlocklyEditor/` returns nothing. So Blockly falls through to its own default, which is the
only `window.prompt` in the entire bundle:

```js
defaultPrompt = function (a, b, c) { c(window.prompt(a, b)) }
```

**Electron renderers do not implement `prompt()`.** The call does not open anything and does not
return a name; the callback receives nothing and the handler returns without creating a variable.
Silently — nothing throws, and there is no toast, which is why it reads as a dead button.

### It is not only Create variable

Everything that routes through the same three functions is dead or degraded the same way:

| Gesture | Route | State |
|---|---|---|
| **Create variable** (Variables flyout) | `dialog.prompt` | 🔴 dead |
| **Rename variable** (right-click a variable block) | `dialog.prompt` | 🔴 dead |
| **Delete N uses of a variable** | `dialog.confirm` | ⚠️ works — Electron implements `confirm()` — but as a native OS sheet with no theme |
| Blockly's own error/notice paths | `dialog.alert` | ⚠️ same |

**All four are fixed by one seam.** Doing only Create variable would leave Rename dead and would be
a fix that a builder discovers is partial.

## The fix

One module — `views/BlocklyEditor/BlocklyDialogs.ts` — registered from `initBlocklyIntegration()`
([`initialize.ts`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/initialize.ts)),
idempotent like every other Blockly registry call in this directory:

```ts
Blockly.dialog.setPrompt((message, defaultValue, callback) => { … });
Blockly.dialog.setConfirm((message, callback) => { … });
Blockly.dialog.setAlert((message, callback) => { … });
```

Each renders through `DialogLayerModel.instance` — `showConfirm` already exists for the confirm and
alert cases, and the prompt needs one small dialog with a `TextInput` and the UIX-004 button order
(cancel left, primary right).

### 🔴 Three things the callback contract will not forgive

0. ✅ **And one the *implementation* will not forgive, found by reading `createVariableButtonHandler`
   in source:** the **alert's** callback is what re-opens the prompt when a name is taken —
   `alert(msg, () => d(g))`. An alert that dismisses without calling back does not skip a message,
   it ends the whole gesture. That is criterion 5's mechanism, and it is Blockly's, not ours.
1. **`callback(null)` on cancel, never `callback('')`.** Blockly reads `null` as "the user backed
   out" and an empty string as "the user named it that", and the second creates a variable with no
   name. This is the same `undefined` ≠ `""` distinction the generate seam already learned the
   expensive way in LGC-007 — the same shape, in a different costume.
2. **The callback must be called exactly once, and asynchronously is fine.** Blockly's handlers are
   written for an async dialog. Calling it twice creates two variables; never calling it leaves the
   flyout in a state that looks like this bug.
3. **Escape and the backdrop must both cancel**, and cancel means (1).

### The dialog lives inside the block editor's world

⚠️ The Logic Builder window carries `data-keyboard-scope="logic-overlay"`, so while focus is inside
it, **no editor command runs and Escape is not turned into a blur** — the surface owns it. A dialog
opened from inside the window and portalled to `.dialog-layer-portal-target` is *outside* that
subtree, so its Escape handling is its own. Handle Escape on the field, exactly as
[`MyBlocksSaveDialog.tsx:131-136`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/MyBlocksSaveDialog.tsx)
already does, and for the reason stated there.

⚠️ **Not core-ui's `Select`, if a picker is ever added here.** It portals into the same
`z-index: 666` target as the dialog itself and paints behind it. The same note is on the save dialog.

## Acceptance criteria

1. Variables → *Create variable…* opens a themed dialog, accepts a name, and the variable appears in
   the flyout with its `get`/`set` blocks.
2. Cancel and Escape both create nothing.
3. Right-click a variable block → *Rename variable…* renames it, and every block using it updates.
4. Deleting a variable that is in use asks through the same themed surface, not a native sheet.
5. A name that is already taken is refused **in place**, with the dialog left open — the same rule
   the save dialog holds: a refusal that closes the dialog is a refusal that does not say so.

## How to prove it

Specs against the three registered implementations directly — they are plain functions taking a
callback, so `setPrompt`'s registered fn can be invoked headlessly and its callback argument
asserted: `null` on cancel, the trimmed string on accept, called exactly once in both.

Then a drive, because the failure being fixed is *silence* and a spec cannot see silence: open the
Variables category, click the button, assert a dialog element exists in the DOM, type, accept, and
assert the flyout now contains a `variables_get` block.

⚠️ A flyout is a separate Blockly workspace — `Workspace.getAll()` includes it. Query the flyout's
own workspace for the block rather than the main one, or the assertion answers about the wrong
surface.
