# FIX-009 — One width for the selection slot

**Report 6** · Tier 2 · Effort **S** (~15 lines + a pure unit test)

> *"If the user resizes one of either component or node menu, that BOTH inherit the size they've
> chosen. In both directions. So there's no more jumping."*

## Mechanism — pinned

Widths live in one map keyed by **panel id**, per project:
`EditorSettings.get(ProjectModel.id)['editor-sidebar-widths']` — read at
`useSidePanelLayout.tsx:265` (`widths[activeId] ?? defaultWidthFor(activeId)`), written at `:347`
(`persistWidth`, only for `activeId`). `d12b1329` equalised only the **defaults** (both 328); the
first drag writes `widths['components']` **or** `widths['PropertyEditor']` alone and they diverge
again — exactly as reported. The alternation is `SidebarModel.switchToNode`
(`sidebarmodel.tsx:317-333`) activating `PropertyEditor` on select and `hidePanels` (`:345-359`)
restoring `components` on deselect.

## Fix direction

A width **group**, mapped before both the read and the write:

```ts
const WIDTH_GROUPS: Record<string, string> = {
  components: 'selection-slot',
  PropertyEditor: 'selection-slot',
  PortEditor: 'selection-slot'
};
export function widthKeyFor(panelId: string) { return WIDTH_GROUPS[panelId] ?? panelId; }
```

used at `useSidePanelLayout.tsx:265` and `:347`. **Include `PortEditor`** (`router.setup.ts:69`) —
it is the third panel that occupies the selection slot (several node types request it), and
`panelHoldsCanvasSelection()` (`EditorEventBindings.ts:120-122`) is precedent for treating exactly
these as one family. Optional legacy read fallback
(`widths['selection-slot'] ?? widths['components'] ?? widths['PropertyEditor'] ?? default`) so an
already-dragged width survives the upgrade. Do **not** couple float rects (`FLOAT_SETTINGS_KEY`) —
a floating Properties card and a floating Components card are separately positioned. The pure
helper gets a unit test in the pattern of `tests/sidepanel/hideTransitions.spec.ts`.

## Rulings

1. `PortEditor` joins the group — recommended, otherwise selecting a Component Inputs node still
   jumps. Confirm.
2. **Scope check:** deselect restores `previousActiveId`, which can be *any* panel (Search 340,
   Docs 420…) — selecting a node while Search is open still moves the divider. The report asks for
   the two-panel group and that is the safe change; one shared width for the whole docked sidebar
   is a bigger decision. Recommend the group now; note the wider option.

## Acceptance criteria

1. Drag the Components panel to 420 → select a node → Properties shows at 420, canvas does not move.
2. Drag Properties to 300 → deselect → Components shows at 300. Both directions, driven.
3. Select a node whose type requests `PortEditor` — same width, no jump.
4. Docs/Search/Build panels keep their own widths (control).
5. Pure `widthKeyFor` unit test; existing sidepanel specs stay green.
