# FLD-015 — Charts that export

🟢 **BUILT 2026-09-11 (s16) — 4 of 4 applicable ACs, driven in the real editor AND in the built
export.** AC5 does not apply: it was conditional on R2 choosing core nodes and R2 chose a kit.

🔴 **FOUR of this file's own claims are WRONG — read
[FLD-015-WHAT-WAS-BUILT.md](./FLD-015-WHAT-WAS-BUILT.md) §1 before believing anything below.**
The headline: §2's *"`renderCustom` … emits wired inputs as props"* is true of `renderCustom` and
false of the export, because **nothing put a binding there** — the kit route needed three fixes in
`nodegx-export`, not none. And §3's *"a handful of lines"* for `WIRED_STYLE_SINKS` would have
shipped a **tenfold** error: the runtime fits the port's `defaultUnit`, which is `%`.

*"the parts of my dashboard that were actually charts were the parts that did not survive export."*
Gated on **R2**, because the cheap answer and the complete answer are different answers.
✅ **R2 ANSWERED 2026-09-11 — A KIT.**

✅ **P9 RESOLVED 2026-09-11 (s13): phase 84 owns `WIRED_STYLE_SINKS`.** Richard, asked directly —
phase 83's HLS-005 was recorded as owning that table and phase 83 is closed, so the table comes with
this task. ⚠️ **That does NOT unblock this task. R2 still gates it**, and P9 was only the cheaper of
its two blockers.

## 1. The person sentence

**Someone builds a dashboard with a bar chart fed from a query, exports it to React, and the bars
are still driven by the data.**

## 2. What was reported, and what the code says

[#39](https://github.com/The-Low-Code-Foundation/NodeGX/issues/39): there is no chart primitive, so a
chart is assembled from layout nodes — and the assembly is exactly what the export refuses.

Measured 2026-09-09 — **every factual claim in the issue is true:**

- The refusal wording is exact, at `analyze/plan.ts:19285`:
  `` `its ${wired} arrives over a wire, so the rendered structure is not static` ``. A refused node is
  **left out of the JSX entirely** (`:19292-19297`).
- `Circle`'s structure ports (`:19194-19209`) include `startAngle`, `endAngle`, `fillColor`, `size`,
  `shape` — so a gauge with any dynamic parameter refuses whole.
- A Group with a bound `width` is **dropped silently**: `styleAttrs` (`emit/component.ts:4600-4614`)
  iterates `WIRED_STYLE_SINKS`, which is only `{opacity, color, backgroundColor}`
  (`emit/style.ts:270-274`). A wire into `width` is never visited, so there is no defer and no note.
- There is no chart-shaped node in `nodes/visual/` and none in the ledger. `polygon` is a `shape`
  enum value (`circle.ts:61`) and literal non-circle shapes defer.

🔴 **But "the emitter half exists" is false.** `renderCircle` (`emit/component.ts:5520-5554`) computes
geometry **at generation time from literals**, calling `filledArcPath`/`arcPath` during emit. That is
the exact opposite of data-driven: for a chart the path maths must run **at render time in the
generated app** over a `series` prop. What is reusable is the SVG plumbing and the arc maths *as an
algorithm* — not as called code.

🔴 **And the kit route changes the answer entirely.** A kit node is `role: 'custom'`, dispatched at
`component.ts:5034` **before** any visual role, so it never reaches `visualDeferReason` and never
touches `STRUCTURE_PORTS`. `renderCustom` (`:5631-5649`) walks `plan.bindings[node.id]` and **emits
wired inputs as props**; kit port type `array` maps to `unknown[]` (`emit/kits.ts:311-312`);
`emitKits` (`:84-122`) copies the kit's script into the exported repo and generates a typed wrapper,
so the kit's own `getReactComponent` — which may return `<svg>` — runs in the exported app.

**A chart shipped as a kit exports today, with dynamic data, while the same chart built from
Group/Circle refuses.** The infrastructure is all present: `nodegx-kit-scaffold`,
`nodegx-kit-catalog` (project-scoped overlay, so kit nodes appear in the picker **and** in
`list_node_types`), `nodegx-node-kit-types`, `noodl-mcp/src/tools/kitTools.ts`.

⚠️ **The honest cost of the kit route:** a kit is not in the picker unless installed, so *"there is
no chart primitive"* stays true for anyone who does not install it. That is R2's question, and it is
a product call, not an engineering one.

## 3. Scope

- **R2 first.** Kit or core nodes. Nothing below is authored until it is answered.
- If kit: a `nodegx-charts` kit, **Sparkline and Bar Chart first** — both are pure `<svg>` over a
  numeric array with `min`/`max`/`tone`, no arc maths, no layout dependency, one `getReactComponent`
  each. Line Chart shares the polyline builder. Arc/Gauge second, with the arc maths written **once**
  in the kit rather than twice across runtime and emitter.
- ⚠️ **Independently of R2, and much cheaper:** add `width` and `height` to `WIRED_STYLE_SINKS`. That
  alone makes the reporter's meter export correctly and is a handful of lines. Failing that, make
  `styleAttrs` **report** a wire into a port it has no sink for — today the loop is over the sink
  table, so an unmapped port is never even seen. **This is the silent-drop defect from #23 and it is
  the same line of code**; coordinate with phase 83's HLS-005 before touching it.

## 4. Acceptance criteria

1. **(person)** Build a bar chart fed from a `Static Data` array, export it, `npm run build`, and open
   the built page. The bars have the heights the data implies — **not** all equal, and not absent.
2. The chart's data input is asserted to arrive as a **prop in the emitted JSX**, not merely declared
   in the Props interface. 🔴 A declared-and-never-read prop is exactly the defect #23 reports;
   asserting the declaration would reproduce it.
3. A **refusal control**: the same chart authored the old way (Group with a bound `width`) is either
   translated or **reported**. Silent is not an acceptable third state, and this is the arm that
   proves the reporting fix landed.
4. The chart renders identically in the editor preview and in the exported build, compared on the
   same data. One implementation is the point of the kit route; this is the assertion that proves it.
5. If R2 chose core nodes: the runtime and the emitter agree on arc geometry, asserted on a shared
   fixture. Two implementations of the same maths is what `plan.ts:19308-19311` warns about.

## 5. Traps

- 🔴 **Do not start from `renderCircle`.** It is a generation-time path and reading it as a starting
  point will produce a chart whose data is baked at export.
- 🔴 **The `WIRED_STYLE_SINKS` widening overlaps phase 83's HLS-005.** Two tasks editing one table is
  a collision; agree the owner before either starts.
- ⚠️ A kit node's *literal* parameter that is not a literal is dropped with a note
  (`component.ts:5610-5615`), and a wire the vocabulary cannot express defers by name (`:5643-5648`).
  Ordinary binding wall, but it will be met.
- ⚠️ "Charts export" is not "charts are good". Scope the visual quality separately; this task is
  about the data surviving.
