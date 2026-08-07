# FH-013 — Props-panel labels wrap instead of truncating

Covers reported item **14** (and the label half of AAQ-011 F2). The cloud-workflow step rows use
the same component, so item 11's "field labels cut off with … even if you expand the panel" is
fixed here too.

## What was reported

> All labels in the left props panel should be wrapped, not cut off and constrained to one line.
> …a lot of the field labels in the left props panel being cut off an ... even if you expand the
> panel width.

## The mechanism — a hard 62px column, twice

Widening the panel changes nothing because the label column is a **fixed 62px** in both label
implementations:

**A. The React row** (the majority) —
[`PropertyPanelInput.module.scss:9-24`](../../../packages/noodl-core-ui/src/components/property-panel/PropertyPanelInput/PropertyPanelInput.module.scss#L9-L24):
`width: 37%` + ellipsis + `line-clamp: 2` + `max-height: 28px` — then the sidebar override at
`:62-70` pins `.Label { width: 62px }` (with `flex-shrink: 0`) whenever the panel body has
`.sidebar-property-editor` (set at `propertyeditor.ts:207`). The bare `line-clamp` does apply on
our Electron 43 and is the ellipsis source; `max-height: 28px` clips the second line.

**B. The legacy row** —
`styles/propertyeditor/propertyeditor.css:42-53`: `.property-label { white-space: nowrap; width:
62px; position: absolute }` with its value track hardcoded at `.property-value { left: 72px }`
(`:55-61`). Four consumers: the Custom CSS/code-editor row (`CodeEditor/Property.tsx:18` — F2's
"CSS …"), the curve editor (×2), and two inputs that inline-override it.

Cloud-workflow steps share A: `DataTypes/WorkflowTypes.ts:22` imports `PropertyPanelRow` from the
same core-ui module (used at `:137`, `:163`, `:195`, `:284`, `:360`). There is no separate
workflow property panel.

## What to build

1. **A**: drop `line-clamp`/`max-height`/`text-overflow`; `white-space: normal`; replace the fixed
   62px with an elastic column (`flex: 0 0 auto` + `min-width`, or a `minmax()` grid) so the
   column grows with the panel. Keep the toggle-row `width: auto` special case.
2. **B**: `white-space: nowrap` goes; the `position: absolute` + `left: 72px` pair becomes flow
   layout (otherwise a wrapped label overlaps its value).
3. Sweep the four legacy consumers — two already inline-override position/width and must not
   double-shift.

## Criteria

1. "Custom CSS" and long workflow-step labels render in full, wrapped, at default panel width.
2. Widening the panel gives labels more room (the column is no longer fixed).
3. No row's value input overlaps its label; toggle rows unchanged.
4. Screenshot pass over the props panel for a Group, a Button, a workflow step, and the curve
   editor — both themes (the screenshot-corpus harness from UIX-009 fits this).

## Traps

- `noodl-core-ui` chrome — don't run in parallel with other core-ui work in a worktree (phase-39
  learned this); and `typecheck:core-ui` is red on editor files and is NOT a gate.
- Wrapped labels change row heights; the props panel virtualizes nothing today, but eyeball long
  node types (Group has ~60 rows) for scroll jank after the change.
