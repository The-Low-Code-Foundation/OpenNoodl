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
