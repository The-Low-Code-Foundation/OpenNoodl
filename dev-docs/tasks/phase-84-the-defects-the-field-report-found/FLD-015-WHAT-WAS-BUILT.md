# FLD-015 — what was built

**Session 16, 2026-09-11.** R2 was answered *A KIT* on 2026-09-11 (s15); this is the build.

## 1. 🔴 What the task file was wrong about

**Four claims in `FLD-015-CHARTS-THAT-EXPORT.md` were wrong, and three of them were the reason
the task looked small.** This is the third task running in this phase whose own file was wrong in
three or more places — the standing instruction to **measure before believing a task file in this
phase** is now backed by three independent instances.

| §  | the file said | measured |
|---|---|---|
| §2 | *"`renderCustom` walks `plan.bindings[node.id]` and **emits wired inputs as props**"* — i.e. the kit route needs no export work | It does walk them. **Nothing put a binding there.** The first export of the fixture emitted `<BarChart valueKey="revenue" />` — no `series` at all — and reported *"has no deterministic translation in step 5"* |
| §2 | *"A Group with a bound `width` is **dropped silently**"* | **Not silent.** HLS-005's cardinality sweep shipped 2026-09-09 and reports it — but only for wires that *bound*. This one did not bind, so it got Pass 6's catch-all: one line in the report naming EXP-003, and **nothing in the emitted file at all** |
| §3 | *"add `width` and `height` to `WIRED_STYLE_SINKS`. That alone makes the reporter's meter export correctly and is **a handful of lines**"* | It is not, and doing it would ship a wrong number. See §4 |
| §5 | *"The `WIRED_STYLE_SINKS` widening **overlaps phase 83's HLS-005**; agree the owner before either starts"* | Moot — P9 resolved this on 09-11 (phase 84 owns the table) and the table was not touched anyway |

## 2. The deliverable — `library/modules/nodegx-charts`

Two visual nodes, hand-written in one file, no build step:

- **Bar Chart** (`nodegx.charts.BarChart`) — one bar per row. `Series` (array), `Value Key`,
  `Label Key`, an `Auto Scale`/`Baseline`/`Ceiling` trio, and colour/spacing ports defaulting to
  design tokens. Sends back `Bar Selected` (signal) plus `Selected Index`/`Value`/`Label`, the
  three values published **before** the pulse.
- **Sparkline** (`nodegx.charts.Sparkline`) — one polyline, no axes.

**Ports are the product.** Nothing in the file decides what the numbers *mean*: no thresholds, no
"red when negative", no formatting. Those are decisions and they belong in the graph.

### Two design rules that are load-bearing, and would be easy to undo

1. **No `frame:` and no `inputCss`.** Both put ports in the editor's shared Layout group, which
   lives in `inputCss` — and `parse/kitSource.ts`'s `readDefinition` reads `inputProps` and
   `inputs` and **not** `inputCss`. A size set through a Layout port would apply in the editor and
   be **absent from the export**, with nothing in the report to say so. Size arrives on
   `Chart Height`/`Chart Width`, which are ordinary `inputProps`. ⚠️ **This is a real gap in the
   export and it is worth a register row** — see §6 — but the kit is designed around it rather
   than blocked by it, so it did not become this task's first job.
2. **Nothing measures itself.** No bounding boxes, no `ResizeObserver`. The bars are percentage
   heights of a `Chart Height` track and the sparkline is a stretched `viewBox` with
   `vector-effect: non-scaling-stroke`. Both are correct on the first frame at any box width —
   including in a server-rendered page, where there is no box to measure yet.

### And one default that was wrong for an afternoon

`Ceiling` shipped at **100**. With Auto Scale on, that made it a floor the data could only widen,
so a revenue series of 32..67 drew its tallest bar at **67% of the track** while the README
promised the top. Found by driving the built app, not by reading the code. Now **0**, and the
measurement in §5 is after the fix.

## 3. The three export holes the kit route was supposed not to have

