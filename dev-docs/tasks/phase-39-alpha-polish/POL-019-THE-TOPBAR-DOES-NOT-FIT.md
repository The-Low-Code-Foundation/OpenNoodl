# POL-019 — the topbar's left group paints over its right cluster at most side-panel widths

**Found** 2026-08-06 by Richard, driving the editor. Not previously filed by anyone; this is its
first owner. It gets a row because that is the phase's rule —
[POL-016](POL-016-THE-TWO-FINDINGS-POL-005-FILED.md) exists because a finding recorded only as prose
is a finding that has been lost.

**Status:** ☑ **FIXED 2026-08-06.** All four criteria measured live in both themes.

## What was reported, and what was actually proved

Richard's report was honest about its own limits, and it is worth keeping the distinction:

> With the side panel at ~458px the topbar visibly garbles — the zoom readout and the fit-zoom
> dropdown paint on top of each other; in a screenshot the `100%` renders as `1♦0%` with the
> fit-zoom glyph through it. **I did not complete the measurement at the wide width**, so treat "it
> overlaps" as observed in a screenshot, not yet measured.

It is measured now, and the screenshot reading was right about the symptom and wrong about the
culprit. Nothing on the right-hand side overlaps anything else on the right-hand side — every
control there sits in its own box at every width tested. What lands on top of the `100%` is the
**route pill from the left group**, whose right edge is at exactly `944` while the zoom readout
starts at exactly `944`.

## The measurement

Window 1368px throughout. `x` values are `getBoundingClientRect()` left–right, read in the running
editor. "Right cluster" is the warnings chip, screen-size dropdown, zoom readout, split-layout
controls, Design/Preview and Deploy.

### Before

| side panel | topbar | `isSmall` | LeftSide box | **route pill** | right cluster | verdict |
|---|---|---|---|---|---|---|
| 278 (Components) | 1036 | false | 348–827 | 464–793 | 835–1352 | clean |
| 418 (Problems) | 896 | false | 488–827 | **604–904** | 835–1352 | pill over the warnings chip and the screen-size dropdown |
| **458 (Settings)** | **856** | **false** | **528–827** | **644–944** | **835–1352** | **pill over warnings + screen size, its chevron landing exactly on the `100%` at 944 — Richard's `1♦0%`** |
| 558 (Backend Services) | 756 | true | 628–979 | 744–945 | 987–1352 | clean |
| **858 (any backend surface)** | **456** | **true** | **928–979** | **1044–1194** | **987–1352** | **the pill is rendered entirely inside the right cluster, over screen size, zoom and the split control** |

Two things that table says which the report could not:

- It is **not one width.** Every side-panel width from about **309px to 466px** overlaps, at this
  window size, and so does everything above ~603px. `458` is where Richard happened to be looking.
- The worst case is **a shipped default**, not an extreme: the seven backend surfaces declare
  `defaultWidth: 860` (POL-005), and at that width the route pill has left the left group entirely.

### After

| side panel | topbar | tier | LeftSide box | route pill | right cluster | overlap |
|---|---|---|---|---|---|---|
| 278 | 1036 | roomy | 348–827 | 464–793 | 835–1352 | none |
| 418 | 896 | small | 488–979 | 604–945 | 987–1352 | none |
| 458 | 856 | small | 528–979 | 644–945 | 987–1352 | none |
| 558 | 756 | small | 628–979 | 744–945 | 987–1352 | none |
| 858 | 456 | **tiny** | 920–987 | not rendered | 995–1360 | none painted |

At the `tiny` tier the geometric rects of two clipped nav buttons still *report* coordinates past
the boundary — `overflow: hidden` clips painting, not layout — so the verdict there is a paint-level
one: `document.elementFromPoint` at `x = 995, 1010, 1030, 1050, 1100` on the topbar row returns the
right cluster's own children at every point, and a screenshot in both themes shows the left group
ending cleanly at the boundary with no glyph cut through.

