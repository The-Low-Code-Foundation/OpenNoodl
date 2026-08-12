# NOTES — LGC-007's save UI, built 2026-08-12 on `lgc007-ui`

**Status:** built and specced, **not driven**. Commits `9c701e5e`, `e4fad0e7` on branch
`lgc007-ui` (based on `cline-dev` at `7b5c0d3e`).

This is the note for whoever drives it and whoever merges it. The task file
[`LGC-007-MY-BLOCKS.md`](LGC-007-MY-BLOCKS.md) has been updated in place; this file holds the
things that do not belong in a spec: what a user's hands actually do, what the task file got
wrong, and what I could not verify.

---

## 1. The path a user takes, end to end

1. Open a Logic Builder node's block editor (double-click the node, or *Edit blocks*).
2. **Right-click the top block of the group** you want to keep. The menu shows **Do It** and,
   directly under it, **Save as a block…**.
3. The dialog says how many blocks are coming, what shape the result will be — *"These 3 blocks
   become a value block"* — what that lets you do (*"You can drop it into a calculation"*), why
   (*"Because it produces one value and changes nothing"*), and what sockets it will have.
4. Type a name. Pick a shelf: **This project** (default) or **My backpack**. Press **Save**.
5. A toast says where it went. The definition is in `project.json` under
   `settings['myBlocks.library']` — `setSetting` fires `settingsChanged`, which is on
   `projectSaveTriggers`, so the normal autosave writes it.
6. Open **any other** Logic Builder node in the same project. Its toolbox has a **My Blocks**
   category, last, and the saved block is in it.
7. Drag it out. It generates the inlined body, with no runtime cost and no round trip.

## 2. 🔴 Three things the task file gets wrong about the current code

### 2a. "Select blocks → Save as a block" describes a gesture this editor does not have

§1's opening line, and the My Blocks empty state that shipped with the engine
(*"Select some blocks, right-click and choose Save as a block"*), both assume multi-select.
**Blockly 12 core has no multi-select.** One block is selected at a time;
`@blockly/plugin-workspace-multiselect` is the thing that adds it, it is not installed, and it
cannot be installed in a worktree.

So the gesture is **one right-click on the top block**, and everything inside it and stacked
below it comes with it — which is exactly how Blockly's own *Duplicate* behaves, so it is the
behaviour a builder already has a model for. Two consequences, both built:

- the empty state now describes the real gesture;
- the dialog shows the **block count**, because a right-click landing mid-stack silently takes
  the rest of the stack, and there is otherwise no way to see that before committing.

`bodyFromBlocks` still takes an array and still filters to roots, so a multi-select plugin can
feed it later with no rewrite.

### 2b. A spec **can** reach the two-workspace case

Deferred verification item 4 says the flagship criterion "is the one a spec cannot reach,
because `BlocklyWorkspace` injects on mount and disposes on unmount keyed by node id — the two
workspaces are never alive together".

That is true of the *editor* and it is not a constraint on *Blockly*. What links the two Visual
Functions is the **store**, and two headless workspaces are two objects.
`tests-unit/lgc-007/saveAsBlock.test.ts` therefore runs the whole round trip: the real menu
item's `callback` in workspace A → a fake dialog that names and commits → the **real flyout
callback** asked what the toolbox offers → that JSON instantiated as a **real block** in
workspace B → `generateWithMyBlocks` → the exact JavaScript. Three shapes: a value block dropped
inside `… + 1`, a statement block stacking on its own, and a one-parameter block with an
argument dropped into its socket.

⚠️ It does **not** replace the drive. It proves the wiring, not the gesture — see §4.

Incidentally this is the first time `rebuildInputs_` has run anywhere, which closes the specific
`removeInput` failure the task file flagged as "the first time that code runs" — **headless**,
where `removeInput` has nothing to unrender. A rendered workspace is still owed.

### 2c. The hat cannot go inside a saved block, and nothing said so

LGC-009's hat has no `previousConnection` and no output plug — that is its whole job. A
definition rooted at one could not be spliced anywhere: the inliner would hand Blockly a hat
under a `next` connection, which is a workspace Blockly refuses to load. Right-clicking the hat
and choosing *Save as a block* is a completely plausible gesture (it is the top of the stack,
and saving "the whole program" is a thing people try), so the item is **disabled with the reason
in the label** rather than hidden — the rule Do It's menu item already states at length.

## 3. ⚠️ One trap avoided by reading, not by a spec

The shelf picker was core-ui's `Select` for about twenty minutes. `Select` renders its option
list through `BaseDialog`, which portals into `.dialog-layer-portal-target` — a `document.body`
sibling at `z-index: 666`, **exactly the same z-index as the DialogLayer the save dialog lives
in**. On a tie the later DOM element wins, and the portal target is created first, so the option
list would have painted *behind* the dialog. `ReportProblemDialog` hit this and dropped to a
native `<select>`; see its `NativeSelect` comment and `ALPHA-007-NOTES.md`.

