# CAN-001: Connector Labels on Every Canvas

## Metadata

| Field | Value |
|-------|-------|
| **ID** | CAN-001 |
| **Phase** | Phase 28 — Canvas Legibility & Authoring Intent (Track M) |
| **Tier** | 1 — independent, ships alone |
| **Priority** | 🟠 High — the whole phase started here |
| **Difficulty** | 🟢 Low–Medium — un-gating is trivial; the *default* is the design work, and the drag is small |
| **Estimated Time** | 3–5 days |
| **Prerequisites** | None |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🟢 **Sonnet 5** — the §2 decision is made below; what remains is a gate, a setting and a `t` parameter |

## Objective

Show the source port's name on wires on **every** canvas, not just the workflow canvas. Default to
showing on hover, offer an always-on setting, and let the label be positioned anywhere along the wire
rather than pinned to the middle.

## Background

WFA-004 added [`paintPortLabel`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorConnection.ts#L304-L334)
to the shared connection painter and gated it on the source port's type carrying `connectionLabel: true`.
Only two port types set it, both in workflow code
([`workflowNodeLibrary.ts:175,251`](../../../packages/noodl-editor/src/editor/src/models/workflow/workflowNodeLibrary.ts#L175),
[`WorkflowDocument.ts:382`](../../../packages/noodl-editor/src/editor/src/models/workflow/WorkflowDocument.ts#L382)).

There is exactly one connection painter and one canvas. Nothing in `paintPortLabel` knows what a
workflow is — the gate was a deliberately conservative default ("off for every port type that exists
today, so browser and cloud graphs paint exactly as before"), not a technical boundary.

The existing implementation already solves the two hard parts: it draws a `cardBg` chip at 0.92 alpha
behind the text, because "a bare glyph over a dot-grid at low zoom is unreadable"; and it picks a point
on the middle control segment, "clear of both cards, and away from the elbow where several wires from one
node overlap."

## Current State

- Label text is `getPortName(this.fromPort) || this.fromProperty`, i.e. the port's `editorName` or
  `displayName`.
- Position is hard-pinned to `this.midpoint(this.curve[1], this.curve[2])` — the midpoint of the two
  bezier *control* points, not a point on the curve.
- Shown unconditionally when the gate passes; never shown otherwise.
- Font `CanvasFonts.portLabel` = `10.5px` mono; chip height a literal 13, padding a literal 4.

## Desired State

### 1. The gate becomes a policy, not a port-type flag

Replace the `portType.connectionLabel` check with a resolver on the connection:

```ts
// Should this wire show its port-name label right now?
shouldShowPortLabel(): boolean
```

Resolution order, first match wins:

| Condition | Result |
|---|---|
| The connection has an author-written label (CAN-002) | **always show** — that path owns the label, see §5 |
| Source port type sets `connectionLabel: true` | **always show** — preserves WFA-004 exactly |
| `nodeGraphEditor.alwaysShowWireLabels` setting is on | **show** |
| The wire is highlighted (hover, or either endpoint node hovered/selected) | **show** |
| otherwise | hide |

`isHighlighted()` already computes the fourth row and is already called by `paint()`
([`:134-142`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorConnection.ts#L134-L142)) —
note it is true when *either endpoint node* is hovered or selected, not only when the wire itself is.
That is the behaviour we want: hovering a node reveals the names of every wire attached to it.

### 2. Why hover is the default, and not always-on

Richard asked for all connectors labelled by default. Mechanically that is one line. The
recommendation is against it, and this is the reasoning so the decision can be revisited on evidence
rather than re-argued:

On a **workflow** canvas the label carries information nothing else does — a card only grows a port row
for a port that is *already connected* (`measure()` builds `plugs` from `this.connections`,
[`NodeGraphEditorNode.ts:403-438`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorNode.ts#L403-L438)),
so branch names were genuinely invisible.

On a **browser** canvas the opposite holds: a connected port always has a row on the card, at *both*
ends, printing the port name. An always-on label is therefore a third on-screen copy of text already
present twice — on graphs that routinely carry 50–100 wires, at a fixed 150px card width with nowhere
for chips to go but on top of each other.

So: hover by default (which is when you are actually asking "what is this wire?"), always-on as a
setting for anyone who wants it permanently, and author-written labels always shown because they are the
only ones that carry information the graph does not already contain.

**If the live pass shows always-on is fine on real graphs, flip the default** — the setting makes that a
one-line change, and the finding belongs in this task's notes.

### 3. The setting

`nodeGraphEditor.alwaysShowWireLabels`, matching the existing `nodeGraphEditor.snapToGrid` convention
in [`EditorSettings`](../../../packages/noodl-editor/src/editor/src/utils/editorsettings.ts)
(`get(key)` / `set(key, value)`, debounced persist, `updated` notification).

Surfaced as a checkbox in [`EditorSettingsTab`](../../../packages/noodl-editor/src/editor/src/views/panels/SettingsPanel/EditorSettingsTab.tsx),
which already renders exactly this shape — `useModel(EditorSettings.instance, ['updated'])`, an
`enabled: !!EditorSettings.instance.get(...)` row, and an `onChange` that calls
`set(item.settingsKey, ev.target.checked)`.

The canvas must repaint when it changes. Subscribe where the canvas already handles theme changes —
UIX-005 added a `nodegx:themechanged` repaint hook, and this is the same shape of concern.

### 4. Position along the wire

Add a normalised position `t` ∈ [0, 1] and place the chip with the existing
[`pointOnCurve(t)`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorConnection.ts#L242-L249)
instead of the control-point midpoint.

- **Default `t = 0.5`.** Note this is *not* pixel-identical to today's `midpoint(curve[1], curve[2])`:
  that averages two control points, `pointOnCurve(0.5)` is a point on the actual curve. The difference
  is small and the curve point is more correct — but it means WFA-004's workflow screenshots shift
  slightly. Expected, and it is the reason to re-capture rather than assume.
- **Clamp to [0.15, 0.85].** Outside that the chip overlaps a node card, and the card is drawn after
  the wires.
- **Drag to reposition.** Dragging the chip converts the mouse position back to a `t` with the existing
  [`findClosestPointOnCurve(p)`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorConnection.ts#L267-L269)
  — a binary subdivision that already exists and needs no new maths — then clamps.
- **Persistence.** `t` is stored per connection as `labelT`, on the connection object.
  `NodeGraphModel.toJSON` serializes `this.connections` verbatim
  ([`:789-797`](../../../packages/noodl-editor/src/editor/src/models/nodegraphmodel/NodeGraphModel.ts#L789-L797)),
  so no writer change is needed. Omit the field entirely when it equals the default, so untouched
  projects do not churn in git.
- Repositioning is undoable, through the same setter CAN-002 introduces (`updateConnection`). If CAN-001
  ships first, add the setter here and CAN-002 reuses it.

### 5. Hand-off to CAN-002

`paintPortLabel` gains a text source rather than hard-coding the port name:

```
this.model.label ?? (getPortName(this.fromPort) || this.fromProperty)
```

CAN-001 may land with `this.model.label` always undefined — the point is that CAN-002 then adds only a
model field, an editor and wrapping, not a second paint path. Wrapping is CAN-002's; a port name is
short and single-line, and the current chip geometry is right for it.

### 6. Chip metrics move to the theme

The literals (`13` height, `4` padding, `0.92` alpha) become named constants beside
`CanvasFonts.portLabel` in [`CanvasTheme`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/canvas/CanvasTheme.ts).
CAN-002 needs to compute a *wrapped* chip from the same numbers, and duplicating them across two files
is how they drift.

## Implementation Steps

1. Extract the chip metrics into `CanvasTheme`. No behaviour change; workflow captures must be
   pixel-identical after this step, which proves the extraction was faithful.
2. Add `shouldShowPortLabel()` with the §1 order, and call it from `paint()` in place of the inline gate.
   Verify a workflow graph is unchanged and a browser graph now labels on hover.
3. Add the setting, the settings-tab row, and the repaint subscription.
4. Switch placement to `pointOnCurve(t)` with the clamp; re-capture the workflow screenshots and review
   the shift.
5. Add chip hit-testing and the drag-to-reposition gesture, with `labelT` persisted and undoable.
6. Live pass on a real project (`project-examples/agent-chat` — **revert it afterwards**, launching the
   editor rewrites it; see the launch-rewrites trap below).

## Success Criteria

1. On a browser graph, hovering a wire shows the source port name in a chip; hovering a node shows it on
   every wire attached to that node.
2. With the setting on, every wire shows its label with no hover; with it off, none do except workflow
   wires and author-labelled ones.
3. Toggling the setting repaints immediately, and survives an editor restart.
4. A workflow graph's labels are unchanged in *content* and gating from WFA-004 — only the sub-pixel
   position shift of §4 differs, and the re-captured screenshots show it.
5. A label dragged along a wire stays where it was put after save, reload, and re-open; it never
   overlaps either node card; undo returns it.
6. A project whose labels were never touched has **no** `labelT` keys added to `project.json`.
7. Legible at the zoom where a whole graph fits the viewport, in both themes.
8. Editor suite green (`test:ci`).

## Out of Scope

- Author-written text (CAN-002), and therefore wrapping and max width.
- Any change to wire routing, colour, dashing or the endpoint dots.
- Labelling the *target* port. The source port is the informative end — the target is where the value
  lands, and the receiving card's row already names it in the reading direction.
- Collision avoidance between chips on adjacent wires. Two labels can overlap; the drag is the escape
  hatch. Automatic de-collision is a routing problem and the phase excludes routing.

## Traps

- **The view copies model fields at construction.** `NodeGraphEditorConnection`'s constructor does
  `for (const i in model) this[i] = model[i]`
  ([`:38-42`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorConnection.ts#L38-L42)),
  so `this.labelT` is a *snapshot* taken when the view was built. Read `this.model.labelT` in paint and
  in the drag, or a repositioned label will revert on the next relayout and look like a persistence bug.
- **`paint()` returns early** on `aabbIntersectTest` and on missing plugs, before ever reaching the label
  ([`:339`, `:398-400`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorConnection.ts#L398-L400)).
  A chip near a clamped end can sit outside the curve's AABB only if the clamp is wrong; if labels
  vanish at viewport edges, suspect the AABB, not the gate.
- **Mouse handling bails on non-left buttons** at [`:145`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorConnection.ts#L145).
  Chip hit-testing must sit *before* the existing wire hit-test in the `move`/`down` paths, or the arm-
  for-delete gesture (F55) will fire when the user meant to grab the chip. This ordering is the single
  most likely way to ship an infuriating regression, and CAN-003 removes the conflict permanently — if
  both are in flight, do CAN-003 first.
- **`isPointInStroke` mutates `ctx.lineWidth` to 10** for wire hit-testing at
  [`:150-152`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorConnection.ts#L150-L152)
  and never restores it. Any new hit-test that draws must set its own width.
- **Launching the dev editor rewrites `project-examples/agent-chat/project.json`** — it minifies it and
  drops `rootComponent`, on open *and* on shutdown. Revert the file after any live pass or it lands in a
  commit.
- **`--target=editor` attaches to the preview window.** Use `--target=dashboard` when driving the editor
  over CDP, and launch detached.