## The mechanism — three things, and only one of them is the breakpoint

**1. The route pill could not shrink, so it overflowed instead.**
[`EditorTopbar.module.scss`](../../../packages/noodl-editor/src/editor/src/views/EditorTopbar/EditorTopbar.module.scss)
gave `.LeftSide` `flex-grow: 1; min-width: 0` and `.UrlBarWrapper` `min-width: 300px`. `min-width: 0`
lets the *box* shrink; it says nothing about the contents. So the LeftSide box duly shrank to 299px
at the Settings width while the pill inside it kept its 300px and painted straight out of the
bottom of the flex line. `.LeftSide` had no `overflow`, so nothing stopped it.

**2. `.RightSide` was spared by accident.** It declared no flex properties at all, so it was
`flex: 0 1 auto` — shrinkable. It never actually shrank only because the left group absorbed the
entire shortfall by overflowing. Change anything about the left group and the right cluster starts
compressing instead.

**3. The breakpoint was a number that matched nothing.** `EditorTopbar.tsx` switched to its compact
layout at `bounds?.width < 850`. The roomy layout's own content measures **1007px**
(32 root padding + 450 left group at the pill's preferred width + 8 gap + 517 right cluster), and
the compact one **705px**. So between 850 and 1007 the component rendered a layout that did not fit
— a **157px dead band** — and at the Settings width the topbar is 856px, *six pixels* the wrong side
of a breakpoint nobody had ever measured against anything.

There was also a decoy in the file: `.Root` declared `container-name: editortopbar` with no
`container-type`, which makes it inert. Nothing queried it and nothing could, because the tiering
changes which elements React renders and not merely how they look. Removed rather than completed.

## The fix

Three parts, each doing one job, so that a future control added to this toolbar cannot bring the
overlap back by being 20px wider than the one it replaced.

1. **`.UrlBarWrapper` is `flex: 1 1 300px; min-width: 0`.** 300px is what the pill *prefers*, not a
   floor it may leave its parent to keep.
2. **`.LeftSide` clips (`overflow: hidden`) and `.RightSide` does not shrink (`flex: none`).** The
   left group is the only part of the toolbar that may give up space; the right cluster is fixed-size
   controls the user reaches for. The clip is the guarantee, not the fix.
3. **Two derived tiers replace the one magic number.** `TOPBAR_ROOMY_MIN_WIDTH = 1010` and
   `TOPBAR_TINY_MAX_WIDTH = 710`, both written next to the arithmetic they come from, in both the
   `.tsx` and the `.scss`. Below the second, the route pill and the dev-tools button are **unmounted**
   — not hidden, so neither stays in the tab order — because a 90px address bar shows no readable
   part of a route, and dev tools has a keybinding. The pill returns the moment the panel narrows.

## Criteria

1. ☑ At every side-panel width from the narrowest to the widest a panel can be, no descendant of the
   topbar's left group paints inside the right cluster. Measured at 278 / 418 / 458 / 558 / 858, plus
   a paint-level hit test at the tiny tier.
2. ☑ The `100%` zoom readout renders as `100%` with the Settings panel open. Screenshot, both themes.
3. ☑ The breakpoints are derived from the layouts' measured widths and the derivation is written
   down where the next person changing this toolbar will read it.
4. ☑ Both themes.

## Files

- `packages/noodl-editor/src/editor/src/views/EditorTopbar/EditorTopbar.module.scss`
- `packages/noodl-editor/src/editor/src/views/EditorTopbar/EditorTopbar.tsx`

## What this does not cover

The `is-small` Deploy button reports `scrollWidth 37` against `clientWidth 32` — about 5px of its
own content overflowing inside its own box. That is pre-existing (it measures the same on `HEAD`),
it is internal to the button rather than across a boundary, and it is not what was reported. Left
alone deliberately rather than swept in: it belongs to `PrimaryButton`'s compact padding, not to the
topbar's layout.
