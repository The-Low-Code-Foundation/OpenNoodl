# FIX-018 — A component says it can be entered

**Report 13** · Tier 2 · Effort **S–M** · Mockups delivered

> ## ✅ BUILT AND DRIVEN 2026-08-14 (session 3) — commit `95301039`. **CLOSED, 5/5 criteria.**
> Option C as ruled: purple `component` chip + diamond glyph on every instance, a 3px stacked-card
> edge bottom-right, the right icon slot freed for health, and "Open component" in the context menu.
> 10 new specs in `tests/canvas/NodeComponentMark.test.ts`. Drive record in §"What the drive
> measured" at the foot of this file — read it before touching the painter again, because two of its
> findings contradict what this doc assumed.

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

---

## What the drive measured (2026-08-14, session 3)

**No existing project could exercise this.** The QA fixture has 24 components and **zero placed
component instances**; a scan of all ~40 projects in `NodeGX test projects/` found exactly one graph
containing an instance, and it held a single one. So the drive fixture
`NodeGX test projects/fix018-drive` was built for it (validates 0 errors / 12 nodes): a Group and a
Text (plain visual), a component wrapping a Group, a logic-only component instance, a
`Component Inputs` (the plumbing node that keeps purple by ruling), an `Expression`, and a
**second logic-only instance parented under the Group** — which is unhealthy for a real reason
(`allowAsChild` false → "This node cannot be a child in a hierarchy", level `error`), not a faked
flag.

### The measurements, dark theme, 100% zoom

Chip fill sampled left-of-centre inside the 22px chip (clear of the glyph); band sampled 1.5px
outside the card's right edge and below its bottom edge.

| Card | isComponent | chip | band right / bottom |
|---|---|---|---|
| Screen (Group) | n | `29,43,60` blue | — / — (transparent) |
| Heading (Text) | n | `29,43,60` blue | — / — |
| **Product Card** (wraps a Group) | **Y** | **`40,39,59` purple** | `18,22,27` / `18,22,27` |
| **Cart Totals (unhealthy)** | **Y** | **`40,39,59`** | `18,22,27` / `18,22,27` |
| **Cart Totals** (logic-only) | **Y** | **`40,39,59`** | `18,22,27` / `18,22,27` |
| Subtotal (Expression) | n | `52,36,51` | — / — |
| **Inputs** (Component Inputs) | n | **`40,39,59` — identical purple** | **— / — (no band)** |

The last two rows are the whole ruling, measured: the plumbing node paints the *same* chip as an
instance, and **the stacked edge is the only thing that separates them.** Pre-fix, Product Card
painted the identical blue as the Group directly above it.

**Criterion 2, all four facts on one card at once:** `health.level: 'error'`, `hasWarningIcon:
true`, chip `40,39,59`, band present.

**Criterion 4** — band re-measured under every state, both themes. `plain`, `hovered`,
`annotated_Created`, `annotated_Deleted` leave it untouched; `selected` tints it (`18,22,27` →
`26,42,60`) because the glow is 15% alpha, so the silhouette survives rather than being covered.

**Criterion 3** — "Open component" appears **only** on an instance (absent on the Group and on
Component Inputs), is first in the menu, tooltips "Go into Product Card", navigates `/App` →
`/Widgets/Product Card`, and a subsequent `goBack()` returns to `/App`, which is what proves
`pushHistory`.

### 🔴 Two things this doc assumed that the drive contradicts

1. **The edge does *not* stay clear of the unhealthy ring.** The doc required it to. Scanning
   across the right edge of the unhealthy card: `dx=1` is `114,59,58` — the −1px dashed ring runs
   *through* the 3px band. It stays readable only because the ring is dashed and the band's own
   outer stroke (`dx=3`) is clear of it. Both marks are legible in the screenshot, so this was not
   worth redesigning, but the constraint as written is false and should not be re-derived.
2. **In light theme the band is carried by two thin strokes, not by fill contrast.** The band is
   `255,255,255` on a `238,241,245` ground — the load-bearing signal is the front card's border
   (`231,235,239`) and the back card's (`224,229,235`) with 2px of white between. It reads, but it
   is quieter than dark. If a later drive says the edge alone is too quiet, this is where it will
   show first, and the ruling already allows A/B/C to compose.

### One consequence worth knowing

Freeing the icon slot means a healthy component instance no longer sets `node.icon`, so it loses the
12px `iconOffset` and its title gets 12px more width. That is a **layout** change for every
component instance in every project, not just a paint one — beneficial (longer labels wrap less),
but it is why component cards may measure shorter than before.

### Driving traps this cost time to find

- 🔴 **`cdp.js click` on a React-managed element opened the wrong project.** The launcher grid
  re-rendered between the `eval` that set `id="cdp-target"` and the click, and React had recycled
  that DOM node for a different card — so the click landed on "Kiln & Co.". The reported
  `clicked … at 796,396` against a measured centre of `428,472` was the only tell. **Append a
  `position:fixed` marker to `document.body` instead** — React cannot recycle what it does not own.
  (Nothing in the wrongly-opened project was written to disk; verified by mtime.)
- ⚠️ **A theme flip does not apply within the same `eval`.** `CanvasTheme` refreshes off a
  `MutationObserver`, which is a microtask, so `data-theme = 'light'` followed by a synchronous
  `layoutAndPaint()` in the same statement measures the **old** theme. Flip in one call, measure in
  the next — a whole state-stack sweep was silently re-measuring light theme as "dark".
- ⚠️ **Sampling the band at `y + h/2` collides with the connection-drag circle**, which is painted
  at `x + width, y + titlebarHeight/2` whenever the node is highlighted. On a 36px card those are
  the same pixel, and it reads as the edge being erased by hover. Sample at `y + h - 6`.
- ⚠️ Moving a node needs **both** halves: `model.set({x, y})` alone leaves `view.global.x` stale
  through `relayout()`. Set `view.x = view.model.x` too.
