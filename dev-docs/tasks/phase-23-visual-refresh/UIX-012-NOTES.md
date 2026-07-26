# UIX-012 — Theme-aware node colours + node-picker collapse state — NOTES

**Status:** Implementation complete (2026-07-26). Four defects, one cause: surfaces
that paint node/JSON chrome from a **hardcoded dark palette** the light theme
cannot reach.

Filed from live-use reports, not from an audit. There was no UIX-012 spec file —
the id was reserved by [UIX-013](./UIX-013-NODE-PICKER-OVERHAUL.md), which names
this task as the owner of "make `colorSchemeForNodeType` theme-aware at the
source" and forbids forking the palette. This is that task.

## The defects

| # | Symptom | Cause |
|---|---|---|
| 1 | Connection popups (drag a wire) render dark navy with dark text on light | `ConnectionBar`/`PortGroup` inline `colors.base/header/baseHighlighted` from the dark-only blob; five `rgba(255,255,255,…)` leftovers in `ConnectionPopup.module.scss`; `arrowColor: '#464648'` in `ConnectionPopups.ts` |
| 2 | Node-picker items are dark-navy islands on a light panel | `EditorNode` sets `--textColor`/`--baseColor`/`--highlightColor` inline from the same blob |
| 3 | Categories do not auto-expand on search | `NodePickerCategory` mirrored `isCollapsed` into local state that only the header click wrote to; and every category re-parse reset all categories to collapsed |
| 4 | Hover-a-node/connection JSON inspector is pale yellow on light | `InspectPopup` hands `react-json-view` an inline base16 object of dark literals |

Defects 1, 2 and 4 all trace to the same shape of debt: **a literal palette
sitting where a token should be.** Defect 3 is unrelated in cause but sits in
the same component tree, and the picker had to be touched either way.

## The palette: derived, not authored twice

`packages/noodl-runtime/src/nodelibraryexport.js` lines 167-214 hold
`colors.nodes.{component,visual,data,javascript,default}` — dark-theme literals
shipped from the runtime to the editor over the `window.NodeLibraryData` wire.
The editor now derives its node colours from CSS tokens instead, via a new
`CanvasTheme.nodeColorScheme(name)` (UIX-005's resolver — the same one the
canvas paints from), so there is exactly one palette and it is correct in both
themes:

```
base            = mix(bg-1, categoryAccent, 0.20)
baseHighlighted = mix(bg-1, categoryAccent, 0.32)
header = outline = mix(bg-0, categoryAccent, 0.20)
headerHighlighted = base           # the identities the dark palette had
outlineHighlighted = categoryAccent
text            = fg-highlight
```

The mix ratios were chosen so the **dark** output reproduces the shipped
literals to within a few levels per channel (component base `#363050` →
`rgb(53,51,79)`; default `#222933` → `rgb(36,41,48)`) — the dark look is the
shipped UIX-005 design and must not regress. A spec asserts that (`tests/canvas/
CanvasThemeNodeSchemes.test.ts`, "reproduces the shipped dark palette"). On
light the same formula lands a soft tint of the category hue on a near-white
surface with near-black ink.

**The blob stays.** `grep` found only three editor consumers of
`colorSchemeForNode*` (node picker, connection popup, references panel) and none
of `colorSchemeForConnectionType`, but the blob is part of the runtime→editor
export contract that older runtimes and `src/external/*` viewers also produce.
`NodeLibrary.loadLibrary` still tolerates and defaults it. Nothing outside the
editor changed.

## Where the resolution lives (one path, not three)

- `CanvasTheme.resolveThemeTokens(specs)` — the primitive: CSS custom properties
  → literal colour strings, with a headless fallback per token. `CanvasTheme`'s
  own `resolve()` now goes through it too, so there is one implementation.
- `useThemeTokens(specs)` / `useCanvasThemeGeneration()` (`hooks/useThemeTokens.ts`)
  — the React lifecycle: re-resolve and re-render on `nodegx:themechanged` or a
  `data-theme` flip, subscribing with the PLAT-001 listener-context rule and
  detaching on unmount.
- `useNodeColorScheme(colorName)` (`hooks/useNodeColorScheme.ts`) — node
  schemes for picker / popup / references panel.

Defect 4's base16 object is built from `useThemeTokens` over the
`--theme-color-syntax-*` tokens UIX-008 already defined for both themes. **No new
palette was authored for it.**

### Contrast note for the inspector popup

The syntax tokens are documented as AA on `bg-1`/`bg-2`; `InspectPopup.module.scss`
puts the popup on `bg-4`. Every value used still clears AA there in both themes
**except** `--theme-color-syntax-meta` (`#6e7781`, ~3.5:1 on the light `bg-4`),
so `undefined`/ellipsis use `--theme-color-fg-default` instead. The popup surface
was left on `bg-4` — swapping the token that failed was the smaller change.

The base16 → JSON-token mapping was read out of the installed
`@microlink/react-json-view` build (`createStylingFromTheme`), not assumed; the
old trailing comments on `base0E`/`base0F` were wrong (`base0E` is
boolean/collapsedIcon/editIcon, `base0D` is the copy-check) and are corrected.

## Defect 3: the collapse-state drift, and the second half of it

The reported bug was "clicking a header desyncs local state". Driving it live
found the *first* search never expanded anything either, and that has a second
cause: `useKeyboardCursor`'s `[renderedNodes]` effect dispatches
`UpdateAllCurrentCategories` on **every keystroke** (the rendered index changes),
and that action rebuilt `allCategories` with the parsed default `isCollapsed:
true` — undoing the `OpenAllCategories` that `useSearchBar` had just dispatched.
Fixing only the click would have left search-expansion broken.

