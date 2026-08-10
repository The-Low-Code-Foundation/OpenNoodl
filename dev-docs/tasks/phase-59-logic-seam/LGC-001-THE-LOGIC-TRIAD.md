# LGC-001 — Three ways to compute, and the picker explains none of them

**Status:** 📋 open · ⭐ **the flagship** · **Track: the seam** · from the 2026-08-09 first-steps video

## The evidence

A test user said, on camera, that he wanted to build math visually and to build his functions
visually. **Both exist.** He found neither. The node picker is where he would have looked, and this
is what it does today:

- typing `add`, `multiply`, `round`, `sum` or `%` returns **nothing**, because no math nodes exist;
- `Expression`, `Function` and `Logic Builder` all sit in one flat `CustomCode` category
  ([`expression.ts:121`](../../../packages/noodl-runtime/src/nodes/std-library/expression.ts),
  [`simplejavascript.ts:84`](../../../packages/noodl-runtime/src/nodes/std-library/simplejavascript.ts),
  [`logic-builder.ts:96`](../../../packages/noodl-runtime/src/nodes/std-library/logic-builder.ts))
  with **no statement anywhere of which to pick or why**;
- `Logic Builder` gives no hint that it contains a Blockly workspace with a full math palette.

**The user did not lack a feature. He lacked a sentence.**

## What the picker already gives us

Read in source; all four are shipped and none needs building.

| Capability | Where | Use |
|---|---|---|
| `PickerItemKind = 'node' \| 'action'` — results can be **actions**, not only nodes | [`NodePicker.search.ts:35`](../../../packages/noodl-editor/src/editor/src/views/NodePicker/NodePicker.search.ts) | §1's intercept rows |
| a **docs preview column**, dropped only below 760 px | [`NodePicker.constants.ts:32`](../../../packages/noodl-editor/src/editor/src/views/NodePicker/NodePicker.constants.ts) `NODE_PICKER_PREVIEW_MIN_WIDTH` | where the examples live |
| search matches **tags and port names**, and reports *why* a non-obvious row matched (`MatchReason`, `'tag' \| 'port'`) | [`NodePicker.search.ts`](../../../packages/noodl-editor/src/editor/src/views/NodePicker/NodePicker.search.ts) | `multiply` → Expression, with "matched tag: multiply" on the card |
| category tints already include `'logic'` and `'javascript'` | `PickerTint`, same file | the triad reads as one family |

So this task is mostly **content plus one new result kind**, not picker surgery.

## §1 — Answer the arithmetic terms

Add search tags to all three nodes so that `add`, `subtract`, `multiply`, `divide`, `round`, `ceil`,
`floor`, `sum`, `average`, `percent`, `%`, `math`, `calculate`, `formula`, `equation` all return the
triad rather than nothing.

Ranking, deliberately: **Expression first** for arithmetic terms. It is the cheapest correct answer
for `price * quantity` and it is the one Richard actually uses. Visual Function second. Function
third — it is the wrong tool for a one-liner and should not lead.

⚠️ **The tags must not make the triad noise on unrelated searches.** `MatchReason` exists precisely
so a tag match is explained on the card; a tag match must still rank below a name match, which the
existing ranking already does ("name matches ordered by where the term appears"). Verify with
`function` — the Function node must still lead its own name.

## §2 — The sentence, and the decision it needs

The preview column shows one of these when the row is cursored. Copy, to be ruled on:

> **Expression** — one line of maths or logic over a few inputs.
> `price * quantity` · `total > 100` · `Math.ceil(subtotal / 5)`
> No signal — it recalculates whenever an input changes.

> **Function** — real JavaScript, when a line is not enough.
> Many inputs and outputs, `async`/`await`, calls out to the network.
> Runs when you send it a signal.

> **Visual Function** — the same jobs, built from blocks instead of typed.
> Drag maths, conditions and loops together; its inputs and outputs appear as you build.
> Start here if you would rather not type code.

⚠️ **Decision needed from Richard before this copy ships.** The brief asked for the Function card to
say *"only one input signal and output signal"*. **That is not true of the node**, verified in
source:

- every `Node.Signals.X = function(){}` becomes a signal input —
  [`javascriptnodeparser.js:202-210`](../../../packages/noodl-runtime/src/javascriptnodeparser.js);
