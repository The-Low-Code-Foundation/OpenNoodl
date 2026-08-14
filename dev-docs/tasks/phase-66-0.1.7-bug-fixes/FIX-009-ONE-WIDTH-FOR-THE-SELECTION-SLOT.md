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

## ✅ RULED 2026-08-14

1. ✅ **`PortEditor` joins the group.** Confirmed — otherwise selecting a Component Inputs node
   still jumps, which is the reported symptom on a different node type. The `WIDTH_GROUPS` map
   above ships as written, all three ids.
2. ✅ **The three-panel group only — not the whole docked sidebar.** Deselect restores
   `previousActiveId`, which can be *any* panel (Search 340, Docs 420…), so selecting a node while
   Search is open still moves the divider. That is **out of scope and deliberately left**: Docs and
   Search are panels users size differently on purpose. Acceptance criterion 4 (they keep their own
   widths) is the control that proves the group did not over-reach.

## Acceptance criteria

1. Drag the Components panel to 420 → select a node → Properties shows at 420, canvas does not move.
2. Drag Properties to 300 → deselect → Components shows at 300. Both directions, driven.
3. Select a node whose type requests `PortEditor` — same width, no jump.
4. Docs/Search/Build panels keep their own widths (control).
5. Pure `widthKeyFor` unit test; existing sidepanel specs stay green.

## ✅ BUILT 2026-08-14 (session 6)

Two exported pure helpers in `useSidePanelLayout.tsx`, used at the one read and the one write:

- `widthKeyFor(panelId)` — `components` / `PropertyEditor` / `PortEditor` → `'selection-slot'`,
  everything else → its own id. Used in `persistWidth` so a drag on any of the three writes the
  **group's** key.
- `storedWidthFor(widths, panelId)` — the read. Group key first, then a **legacy leg** that inherits
  a width dragged before the group existed (`components` → `PropertyEditor` → `PortEditor`, a fixed
  order so the answer does not depend on the settings file's key order). Returns `undefined` when
  nothing is stored, so `defaultWidthFor` still applies.

All three panels declare **no** `defaultWidth` (`router.setup.ts:67-103`), so the group's default is
uniformly `DEFAULT_PANEL_WIDTH` — nothing to reconcile there.

⚠️ **Checked, and it is not a conflict:** `useSetupSettings.migrateRetiredPanelIds` rewrites the same
`editor-sidebar-widths` map, but it only ever drops keys listed in `RETIRED_PANEL_IDS`.
`selection-slot` is not a panel id, so it passes through untouched.

Float rects deliberately **not** coupled, per the fix direction.

**9 specs** in `tests/sidepanel/widthGroups.spec.ts` — the mapping, the shared read in all three
directions, the ungrouped control (Search/Docs keep their own), the legacy inheritance, group-key
precedence over a stale legacy entry, and the fixed resolution order. Exported from
`tests/sidepanel/index.ts` — a spec missing from that barrel never runs.

## ✅ DRIVEN 2026-08-14 (session 6) — 5/5, task **CLOSED**

Fixture `fix012-drive` (scratch copy of `erg005-qa`; source verified untouched, still Aug 2). Real
divider drags: `FrameDivider.startDragging` is a React `onMouseDown` and its move/up are plain
`window` listeners, so a dispatched mousedown → mousemove → mouseup drives the whole gesture and
`onSizeChanged` fires on mouseup — the call that actually reaches `persistWidth`.

| Step | Measured | Criterion |
|---|---|---|
| Baseline, Components | `Container1` **380** = rail 52 + default 328 | — |
| Drag Components → 420 | **472** (panel 420) | — |
| Select the `title` node | Panel reads **Properties**, still **472 / 420** | **1 ✅** |
| Drag Properties → 300 | **352** (panel 300) | — |
| Deselect | Panel reads **Components**, **352 / 300** | **2 ✅** |
| Select `Component Inputs` (declares `panels:[{name:'PortEditor'}]`) | Panel reads **Inputs** (pStr…pNone), **352 / 300** | **3 ✅** |
| Open Search from the rail | **392 / 340** — its own registered default | **4 ✅** |
| `test:ci` | 2748 → **2757**, exactly +9 | **5 ✅** |

🔴 **The persisted map is the proof, not the pixels.** After the drags this project stores
**one** entry — `{"selection-slot": 300}` — where the old shape wrote one key per panel. Other
projects in the same settings file still carry the pre-fix divergence, and they are what the bug
report was describing:

```
79432910-… -> {"components":274,"search":420,"problems":380}
6bf916b6-… -> {"project-docs":448,"PropertyEditor":384}
976846f5-… -> {"PropertyEditor":394}
```

Those are the legacy entries the fallback leg exists for — a real upgrade population, not a
hypothetical one.

⚠️ **Two drive notes for the next session.** `ed.selectNode()` takes the **view** node
(`NodeGraphEditorNode`), not the model node — passing `model.forEachNode`'s output throws
`Cannot read properties of undefined (reading 'type')`; walk `ed.roots` and its `children` instead.
And the panel switch is **not** visible in the same `eval` that selects: React has not re-rendered
yet, so the first read still says "Components". Measure in a second call or you will record a
false negative.
