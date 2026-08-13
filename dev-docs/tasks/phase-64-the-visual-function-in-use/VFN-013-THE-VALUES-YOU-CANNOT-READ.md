# VFN-013 — The values you cannot read

**Status:** ✅ **BUILT 2026-08-13** (`vfn-a-asks`) · **Tier 2** · ✅ mechanism pinned in source
· 🔴 **criteria 1, 4, 5 owe a live re-measure**

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

---

## ✅ What was built, 2026-08-13

**Candidate 1 with candidate 2's collision pass on top**, which is where the two of them met.

- 🆕 [`badgeLayout.ts`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/badgeLayout.ts)
  — the placement as arithmetic over rectangles. No DOM, no Blockly, no colours, so it is graded in
  the plain-Node runner. `legacyBadgeAnchor` is **exported** and is the negative control's formula:
  a copy in the spec would drift away from the thing it is meant to catch.
- `BlockValueBadges.paint` is now two passes. A badge's position depends on every *other* badge's
  position, so a paint that decided one mark at a time could not see the collision it was about to
  cause. The repaint key carries the **position**, not just the text — a badge whose value did not
  change can still have to move because a neighbour got wider.
- **What counts as an obstacle** is `getBoundingRectangleWithoutChildren()` — the block's *own*
  painted box. 🔴 `getHeightWidth()` is the obvious call and is the wrong one: it measures a
  statement block *plus the entire stack below it*, so every badge would have been pushed clear of a
  whole program.
- **The nesting test is `getSurroundParent() !== null`**, not `getParent()`. Blockly walks up past
  every `next` connection, so a statement in a top-level stack answers `null` — its neighbours are
  neighbours, not containers. `getParent()` would have called every statement in a program nested.

### Where each criterion stands

| # | State | How |
|---|---|---|
| 1 | ✅ headless · 🔴 live owed | `badge-layout.spec.ts` intersects every badge box against every block box on the reported fixture and on a two-statement stack. **Negative control prints 4 real overlaps** with the old anchor, including `price badge ∩ setTotal` (the `21` over the word "to") and `qty badge ∩ price` |
| 2 | ✅ | A top-level statement's placement equals `legacyBadgeAnchor` **to the pixel** (`dx === -(width + 6)`, `dy === 0`), and so does an **orphan top-level value block** — the two badges the live sweep measured clean |
| 3 | ✅ **and it found a real failure** | See below |
| 4 | ✅ | Every nested placement has `dx >= 0`. A nested badge can no longer reach left of its own block, so nothing near the workspace's left edge can push it off-canvas |
| 5 | ⚠️ by construction, live owed | Badges stay children of the block's SVG group, so they still track it. The layout is recomputed from live geometry on **every** paint, and the position is in the repaint key. Note that any real move already fires a non-UI `BLOCK_MOVE`, which `invalidate()`s the whole run — so "recomputed on move" has no code path today that it changes |

### 🔴 Criterion 3 was a real failure, and it was not the placement

The badge fill was `--theme-color-bg-2`. Blockly block bodies are on the **hue scale** and are
deliberately theme-independent (`BlocklyTheme`'s module note: the hues are semantic), which puts
every block between relative luminance 0.15 and 0.36. In the **light** theme `bg-2` is `#f7f9fb`
and measures **2.58:1** against the My Blocks hue — under the 3:1 floor this register has already
lost nine glyphs to.

Nothing above L ≈ 0.017 clears 3:1 against all of them, so **there is no light-theme badge fill
that passes**. The badge is now dark in both themes — the register's *"dark is binding for anything
painted on a wire"* arrived at again from the other end — and
`badge-contrast.spec.ts` sweeps the **whole hue circle** rather than the seven hues in use today.
Worst measured: fill 3.21:1 (hue 240), ink on fill 17.19:1. The negative control asserts the old
fill still fails.

⚠️ The hollow mark's wash stays token-driven: it dims a block rather than sitting on one.

### 🔴 What the headless spec cannot see, and what a drive must do

`layoutBadges` is arithmetic and is graded exhaustively. What is **not** graded is whether
`BlockValueBadges.blockBox` feeds the real renderer's numbers in correctly — that is one
`getBoundingClientRect()` sweep in a driven editor, and the coordinator has already run the
*before* half of it:

```
badge "3"   [843,400,17,16]   worst overlap 266 px²   ← nested, on the × dropdown
badge "21"  [629,394,23,16]   worst overlap 371 px²   ← nested, over the word "to"
badge "7"   [608,599,17,16]   NONE                    ← orphan top-level value block
badge "7"   [632,498,17,16]   NONE                    ← orphan top-level value block
```

**The re-run must take 266 and 371 to zero and leave the two NONEs alone.** The badge widths in that
sweep also confirm `badgeBoxWidth` exactly (`"3"` → 17 ≈ 1 × 6.6 + 10; `"21"` → 23 ≈ 2 × 6.6 + 10).

### ⚠️ One residual, written down rather than papered over

In a **stack** of statements there is no free space in any direction around a nested block: above is
the previous statement, below is the next one. The layout resolves this by trying above-1,
below-0, above-2, below-1 in that order, which holds every badge in the two-statement fixture to
within one badge-row of its block and produces zero overlaps. A **denser** program than the fixture
could exhaust all six candidates, in which case the badge takes its preferred position and overlaps
— it is bounded, and the spec asserts the excursion bound so the failure mode stays "slightly
misplaced" rather than "four rows away". The first version of the layout climbed straight up and
put a badge **76px** from its block; that passed every overlap assertion and was unreadable, which
is why the excursion bound is a test.
