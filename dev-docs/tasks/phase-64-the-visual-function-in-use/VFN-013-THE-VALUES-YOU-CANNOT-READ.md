# VFN-013 — The values you cannot read

**Status:** 📋 open · **Tier 2** · ~half a day · ✅ **mechanism pinned in source, no reproduce needed**

## The report

> *"The values that show during the run in the blockly editor are hard to see, covered a bit by
> blocks I think? Can we make them easier to see?"*

Reported 2026-08-13 from the first live test of the bench (VFN-011), with a screenshot: on
`set output total to [ … ]`, the `21` badge sits **on top of** the block to its left, and the `21`
on the multiply block's right operand is half behind the `×` dropdown.

## The mechanism, and it is one line

[`BlockValueBadges.ts:207-210`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/BlockValueBadges.ts):

```ts
// The output connection is on the left edge; the badge hangs just outside it so it does not
// … same anchor, which is where its wire would have left from.
const x = -(width + 6);
```

The badge is anchored **outside the block's own left edge**. For a **top-level** block that is
empty canvas and the design reads exactly as intended — left-to-right along the data path, which is
the argument written at [`:20-23`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/BlockValueBadges.ts).

🔴 **For a NESTED block there is no empty canvas there.** A block plugged into a value input has its
left edge *inside its parent's body*, so "just outside my left edge" is "on top of my parent". Every
badge on a nested block therefore overlaps whatever it is plugged into — and nested blocks are the
common case, because that is what an expression *is*.

⚠️ **The anchor is not wrong, its assumption is.** Do not simply move badges to the right or above;
that discards the left-to-right data-path reading for the top-level blocks where it works. The fix
is to make the placement *aware of whether the block is nested*.

## What to build

A placement that keeps the existing anchor where it reads well and moves out of the way where it
does not. Candidates, in the order I would try them:

1. **Nested → above the block's top-left, top-level → unchanged.** Cheapest, keeps both readings,
   and "above" is empty for a nested block far more often than "left" is.
2. **Collision-aware nudge.** Compute the badge box, test it against the parent's rendered path, and
   push it to the first free side. More faithful, more code, and needs a rule for ties.
3. **Badges outside the block stack entirely**, on a gutter at the workspace edge with leader lines.
   Rejected unless 1 and 2 both fail — it breaks the "value sits where the value is" property that
   makes the strip readable at a glance.

Whatever is chosen, the badge must stay **legible against the block it now overlaps or abuts**: the
non-text contrast floor is **3:1**, and this register already carries nine dark-on-dark glyphs found
at worst 1.16:1 because nobody measured.

## Acceptance criteria

1. On a program of nested arithmetic (`a × b` inside `set output`), **no badge overlaps any block's
   text or field**. Proved by measurement, not by a screenshot.
2. Top-level statement blocks keep the existing top-left anchor and reading.
3. Badge contrast measures **≥ 3:1** against whatever now sits behind it, in both themes.
4. A badge on the *deepest* nested block is still fully inside the visible workspace when its block
   is near the left edge — the current anchor can push it off-canvas there.
5. Nothing regresses when a block is dragged: badges track their block, and the placement is
   recomputed on move, not only on run.

## How to prove it

🔴 **`getBoundingClientRect()` on the badge and on the parent block, and intersect them.** A
screenshot of a badge that looks fine at one zoom is the instrument that lost this in the first
place — and note that hit-testing and paint disagree in this feature already
(`overflow: hidden` on `.CanvasTabs` clips hit-testing while measuring perfectly).

⚠️ **Glyphs must be painted at screen size**, not scaled with the workspace — the canvas register
carries that one already.

A negative control is cheap here and should be built: run the same intersection test against the
*current* anchor on a nested block and require it to report an overlap. A placement test that cannot
see today's bug proves nothing about tomorrow's fix.
