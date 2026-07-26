# UIX-005 Notes — Canvas Re-palette & Node Card Redesign

Date: 2026-07-26. Executor: Fable 5, worktree branched from `cline-dev`.

## Step 1 — Color inventory (the review artifact)

Every color decision on the node-graph canvas before this task, with its disposition.
"CanvasTheme" = the new module at
`packages/noodl-editor/src/editor/src/views/nodegrapheditor/canvas/CanvasTheme.ts`.

### A. The palette blob (`packages/noodl-runtime/src/nodelibraryexport.js` ~161–220)

Flow: viewer runtime `generateNodeLibrary()` → ViewerConnection → `NodeLibraryImporter`
→ `window.NodeLibraryData` → `NodeLibrary.loadLibrary()` → `colorSchemeFor*()`.

| Key | Old value(s) | Consumers | Disposition |
|---|---|---|---|
| `colors.nodes.component` (base/baseHighlighted/header/headerHighlighted/outline/outlineHighlighted/text) | `#8B4DAB` family | painter (via `colorSchemeForNodeType/-ColorName`), NodePickerNode.tsx, ConnectionBar.tsx, NodeReferencesPanel.tsx | Hexes re-tuned to violet family (shape-preserving). Editor *paint* no longer reads the blob — painter maps category → CanvasTheme. DOM consumers (picker/connection popup/references panel) keep reading the blob and get the harmonized hues. |
| `colors.nodes.visual` | `#4A7CA8` family | same | → azure family |
| `colors.nodes.data` | `#6B8F3C` family | same | → emerald family |
| `colors.nodes.javascript` | `#B84D7C` family | same | → pink family |
| `colors.nodes.default` | `#6C6F79` family | same | → neutral family |
| `colors.connections.signal` | normal `#006f82`, highlighted `#7ec2cf`, pulsing `#ffffff` | Connection paint + painter plugs (via `colorSchemeForConnectionType`), ConnectionBar | → cyan wire pair (`#35C3E8`/`#7AD8F0`), pulsing white. Editor paint reads CanvasTheme instead. |
| `colors.connections.default` | normal `#875d00`, highlighted `#e5ae32`, pulsing `#ffffff` | same | → emerald data pair (`#45D08A`/`#7DE0AC`). |

