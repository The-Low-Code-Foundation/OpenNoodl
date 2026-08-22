# Drag to Reorder

A sortable list module. It ships one node, **Drag To Reorder**, that wraps a
vertical list container: press a row and drag it with mouse, touch or pen; the
other rows translate out of the way, a drop indicator line marks the target
slot, and dropping emits the reordered array. All DOM handling is
self-contained — pointer events with pointer capture on the node's own row
elements and `touch-action: none`, so touch drags are not stolen by page
scrolling and no document-level listeners are installed.

No dependencies, no network, no vendored code.

## The Drag To Reorder node

Find it in the node picker under **Visual** after installing the module.

### Inputs

| Port | Type | Meaning |
|---|---|---|
| Items | array | The rows to render. Objects or primitives; a new array (new identity) resets the list. |
| Label Property | string | Which property of each item to display (default `label`; falls back to `title`, `name`, `text`, then JSON). Primitives render as themselves. |
| Row Gap | number | Vertical space between rows in px (default 8). |
| Item Background | color | Row background (default `var(--surface-raised)`). |
| Text Color | color | Row text colour (default `var(--foreground)`). |
| Border Color | color | Row border colour (default `var(--border)`). |
| Indicator Color | color | The drop-indicator line (default `var(--primary)`). |

### Outputs

| Port | Type | Meaning |
|---|---|---|
| Reordered Items | array | A **new** plain array in the current order. Seeded as soon as Items arrives, updated on every drop. The input array is never mutated. |
| From Index | number | Index the dragged row started at (set on drop). |
| To Index | number | Index the row landed at (set on drop). |
| Changed | signal | Fires after a drop that actually moved a row, after the three outputs above are set. |

## Post-install configuration

1. Connect an array to **Items** — any array output works (Static Data,
   a query, a Variable). The demo component `/Drag To Reorder Demo` feeds it
   from a Static Data node.
2. If your items label themselves with something other than `label`, set
   **Label Property** (e.g. `title`).
3. To persist the order, connect **Reordered Items** (and react on **Changed**)
   to wherever the list lives — a Variable, a collection write, or a backend
   call. The node keeps its own visual order between drops, so persisting is
   optional for a purely visual list.
4. Colours default to the project's design tokens; override per instance with
   other `var(--token)` values if needed.

## Notes

- Reordering only fires **Changed** when the row actually lands on a new index;
  a cancelled or no-op drag emits nothing.
- The node renders an empty-state hint when Items is unconnected or empty.
- The demo component also wires From/To Index through an Expression into a Text
  node, showing "Moved row N to position M" after each drop.
