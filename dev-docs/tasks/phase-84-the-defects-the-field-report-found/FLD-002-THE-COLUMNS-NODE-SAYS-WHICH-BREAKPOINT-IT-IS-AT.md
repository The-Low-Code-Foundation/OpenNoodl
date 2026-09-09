# FLD-002 — The Columns node says which breakpoint it is at

The state exists and nothing can read it. Once FLD-001 lands it becomes a real value; until then,
shipping these ports would ship three outputs that always read `Default`.

## 1. The person sentence

**Someone wires the Columns node's Breakpoint output into the rest of their graph and reacts to a
layout change without recomputing the window size themselves.**

## 2. What was reported, and what the code says

[#22](https://github.com/The-Low-Code-Foundation/NodeGX/issues/22), Richard: *"the Columns node
doesn't expose its current state, i.e. a string output value of 'Default', 'Medium' or 'Small' and
maybe a signal output of 'At Medium' or 'At Small'."*

Measured 2026-09-09:

- The breakpoint **is** computed — `pickBreakpointLayout`, `Columns.tsx:206-217` — and is correct
  and unit-tested. It is simply never called, because `containerWidth` is `null`. **That is FLD-001,
  and it is why this task depends on it.**
- Current outputs (`noodl-types/src/node-catalog.json` @ `net.noodl.visual.columns`):
  `boundingWidth`, `boundingHeight`, `screenPositionX/Y`, `childIndex`, `childrenCount`, `didMount`,
  `willUnmount`, `this`. **No breakpoint output.** `boundingWidth` already exists, which is what a
  States-node workaround keys off today.
- The mechanism is `outputProps`, and the precedent is close: `nodes/visual/group.ts:387-405` ships
  `onScrollPositionChanged` (number) plus `onScrollStart`/`onScrollEnd` (signals); the machinery is
  `react-component-node.ts:999-1010`.

⚠️ **The enrichment is stale and must move with this.**
`docs/node-catalog/enrichment/net.noodl.visual.columns.json` documents `minWidth` as *"what makes the
grid responsive"* and **does not mention the breakpoint ports at all**. It is rendered inline in the
node picker preview (`NodePickerPreview.tsx:102-104`) **and served to the MCP authoring loop**, so
it is teaching both a person and an agent the wrong thing.

## 3. Scope

- Add `onBreakpointChanged` (string: `Default` | `Medium` | `Small`) and `onAtMedium` / `onAtSmall`
  signals, grouped under `Breakpoints`.
- Have `pickBreakpointLayout` also return **which** step it chose, and fire the callbacks from an
  effect keyed on that value — **not from render**.
- Refresh the enrichment so the picker and the MCP loop describe the ports that exist.
- Add the ledger/export line, or the new ports become named deferrals in every export.

## 4. Acceptance criteria

1. **(person)** Wire `Breakpoint` into a Text node. Narrow the preview past each threshold and the
   text reads `Default`, then `Medium`, then `Small`.
2. The signals fire **on transition only** — a spec resizes within one band and asserts no signal, then
   across a boundary and asserts exactly one. 🔴 **Assert the cardinality**: "at least one" hides a
   render-loop firing it every frame.
3. The string output and the applied layout agree: a spec asserts the reported breakpoint is the one
   whose layout string was actually used. Two sources of the same fact must not be able to disagree.
4. The enrichment names the breakpoint ports, and a spec asserts the enrichment mentions every
   `Breakpoints`-group port — so the next port added cannot leave the docs behind.
5. Export: the new ports either translate or appear as declared deferrals with a reason. A silently
   dropped output is the defect this phase exists to stop.

## 5. Traps

- 🔴 **Do not ship this before FLD-001.** Every output would read `Default` forever, and the specs
  would pass, because `Default` is genuinely what the code chose.
- ⚠️ Firing a signal from render rather than an effect will fire it on every re-render. The
  `forceUpdate` path in `react-component-node.ts` makes re-renders frequent.
- ⚠️ The runtime uses a strict `<` where the export's `@container max-width` is inclusive. A spec
  written exactly on a boundary value will disagree between the two. Pick values off the boundary,
  and file the discrepancy rather than papering over it.
