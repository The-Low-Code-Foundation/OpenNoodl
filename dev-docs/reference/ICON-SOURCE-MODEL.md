# The Icon Source Model

**Status:** Normative interface decision. Decided 2026-07-29 (phase 30, NDA-007 §1). NDA-007 §2–3
(registration path, picker) build against this shape.

## The model

`Noodl.Icon` widens from the icon-font triple to a **tagged union**. `kind` is the discriminant;
absence of `kind` means `'font'`, so every existing project value parses unchanged.

```ts
type IconSource =
  | { kind?: 'font';   class: string; code: string; codeAsClass?: boolean }  // today's shape, verbatim
  | { kind: 'sprite';  url: string;   symbolId: string }                     // <svg><use href={url + '#' + symbolId}/></svg>
  | { kind: 'inline';  svg: string };                                       // markup rendered directly
```

- **`font`** — exactly the current behaviour (`Icon.tsx:32-38`), byte-identical rendering. The
  screenshot corpus is the regression gate.
- **`sprite`** — for sets shipped as an SVG sprite file. `url` is a project asset path or absolute
  URL; `symbolId` selects the `<symbol>`. This is the primary format for custom sets.
- **`inline`** — for glyphs that must inherit `currentColor` per-path, be animated, or come from a
  component library that emits markup. The escape hatch, not the default.

## Size and color are the renderer's job

`iconSize` and `iconColor` behave identically across all three kinds — this is the requirement
that makes the union coherent rather than three nodes in a trenchcoat:

- The renderer sets `width`/`height` (from `iconSize`) and `color` (from `iconColor`) on the
  wrapper, and for SVG kinds normalises the glyph to inherit: `fill="currentColor"` on the `<use>`
  wrapper / root `<svg>`, and no fixed `width`/`height` attributes winning over CSS
  (`svg { width: 1em; height: 1em; }`-equivalent enforced by the renderer).
- A set whose glyphs hard-code fills keeps its own colors — multicolor icons are legitimate — but
  then `iconColor` is documented as inert for that glyph, not silently half-applied. Normalisation
  happens in the renderer, never as an authoring requirement.

## Sanitisation policy (decided here, per the spec's instruction)

There is no existing authored-HTML policy in the viewer to match — the only authored-markup
injection today is CSS (`css-definition.ts`), which cannot carry script. Inline SVG can. Policy:

- **Sanitise at registration/import time, not at render time.** Icons render often; sets are
  registered once. The stored form is already-clean markup.
- Strip: `<script>`, `<foreignObject>`, all `on*` attributes, `javascript:` URLs, and any
  `href`/`xlink:href` that is not a same-document fragment reference. Everything else (paths,
  gradients, masks, `<animate>`) passes.
- Applies to **all** inline sources regardless of origin. The project author is trusted in their
  own app (they can already write a Function node), but icon sets travel — through the library
  import pipeline (Phase 21) and project templates — so the set, not the author, is the trust
  boundary.
- `sprite` needs no sanitisation of its own document (`<use>` cannot execute script from the
  referenced file in modern browsers), but sprite files installed through the registration path
  get the same scrub for defence in depth.

## Implementation status (2026-07-30, updated after §2/§3)

**The renderer implements this model in full, and a `font` or `sprite` set can now be installed and
picked.** `inline` sets are declarable in the model but not installable as a *set*; see the last
bullet.

- `Noodl.Icon` is the union above (`viewer-react/src/types.ts`), and **one** component renders it:
  `components/visual/Icon/IconGlyph.tsx`. There were **six** copies of the font-triple splat before
  it — `Icon`, `Button`, `Checkbox`, `RadioButton`, `Select`, `TextInput` — each independently
  hard-wired to font semantics. All six now go through `IconGlyph`.
- Size and colour work identically across the three kinds, exactly as specced: the caller passes the
  style it already built for the font case (`fontSize` = `iconSize`, `color` = `iconColor`) and the
  SVG kinds inherit by sizing at `1em` and filling with `currentColor`. **A caller needs no per-kind
  branch**, which is what made collapsing the six call sites possible.