- every `Outputs.Done()` and `Outputs["Done"]()` in the script mints a signal output —
  [`javascriptnodeparser.js:353-366`](../../../packages/noodl-runtime/src/javascriptnodeparser.js);
- both are unlimited, and both are *additional* to the built-in `Run` in and
  `Success` / `Failure` / `Done` out
  ([`simplejavascript.ts:192-235`](../../../packages/noodl-runtime/src/nodes/std-library/simplejavascript.ts)).

The picker card would be the **only place in the product this behaviour is written down**, which is
exactly how NDA-017 happened — a port description that described a trap as if it were a feature, and
was wrong, and was the sole source. Two acceptable resolutions:

- **(a) state the capability:** "Runs when you send it a signal, and can fire several when it's
  done."
- **(b) state the advice as advice:** "Runs when you send it a signal. Keep it to one signal in and
  one out — a Function with five entry points is a component wearing a disguise."

Either is fine. **Asserting a limit the node does not have is not**, and neither is saying nothing.

## §3 — Rename `Logic Builder` → `Visual Function`

`displayNodeName` **only**. [`logic-builder.ts:93-96`](../../../packages/noodl-runtime/src/nodes/std-library/logic-builder.ts)
holds both; `name: 'Logic Builder'` is the type id written into every saved project, `node-catalog.json`,
`node-catalog-enriched.json`, `docs/node-catalog/enrichment/`, the example
`code-logic-builder-greeting.json` and `docs-site/docs/nodes/custom-code/logic-builder.md`. **Freeze
the id. Change the label.**

Why this name and not another:

- it makes the triad read as a progression — **Expression** (a line) → **Function** (code) →
  **Visual Function** (blocks);
- it makes searching `function` return **both** the Function node and the visual one, which is the
  teaching moment the video shows us missing;
- it answers the user's literal sentence — *"I'd really like to build my functions visually"* — with
  a node of that name, which is the cheapest possible fix for the failure that started this phase.

⚠️ **Not** "Function" — Richard ruled that out; the JavaScript Function node keeps that name.

Everything user-facing follows the label: picker card, canvas node title, docs-site page title and
sidebar, catalog `displayName`. The docs-site file **path** may stay `logic-builder.md` with a
redirect, or move — either, but say which, because ALPHA-006 pins 175/175 node pages.

## §4 — A category that is a choice, not a bucket

`CustomCode` is an implementation word. In the rail it should read **Logic**, holding the three, in
picker order Expression → Visual Function → Function.

If the rail supports a one-line group header, it says: *"Three ways to compute. Pick by how much you
want to type."* If it does not, this is out of scope — do not build a header system for one string.

## Acceptance

- `add`, `multiply`, `round`, `sum`, `percent`, `math`, `formula`, `equation` each return all three
  logic nodes, Expression ranked first, each card carrying its `MatchReason`.
- `function` still ranks the Function node first, and now also returns Visual Function.
- Cursoring any of the three shows its sentence and at least one worked example in the preview column.
- The Function card's signal sentence matches option (a) or (b) from §2, and **Richard has picked
  which**. Record the choice in the Register below.
- `Logic Builder` reads `Visual Function` in the picker, on the canvas, and on the docs site — and
  **`name: 'Logic Builder'` is unchanged**, proven by opening a project saved before the change.
- ⚠️ **Drive it, do not infer it.** The picker is a popup over the canvas; per the CDP register a
  `.click()`-opened select never closes and one click per `eval` is the rule. Screenshot the preview
  column for each of the three rows — a passing spec that never rendered the column proves nothing.

## Register

| # | Finding | State |
|---|---|---|
| L1 | The brief's *"one input signal and output signal"* for the Function node is **false in both directions** — unlimited signal inputs via `Node.Signals`, unlimited signal outputs via `Outputs.X()` | ⚠️ **decision open**, §2 |
| L2 | Typing any arithmetic word into the picker returns **zero results**, and this is the exact failure the video recorded | 📋 open, §1 |
| L3 | `PickerItemKind` already has `'action'` and the preview column already exists — the picker needs content, not architecture | ✅ verified 2026-08-09 |
