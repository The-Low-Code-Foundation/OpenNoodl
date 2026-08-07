# PAR-002 Notes — Properties Panel Rebuild

Executor: worktree agent off `cline-dev` tip `eeea5c2` (stale-base trap HIT again —
fresh worktree rooted at ancient `360cdc4`; fixed with `git reset --hard eeea5c2`).

## Files changed

**noodl-editor**
- `views/panels/propertyeditor/components/NodeLabel/NodeLabel.tsx` — mock `.props-head`: name row (14.5/600) + 26px icon buttons + **type-chip** (the UIX-004b deferral, now closed)
- `views/panels/propertyeditor/utils.ts` — `getNodeTypeChipInfo`, `getConnectionSourceLabel`, `getConnectionSourceNavigate`
- `views/panels/propertyeditor/index.tsx` — panel ground bg-1 (both normal + AI variants)
- `views/panels/propertyeditor/components/PropertyGroups.tsx` — section markup to classes (no inline label/margins)
- `views/panels/propertyeditor/components/MarginPaddingInput.tsx` — `.zero` / `.inner-box` classes (presentation only; read/write path untouched)
- `views/panels/propertyeditor/components/AlignToolsInput.tsx` — container → `.align-tools-seg` (mock `.seg-icons`)
- `views/panels/propertyeditor/components/NumberUnitInput.tsx` — numeric input `isNumeric` (mono 11.5 centered)
- `views/panels/propertyeditor/DataTypes/BasicType.ts`, `DataTypes/EnumType.ts` — binding-chip `connectionLabel` + `onConnectionClick`
- `styles/propertyeditor/propertyeditor.css` — header/chip/section-rhythm/dropdown-card/code-button; dead header classes removed (`.property-header-bar-label`, `.header-name-edit-container`, `.property-panel-header-edit-button` — zero consumers)
- `assets/css/style.css` (sanctioned `.sidebar-*` + propertyeditor legacy blocks only) — `.sidebar-panel` bg-1; `.marginpadding-*` mock `.bm-input` metrics; `.align-icon*` seg-icons treatment; `.size-icon.sel` accent; `.color-thumbnail` kit border/radius

**noodl-core-ui** (the property-panel field-renderer family — this IS the live render
path for propertyeditor rows; `reactcomponents/propertyeditors.{jsx,css}` named in the
spec is a near-dead legacy path only consumed by TextStylePopup and was left alone)
- `property-panel/PropertyPanelBaseInput` (+scss) — mock `.input` box (bg-2/hairline/radius-6/5.5×9/12.5px, hover border-strong, focus accent); `is-numeric`; `has-small-text` = muted mono (mock `.unit`)
- `property-panel/PropertyPanelInput` (+scss) — 62px label column **scoped to `:global(.sidebar-property-editor)`** (settings panels keep 37%); boolean rows = mock `.toggle-row` (label flex, control right)
- `property-panel/PropertyPanelCheckbox` (+scss) — rebuilt as mock 32×19 toggle (accent on / border-strong off / 14px white knob inset 2.5, `role="switch"`); same boolean contract
- `property-panel/PropertyPanelSliderInput` (+scss) — mock `.slider-row`: slider first, mono readout right; track remainder border-default
- `property-panel/PropertyPanelIconRadioInput.module.scss` — segments fill the track, padding 5px 0
- `property-panel/PropertyPanelSelectInput.module.scss` — options as raised card (bg-1/hairline/radius/shadow-popup)
- `property-panel/PropertyPanelTextArea.module.scss`, `PropertyPanelNumberInput.tsx`, `PropertyPanelLengthUnitInput.tsx` — input-box adoption / `isNumeric`
- `StyleSuggestions/SuggestionBanner.module.scss` — token-hint card to section rhythm; accept button text → on-primary
- `styles/custom-properties/colors.css` — added `--base-color-white` (theme-invariant knob; ratchet-excluded file). **No token-value drift found** — dark/light values already match the mock exactly.

## Type-chip category resolution

Same source as the canvas painter (`NodeGraphEditorNodePainter`):
`model.metadata?.colorOverride || model.type.color || 'default'` over the existing
taxonomy (component / visual / data / javascript / default; `javascript` maps to the
*function* token, matching UIX-005 — no `logic` key exists). Type name =
`metadata.typeLabelOverride || type.displayName || type.name` (same as the canvas
sub-label). Chip = `color: var(--theme-color-node-category-X)` + `background:
color-mix(in srgb, … 12%, transparent)`, 10.5/600/.03em, radius 4 (nearest token to the
mock's 5), 10px glyph mirroring the canvas category glyph shapes. Default/unknown
categories render muted (fg-muted) with type name only — honest, no invented category.
Static-only verification; needs the orchestrator's ≥5-node-type live pass (incl. a
dynamic-port node — chip reads only `type`-level metadata so dynamic ports are safe by
construction).

## Binding-chip lookup

