# PAR-002: Properties Panel Rebuild

**Spec:** [nodegx-editor-mock.html](../phase-23-visual-refresh/mocks/nodegx-editor-mock.html) — the `.props` block. This is the deferred UIX-004b surgery, expanded to full mock parity. It is the single highest-leverage surface in the app (~40% of visible editor pixels).

## Ownership (from UIX-004 notes)

- Legacy shell + imperative header: `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/propertyeditor.ts` + `Ports.ts`
- React field renderers: `.../propertyeditor/reactcomponents/propertyeditors.{jsx,css}`
- CSS: `.../editor/src/styles/propertyeditor/propertyeditor.css` + `.sidebar-*` in `packages/noodl-editor/src/assets/css/style.css`
- UIX-003 controls (box-model `MarginPaddingInput`, toggles, chips) are consumed here — restyle/replace their presentation to mock values where they differ.

## Normative details (from mock CSS)

**Panel:** width 296px, bg-1, border-r border-1.

**Header** (`.props-head`: padding 14px 16px 12px, border-b, column gap 7px):
- Row: node name 14.5px/600 flex-1 ellipsized + two 26px icon buttons (docs `?` and delete trash, 14px stroke-1.5 glyphs).
- **Type-chip** (the UIX-004b deferral — required now): 10.5px/600 letter-spacing .03em, radius 5, padding 2.5px 7px, colored by node category: `color: var(node-category-X)`, `background: color-mix(in srgb, var(node-category-X) 12%, transparent)`, with a 10px category glyph. Label = `TYPE · CATEGORY` (e.g. `TEXT · VISUAL`). Category comes from the node's type metadata (same source the canvas painter uses for card colors — UIX-005 `CanvasTheme`). This needs markup surgery in the imperative header render path; test across ≥5 node types incl. a dynamic-port node.

**Sections** (`.section`: padding 13px 0 15px, border-b border-1, last no border; scroll container padding 6px 16px 16px):
- Title: 10.5px/600, letter-spacing .07em, uppercase, fg-3, margin-bottom 10px.
- Field rows: flex, gap 8, margin-bottom 8; label column **62px** flat, 12.5px fg-2 (UIX-004 already moved to 62px — keep).
- Text/num inputs: bg-2, border-1, radius 6, padding 5.5px 9px, 12.5px; hover border-2. Numeric: 58px wide, mono 11.5px, centered, with unit suffix (11.5px mono fg-3) outside the input.
- Selects (`.mini-select`): same box, fg-2, chevron 11px, flex-1 justify-between.

**Binding chip** (`.bind-chip`) — when a property is driven by a connection, render: accent-soft bg, accent text, radius 6, padding 6px 9px, 12px/500, link glyph 12px, `Bound to <code>Node · Port</code>` (code mono 11px). Clicking selects/reveals the source node if such navigation exists; otherwise non-interactive. The connection info exists in the model (the canvas draws the wire) — surface it here.

**Segmented icon group** (`.seg-icons`) for alignment-style enum properties: container bg-2 border-1 radius 7 padding 2px gap 1px; buttons flex-1 radius 5 padding 5px 0, fg-3, hover fg-1, pressed = accent-soft bg + accent icon. Use for the alignment rows currently rendered as bare icon rows.

**Box-model editor** (`.boxmodel`): dashed border-2 radius 8 padding 8px; `MARGIN`/`PADDING` corner tags 9.5px/600 uppercase fg-3; inputs 40px mono 11px centered radius 5 (outer bg-2, inner bg-1, inner container solid border-1 bg-2 radius 6 padding 7px 10px); **zero values muted fg-3** (`.zero`). Wire to the existing MarginPaddingInput round-trip logic — presentation only.

**Toggles** (`.toggle`): 32×19, radius 10, accent when on / border-2 when off, 14px white knob inset 2.5px. **Slider**: 4px track border-1, accent fill, 13px knob (bg-1, 1.5px accent border, shadow-sm), value suffix mono. Apply to boolean/opacity-style rows (`.toggle-row`: label flex-1, control right).

## Constraints

- Every property type that renders today must still render — sweep the full set (visual, data, logic, function, component nodes; dynamic-port nodes; string/number/enum/boolean/color/font/binding). Anything that can't adopt a mock control keeps a tokenized fallback, listed in NOTES.
- No behavior changes: edit → model update → undo → reload round-trips identical.
- The `#FFFFFF is used in 16 elements` token-hint card and variant machinery stay functional; restyle their container to section rhythm.
- Hex ratchet holds; both themes.

## Checklist

- [ ] Header + type-chip across ≥5 node types (incl. dynamic-port) 
- [ ] Section rhythm/titles/field grid per mock
- [ ] Inputs/selects/num+unit per mock
- [ ] Binding chip rendering real connections
- [ ] seg-icons for enum/alignment rows
- [ ] Box-model restyle with zero-muting, round-trip intact
- [ ] Toggles + slider per mock
- [ ] Full property-type sweep documented in NOTES; ratchet + both themes green
