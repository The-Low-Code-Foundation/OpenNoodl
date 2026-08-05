# FH-014 — The unit dropdown that opens as an empty sliver

Covers reported item **15**.

## What was reported

> A lot of the left menu props panel 'Px' buttons that normally show the 'Px/Em/Vh/whatever'
> popabove menu don't show anything, just a little bit of menu with no options.

## The mechanism — one line, times 27 ports

Two facts combine:

1. **The select removes the currently-selected option from its own menu.**
   [`PropertyPanelSelectInput.tsx:85`](../../../packages/noodl-core-ui/src/components/property-panel/PropertyPanelSelectInput/PropertyPanelSelectInput.tsx#L85)
   — `if (option.value === value) return null;`
2. **≈27 of the 59 unit-bearing ports declare exactly one unit** (21× `['px']`, 4× `['%']`, 1×
   `['deg']` — counted in `node-shared-port-definitions.ts`): Pad Left/Right/Top/Bottom, Border
   Width, all four Shadow numbers, Spacing, Size, **Font Size**, Rotation…

For those ports `NumberUnitInput` (`NumberUnitInput.tsx:73-81`) builds a one-option list, the
option equals the current value, the filter deletes it, and what renders is the `.Options` card's
border+2px padding at the trigger's 40px width (`BaseDialog.tsx:159`) — a ~40×6px empty bordered
box. Exactly "a little bit of menu with no options".

Multi-unit ports (Width/Height `['%','px','vw','vh']`, Margins `['px','%']`, …) work, which is why
it looks random.

## What to build

**(a) The real fix:** render the selected option with an active/checked style instead of
`return null` — this also fixes every other select in the panel, where the current value silently
vanishes from its own list (EnumType included).

**(b) Plus the courtesy:** in `NumberUnitInput`, when `units.length < 2`, render a static unit
label instead of a dropdown at all — a menu with one immutable choice is noise.

Do both; (a) is the defect, (b) is the honest UI for single-unit ports.

## Criteria

1. Font Size's "px" control is a static label, not a button that opens nothing.
2. Width's unit menu lists all four units including the current one, current one marked.
3. Enum dropdowns elsewhere in the panel now show the current value in the list, marked.
4. Eyeballed in the running editor, both themes.

## Traps

- `noodl-core-ui` shared component — the filter change touches every PropertyPanelSelectInput
  consumer; spot-check a few non-unit selects (e.g. Pointer Events Mode) for layout regressions.
