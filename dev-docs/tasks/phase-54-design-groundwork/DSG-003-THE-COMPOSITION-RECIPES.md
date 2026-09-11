# DSG-003 — The composition recipes

**Status:** 🟠 **6 of 10** · six shipped `231fc68d` 2026-08-08 · **Track B1** · five named recipes
unbuilt

## Why the corpus is the seam

An agent could look up what a token is called and what a `Group`'s ports are, and had **nowhere to
look up what an arrangement of them is**. Of 51 validated examples, exactly one
(`vis-columns-media-cards`) was visual composition; the rest teach how to connect two nodes. It
stacked Groups in a column because that is the only thing the corpus ever showed it.

The examples are the right seam because they are already **reachable and already gated**: served by
`list_examples` / `get_example`, cited from `get_node_type`, attached to a rejection by phase 55's
LAS-007, and validated by `npm run catalog:examples`, which rejects anything not error- **and**
warning-free ([`validate-examples.ts:5-9`](../../../scripts/validate-examples.ts)).

## §1 — What shipped

Six, each **lifted from [DSG-001](DSG-001-THE-REFERENCE-BUILD.md) after it was built and measured in
the disk renderer** — layouts known to render, not merely to validate. The corpus is now 57
examples.

| Recipe | What it teaches, and the trap it exists for |
|---|---|
| `ui-page-shell-bands` | band → centred max-width shell → content, with an announced section head. The spine an unstyled page is missing; edge-to-edge content is the loudest tell |
| `ui-card-grid-repeater` | Query Records → For Each → card component. ⚠️ **a wrapped flex row does not shrink its children** — items left at `width: 100%` render one per row, measured at **1152px each** before the fix. Also: falsiness into `visible` as conditional rendering with no logic node |
| `ui-split-hero` | display headline at tighter tracking; image with `sizeMode: "explicit"`, without which `width`/`height`/`objectFit` are inert |
| `ui-stat-tile-row` | a row that is a real arrangement rather than three Groups |
| `ui-icon-feature-strip` | the fixed 3-up, and the collapse rules that keep it usable at 390px |
| `ui-empty-state` | `§9` made concrete: a list with no rows is a designed object, not nothing |

## §2 — ⚠️ The trap this task carries: a recipe is imitated verbatim, defects included

**All 11 `Component Inputs` ports across the first three recipes were declared `plug: "input"` —
backwards** — so 12 connections drawn out of them were dropped as unhealthy. The corpus that exists
to teach the right shape was teaching the exact defect the interface gate blocks (phase 55 F23,
fixed by LAS-007; only 3 of 57 examples declared interface ports at all, and all 3 were wrong).

The format changed because of it: `ports[].plug` is now declared explicitly in the example schema
([`validate-examples.ts:51-56`](../../../scripts/validate-examples.ts)) *"because leaving it out is
what let the defect live in three shipped recipes."*

Two rules follow, and they apply to every recipe added from here:

1. **Author it from a measured build, never from taste.** If the arrangement has not rendered, it is
   not a recipe.
2. **`npm run catalog:examples` green is necessary and not sufficient.** The 11 backwards ports
   passed that gate for two days. Render the fragment and look at it.

## §3 — The five that are missing

Named in the README's track B and not built. Each is one arrangement, lifted from a real build:

| Recipe | Why it earns a slot | ⚠️ The thing it must get right |
|---|---|---|
| `ui-sticky-nav` | every app has one and every AI-authored one scrolls away | position/stacking on a canvas with no CSS positioning ports — check what is actually authorable before specifying it |
| `ui-data-table` | the admin half of every app, and the shape most often written as duplicated rows | a table **is** a Repeater over a row component — the recipe's job is to make that obvious |
| `ui-form-field` | label + control + error + hint, with the error hidden by falsiness | `sizeMode: "explicit"` on `textinput`, or the `width: 100%` renders 170px |
| `ui-slide-over` | the panel pattern; teaches state without a logic node per interaction | must not duplicate `logic-toggle-details-panel`; this is the *layout*, that is the wiring |
| `ui-footer-columns` | the reference build's `SiteFooter` wrote **three identical columns by hand** | it must ship the refactor, not the original — otherwise it teaches `repeated-sibling-subtree` |

⚠️ **`ui-footer-columns` is the sharpest of the five**, because the honest version of it is the
correction of a defect the reference build shipped. Lift the fix, not the artefact.

## §4 — Do not confuse this with retrieval

Adding recipes makes the corpus better; it does not make it *read*. The mechanism that puts a recipe
in front of an agent at the moment it is failing is phase 55's LAS-007 (the recipe rides the
rejection) and it is already built. If a recipe here is not reachable from a diagnostic, say so in
that task, not this one.

## Acceptance

- Each new recipe is authored from a component that has been **rendered and measured**, and the
  measurement is quoted in the task or commit.
- `npm run catalog:examples` green — errors and warnings both.
- ⚠️ Every `Component Inputs` port declares `plug` explicitly, and a `component-port-direction` scan
  of the whole corpus is clean afterwards.
- The fragment is rendered and looked at; a screenshot or a DOM measurement is in the commit.
- The recipe names its trap in `demonstrates`, so a search for the trap finds the recipe.
- No recipe duplicates a wiring example that already exists — this corpus is about *arrangement*.

## Register

| # | Finding | State |
|---|---|---|
| F13 | **11 interface ports in the first three recipes were backwards**, teaching the defect LAS-001 blocks | ✅ closed by phase 55 LAS-007 — 11 corrected, 11 `component-port-direction` + 2 `interfaceless-instance` cleared together |
| F14 | The example gate is **structural only** — it cannot see that a recipe renders as one column | 🟠 open by design; the mitigation is §2's second rule, which is a human habit and not enforced |
| F15 | `ui-icon-feature-strip` shipped although the README's ten did not name it; `ui-sticky-nav`, `ui-data-table`, `ui-form-field`, `ui-slide-over`, `ui-footer-columns` did not | ✅ verified 2026-08-10 — 57 examples, 6 `ui-*` |
</content>
