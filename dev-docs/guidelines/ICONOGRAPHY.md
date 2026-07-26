# Iconography

The one icon convention for NodeGX editor chrome. Shipped by UIX-007 (Phase 23,
Track I). This is the sibling of [DESIGN-TOKENS.md](./DESIGN-TOKENS.md): tokens own
color *values*; this doc owns icon *shape, grid, and color mechanism*. Icons never
hardcode a color — they consume tokens through `currentColor`.

## The grid

| Property | Value |
|---|---|
| viewBox | `0 0 16 16` (every glyph) |
| Stroke width | `1.5` (line glyphs). 1.6–2 permitted for small carets/dots where 1.5 disappears |
| Caps / joins | `round` / `round` |
| Fill | `none` for line glyphs; `currentColor` for solid glyphs |
| Paint source | `stroke="currentColor"` (line) or `fill="currentColor"` (solid) — **never a literal hex** |
| Solid vs line | **Line by default.** Solid only for status/severity glyphs and intentional paired `*_fill` active-state counterparts (`home`/`home_fill`, `components`/`components_fill`, `setting`/`setting_fill`) |

The approved reference art lives in the phase-23 mocks
(`dev-docs/tasks/phase-23-visual-refresh/mocks/`): every glyph there is 16×16,
1.5px, `currentColor`. When adding a glyph, match that language.

## Render sizes (per context)

The component sizes the container; the 16-viewBox glyph scales to fill it, staying
crisp at any size. Recommended contexts (from the mocks): panel/menu inline **12–14**,
toolbar/panel controls **14–15**, rail **17**. The current `IconSize` enum ships
`Tiny 16 / Small 20 / Default 24 / Large 28`; most chrome uses `Tiny`. (Retuning the
enum pixel values to the exact mock sizes is a live-verified follow-up — it resizes
icons app-wide and wants a screenshot pass, so it was not done blind.)

## The component

`@noodl-core-ui/components/common/Icon` — the single, name-keyed, tree-shaking-friendly
Icon component. It is already the app's one icon primitive (≈127 consumer files).

```tsx
import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';

<Icon icon={IconName.Search} size={IconSize.Tiny} />
```

- **Name-keyed:** `IconName` enum → `assets/icons/icon-component/<name>.svg`, resolved
  via webpack `require.context`. Add a glyph = drop a conforming `.svg` in that folder
  and add its `IconName` entry. No central sprite to edit.
- **Never reference a glyph from CSS.** `background-image: url(x.svg)`, `content: url(x.svg)` and
  `-webkit-mask: url(x.svg)` all fetch the SVG as an *independent document*: it inherits nothing
  from the referencing element, `currentColor` resolves against its own root, and the glyph is
  frozen at its authored colour — invisible while the app ships one theme, a bug the moment it
  ships two. UIX-011 retired all 50 such references; `npm run icons:css` is a **hard gate at
  zero** that keeps it that way. (Inline `url(data:...)` is fine — no separate document.)
- **Size comes from the host.** `IconSize`'s class names are currently defined in no stylesheet,
  so `size={...}` is inert and an `<Icon>` has no intrinsic size — give the containing element an
  explicit box. Retuning this is UIX-010's.
- **Color:** the component sets **no** color of its own — `.Root { color: inherit }`.
  The glyph paints with `currentColor`, so it takes the ambient token color. Pass
  `variant` to opt into a semantic token (`danger`, `notice`, `success`, `proud`/
  highlight, `shy`/muted, …); the variant sets `color`, which drives both stroke and
  fill glyphs.

### States ride tokens (never hardcoded)

Hosts set `color` on context; the glyph follows. The canonical pattern is the rail /
toolbar via `IconButton` (UIX-004 state values, unchanged):

| State | Token |
|---|---|
| default | `--theme-color-fg-default` (fg-3 muted on the rail) |
| hover | `--theme-color-fg-highlight` |
| active | `--theme-color-primary` (accent, on an accent-soft pill) |

Legacy hosts that color icons with `path { fill: var(--token) }` keep working for
**solid** glyphs (the CSS `fill` overrides `currentColor`). For **stroke** glyphs they
rely on `color` inheritance — which those hosts already provide via the matching
`color` they set for the adjacent label. New hosts should set `color` (not `path { fill }`).

## Adapted glyph licenses

The redrawn stroke glyphs were transcribed from the approved NodeGX phase-23 mocks,
whose visual language is Lucide-style (16-grid, 1.5px round stroke). No third-party
SVG files were vendored; paths were authored to the mock. If a future glyph is lifted
directly from an upstream set, record it here:

| Set | License | Where used |
|---|---|---|
| Lucide (icon-family reference / metaphors) | ISC | Convention/metaphor reference only — no files vendored |
| NodeGX phase-23 mocks (authored art) | Project-internal | All redrawn `icon-component` chrome glyphs |

## Out of scope for the one component (owned elsewhere)

- **Canvas category glyphs** — painted on `<canvas>` by the node-graph painter
  (UIX-005, `CanvasIcons.ts` + `noodl-editor/src/assets/icons/canvas/`), not DOM.
  Match the visual language; do not route through this component. These are the
  only glyphs in the editor that legitimately keep a **baked** fill: an `<Image>`
  rasterised onto a 2D canvas is outside the DOM, so `currentColor` has nothing
  to resolve against. The cost is that they do **not** follow the theme — owned
  by UIX-005, see UIX-011-NOTES.md §3d.
- **Node-library node icons** — hundreds of per-node glyphs; handed to UIX-009.
- **App / OS icon** — parked.
- **AiIcon / AiIconAnimated** — animated brand mark; kept as-is.
