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

## Constraints on §2/§3 (registration and picker)

- **One registration point** per set, serving both documents: the editor picker and the viewer app
  must render from the same declaration. Extend the Phase 21 library/import pipeline or the styles
  system's project-level assets — do not add a third asset pipeline.
- The picker renders `sprite`/`inline` sets as SVG directly; it must not require injecting a
  stylesheet into the editor document for non-font sets (that requirement is the current model's
  core defect).
- The `Noodl.Icon` *value* remains a plain serialisable object — it flows through ports, project
  JSON, and the AI authoring loop, so no functions, no components-as-values.