Every one was measured on `tests/fixtures/charts` before a line of the fix was written.

1. **`Static Data.items` had exactly one destination.** The wire was matched on its **target**
   (`toNode.type === 'For Each'`), so an array read into anything else reached no branch — about
   rows already hoisted, already typed and already printed in the emitted file. → a `static-rows`
   value expression, plus `staticRowsReadIds` so the disposition pass stops dropping a node whose
   constant a landed read now names.
2. 🔴 **Every `bindable` gate in `plan.ts` enumerates DOM sinks, and a kit node has none.**
   `CONTENT_PARAMS` is keyed by core node type and `styleSinkOf` consults the catalog; a kit node
   is in neither. So **every** read arriving for a kit port failed the gate, whatever its source —
   the hole was never about Static Data. → `kitSink` in Pass 4f, delegating to
   `customSinkIsBindable`, which already said exactly this for the *output* side.
3. **`readonly Row[]` is not assignable to `unknown[]`.** A hoisted Static Data constant is
   `Object.freeze`d by design, so the first version that bound anything emitted a page the
   **exported app's own `tsc` rejected** with TS4104. → kit `array` ports type as
   `readonly unknown[]`, which is free at a prop position: a component may not write its props.

⚠️ **The first two are a pair this file warns about four times over**: teaching `resolveExpr` a
read without widening the pass that calls it produces a read that resolves perfectly inside a
function nothing calls, and the wire falls to the catch-all claiming there is no translation for
something the file can translate. Both edits or neither.

## 4. AC3 — and why `WIRED_STYLE_SINKS` was NOT widened

The old way, in the fixture beside the charts: a Group whose `width` is the data
(`revenue.count → oldWayFill.width`). AC3 allows *translated* or *reported*, and forbids silent.

🔴 **Translating it is not a handful of lines, and shipping the handful would ship a wrong
number.** `Layout.size` (`noodl-viewer-react/src/layout.ts`) is four branches on `sizeMode` and
then a fifth decision on the parent's layout, under which **a percentage width in a row parent
becomes `flexGrow` and not a width at all**, with the node's own margins subtracted through
`calc()` across the other axis. An inline `style={{ width: expr }}` would be wrong in the
commonest case a meter is built in, and wrong silently. A refusal an author can read beats a
number nobody can check.

**So the refusal was fixed instead**, and the fixture is what found that it needed fixing:

| | before | after |
|---|---|---|
| export report | `wire revenue:count->oldWayFill:width has no deterministic translation in step 5 (deferred to EXP-003)` | `wire into oldWayFill.width has no rendered sink on Group — the property renders from its authored parameter only, so the wire is dropped, reported` |
| emitted file | **nothing** | `TODO(export): node oldWayFill renders, …` above the `return` |

Binding a dimension port (Pass 4f, `dimensionSink`) is what puts it in front of HLS-005's sweep.
The emitter still renders no width — it is bound precisely so the sweep can refuse it by name.

⚠️ **Blast radius measured, not argued: `charts` alone.** The corpus identity gate says **zero**
of the other 44 fixtures emits a different byte. None of them has a wire into a dimension port
from a source that pass reads, which is exactly why the hole lasted.

## 5. The drive — AC1

`nodegx export` → `npm install` → `npm run build` → `vite preview` → headless Chrome.

| step | reading |
|---|---|
| `npm install` | **exit 0**, 72 packages |
| `npm run build` (`tsc -b && vite build`) | **exit 0**, 49 modules, `index.js` 277.08 kB |
| console errors on the built page | **none** |

**The bars, read off `getBoundingClientRect()` in the built app** — track 160 px, `Auto Scale` on,
ceiling from the data (67):

| month | value | measured height | `160 × v / 67` |
|---|---|---|---|
| Jan | 32 | **76.41** | 76.42 |
| Feb | 48 | **114.63** | 114.63 |
| Mar | 41 | **97.91** | 97.91 |
| Apr | 67 | **160** | 160 |

