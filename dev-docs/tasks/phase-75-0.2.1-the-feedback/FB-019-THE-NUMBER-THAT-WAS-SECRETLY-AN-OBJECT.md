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

- AC1: bare number → Width renders at `defaultUnit`; the never-set case no longer deletes the
  prop; the stale-unit merge is gone — all three graded with the failing shapes from this file.
- AC2: padding and Width now behave identically for the same connected value (the asymmetry
  spec: both arms asserted on one node).
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
