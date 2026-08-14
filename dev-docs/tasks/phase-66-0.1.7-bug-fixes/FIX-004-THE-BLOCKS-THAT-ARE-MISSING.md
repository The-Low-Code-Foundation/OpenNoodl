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
