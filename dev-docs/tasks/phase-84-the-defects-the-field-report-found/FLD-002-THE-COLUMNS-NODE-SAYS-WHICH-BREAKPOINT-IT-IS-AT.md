# FLD-002 — The Columns node says which breakpoint it is at

> 🟢 **BUILT** — session 8 (2026-09-10). Ports on `net.noodl.visual.columns`, reporting from
> `Columns.tsx`. **AC1–AC5 all met and measured.** Corpus spec
> `packages/noodl-viewer-react/tests/corpus/fld-002-columns-reports-its-breakpoint.test.tsx`
> (12 specs, two controls, two reverted arms measured); export coverage in
> `packages/nodegx-export/tests/visual-controls.test.ts` (4 specs incl. a control). §6 has the
> numbers and the one thing the general agreement test **cannot** see.

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

## 6. What was built, and what each claim rests on

**Three ports, one decision.** `pickBreakpointLayout` now returns `{ breakpoint, layoutString }`
instead of a bare string, `resolveColumnLayout` carries the name out on all three of its branches,
and the render calls it **once** — above both early returns, because the effect that publishes the
band is a hook and the two `return`s sit below the hooks. So the band a reader is told about and
the widths on screen are the same object's two fields. `outputProps` in `nodes/visual/columns.ts`
installs `onBreakpointChanged` (string, displayed *Breakpoint*), `onAtMedium` and `onAtSmall`
(signals), all three in the `Breakpoints` group beside the four inputs they report on.

**AC1 — reads Default, then Medium, then Small.** Driven in the real editor (§7). In the spec, the
container narrows 1184 → 884 → 484 and the published band follows, then follows back up when it
widens: it is a reading, not a one-way latch.

**AC2 — cardinality, not presence.** The effect's dep array is `[breakpoint]` and that is the whole
guard: React skips an effect whose deps are `Object.is`-equal. A resize *within* a band (884 → 934)
fires nothing; a crossing fires exactly one; crossing back fires one more. Every assertion is
`toHaveBeenCalledTimes(n)`. **Reverted arm A** — the dep array removed, so the effect runs after
every render, which is the render-loop failure the task names — reddens exactly the three AC2
specs and nothing else.

**AC3 — the band reported is the band rendered.** The spec derives its expected widths *from the
band the component published* rather than asserting the two as literals side by side, with a
control proving the three bands really do render differently (3 distinct width sets), so agreement
can fail.

🔴 **The one thing that test cannot see, and it is worth knowing.** **Reverted arm C** — the band
derived a second time beside the layout instead of out of it, which is the States-node workaround
written into the component — reddens **only** the Auto Fit spec. In `layoutString` mode a second
derivation agrees with the first at every width, so the general agreement test passes on it. The
spec that discriminates is *Auto Fit reports Default*: Auto Fit consults no layout string at all,
so a band named there names a string nothing on screen came from. **A second derivation of a fact
is invisible wherever the two derivations happen to agree** — the arm that finds it is the one
where the real answer is not a band.

**AC4 — the enrichment cannot fall behind again.** The enrichment described `minWidth` as *"what
makes the grid responsive"* and named **none** of the four breakpoint inputs that had already
shipped. It now documents all seven `Breakpoints`-group ports plus `sizing` and `packing`, and the
spec reads the **enriched** catalog — the artifact the picker preview renders and the MCP loop is
served, not the authored file under `docs/`, which would pass on a merge that was never run. Its
first assertion is an arming one: the group's port list is asserted by name, because *"every port
in an empty list is documented"* is a green that grades nothing.

**AC5 — declared deferrals, measured, not assumed.** The three ports do **not** translate, and the
reason is not laziness: the export renders the breakpoints as an `@container (max-width: …)`
override, and CSS cannot hand a string to a Text node or fire an action. Both sentences come from
machinery that already existed, which is exactly why they were measured rather than reasoned about:

- `wire gallery:onBreakpointChanged->bandText:text has no deterministic translation in step 5 (deferred to EXP-003)`
- `signal gallery.onAtSmall has no DOM event equivalent — dropped, reported` (and the same for `onAtMedium`)

⚠️ **The first attempt at the signal arm measured the sink, not the port.** A `Set Variable` with
nothing feeding its value fails to compile as an action, so the wire was dropped with *"nothing is
wired into value"* — a note about the receiver that reads, at a glance, as the port having been
handled. The sink has to be able to run for the port's own answer to be the one under test.

**The artefacts.** `packages/noodl-types/src/node-catalog.json` regenerated with `--out-dir` and
diffed first: **33 lines added, 0 removed, `node-catalog.d.ts` byte-identical** — the regeneration
is purely additive, which is what made it safe to write in place over a shared generated file.

## 7. The drive — AC1, in a real browser, live-narrowed

A three-card Columns page with `Breakpoint` wired into a Text node, served from disk against the
**working-tree** runtime (`render-from-disk.js`) and narrowed in one browser session. The viewer
bundle was checked for the ports before believing anything it rendered — mtime is not evidence,
`grep -c onBreakpointChanged packages/noodl-editor/src/external/viewer/noodl.viewer.js` is.

```
 1200px  readout: Default    columns: 33.3333% | 33.3333% | 33.3333%
  900px  readout: Medium     columns: 50% | 50% | 50%
  950px  readout: Medium     columns: 50% | 50% | 50%
  700px  readout: Medium     columns: 50% | 50% | 50%
  500px  readout: Small      columns: 100% | 100% | 100%
  900px  readout: Medium     columns: 50% | 50% | 50%
 1200px  readout: Default    columns: 33.3333% | 33.3333% | 33.3333%
```

The text and the layout agree at every width, it reads its way back up as the window widens, and
950 → 700 is a real resize inside one band that moves nothing. Screenshots at the three bands are
in the session scratchpad.

🔴 **`Emulation.setDeviceMetricsOverride` is scoped to the CDP session that set it.** Resizing in
one `drive-page.js` invocation and reading in the next measures the **original** width — the same
trap `cdp.js` already documents for network emulation, one verb over. The first attempt at this
drive did exactly that and produced a table that was partly right by luck. Everything above happens
on **one connection**: resize, settle, read, in a single process.

⚠️ **Do not drive this through the editor's preview webview.** `drive-page.js`'s own header records
why (SBR-014 s46): `setDeviceMetricsOverride` on it reports success and then
`Page.captureScreenshot` returns the OLD surface tiled across the larger frame. Every number reads
correct and the picture is an artefact.
