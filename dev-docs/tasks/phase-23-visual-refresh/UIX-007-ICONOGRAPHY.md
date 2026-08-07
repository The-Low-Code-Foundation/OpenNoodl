# UIX-007: Iconography Normalization

## Metadata

| Field | Value |
|-------|-------|
| **ID** | UIX-007 |
| **Phase** | Phase 23 — Visual Refresh (Track I) |
| **Tier** | 2 — surfaces |
| **Priority** | 🟡 Medium (quiet but compounding — inconsistency here is what "unmaintained" pattern-matches to) |
| **Difficulty** | 🟢 Easy–Medium (volume, not complexity) |
| **Estimated Time** | ~1 week |
| **Prerequisites** | UIX-001; pairs naturally with UIX-004 |
| **Branch** | `task/uix-007-iconography` |
| **Recommended executor** | 🟢 **Sonnet 5** |

## Objective

One icon system: a single stroke-weight/grid convention across the rail, toolbar, panels, launcher, and canvas category glyphs, delivered through one icon component, with the old mixed sets retired.

## Background

The editor's icons accumulated across eras: different stroke weights between the rail and the properties panel's alignment icons, different corner treatments, some filled/some stroked with no logic, low-contrast grays with no state system. Icons are cheap individually and expensive in aggregate — a consistent set is a large share of "this looks maintained." The mocks establish the convention: 16px grid (rail at 17), 1.5px rounded stroke, `currentColor` fills so tokens drive state colors, filled variants only for status/severity glyphs (warning triangle, error).

## Current State

- Multiple icon sources (inventory at task start: grep svg imports/components in core-ui + editor views; note any icon font remnants).
- No single Icon component contract (size/color/state handled ad hoc).
- Canvas node glyphs painted separately (UIX-005 ships simple category glyphs).

## Desired State

- **Inventory** of every icon in user-visible chrome (NOTES.md table: glyph, where used, source file, keep/redraw/delete).
- **Convention:** 16×16 viewBox, 1.5 stroke, round caps/joins, `currentColor`; status glyphs filled; sizes rendered at 12/14/15/17 per context (mock values). Document in `DESIGN-TOKENS.md` or a sibling `ICONOGRAPHY.md`.
- **One Icon component** (or normalize the existing one) in core-ui: name-keyed, size prop, inherits color; tree-shakeable (no giant sprite that ships every glyph everywhere — follow whatever import pattern core-ui already uses for components).
- **Redraw/replace** the non-conforming glyphs. Prefer adapting an OFL/MIT set (e.g. Lucide) to hand-drawing where glyphs match semantics — record licenses; keep custom glyphs (node categories, NodeGX-specific concepts) hand-drawn to the same grid.
- **States** ride tokens: default fg-3 / hover fg-1 / active accent (per UIX-004's rail pattern) — the component doesn't hardcode any color.
- Old icon files/sets deleted when their last consumer migrates (leave nothing half-migrated; the ratchet mindset applies).

## Scope

### In Scope
- [ ] Full chrome icon inventory
- [ ] Convention doc + Icon component contract
- [ ] Redraw/adapt all non-conforming chrome icons (rail, toolbar, panel section/controls, launcher, dialogs, context menus)
- [ ] Migrate consumers; delete retired sets
- [ ] Alignment-control icons (UIX-003's segmented controls) redrawn to grid
- [ ] Canvas category glyph review with UIX-005 (same visual language painted vs. DOM)

### Out of Scope
- App icon / OS branding (parked)
- Node-library *node icons* beyond category glyphs (many nodes ship their own art — inventory and hand the list to UIX-009 for triage; do not redraw hundreds of node icons in this task)
- Illustrations / empty-state art (UIX-006/009 own their spots)

## Implementation Steps

1. Inventory + keep/redraw/delete triage.
2. Convention doc + component contract; license note for any adapted set.
3. Redraw in batches by surface (rail+toolbar → panels → launcher → menus), migrating consumers per batch with live spot-checks.
4. Delete retired sources; final sweep for stragglers (grep old import paths).

## Success Criteria

- [ ] Every chrome icon renders through the one component at documented sizes
- [ ] Screenshot of rail + toolbar + a panel shows uniform weight/style
- [ ] No orphaned icon assets/imports remain
- [ ] States (hover/active) driven by tokens everywhere
- [ ] Licenses recorded for adapted glyphs

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Icon swap changes meaning (users know the old glyph) | Keep metaphors, change rendering; flag any metaphor change for explicit review |
| Hidden consumers (context menus, rare dialogs) keep old icons | Grep-driven migration by import path, not by eyeballing screens; delete sources so stragglers break the build loudly |
| Volume balloons via node-library icons | Explicitly out of scope; triage list handed to UIX-009 |

## References

- [mocks/](./mocks/) — the convention in use
- [UIX-004](./UIX-004-EDITOR-CHROME-AND-PANELS.md) — state colors for rail/toolbar
- [UIX-005](./UIX-005-CANVAS-REPALETTE.md) — painted category glyphs to match

## Checklist

- [ ] Inventory + triage
- [ ] Convention + component
- [ ] Batched redraw/migration; retired sets deleted
- [ ] Live spot-checks; CHANGELOG