Not all equal, not absent, and the tallest fills the track. Labels `Jan/Feb/Mar/Apr` from
`Label Key`. The sparkline's `points` carry the same shape (`0,52.239 33.333,28.358
66.667,38.806 100,0`).

🔴 **And the control in the same page**: the old-way fill measured **90 px** — exactly its
*authored* 10% of a 900 px track. The wire delivered nothing, which is what the refusal says.

## 5b. The drive — AC4, the two renders side by side

The same project opened in the real editor (`~/Library/Application Support/NodeGX` seeded with the
folder, then the card clicked), its **preview webview** read over CDP as a separate target. The
project driven is a **copy** of the fixture, not the fixture.

| | editor preview | exported build |
|---|---|---|
| bar heights (px) | 76.41 · 114.63 · 97.91 · 160 | **76.41 · 114.63 · 97.91 · 160** |
| track | 160 | **160** |
| labels | Jan · Feb · Mar · Apr | **Jan · Feb · Mar · Apr** |
| sparkline `points` | `0.000,52.239 33.333,28.358 66.667,38.806 100.000,0.000` | **identical** |

**Identical readings, not similar ones.** That is what "one implementation" buys, and it is the
whole argument for the kit route rather than a chart assembled from core nodes: there is no second
copy of the geometry to drift.

### 🔴 The control beside it — and it settles §4 on its own

The old-way Group in the *same two pages* does **not** agree, and that is the point:

| | editor preview | exported build |
|---|---|---|
| `oldWayFill` width | **`4%`** → 39.52 px of 988 | **10% authored** → 90 px of 900 |

The runtime took the wired `revenue.count` = **4** and fitted the port's `defaultUnit`, which is
**`%`** — so the editor draws 4% and the export draws the authored parameter, and says so by name.
⚠️ Note what a naive widening of `WIRED_STYLE_SINKS` would have emitted here: `style={{ width: 4 }}`
is **4 px**, a tenfold error against the runtime's 4%. `Layout.size`'s `flexGrow` conversion is the
*second* reason not to do it; the default unit alone is enough.

No console errors in either render. Screenshots taken of both.

## 6. What this found and did not take

- **P40 — a kit's `inputCss` and `defaultCss` are invisible to the export.** `readDefinition`
  reads `inputProps` and `inputs` only, and the emitted shim (`emit/kits.ts`'s `createNode`)
  applies `inputProps` defaults and `inputs` setters and has no `setStyle` at all. So a kit node
  styled through `inputCss` — **which the shipped `example-node-kit` is** — renders with its
  background, padding, border and radius in the editor and **without any of them** in an exported
  app. Not silent at the wire level (a parameter on such a port is reported as naming no input
  port), but the *defaults* vanish with no note. This kit is designed around it; the example kit
  is not. Not FLD-015's, and it wants an owner.

## 7. Acceptance criteria

| # | criterion | state |
|---|---|---|
| 1 | bar chart from `Static Data`, exported, built, bars have the heights the data implies | 🟢 **driven** — §5 |
| 2 | the data input arrives as a **prop in the emitted JSX**, not merely declared | 🟢 `series={MONTHLY_REVENUE}` on the element |
| 3 | the old way is translated **or reported**, never silent | 🟢 reported — and the report was fixed, §4 |
| 4 | identical in the editor preview and the exported build, on the same data | 🟢 **driven** — identical readings on both sides, §5b |
| 5 | runtime and emitter agree on arc geometry | ⬜ **does not apply** — conditional on R2 choosing core nodes, and R2 chose a kit. That is the point: there is one implementation and it is in the kit |

## 8. The gates

| gate | reading |
|---|---|
| `nodegx-export` full suite | **99 suites / 3435 tests, exit 0** |
| `tests/fld015-charts-that-export.test.ts` | 16 rows |
| `tests/typecheck-emitted.test.ts` | 49 fixtures, `charts` included |
| `tests/hls001-corpus-identity.test.ts` | 45 projects; regenerate additive, **zero existing hashes changed** |
