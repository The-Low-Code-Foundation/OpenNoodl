# UIX-015: Insert & connect (`⌥⏎`)

## Metadata

| Field | Value |
|-------|-------|
| **ID** | UIX-015 |
| **Phase** | Phase 23 — Visual Refresh (Track I) |
| **Tier** | 3 — follow-up |
| **Priority** | 🟡 Medium (a real speed-up for graph building; nothing is broken without it) |
| **Difficulty** | 🟠 Medium-high — the plumbing crosses four entry points, and port matching is the actual problem |
| **Prerequisites** | UIX-013 (landed) |
| **Filed by** | UIX-013, 2026-07-26 |
| **Branch** | commit directly to `cline-dev` |

## Objective

Place a node **and wire it** to what you were working on, in one keystroke.

## Background

The UIX-013 mock's footer advertises `⌥⏎ insert & connect`. It was not shipped,
and the hint was left off rather than shown dead: **nothing tells the picker
what a connection would come from.** All four call sites construct
`CreateNewNodePanel` with `model` / `parentModel` / `pos` / `runtimeType` only:

- `views/nodegrapheditor/canvas/InteractionController.ts` (right-click empty canvas)
- `views/nodegrapheditor/NodeContextMenu.ts` ×2 ("Add new child")
- `views/EditorTopbar/EditorTopbar.tsx` (the `+` button)

Note what is *not* in that list: dragging a connection into empty space does not
open the picker at all today. That is the interaction this feature most wants,
and adding it is part of the work rather than a precondition that already holds.

## Scope

1. **A source context.** Extend `CreateNewNodePanelOptions` with an optional
   `connectFrom: { node: NodeGraphNode; port: string; direction: 'in' | 'out' }`
   and thread it through the picker (the context already carries panel-wide
   state — see `NodePicker.context.tsx`).
2. **Port matching.** Given a source port's type, pick the target port on the
   node being inserted: exact type first, then a typecast the library allows
   (`NodeLibrary`'s `typecasts`), then the first compatible port. Nodes with
   dynamic ports only have their declared ports available at insert time —
   decide and record what happens there.
3. **The entry point.** Open the picker on a connection dragged to empty canvas,
   pre-filtered (or at least pre-ranked) to nodes with a compatible port.
4. **The affordance.** `⌥⏎` inserts and connects; `⏎` inserts plain. Restore the
   footer hint — `NodePickerFooter` takes `hints` as data, so it is one entry.
   Show on the card or preview *which* port would be connected: a silent
   connection to a port the user did not choose is worse than no connection.

## Acceptance

1. Drag a connection from an output into empty canvas → picker opens, cursor on
   a compatible node, `⏎` places **and** wires it.
2. `⌥⏎` from the normal picker (opened with a node selected) wires from that
   node's most likely port, and says which one before you commit.
3. No compatible port → the affordance is absent, not a no-op keystroke.
4. Undo removes node and connection as one step.
5. The footer hint is present only when the shortcut can do something.