`getConnectionSourceLabel(parentModel, portName)`: unwraps ModelProxy → NodeGraphNode,
scans `node.owner.connections` for `toId === node.id && toProperty === portName`,
resolves the source via `owner.findNodeWithId`, labels as
`${source.label} · ${outputPort.displayName || name}` (`+N` suffix when multiple
connections drive one port). `getConnectionSourceNavigate` returns a click handler that
selects the source node via `NodeGraphContextTmp.nodeGraph.findNodeWithId` +
`selectNode` — the spec's "selects/reveals if navigation exists". Wired where the chip
actually renders: `PropertyPanelInput`'s `showBindingChip` path → **BasicType**
(string/number, via `PropertyPanelInputWithExpressionModal` prop passthrough) and
**EnumType**. Types that don't route through `PropertyPanelInput` keep their existing
connected treatment (outline) — see sweep table.

## Property-type sweep (static; every registered `viewClassForPort` branch)

| Editor type (Ports.ts registry) | Renders via | Mock control adopted |
|---|---|---|
| BasicType (string/number) | PropertyPanelInput → Text/Number | ✅ input box; number mono/centered; **binding chip w/ source** |
| BooleanType | PropertyPanelInput → Checkbox | ✅ 32×19 toggle, toggle-row layout |
| EnumType | PropertyPanelInput → Select | ✅ mini-select box + card dropdown; **binding chip w/ source** |
| AlignToolsType | AlignToolsInput | ✅ seg-icons segmented control |
| SizeModeType | SizeModeInput (`.size-icon`) | ✅ pressed = accent-soft (kept 4-icon glyph row; not literally seg-icons — glyphs are composite boxes) |
| MarginPaddingType | MarginPaddingInput | ✅ mock box-model: dashed outer, tags, 40px mono, zero-muted, inner bg-1; round-trip logic untouched |
| NumberWithUnits / Dimension | NumberUnitInput | ✅ mono numeric + muted-mono unit select; connected = outline **fallback** (no chip — row not on PropertyPanelInput; listed deferral) |
| TextAreaType | PropertyPanelTextArea | ✅ input-box adoption; connected = outline fallback |
| CodeEditorType / array | `.property-codeeditor-button` | ✅ input-box treatment on the launch button |
| ColorType | ColorInput (PickerTextInput + swatch) | ✅ input box + bordered/rounded swatch |
| ImageType / IconType / FontType / TextStyleType / ComponentType / SourceCodeType / IdentifierType | PickerTextInput → BaseInput | ✅ input box (pickers/popouts unchanged) |
| VariableType | VariableInput → SelectInput | ✅ via kit |
| ResizingType | ResizingInput (`.resizing-*`, `.marginpadding-border`) | ✅ inherits kit inputs + box chrome; pin diagram = tokenized fallback |
| CurveType | PropertyPanelRow + canvas editor | tokenized **fallback** (bezier editor untouched) |
| QueryFilterType / QuerySortingType / ByobFilterType | queryeditor.css / ByobFilterBuilder | tokenized **fallback** (own UI family) |
| PagesType / PropListType / StringListType | pages.css / proplist.css / list rows | tokenized **fallback** (list-item chrome, gets bg-1 ground + kit inputs where embedded) |
| LogicBuilderWorkspaceType / LogicBuilderHiddenType | button / renders nothing | unchanged |
| PopoutGroup / TabGroup | PropertyPanelInput Button / PropertyTabs | unchanged (buttons excluded from chip by design); **popout-hosted rows keep the 37% label** (popouts render outside `.sidebar-property-editor`) |
| Variants / VisualStates / ElementStyleSection + SuggestionBanner | own components | functional, restyled container rhythm (banner card, 16px gutter); variant machinery untouched |

## Deferrals (all deliberate, none silent)

1. **NumberUnitInput/TextArea/Picker rows show no binding chip** when connected —
   they don't render through `PropertyPanelInput`; they keep the primary-dim outline.
   Converting them to the chip means replacing whole rows, risking the
   drag/unit/fixed-checkbox behaviors — presentation-only rule wins.
2. **Panel width 296px** not enforced — width belongs to the splitter/SidePanel host
   (PAR-003 / user-resizable); panel renders correctly at any width.
3. **Mock radii 5/7px** mapped to nearest tokens (4/6) per README rule instead of
   adding new radius steps.
4. **SizeModeType** keeps its composite box-glyph row (accent pressed state applied);
   literal seg-icons would need new single-glyph icons (UIX-007 territory).
5. **`reactcomponents/propertyeditors.{jsx,css}`** untouched — only consumer is
   TextStylePopup (not the panel); flagged for deletion later.
6. **Icon buttons in header are core-ui `IconButton`** (shared with PAR-003) — sized
   by 26px wrappers; IconButton internals untouched.
7. Chip background uses `color-mix` (per spec) — requires Chromium ≥111; fine for the
   bundled Electron.

## Verification

- `tsc --noEmit` (noodl-core-ui + noodl-editor): zero errors in touched files
  (remaining = pre-existing missing-workspace-module errors: `@noodl-versioning`,
  `@noodl-store/*`, `@noodl-viewer-cloud/*`).
- `npm run colors`: **holding** — noodl-editor 16/16, canvas-paint-ts 2/2, core-ui 0;
  no new exemptions; `--base-color-white` lives in the ratchet-excluded token file.
- Both themes via tokens only; the one literal added is deliberately theme-invariant.
- NOT run (worktree lerna trap): live editor. Orchestrator live QA needed for: 62px
  label grid across node types, chip on ≥5 node types, binding chip on a connected
  property, box-model round-trip/undo, toggle/slider/seg interactions, variant edit
  mode, both themes.
