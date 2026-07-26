# UIX-007 Notes — Iconography Normalization

Executor: Opus 4.8 (1M), worktree off `cline-dev`.

## Stale-base trap: HIT and fixed
Fresh worktree was rooted at `360cdc4` (ancient — no phase-23 files, no spec). Ran
`git reset --hard e2cace6` (safe: pristine worktree). Now rooted at the cline-dev tip.

## Convention (the target)
From the approved mocks (`mocks/nodegx-editor-mock.html`, `nodegx-launcher-mock.html`):
**every** glyph is `viewBox="0 0 16 16"`, `stroke="currentColor"`, `stroke-width="1.5"`
(1.6–2 for tiny carets), `stroke-linecap/linejoin="round"`, `fill="none"` — except
status/severity which are `fill="currentColor"` solids. Documented for the codebase in
`dev-docs/guidelines/ICONOGRAPHY.md` (new sibling of DESIGN-TOKENS.md; DESIGN-TOKENS.md
itself untouched — that is UIX-008's color/theme territory).

## The one component (already existed — normalized, not replaced)
`@noodl-core-ui/components/common/Icon` is the app's single name-keyed icon primitive
(~127 consumer files: 78 in noodl-editor, 49 in noodl-core-ui). It is tree-shaking-friendly
(webpack `require.context` over `assets/icons/icon-component/*.svg`, one glyph per file,
no central sprite). Kept the contract; normalized the **color mechanism**:

- **Before:** every SVG hardcoded `fill="#F5F5F5"` (or `#B8B8B8`/`#9F9F9F`); color was
  driven by `path { fill: var(--token) }` rules in `Icon.module.scss` + each host. This
  works only for *filled* paths — it cannot color a 1.5px stroke glyph.
- **After:** all 149 glyphs paint with `currentColor`. `Icon.module.scss` `.Root` sets
  `color: inherit` (component hardcodes **no** color); `variant` sets `color`; hosts set
  `color` on context. One mechanism drives both stroke and solid glyphs, and states ride
  the existing tokens (default fg / hover fg-highlight / active accent — UIX-004 rail
  pattern, token **values unchanged**).
- `IconButton.module.scss` migrated `path { fill: var(--token) }` → `.Icon { color: var(--token) }`
  for every state/variant (rail + toolbar). This is the load-bearing host — the rail
  (`SideNavigation`) and toolbar (`EditorTopbar`) both render through it. No token value
  changed; only the CSS property carrying the token. Hex ratchet unaffected (no hex added).

## Inventory triage (grep-driven)

| Icon source | Where used | Verdict |
|---|---|---|
| `noodl-core-ui/src/assets/icons/icon-component/*.svg` (149) | THE Icon component; 127 consumers | **KEEP as the one set.** All → `currentColor`. 57 chrome/alignment glyphs redrawn to 16×16 stroke grid (below). |
| `Icon.module.scss`, `IconButton.module.scss` | Icon primitive + rail/toolbar host | **NORMALIZE** to `currentColor`/`color` (done). |
| `noodl-editor/src/assets/icons/*.svg` (86 top-level) | Legacy CSS `background-image: url()` in 13 `.css`/`.scss` (componentspanel, layoutpanel, propertyeditor, deploypopup, …) + a couple `img`/inline | **INVENTORY → follow-up.** A separate CSS-background icon system; migrating to the component is legacy-view surgery (imperative `View` subclasses). Not deleted — live CSS consumers would fail silently at runtime, violating "break loudly". Handed to the phase tail / UIX-009. |
| `noodl-editor/src/assets/icons/editor/*.svg` (27, e.g. `warning_22`, `refrsh_24`, `push_pin_*`, `search_22`) | Legacy chrome, mixed native sizes, CSS/inline | **REDRAW-CANDIDATES for a follow-up.** Concept duplicates of core-ui glyphs (search/close/plus/refresh/warning/split/cloud/question). Should be retired onto the component; deferred (legacy consumers, no clean import path). |
| `noodl-editor/src/assets/icons/icon-button/*.svg` (5) | grep found **no** live consumer | **DELETE-CANDIDATE** (unreferenced). Left in place this pass to avoid a blind delete without a runtime confirm; flagged. |
| `noodl-editor/src/assets/icons/core-ui-temp/*.svg` (~140 dup of icon-component) | `CanvasIcons.ts` (canvas painter — UIX-005) + `componentspanel.css` | **DO NOT TOUCH.** Feeds the `<canvas>` category glyphs (UIX-005 owns; painted, not DOM) and one legacy CSS. Not my territory. |
| `noodl-editor/src/editor/codicon.ttf` + `codicon.md` | none (grep clean; Monaco was fully retired in DEBT-013) | **DELETED** — dead Monaco/VSCode remnant. |
| `AiIcon` / `AiIconAnimated` (core-ui) | AI assistant | **KEEP** — animated brand mark, own convention. |
| `portIcons.ts` / `CanvasIcons.ts` (editor) | canvas painter | **UIX-005** territory (painted glyphs). Not DOM chrome. |
| Node-library node icons (`ComponentIcon.ts` + per-node art) | node picker / graph / components panel | **UIX-009** (see handoff below). Out of scope — do not redraw hundreds. |

## Redrawn to the 16×16 / 1.5px round-stroke grid (57 glyphs, in place)

Transcribed from the approved mock art, so metaphors and proportions are the approved
ones. Redrawn **in place** (same filename, same `IconName`) → **zero consumer migration,
no orphaned set, nothing half-migrated**.

`plus, minus, close, check, caret_down/up/left/right, caret_down_up, arrow_up/down/left/right,
arrow_line_up/down/left/right, home, home_fill, search, setting, setting_fill, code, bug,
trash, copy, refresh, reset, external_link, link, pencil, pencil_line, dots_three,
dots_three_horizontal, vertical_split, horizontal_split, columns, components, components_fill,
component, question, question_free, warning_triangle*, warning_circle, warning_circle_filled*,
align_item_left/center/right, text_align_left/center/right, justify_content_start/center/end/
space_between/space_around/space_evenly`

(* = kept **solid** by convention: status/severity. `*_fill` variants = intentional
paired active-state solids.) The alignment + `justify_content_*` set is UIX-003's
segmented-control glyphs, redrawn to the grid as required.

## Remaining icon-component glyphs (92): `currentColor`, grid redraw deferred
These now inherit color correctly (theme-aware) but keep their original *filled* drawing.
They are node-type / decorative glyphs, i.e. **UIX-009 territory** — do not belong to the
chrome redraw. Families: `button, checkbox(_filled), radiobutton(_group[_line]), dropdown(_lines),
text_input, text_in_box, page_router, page_input_arrow, image, video, icon, ui, seo, rest_api,
cloud_check/data/download/upload/function, sliders(_horizontal/_filled), structure_circle, star,
circle_open/dot, square(_filled/_half), nested_component, component_with_children, cards, palette(_fill),
roll, rocket, stash, navigate, note_pencil, collaboration, chat(_fill), file(_fill/_filled),
folder_open/closed, device_desktop/laptop/phone/tablet, dimension*, border_*, rounded_corner_*,
viewport_*, import_*, plus_circle/square, pause_circle, play(_circle), grip, user, group,
arrows_in_line_*, search_corner/grid/square, magic_wand→(drawn stroke), logo (brand #ffffff kept)`.

## Node-library icon triage → handed to UIX-009
- **`ComponentIcon.ts`** maps component kinds to `IconName` (`Page → File`, `noodl.cloud.request
  → CloudFunction`, `Visual → 2`). These reference core-ui glyphs (now `currentColor`) — fine.
- **Node-type glyphs in `icon-component`** listed above (button/checkbox/text_input/dropdown/
  radiobutton/page_router/image/video/rest_api/cloud_*/sliders/…): still filled; redraw to the
  16×16 stroke grid when the node picker / graph node cards get their UIX-009 pass.
- **`noodl-editor/src/assets/icons/editor/*` + top-level `*.svg`**: legacy CSS-background node/
  chrome art (mixed sizes) to migrate onto the component or retire.
- **Per-node module art** (module packages' own node icons): hundreds — explicitly out of
  scope; UIX-009 to triage volume.
- Canvas painted category glyphs already match the language (UIX-005 done).

## Metaphor changes flagged for review
- **None material.** Every redraw kept the existing metaphor (search=magnifier, home=house,
  bug=beetle, trash=bin, code=chevrons, settings=gear, alignment bars, etc.).
- Rendering-only changes (NOT metaphor): several glyphs moved from *filled* to *stroke*
  (`component`, `question_free`, `magic_wand`, `columns`, split glyphs) per the convention.
- `magic_wand` drawn as a stroke wand rather than the mock's decorative filled sparkle-wand
  — same metaphor; noted in case a filled AI-flavored variant is preferred.

## Licenses recorded
- Redrawn glyphs are **authored to the approved NodeGX phase-23 mocks** (project-internal);
  no third-party SVG files vendored. The mock language is Lucide-style (ISC) — used as
  metaphor/grid reference only. Full table in `ICONOGRAPHY.md`.

## Ownership boundary (UIX-008 runs concurrently) — respected
- Touched only: the Icon component + its `.module.scss`, `IconButton.module.scss` (icon-color
  *property* swap, no values), SVG assets, and the new `ICONOGRAPHY.md`.
- **Did NOT** touch color/theme values, `colors.css`, ThemeManager, DESIGN-TOKENS.md, or any
  Electron/CodeMirror theme wiring.
- **Hex ratchet: unchanged** — core-ui 100, noodl-editor 16, canvas-paint-ts 2 (`✓ Holding
  the line`). SVGs aren't scanned; the SCSS edits added no hex.

### For UIX-008
- Icons are fully `currentColor` now, so they follow the light-theme `color` automatically —
  no icon-specific work needed for the light theme. Verify contrast of the *active accent*
  glyph on the accent-soft pill under light tokens.

## Verification (in-worktree)
- `typecheck:core-ui` — **green** (exit 0).
- `typecheck:editor` — **green** (exit 0).
- All 149 SVGs well-formed (balanced tags, `<svg>…</svg>`) — scripted check passed.
- `npm run colors` — **holding** (100 / 16 / 2, all `=`).
- Did NOT launch the live Electron editor (lerna exec targets the MAIN checkout from a
  worktree — unreliable). Orchestrator runs the live pass from the primary checkout.

## Live-verification checklist for the orchestrator (primary checkout)
1. **Uniform weight screenshot:** rail + toolbar + one open panel together — all glyphs
   should read as one 1.5px stroke set (no leftover heavy filled chrome glyph among them).
2. **Rail states:** hover a rail button → glyph goes fg-highlight on a bg-3 pill; the active
   panel → accent glyph on an accent-soft pill (this is the `IconButton` `.Icon { color }`
   migration — the key thing to confirm didn't regress from UIX-004).
3. **Toolbar:** back/forward/home/debug/split/zoom carets render as stroke glyphs; warning
   triangle stays **solid** and amber (variant=notice), not red.
4. **Properties panel alignment control (UIX-003):** the align-left/center/right + text-align
   + justify segmented glyphs are the new grid set; pressed state shows accent.
5. **Dropdowns / trees / menus:** caret_down and menu-item glyphs are visible and take the
   row's hover/selected color (stroke glyphs rely on inherited `color` — confirm none render
   invisible or stuck at the wrong tint).
6. **Theme toggle:** icons re-tint with the theme (currentColor) — light + dark.
7. **No orphaned imports:** the editor build (webpack) is the proof — codicon deleted, no
   consumer migration needed (redraw-in-place), so a green build ⇒ no straggler.

## Residuals (tracked, not blocking)
- `IconSize` enum still ships 16/20/24/28 px; retuning to the mock's exact 12/14/15/17 per
  context resizes icons app-wide → wants a live screenshot pass (not done blind).
- The 92 filled node-type glyphs → UIX-009 stroke redraw.
- Editor legacy CSS-background icon sets (`assets/icons/*`, `editor/*`) → migrate onto the
  component or retire (legacy-view surgery; phase tail).
- `assets/icons/icon-button/*` (5, no live consumer) → confirm + delete.
