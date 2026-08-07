# STYLE-002: Element Configs & Variants - Changelog

## 2026-02-18 - Phase 1, 2 & 3 Complete

---

### Phase 1: Config System Architecture

#### New Files

**`packages/noodl-editor/src/editor/src/models/ElementConfigs/`**

- **`ElementConfigTypes.ts`** — TypeScript interfaces for the config system:

  - `StateStyles` — hover/active/focus/disabled/placeholder style maps
  - `VariantConfig` — base styles + optional `states` object
  - `SizePresets` — named size override maps
  - `ElementConfig` — full config for a node type (defaults + sizes + variants)
  - `ResolvedVariant` — base styles + states after stripping the `states` key

- **`ElementConfigRegistry.ts`** — Singleton registry:

  - `register(config)` — add a config
  - `get(nodeType)` / `has(nodeType)` / `getAll()` — lookup
  - `getVariantNames(nodeType)` — returns `string[]` of available variant names
  - `resolveVariant(nodeType, variantName)` → `ResolvedVariant | undefined`
  - `applyDefaults(node, typeName)` — stamps defaults + initial variant onto a node's `parameters`
  - `applyVariant(node, typeName, variantName)` — stamps a variant's base styles + updates `_variant` marker
  - All built-in configs auto-registered on module load

- **`configs/ButtonConfig.ts`** — Button (`net.noodl.controls.button`):

  - Variants: primary, secondary, outline, ghost, destructive, link
  - Size presets: sm, md, lg, xl
  - Interaction states: hover, active, disabled per variant

- **`configs/GroupConfig.ts`** — Group (`net.noodl.visual.group`):

  - Variants: default, card, section, inset, flex-row, flex-col, centered

- **`configs/TextConfig.ts`** — Text node:

  - **BUG FIX**: defaults now include `width: auto`, `flexShrink: 1`, `flexGrow: 0`, `minWidth: 0`
    (previously: implicit `width: 100%` caused Text elements to push siblings off-screen in row layouts)
  - Variants: body, heading-1 through heading-6, muted, label, small, code, lead, blockquote

- **`configs/TextInputConfig.ts`** — TextInput (`net.noodl.controls.textinput`):

  - Variants: default (with focus ring), error

- **`configs/CheckboxConfig.ts`** — Checkbox (`net.noodl.controls.checkbox`):

  - Variant: default

- **`configs/index.ts`** — barrel export
- **`index.ts`** — public module export

---

### Phase 2: Node Creation Integration

#### Modified

- **`views/NodePicker/NodePicker.utils.ts`** — Added `ElementConfigRegistry.applyDefaults(node, type.name)` call in `createNodeFunction`, immediately after `NodeGraphNode.fromJSON(...)`. This is the **single entry point for all user-initiated node creation** — no changes needed to NodeGraphModel or project loading paths.

  - Safe for existing projects: defaults only stamp properties not already set
  - No-op for node types without a registered config
  - Works for root nodes, child nodes, and auto-attach-to-root paths

---

### Phase 3: VariantSelector UI Component

#### New Files

**`packages/noodl-core-ui/src/components/inputs/VariantSelector/`**

- **`VariantSelector.tsx`** — Controlled dropdown component:

  - Props: `variants: string[]`, `currentVariant: string | undefined`, `onVariantChange: (name) => void`, `disabled?`, `label?`
  - Keyboard accessible (Escape to close)
  - Closes on outside click
  - Formats variant names for display (`heading-1` → `Heading 1`)
  - Active variant shown with checkmark + primary color highlight

- **`VariantSelector.module.scss`** — Styled with design tokens exclusively (no hardcoded colors)

- **`index.ts`** — barrel export

---

### What's Pending

#### Property Panel Integration (STYLE-004)

Wiring `VariantSection` into the property editor requires understanding the legacy `TypeView.js` / `propertyeditor.ts` system. The `VariantSelector` component is built and ready — integration is scoped to STYLE-004 which covers Property Panel UX overhaul.

#### State Styles (Phase 4)

`StateStyles` (hover, focus, active, disabled) are defined in all configs and stored in `ResolvedVariant.states`. Applying them at runtime requires investigation of the existing visual states system in `noodl-viewer-react`. Scoped to STYLE-004.

---

## Key Discoveries

- **NodePicker.utils.ts is the sole user-initiated node creation path** — all `addRoot`/`addChild` calls with `{ undo: true, label: 'create' }` flow through `createNodeFunction`. No need to touch NodeGraphModel.
- **NodeGraphNode.parameters is a plain object** — not getter/setter based. The registry uses direct `node.parameters[key]` access.
- **Loading vs creation differentiation**: when loading from JSON, `NodeGraphNode.fromJSON` pre-populates parameters before `addRoot` is called. The `applyDefaults` guard (`if param === undefined`) ensures existing project nodes aren't affected.
- **Text node width issue**: the `defaultCss` in `text.js` only has `{ position: 'relative', display: 'flex' }`. The width issue comes from dimension port defaults. Stamping `width: auto` + flex props via `applyDefaults` fixes it for newly created nodes.

---

_Started: 2026-02-18_
