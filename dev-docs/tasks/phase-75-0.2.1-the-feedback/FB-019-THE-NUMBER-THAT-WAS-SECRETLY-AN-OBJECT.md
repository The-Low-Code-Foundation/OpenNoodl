# FB-019 — the number that was secretly an object

**Filed:** 2026-08-22, test-user session, item 4. **Status: ⬜ open — and the research Richard
asked for is done: his memory was right, and it's worse. Two silent-failure bugs plus a UX
gap.** Size: M/L.

> *"Some ports are a bit tricky and look like they should take a number input, but they
> actually need like a JSON input? Like the icon node… you can't just input the string icon
> name. Also the node width or something, you have to input a JSON with a number and the px/vw
> value in the body… some node inputs are JSON and not the clear cut number or string input
> they're supposed to be."*

---

## Ground truth (verified 2026-08-22)

**The structured port types** (wire shapes, not scalars): `dimension` (`{value, unit,
isFixed}` — Width/Height), units-typed `number` (`{value, unit}` — padding, margins, corner
radius, iconSize, min/max sizes, ~30 declarations), `icon` (a tagged union — font class /
sprite / inline svg, `types.ts:19–40`), `proplist`, `pages`, plus `stringlist` which is the
opposite trap (a comma-separated *string*, not an array). Normative docs:
`dev-docs/reference/PORT-TYPE-CONTRACT.md`, `ICON-SOURCE-MODEL.md`; AIB-001 pinned the wire
formats **for the AI write path only** (⚠️ its own dimension example at `:13` is wrong —
correct it in passing).

**The icon port** (`iconIconSource`, on Icon/Button/Checkbox/Radio/Select/TextInput): a plain
string **cannot legally connect** — the cast table has no `icon` row — and no `icon`-typed
output exists anywhere in the library. The only route is a `*` output (Function/Object), which
casts to anything; a string arriving that way reaches `IconGlyph`, reads `.class`/`.code` off
it as `undefined`, and renders an **empty span, silently** (`IconGlyph.tsx:63–69`). The port is
effectively picker-only and nothing says so.

**The dimension ports — two different silent failures on the same node** (`node.ts:372–390`,
`react-component-node.ts:592–605, 1889–1891`):

1. Port previously set to `50%`, then a bare `300` connected → merge keeps the old unit:
   **`300%`**. (The `isNaN` guard also admits `true`, `null`, `''`, `"50"`.)
2. Port never set, bare number connected → no merge, units branch deletes the prop: **the node
   silently loses its width entirely.**
3. The asymmetry that makes it unlearnable: the `inputCss` branch **does** coerce
   (`value → {value, defaultUnit}`), so a bare number wired to **padding works** and the same
   number wired to **Width doesn't**, on the same node.

**Prior coverage stops short, knowingly**: FIX-025 §12's `connectionCoercion.ts` warns on
exactly **two** pairs (`string→number`, `string→boolean`); its own header says the real fix is
PORT-TYPE-CONTRACT.md's **Direction C** — distinguish *connectable losslessly* from
*connectable via cast* in the UI — "a model change, not built here". This task builds the
useful four-fifths of that without the full model change.

## 🆕 The sweep scope (1) demanded — done 2026-08-22, and it revises AC1

Scope (1) said *"sweep the example projects and lesson bundles for connections into dimension
ports first, and say what was found"*. Done, over **92 `project.json` files** (every one in the
repo outside `node_modules`: library modules and prefabs, `project-examples`, QA fixtures, phase
corpora and the editor's `testfs` sample apps). Both scripts are kept
beside this file — `sweep.py` and `portset.py`, run from the repo root — and the port-name set is
derived from the viewer source rather than typed by hand.

🔴 **THE INSTRUMENT LIED FIRST, AND IN THE FLATTERING DIRECTION.** The first pass matched
connections by **port name** and reported **189** hits. Seven of them were
`Avatar.outDesiredSize → Expression.width` and friends — the `Expression` node has a plain number
input that happens to be called `width`. One of those seven was about to be written up here as
*"a shipped prefab hitting the bug today"*. Filtering by the **target node type** leaves **182**
real hits on `Group`/`Image`/`Text`/`net.noodl.visual.icon`. ⚠️ The bound, stated: the name set is
extracted by walking back from each `units:` declaration to its enclosing key, which also produced
`methods` and `popout` (mis-attributions); neither is a connection target anywhere, so they cost
nothing, but this is an approximation of the type table, not the type table.

