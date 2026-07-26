# UIX-005: Canvas Re-palette & Node Card Redesign

## Metadata

| Field | Value |
|-------|-------|
| **ID** | UIX-005 |
| **Phase** | Phase 23 — Visual Refresh (Track I) |
| **Tier** | 2 — surfaces |
| **Priority** | 🔴 Critical (the node graph is the hero surface; it's where "2015 Noodl" lives) |
| **Difficulty** | 🔴 Hard (Canvas2D paint code, theme-awareness, diff/review surfaces must survive) |
| **Estimated Time** | 1–2 weeks |
| **Prerequisites** | UIX-001 (node/wire tokens) |
| **Branch** | `task/uix-005-canvas-repalette` |
| **Recommended executor** | 🔵 **Fable 5** — paint-code changes with cross-cutting consumers (diff UI, annotations, lessons) and a theme-bridge design decision; regressions here are the most expensive in the phase. |

## Objective

Move the node-graph canvas onto the phase palette — harmonized category colors, neutral node cards with tinted headers, signal/data-coded wires, accent selection ring, dot-grid ground — and make the painter **theme-aware**, so UIX-008's light theme reaches the graph.

## Background

The canvas is the one surface the CSS token system doesn't touch. Node colors come from a data blob in `packages/noodl-runtime/src/nodelibraryexport.js` (~lines 161–220): `colors: {nodes: {component/visual/data/javascript/default × base/baseHighlighted/header/headerHighlighted/outline/outlineHighlighted/text}, connections: {...}}` — hardcoded hex in a Solarized-adjacent palette (component `#8B4DAB`, visual `#4A7CA8`, data `#6B8F3C`, javascript `#B84D7C`). It reaches paint via `nodelibrary.ts` (`colorSchemeForNodeType()` / `colorSchemeForNodeColorName()`) into `NodeGraphEditorNodePainter.ts` (~lines 77–79). A second small palette lives in `constants/NodeGraphColors.ts` (Solarized names, ~5 consumer files: comments, connections, misc accents), plus ~8 inline literals in the painter (annotation colors for Deleted/Changed/Created, `#F57569`, whites, `#1c1c1c`). Exactly one place bridges to CSS tokens today: `CanvasRenderer.ts:264` reads `--theme-color-fg-default` via `getComputedStyle`.

Post-PLAT-001 the painter is a stateless ~610-line module with clean seams — this task is tractable *because* that decomposition happened. The mock's node card (neutral bg-1 body, 1px border, tinted 22px icon chip, name + muted type line, mono port rows with colored dots, accent ring + soft glow on selection) is the target; it is a bigger change than re-hexing, and it must be regression-checked at multiple zoom levels and against the diff/review canvases.

## Current State

- Palette: `nodelibraryexport.js` blob + `NodeGraphColors.ts` + ~8 painter literals; disconnected from CSS tokens (one `getPropertyValue` exception).
- Node rendering: saturated full-color card bodies with darker headers; white text; hard corners.
- Wires: per-type colors from the `connections` blob (`signal.normal '#006f82'` etc.); no consistent signal-vs-data coding aligned with the new palette.
- Selection/highlight: `baseHighlighted`/`headerHighlighted` variants.
- Annotation colors (diff Created/Changed/Deleted — AIX-003/SUB-007) inline in the painter.
- Health colors (error badges on nodes) exist — inventory at task start.
- The canvas ground is flat near-black; no grid.

## Desired State

- **One palette module** (suggest `packages/noodl-editor/src/editor/src/views/nodegrapheditor/canvas/CanvasTheme.ts` or similar): resolves ALL canvas colors — categories, wires, ground, grid dots, selection, annotations, text — **by reading UIX-001's CSS tokens at initialization and on theme change** (`getComputedStyle` on the documented token names), with a typed fallback table for headless/test contexts (the headless-editor-export recipe from SUB-009 runs without full CSS — verify and provide defaults). `nodelibraryexport.js`'s blob stays as the *category taxonomy + fallback values* (it's a runtime-package export consumed elsewhere — keep the shape, update the hex to the new palette for consumers that don't go through CanvasTheme), but editor paint reads CanvasTheme.
- **Category mapping** (UIX-001 tokens): visual→azure, data→emerald, javascript/function→pink, component→violet, logic/expression→amber, default→neutral. Map the *existing* category keys; do not invent new categories. Nodes whose color comes from `colorSchemeForNodeColorName()` (explicit color names) map by nearest role.
- **Node card** per mock: bg-1 body, border-1 outline (border-2 at hover), radius ~9, header = icon chip in category-soft fill + category-color glyph, node name fg-1 semibold, type line fg-3; port rows mono fg-2 with 7px colored dots (dot color = wire type); selected = accent outline + accent-soft outer glow; error badge = danger dot/chip (red allowed: it's an error). Respect existing size/metrics logic — card dimensions and port hit-targets must not shift connection anchor math (or update the anchor math with them, tested).
- **Wires:** signal = cyan token, data = emerald token, hover/selected states brighter per token pairs; connection dots at endpoints. Pending/invalid connection states keep their affordances (inventory first).
- **Ground:** bg-0 with token-colored dot grid (the mock's 20px radial dots); grid must render cheaply (pattern fill, not per-dot draws).
- **Annotations (diff/review):** Created/Changed/Deleted move to success/warning-or-accent/danger tokens; verify legibility on both themes *on the diff canvas specifically* (SUB-007 conflict UI + AIX-003 annotated components).
- **Comments/frames** on canvas (NodeGraphColors.ts consumers): re-map to the new palette; comment yellow → a calmer token-derived tint.
- **Theme-awareness contract:** a `themechanged` (or equivalent) notification re-resolves CanvasTheme and triggers a full repaint; UIX-008 depends on this hook existing and working even though only dark exists when this task ships.
- DOM overlays that float on the canvas (AI pill, zoom cluster, minimap if any) are ordinary CSS — restyle to mock here if they belong to the canvas view, or hand to UIX-004 if they're chrome (decide in inventory; don't double-claim).

## Scope

### In Scope
- [ ] Inventory: every color decision in the painter, renderer, NodeGraphColors consumers, health/error badges, connection states (NOTES.md table)
- [ ] CanvasTheme module reading CSS tokens + fallbacks; theme-change repaint hook
- [ ] Category re-mapping + `nodelibraryexport.js` hex update (shape-preserving)
- [ ] Node card redraw per mock incl. selection/hover/error states
- [ ] Wire re-coding (signal/data/hover/invalid) + endpoint dots
- [ ] Ground + dot grid
- [ ] Annotation/diff + comment colors re-mapped and verified on the diff canvas
- [ ] Zoom-level QA (25%–200%): text legibility, crisp borders on retina + non-retina
- [ ] Performance check: large corpus project pans/zooms without regression (the painter is hot code)
- [ ] Scripted-canvas screenshots for the QA corpus (per PLAT-001's scripted-canvas-driving notes)

### Out of Scope
- Canvas *behavior* (hit testing, layout, drag semantics) beyond what card metrics require
- ReactFlow or any renderer change (permanently parked)
- Node *icon glyph* set beyond category chips (UIX-007 may refine glyphs; ship with simple category glyphs)
- The node picker / create-node panel styling (DOM — UIX-004/009 territory)
- Light theme activation (UIX-008) — but the hook ships here

## Implementation Steps

1. Inventory every painted color + every consumer of `colorSchemeFor*` and `NodeGraphColors` (including diff/lesson layers). This table is the review artifact.
2. CanvasTheme module + fallbacks + theme-change hook; wire painter/renderer through it with **zero visual change** first (old values) to prove the plumbing.
3. Flip to new palette values; update `nodelibraryexport.js` hexes.
4. Node card redraw (metrics-preserving first pass; then adjust metrics + anchor math together if the design needs it).
5. Wires, ground, grid.
6. Annotations/comments; diff-canvas verification (open a real diff via the SUB-007 UI).
7. Zoom + perf + screenshot passes.

## Success Criteria

- [ ] Screenshot of the mock's node scene (Expression → Backend function → Text hierarchy) rebuilt in the real editor is visually equivalent to [mocks/nodegx-editor-mock.html](./mocks/nodegx-editor-mock.html)'s canvas
- [ ] All canvas colors resolve from CanvasTheme; `git grep` finds no orphan hex in painter/renderer paths (UIX-002's ratchet extended to these TS files or a scoped equivalent check)
- [ ] Diff canvas (SUB-007/AIX-003) renders Created/Changed/Deleted legibly; graph-native review flow visually intact
- [ ] Selection, hover, error, invalid-connection states all distinguishable; connection anchors still align with port rows at all zooms
- [ ] No measurable pan/zoom perf regression on a large project
- [ ] Theme-change hook demonstrated (toggle tokens in devtools → canvas repaints correctly)

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Card metric changes silently break connection anchor math or hit targets | Metrics-preserving first pass; anchor positions asserted via scripted canvas driving before/after |
| Headless contexts (SUB-009 preview, corpus harness, tests) lack CSS tokens and paint garbage | CanvasTheme fallback table + explicit headless test |
| Diff/review or lesson overlays assume old colors for meaning | Inventory step names every consumer; diff canvas gets its own verification slice |
| `nodelibraryexport.js` hex changes ripple to non-editor consumers | It's shape-preserving; grep consumers of the export, verify each (runtime package is shared — check preview/export paths) |
| Dot grid or soft glows tank paint performance | Pattern fills + measure; drop the glow before dropping the frame rate |
| Zoom-level text illegibility | Explicit zoom QA scope item; adjust type sizes/LOD (painter already has zoom-dependent rendering — follow its patterns) |

## References

- [mocks/nodegx-editor-mock.html](./mocks/nodegx-editor-mock.html) — the canvas target
- `packages/noodl-runtime/src/nodelibraryexport.js` (~161–220); `models/nodelibrary/nodelibrary.ts`; `NodeGraphEditorNodePainter.ts`; `constants/NodeGraphColors.ts`; `CanvasRenderer.ts:264`
- [PLAT-001](../phase-14-editor-platform-health/) — painter decomposition, listener-context rule, scripted-canvas-driving traps
- SUB-007 / AIX-003 — the diff/review surfaces that must survive
- [UIX-008](./UIX-008-LIGHT-THEME.md) — the consumer of this task's theme hook

## Checklist

- [ ] Color inventory table
- [ ] CanvasTheme plumbing (no-change proof) → new palette
- [ ] Node cards, wires, ground, annotations
- [ ] Diff canvas + headless + zoom + perf verification
- [ ] Theme-change hook demonstrated; screenshots; CHANGELOG
