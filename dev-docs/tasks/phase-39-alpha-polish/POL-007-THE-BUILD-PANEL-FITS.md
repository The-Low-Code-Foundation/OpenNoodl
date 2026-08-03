# POL-007 — The Build panel fits inside the Build panel

Covers reported item **9a**.

## What was reported

> The layout of the AI builder page is really embarrassing. Can you fix it please?

With screenshots showing the panel's content clipped on the left (`"of 3 built · 24s · $0.11"` with
the `3` cut off), buttons wrapping onto their own lines, and a horizontal scrollbar along the bottom
of the panel.

## The mechanism — confirmed

`AiAuthoringPanel` registers with `defaultWidth: 400`
([`router.setup.ts:177`](../../../packages/noodl-editor/src/editor/src/router.setup.ts#L177)).

Inside it, each operation in a run renders as
([`ProjectAuthoringView.tsx:1216-1281`](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/ProjectAuthoringView.tsx#L1216-L1281)):

```
HStack[ Icon | Text(flex:1) | elapsed | "Review" | "Drop from plan" ]
```

and in the failed case a third button, `"Retry"`. `PrimaryButton` labels do not wrap and the buttons
do not shrink, so the row's **min-content width** is roughly:

`24 (icon) + 3em (a name) + 40 (elapsed) + ~70 ("Review") + ~120 ("Drop from plan") + gaps`

That already exceeds 400px before the operation's name is considered. The plan-preview rows above
([lines 1128-1160](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/ProjectAuthoringView.tsx#L1128-L1160))
have the same shape with a `minWidth: 44` label and a `"Drop"` button.

Nothing in the panel establishes `min-width: 0` or `overflow-x: hidden`, so the overflow propagates
to the panel root and the whole page scrolls sideways — which is what puts the run headline
off-screen to the left.

`AiAuthoringPanel.module.scss` is **16 lines** and styles three things. Effectively all of this
layout is `UNSAFE_style` inline objects (25 of them in `ProjectAuthoringView.tsx`), which is why
there is no single place where a min-width could have been set.

## What to build

This is a layout task, not a redesign. The panel's information architecture — scope tabs, run
headline with cost, per-operation rows with activity feeds, the apply/discard footer — is AIB-002's
and is right. What is wrong is that it was only ever driven at a width it does not have.

**Slice 1 — decide the row at 400px.** An operation row has to carry, at minimum: status, what is
being built, elapsed, and two actions. At 400px that is two lines, not one. Suggested shape:

```
✓  create /Pages/Profile — 6 nodes            11s
   [ Review ]  [ Drop from plan ]
```

Actions on their own line, full-width or evenly split, so the labels never compete with the target
name. The target name gets `min-width: 0` + ellipsis and the row never overflows.

Move this out of inline `UNSAFE_style` and into `AiAuthoringPanel.module.scss`. A layout that has to
respond to width cannot live in 25 inline objects.

**Slice 2 — the panel cannot scroll sideways.** `overflow-x: hidden` on the panel body, with every
long child ellipsising or wrapping instead. The ProvenancePanel comment at
`ProvenancePanel.module.scss:27-32` records exactly this decision and why `auto` was wrong there —
same reasoning applies.

**Slice 3 — sweep the rest of the panel at 400px.** The header buttons (`This component` / `Project`
/ `Docs`), the run headline, the plan-preview rows, the recovered-plan block, the apply/discard
footer, and the activity feed. Screenshot each state at 400px.

**Slice 4 — check it at the widths it can actually be.** The panel is resizable and PNL-003
remembers what the user drags to; PNL-009 gives it float and full modes. Check 400 (default), ~700
(dragged), and full. At wide widths the two-line row should be allowed to collapse back to one — but
only if that costs nothing; a single well-behaved layout beats two.

## Criteria

1. No horizontal scrollbar in the Build panel at its 400px default, in any run state.
2. The run headline is fully visible without scrolling.
3. Every operation row shows status, target, elapsed and its actions, with the target ellipsising
   rather than pushing the row wider.
4. Screenshots at 400px of: empty, plan proposed, running, staged-with-review, failed-with-retry,
   applied.
5. Still correct at ~700px and in full mode.
6. Both themes.

## Traps

- **A run is required to see most of these states.** The no-provider PLAN driver from AIB-002 and the
  scripted-session recipe from AIX-003 exist precisely so this does not need a paid model call —
  use them rather than eyeballing the empty state and calling it done.
- HMR does not re-apply a changed effect to a mounted panel, and a later effect in the same mount
  wins. Restart the editor between layout iterations.
- Do not fix this by widening `defaultWidth`. The panel's width is the user's; the layout is ours.