### There are THREE registration paths, not the two the task was written around

| Declared with | Lands in | What a **bare number** does | Declared `default` applied? |
|---|---|---|---|
| `addInputCss` (padding, margin, `fontSize`, `borderRadius`, `borderWidth`, gaps, min/max) | `inputCss` | ✅ coerced to `{value, defaultUnit}` — `react-component-node.ts:1889` | ✅ yes, `:827` |
| `addInputProps` (`width`, `height`, `iconSize`, `iconSpacing`) | `inputProps` → `defineRegularInputProp` | 🔴 `value.value` is undefined → **`delete props[name]`** — `:592–605` | ❌ **no** |
| `addInputs` (`transformX`, `transformY`, `transformRotation`) | `inputs` | 🔴 the port's own `set` computes `value.value + value.unit` → **`NaN`** — `node-shared-port-definitions.ts:406–457` | ❌ **no** |

🔴 **The third path is a silent failure the task did not name, and it is the one with instances.**
The `default: 0` on `transformX` never reaches `_inputValues` — the default loop at `:827` runs
over `inputCss` **only** — so there is nothing for `setInputValue`'s merge to find a unit on, and
the custom setter builds `translate(NaN…)`, which the browser drops without an error.

### The two populations, and why AC1 has to change

**A — 34 connections carry a bare number into a port whose parameter DOES store `{value, unit}`.**
The merge fires and they work. 🔴 **AC1's clause *"the stale-unit merge is gone"* would break every
one of them**, re-uniting each to its port's `defaultUnit`: 13 into `width` and 7 into `height`,
plus `iconSize`, `paddingBottom`, `fontSize`, `borderWidth`. Named examples, all shipped:
`toggle-switch` drives `transformX` from `States.pos` against a stored `{value: 0, unit: '%'}` —
`defaultUnit` for `transformX` is `px`, so removing the merge slides the switch by pixels instead
of percent; `filters/Range` does the same on `marginLeft`/`marginRight`; `rating` feeds
`Number.savedValue` into `iconSize` against `{32, 'px'}`; `table`'s Base Cell drives `width`
against `{100, '%'}`.

**The merge is not the bug. It is the feature** — it is how an author picks the unit once in the
panel and drives the number by wire, and no wire can carry a unit. What is unlearnable is that it
is invisible, and that it does nothing when the panel value was never set.

✅ **AC1, revised:** keep the merge **when a unit is stored**; make the **no-stored-unit** case
coerce with `defaultUnit` on all three paths, so `300` into a never-set `Width` renders at the
port's default unit instead of vanishing (`inputProps`) or becoming `NaN` (`inputs`). The
`50%`-then-`300` case stays `300%` **by design**, and scope (3)'s job of *saying the shape at the
port* is what makes that legible rather than surprising.

**B — 8 connections carry a bare number into a port with NO stored value: broken today.**
🔴 **Not the failure that was filed.** Bug 2 as written (never-set + bare number → the
`inputProps` branch deletes the prop) has **zero instances** in 92 projects. Six of the eight are
on the third path, in **two shipped library modules**:

- `image-cropper` — `Javascript2.ImageXpos/ImageYpos → Image.transformX/transformY` (×4, in both
  `/#Image Cropper/Image Cropper` and its `Internal Components/Panning Control`)
- `panning-and-zooming-control` — the same two connections
- one editor `testfs` app (`Number Blend.result → transformRotation`, `Expression.result →
  transformX`) and one phase-16 probe (`animatetovalue.currentValue → transformX`)

The remaining two are `Expression.result → Group.borderRadius` on the coercing path, which is
fine.

⚠️ **PREDICTED FROM SOURCE, NOT YET OBSERVED.** These eight are read off the graphs and the three
setter paths; nobody has watched an image cropper fail to pan. **Drive one before claiming the
modules are broken** — the FB-020 lesson is that a filed mechanism can be wrong in exactly this
way, and the control arm here is a sibling connection whose parameter *is* set, which must keep
working across the same fix.

