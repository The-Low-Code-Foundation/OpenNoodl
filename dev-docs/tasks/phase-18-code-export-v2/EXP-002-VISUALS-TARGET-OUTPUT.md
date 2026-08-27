# EXP-002 — Target output: the second wave of visual generators

**Status:** Built (2026-08-27, session 9)
**Covers:** `net.noodl.visual.columns`, `net.noodl.visual.icon`, `net.noodl.controls.checkbox`,
`net.noodl.controls.radiobutton` + `Radio Button Group`, `net.noodl.controls.range`,
`net.noodl.controls.options`, `Video`, `Circle` — and their legacy-name aliases.

Session 8's audit ranked these first: 62 columns + 49 icon nodes deferred directly in the corpus,
and because an unsupported visual defers its whole subtree, they carry the largest collateral.
The corpus also settled the scope *within* each node — the numbers below are authored-parameter
counts across the 100+ real instances on this machine.

Decisions were made against the runtime sources (`nodes/visual/*.ts`, `nodes/controls/*.ts`,
`components/**` in noodl-viewer-react), not the docs. Where the translation diverges from the
interpreter, the divergence is stated here and nowhere else.

## 1. Columns → CSS Grid

The runtime implements columns with flex-wrap, a negative-margin gutter, JS-measured autofold
and JS breakpoints. All four have first-class CSS spellings today, and the corpus authors all of
them (79 layoutString, 28 autoFit, 73 small-breakpoint pairs, 39 medium pairs):

- **Layout string is `fr` units.** `"1 2 1"` *means* `grid-template-columns: 1fr 2fr 1fr` —
  fractions of free space are exactly what the layout string has always described. Tokens that
  are not positive numbers are dropped exactly as `parseLayout` drops them (reported as a note);
  a wholly unusable string renders one full-width column (`1fr`).
