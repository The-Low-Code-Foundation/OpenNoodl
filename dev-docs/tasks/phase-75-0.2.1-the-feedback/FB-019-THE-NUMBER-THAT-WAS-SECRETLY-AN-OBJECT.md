# FB-019 — the number that was secretly an object

**Filed:** 2026-08-22, test-user session, item 4. **Status: 🟡 open — AC3 CLOSED 2026-08-23
(session 13); scope (3) is the remainder.** Session 12's drive falsified both of the
silent-failure bugs this file was built around; session 13 drove the third claim, AC3's icon arm,
and **that one was real** — fixed and re-driven. Richard's report stands; two thirds of the
diagnosis under it did not. What is left is a legibility task, not a runtime one.
Size: was M/L, now **S**. 🔴 **Read "THE DRIVE" and "THE ICON DRIVE" below before anything above
them — the Ground truth and sweep sections are the pre-drive reading and several of their claims
are wrong.**

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

🔴 **THE LAST TWO ROWS OF THIS TABLE ARE WRONG — MEASURED 2026-08-23.** Both "❌ no"s are
"✅ yes", via a seeder in a different file (`initializeDefaultValues`), and both failure
columns are wrong with them. Kept as filed so the correction has something to point at; the
measured table is under *THE DRIVE*.

| Declared with | Lands in | What a **bare number** does | Declared `default` applied? |
|---|---|---|---|
| `addInputCss` (padding, margin, `fontSize`, `borderRadius`, `borderWidth`, gaps, min/max) | `inputCss` | ✅ coerced to `{value, defaultUnit}` — `react-component-node.ts:1889` | ✅ yes, `:827` |
| `addInputProps` (`width`, `height`, `iconSize`, `iconSpacing`) | `inputProps` → `defineRegularInputProp` | 🔴 `value.value` is undefined → **`delete props[name]`** — `:592–605` | ❌ **no** |
| `addInputs` (`transformX`, `transformY`, `transformRotation`) | `inputs` | 🔴 the port's own `set` computes `value.value + value.unit` → **`NaN`** — `node-shared-port-definitions.ts:406–457` | ❌ **no** |

🔴 ~~**The third path is a silent failure the task did not name, and it is the one with instances.**~~
**FALSE — measured 2026-08-23.** `transformX` renders `300px`; the cropper pans. See *THE DRIVE*.
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

**B — ~~8 connections carry a bare number into a port with NO stored value: broken today.~~**
🔴 **MEASURED 2026-08-23: population B is EMPTY. None of them is broken.** The counts below are
also wrong (4 across two modules, not 6). Kept as filed; see *THE DRIVE*.
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

## 🔴 THE DRIVE, 2026-08-23 (session 12) — BOTH SILENT FAILURES ARE FICTION

Session 11's handover made this the first move: *"drive an image-cropper pan first — the six broken
connections are predicted from source and nobody has watched one fail."* Done. **They do not fail.**
The image cropper pans, and so does every other arm the task predicted was broken.

### Drive 1 — the image cropper pans

Fixture: the shipped prefab's own project, copied out of `library/prefabs/image-cropper`, with an
`/App` that places `Internal Components/Panning Control` exactly as `Image Cropper` does (400×300
arena, clip on, a 680×384 image). Nothing in the module was modified.

| reading | on load | after a 12-step drag of +100x / +30y |
|---|---|---|
| `img.style.transform` | `translateX(-140px) translateY(-42px)` | `translateX(-40px) translateY(-12px)` |
| `img.style.width` (**control**) | `680px` | `680px` |

−140 → −40 and −42 → −12 are the drag deltas exactly. The predicted `translate(NaN…)` never
appeared. ✅ **The control is on the same node and the same tick**: `refreshView()` emits
`ImageXpos` and `ImageWidth` from adjacent lines, into `transformX` (no stored parameter) and
`width` (stored `{100,'px'}`). The task expected these two to disagree. They agree.

### Drive 2 — all three registration paths, one node each, measured

