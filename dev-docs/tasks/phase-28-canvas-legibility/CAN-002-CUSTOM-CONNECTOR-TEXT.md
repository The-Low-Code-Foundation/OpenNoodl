# CAN-002: Author-Written Connector Text

## Metadata

| Field | Value |
|-------|-------|
| **ID** | CAN-002 |
| **Phase** | Phase 28 — Canvas Legibility & Authoring Intent (Track M) |
| **Tier** | 2 |
| **Priority** | 🟠 High — the only new place in NodeGX to record *why* a wire exists |
| **Difficulty** | 🟡 Medium — the model and editor are small; the version-control gap (F53) is the real work |
| **Estimated Time** | 1–1.5 weeks |
| **Prerequisites** | CAN-001 (label rendering, positioning, chip metrics); CAN-003 strongly preferred first (frees double-click) |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🟠 **Opus 4.8** — the diff/merge half touches the SUB-007 engine, where being wrong loses user data quietly |

## Objective

Let the author double-click a wire and write their own text on it — wrapped, bounded, persisted,
undoable, and **visible to version control**.

## Background

A NodeGX graph records what is connected and never why. Node comments cover intent at a node
(`metadata.comment`); comment boxes cover intent for a region. Nothing covers a *wire*, which is where a
surprising amount of a graph's reasoning lives — "filtered products matching search criteria", "only
fires after validation", "this is the retry path".

[`CODE-008`](../phase-7-code-export/CODE-008-node-comments-export.md) anticipated this. Its *Future
Enhancements* lists "Connection Comments — comments on wires explaining data flow" and sketches a
`metadata.comment` shape on connections. This task makes it real; CAN-005 consumes it.

### Persistence is free; version control is not

