# STYLE-004: Property Panel UX — Changelog

## Session: 2026-02-18

### Summary

Completed STYLE-004 Phase 1: Property panel wiring for the ElementConfig variant and size system.
This closes the STYLE-002 Phase 4 + Phase 5 deferred items.

---

### New Files

#### `noodl-core-ui/src/components/propertyeditor/SizePicker/`

- **`SizePicker.tsx`** — Segmented control component for selecting a size preset (sm / md / lg / xl).
  Renders only the sizes defined in the node's ElementConfig. All styling via design tokens.
- **`SizePicker.module.scss`** — Styles for the segmented control. No hardcoded colors.
- **`index.ts`** — Barrel export.

#### `noodl-core-ui/src/components/propertyeditor/ElementStyleSection/`

- **`ElementStyleSection.tsx`** — Property panel section that combines VariantSelector and SizePicker.
  Renders at the top of the panel for any node with an ElementConfig registered.
  Props-driven and dumb — the legacy `propertyeditor.ts` manages undo via callbacks.
- **`ElementStyleSection.module.scss`** — Section layout and header styling. Design tokens throughout.
- **`index.ts`** — Barrel export.

---

### Modified Files

#### `ElementConfigRegistry.ts`

Added two new public API methods:

```typescript
// Apply a named size preset's styles to a node (stamps CSS properties + _size marker)
ElementConfigRegistry.applySize(node, typeName, sizeName)

// Return the size names defined in the config, in definition order
ElementConfigRegistry.getSizeNames(nodeType) → string[]
```

#### `propertyeditor/propertyeditor.html`

Added `<div class="element-style-section"></div>` slot between `.variants` and `.visual-states`.

#### `propertyeditor/propertyeditor.ts`

- Imported `ElementStyleSection` from `@noodl-core-ui/components/propertyeditor/ElementStyleSection`
- Imported `ElementConfigRegistry`
- Added fields: `elementStyleRoot: Root | null`, `_elementStyleGroup: Record<string, never>`
- Added methods:
  - `renderElementStyleSection()` — mounts/updates the React root; reads `_variant` and `_size` from
    `this.model.parameters`; guards on `ElementConfigRegistry.has(typeName)`
  - `onElementVariantChange(variantName)` — resolves variant styles, batches into `UndoActionGroup`,
    calls `this.model.setParameter()` for each property, pushes to `UndoQueue`, then re-renders
  - `onElementSizeChange(sizeName)` — same pattern for size preset styles
- Updated `render()`: subscribes to `['modelParameterUndo', 'modelParameterRedo']` to re-render
  the section after undo/redo; calls `renderElementStyleSection()`

---

### Test File

**`tests/models/ElementConfigRegistry.test.ts`**

Covers:

- `applyVariant` — stamps styles, excludes `states`, handles unknown types/variants
- `applySize` — stamps size presets, handles no-sizes configs, unknown sizes
- `getSizeNames` — returns correct keys in order, handles missing sizes
- `getVariantNames` — returns all variant names
- `resolveVariant` — returns baseStyles + states, excludes `states` from baseStyles
- `applyDefaults` — stamps defaults + default variant, does not overwrite pre-existing values

---

### Architecture Notes

**Why callbacks instead of direct undo in the component:**
The `ElementStyleSection` is intentionally dumb. Undo grouping requires `UndoActionGroup` +
`UndoQueue` — both are editor-specific and not part of `noodl-core-ui`. Keeping undo logic in
`propertyeditor.ts` lets the React component stay portable.

**Why \_variant and \_size in parameters:**
These are special marker keys that don't map to real CSS properties. They allow the property panel
to re-render the picker with the correct selection state across sessions. `applyDefaults` already
persisted `_variant`; `_size` is the same pattern added by STYLE-004.

**Undo/redo re-render:**
`propertyeditor.ts` subscribes to `['modelParameterUndo', 'modelParameterRedo']` on the node model
using a stable `_elementStyleGroup` object. This ensures the picker UI stays in sync after undo.

---

### What's NOT done (explicitly deferred)

- **Full panel restructure** (ContentSection, LayoutSection, AdvancedSection, etc.) — future work
- **TokenOverrideRow / token picker** — blocked on STYLE-001 Phase 3 (TokenPicker component)
- **Override indicators** (badge showing "2 custom values") — future iteration
- **Canvas indicator** — optional, deferred

---

### Success Criteria Status

- [x] VariantSelector appears in property panel for registered element types (Button, Text, Group, TextInput, Checkbox)
- [x] Variant change applies correct styles with full undo support
- [x] SizePicker appears for types with sizes defined (Button)
- [x] Size change applies correct preset styles with full undo support
- [x] Undo/redo restores picker state correctly
- [x] Non-registered node types (logic nodes) show no ElementStyleSection
- [x] Unit tests pass for all registry operations
