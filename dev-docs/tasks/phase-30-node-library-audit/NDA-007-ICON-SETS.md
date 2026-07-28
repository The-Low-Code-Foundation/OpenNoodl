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

- `{ kind: 'font', class, code, codeAsClass }` — exactly today's behaviour, unchanged, so every
  existing project keeps working.
- `{ kind: 'sprite', url, symbolId }` — renders `<svg><use href="…#id"/></svg>`.
- `{ kind: 'inline', svg }` — renders the markup directly; needed for anything that must inherit
  `currentColor` per-path or be animated.

`iconSize` and `iconColor` must behave the same across all three: today they are `fontSize` and
`color` on a span, which SVG honours only if the set uses `currentColor` and `1em` sizing. State that
requirement, and normalise it in the renderer where possible rather than making it the author's problem.

⚠️ Inline SVG from a user-supplied set is an injection surface. Decide the sanitisation policy in §1,
not later — and note that the viewer already renders authored HTML elsewhere, so there may be an
existing policy to match rather than invent.

## §2 — One registration path

An icon set should be declared once and become available to both the editor picker and the viewer.
Today there is no such declaration.

Investigate first: the library/import pipeline (Phase 21, LIB-001…005) already installs content into a
project, and the styles system (Phase 9) already has a project-level asset concept. **Prefer extending
one of those to inventing a third mechanism** — this is exactly the kind of task that ends up as a
parallel asset pipeline nobody maintains.

## §3 — The picker

The editor's icon picker has to render whatever §1 allows, not just fonts. Check what it does today
before designing: if it renders by injecting the set's stylesheet into the editor document, sprites
and inline sets need a different path and the picker becomes the larger half of this task.

## Success criteria

1. A custom SVG sprite set can be added to a project, appears in the picker, and renders in the app —
   demonstrated end to end, in a deployed build as well as the editor.
2. Existing font-based icons render byte-identically; the screenshot corpus proves it.
3. `iconSize` and `iconColor` work for all three source kinds.
4. Exactly one place registers a set.

## Out of scope

`IconSize` being inert at 130 call sites in the *editor chrome* (recorded under UIX-010) is a separate
defect in the editor's own UI, not in this node. It will come up in the same conversation; do not fold
it in.
