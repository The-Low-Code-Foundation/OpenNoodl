# FIX-004 — The blocks that are missing

**Report 2 (+ the gap-analysis half of report 3)** · Tier 2 · Effort **S + XS + M**, async is **L**

> *"I wasn't able to use a Number() operator for example to turn a string into a number. There's
> no log block."*

## Mechanism — pinned: both are genuine holes, not discovery failures

- **No string→number block exists anywhere.** Core Blockly ships **no type-conversion block at
  all** (exhaustive enumeration of the block registry), and `NoodlBlocks.ts` supplies none. The
  reachable workaround is a coercion trick — and `"5" * 1` works while `"5" + 0` concatenates,
  which is exactly the trap.
- **No log block.** Blockly's `text_print` exists but generates `window.alert(...)` (verified in
  the generator source) and is rightly excluded; `text_prompt` generates `window.prompt`, which
  Electron lacks (VFN-003). Meanwhile `console` **is** available to generated code in both
  runtimes (`logic-builder.ts:505-532` compiles with a plain `new Function` in global scope; the
  cloud sandbox installs `global.console` at `sandbox.isolate.js:26`) — so a log block needs **no
  runtime change**.

## Slice A — conversion + log (S)

Two custom blocks in `NoodlBlocks.ts` + `NoodlGenerators.ts` (both reached from `initialize.ts` —
plain-Blockly imports are safe there; only `@noodl-core-ui`/React is banned):

1. `noodl_to_number` — value block, `Number(x)`; or one multi-mode block
   (`convert [Number▾] of ( )`) with `Number`/`String`/`Boolean`/`parseInt`/`parseFloat` modes.
2. `noodl_log` — statement block, `console.log(...)`.

🔴 **`noodl_log` is a statement block and MUST be added to `hatMigration.ts:58`
`HATTABLE_BLOCK_TYPES`** or migration/seed will not wrap it under a hat and it sits orphaned —
the easiest thing to forget. Value blocks get VFN-013 live-value badges for free (`BlockProbes`
auto-probes); `detectIO` needs no change.

## Slice B — free toolbox additions (XS)

Already registered in Blockly, one toolbox line each: `math_change`, `math_on_list`
(sum/min/max/average), `lists_create_empty`, `lists_reverse`, `text_replace`, `text_reverse`,
`text_count`.

## Slice C — objects as data (M)

The real remaining vocabulary gap against the Function node (short of async):
- JSON parse / stringify (`S`);
- create-empty-object + get/set property **by expression** — a computed key is impossible today
  (`noodl_get_object_property` takes a literal field, `NoodlGenerators.ts:161-174`);
- `Object.keys`/`values`/has-property — there is currently **no way to iterate an object**
  (`controls_forEach` takes lists only).

Note `Noodl.Arrays` returns a `Collection extends Array` (`collection.ts:7`), so the stock
`lists_*` blocks already operate correctly on Noodl arrays.

## Deliberately separate — async (L, ruling required)

`fetch`/HTTP, `Noodl.Records`, `CloudFunctions`, `Users`, `Navigation` blocks are **impossible
as-is**: the Visual Function compiles with a **sync** `new Function`, so there is no `await`.
Switching to `AsyncFunction` touches `_executeLogic`, the outcome signals (`logic-builder.ts:659`),
the `__p`/`__s` probe pair, Do It, and the VFN-011 bench. High value, real design question —
file as its own future task, do not fold into this one.

## Rulings

1. Conversion: one multi-mode dropdown block or three separate blocks? (Dropdown is cheaper and
   matches `noodl_define_input`'s TYPE field — but see FIX-005: dropdowns currently read badly.
   Sequence FIX-005 first or accept the interim.)