Second fixture (`fb019-widths`): one `Expression` emitting a bare `300` fanned into five arms.
🔴 **Re-read off disk afterwards to be sure "never set" still held** — opening a project rewrites
it, and a `width` written in on open would have invalidated the whole table. It did not; A/D/E
still carry no such parameter.

| arm | path | stored value | **measured** | task file predicted |
|---|---|---|---|---|
| A `width` | `inputProps` | **none** | **`300%`** (2964px) | 🔴 *"prop deleted — the node silently loses its width entirely"* |
| B `width` | `inputProps` | `{150,'px'}` | `300px` — merge fires | merge fires ✅ |
| C `width` | `inputProps` | `{40,'%'}` | `300%` — merge fires | merge fires ✅ |
| D `paddingLeft` | `inputCss` | **none** | `300px` | coerces ✅ |
| E `transformX` | `inputs` | **none** | **`translateX(300px)`** | 🔴 *"the custom setter builds `translate(NaN…)`"* |

**Bug 2 and the "third path" bug do not exist.** Both were derived from the premise that a declared
`default` never reaches `_inputValues`, and that premise is false.

### Why the source reading was wrong — the seeder nobody grepped for

The task file reasoned from `react-component-node.ts:827`, whose default loop really does run over
`inputCss` only. That is the **React viewer's** style loop, and it is not the only one.
`initializeDefaultValues` (`nodedefinition.ts:161–180`) runs at node creation (`:537`) over
`metadata.inputs` — **every** input, all three paths — and writes

```js
defaultValues[name] = { unit: type.defaultUnit, value: defaultValue };   // note: `unit`
```

`width` declares `default: 100`, `transformX` declares `default: 0`. So `_inputValues` holds a unit
for both **before any wire fires**, and `setInputValue`'s merge (`node.ts:384`) always finds one.

✅ **The exclusion, not just the fit**: for arm A to read `300%`, `value` must already have been
`{value:300, unit:'%'}` at `defineRegularInputProp`'s setter. Only the merge builds that, and only
a `unit` key arms the merge. The one other writer of `_inputValues`, `Node.prototype.registerInput`
(`node.ts:130–140`), writes `{ value, type: defaultUnit }` — **the wrong key** — so it could not
have produced this reading, and node creation does not call it anyway (`node._inputs =
Object.create(inputs)`, `:506`).

🔴 **A latent defect banked in passing**: `registerInput`'s `type:` where every reader wants `unit:`.
Harmless today because the React path never reaches it; it means any port registered *dynamically*
with a units type has a default the merge cannot see. Not driven, not in scope here.

### So the population is empty, and the counts were also wrong

**Population B is not "8 connections broken today". It is zero.** Six of the eight were the
transform ones, and arm E plus drive 1 show them working; the task file already conceded the other
two were fine. The per-module counts were off as well — `grep`ped by `toProperty` over both
projects:

| module | task file | actual |
|---|---|---|
| `image-cropper` | 4, *"in both `/#Image Cropper/Image Cropper` and its `Internal Components/Panning Control`"* | **2**, both in `Panning Control`; `Image Cropper` has **0** |
| `panning-and-zooming-control` | 2 | 2, in its own `Panning Control` |

### What IS real, and it is the whole task now

🔴 **The asymmetry Richard reported is confirmed — with a different cause than the one filed.**
Arm A and arm D are the same node, the same wire, the same `300`, and they land as **`300%`** and
**`300px`**. The task blamed *coerces vs deletes*; the measurement says both coerce, and they
differ only because `width`'s `defaultUnit` is `%` while padding's is `px`. Nothing anywhere says so.

That makes **scope (3) — say the shape at the port — the entire remaining runtime story**, and
scope (1) mostly finished before it was written. AC1's revised clause (*"a bare number into a
never-set Width renders at `defaultUnit` instead of the prop being deleted"*) **is already the
behaviour**. 🔴 Building it would be this phase's standing trap for the sixth time: *before building
a mechanism, grep for the one that already exists.*

