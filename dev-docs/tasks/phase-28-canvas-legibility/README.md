# Phase 28 — Canvas Legibility & Authoring Intent (Track M)

**Created:** 2026-07-28 · **Built:** 2026-07-29 (CAN-001…004; CAN-005 handed to phase 18 as EXP-006)
**Origin:** not the roadmap. This phase comes from Richard using the WFA-004 workflow canvas and
asking why the rest of the editor cannot do what it does.

**Status and what landed:** [PROGRESS.md](./PROGRESS.md). Build order was CAN-004 → **CAN-003** →
CAN-001 → CAN-002: CAN-003 moved ahead of CAN-001 because its own trap says to, and it was right —
retiring arm-then-confirm first meant the label chip's hit-test never had to compete with it.

## The observation that started it

WFA-004 put the source port's name on the wire, because a workflow canvas needed it: a node card only
grows a port row for a port that is *already connected*, so an unwired `onfalse` branch was invisible,
and once wired the wire could run a long way from the card that named it.

That label turned out to be the most legible thing on any NodeGX canvas — and it is drawn by the
*shared* connection painter, gated on one flag that only two workflow port types set
([`NodeGraphEditorConnection.paintPortLabel`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorConnection.ts#L304-L334)).
Nothing about it is workflow-specific. It was switched on for one graph type and off for every other.

## The thesis

**A NodeGX graph knows more than it shows, and what it shows does not survive export.**

Four kinds of author intent exist in a project today and none of them travel well:

| Intent | Stored | Visible on canvas | Survives export |
|---|---|---|---|
| Which port a wire leaves from | derivable | only on the card, only when connected | as structure, unnamed |
| Why a wire exists | **nowhere** | no | no |
| What a node is for (node comment) | `metadata.comment` | only on hover, and it overlaps the title | no |
| What the author called a node | `label` | yes | partially |

This phase closes all four: it makes the graph explain itself on screen, gives the author somewhere to
write down *why*, and carries every bit of it into exported code as comments and identifiers — so the
code a human or an LLM picks up after export starts with the reasoning intact, not just the structure.

## Tasks

| ID | Title | Tier | Focus |
|---|---|---|---|
| [CAN-001](./CAN-001-CONNECTOR-LABELS.md) | Connector labels on every canvas | 1 | Un-gate the WFA-004 label; hover default + always-on setting; positionable along the wire |
| [CAN-002](./CAN-002-CUSTOM-CONNECTOR-TEXT.md) | Author-written connector text | 2 | `Connection.label`, double-click to edit, wrapped, undoable, diff-visible |
| [CAN-003](./CAN-003-ENDPOINT-DETACH-REWIRE.md) | Detach an endpoint to rewire or delete | 2 | Drag a wire end; drop on a node rewires, drop on canvas deletes; retires the two-click delete |
| [CAN-004](./CAN-004-COMMENT-DISCOVERABILITY.md) | Node comments you can find | 1 | Persistent indicator that costs no title width; hover to read; right-click to edit |
| [CAN-005](./CAN-005-EXPORT-AUTHORING-INTENT.md) | Export carries authoring intent | 3 | Labels, titles, node comments and comment-box regions become comments and identifiers in exported code |

**Tiers are stopping points.** Tier 1 (CAN-001, CAN-004) is small, independent and immediately
valuable — either can ship alone. Tier 2 needs tier 1's groundwork. CAN-005 is scoped here but
**executes inside Phase 18**, because it is generator work; see its §Placement.

## Order

CAN-004 first — it is the smallest, it is fully independent, and it fixes a real overlap defect
(F50) rather than only adding a feature. Then CAN-001, which is mostly deletion of a gate. Then
CAN-002 (needs CAN-001's positioning), then CAN-003 (the only task that adds a new interaction mode
and the only one that needs live QA on a dense real graph). CAN-005 last, and gated on CAN-002
landing the `label` field.

## The one design argument in this phase

**Should every wire carry a label by default?** Mechanically yes — it is one flag. The phase says
**no**, and CAN-001 §2 carries the reasoning: on a browser graph the port name is *already* printed on
the card at both ends of every wire, so an always-on label is a third copy of on-screen text on
graphs that routinely carry 50–100 wires. The default is hover; always-on is a setting; author-written
labels (CAN-002) are always shown because they are the only ones carrying information the graph does
not already contain.

## Findings register

Established 2026-07-28 by reading the canvas painter and measuring the card geometry. Executors should
re-confirm a live symptom before building around it.

| # | Finding | Where | Owner |
|---|---|---|---|
| F50 | The comment glyph is drawn **inside the title's text-wrap allowance**. Card width is a fixed 150px and neither `titlebarLabelHeight()` nor the painter subtracts anything for the glyph, so a long node title wraps text underneath the speech bubble | glyph at [`NodeGraphEditorNodePainter.ts:284-285`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorNodePainter.ts#L284-L285); title budget at [`:251-255`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorNodePainter.ts#L251-L255) and [`NodeGraphEditorNode.ts:315-320`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorNode.ts#L315-L320) | CAN-004 |
| F51 | The comment glyph is drawn whenever a node is merely *highlighted* (`hasComment \|\| isHighligthed`, at 0.4 alpha), so it flickers in on every hover and you must hover a node to learn whether it has a comment at all | [`NodeGraphEditorNodePainter.ts:279-299`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorNodePainter.ts#L279-L299) | CAN-004 |
| F52 | The glyph centres on `titlebarHeight / 2`, which grows with a wrapped title and a sublabel — so on a renamed node with a two-line title it drifts down out of the title row | [`NodeGraphEditorNodePainter.ts:286`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorNodePainter.ts#L286) | CAN-004 |
| F53 | `GraphSnapshot.normalizeConnection` preserves unknown connection keys in `rest`, and `GraphDiff` compares `rest` for **comments** but never for **connections**. A new field on a connection therefore round-trips safely but produces no diff change — a relabel would be invisible in version control and can be lost to the other side of a three-way merge | [`GraphSnapshot.ts:92-100`](../../../packages/noodl-editor/src/editor/src/versioning/GraphSnapshot.ts#L92-L100); comment `rest` compared at [`GraphDiff.ts:380`](../../../packages/noodl-editor/src/editor/src/versioning/GraphDiff.ts#L380); connection diff at [`:303-355`](../../../packages/noodl-editor/src/editor/src/versioning/GraphDiff.ts#L303-L355) | CAN-002 |
| F54 | A wire cannot be right-clicked. `NodeGraphEditorConnection.mouse` returns on `evt.button !== 0`, and there is no connection context menu anywhere | [`NodeGraphEditorConnection.ts:145`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorConnection.ts#L145) | CAN-003 |
| F55 | The wire delete gesture is arm-then-confirm, not a double-click handler: the first mouse-**up** sets `deleteModeConnection` and paints the red X, and a second click *anywhere on the wire* within 3s deletes. The X is therefore never visible on hover alone, and a double-click deletes as a side effect | [`NodeGraphEditorConnection.ts:185-214`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorConnection.ts#L185-L214), marker painted at [`:469-491`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorConnection.ts#L469-L491) | CAN-003 |
| F56 | Wires have no draggable endpoints. A connection drag starts from a **node** (`startDraggingConnection(fromNode)`) and resolves ports through a popup on drop; the endpoints are only *painted*, as 3px dots. There is no port-handle model to hang a re-route gesture on | [`InteractionController.ts:125-146`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/canvas/InteractionController.ts#L125-L146) and [`:279-323`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/canvas/InteractionController.ts#L279-L323); dots at [`NodeGraphEditorConnection.ts:444-451`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorConnection.ts#L444-L451) | CAN-003 |
| F57 | [`CODE-008-node-comments-export.md`](../phase-7-code-export/CODE-008-node-comments-export.md) already specs node-comment export — and Phase 18, which supersedes phase 7, does not mention comments or labels anywhere in EXP-002's scope. The spec will be silently orphaned the moment phase 7 is stamped superseded | [phase-18 PROGRESS](../phase-18-code-export-v2/PROGRESS.md) | CAN-005 |
| F59 | **Found by building, not by reading.** Once wire labels joined the SUB-007 no-loss property's mutation set, it caught a case none of the specs named: one side deletes a wire, the other writes a label on it, and the label vanishes with no conflict. Same class as delete-vs-edit on a node. Now a `connection-label-deleted` conflict; choosing the labelling side restores the wire the label was written on | [`GraphMerge.ts` mergeConnections](../../../packages/noodl-editor/src/editor/src/versioning/GraphMerge.ts); property at [`tests/versioning/noloss.test.ts`](../../../packages/noodl-editor/tests/versioning/noloss.test.ts) | CAN-002 (closed) |
| F58 | There is no wire *selection* concept. The canvas tracks `highlightedConnection` (hover) and `deleteModeConnection` (armed) only, so there is nothing for a Delete key or a context menu to act on | [`NodeGraphEditorConnection.ts:134-142`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorConnection.ts#L134-L142) | CAN-003 |

## Out of scope for the whole phase

- **Wire routing.** Bezier shape, elbow avoidance and overlap reduction are untouched. Labels are
  placed *on* the existing curve.
- **A second canvas.** Every task extends the one `NodeGraphEditor`. This codebase's documented
  failure mode is building a parallel surface; see [WFA-004-ASSESSMENT](../phase-27-visual-backend-authoring/WFA-004-ASSESSMENT.md) §1b.
- **Comment boxes as a system.** `CommentsModel` gets read by CAN-005 and is otherwise left alone.
- **Node title editing UX.** Titles already work; CAN-005 only *consumes* them.