- `sanitizeInlineIconSvg` is implemented and exported. It is **regex-based on purpose** — it runs
  under SSR and under `testEnvironment: node`, where there is no parser to borrow — so it is
  conservative by construction.
- ⚠️ **The scrub still happens at render time, not registration time.** §2 landed without moving
  it, and the reason is a correction to this document's own policy rather than an omission: the
  installable kinds are `font` and `sprite`, and **neither stores markup** — a sprite set stores a
  URL. So there is no *stored form* for a registration-time scrub to clean. The scrub is still the
  right boundary for an `inline` value, and an `inline` value's only origin today is a wire or
  project JSON, which registration never sees. When an `inline` *set* becomes installable, that is
  when the move becomes possible; until then render time is the only boundary that exists.
- ✅ **§2 — one registration path** (`shared/utils/iconsets.ts`). The path is the one that already
  existed: a module directory under `noodl_modules/` whose `manifest.json` carries
  `type: 'iconset'`, scanned by LIB-003's single `scanModuleManifests`. It gained
  `iconSource: 'font' | 'sprite'` (absent means `font`) and, for sprites, `sprite: <module-relative
  path>`. `toIconSets` is a shaping layer on that scanner, beside `toInjectModules` — not a second
  read of the directory.
  **Note the path convention it follows:** `sprite` is *module*-relative, like `main` and
  `dependencies`. `browser.stylesheets` is *project*-relative, which is a pre-existing
  inconsistency in the manifest and is left alone rather than widened.
- ✅ **§3 — the picker** renders `sprite` sets as SVG with no stylesheet involved, and there is now
  one editor-side glyph renderer (`propertyeditor/components/IconGlyphPreview.tsx`) shared by the
  picker cell and the property-panel thumbnail. Those were two more independent copies of the font
  splat, on this side of the fence.
- **Why a sprite needs no registration in the app at all**, which is what made §2 small: a font set
  is only renderable once its stylesheet is in the *document* — that is what the two asset pipelines
  were for — while `{ kind: 'sprite', url, symbolId }` is self-describing and `noodl_modules/` ships
  verbatim in a deploy (absent from `build/ignore.ts`'s defaults). Nothing is injected anywhere for
  a sprite to render in the app. **The value is the registration.**
- ⚠️ **An external `<use href>` does not work from the editor document, and fails silently.** The
  editor is a `file://` page; Chromium treats an external `use` reference as cross-origin and
  renders *nothing* — a picker of blank cells with no error in the console. The picker therefore
  inlines a sprite sheet into its own document, with symbol ids namespaced by sheet URL, and awaits
  that before rendering. The app has no equivalent problem: the viewer document and the sheet share
  the project origin.
- **Two sanitisers, deliberately, and not the six-copies mistake.** The viewer's
  `sanitizeInlineIconSvg` is regex-based because it must run under SSR and `testEnvironment: node`,
  where there is no parser. The editor's `scrubSvgTree` is `DOMParser`-based because it has one and
  because that document is the privileged one. Same policy, different capabilities; the *shared*
  part — which kind a value is, and what value a glyph makes — is in `shared/utils/iconsets.ts`.
- ⚠️ **`inline` sets are declarable but not installable.** Previewing one in the picker means
  putting its markup into the editor's own document, which is a materially different trust question
  from putting it in the app's. Deferred with a reason rather than skipped. An `inline` *value*
  reaching the node still renders.

## Constraints on §2/§3 (registration and picker)

- **One registration point** per set, serving both documents: the editor picker and the viewer app
  must render from the same declaration. Extend the Phase 21 library/import pipeline or the styles
  system's project-level assets — do not add a third asset pipeline.
- The picker renders `sprite`/`inline` sets as SVG directly; it must not require injecting a
  stylesheet into the editor document for non-font sets (that requirement is the current model's
  core defect).
- The `Noodl.Icon` *value* remains a plain serialisable object — it flows through ports, project
  JSON, and the AI authoring loop, so no functions, no components-as-values.