⚠️ **Still unobserved, and now the only predicted-from-source claim left in this task**: AC3's icon
arm — a string reaching `IconGlyph` via a `*` output rendering an empty span. Needs a fixture with a
`*`-typed output carrying a string into `iconIconSource`; not built this session. Given that two of
two silent failures in this file turned out to be fiction, **drive it before fixing it.**

⚠️ **Scope (5)'s aliasing hypothesis is narrowed, not settled.** Both writers copy: the merge does
`Object.assign({}, currentInputValue)` with a comment saying why, and `initializeDefaultValues`
builds a fresh object per node per port. So no `{value, unit}` object is shared between two ports by
either seam. If Jordan's margin/corner-radius report is aliasing, it is somewhere else — variants and
visual states are the unexamined candidates.


## 🆕 THE ICON DRIVE, 2026-08-23 (session 13) — AC3 IS REAL, AND IT IS THE FIRST ONE THAT WAS

Three predicted-from-source claims have now been driven in this file. Two were fiction. **This
one is true**, and it was driven before it was fixed, as the handover insisted.

### The fixture, and why it needed three arms

One `/App`, three `Icon` nodes, and a Function node whose output type is **left unset** — which
is the whole trick: the `outtype-` enum offers String/Boolean/Number/Object/Date/Array/Color/
Signal and **no `*`**, so a `*` output is what you get by *not* choosing
(`simplejavascript.ts:699`, `type: declaredType || '*'`). Verified live off the running editor:
the wire's source port really is `{name:'out-icon', type:'*'}` into `{name:'iconIconSource',
type:'icon'}`.

| arm | `iconIconSource` | rendered (measured) |
|---|---|---|
| **A** subject | the string `'account_circle'`, over the `*` wire | 🔴 `<span class="" style="font-size:40px; color:rgb(255,0,0); line-height:1"></span>` |
| **B** control | `{class:'material-icons', code:'account_circle'}` | ✅ `<span class="material-icons">account_circle</span>` |
| **C** control | never set | ✅ **no span at all** |

🔴 **Arm C is what makes arm A a defect rather than a non-event.** An undrawable value does not
degrade to "nothing" — it produces an **empty, styled span that still takes its `iconSize` in
layout**. Read `props.iconIconSource` off the React fibre to close the loop: the string
`'account_circle'`, `typeof 'string'`. Arm A's span existing at all *is* the proof the value
arrived; a function that never ran would have rendered arm C.

### And it is silent in all three places one would look

- **The cast table**: 0 of 16 rows have `icon` in their `to` — nothing casts to icon, ever. Read
  live, ⚠️ **with a control**: the first read of `typecasts` was taken before a project was open
  and reported `string→number: false`, which is *wrong*. A cast-table reading on an unloaded
  library is vacuous and reads exactly like a refusal.
- **The connection warning**: a control pair on the same wire, varying only the source type —
  `string → icon` raises *"Target port of type icon cannot be connected to a source port of type
  string"*; `* → icon` raises **nothing**, and restoring `*` makes the silence come back. That is
  by design: `unconvertedCast` returns `null` for `*` because "a wire out of an undeclared output
  is not evidence of anything".
- **The console**: nothing, in the viewer or `.logs/dev.log`.

### 🔴 Why scope (4) was resolved to WARN and not to COERCE

Scope (4) says pick coercion "unless the sweep finds a reason not to". **It did.**
`iconValueForGlyph` (`shared/utils/iconsets.ts:153`) builds a glyph's value as
`{class: set.iconClass, code: glyph, codeAsClass: set.codeAsClass}` — **two of the three fields
come from the installed set's manifest**, and only `code` comes from the glyph name. A bare
string carries the name and nothing else, so any coercion must guess which set it belongs to,
and the shipped conventions want opposite fields (Material Icons wants the name in `code`; a
class-per-glyph set wants it among the classes). The task's suggested
`{codeAsClass:true, class:s}` is wrong for both. **Guessing renders a blank glyph again, having
reported success** — a worse defect, because it looks handled.

### What was built

- `components/visual/Icon/iconSourceProblem.ts` — the predicate and the sentence.
- The `icon` branch in `defineRegularInputProp` (`react-component-node.ts`): reports via
  `setDiagnostic` and **drops** the value, so an undrawable value renders like arm C.
  At the port, not in `IconGlyph`: here the port has a name and the node an id, it runs once per
  *set* rather than once per render, and `setDiagnostic` is a setter, so the statement that
  raises the warning is the one that clears it.
- ✅ **Driven after the fix, same fixture**: arm A → **no span**, `totalWarnings` **0 → 1**,
  message *"Icon Source expects an icon, received a string (account_circle). Nothing will be
  drawn — pick the glyph with the icon picker, or wire an object of the shape {class, code}…"*.
  Arm B unchanged. Then the function was made to emit `{class:'material-icons',code:'search'}`
  over **the same wire**: warning back to **0** and arm A **drew the glyph**. That last step is
  the one that proves the fix does not refuse the legitimate use — a Function node emitting a
  proper icon object is a real thing to do, which is why refusing the *wire* would have been wrong.
- `tests/fb-019-icon-source-diagnostic.test.tsx` — 20 rows. **Mutation-checked twice**: disabling
  the port branch reds **2** (ARM A and the no-empty-span consequence arm); making the predicate
  accept everything reds **7**. The other rows are regression arms and correctly stay green —
  ⚠️ an earlier draft "killed" 4, but two of those were red only because the harness never got
  called, which overstates the count; they now grade *no message raised*, which is true either way.
- ✅ **Provably inert for what ships**: 76 `iconIconSource` parameters across 97 `project.json`
  files, **all 76 accepted, 0 would warn**. ⚠️ Bound: that is *parameters*; wired values cannot be
  swept statically, and are the population this exists for.

### 🆕 Scope (4)'s second half was already done

The **Enable Icon** copy Jordan §7 complained about — *"add one from the library panel, a folder
with a manifest.json"* — **is not in the source**. `useIcon` reads *"Shows an icon on this
element"*, and every icon port's description is builder-facing. Same shape as AC1: an item in
this file describing something that already ships. Nothing to build.

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

- AC1 (**REVISED TWICE. 2026-08-22 by the sweep; 2026-08-23 by the drive, which found the
  behaviour it asks for ALREADY SHIPS**): ⚠️ **Nothing to build.** A bare number into a never-set
  `Width` already renders at `defaultUnit`, a never-set `Pos X` already renders, and a stored unit
  already keeps merging — measured on all three paths, table under *THE DRIVE*. ✅ **What AC1 is
  now**: a **characterisation test** pinning those five arms, so the seeding in
  `initializeDefaultValues` cannot be removed by someone tidying `registerInput`'s duplicate. It
  must fail if the seeder is deleted — mutation-check it, because a spec over behaviour that is
  already correct is exactly the spec that passes on anything.
- AC2 (**REVISED 2026-08-23**): ~~padding, Width and Pos X now behave identically~~ — they already
  produce a value on all three paths. 🔴 **The real asymmetry, and the one Richard hit, is that
  they do not produce the SAME value**: `300` into padding is `300px`, into Width is `300%`,
  because `defaultUnit` differs per port. AC2 is now: **the editor says which unit a bare number
  will land in, at the port**, so the two are distinguishable without reading the viewer source.
  That makes AC2 a restatement of scope (3), which is the whole task now.
- AC3 — ✅ **DRIVEN, THEN FIXED, THEN RE-DRIVEN (2026-08-23, session 13). DONE.** It was the last
  predicted-from-source claim here and the **only one of the three that was real**. A string
  reaching an icon port via a `*` output rendered an empty styled span with no diagnostic
  anywhere; it now renders nothing and raises a warning at the node naming the value and the
  shape. Resolved to **warn, not coerce** — see *THE ICON DRIVE* for why a bare string cannot be
  coerced correctly. ⚠️ The remaining icon work is scope (3)'s: saying the shape at the port
  *before* the author wires it, which this does not do.
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
