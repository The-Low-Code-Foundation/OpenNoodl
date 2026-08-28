# SBR-004 — The public site wears the theme

**Fixes finding 4 for the visitor-facing half.** Screen 1 of the screens artifact. The
one-component-renders-any-slug architecture stays; what changes is that the page has a shape —
nav, reading measure, rhythm, footer — and every visual value comes from a token.

## 1. The person sentence

**A visitor on a phone or a laptop sees a site they would believe a real studio published —
a navigation bar, readable text at a sane width, and a footer — not a column of raw controls.**

## 2. Scope (from the screens artifact, no trimming — ruled s1)

- **Navigation**: brand from `SiteSettings`, links from published pages (derivation already
  exists), a current-page state (`--primary`, weight), laid out as a bar with a bottom rule.
- **Reading measure**: the page content constrained by the measure token; sections separated by
  multiples of the spacing scale.
- **Footer**: site name and a link back to home — new; today the page just stops.
- **The not-found / unclaimed / no-backend states** (SBR-002's panels) styled as centred cards.
- Every colour, radius, gap, face and size in `/Pages/Site`, `/Site/*` is a `var(--token)` —
  zero raw values; SBR-012 is the gate that holds it.

## 3. Acceptance criteria

1. **(person)** The published demo page renders with nav, measure, rhythm and footer, in the
   Studio look, for an anonymous visitor.
2. Current page is visibly distinct in the nav (measured: the aria-current link resolves a
   different colour/weight than its siblings).
3. Zero raw style values in the touched components — SBR-012's gate green, and the *planted*
   raw value reds it (the gate must be shown able to fail).
4. Narrow viewport (~375px) neither overflows horizontally nor collapses the nav into overlap —
   measured with `scrollLeft` probing, not `scrollWidth` (integer rounding lies).

## 4. Traps

- 🔴 Component sets vs artefact: regenerate after every edit; id count and connection totals move.
- 🔴 Assert wires by node **label** (door remaps ids).
- Text nodes must keep standing values (s19's rule) — a styled heading that renders the word
  "Text" while loading is the same defect in better clothes.