It is now two radio rows, which is better anyway: the difference between the shelves is the
sentence beside each option, and a collapsed dropdown hides that until after the choice.

🔴 **This is a live core-ui defect and it outlives this task.** Any dialog shown through
`DialogLayerModel` that wants a `Select` has the same problem. Two dialogs have now worked
around it independently.

## 4. What I want driven, precisely

The block editor opens from an `EventDispatcher` event, so no canvas gesture is needed for
setup — the payload is the one `LogicBuilderWorkspaceType.onEditBlocksClicked` emits:

```js
EventDispatcher.instance.emit('LogicBuilder.OpenTab', { nodeId, nodeName, workspace })
```

⚠️ Everything below needs a **real right-click**, because the context menu is the surface under
test. `cdp click` races the layout (register entry), so take a screenshot after opening the menu
rather than asserting on the DOM alone.

| # | Drive | Pass |
|---|---|---|
| D1 | Right-click a `math_arithmetic` block in a Logic Builder node | The menu shows **Do It** first and **Save as a block…** second, above *Duplicate* |
| D2 | Right-click the **hat** | *Save as a block — the start block cannot go inside a saved block*, **greyed, not missing** |
| D3 | Choose *Save as a block…* on `n ÷ 2` | The dialog paints, the name field has focus, the placeholder is a rendering of the block, and the shape card reads *"These 3 blocks become a value block"* |
| D4 | Open the shelf picker | 🔴 **Both radio rows are visible and clickable.** This is the z-index question from §3 — it is the one thing in this dialog I could not check without a renderer |
| D5 | Name it `Half`, leave the shelf on *This project*, Save | Toast appears; `project.json` gains `settings["myBlocks.library"]` with one definition, `shape: "value"` |
| D6 | Open the **My Blocks** category in the same node | The saved block is there, with an output plug and no sockets |
| D7 | Open a **second** Logic Builder node in the same project, open **My Blocks** | 🔴 **The flagship.** The block is there too. Drag it into `… + 1` under a `set output`, let the 300 ms debounce settle, and read the second node's `generatedCode` parameter: it should contain the inlined body, not a call |
| D8 | Drag a **statement**-shaped saved block at the `A` socket of a `math_arithmetic` | It does not snap. (§1's "and cannot", acceptance criterion 2) |
| D9 | Save with an empty name | The Save button is disabled; typing then clearing shows *"Give it a name…"* |
| D10 | Save a name that already exists | It is **allowed**, with a warning line under the field. Identity is a uid; a name collision is cosmetic by design |
| D11 | Right-click a block **mid-stack** and save | The dialog's block count includes the blocks below, and the saved body starts at the clicked block |

Also worth a look while there, because nothing proves it headlessly: the dialog's own layout at
a narrow editor width, and whether the toast reads sensibly over the block editor.

## 5. Could not verify

- **Anything that needs a DOM.** The runner is `testEnvironment: 'node'`. The dialog renders no
  spec: not its layout, not the autofocus, not the disabled Save button, not the radio rows,
  not the toast. Its *decisions* are specced (`myblocks/saveIntent.ts`, 16 specs) and its
  *inputs* are specced (`MyBlocksSave.ts`, 18 specs); the pixels are not.
- **That the context menu item appears in a rendered menu.** The registry entry is asserted —
  precondition, label, weight, callback — against the real `Blockly.ContextMenuRegistry`. That
  Blockly then draws it is D1.
- **Escape and Enter.** Both are wired on the name field (Blockly's shortcut registry ignores
  key events whose target is an input, so the field is the only handler that sees them). Not
  driven.
- **`refreshMyBlocksFlyout`.** It exists for the case where the My Blocks flyout is *already
  open* when a save lands. Duck-typed, no-ops headless, and never exercised.
- **`npx tsc --noEmit` is clean and that means very little.** `strictNullChecks` is off
  repo-wide. It confirms the core-ui prop names and the imports resolve. It confirms nothing
  about nullability.

## 6. Deliberately not built — say so rather than let it be assumed

| | Why |
|---|---|
| §4's regeneration sweep | Ruled unauthorised. Not touched. |
| Export / import file pickers | Store functions built and specced since 2026-08-12; the pickers are deferred. |
| The delete dialog's inline-and-detach offer | `MyBlocksInUseError` and `detachDefinition` both exist and are specced. **There is still no dialog that offers the choice**, and now that definitions can be created from the UI, this is the first gap a real user will reach — a saved block can be made but not unmade from the editor. |
| `@blockly/workspace-backpack` | Cannot be installed in a worktree. The retrieval surface is our own toolbox category, which is what §2 needed anyway. |
| The project shelf beside components in the sidebar | §2's second half. Not built. |
| Replacing the saved blocks with a call block after saving | Scratch's backpack does not, §1 does not ask for it, and it would be the first destructive thing this feature does. Worth deciding deliberately rather than as a tail. |
| α-renaming per expansion | Known limitation, register L45, unchanged. |
