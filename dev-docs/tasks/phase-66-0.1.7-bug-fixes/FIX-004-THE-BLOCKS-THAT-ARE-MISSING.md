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
