# POL-013 — Make `IconSize` real

**Split out of** [POL-003](POL-003-THE-LEFT-RAIL.md) slice 2, on Richard's call (2026-08-03): scope
phase 39 to the one hide-panel row and file the sweep rather than change ~130 call sites before an
alpha cut.

**Status:** ✅ **done 2026-08-04** (sixth session). All four criteria, measured in the running editor
in both themes. The instrument is `scripts/pol39-live/pol013-icon-census.js`; the before/after
corpora are in [measurements/pol013/](measurements/pol013/).

> ## The scale, and what it cost
>
> **`tiny 12 · small 14 · default 16 · large 20`**, defined here because nothing anywhere had numbers
> attached to these names. It sits on `Label`'s 10/12/14 type scale — an icon reads one step above the
> text it labels. `default` is 16 because that is what **543 of 878** rendered icons already were;
> `large` is 20 because that is the box POL-003 picked by hand when Richard asked for the hide-panel
> glyph to be bigger.
>
> The census measured **307 icons changing box** in dark and 266 in light, and every one of them is
> either a call site's own declaration finally taking effect (16→12 Tiny, 16→14 Small, 16→20 Large) or
> an oversized legacy glyph coming onto the scale (24, 25, 31 → 16). Afterwards **every visible icon
> in the editor renders at one of exactly four sizes** and **zero** are off-scale.

## What the spec did not have

**1. The call-site count was 130. It is 441 — and 319 of them declare nothing.** A static survey
(`icon={IconName.X}` paired with the nearest `size=`, resolved against each SVG's intrinsic
attributes) found only 112 sites passing a size at all. The other 319 were taking whatever their
glyph file happened to be: 16, 20, 24, 25, 30 or 31 px. So this was never mainly a task about
honouring 130 declarations; it was about the 319 that never made one.

**2. Forty-seven visible glyphs were not merely the wrong size — they were destroyed.** The baseline
census found icons rendering at **0.48px**, 3.91px, 5.73px, 8.11px, inside `IconButton` (inline-flex,
4px padding) and the topbar's zoom select. `Icon`'s auto-width span is an ordinary flex item, so
`flex-shrink: 1` let an overflowing row crush it to nothing. No call site asked for that, and no
screenshot sweep would have named it — it reads as "an icon is missing". `.Root` now carries
`flex: 0 0 auto`, which is a second fix inside this one.

**3. Criterion 5 is unnecessary, and that is a finding rather than a dodge.** The spec asks whether to
strip `width`/`height` from 169 SVG files "so the component is the only thing that sizes a glyph".
It does not need to: `svg { width: 100%; height: 100% }` is CSS and already outranks a presentation
attribute. The attributes only ever mattered because the *span* had no size, so `100%` resolved
against an auto-width parent and fell back to intrinsic sizing. Give `.Root` a box and the
competition is over — measured, `0` of 894 rendered icons are off the declared scale. A 169-file
rewrite would have changed nothing and risked the non-square viewBoxes (`24×25`, `31×30`), which
`preserveAspectRatio` letterboxes correctly as they are.

**4. Three hosts were sizing the glyph themselves, and `flex: 0 0 auto` broke them before the size
rules did.** The components panel's caret (a 12px wrapper) and category icon (15px), and the
component trail's `.Icon` (11px, applied to the Icon's own root through `UNSAFE_className`, so a
straight specificity loss to `.Root.is-size-*`). The first census after the fix caught all three:
15→16 on 47 icons, 12→16 on 27, 11→16 on 19 — glyphs overflowing boxes that had been holding them in
by shrinking them. Each now declares a size instead (`Small`, `Small`, `Tiny`), which is criterion 3's
pattern applied three more times, and the re-measured diff shows 15→14, 11→12 and the caret unchanged.

## What was built

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
   → **Not needed. See "What the spec did not have", point 3.**

## Criteria

1. ✅ Every `is-size-*` class has declarations — `tiny 12 / small 14 / default 16 / large 20` in
   `Icon.module.scss`, plus `flex: 0 0 auto` so a row cannot crush a glyph.
2. ✅ **Measured, not eyeballed.** `pol013-icon-census.js` records every rendered icon's box and files
   it under a stable key, so "did anything move unintentionally" is a diff. Both themes, before and
   after, in [measurements/pol013/](measurements/pol013/). 307 icons moved in dark and 266 in light;
   every transition is accounted for above, and the three that were not intended were found by the
   diff and fixed. Screenshots of the launcher and editor in both themes confirm the result reads
   right, which the numbers cannot.
3. ✅ `SidePanel.model.scss`'s POL-003 override is gone; the five mode-row controls pass
   `size={IconSize.Large}` (20px — the same box the override hardcoded). The wrappers stay, because
   they were also doing the `display: flex; align-items: center` job that centres the row.
4. ✅ **0 of 894** visible icons render off the 12/14/16/20 scale, in both themes, and 894 of 894
   carry an `is-size-*` class. Before the change the DOM did not carry the class at all — `css[size]`
   resolved to `undefined` and `classNames` dropped it.

## Traps

- **This is a 441-call-site change in effect the moment the rules exist**, not when call sites are
  edited. There is no incremental landing: the first commit changes everything at once.
- Icons rendered through `dangerouslySetInnerHTML` and through `ReactComponent` take different
  branches in `Icon.tsx`; both apply the same `css[size]` class, so both are covered.

### Three the instrument taught, worth keeping

- **A key must not contain the thing the change changes.** The first before/after diff reported
  `1354 appeared / 1355 vanished / 0 unchanged`. Adding the size rules put a new class on the icon
  span, and the census keyed each icon by a DOM path that included its class list. A total-churn diff
  is the signature of a moved key, not of a huge change.
- **Two runs of the same build must agree before a diff means anything.** They did not: one baseline
  reported 47 icons squeezed under 10px and the next reported none. Not animation — the side panel
  keeps whatever width the previous run left it, so a row overflowed in one run and fitted in the
  next, and a flex-shrunk icon is a *correct* measurement of a different layout. Pinning the viewport
  to 1600×1000 (what the UIX-009 corpus harness does) plus a 0.5px noise floor took same-build churn
  to **0 moved**.
- **`getComputedStyle().width` cannot tell you whether a host sized an element.** It returns the
  *used* width — a px number — for an unsized block span exactly as for a sized one. The only
  question that separates them is whether the measured box equals the SVG file's own attributes.
