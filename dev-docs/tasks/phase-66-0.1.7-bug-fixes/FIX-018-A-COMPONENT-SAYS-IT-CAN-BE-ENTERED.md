# FIX-018 — A component says it can be entered

**Report 13** · Tier 2 · Effort **S–M** · Mockups delivered

> ## ✅ RULED 2026-08-14 — **Option C: chip + stacked card.**
> Richard, on the mockup artifact: *"Chip plus stacked card is awesome, validated."*
> So the build is: (1) diamond glyph in the 22×22 header chip, purple `#a78bfa` fill, for every
> component instance; (2) the 3&nbsp;px offset stacked-card edge on the bottom-right; (3) the
> right icon slot stays free for health — warning and component-ness visible at once; (4) the
> context-menu *"Open component"* item. **Not** taken: the B chevron (C's stacked edge carries
> the affordance) — though A/B/C compose if a drive later shows the edge alone is too quiet.
> Purple semantics default stands unless overridden: plumbing nodes keep purple, the glyph
> disambiguates. The remaining open questions below are build details, not blockers.

> *"I think we need a visual distinction between what's a basic node that you can't go deeper
> into, and what's a component that you can double click to explore … maybe icons? Shape? Please
> mock up an artifact and show me some proposals."*

## Current state — pinned

The only cue today is an **18×18 grey diamond icon in the top-right** of the card
(`updateIcon()`, `NodeGraphEditorNode.ts:96-119`) — and it sits in a **mutually-exclusive
priority chain**: an unhealthy component shows the warning triangle and *stops looking like a
component*. Worse:

- The header chip's colour is **inherited from the component's root node**
  (`ComponentModel.get color()`, `componentmodel.ts:440-449`) — a component with a visual root
  paints the same blue chip as a Group; a logic-only component paints grey. Nothing about the
  chip says "component".
- The purple `component` hue (`#a78bfa`) currently means "component **plumbing**" (Component
  Inputs/Outputs, Event Send/Receive…), not "component instance".
- There is **no context-menu "Open component"** — double-click is the only door, and the workflow
  canvas already added a menu twin for exactly this reason (`WorkflowDocument.ts:243-249`:
  *"double-click … is undiscoverable"*). That precedent argues for the same here regardless of
  which visual wins.
- Cards are never larger than 150px on screen (max zoom 1.0) — any mark must read at 150×36.

Full palette, geometry, and paint-order facts are in the mockup artifact and the lane notes;
`NodeGraphEditorNode.isComponent()` exists and is **unused by the painter**.

## The four candidate treatments (mocked up in the artifact)

| Option | What changes | Cost |
|---|---|---|
| A — chip carries the mark | Component instances get the diamond glyph in the 22×22 header chip, purple `#a78bfa` fill | one branch in the painter + one glyph case; **cheapest** |
| B — A + enter chevron | plus a small `»` affordance in the bottom-right corner (the one region free of hot zones) | ~10 more lines, paint-only |
| C — A + stacked card | plus a 3px offset "card behind the card" edge on the bottom-right — the classic "this contains more" silhouette | ~6 lines; must live bottom-right (the −1px band and the 6px selection glow own the other edges) |
| D — colour only | purple chip fill for instances, glyph unchanged | one line; weakest signal, collides with plumbing-purple |

Expensive and deliberately out: widening the card, a hit-testable chevron (`HitTester` is
whole-rect; a sub-rect region would start an ad-hoc pattern), and repurposing the right icon slot
(the 4-way chain must keep warning visible — which is an argument *for* the chip as carrier:
**component-ness and unhealthiness become independently visible**).

## What ships regardless of the ruling

1. **"Open component" in the node context menu** (~10 lines, mirrors the workflow canvas).
2. The chosen paint treatment, behind `isComponent()`.
3. If purple-for-instances is chosen: decide what happens to the plumbing nodes' hue so purple
   means one thing (candidate: plumbing keeps purple — it is component *machinery* — and the
   ruling documents that purple = "component-related", carried by *glyph* not hue alone).

## Remaining build details (ruled: option C — see banner)

- The stacked edge is painted **before** the card body (or clipped clear of it), sits bottom-right
  only, ≤ the 7px hit border, and must not collide with the −1px unhealthy ring or the 6px
  selection glow — re-drive the full state stack (selected, hovered, unhealthy, diff-annotated).
- The edge is outside the cull rect and `pointInside` — visually fine at 3px; do not extend it.
- Light theme: paint the mark procedurally (stroke from the theme accent), not via the baked
  dark-fill icon PNGs — check both themes in the drive.
- Sub-label "component" text stays OUT (grows the card 14px) unless a drive shows the mark is
  missed.

## Acceptance criteria

1. In a mixed graph at 100% zoom, a first-time user can point at which cards open — verified by
   the actual test: someone who has not read this doc.
2. An **unhealthy** component instance shows both facts at once (warning icon + component mark).
3. Right-click on an instance offers "Open component"; it navigates with `pushHistory`.
4. Selection, hover, diff-annotation, and unhealthy rings all still render correctly over the new
   treatment (the paint-order stack re-driven).
5. Both themes screenshotted.