So: the reducer is now the single source of truth (`ToggleCategoryByName` from
the header click, `NodePickerCategory` reads the prop directly), the re-parse
carries collapsed state across **by name**, all category writes are immutable,
and `UpdateAllCurrentCategories`'s `withCollapsedCategories` branch applies the
flag to the *new* list instead of throwing it away.

Layout and visual design were deliberately not touched — UIX-013 owns that.

## Verification

**Unit** — editor Jasmine suite, **1346 specs, 0 failures** (seed 41356; an
earlier full run at 1337 specs, seed 49805, was also green), including 17 new
specs: `tests/canvas/CanvasThemeNodeSchemes.test.ts` (both
themes via inline custom properties on the root, headless fallback, dark-palette
reproduction, listener attach/detach) and `tests/nodepicker/NodePickerReducer.test.ts`
(toggle by name, immutability, carry-across-reparse, the exact drift repro,
keyboard Enter still toggles). An earlier run on a different seed had one
failure — `Project import and export … re-keys imported node ids
(characterization)`, "Expected 4 to be 5" — which passed on the next seed with
the same code: a pre-existing order-dependent flake in the import suite, not
this change.

**Typecheck** — `noodl-editor` `tsc -p tsconfig.json` and `-p tsconfig.tests.json`
both clean. `noodl-core-ui` has its usual 45 pre-existing
`@noodl-store`/`@noodl-versioning`/`@noodl-viewer-cloud` module-resolution
errors, none in touched files.

**Hex ratchet** — `canvas-paint-ts` 2 → **0** (the two `#464648` literals were
its entire remaining balance; the scope is now empty). Baseline lowered.

**Live (real editor, CDP-driven, both themes)** — screenshots in
`screenshots/uix-012/`. The theme was flipped with `data-theme` + the real
`nodegx:themechanged` event, which is exactly what `ThemeManager` does; the
persisted `editor.theme` setting was never written, so the user's preference is
untouched.

| Check | Result |
|---|---|
| Node-picker items, light | Soft category tint, dark ink, legible on the light panel — no dark-navy islands (`11-picker-light-search.png`) |
| Node-picker items, dark | Visually equivalent to the shipped dark look (`11-picker-dark-search.png`) |
| Search auto-expands the matching category | 2 items rendered, **both themes** |
| Header click collapses it | 0 items, both themes |
| Search again after the click | 2 items — the drift is gone, both themes |
| **Control run, four picker files stashed** | search → **0 items** (no expansion), header click → 2, search again → **0**. The defect reproduces exactly |
| Connection popups (STEP 1 + STEP 2), light | Light blue surfaces, dark ink, port rows and group headers all readable (`21-connection-popup-light.png`); measured bar `rgb(213,229,247)` / port ink `rgb(24,33,43)` |
| Connection popups, dark | Matches the shipped dark look (`20-connection-popup-dark.png`) |
| Popups re-theme while open | Yes — the same two popups were on screen across the flip |
| Hover-node JSON inspector, light | Keys near-black, strings `#a31515`, array indices blue, all legible on `bg-4` (`30-`/`32-inspector-…-light.png`) |
| Hover-node JSON inspector, dark | VSCode-Dark+ salmon strings on the dark surface (`31-`/`33-inspector-…-dark.png`) |
| **Pinned inspector re-themes in place** | Yes — flipped with the popup open, same DOM node, no reopen (`31-inspector-dark-after-live-flip.png`) |

Expanded records were checked, not just the collapsed `{…}` summary, so strings,
keys, braces and array indices were each seen in both themes.

### Not verified live

**The Node References panel.** It sits behind `ExperimentalFlag` and no rail
button in this build opens it, so it could not be reached. Its change is one
line: the hand-rolled dark fallback for type-less entries replaced by the same
`useNodeColorScheme` hook proven on the picker and the popup. Low risk, but
unphotographed.

Everything else in the live pass was fought for through a genuinely hostile
window: another session was working in this same checkout and driving the same
Electron instance. Its in-progress edit to `NodeGraphModel.ts` broke the
dev-server compile mid-pass (`TS2341: Property '_type' is private`), the editor
kept switching projects under me, and it started its own `test.js --ci` run on
the debug port. The pass above was completed after that session went quiet.

**Driving trap worth recording:** CDP `Input.dispatchMouseEvent` clicks are
silently ignored when the Electron window is not focused. `Page.bringToFront`
before the first click is the fix, and its absence looks exactly like a broken
selector — several "the picker will not open" dead ends were only that.

## Findings handed on (not fixed here)

- **`codemirror-theme.ts` hardcodes `{ dark: true }`** on `EditorView.theme(...)`
  (line ~249). That is CodeMirror's `dark` facet, not a colour, so it is not the
  yellow-JSON symptom — but built-in extensions (autocomplete tooltip chrome,
  search panel, default selection blending) take dark-flavoured defaults even
  under the light theme. The rest of the file is genuinely token-driven. Fixing
  it means putting the theme in a `Compartment` and reconfiguring on
  `nodegx:themechanged` — a real change to the code editor, and project history
  records that CodeMirror's light appearance has never been live-checked. Left
  alone deliberately: shipping it unverified is the worse option. **Worth its own
  task alongside the CodeMirror light spot-check UIX-008/009 already deferred.**
- **Teardown crash when a project closes:**
  `ProjectDesignTokenContext.tsx:57` and `EditorDocument.tsx:263` both throw
  `Cannot read properties of undefined (reading 'off')` and blank the editor
  when the project is closed out from under them (seen on cancelling the import
  wizard). Pre-existing, in neither this task's files nor its call paths.
- **Node-picker item glyphs are still fill-drawn**, so an icon like `TextInBox`
  reads as a solid dark block inside the now-light card. Legible, but it is the
  UIX-010 stroke-grid tail showing through — worth a row on UIX-010's list.