Category key facts (checked): node registrations use exactly `component`, `visual`, `data`,
`javascript` (expression.js is `color: 'javascript'`), plus no-color → `default`.
`colorSchemeForNodeColorName()` is only ever fed `'data'` (AiAssistantModel colorOverride
hack) — maps by the same key. There is **no `logic` key**; the spec's "logic/expression→amber"
has no existing key to land on (expressions are `javascript` → pink; spec's "map existing
keys, invent none" wins over the mock's amber Expression chip). Amber remains
warning/Changed-annotation only on canvas.

Non-editor consumers of the export grepped: `noodl-runtime/noodl-runtime.js getNodeLibrary()`,
`noodl-preview/src/headless.ts` (JSON pass-through into `window.NodeLibraryData` — shape only),
editor tests (`tests/nodegraph/*` use their own fixture library). All shape-dependent only;
hex change is safe.

### B. `nodelibrary.ts` `loadLibrary()` fallback schemes (lines ~130–142)

| Old | Used when | Disposition |
|---|---|---|
| nodes.default `{base '#485e65', text '#93a1a1'}` | library loads without colors (headless/tests) | → new neutrals `{base '#222933', text '#a6b0bb'}` |
| connections.default `{normal '#916311', highlighted '#ffa300'}` | same | → data pair `{'#45d08a'/'#7de0ac'}` |

### C. `constants/NodeGraphColors.ts` (Solarized names)

Actual consumers found (grep): **only 2 files** — CanvasRenderer.ts and
NodeGraphEditorConnection.ts (the spec's "~5 consumers" counts pre-PLAT-001 files).

| Name | Value | Use | Disposition |
|---|---|---|---|
| `yellow` `#ffa300` | drag-connection line + endpoints (CanvasRenderer 193/224) | → CanvasTheme.dragLine (primary/azure token) |
| `red` `#dc322f` | connection delete marker fill (Connection 407) | → CanvasTheme.danger (destructive = red allowed) |
| `base2` `undefined` (!) | delete-marker X stroke (Connection 412) — latent bug, stroke silently kept previous style | → CanvasTheme.deleteMarkerGlyph (white) |
| `multiSelect` `#aaaaaa` | rect-select dashed box (CanvasRenderer 122) | → CanvasTheme.multiselect (fg-muted token) |
| `darkyellow/orange/magenta/violet/blue/cyan/green` | **no consumers** | file deleted |

### D. Painter inline literals (`NodeGraphEditorNodePainter.ts`)

| Literal | Use | Disposition |
|---|---|---|
| `#F57569` (×2) | annotation Deleted + unhealthy-node dashed border | → CanvasTheme.annotationDeleted / danger (danger token) |
| `#83B8BA` | annotation Changed | → warning token (amber). Azure was rejected: it would collide with the accent selection ring on the diff canvas. |
| `#5BF59E` | annotation Created | → success token |
| `#1c1c1c` | annotation badge glyph ink | → CanvasTheme.annotationBadgeGlyph (bg-0 token → dark ink on colored badge, flips with theme) |
| `#ffffff` (selection/border stroke, 315) | selected/drag-affordance ring | → selection = primary token + soft glow (selected only) |
| `#ffffff` (borderHighlighted dot, 279) | connection-drag start dot | → CanvasTheme.selection / portText |
| `rgba(255,255,255,0.3)` | port-dot inner highlight | removed (flat 3.5px dots per mock) |
| hard-light `nc.text` overlay @0.19 | hover/selection plate | removed — replaced by cardBgHover (bg-2) body fill |

### E. Connection inline literals (`NodeGraphEditorConnection.ts`)

| Literal | Use | Disposition |
|---|---|---|
| `#F57569`/`#83B8BA`/`#5BF59E` | annotated wires (Deleted/Changed/Created) | → danger/warning/success tokens (same map as nodes; dash/width shape cues from AIX-003 kept) |
| `#ffe85d` | debug-inspector pulse fallback | → CanvasTheme.wirePulse (fg-highlight) |
| dashed unhealthy wires | affordance | kept (color unchanged logic, still type-colored) |

### F. CanvasRenderer literals

| Literal | Use | Disposition |
|---|---|---|
| `#ffffff` insert indicator (92) | child-insert location bar | → primary token |
| `#504f4f` hierarchy lines (144) | parent→child spine | → border-strong token (#37404c — exactly the mock's spine color `--border-2`) |
| `#000` @0.6 scrim (172) | dim background while dragging a connection | → CanvasTheme.scrim (bg-page token @ .6 — light theme gets a light haze) |
| `black` shadow + `white` fill (253–258) | multiselect AABB shadow trick | kept as-is (the fill is clipped away; shadow color stays black on both themes — acceptable, noted for UIX-008) |
| `getComputedStyle(--theme-color-fg-default)` (264) | multiselect box stroke — the one pre-existing token bridge | → CanvasTheme.multiselectBox (same token, now cached instead of per-paint getComputedStyle) |

### G. Health / error badges

- Node health: dashed `#F57569` border (painter 300) → danger token, dashes kept.
- Warning icon (`warning_triangle.svg`, neutral `#F5F5F5` glyph) drawn top-right via
  CanvasIcons — kept (neutral glyph, no red baked in).
- Connection health: dashed line kept.
- Red usage audit on canvas after this task: danger token appears ONLY for unhealthy
  node/connection, Deleted annotation, and the connection delete marker. Phase law holds.

### H. Ground

- `.nodegrapgeditor-bg` CSS was `--theme-color-bg-1` → now `--theme-color-bg-0`.
- Dot grid painted on canvas (not CSS) so it pans/zooms with the graph: 20px cell,
  1px-radius dot, `ctx.createPattern` tile (one `fillRect` per frame — no per-dot draws),
  tile rebuilt only on theme refresh. Dot color = fg-highlight @ .07 (dark) / .10 (light),
  matching the mock's `--dot`. Grid skipped below 40% zoom (sub-pixel noise/LOD).

### I. Not canvas paint (decided in inventory, NOT claimed by UIX-005)

| Surface | Why left | Owner |
|---|---|---|
| CommentLayer (React DOM) | already fully token-driven (`--theme-color-node-*-3` etc. via CSS vars + getComputedStyle); theme-aware for free | stays; palette values shift only if UIX-002 remaps those aliases |
| ConnectionPopups `arrowColor #464648`, popup DOM | popup chrome | UIX-004 |
| Canvas tabs, EditorBanner, HighlightOverlay, ExecutionOverlay, NodeGraphComponentTrail, HelpCenter/Clippy layers | React DOM overlays with own stylesheets = chrome | UIX-004 |
| AI panel / node picker / create-node panel | DOM | UIX-004/009 |
| Zoom cluster / minimap | none exist as canvas-view DOM today (zoom lives in chrome) | UIX-004 |
| NodePickerNode / ConnectionBar / NodeReferencesPanel colorScheme reads | DOM consumers of the blob; they inherit the harmonized blob hues, restyle beyond that is UIX-009 | UIX-009 |
| `portIcons.ts` | exported helper with no callers (colors are parameters) | n/a |

## Step 2+ decisions

- **CanvasTheme**: singleton; resolves every color from UIX-001 tokens via one
  `getComputedStyle(document.documentElement)` pass, with a full typed fallback table
  (dark literals) for headless/no-CSS contexts (SUB-009 headless export, Electron test
  pages). Listener contract follows the PLAT-001 context rule: `on(listener, context)` /
  `off(context)`.
- **Theme-change hook (UIX-008 contract)**: any of
  (a) `CanvasTheme.instance.refresh()`,
  (b) `window.dispatchEvent(new CustomEvent('nodegx:themechanged'))`,
  (c) toggling a class on `<html>` (MutationObserver on `class`)
  re-resolves all colors, invalidates the grid pattern, and notifies listeners.
  `NodeGraphEditor` subscribes in its constructor and calls `repaint()`; detached in
  `dispose()`.
- **Fonts**: canvas text moves off the `Inter-*` per-weight families (UIX-001 demoted
  them; canvas `ctx.font` strings were the last hidden dependency) onto the system stack
  (node name 600 12.5px, type line 10.5px, port rows 10.5px mono) — defined once in
  CanvasTheme and used by BOTH the measure path (`NodeGraphEditorNode.titlebar*Height`)
  and the draw path, so wrap math and paint can never disagree.
- **Anchor math**: preserved by construction — port-row Y (`titlebarHeight() +
  index*propertyConnectionHeight + …`) and node edges are computed from the same
  functions by painter, connection paint, measure and hit-testing. The only metric
  changes: corner radius 6→9 (cosmetic, no anchor input) and header text inset
  10→37px to make room for the 22px icon chip — the inset is applied to BOTH
  `titlebarLabelHeight`/`titlebarSublabelHeight` (measure) and the painter (draw)
  via shared statics, so titlebar height stays self-consistent; chip (22px + 7px
  insets = 36px) fits exactly inside the existing minimum titlebar height
  (14 + 22 = 36) without changing the height formula.
- **Wires**: signal → cyan pair, everything else → data/emerald pair (the old blob also
  only distinguished signal vs default). 3px endpoint dots at both curve ends, wire-colored
  (annotation color when annotated). Unhealthy = dashed (kept), delete marker = danger.
- **Plumbing proof**: commit 2 routes all paint through CanvasTheme while the theme
  serves the OLD literal values (no token reads) — byte-identical rendering; the token
  flip + new palette land in later commits.

## Verification record (in-worktree)

- `typecheck:editor`, `typecheck:runtime`, `typecheck:editor-tests` — green.
- `catalog:check` — committed catalog unchanged (the blob edit is colours only).
- **Headless proof (scripted, esbuild-bundled CanvasTheme under plain Node)**:
  every colour resolves to its dark fallback with no DOM; `gridPattern()` degrades to
  `undefined` (renderer guards); listener registers/fires/detaches by context;
  found+fixed a real crash where a context provides `document` but not `window`
  (guards are now independent per global).
- **Light-token simulation** (fake `getComputedStyle` serving the UIX-001 light
  values): `isDark` flips, grid dot goes ink @ .10, wire highlights deepen instead of
  brighten, unset tokens fall back per-token. This is the exact path UIX-008 will hit.
- **Scoped orphan-hex check** over `nodegrapheditor.ts` + `nodegrapheditor/**` +
  `canvas/**`: zero hex outside CanvasTheme's fallback table except
  `ConnectionPopups.ts` `arrowColor '#464648'` (DOM popup chrome — UIX-004 per
  inventory) and doc-comment examples. `NodeReferencesPanel.tsx` carries a hardcoded
  fallback `outlineHighlighted '#b58900'` (DOM, UIX-009 territory) — noted, untouched.
- Electron editor suite (`test:ci`) run from the worktree — includes the PLAT-001
  canvas characterisation specs, which assert viewport/hit-test/anchor math in
  nodeSize-relative terms (result recorded in the task report).

## Anchor-math argument (for the reviewer)

All four consumers of card geometry — painter, connection paint, `measure()`, and
hit-testing — derive port-row Y as
`titlebarHeight() + index * propertyConnectionHeight + propertyConnectionHeight/2 + verticalSpacing`
and card edges from `nodeSize`. This task changed none of those formulas. What changed:
(1) label wrap *inputs* (font + max width) — but measure and draw share the new values
through `NodeGraphEditorNode.headerTextInset` / `CanvasFonts`, so `titlebarHeight()`
shifts consistently everywhere at once (nodes with long labels may wrap at different
points than before — that is a *size* change, not a *consistency* change);
(2) corner radius 6→9 — no anchor input;
(3) port dot radius 6→3.5 — visual only; hit targets are the drag-area/border zones,
not the dots.

## Still needs LIVE verification (orchestrator, from the primary checkout)

1. Screenshot-vs-mock: rebuild the mock's scene (Expression → Backend function → Text
   hierarchy) and compare against `mocks/nodegx-editor-mock.html`'s canvas.
2. Diff canvas: open a real SUB-007 diff + AIX-003 annotated component; confirm
   Created/Changed/Deleted (now success/warning/danger) legible on the neutral cards
   and that the accept/reject flow reads correctly.
3. Zoom QA 25–200%: label legibility (12.5px system stack), 1px borders on
   retina/non-retina, grid appearance across zoom, grid LOD cutoff at 40%.
4. Perf: large corpus project pan/zoom — the glow is two strokes and the grid one
   pattern fillRect, but measure; drop the glow before dropping frame rate.
5. Theme toggle: flip a class on `<html>` (or dispatch `nodegx:themechanged`) in
   devtools → canvas repaints with re-resolved colours.
6. Long-label nodes: wrap points changed with the font/inset change — eyeball crowded
   cards (name + right-side status icons + comment icon).
7. Node picker / connection popup / references panel with the harmonized blob hues
   (they kept their old visual structure by design — UIX-009 restyles them).
8. CHANGELOG-COMMUNITY entry: deferred to the phase-23 wrap (concurrent UIX tasks
   would collide in the narrative file; orchestrator owns the phase story).