## Scope

1. **Fix the runtime asymmetry** (the actual bugs): `dimension`/units-`number` inputs coerce a
   bare number using `defaultUnit` when no unit is stored — same rule the `inputCss` branch
   already applies. Kills failures 1-as-surprise and 2 outright (a `300` becomes `300px`-or-
   default, never `300%`-by-stale-merge, never a deleted prop). Tighten the `isNaN` guard to
   actual numbers. ⚠️ This changes live behaviour for graphs that (knowingly?) relied on the
   merge — sweep the example projects and lesson bundles for connections into dimension ports
   first, and say what was found.
2. **Warn where conversion still loses**: extend `connectionCoercion.ts`'s table to the
   structured family — `string→dimension`, anything→`icon` via `*`, `array→stringlist` — each
   with a sentence saying the expected shape (AIB-001's `WIRE_FORMAT_LEGEND` already has the
   words; reuse them for humans).
3. **Say the shape at the port**: the connection popup and the Ports tab (FH-020) show the wire
   shape for structured types — `{value, unit}`, the icon union — so "what do I feed this" is
   answerable without reading source.
4. **Icon specifically**: either add `string→icon` coercion (treat a string as
   `{codeAsClass: true, class: s}` — the common font-class case) **or** refuse `*`-to-icon with
   the con-type-mismatch warning naming the picker. Coercion is friendlier; pick it unless the
   sweep in (1) finds a reason not to. 🆕 Also (Jordan §7): the **Enable Icon** description
   points a checkbox-placing user at *"add one from the library panel, a folder with a
   manifest.json"* — module-authoring copy on a control port; rewrite it for the person
   placing a checkbox.
5. 🆕 **Investigate Jordan's §2.2** — *"margin and position manipulate the same underlying
   number… both changed a corner radius through a wire. 'That can't be. Ah, you're joking.'"*
   The report is garbled but the reporter watched it happen. Plausible mechanisms all live in
   this task's territory: the stale-unit merge writing through a **shared `{value, unit}`
   object reference** held by more than one input (aliasing — mutation in one port visible in
   another), or one `*` source fanned into several units-typed ports each merging
   differently. Reproduce from the session's shape (one wire into margin + corner radius),
   diagnose, fix or write down the real relation. If it *is* aliasing, it's a third real bug.

## Acceptance criteria

- AC1 (**REVISED 2026-08-22 by the sweep above — the original clause would have broken 34 live
  connections**): bare number → a **never-set** `Width` renders at `defaultUnit` instead of the
  prop being deleted; the same value into a never-set `Pos X` renders instead of becoming `NaN`;
  and a port that **does** store a unit keeps merging, so `{0, '%'}` driven from a wire stays
  percent. Graded with all three shapes, plus a control arm from population A (a stored-unit
  connection that must not change) — a fix that re-units the shipped `toggle-switch` is a
  regression, not a pass.
- AC2: padding, Width **and Pos X** now behave identically for the same connected value — the
  asymmetry is three-way (`inputCss` / `inputProps` / `inputs`), and all three arms are asserted
  on one node.
- AC3: string → icon input draws the glyph (or the refusal warns, per the (4) decision) —
  never an empty span with no diagnostic.
- AC4: every structured type in the table above either casts losslessly, coerces with a defined
  rule, or warns — asserted as a cardinality sweep over the cast table so a new structured type
  can't ship into the silent gap (a gate hole shaped like the defect is a recorded 4× trap).
- AC5: the validator (D13's `rules/parameterValue`) still passes the real corpus — it rejected
  the shipped `fx` feature once; don't hand it a new false positive class.

## Traps

- `stringlist` is a string — an "obvious" cleanup to arrays is a format break, out of scope.
- AIB-001's doc has the wrong dimension example; fix the doc, don't inherit it into UI copy.
- Runtime changes here land in the viewer — the lesson bundles gate (`lessons:check`) and
  `test:runtime` both sweep affected fixtures; run them, not just the editor suites.
