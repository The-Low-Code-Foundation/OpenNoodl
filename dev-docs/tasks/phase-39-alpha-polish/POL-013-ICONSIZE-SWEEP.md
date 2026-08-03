# POL-013 — Make `IconSize` real

**Split out of** [POL-003](POL-003-THE-LEFT-RAIL.md) slice 2, on Richard's call (2026-08-03): scope
phase 39 to the one hide-panel row and file the sweep rather than change ~130 call sites before an
alpha cut.

**Status:** filed, not started. Not alpha-blocking.

## The mechanism — confirmed twice

`IconButton` passes `size` down (`IconButton.tsx:93` → `<Icon icon={icon} size={size} …>`) and `Icon`
applies it as `css[size]` (`Icon.tsx:225`). But
[`Icon.module.scss`](../../../packages/noodl-core-ui/src/components/common/Icon/Icon.module.scss)
**declares no `is-size-*` rule at all**. `is-size-large`, `is-size-small` and `is-size-tiny` are class
names with no declarations, so `size={IconSize.Large}` is a no-op at every call site in the codebase.

This is UIX-010's finding, confirmed here at the CSS level rather than by inspection.

## What actually determines an icon's size today

Nothing in the component. `Icon`'s box is `.Root { display: block }` plus `svg { width: 100%; height:
100% }`, so the rendered box collapses to the **SVG file's own intrinsic `width`/`height`
attributes**. The set has two eras and they do not agree:

| Era | Files | Intrinsic size |
|---|---|---|
| Newer "house" glyphs | most of `icon-component/` | `16×16`, `stroke-width: 1.5` |
| Older imported glyphs | `cards.svg`, `viewport_*.svg`, `arrows_in_line_*.svg`, … | `24×24` / `24×25`, filled paths |

Measured in the running editor on 2026-08-03, the side-panel header row was `16×16`, `24×24`,
`24×25`, `16×16` — a 50% size spread in four adjacent controls, invisible in code review because
every one of them either passed no size or passed one that does nothing.

POL-003 normalised **that row only**, locally, in `SidePanel.model.scss`. The rest of the editor
still has the spread.

## What to build

1. Add the four `is-size-*` rules to `Icon.module.scss` with explicit `width`/`height`. Pick the
   scale deliberately — `tiny/small/default/large` currently have no numbers attached to them
   anywhere, so this task defines them.
2. Audit the ~130 `size={IconSize.*}` call sites: each one was written by someone who believed it
   did something, so the declared intent is usually right, but it has never been seen.
3. Screenshot-sweep both themes against the UIX-009 corpus and fix what moved.
4. Delete the local override block in `SidePanel.model.scss` (it names this task) and pass a size
   instead.
5. Consider stripping intrinsic `width`/`height` from the SVG files so the component is the only
   thing that sizes a glyph — otherwise the two mechanisms stay in competition.

## Criteria

1. Every `is-size-*` class has declarations.
2. A both-theme screenshot sweep shows no unintended size change.
3. `SidePanel.model.scss`'s POL-003 override is gone, replaced by a size prop.
4. No glyph's rendered box depends on its SVG file's intrinsic attributes.

## Traps

- **This is a ~130-call-site change in effect the moment the rules exist**, not when call sites are
  edited. There is no incremental landing: the first commit changes everything at once.
- Icons rendered through `dangerouslySetInnerHTML` and through `ReactComponent` take different
  branches in `Icon.tsx`; check both.