`NodeGraphModel.toJSON` serializes `this.connections` **verbatim** as raw objects
([`:789-797`](../../../packages/noodl-editor/src/editor/src/models/nodegraphmodel/NodeGraphModel.ts#L789-L797)),
so any field added to a connection lands in `project.json` with no writer change.

Version control is where it gets interesting (**F53**). `GraphSnapshot.normalizeConnection` keeps only
four known keys and sweeps everything else into `rest`
([`:92-100`](../../../packages/noodl-editor/src/editor/src/versioning/GraphSnapshot.ts#L92-L100)) — so a
label **round-trips safely** and is not dropped by the snapshot layer. But `GraphDiff` compares `rest`
for **comments** ([`:380`](../../../packages/noodl-editor/src/editor/src/versioning/GraphDiff.ts#L380))
and **never for connections** — the connection diff at
[`:303-355`](../../../packages/noodl-editor/src/editor/src/versioning/GraphDiff.ts#L303-L355) works
purely from `connectionKey`, which is the four ids and properties
([`GraphSnapshot.ts:427`](../../../packages/noodl-editor/src/editor/src/versioning/GraphSnapshot.ts#L427)).

Consequence: **editing a label produces no change of any kind.** The diff panel shows nothing, the commit
looks empty, and in a three-way merge the side that relabelled can lose it silently when the other
side's copy of that connection wins. That is unacceptable for a field whose entire purpose is carrying
intent someone will rely on later.

## Current State

- `Connection` is `{ fromProperty, fromId, toProperty, toId, annotation }`
  ([`NodeGraphModel.ts:14-20`](../../../packages/noodl-editor/src/editor/src/models/nodegraphmodel/NodeGraphModel.ts#L14-L20)).
  `annotation` is transient (diff presentation, AIX-003) and is already in
  `CONNECTION_TRANSIENT_KEYS`.
- `NodeGraphModel` has `addConnection` and `removeConnection`, both undoable — and **no update path**.
- Double-clicking a wire deletes it, as the second click of the arm-then-confirm gesture (F55).
- `paintPortLabel` draws one unwrapped line.

## Desired State

### 1. The model field

```ts
export type Connection = {
  fromProperty: string;
  fromId: string;
  toProperty: string;
  toId: string;
  annotation: 'Deleted' | 'Changed' | 'Created' | undefined;
  /** Author-written text shown on the wire. Absent when never set. */
  label?: string;
  /** Normalised position of the label along the curve, 0.15–0.85. Absent when default. */
  labelT?: number;
};
```

`label` is a **first-class key, not `metadata.comment`.** CODE-008's sketch used a nested `metadata`
object; a flat key matches how the four existing connection keys are stored, keeps `connectionKey`
untouched, and makes the `CONNECTION_KNOWN_KEYS` addition in §3 a one-word change. Absent when unset —
never written as `undefined` or `""`, so untouched projects do not churn.

### 2. An undoable setter

`NodeGraphModel.updateConnection(model, changes, args?)`, following the shape of its siblings at
[`:389-436`](../../../packages/noodl-editor/src/editor/src/models/nodegraphmodel/NodeGraphModel.ts#L389-L436):
apply, `notifyListeners('connectionUpdated', {model})`, and push a do/undo pair capturing the previous
values when `args.undo` is set.

This is the only new model method in the task, and CAN-001's `labelT` drag uses it too.

Deleting all the text removes the key rather than storing `""` — an empty label must be indistinguishable
from never having had one, or every wire ever clicked accumulates a dead key.

### 3. Version control sees it — the core of this task

Three coordinated changes:

- **`CONNECTION_KNOWN_KEYS`** gains `label` and `labelT`
  ([`GraphSnapshot.ts:38`](../../../packages/noodl-editor/src/editor/src/versioning/GraphSnapshot.ts#L38)),
  so they are normalised fields rather than opaque `rest` entries. `normalizeConnection` and
  `denormalizeConnection` carry them explicitly.
- **A `connection-relabelled` change kind** in `GraphDiff`, emitted when a connection exists on both
  sides under the same `connectionKey` but its `label` differs. It belongs in the pass at
  [`:303-355`](../../../packages/noodl-editor/src/editor/src/versioning/GraphDiff.ts#L303-L355), after
  add/remove/rewire pairing, over the *intersection* of the two key sets.
- **Category.** `semantic`, like its connection neighbours — a label is authored meaning, and a diff
  that buries it as cosmetic defeats the purpose. `labelT` alone changing is **not** a change at all
  (position is presentation); do not emit for it. This asymmetry is deliberate and is the reason the two
  fields are separate keys.

Then the presentation layers: a row in `graphChangePresentation`, and the SUB-007 **merge driver** must
treat a relabel as a mergeable field-level change — two sides relabelling the same wire differently is a
genuine conflict and must surface as one, not resolve by silent last-write-wins.

### 4. Double-click to edit

Double-click a wire → an editing overlay at the label's position, pre-filled, focused, all selected.

- **Depends on CAN-003.** Double-click currently deletes (F55). If CAN-002 must land first, gate the
  new behaviour so the first click does not arm delete mode when a `dblclick` follows — and accept that
  this is a fragile interim state. Doing CAN-003 first is strongly preferred and costs nothing extra.
- **Reuse the comment-box editor pattern.** [`CommentForeground.tsx`](../../../packages/noodl-editor/src/editor/src/views/CommentLayer/CommentForeground.tsx)
  already puts a `<textarea rows={1}>` over the canvas and auto-sizes it — the same problem, already
  solved once, in the same coordinate space.
- Commit on blur or ⌘/Ctrl+Enter; cancel on Escape restoring the previous value. One undo entry per
  editing session, not per keystroke.
- The DOM layer is hidden during node and wire drags (`setDOMLayerVisible(false)`) and restored on mouse
  up — the overlay lives in that layer and inherits the behaviour.

### 5. Wrapping and bounds

- **Max width 160 graph units.** Roughly the card width (150) plus a little; wider and a label competes
  with the nodes it describes.
- **Max 3 lines**, then ellipsis. The full text is available on hover as a tooltip
  (`PopupLayer.instance.showTooltip`, as CAN-004 uses for node comments).
- **Max 280 characters** enforced in the editor, not at paint. A wire label is a phrase; anything longer
  belongs in a node comment or a comment box.
- Wrapping uses the existing [`textWordWrap`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorNodePainter.ts#L28-L60)
  from the node painter — it already does measure-and-break with an optional draw callback, and returns
  the height, which is exactly what the chip needs to size itself. Do not write a second wrapper.
- The chip grows to the wrapped block, using CAN-001's extracted metrics, and stays centred on
  `pointOnCurve(t)`.
- Author labels are shown **always**, independent of hover and of the always-on setting (CAN-001 §1).
  They exist because someone typed them.

## Implementation Steps

1. Add the type fields and `updateConnection`; unit-test the undo pair and that clearing removes the key.
2. Snapshot layer: `CONNECTION_KNOWN_KEYS`, normalize/denormalize, round-trip test proving a labelled
   connection survives snapshot → denormalize unchanged.
3. `GraphDiff`: the `connection-relabelled` kind, with tests for relabel, label-added, label-removed, and
   `labelT`-only-changed (which must produce **nothing**).
4. Presentation row + merge-driver handling, including the two-sided-relabel conflict case.
5. Paint: wrapping via `textWordWrap`, the grown chip, the always-show rule, hover tooltip for truncated
   text.
6. The editing overlay.
7. Live pass: label a wire, save, close, reopen, commit, view the diff panel, and merge a branch that
   relabelled the same wire differently — confirm the conflict surfaces.

## Success Criteria

1. Double-click a wire, type, blur → text appears on the wire, wrapped, and does not delete the wire.
2. Text survives save → close → reopen, and a git round-trip.
3. Escape cancels; one undo reverts a whole editing session; clearing the text leaves **no** `label` key
   in `project.json`.
4. A relabel appears in the diff panel as a semantic change with before/after text.
5. Moving a label along a wire produces **no** diff entry.
6. Two branches relabelling the same wire differently produce a **conflict**, not a silent winner.
7. A 280-character label renders as 3 lines plus ellipsis, with the full text on hover, and never wider
   than 160 units.
8. Author labels show without hover, with the always-on setting off.
9. Editor suite green (`test:ci`).

## Out of Scope

- Rich text, markdown, links, colour, or per-label fonts.
- Labels on the *target* end, or two labels on one wire.
- AI-suggested labels. CAN-005 *reads* labels; nothing writes them but the author.
- Auto-labelling from port names — that is CAN-001's job and it stays separate, which is what makes
  "was this authored or derived?" answerable in the export.

## Traps

- **The view copies model fields at construction** (`for (const i in model) this[i] = model[i]`,
  [`:38-42`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorConnection.ts#L38-L42)).
  Read `this.model.label` everywhere. `this.label` will be the value from when the view was built —
  which for a *new* label is `undefined`, so the label appears to not save.
- **`this.color` and `this.lineWidth` are already victims of that copy** and are read as `this.*` in
  paint. Do not follow that precedent; it works only because nothing mutates them.
- **F53 is the whole risk.** Ship the label without the diff work and users will lose labels in merges
  and never know why. Steps 2–4 are not polish; if the task is cut short, cut the *editor* and keep the
  diff.
- **`annotation` is transient, `label` is not.** They sit next to each other on the same type; putting
  `label` in `CONNECTION_TRANSIENT_KEYS` by symmetry would silently strip it from every snapshot.
- **`textWordWrap` mutates nothing but reads `context.measureText`**, so set `ctx.font` before calling it
  or it measures with whatever font the previous paint left set.
- **HMR keeps the old canvas classes alive.** Restart the editor fully before judging a paint change.
- **Launching the dev editor rewrites `project-examples/agent-chat/project.json`.** Revert after a live
  pass.
