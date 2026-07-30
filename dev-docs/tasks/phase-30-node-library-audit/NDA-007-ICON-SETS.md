# NDA-007: Icon — a set model that isn't an icon font

## Metadata

| Field | Value |
|-------|-------|
| **ID** | NDA-007 |
| **Phase** | Phase 30 — Node Library Audit & Remediation (Track O) |
| **Tier** | 2 |
| **Priority** | 🟡 Medium — a design limit, not a bug, but it blocks a routine thing people want |
| **Difficulty** | 🟠 Medium–High — two asset pipelines (editor and viewer) have to agree |
| **Estimated Time** | 2–3 weeks |
| **Prerequisites** | None |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🔵 **Fable 5** for §1 — the icon-source model is an interface decision |

## Objective

Let an author add a custom icon set and see it — in the picker and in the app — without fighting two
asset pipelines.

## The limit

The node itself is 45 lines and fine ([`icon.ts`](../../../packages/noodl-viewer-react/src/nodes/visual/icon.ts)).
The constraint is the shape of `Noodl.Icon`: a `{ class, code, codeAsClass }` triple that the renderer
splats into a `<span>`
([`Icon.tsx:32-38`](../../../packages/noodl-viewer-react/src/components/visual/Icon/Icon.tsx#L32-L38)):

```jsx
props.iconIconSource.codeAsClass === true
  ? <span className={[props.iconIconSource.class, props.iconIconSource.code].join(' ')} style={style}/>
  : <span className={props.iconIconSource.class} style={style}>{props.iconIconSource.code}</span>
```

That model **assumes icon-font semantics** — a CSS class plus a codepoint or a class-per-glyph. It
cannot represent an SVG sprite, an inline SVG set, or an icon component library, which is what
essentially every modern icon set now ships as.

The consequence Richard describes ("very tricky to add custom icon sets and actually see them") is
that adding a set means getting a font **and** a stylesheet into the editor's own document, so the
picker can render it, **and** into the viewer document, so the app can — through two different asset
paths, with no single place that registers a set.

## §1 — The icon source model (decide first)

Widen `Noodl.Icon` from a font triple to a tagged union. Sketch, for review:

- `{ kind: 'font', class, code, codeAsClass }` — exactly today's behaviour, kept because it is what
  an icon *font* genuinely needs and what the whole shipped library uses. (Not for legacy-project
  compatibility — see [`COMPATIBILITY-POLICY.md`](../../reference/COMPATIBILITY-POLICY.md).)
- `{ kind: 'sprite', url, symbolId }` — renders `<svg><use href="…#id"/></svg>`.
- `{ kind: 'inline', svg }` — renders the markup directly; needed for anything that must inherit
  `currentColor` per-path or be animated.

`iconSize` and `iconColor` must behave the same across all three: today they are `fontSize` and
`color` on a span, which SVG honours only if the set uses `currentColor` and `1em` sizing. State that
requirement, and normalise it in the renderer where possible rather than making it the author's problem.

⚠️ Inline SVG from a user-supplied set is an injection surface. Decide the sanitisation policy in §1,
not later — and note that the viewer already renders authored HTML elsewhere, so there may be an
existing policy to match rather than invent.

## §2 — One registration path ✅ done 2026-07-30 (`899ab676`)

~~An icon set should be declared once and become available to both the editor picker and the viewer.
Today there is no such declaration.~~

**There is, and the "investigate first" instruction is what found it.** A module directory under
`noodl_modules/` whose `manifest.json` carries `type: 'iconset'` *is* the declaration, LIB-003 already
made `scanModuleManifests` the single scanner of that directory, and both consumers already read it —
the picker through `ProjectModel`, the preview and deploy HTML through `injectIntoHtml`. So criterion 4
was **nearly met before this task started**; what was missing is any way for a set to be something
other than a font. The change is `iconSource: 'font' | 'sprite'` on the manifest plus one shaping
layer (`shared/utils/iconsets.ts`) beside `toInjectModules`, not a new mechanism.

The asymmetry that made §2 small, and the answer to the spec's worry about a third asset pipeline: a
**font** set is only renderable once a stylesheet is in the *document*, which is exactly what the two
pipelines exist for — but `{ kind: 'sprite', url, symbolId }` is self-describing, and `noodl_modules/`
ships verbatim in a deploy. **Nothing is injected anywhere for a sprite to render in the app.** The
value is the registration.

## §3 — The picker ✅ done 2026-07-30 (`899ab676`)

The editor's icon picker has to render whatever §1 allows, not just fonts. Check what it does today
before designing: if it renders by injecting the set's stylesheet into the editor document, sprites
and inline sets need a different path and the picker becomes the larger half of this task.

It did inject the stylesheet, and sprites do need a different path — but the picker was not the larger
half. Two things it did not predict:

- **An external `<use href="file:///…#id">` renders nothing from the editor document and says
  nothing about it.** The editor is a `file://` page and Chromium treats the reference as
  cross-origin. Serving the sheet from the preview's web server is a different origin again. The
  sheet is therefore inlined into the editor document with symbol ids namespaced by sheet URL, and
  `LoadIconSets` awaits that before calling back — a `<use>` whose target is not in the document yet
  draws nothing and does not retry.
- **`IconType` was narrowing every picked value** to `{ class, code, codeAsClass }`. Even once the
  picker could offer a sprite, the three fields that describe one were dropped one line later, by
  code that reads like a copy.

There is now one editor-side glyph renderer (`components/IconGlyphPreview.tsx`) for the picker cell
and the property-panel thumbnail — two more copies of the font splat, on this side of the fence.

## Success criteria

1. 🔵 A custom SVG sprite set can be added to a project, appears in the picker, and renders in the
   app — **demonstrated end to end live in the editor** (`899ab676`): a set installed in a project
   shows drawn previews in the picker, the pick stores `{kind:'sprite',url,symbolId}`, the thumbnail
   renders it, and the app renders it at the authored size and colour. **A deployed build is still
   owed**; `noodl_modules/` is not in the deploy ignore list, so the URL is expected to resolve, but
   expected is not verified.
2. ✅ Existing font-based icons render byte-identically. ⚠️ **Not** by the screenshot corpus, which
   photographs editor chrome and cannot see this node — the wrong instrument. Verified instead by a
   row pinning `iconValueForGlyph`'s exact key set (`class`, `code`, `codeAsClass`, **no `kind`**)
   and live: a font set installed beside the sprite set emits that value, gets its stylesheet
   injected from the same manifest, and renders in the app. 9 rows; editor jasmine 1,885 → **1,894**.
3. ✅ `iconSize` and `iconColor` work for the two installable kinds, live, and the `inline` kind is
   covered by §1's rows. Verified at 48px in `#ff9900` and `#33ccff`.
4. ✅ Exactly one place registers a set — and it was already true; see §2.

## Out of scope

`IconSize` being inert at 130 call sites in the *editor chrome* (recorded under UIX-010) is a separate
defect in the editor's own UI, not in this node. It will come up in the same conversation; do not fold
it in.