- **Gutters are `gap`.** The runtime's negative-margin + item-padding dance exists to draw
  between-column gutters flush with the parent's edges — which is the definition of
  `column-gap`/`row-gap`. Defaults 16px each (the node's `initialize`), authored values pass
  through (tokens survive verbatim).
- **Auto Fit is the CSS it was imitating.** The runtime source itself describes `autoFit` as
  "CSS `repeat(auto-fit, minmax(…))`". So: `repeat(auto-fit, minmax(<minWidth>, 1fr))`;
  `minWidth` 0/absent degrades to a single `1fr` column, the runtime's own floor.
- **Breakpoints are container queries.** The runtime keys off *container* width, deliberately
  (NDA-006 §3) — which is `@container`, not `@media`. A columns node with an active breakpoint
  pair gets one wrapper div carrying `container-type: inline-size`; the `@container` blocks
  redefine `grid-template-columns`. Medium emits before small so the cascade gives small the
  final word, mirroring the runtime's small-first check.
- **`minWidth` with a layout string** wraps each track: `minmax(<minWidth>, <f>fr)`.
- Children render directly as grid items — no wrapper divs. A child with an explicit width sits
  at that width at the start of its track, which is where the runtime's block wrapper puts it.

```tsx
<div className={styles.galleryContainer}>
  <div className={styles.gallery}>
    <PuppyCard … />
    …
  </div>
</div>
```

```css
.galleryContainer {
  container-type: inline-size;
}

.gallery {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  column-gap: 32px;
  row-gap: 16px;
}

@container (max-width: 700px) {
  .gallery {
    grid-template-columns: 1fr;
  }
}
```

The wrapper is emitted only when a breakpoint pair is active (breakpoint > 0 *and* a non-empty
layout beside it — a half-configured pair is inert, the runtime's own rule).

**Defers (whole node, with the reason):** `packing: masonry` (JS-measured packing; 1 in corpus),
`direction: column` (0 in corpus), and any of the layout-shaping ports arriving over a wire
(`layoutString`, `sizing`, `packing`, `direction`, `minWidth`, `marginX/Y`, the breakpoint four,
`justifyContent`) — a wired layout means the grid's shape is not static.

**Recorded divergence:** the runtime's *autofold* (dropping columns one by one when the measured
container cannot hold their minimums) is measurement-driven; the export renders the authored
layout — exactly what the runtime itself does for the whole of a server render. Authors who
care about narrow containers author breakpoints, and those translate.

## 2. Icon — one element per source kind

`iconSourceType` defaults `'icon'`; the source value is the NDA-007 tagged union.

- **Font glyph** (`{class, code}`, the corpus's 72): a span joining the generated class with the
  set's classes. `codeAsClass` sets put the code in the class list, others in the text:
  `<span className={`${styles.star} material-icons`}>star</span>` /
  `<span className={`${styles.truck} lucide icon-truck`} />`.
  Class: `font-size` = iconSize, `color` = iconColor, `line-height: 1`, `user-select: none`.
  **One note per component per set**: the export does not bundle `noodl_modules` icon sets — the
  set's stylesheet/font must ship with the app for the glyph to draw.
- **Sprite** (`{kind:'sprite', url, symbolId}`): `<svg className …><use href="url#id" /></svg>`;
  class: `width`/`height` = iconSize, `fill` = iconColor, `display: block`. The sheet is an
  ordinary project asset (same story as every `Image` src: assets ship beside the export).
- **Image**: `<img className src alt="" />`; class sizes it.
- **Inline** (`{kind:'inline'}`): defers — its SVG passes a sanitizer at render time in the
  runtime, and the export will not inline unsanitized markup by another path.
- No source at all renders an empty sized span, which is what the runtime draws.
- A wired source (`iconIconSource`/`iconImageSource`/`iconSourceType`) defers the node.

## 3. Checkbox / Radio Button — `appearance: none`, the runtime's own defaults

The runtime control is a custom-styled box (border 2px solid #000, radius 3 / 16) with a hidden
native input and a drawn mark. The export styles the native input directly:

```tsx
<label className={styles.rememberLabel}>
  <input type="checkbox" className={styles.remember} defaultChecked />
  Remember me
</label>
```

```css
.remember {
  appearance: none;
  margin: 0;
  display: grid;
  place-content: center;
  width: 32px;
  height: 32px;
  border: 2px solid #000000;
  border-radius: 3px;
}
.remember::before {
  content: '';
  width: 16px;
  height: 16px;
  background-color: #000000;
  mask: url("data:image/svg+xml,…tick path…") center / contain no-repeat;
  transform: scale(0);
}
.remember:checked::before {
  transform: scale(1);
}
.rememberLabel {
  display: flex;
  align-items: center;
  gap: 10px;
}
```

- Width/height/border/radius take the authored value, else the node's catalog default — the
  runtime always draws the box, so the export always states it.
- **The mark takes the border colour** — checkbox tick and radio dot both. That is FB-020's own
  rule (`_renderDefaultCheck`, and radio's `fillColor || borderColor`), so a `var(--token)`
  border colours the mark too (why the tick is a `mask` + `background-color`, never a stroked
  data-URI: a data URI cannot carry `var()`). Radio's authored `fillColor` wins when present;
  `fillSpacing` insets the dot (`width: calc(100% - 2×spacing)`).
- `useLabel` wraps in a `<label>` (no ids, no `htmlFor` — the document-global-id trap has no
  surface at all); `labelSpacing` becomes `gap` (default 10px).
- `checked` literal → `defaultChecked`; `enabled` → the `disabled` rule (LOGIC-TARGET §7). The
  control is uncontrolled unless a wire demands otherwise — the standing step-4 rule.
- The `Changed` signal output (`onChange`) maps to the DOM `onChange` — same trigger machinery
  as onClick, new event row for the control roles only.
- An authored icon-source on the control (custom tick) defers the node; `useIcon: false`
  (author styles the mark via visual states) drops the mark blocks and reports.
- **Radio Button requires a translated Radio Button Group above it** (the runtime raises
  `radio-button/no-group` otherwise — a groupless radio defers). The group renders a div; its
  instance-scoped `name` comes from `useId()`:

```tsx
const sizeId = useId();
…
<div className={styles.size}>
  <label className={styles.smallLabel}>
    <input type="radio" className={styles.small} name={sizeId} value="s" />
    Small
  </label>
  …
</div>
```

  `useId`, not a generated constant: a radio `name` is document-global, and two instances of the
  same component must not join each other's group. A literal group `value` marks the matching
  radio `defaultChecked`; a wired group value defers the group.

## 4. Range → `<input type="range">`

`<input type="range" className min max step defaultValue />` — attrs from authored literals
only (native defaults are the node's defaults: 0/100/1). Class: `width` (authored, else the
runtime's 100%), `accent-color` from authored `thumbColor`. The thumb/track border+shadow port
family (~60 generated ports, `allowEditOnly`) has no non-vendor-pseudo CSS spelling — authored
values land in `unhandled` and are reported. `Changed` → `onChange`.

## 5. Dropdown (`net.noodl.controls.options`) → `<select>`

- Literal `items` (a JSON array of `{Label, Value}`) → `<option value>` rows, `Disabled` honored.
- `placeholder` → `<option value="" disabled hidden>` + `defaultValue=""` (the runtime overlays
  a styled span; the hidden-option idiom is the native spelling of the same affordance).
- Literal `value` → `defaultValue`.
- **Wired `items` defers the node** — an empty select that would have options at runtime is a
  lie, not a translation. (1 node in corpus; the wire-fed case is Static Data / query territory.)
- `useLabel` on the dropdown defers (unexercised in corpus).

## 6. Video → `<video>`

`src`/`poster` pass through as project-relative URLs (the `Image` precedent — assets ship
beside the export). `controls`/`autoplay`/`muted`/`loop` are the boolean attrs; `object-fit`
emits always (runtime default `contain` ≠ CSS default `fill`); `objectPositionX/Y` fold into
`object-position`. `volume` has no attribute (DOM property) — reported. The action inputs
(Play/Pause/Restart/Reset) and playback outputs are wires pass 6 already reports.

## 7. Circle → inline SVG, computed at generation time

The runtime computes arc paths from `size`/`startAngle`/`endAngle`/stroke at render; every one
of those is a static parameter, so the export computes the same paths (same math, same
inside-stroke radius trick) once, at generation:

```tsx
<svg className={styles.badge} width={100} height={100} xmlns="http://www.w3.org/2000/svg">
  <path d="M 50 0.0001 A 50 50 0 1 0 49.9999 0 L 50 50 L 50 0.0001" fill="red" />
</svg>
```

Coordinates print with up to 4 decimals, trailing zeros stripped — enough that a full circle's
epsilon nudge (the runtime's own `endAngle -= 0.0001`) survives, deterministic across runs.
Class: `flex-shrink: 0; display: block` + margins. Any of the shape ports wired defers the node.

## What this slice deliberately does not do

- **Value outputs of controls** (`checked`, `value`) feeding the graph: wires pass 6 reports.
  They join the graph when the component-state slice (Switch's `useState` design) lands.
- **Visual states** (hover/pressed/checked parameter sets) — not translated anywhere yet.
- **Icon set bundling** — noted per component, EXP-004's report will aggregate.
- Masonry, vertical columns, inline icons, custom control marks, labeled dropdowns: defer with
  named reasons, all corpus-rare.