2. Log block: plain `log` only, or a level dropdown? (`console.error` from a block program would
   visually collide with the node's own `_fail` diagnostics — recommend plain `log`.)
3. Custom block labels are hardcoded English (no `Blockly.Msg` keys; `BlocklyLocale.ts` translates
   only category labels). Accept for new blocks, or introduce Msg keys now?

## Acceptance criteria

1. A block program that takes a text input `"42"`, converts it, and multiplies by 0.9 outputs
   `37.8` (number, not `"37.8"` or NaN) — driven on the bench.
2. A log block prints to the console in the browser preview **and** in a cloud-function context.
3. A log block dragged standalone onto the workspace gets a hat (the `HATTABLE_BLOCK_TYPES`
   check, with a negative control from a pre-fix seed).
4. New value blocks show live-value badges after a run.
5. Toolbox renders every added block; `test:ci` and the vfn-012 suites stay green.


## §A + §B — what shipped (2026-08-16, session 34, `43b2e521`)

**Slices A and B are built and gated; nothing is driven.**

| | |
|---|---|
| `noodl_convert` | value block, 5 modes (`number` / `text` / `true/false` / `whole number from text` / `decimal from text`). The **output check follows the mode**, which is what makes it worth more than the coercion trick: in `text` mode Blockly refuses the maths socket instead of silently producing `"50"` from `"5" + 0` |
| `noodl_log` | statement, `console.log`. On `HATTABLE_BLOCK_TYPES`. No runtime change needed, as the mechanism section predicted |
| mode table | `convertModes.ts`, import-free, so block and generator cannot drift and `tests-unit` can grade it directly |
| homes | convert under **Math** and **Text**; log under a new **Debug** category (+6 locales) |
| §B | all 7 stock types added and **verified present in Blockly's registry beside a MISSING control** |

**The three rulings, taken rather than deferred.** (1) **One multi-mode dropdown.** Its only stated
objection was *"dropdowns currently read badly — sequence FIX-005 first or accept the interim"*, and
FIX-005 part 1 shipped in this same session, so the objection is discharged rather than accepted.
(2) **Plain `log`**, as recommended. (3) **Hardcoded English labels**, matching every other block here.

🔴 **A gate hole found and closed while doing this.** `hat-migration.spec.ts` looks like it would
catch a toolbox naming a block that does not exist — it walks the toolbox and instantiates every
type — but its walk is `try { newBlock } catch { continue }`, deliberately, because *"a type the
flyout names but this build does not register is not a migration concern."* Correct for that suite,
and it means **a typo'd or version-dropped toolbox entry renders as a silently missing flyout row
with every gate green.** Adding seven stock types in one commit is exactly when that matters, so
`tests-unit/fix-004/blocks.spec.ts` now asserts every toolbox type is registered, with a
non-empty-toolbox control beside it.

🔴 **Not driven.** Acceptance 1–4 all want the bench: the `"42"` × 0.9 → 37.8 drive, the console
output in a preview *and* a cloud function, the standalone-hat check, and the live-value badges.
Criterion 1 is covered *as arithmetic* in the specs (the generated expression is `eval`'d and
asserted `37.8`, with `"42" + 0 === "420"` as the control) but that is not the same claim.
⚠️ **Slice C (objects as data) and the async question are untouched.**

---

## §A + §B — DRIVEN 2026-08-16 (session 35). 1, 3, 4, 5 close; 2 closes by half.

Driven on `fix005-drive` (renamed copy of `vfn64-drive`), `/ErgCodes`'s Logic Builder bench.

### 🔴 First: acceptance 1 as written cannot fail, and that had to be fixed before driving it

`"42" × 0.9` is **37.800000000000004 in JavaScript whether or not the convert block does anything**
— multiplication coerces, and `typeof` is `number` in both arms. So the stated criterion passes
against a `noodl_convert` that is a pure passthrough. It was driven as written *and* with an arm
that actually discriminates:

| convert mode | operator | `total` | type |
|---|---|---|---|
| `NUMBER` | `×` | `37.800000000000004` | number — **criterion 1 as written** |
| `NUMBER` | `+` | `42.9` | number — **the discriminating arm** |
| `STRING` | `+` | `"420.9"` | **string** — the concat trap, reproduced live |
| *(no convert block)* | `+` | — | **connection refused** |

✅ **`42.9` is what closes it.** A passthrough would have produced `"420.9"`; only a real `Number()`
gives `42.9`. And the generated code, read off the node's `generatedCode` parameter, is
`Outputs["total"] = __p(…, __p(…, Number(__p(…, '42'))) * __p(…, 0.9))`.

⚠️ **Note the exact value: `37.800000000000004`, not `37.8`** — the correct IEEE754 result of
`42 * 0.9`. ✅ **Checked, and the spec is fine**: `blocks.spec.ts:138` asserts
`toBeCloseTo(37.8, 10)`, not `toBe(37.8)`. Recorded because "outputs `37.8`" in the criterion above
is the idealised decimal, and the next person to write an assertion on this path should use a
tolerance.
⚠️ **But the spec's control is about JavaScript, not about the block**: `expect(eval('"42" + 0'))
.toBe('420')` (`:142`) demonstrates the coercion trap in raw JS — it never exercises
`noodl_convert`. The `NUMBER + → 42.9` vs `STRING + → "420.9"` pair above is the arm that varies
the block itself.

✅ **The type check is doing real work.** A `text` block (output check `["String"]`) is **refused**
by the maths socket (check `["Number"]`) — so convert is not a convenience, it is the only bridge.
✅ **`setCheckWithoutBreakingWires` behaves as documented**: switching a wired block to `text` mode
leaves the check at `Number` and keeps the wire rather than severing it.
⚠️ **The consequence is worth stating**: in that state the block *advertises* `Number` while
generating `String(…)`, which is how the `"420.9"` row above was produced. Deliberate tradeoff, but
a wired convert block can deliver a type its socket denies.

### Acceptance 2 — browser preview ✅, cloud function ❌ (mechanism verified, not driven)

A `noodl_log` carrying `'FIX004-LOG-PROBE-7391'` was added under the hat and committed via **Done**.

- ✅ **Bench sandbox run** — printed to the editor console.
- ✅ **Browser preview** — clicking the `CODES` text in the live viewer (`c2.onClick → c6.run`)
  printed the probe **in the viewer's own renderer**, a different console from the editor's.
  🔴 **And the consequence was checked, not just the print**: the on-screen counter moved `0 0` →
  `0 1` (`c6.completed → c7.increase`), so the program genuinely ran end to end.
- ❌ **Cloud function — NOT driven.** The mechanism is real (`noodl-viewer-cloud/src/sandbox.isolate.js`
  installs `global.console`), but ⚠️ **it is not the host console**: `console.log` there forwards to
  `_noodl_api_call('log', undefined, {level:'info', message})`. Whoever drives this half should
  expect a Noodl log entry, not stdout. **This is a source read; it is not evidence the block ran.**

### Acceptance 3 — the hat, with a control that differs only in block type ✅

`ensureHatsInJson` (the real module, the path `CanvasTabsContext.tsx:194` uses on tab open):

| input | result |
|---|---|
| standalone `noodl_log` | wrapped — top block becomes **`noodl_when_signal`** |
| `noodl_convert` (value block, deliberately off the list) | left alone, no hat |
| `noodl_not_a_real_block` (unknown type) | left alone, no hat |

Three arms varying only the type; only the log arm gets a hat. `isHattableBlockType('noodl_log')`
is `true`, `('noodl_convert')` is `false`.

### Acceptance 4 — live-value badges ✅

After a run the chain carries badges reading `"42"` → `42` → `0.9` → `37.800000000000004`. The
convert block's own badge showing **`"42"` quoted going in and `42` unquoted coming out** is the
clearest single piece of evidence for criterion 1 on this page.

### Acceptance 5 — the toolbox renders every added block ✅

Read from each category's **flyout workspace** — the blocks Blockly actually instantiated, not the
toolbox XML, which is the gap `hat-migration.spec.ts`'s `try/catch` leaves open.

- `noodl_convert` — present in **Math** *and* **Text**, both homes as designed.
- `noodl_log` — present in the new **Debug** category.
- All seven §B additions drawn: `math_change`, `math_on_list` (Math); `lists_create_empty`,
  `lists_reverse` (Lists); `text_replace`, `text_reverse`, `text_count` (Text).

⚠️ **Drive-tooling note:** two Blockly instances are live in the renderer — `req.c['blockly']`
holds the 4 real workspaces; `req.c['../../node_modules/blockly/blockly_compressed.js']` reports
`Workspace.getAll()` of **0** and `getMainWorkspace()` false. Reaching for the compressed one reads
as "the bench isn't open".

---

## §C — what shipped (2026-08-16, session 37)

**Slice C is built and gated; nothing is driven.** Seven blocks, one new category, 22 specs.

| block | shape | generates |
|---|---|---|
| `noodl_new_object` | value → `Object` | `({})` |
| `noodl_get_object_property_expr` | value | `object[key]` |
| `noodl_set_object_property_expr` | **statement** | `object[key] = value;` |
| `noodl_object_members` | value → `Array`, dropdown | `Object.keys(o)` / `Object.values(o)` |
| `noodl_object_has_property` | value → `Boolean` | `Object.prototype.hasOwnProperty.call(o, k)` |
| `noodl_json_parse` | value → *(no check)* | `JSON.parse(t)` |
| `noodl_json_stringify` | value → `String` | `JSON.stringify(v)` |

Homes: a new **Data** category, placed after Lists — it is to `App Objects` what `Lists` is to
`App Arrays`, and shares hue `20` for the same reason those two share `260`. Expressions and
tooltips live in `objectData.ts`, import-free, so `tests-unit` grades them directly
(`convertModes.ts`'s pattern). 🔴 `noodl_set_object_property_expr` is on
`hatMigration.ts`'s `HATTABLE_BLOCK_TYPES` — the §A trap, paid once already by `noodl_log`.

### 🔴 The measurement that decided a generator: `in` is inverted on a Noodl Object

`Noodl.Objects[id]` is **not** a plain object in either runtime — both hand back a Model proxy
(`model.ts` `_modelProxyHandler`; browser `noodl-js-api.ts:67`, cloud `noodl-js-api.js:27`). That
handler implements `get`, `set`, `ownKeys` and `getOwnPropertyDescriptor` — **but no `has` trap**.
Measured on a real Model carrying `{title, count}`:

| expression | answer |
|---|---|
| `Object.keys(o)` / `Object.values(o)` | `['title','count']` / `['hello',3]` ✅ |
| `o['title']` | `'hello'` ✅ |
| `hasOwnProperty.call(o,'title')` | `true`; missing key → `false` ✅ |
| **`'title' in o`** | **`false`** 🔴 |
| **`'data' in o`** | **`true`** 🔴 |

Exactly inverted — false for every key the author put there, true for the plumbing. A `has
property` block generating `key in object` would report that **no App Object has any property**.
The spec asserts `in`'s wrong answers beside `hasOwnProperty`'s right ones, so the shorter
operator cannot later look like a safe simplification.

⚠️ `JSON.stringify` of an App Object **adds an `id` key** (`Model.prototype.toJSON`), so a JSON
round trip does not return what went in. Stated in the tooltip and asserted, not worked around.

### Two other things checked rather than assumed

🔴 **A bare `{}` at the start of a statement is a *block*, not an object literal.** The setter
generates `<object>[<key>] = …` at column 0, so `noodl_new_object` emits `({})` always. The spec
compiles both forms and requires `new Function('{}["a"] = 1;')` to throw — the parentheses are
load-bearing, not cosmetic.

🔴 **`Connection.connect` is not an oracle, and it lies in two different ways.** On an *empty*
socket it returns `false` for a refused pairing; on an **occupied** socket it returns **`true`
while refusing**. It never throws. So `expect(…).toThrow()` fails on correct behaviour and
`expect(connect(wrong)).toBe(false)` fails after a successful connect. `isConnected()` is the
only honest readout. All three readings were measured; a spec records them.

**JSON parse throws on bad text, deliberately** — `logic-builder.ts` catches it into
`_fail('logic-builder/blocks-threw', …)`, which lights `error`, fires `Failure` and raises a
runtime error. Swallowing it into `null` would replace three visible failures with a silent
empty value.

### ⚠️ What was deliberately NOT done

The four object-shaped blocks would be worth listing under **App Objects** as well as Data —
this toolbox already dual-lists `noodl_convert` under Math and Text for exactly that
findability reason, and findability *is* the complaint behind this whole fix. It was built that
way and then withdrawn: `tests-unit/vfn-012/browser-blocks.spec.ts` holds the three seam
categories **byte-identical**. That fence is stricter than the claim in its own title
(*"changes no existing block type id"* — which an addition does not do), but relaxing another
phase's guard so one's own change fits through it is the wrong way round.
**Ruling owed:** should the seam categories carry the computed-key twins, and should that fence
be narrowed to what it says? Both are cheap; neither is mine to decide.

> ✅ **DISCHARGED. Ruled session 42 (dual-list, and narrow the fence), BUILT session 46** — see
> *"§C dual-list — BUILT 2026-08-16"* below, and `BlocklyToolbox.ts:341-345`. **Richard re-confirmed
> both halves at s61 when this paragraph was mistakenly re-asked as an open question.**
> 🔴 **This paragraph and the two "still owed" notes below were written BEFORE that ruling and are
> stale.** This file is an append-only narrative: a sentence describing a gap stays here forever,
> and s61 read three such sentences as current. **Check for a later section before believing one.**

🔴 **Not driven.** Everything here is headless Blockly plus a real `Model`. Nobody has dragged
one of these blocks in the app.

### Gates

`test:main` **212 suites / 3313 tests, 0 failed** (of which §C is +1 suite / +22 tests; the
other +1/+25 since s36 is a peer's). `tsc -p tsconfig.json` and `tsc -p tsconfig.tests.json`
both **0 errors**. Six mutation controls, each killing 1–2 specs and no more: `in` for
`hasOwnProperty`, bare `{}`, the statement dropped from `HATTABLE_BLOCK_TYPES`, `keys` emitting
values, a block dropped from the toolbox, and the computed key hard-coded.

⚠️ **`tsc -p tsconfig.tests-main.json` reports 31 errors and is not a gate anybody runs** — it
is only ts-jest's config source in `jest.config.js`, and jest never compiles the files that
error (`erg-005/componentContract.pending.ts`, `nodegrapheditor.ts`, `NodeGraphContext.tsx`,
`UseCanvasView.ts`, `Icon.tsx`). Identical error set with and without this change, and with and
without the peer's in-flight edit to that file's `include`. **Pre-existing; not FIX-004's.**

## §C — DRIVEN 2026-08-16 (session 38). All four checks close.

**Slice C is now driven in the real app.** Editor launched, a copy of `Puppy test 3` opened from
the scratchpad (renamed `fix004c-drive`; `_retainedProjectDirectory` read back before anything was
touched, per the copy rule), a `Logic Builder` node added to `/Components/BenchLogicProbe`, and the
Blockly tab opened via the `LogicBuilder.OpenTab` event.

### 1. The `Data` category exists and sits where §C says ✅

19 toolbox items. `Data` is index **13**, immediately after `Lists` (12) and before `Debug` (14) —
the placement the toolbox comment argues for, confirmed against the live `getToolboxItems()`, not
the XML.

### 2. 🔴 The flyout draws all seven — read from the FLYOUT WORKSPACE, not the toolbox XML

`toolbox.getFlyout().getWorkspace().getTopBlocks(false)` after selecting `Data`:

| # | type | label as drawn |
|---|---|---|
| 1 | `noodl_new_object` | 🆕 empty object |
| 2 | `noodl_get_object_property_expr` | 📖 get property ? of object ? |
| 3 | `noodl_set_object_property_expr` | ✏️ set property ? of object ? to ? |
| 4 | `noodl_object_members` | 🗝️ the property names of object ? |
| 5 | `noodl_object_has_property` | ❓ object ? has property ? |
| 6 | `noodl_json_parse` | 📥 read JSON ? |
| 7 | `noodl_json_stringify` | 📤 JSON text of ? |

`noodl_object_members` drew in its **`KEYS`** default, as `DEFAULT_OBJECT_MEMBERS_MODE` says.

✅ **Two controls, because "7" on its own is not a measurement.** The same reader returns **12** for
`Lists` (`lists_create_empty`, `lists_create_with`, …), so it is not echoing a constant; and all
seven types are present in `Blockly.Blocks` while a bogus `noodl_bogus_control_block` is **absent**,
so the registration probe discriminates. This is the reading the XML cannot give: a block whose
*definition* failed to register would still be named in the toolbox and simply not draw.

### 3. The four-block chain compiles and runs ✅

Built in the live workspace — every one of **13 connections verified with `isConnected()`**, never
with `connect()`'s return value (§C already records that it lies in both directions). Generated:

```js
var obj, total, k;
obj = JSON.parse('{"a":1,"b":2}');
total = 0;
var k_list = Object.keys(obj);
for (var k_index in k_list) {
  k = k_list[k_index];
  total = total + obj[k];
}
```

Executed: **`total === 3`, `typeof 'number'`.** Note `obj[k]` — a **computed** key, which is the
whole point of the slice and was impossible before it.

🔴 **The criterion can fail, and that was demonstrated rather than asserted.** Flipping the members
dropdown `KEYS → VALUES` in the live workspace changes the emitted call to `Object.values` and the
answer to **`NaN`**; restoring `KEYS` returns **3**. So the `3` is sensitive to the generator under
test. (This is the check §A's acceptance 1 failed to have — see line 120.)

### 4. `in` re-measured independently, in the live viewer runtime ✅

s37's table was measured headlessly on a `Model`. It reproduces **exactly** on a real
`Noodl.Objects` proxy in the running `<webview>` viewer:

| expression | answer |
|---|---|
| `Object.keys(o)` / `Object.values(o)` | `['title','count']` / `['hello',3]` ✅ |
| `o['title']` | `'hello'` ✅ |
| `hasOwnProperty.call(o,'title')` / missing | `true` / `false` ✅ |
| **`'title' in o`** | **`false`** 🔴 |
| **`'data' in o`** | **`true`** 🔴 |
| `JSON.stringify(o)` | `{"title":"hello","count":3,"id":"s38-in-probe"}` ⚠️ |

Both §C claims hold in the browser runtime, not just headlessly: the `in` inversion **and** the `id`
that `toJSON` adds. `hasOwnProperty.call` is the right generator.

### On screen: `Data` beside `App Objects` reads fine — the collision does not materialise

The toolbox comment worried that `Objects` would collide with `App Objects`. It does not, because
the two are **ten rows apart in different visual groups**: `App Objects` sits in the `App *` seam
block (index 3, above the first separator) and `Data` sits with the generic vocabulary
(Math / Text / Lists / Data / Debug). Screenshot taken. The naming decision is vindicated by the
layout rather than merely defended by it.

⚠️ **Fixture noise, not a defect:** the copy inherits `Puppy test 3`'s backend config, so opening it
raised *"Puppy test 3 backend could not be started … EADDRINUSE 127.0.0.1:8581"*. The real project's
backend was already bound; the copy's attempt failed and nothing of the original was disturbed.
Rename the backend too if a future drive needs one.

### Gates

**None taken, and none owed: this session changed no source.** The only edits are this file and the
handover. `git status` at teardown showed a dozen dirty files, **all peers'** (validation/, nodelibrary,
noodl-mcp tests) — untouched by me.

### Still owed on §C

> ✅ **STALE — written before session 42's ruling. Discharged; built session 46.** Kept because
> deleting the record would hide the sequence.

🔴 The seam-category ruling at line 276 is **unchanged** by this drive. Findability is the open
question; the blocks themselves work.

---

## Acceptance 2's cloud half — DRIVEN 2026-08-16 (session 40). **Acceptance 2 closes.**

`noodl_log` prints from inside a real cloud function. Acceptance 2 therefore closes on both halves,
and with it every one of FIX-004 §A+§B's five criteria.

### 🔴 First: the mechanism this task file told the next session to expect is dead code

The note at line 165 said to *"expect a Noodl log entry, not stdout"*, because
`sandbox.isolate.js:26` installs a `global.console` forwarding to `_noodl_api_call('log', …)`. **That
prediction was wrong, and it was wrong because it named a retired path.** Two independent readings:

- `noodl-viewer-cloud/webpack-configs/webpack.prod.js:1-6` says so in its own words — *"That server
  and its cloudruntime sandbox are deleted — cloud functions now run inside nodegx-backend, which
  esbuilds this package's `src/` directly via the `@cloud-runtime` alias"* (WF-007).
- **`_noodl_api_call` has no implementation anywhere in this repo** — the only occurrences are the
  four call sites *inside* `sandbox.isolate.js` itself. It was the external `noodl-cloudservice`'s
  host global. Nothing in `noodl-editor/src` or `nodegx-backend/src` loads that bundle; the only
  surviving references are three doc comments.

So the isolate's console shim could not have produced a log entry here even if it were on the path.
⚠️ **The residual, stated rather than hidden:** the isolate bundle *is* still built as the published
`@noodl/cloud-runtime` artefact, so a consumer outside this repo could still supply those globals.
Nothing a spec in this repo can reach.

🔴 **Where the error came from, now fixed at source.** `NoodlBlocks.ts`'s own comment on `noodl_log`
credited the cloud half to `sandbox.isolate.js:26`. The *conclusion* was right and the *reason* was
stale, and this task file copied the reason. That comment now records the measured mechanism, the
retirement, and the redaction consequence below — because the next person to ask "does this work
server-side?" reads the block, not this file.

### The real mechanism, and what it is on the path of

`nodegx-backend` imports the real `CloudRunner` out of `noodl-viewer-cloud` (`@cloud-runtime`,
`WorkflowRunner.ts:38`) and runs it **in-process**. `logic-builder.ts:505-532` compiles
`generatedCode` with a plain `new Function(…)` whose parameter list does **not** include `console`,
so `console` resolves off the enclosing global — Node's own. The line goes to real stdout.

✅ **The node is reachable server-side at all** because it is in the *shared* list
(`noodl-runtime.ts:190`) and the `type !== 'cloud'` subtraction at `:323` does not name it.
Independently confirmed by the generated cloud picker snapshot
`noodl-editor/src/editor/src/models/nodelibrary/cloud-node-library.json`, which lists
`'Logic Builder'` under `CustomCode`.

### The drive: a real standalone backend, no jest, no editor

`node packages/nodegx-backend/dist/cli.js serve --data-dir <tmp> --port 8591`, a hand-written
`workflows/lb.workflow.json`, and `curl`. Both arms answered `{"result":{"ok":"go"}}`.

| arm | `generatedCode` | response | probe on stdout |
|---|---|---|---|
| **treatment** | `console.log('FIX004-STDOUT-PROBE-5510');` | 200 | ✅ **present, verbatim, bare** |
| **control** | `'FIX004-STDOUT-CONTROL-4417';` | 200 | ❌ absent |

🔴 **Both arms carry a unique probe string inside their generated code**, and differ only in whether
it sits inside the `console.log(…)` the block generates. That is what rules out the boring
explanation — the runner echoing its own source, its inputs, or an execution record. A single arm
could not have told those apart.

The line as it came out, between two of the service's own structured lines:

```
{"ts":"…","level":"info","event":"request","requestId":"3b0b4121-…","method":"POST",…}
[WorkflowRunner] Executing function: lbLogged
FIX004-STDOUT-PROBE-5510
[WorkflowRunner] Function lbLogged completed in 2ms
```

⚠️ **The probe appears in NO JSON line** (checked: `grep '^{' | grep -c probe` → `0`). No timestamp,
no level, no `requestId`, no `event`. That is the visible form of the finding below.

⚠️ **A quoting bug ate the first attempt and the runtime caught it**, which is worth recording as a
positive: `node -e` with nested single quotes wrote `console.log(+PROBE+);`, and the run failed with
`logic-builder/code-not-compiled` — *"The blocks could not be compiled: Unexpected token ')'"* — so
the first drive measured shell quoting, not the block. The generator script was moved into a file.
🔴 **And note what that failure did to the request: it hung until curl's own timeout at 10s**, with
only `success` wired. That is CWF-018 reproduced incidentally — an unwired `failure` path leaves
`POST /functions/:name` waiting forever.

### 🔴 The finding: a block's `console.log` is a bare one, and a secret logged from a block leaks

`net.noodl.Log` — the *node* — is levelled, carries the request id, lands in the execution record,
and is redacted **by key and by value** (CWF-013, `cloud-log-node.test.ts`). A `noodl_log` **block**
compiles to a bare `console.log` and has none of that. Measured, not reasoned about:

| arm | block program | provisioned secret in output |
|---|---|---|
| control | `console.log('SECRETLEN:' + String(Inputs["secret"]).length)` | ❌ absent — and `SECRETLEN:29` present, so the wire was live |
| **treatment** | `console.log(Inputs["secret"])` | 🔴 **present, in the clear** |

The control is what attributes it. Without an arm that fetches the same secret through the same
`Secret` node and merely declines to log it, "the secret is in the output" would equally well
indict the `Secret` node, the runner or the execution record — and would have named the wrong
mechanism. It runs first, against an output buffer the logging arm has not touched.

⚠️ **This is a consequence of FIX-004, not a defect in it.** The block does exactly what it says.
But it is a new door onto stdout that no redaction covers, and it wants a ruling — see below.

### Gates

✅ **Taken this session:**

| Gate | Reading |
|---|---|
| `nodegx-backend` jest (**full**) | ✅ **100 suites / 1085 passed, 10 skipped, 0 failed** |
| `noodl-editor` `test:main` (jest) | ✅ **214 suites / 3336 tests, 0 failed** |
| `tsc -p packages/nodegx-backend/tsconfig.tests.json --noEmit` | ✅ 0 errors |
| `tsc --noEmit -p packages/noodl-editor/tsconfig.json` | ✅ 0 errors |

⚠️ **`test:ci` (jasmine) NOT taken, and the reason is the claim, not the cost.** The only source
change this session is **comment-only** (`NoodlBlocks.ts`), which both `tsc` runs prove parses; the
two new/changed spec files are jest (`tests-unit` and `nodegx-backend/tests`), neither of which
`test:ci` runs. Nothing this session touched is reachable from it. The floor recorded at s38 —
2843 / 6 @ seed 39393 — is **inherited, not re-measured.**

🔴 **Both `tsc` readings are read off empty output, not off an exit code**, because `… | tail`
reports the pipe's status rather than the compiler's.

### 🔴 The instrument bug this suite walked into, and why it matters beyond this task

`tests/cloud-logic-builder-log.test.ts` first captured output by spying `process.stdout.write` —
copying `cloud-log-node.test.ts`, which does exactly that and is green. **It passed run alone and
failed all four presence assertions in the full-suite run.**

Jest runs a lone test file in band, where its `Console` ends up on this process's stdout; in a
**worker** it buffers console output and ships it to the parent over IPC, so `process.stdout.write`
is never called. `cloud-log-node.test.ts` is immune only because the structured logger calls
`process.stdout.write` **directly** (`ops/logger.ts:61`), going around jest's console entirely — and
a bare `console.log` from generated code cannot.

⚠️ **A `process.stdout.write` spy is the wrong instrument for a `console.log` claim, and it is wrong
in the direction that looks fine locally.** The suite now spies `console.log` as well and asserts on
the union. ✅ **And this is exactly why the standalone-CLI drive above is the load-bearing evidence
for "reaches real stdout"**: under jest the assertion is about a `console.log` call, not about the
process's output. The spec is the gated regression; the CLI run is the measurement.

### Still owed after this drive

- 🟢 **The redaction ruling, NEW.** A `noodl_log` block can print a provisioned secret to stdout in
  the clear, where the `Log` node cannot. Options: (a) accept — a block program is code, and code
  can always print; (b) route the block's generator at `console.log` through the same scrubbed sink
  the `Log` node uses; (c) leave the behaviour and say so in the block's tooltip. ⚠️ (b) is not free:
  the sink is per-run `runContext`, which generated code has no handle on today.
- 🔴 The §C seam-category ruling at line 276 is **still** unchanged.
  > ✅ **STALE — ruled session 42, built session 46.** See the note at line 276.

## ✅ RULED 2026-08-16 (session 42)

**Redaction → (b): route `noodl_log` through the scrubbed sink.** A `noodl_log` block can print a
provisioned secret to stdout in the clear, where the `Log` node cannot. Rejected: **(a)** accept, and
**(c)** tooltip-only — a tooltip is not true for anyone who does not read it. ⚠️ **(b) is not free**;
price it before building.

**§C seam-category → DUAL-LIST, and narrow the fence.** The four object-shaped blocks are listed
under **`App Objects`** as well as Data, matching the existing `noodl_convert` precedent and the
findability complaint behind the whole fix. And `tests-unit/vfn-012/browser-blocks.spec.ts`'s
byte-identity assertion is **narrowed to what its own title claims** — *"changes no existing block
type id"* — which an addition does not do. ⚠️ Narrowing another phase's guard is only legitimate
because the guard is stricter than its stated claim; say so in the commit.

---

## §C dual-list — BUILT 2026-08-16 (session 46). The ruling above is discharged; not driven.

`App Objects` now carries seven entries. The four §C blocks are **interleaved, not appended**, each
computed-key block directly beneath the literal-key sibling it generalises:

| # | type | added? |
|---|---|---|
| 1 | `noodl_get_object` | VFN-012 |
| 2 | `noodl_get_object_property` | VFN-012 — literal key |
| 3 | **`noodl_get_object_property_expr`** | 🆕 computed key |
| 4 | `noodl_set_object_property` | VFN-012 — literal key |
| 5 | **`noodl_set_object_property_expr`** | 🆕 computed key |
| 6 | **`noodl_object_members`** | 🆕 |
| 7 | **`noodl_object_has_property`** | 🆕 |

**Order is the argument, so order is asserted** (`object-data.spec.ts`), not membership. A
`toContain` test passes just as happily on four rows appended at the bottom, which is the version
that does not answer *"I have an App Object, now what?"*.

⚠️ **`noodl_new_object` and the JSON pair are deliberately NOT dual-listed**, and a spec pins the
asymmetry with its reason so a later session does not read it as an oversight and "finish the job":
making an object out of nothing and crossing the JSON boundary are not things you reach for
*because you have an App Object*. All three remain under `Data`.

### 🔴 The fence, narrowed — and the four mutants that say it did not go slack

`browser-blocks.spec.ts:294`'s `toEqual` over each whole seam category became: **every id VFN-012 put
there is still present, still spelled the same, still in the same relative order** — `actual.filter(
type => baseline.includes(type))` compared to `baseline`. That is what *"changes no existing block
type id"* asserts. It permits exactly one new thing: an addition.

🔴 **A narrowed guard passing on the real toolbox is no evidence it would fail on a broken one**, so
each way it could have gone slack was driven against a mutant — applied, run, restored and `diff`ed
back inside a single shell call:

| mutant | fence | `object-data` | wanted |
|---|---|---|---|
| **M2 — rename `noodl_get_object_property` → the `_expr` twin** | 🔴 **FAILS** (1 of 19) | — | ✅ the rename is still caught |
| M4 — weaken the predicate to `baseline.filter(...)`, so order stops mattering | 🔴 **FAILS** (1 of 19) | — | ✅ the spec's own controls are load-bearing |
| M1 — drop the dual-listed `_expr` block from App Objects | ✅ passes | 🔴 FAILS (2 of 24) | ✅ each spec grades its own claim |
| M3 — append the four at the bottom instead of interleaving | ✅ passes | 🔴 FAILS (1 of 24) | ✅ order is graded, not just membership |

**M2 is the one that matters.** It is the plausible near-miss — a later change letting the computed
twin absorb the literal-key block — and it is the one that would break every saved program holding
`noodl_get_object_property`. The narrowed fence still turns red on it. M1 and M3 also confirm the two
specs are not redundant: the fence is indifferent to additions *by design*, and the adding phase's own
spec is what pins them.

### Gates

✅ **Taken this session, on the tree as it stood:**

| Gate | Reading |
|---|---|
| `noodl-editor` `test:main` (jest, **full**) | ✅ **225 suites / 3492 tests, 0 failed** — 22:21:24 → 22:22:48 |
| affected suites alone (`fix-004`, `vfn-012`, `lgc-009`) | ✅ 10 suites / 200 tests |
| `tsc --noEmit -p packages/noodl-editor/tsconfig.json` | ✅ 0 errors |
| `tsc --noEmit -p packages/noodl-editor/tsconfig.tests.json` | ✅ 0 errors |

⚠️ **Both `tsc` readings are read off empty output, not an exit code.**
✅ **The two suites s44 recorded as load-flaky** (`bld-004/reasoningChannel`, `aib-009/turnDeadline`)
**both passed in this full run.**

### 🔴 `test:ci` NOT taken — and the reason is a measurement, not the cost

The handover flagged this item as *"Blockly ⇒ `test:ci`"*. Two findings, and they point opposite ways:

1. ✅ **No jasmine spec reads this module.** `grep` over `packages/noodl-editor/tests/**/*.spec.*` for
   `BlocklyToolbox` / `buildToolbox` / `BlocklyEditor` returns **zero**; the only hits anywhere under
   `tests/` are webpack **bundle artifacts** (`index.bundle.js`, the lazy
   `…BlocklyWorkspace_tsx.index.bundle.js` chunk). So `test:ci` would grade this change only as *"the
   renderer bundle still builds"* — and this change adds no import and no new symbol, only a string
   array and comments, which both `tsc` projects already prove parses.
2. 🔴 **A reading taken now would not be of this change.** A **peer's editor stack was live
   throughout**: `scripts/start.ts` (pid 4024), **three** `webpack` processes, and an Electron editor
   (pid 6031, renderer on 9222) — attributed by PPID, not by the 26 `electron/dist` matches, which
   are mostly MCP servers. And peer source edits landed at **22:12:34 / 22:12:16 / 22:13:02**
   (`noodl-core-ui` code-editor files, `CodeFileDocument.tsx`) — uncommitted, and inside the ~40s
   webpack window a `test:ci` run would compile.

So a green `test:ci` here would have been a reading of **a peer's working tree**, which is the exact
mechanism §2 of the s45 handover describes. **The floor stays inherited: 2843 / 6 @ seed 39393,
witnessed 2026-08-16 21:53:37 — not re-measured this session.**

### ✅ DRIVEN 2026-08-16 (session 48) — seven rows, in order, drawn

Real editor, `fix004c-s48-drive` (a copy of `vfn64-drive`), Visual Function node `c6` in `/ErgCodes`,
`App Objects` clicked in the Logic Builder flyout.

✅ **Read from the FLYOUT WORKSPACE, which is the whole point** — `.blocklyToolboxFlyout
.blocklyBlock`, each block's type taken from its own class and its position from
`getBoundingClientRect()`, then **sorted by drawn `y`**. Every one of the seven has a non-zero height,
so this is *drawn*, not *declared* — the distinction s38 warned about (*"a block whose definition
failed to register would still be named in the toolbox and simply not draw"*).

| drawn order | type | y | height |
|---|---|---|---|
| 1 | `noodl_get_object` | 293 | 28 |
| 2 | `noodl_get_object_property` | 345 | 28 |
| 3 | **`noodl_get_object_property_expr`** | 397 | 36 |
| 4 | `noodl_set_object_property` | 457 | 60 |
| 5 | **`noodl_set_object_property_expr`** | 541 | 88 |
| 6 | **`noodl_object_members`** | 653 | 28 |
| 7 | **`noodl_object_has_property`** | 705 | 36 |

**Exactly the interleaving the build claimed** — each computed-key block directly beneath the
literal-key sibling it generalises. `object-data.spec.ts` asserts this order; the flyout draws it.

✅ **The `Data` / `App Objects` collision the toolbox comment worried about did not materialise**, as
s38 predicted from geometry: the rendered category list is `Inputs / Outputs · Signals · App
Variables · App Objects · App Arrays · App Config · Libraries & Browser · Logic · Loops · Math · Text
· Lists · Data · Debug · Variables · Functions · My Blocks` — `Data` is nine rows below `App
Objects`, in a different visual group.

⚠️ **Instrument notes, and one is a correction to this session's own first reading.**
`window.Blockly` **exists and has no `getMainWorkspace`**, so that route returns `'no workspace'`.
🔴 **That is not evidence the API route is dead** — s38's recipe reaches Blockly through the
**webpack module cache** (`req.c['blockly'].exports.getMainWorkspace()`), which is a *different
object* from the global. s48 tested only the global and fell back to the DOM; **the module-cache
route was not re-tested and is probably still the better instrument.**

The DOM route that did work: category labels are `.blocklyToolboxCategoryLabel` and flyout blocks are
`.blocklyToolboxFlyout .blocklyBlock`. ⚠️ **`blocklyTreeLabel` matches zero elements** and so reads
as an empty toolbox rather than as a wrong selector.

⚠️ **Opening the builder:** a **double-click on the Visual Function node on the canvas** opens it.
Node-graph nodes are painted on a canvas, so `cdp.js click` (selector-only) cannot reach them —
`cdp.js drag "x,y" "x,y"` can, and the property panel's **"Edit Logic Blocks"** button is a third
route.

---

## ✅ Redaction (b) — BUILT + MEASURED 2026-08-17 (session 51). The last FIX-004 build is closed.

**One new module, three call sites, four spellings of one list, and a gate that had never fired
before catching this.**

### The seam, and why it is not the one the ruling named

The ruling (s42) said *"route the block's generator at `console.log` through the same scrubbed
sink"*, which reads as an instruction to make `noodl_log` emit something other than `console.log`.
**That was rejected on population, not on mechanism.**

🔴 **`generatedCode` is a string saved in every existing project, and every one of those strings
already says `console.log`.** A new emission fixes programs saved from tomorrow and leaves every
program already on disk leaking until somebody happens to reopen it and nudge a block. The
census measured the alternative instead: `_compileFunction` builds the program with
`new Function(...)`, so **a parameter named `console` shadows the global inside the body** — and
both populations are fixed by one edit.

✅ **It also leaves the editor↔runtime contract alone.** `noodl_log` still generates
`console.log(value);`. Three specs pin that string
(`tests-unit/fix-004/blocks.spec.ts` ×3, `cloud-logic-builder-log.test.ts`) and **all of them stay
true rather than being rewritten to match a new build** — which is the difference between a change
that is compatible and a change that merely passes.

| file | what changed |
|---|---|
| **`noodl-runtime/.../logic-builder-console.ts`** 🆕 | `createBlockConsole(sink, nodeId)`. Returns the **real global `console`** when there is no sink. |
| `logic-builder.ts` | `console` as the **11th** compile parameter; sink read per run from `nodeScope.runContext`, the same two lines `log.ts:166` uses. |
| `logic-builder-probe.ts` | `evaluateFragment` — the second runtime spelling of the list. Its own comment required it: *"the same ten has to stay true."* |
| `BenchRunner.ts` | `LOGIC_BUILDER_PARAMETERS` — the bench is a **third** executor of block programs. |
| `vfn-011/drift-gate.spec.ts` | the **fourth** spelling: the gate's own literal. |

### 🔴 The finding: that parameter list has FOUR spellings, and the census found ONE

The census read `_compileFunction` and stopped. **The other three were found by a gate failing**, in
a package the change did not touch:

```
VFN-011 — the drift gate › compiles against the runtime's ten parameters, in the runtime's order
```

✅ **It caught it because it reads the arity off the runtime's own compile
(`compiled.length`), not off its source.** A gate that only compared its literal against the bench's
constant would have stayed green while the bench went on running block programs against a
ten-parameter contract. The bench is *"a second truth about what a program does"* in its own
module note; this is the first time that gate has been paid, and it paid.

⚠️ **The bench change fixes no user-visible bug** — a bench run has no sink, so a block's
`console.log` reached the real console either way. It keeps the two compile paths identical, which is
the property the gate exists to hold. Said plainly so a later session does not go looking for the
behaviour it fixed.

### ✅ The browser is not merely unchanged — it is the same object

`createBlockConsole` returns **`console` itself** when there is no sink, not a shim that forwards to
it. So there is no wrapper, no stringification, and objects still land in devtools inspectable rather
than as text. A spec asserts **identity** (`toBe(console)`), because a forwarding shim would pass
every behavioural test and still change what a developer sees. The browser half needed no drive for
the same reason: it is the same call it always was.

### ⚠️ What routing through the sink DOES change, stated because it is not nothing

On the cloud a block's line stops being a bare stdout write and becomes a `function.log` event —
levelled, timestamped, carrying `requestId` and the node id, scrubbed, recorded as a step in the
execution history. That is the point; the original finding was that the probe *"appears in NO JSON
line."* Two consequences follow that are **not** bugs:

- block lines now count against `MAX_LOG_LINES_PER_RUN`, as a `Log` node in a loop does;
- 🔴 **a block's `console.log` is now subject to the service log level.** At `NODEGX_LOG_LEVEL=silent`
  it produces nothing, where before it always printed. Consistent with the `Log` node and with the
  ruling's *"the same sink"*, and the production default is `info` (`ops/logger.ts:54`), so a real
  deployment prints it.

### The measurement: the row that recorded the leak now records its absence

`cloud-logic-builder-log.test.ts`'s secret row was deliberately written as a value comparison *"so a
change of answer shows the answer"*. It did exactly that, **through a real `BackendService` over real
HTTP with a real `secrets.json`**:

| | before | after |
|---|---|---|
| `a block-logged secret reaches stdout in the clear:` | **`true`** | ✅ **`false`** |

🔴 **The absence has a firing signal beside it.** `expect(everything()).toContain(REDACTED)` was added,
because "the secret is absent" also passes when the block printed nothing at all — which is precisely
what a broken `console` looks like. And the pre-existing control (log the secret's *length*, 29) still
passes, so the change is attributable to the routing rather than to the wire dying.

### 🔴 The instrument that had to be repaired, and it was the suite's own stated premise

The suite carried this sentence: *"a `console.log` from generated code does not go through the logger,
and leaving it silent means anything this suite sees on stdout came from the block program."* True
when written; **false the moment this change landed.** Left as it was, **all four presence assertions
failed** — for a reason with nothing to do with whether the block printed. A suite in that state
reports a working feature as broken.

⚠️ **And the obvious repair is a no-op.** `logger.configure({ level: 'info' })` does nothing while
`setup-logging.js`'s `silent` is in the environment, because `ops/logger.ts:78` reads
`envLogLevel() || options.level` — **the env var beats the option.** The env var is deleted first.
Getting that backwards yields a green-looking call, a silent logger, and the conclusion that the
feature is broken.

### The specs, and the four mutants

`noodl-runtime/test/fix-004-block-console.test.ts`, **13 tests** — destination selection, argument
folding, and three rows through the **real node**. Scrubbing is graded in the backend, where the
scrubber lives; nothing in `noodl-runtime` can see a secret value.

| mutant | result | what it proves |
|---|---|---|
| **M1 — drop the `console` parameter** (revert the fix) | 🔴 runtime **3 of 13**; backend **`…in the clear: true`** | the fix is what closes the leak, by name |
| **M2 — `console` inserted BEFORE `__p`**: the positional near-miss | 🔴 **4 of 13**, incl. *"neither list has drifted"* | order is graded, not just membership |
| M3 — no-sink returns a forwarding shim | 🔴 **1 of 13** | the identity claim is load-bearing |
| M4 — `describeArgument` uses `String()` not JSON | 🔴 **1 of 13** | object folding is graded |

✅ **Every mutant run reported a real test count** (13, 6) — no `Tests: 0 total`, so none of them
compiled-but-graded-nothing. ⚠️ **M1's and M2's first `APPLIED?` echo was broken by zsh globbing and
printed `0`**; both were re-run with the check fixed and the parameter list printed, because *"the
edit changed the results"* is not evidence it was **the** edit intended.

🔴 **M1's control matters as much as M1.** Under M1 the backend's *derived-value* row still passes, so
the failure is attributable to the reverted routing and not to the service having broken.

### One test bug worth recording, because it looked exactly like a product bug

The `Inputs["secret"]` row first read `message: "undefined"`. **An input port on this node exists
because something asked for it** — in a real graph a *connection*, via `registerInputIfNeeded`. A
test that only calls `setInputValue` on an undeclared port has its value **dropped silently**, and the
symptom is indistinguishable from a console that lost its argument. Setting the workspace is *not*
enough; the port has to be registered.

### Gates

✅ **Taken this session, on the tree as it stood:**

| Gate | Reading |
|---|---|
| `noodl-runtime` jest (**full**) | ✅ **137 suites / 2510 passed**, 1 suite + 13 tests skipped |
| `nodegx-backend` jest (**full**) | ✅ **100 suites / 1085 passed** |
| `noodl-editor` `test:main` (**full**) | ✅ **229 of 230 suites / 3557 tests**; the one failure is `bld-004/reasoningChannel`, **8/8 passing alone** — the load flake s44 recorded |
| `noodl-viewer-react` jest | ✅ **71 suites / 910 tests**, exit 0 |
| `cloud-runtime` jest | ✅ 7 suites / 172 tests |
| root `npm run typecheck` (the PR gate) | ✅ exit **0**, zero `error TS` |
| `lint:ci` ratchet | ✅ exit 0, **876** against a 3916 baseline — s50's exact count, no new debt |

⚠️ **`vfn-011/drift-gate.spec.ts` FAILED first and passes now** (13/13, including its three negative
controls). That failure is the load-bearing gate reading of this session, not a nuisance.

🔴 **Two exit codes were read wrong before being read right, both the documented way.** `TYPECHECK_EXIT=0`
after a pipe reports `tail`; and a later `npm run typecheck` exited **1 with zero `error TS`** purely
because the shell's cwd had persisted into a package directory two calls earlier. **Third session
running for the cwd trap.**

### 🔴 `test:ci` NOT taken — the reason is a measurement, and it changed while being taken

First check: a peer's **full editor stack was live** — `scripts/start.ts` (pid 17319), **three**
webpack processes, an Electron editor (pid 20580) on 9222. Six minutes later **all of it was gone**,
which would have looked like a clear run.

🔴 **But the tree was the real answer, not the process table.** A second `git status` immediately
before the run showed peers had landed **uncommitted source edits in `noodl-core-ui`** — six modified
files plus two new (`Launcher/*`, `views/Learning.*`, a new FIX-024) — and `noodl-mcp/src/catalog.ts`
at **20:39:24**, *35 seconds* before the run would have started. `noodl-core-ui` is bundled into the
renderer, so the reading would have been of a peer's working tree.

⚠️ **The one thing no gate taken here can see** is that the editor's **webpack** resolves
`BenchRunner.ts`'s new import of `@noodl/runtime/src/nodes/std-library/logic-builder-console`. The
argument it is safe is an existing working case rather than a guess: that file **already** statically
imports `@noodl/runtime/src/blockrun` and `@noodl/runtime/src/nodes/std-library/logic-builder-io` —
same specifier prefix, and the second from the same directory. It is a static ES import, not a
`require.resolve`. **Still the honest gap: a bundled build was not run.**

⚠️ **`packages/noodl-editor/tests/test-results.json` was deleted** in preparation for the run that was
then declined. It was stale; it is a build artifact and regenerates. Nobody's reading was consumed.
