# CAN-004: Node Comments You Can Find

## Metadata

| Field | Value |
|-------|-------|
| **ID** | CAN-004 |
| **Phase** | Phase 28 — Canvas Legibility & Authoring Intent (Track M) |
| **Tier** | 1 — independent, ships alone |
| **Priority** | 🟠 High (carries a shipped overlap defect, F50) |
| **Difficulty** | 🟢 Low — one painter change, one menu entry, one deletion |
| **Estimated Time** | 2–3 days |
| **Prerequisites** | None |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🟢 **Sonnet 5** — the placement decision is made below; what remains is mechanical, and the geometry is fully specified |

## Objective

Make it possible to see **at a glance, across a whole graph, which nodes carry a comment** — without
hovering, and without stealing any of the node title's already-tiny width. Move comment editing to the
right-click menu, and let hovering read the comment without opening anything.

## Background

Node comments are real and complete: [`NodeGraphNode.getComment/setComment`](../../../packages/noodl-editor/src/editor/src/models/nodegraphmodel/NodeGraphNode.ts#L627-L660)
store free text at `metadata.comment`, serialize with the node, and support undo. The editing popup
([`showCommentEditPopup`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorNode.ts#L576-L607))
works. The problem is entirely in how the indicator is presented.

### The space audit — there is no free horizontal room in the titlebar

Card width is **fixed at 150px**. `measure()` sets `size.width = NodeGraphEditorNode.size.width` and
never modifies it ([`NodeGraphEditorNode.ts:389-392, 480`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorNode.ts#L389-L392));
only height varies. So the titlebar budget is a constant:

| Region | Extent (from card left edge) | Width |
|---|---|---|
| Header chip (category glyph) | 7 → 29 | 22px |
| *gap* | 29 → 37 | 8px |
| **Title text wrap allowance** | 37 → 118 (with node icon) / 37 → 130 (without) | **81px / 93px** |
| Node icon, when present | ≈124 → 140 | 16px |
| Connection drag area (reserved) | 140 → 150 | 10px |

Title allowance is `width − headerTextInset(37) − horizontalSpacing(10) − connectionDragAreaWidth(10) − iconOffset(12 if icon)`,
and that same expression appears twice — in the painter at
[`NodeGraphEditorNodePainter.ts:251-255`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorNodePainter.ts#L251-L255)
and in the measurer at [`NodeGraphEditorNode.ts:315-320`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorNode.ts#L315-L320),
which must stay in agreement (the code says so, twice).

Now place the comment glyph. It is 14px at
`x + width − connectionDragAreaWidth(10) − 14 − (node.icon ? 30 : 10)`:

- **with** a node icon → spans **96 → 110**, and the title is allowed to wrap out to 118
- **without** → spans **116 → 130**, and the title is allowed to wrap out to 130

In both cases the glyph sits **inside the title's own text region**, and nothing subtracts it from
either width computation. That is **F50**: a node with a long enough title draws text underneath the
speech bubble. It is not a hypothetical — the title budget is 81px, which a two-word name exceeds.

So any persistent 14px glyph in the titlebar must either overlap the title (today's bug) or steal
~20px from an 81px allowance and reflow the title the moment a comment is added.

### The decision: a left-edge gutter stripe

**A 3px vertical bar down the card's left edge, spanning the titlebar, painted only when the node has a
comment.** No glyph.

| Why | |
|---|---|
| **Costs zero title width** | The chip starts at x+7; the region x → x+3 is genuinely unused. This is the only placement that solves F50 rather than trading against it. |
| **Scannable** | It is the ask: a whole graph's commented nodes read at once, no hovering. |
| **Survives zoom-out** | A solid 3×36 bar still reads at scales where a 1.5px-stroke speech bubble is mush. Wire-label legibility at low zoom is the same problem WFA-004 solved with a chip background. |
| **Deletes code** | Editing moves to the context menu, so `commentIconBounds`, its hit test and its click path all go. |
| **Free corner rounding** | The painter already clips to a rounded rect at [`:166-167`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorNodePainter.ts#L166-L167), so a plain rect at the left edge inherits the card's corner radius. |

A stripe alone is ambiguous about *what* it marks, so it is paired with hover-to-read (§3). Between them
the user learns which nodes have comments without hovering, and what the comment says by hovering — which
is strictly more than the current glyph offers in either direction.

**Alternative, if Richard prefers the glyph:** keep the speech bubble and reserve real width for it —
subtract a `commentIconOffset` from *both* maxWidth expressions named above. It is a two-line change,
and it costs 81px → ~61px of title and reflows the title when a comment is added. Recorded here so the
decision is one line to flip, not a re-derivation.

## Current State

- Glyph painted when `hasComment || isHighligthed`, at `globalAlpha = hasComment ? 1.0 : 0.4` (**F51**) —
  so it appears on every hover, and its presence tells you nothing until you compare opacities.
- Glyph vertically centred on `titlebarHeight / 2`, which grows with a wrapped title plus a sublabel, so
  on a renamed node it drifts below the title row (**F52**).
- Glyph overlaps the title's wrap allowance (**F50**).
- Clicking the glyph opens the edit popup; `commentIconBounds` is written by the painter and read by a
  hit test in [`NodeGraphEditorNode.ts:560-574`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorNode.ts#L560-L574).
- No way to read a comment without opening the edit popup.

## Desired State

### 1. The stripe

In `paintNode`, replacing the glyph block at
[`:277-299`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorNodePainter.ts#L277-L299)
and everything after it that draws the bubble:

```ts
if (node.model.hasComment()) {
  ctx.save();
  ctx.fillStyle = theme.commentIndicator;
  // Inside the existing rounded-rect clip, so the top-left corner is rounded for free.
  ctx.fillRect(x, y, NodeGraphEditorNode.commentStripeWidth, node.titlebarHeight());
  ctx.restore();
}
```

- `commentStripeWidth = 3`, a new constant beside the other card metrics.
- Spans the **titlebar only**, not the full card height — it marks the node's identity, and the ports
  section below belongs to the wires.
- Drawn *after* the card body fill and *before* the chip, so it can never be overpainted.
- **No** `isHighligthed` term. Presence of the stripe means presence of a comment, with no second state
  to interpret (closes F51). Hover styling of the card is unchanged.
- Vertical drift (F52) disappears because the stripe is defined by the titlebar, not centred in it.

### 2. The theme token

A new `commentIndicator` in [`CanvasTheme`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/canvas/CanvasTheme.ts),
resolved per theme like its neighbours, seeded from the **azure primary accent**.

Azure is correct and the two alternatives are not: red is danger-only by phase-23 law, and amber means
warning per UIX-004's toolbar work. A comment is informational, which is what the primary accent is for.
Do **not** reuse `cat.accent` — the stripe would then read as another category tint rather than as a
distinct mark.

At low zoom the stripe must not vanish: clamp its drawn width so it is at least one device pixel after
the viewport scale, in the same spirit as the existing low-zoom handling.

### 3. Hover reads the comment

When a node with a comment is highlighted, show its text via `PopupLayer.instance.showTooltip` — the
mechanism wires already use for health and annotation messages
([`NodeGraphEditorConnection.ts:159-176`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorConnection.ts#L159-L176)).

- Positioned `bottom`, from the node's titlebar.
- Hidden on un-highlight, and on any mouse-down, exactly as the wire tooltips are.
- This is the "view" half of Richard's "right click to edit or view" — hovering is a cheaper way to read
  than any menu, so the menu only needs to *edit*.

### 4. Right-click edits

Add to [`NodeContextMenu`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeContextMenu.ts),
which already carries *Extract to component*, *Explain this node*, *Add new child* and *Delete*:

- `Add comment` when `!node.model.hasComment()`
- `Edit comment` when it does

Both call the existing `showCommentEditPopup()` on the node view. A third entry, `Remove comment`, is
**not** added — the popup already clears the comment when submitted empty, and its undo label already
distinguishes the two cases.

Single-select only: if more than one node is selected, offer neither entry (the popup is titled for one
node and writes one node's model).

### 5. The click path goes away

Delete `commentIconBounds` (field on `NodeGraphEditorNode`, writes in the painter), the hit test at
[`NodeGraphEditorNode.ts:560-574`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorNode.ts#L560-L574),
and its caller in the node's mouse handling.

The painter's file header comment explicitly warns that it "writes back the geometry caches that
hit-testing depends on (`commentIconBounds`); do not remove those writes"
([`NodeGraphEditorNodePainter.ts:131-133`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorNodePainter.ts#L131-L133)).
That warning becomes stale with this task — **update it in the same commit**, do not leave it pointing at
a field that no longer exists.

## Implementation Steps

1. Add `commentStripeWidth` and the `commentIndicator` theme token; confirm the token resolves in both
   light and dark.
2. Replace the glyph block with the stripe. Verify by eye that a node with a long title and a comment no
   longer overlaps (F50), on both a renamed node (sublabel present) and a plain one.
3. Delete `commentIconBounds`, its hit test and its caller; update the painter's header comment.
4. Add the context-menu entries.
5. Add the hover tooltip.
6. Screenshot corpus: re-run the UIX-009 harness in both themes and diff. The stripe is a new mark on
   every commented node, so captures **will** change — review them rather than re-baselining blind.

## Success Criteria

1. A node with a comment shows a stripe with **no hover**, and a node without one never shows it.
2. A node with a 3-word title and a comment draws no text under any glyph or stripe, at 100% zoom and
   at 40%.
3. The stripe is still visible at the zoom level where the whole graph fits the viewport.
4. Hovering a commented node shows its text; hovering an uncommented node shows nothing new.
5. Right-click on one selected node offers Add/Edit comment; on two, offers neither.
6. Editing through the menu is undoable with the existing labels, and the stripe appears or disappears
   on the same repaint.
7. `grep -rn commentIconBounds packages/noodl-editor/src` returns nothing.
8. Editor suite green (`test:ci` — **not** `jest`).

## Out of Scope

- Comment *content* — no markdown, no length limit, no templates. Free text as today.
- Comments on anything other than a node. Wires get theirs in CAN-002; comment boxes are untouched.
- Multi-select comment editing.
- Exporting the comment — that is CAN-005.

## Traps

- **The two maxWidth expressions must agree.** If the alternative (reserve-width) route is taken
  instead of the stripe, changing one and not the other makes wrap math and paint disagree, which is
  precisely what the existing code comments warn about. The stripe route avoids this entirely by
  touching neither.
- **`titlebarHeight()` feeds every connection anchor.** Port row positions and therefore wire endpoints
  are computed from it ([`NodeGraphEditorConnection.paint`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorConnection.ts#L346-L357)).
  The stripe reads it; it must not change it.
- **The stripe is inside the clip.** Draw it after `ctx.clip()` or it will be square-cornered and bleed
  past the card.
- **Editor specs are jasmine, not jest** in this package — match the surrounding suite style.
- **HMR keeps stale canvas classes.** After editing the painter, a full editor restart is needed before
  believing a screenshot; a hot reload can leave the previous painter live.
