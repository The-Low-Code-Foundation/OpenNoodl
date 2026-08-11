# LEG-005 — a comment you can only add by right-clicking is a comment nobody adds

**Status:** 📋 open · **Est. 2 d** · **Track: the read path** · pairs with **LEG-001**

## The correction this task is built on

The README says the comment should be *"surfaced as a first-class row at the top of the property
panel, not buried"*. Read in source, it is not buried in the property panel. **It is not in the
property panel at all.** `grep -rn comment` over
[`views/panels/propertyeditor/`](../../../packages/noodl-editor/src/editor/src/views/panels/propertyeditor/)
returns two hits, both unrelated code comments inside list inputs.

What exists, all of it CAN-004's and all of it good:

- a **gutter stripe** in the node titlebar when a comment exists
  ([`NodeGraphEditorNodePainter.ts:302`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorNodePainter.ts));
- a **hover tooltip** that reads it, ranked below node health so a broken node still speaks first
  ([`NodeGraphEditorNode.ts:240-249`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorNode.ts));
- a **context-menu item**, single-select, opening a multiline `StringInputPopup`
  ([`NodeContextMenu.ts:186-195`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeContextMenu.ts)).

Its own source comment states the design, and the design is coherent:

> Reading a comment is not here — hovering the node shows it, which is cheaper than any menu — and
> neither is removing one, because submitting the popup empty already clears it.

**So this task is not a rescue. It is the missing entry point.** Every affordance above is
*conditional on a comment already existing* or *conditional on right-clicking to find out*. There is
nowhere in the editor that a comment's absence is visible, and the measurement says the absence is
total: zero comments in 5,509 nodes across this repo, one in 2,045 agent-authored nodes.

## §1 — The lesson this inherits, by name

**ACC-007: a port at `index: 1000` is a port nobody finds.** Alt text was shipped, correct, and
placed at the bottom of a long list, and the result was indistinguishable from not shipping it.

A context-menu item is `index: 1000` with extra steps. It is invisible until invoked, it is
invisible to anyone who has not been told, and it is invisible to the person this whole phase is
for — *the non-engineer maintaining what the agent built*, who is reading a graph, not authoring one.

## §2 — The row

An always-present row in the property panel for the selected node, **above the ports**, showing the
comment when there is one and an empty affordance when there is not.

Four things decide whether it works:

1. **Present when empty.** This is the entire point. A row that appears only when a comment exists
   teaches nobody that comments exist, and reproduces the context menu with more pixels.
2. **Above the ports, below the label.** The order of the panel is a claim about importance. *What
   this is* then *why it is* then *what it is wired to*.
3. **Multiline, and it must actually commit.** ⚠️ Two live traps here, both measured in this repo:
   `TextArea.onEnter` is **Shift+Enter** while `TextInput.onEnter` is plain Enter — same prop name,
   different keys, and `tsc` cannot tell them apart. And `el.value = x` does **not** drive a
   controlled React input; a headless check must use the native setter. Whichever control this uses,
   drive it and watch the model change, do not read the DOM and infer.
4. **Undo, through the existing path.** `setComment(comment, { undo: true, label: … })` already does
   this. ⚠️ Use it — do not hand-roll an `UndoActionGroup`, and if one is ever needed use
   `pushAndDo`, because `push()` then `do()` runs nothing in this codebase.

## §3 — What the row is for, which is what its placeholder should say

The README's example is the right one and worth keeping verbatim: a *décret* citation, or
*"disabled for auto-entrepreneurs because…"* — the external rule the graph cannot state and the next
maintainer cannot infer. The placeholder is the only copy most users will read about this field, so
it should name that use, not say *"Add a comment"*.

Keep it consistent with LEG-001 §4's description text. Two surfaces describing the same field
differently is the divergence `authoringVocabulary.ts` exists to prevent, and it is a documentation
bug the parity spec cannot catch because one of the two is a placeholder.

## §4 — What this task does not do

- **It does not touch the stripe or the tooltip.** They work, they were designed together, and the
  titlebar has no free horizontal room at a fixed 150px card width — which is *why* the stripe is a
  stripe and not a glyph. Do not re-litigate it.
- **It does not add multi-select editing.** The popup is titled for one node and writes one node's
  model; the panel is a single-node surface. A bulk comment is a different feature and probably a
  bad one.
- **It does not add a comment column anywhere else.** One entry point, findable, is the deliverable.

## Acceptance

- Selecting any node shows the comment row **whether or not the node has a comment**, above the
  ports and below the label.
- Typing into it and committing writes `metadata.comment`, repaints the gutter stripe without a
  reselect, and one undo removes it — **driven in the running editor**, with the model read back,
  not inferred from the DOM.
- Clearing the row removes the key and the stripe, matching the popup's existing empty-submit
  behaviour exactly. Two ways to clear that behave differently is worse than one way.
- ⚠️ **Contrast is measured, not eyeballed**, in both themes, printing foreground and background
  hex with every ratio. Placeholder text is the row most likely to fail this, because a dimmed
  placeholder is the standard way to lose AA and opacity cannot dim and stay legible.
- Save, close, reopen: the comment is still there. (LEG-001's round trip, asserted again here
  because this is the surface a human will use to notice it is gone.)

## Register

| # | Finding | State |
|---|---|---|
| L10 | The comment is **not in the property panel at all** — the README's "buried" premise is wrong. It is a context menu item plus a hover tooltip, both CAN-004's, both conditional on already knowing | ⚠️ corrected |
| L11 | ACC-007 precedent: a shipped, correct affordance placed where nobody looks measures the same as an unshipped one | ⚠️ standing |
| L12 | The row must render when **empty**. A conditional row teaches nothing and is the context menu again | 📋 the design |
| L13 | `TextArea.onEnter` is Shift+Enter, `TextInput.onEnter` is plain Enter, and `el.value = x` does not drive React. Both cost a session before | ⚠️ driving traps |
