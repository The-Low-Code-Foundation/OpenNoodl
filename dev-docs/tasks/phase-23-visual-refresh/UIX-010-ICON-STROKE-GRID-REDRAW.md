# UIX-010: Icon Stroke-Grid Redraw + IconSize Retune

## Metadata

| Field | Value |
|-------|-------|
| **ID** | UIX-010 |
| **Phase** | Phase 23 — Visual Refresh (Track I) |
| **Tier** | 2 — surfaces (follow-up) |
| **Priority** | 🟡 Medium (compounding polish; nothing is broken) |
| **Difficulty** | 🟢 Easy–Medium (volume and taste, not complexity) |
| **Estimated Time** | ~1 week |
| **Prerequisites** | UIX-007 (convention + `currentColor` conversion, both landed) |
| **Branch** | `task/uix-010-icon-stroke-grid` |
| **Recommended executor** | 🟢 **Sonnet 5** — the convention is decided and written down; this is systematic application plus one live sizing pass |

## Objective

Finish what UIX-007 started: bring the remaining fill-drawn glyphs in `noodl-core-ui` onto the 16×16 / 1.5px round-stroke grid, and retune `IconSize` from four abstract steps to the mock's per-context sizes.

## Background

UIX-007 established the icon convention and did the mechanical half: all **149** SVGs in
[`packages/noodl-core-ui/src/assets/icons/icon-component/`](../../../packages/noodl-core-ui/src/assets/icons/icon-component/)
now inherit `currentColor`, so every glyph is already theme-aware and state-aware. What it
deliberately declined was the *drawing* half — redrawing hundreds of glyphs blind, without a
live pass, is how an icon set ends up worse than it started. UIX-009 filed this as the owned
follow-up rather than leaving it as silent drift.

Measured at task creation (2026-07-26): **88 of 149** glyphs carry no `stroke=` attribute —
they are drawn as filled paths. UIX-007 redrew 57 to the grid; these are the remainder. The
notes estimated "92"; trust the live count over the estimate, and re-measure at task start:

```sh
cd packages/noodl-core-ui/src/assets/icons/icon-component
grep -L 'stroke=' *.svg | wc -l
```

## Current State

- 149 glyphs, all `currentColor`, all rendered through one `Icon` component.
- 88 of them are fill-drawn at assorted viewBoxes rather than stroked on the 16×16 grid, so
  weight and corner treatment still vary visibly between neighbouring icons.
- `IconSize` ([Icon.tsx:161](../../../packages/noodl-core-ui/src/components/common/Icon/Icon.tsx#L161))
  is a four-value class-name enum — `Default` / `Large` / `Small` / `Tiny` mapping to
  `is-size-*` CSS classes. The mocks specify per-context pixel sizes (12 / 14 / 15 / 17), which
  the current four abstract steps do not cleanly express.
- Glyphs are bulk-loaded by `require.context` over the whole folder
  ([Icon.tsx:177](../../../packages/noodl-core-ui/src/components/common/Icon/Icon.tsx#L177)),
  keyed by **filename**. Renames are therefore breaking changes with no compiler help.

## Desired State

- Every glyph in user-visible chrome drawn to the convention: **16×16 viewBox, 1.5px stroke,
  round caps and joins, `currentColor`**, no baked fills.
- **Status/severity glyphs stay filled** — that distinction is semantic (a filled warning
  triangle reads as a state, a stroked one reads as a control) and is part of the convention,
  not an exception to it.
- `IconSize` expresses the mock's real sizes, applied per context, verified against a running
  editor rather than swapped as a blind constant change.
- A NOTES.md table recording every glyph touched: name, before (fill/viewBox), after,
  keep/redraw/delete.

## Scope

**In scope**

- The 88 fill-drawn glyphs in `icon-component/`.
- The `IconSize` enum, its CSS, and its call sites across editor + core-ui.
- Deleting any glyph the sweep proves has no consumer (UIX-009 already did this for the 5 dead
  `icon-button/*` files — same discipline, same evidence bar: no source reference, no
  `require.context` glob, green build).

**Out of scope**

- The editor's separate legacy icon set and its CSS `url()` consumers — that is **UIX-011**,
  and the two tasks must not both edit `packages/noodl-editor/src/assets/icons/`.
- Canvas category glyphs painted by `CanvasTheme` (UIX-005 owns those; they are drawn, not SVG assets).
- Any new glyph design or icon-set expansion.

## Approach

1. **Re-measure and inventory.** Regenerate the fill-drawn list; for each, record where it is
   used (`IconName` key → consumers). Anything with zero consumers goes on the delete list.
2. **Redraw in batches by visual family** (arrows, then media controls, then node-category
   glyphs, …) rather than alphabetically — consistency errors are visible within a family and
   invisible across one. Prefer adapting an OFL/MIT set (Lucide) where semantics match; keep
   NodeGX-specific concepts hand-drawn to the same grid. Record licences.
3. **Do not rename files.** `require.context` keys on filename and nothing type-checks it. If a
   rename is genuinely warranted, grep every `IconName` consumer in the same commit.
4. **IconSize retune last**, and live: capture the UIX-009 corpus before and after
   (`dev-docs/tasks/phase-23-visual-refresh/corpus/run.sh`) and compare the gallery. A size
   change ripples through rail, toolbar, panels, and launcher simultaneously — this is the step
   that needs eyes, which is exactly why UIX-007 deferred it.

## Verification

- `npm run build` green; hex-colour ratchet still passes (no literal colours reintroduced).
- **Before/after screenshot corpus in both themes** via the UIX-009 harness — this is the
  acceptance evidence, not a nice-to-have. A redraw task with no visual diff is unverified.
- Every glyph renders at every `IconSize` without clipping (the classic stroke-grid failure:
  a 1.5px stroke on a 16 grid scaled to 12 goes fuzzy or crops at the viewBox edge).
- No glyph left half-migrated: the fill-drawn count reaches 0, or every survivor is a
  documented status-glyph exemption listed in NOTES.md.

## Notes

- The icons are *already* theme-correct. Nothing here fixes a bug; if capacity is contended
  this task yields to anything functional without loss.
- Watch the viewBox when redrawing: several current glyphs are 25×25 or 24×24. Rescaling the
  path data without re-fitting to the 16 grid produces a technically-conforming icon that still
  looks wrong next to its neighbours.
