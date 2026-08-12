# LGC-001 — Three ways to compute, and the picker explains none of them

**Status:** 🟡 **built 2026-08-12, live verification deferred** · ⭐ **the flagship** ·
**Track: the seam** · from the 2026-08-09 first-steps video

> **Built in worktree `lgc-001-lane`** — `e756a975` (a pre-existing docs staleness, on its own),
> `e3a7ddd0` (§1–§4), `56614ffc` (the specs). §1, §2, §3 and §4 are implemented; the four decisions
> the spec left open were taken as defaults and are recorded in the Register with the alternative
> beside each, one line to flip. **The acceptance's "drive it, do not infer it" was not done** — see
> [Deferred verification](#deferred-verification) at the end of this file.

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

> ✅ **Done 2026-08-12 — but the ranking sentence above was half right, and the half it missed is
> the whole of §1's ordering (L4).** Tag matches do rank below name matches. They were then ordered
> among themselves by *label length*, which answers **Function** first — the exact inverse of what
> this section requires. `withLibraryOrder` in `NodePicker.search.ts` now orders any non-name match
> by its position in `nodelibraryexport.ts`'s curated list, so the answer order is set by §4's
> reordering and nothing in the picker names the triad.
>
> `function` still leads with the Function node, and now returns Visual Function too — by the
> *label*, at offset 7, so no `function` tag was added. Fifteen terms × three nodes are graded in
> `noodl-runtime/test/lgc-001-logic-triad.test.ts`, with a control asserting the tags answer nothing
> they should not.

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

> ✅ **Taken 2026-08-12: option (a).** See Decisions D1 — the alternative is recorded there and is a
> one-string swap. The shipped copy lives in `NodePicker.chooser.ts`, is rendered *above* the
> catalog prose in the preview column, and every card carries at least one worked example
> (Visual Function's is a block sequence rather than a line of code).

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

> ✅ **Done 2026-08-12. The path stayed `docs-site/docs/nodes/custom-code/logic-builder.md`, and no
> redirect was added, because the choice does not exist** — `generate-node-docs.js` builds every
> page path as `slugify(node.category)/slugify(node.typeName)`, and both of those are frozen. The
> rename could not have moved the file. Only the page's `title:` front-matter changed, plus its
> alphabetical position in `nodes/index.md` and the link text in `javascript2.md`'s related-nodes
> line. **194 generated files / 175 nodes before and after**, counted, and `docs:nodes:check` is
> green. Register **L5**.

## §4 — A category that is a choice, not a bucket

`CustomCode` is an implementation word. In the rail it should read **Logic**, holding the three, in
picker order Expression → Visual Function → Function.

If the rail supports a one-line group header, it says: *"Three ways to compute. Pick by how much you
want to type."* If it does not, this is out of scope — do not build a header system for one string.

> ✅ **Done 2026-08-12, with two things left open.** The label lives in `nodelibraryexport.ts`, not on
> the node definitions (**L6**): `category: 'CustomCode'` is the *catalog* field and the docs-site
> path's first segment, and neither moved. The rail entry now reads `Logic` and lists
> Expression → Visual Function → Function, which is not decoration — §1's tag ranking reads that
> order (**L4**). The sentence has nowhere to go: the rail has no header affordance and none was
> built.
>
> 🔴 **`Logic` collides with an existing sub-category of the same name (L7), and the category still
> holds `CSS Definition` (L8).** Both need Richard; both are one line. See Decisions D3.

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
| L1 | The brief's *"one input signal and output signal"* for the Function node is **false in both directions** — unlimited signal inputs via `Node.Signals`, unlimited signal outputs via `Outputs.X()` | ✅ **taken: option (a)**, see Decisions |
| L2 | Typing any arithmetic word into the picker returns **zero results**, and this is the exact failure the video recorded | ✅ fixed, §1 |
| L3 | `PickerItemKind` already has `'action'` and the preview column already exists — the picker needs content, not architecture | ✅ verified 2026-08-09 |
| L4 | ⚠️ **§1 needed one line of picker arithmetic after all.** Every tag match sits at `RANK_TAG`, so the tie-break decided the order — and it was *shortest label first*, which answers **Function** (8 chars) ahead of Expression (10) and Visual Function (15). The exact inverse of what §1 requires, and invisible to any spec that only asserted "all three are returned". `withLibraryOrder` now ranks a non-name match by its position in `nodelibraryexport.ts`'s curated list | ✅ fixed |
| L5 | ⚠️ **The docs-site path was never derived from the label.** `generate-node-docs.js` builds it as `slugify(category)/slugify(typeName)`, both frozen — so §3's "keep the path with a redirect, or move it" was a choice that does not exist. The page stays at `custom-code/logic-builder.md` and **no redirect is needed**; only its `title:` changed. 175/175 pages before and after, counted | ✅ verified 2026-08-12 |
| L6 | ⚠️ **The rail label was never the string §4 names.** `category: 'CustomCode'` on the node definitions is the *catalog* field (and the docs-site path's first segment); the rail reads `nodeIndex.coreNodes[].name` from `nodelibraryexport.ts`, which said `'Custom Code'`. Only the latter changed | ✅ verified 2026-08-12 |
| L7 | 🔴 **`Logic` now collides with an existing sub-category.** `Logic & Utilities` has a sub-category called `Logic` (Boolean To String, Switch, And, Or, Condition, Inverter), which is the *group heading* in browse mode. The picker therefore shows a rail entry and an unrelated group heading with the same word. One-line fix either way — revert the rail label, or rename the sub-category (`Booleans & Branching` is accurate for its six) | ⚠️ **needs Richard** |
| L8 | 🔴 **The renamed category still holds `CSS Definition`.** §4 says "Logic … holding the three"; it holds five — `Javascript2` (labelled *Script*) is defensible, a CSS node under "Logic" is not. Moving it is a **taxonomy** change (which rail entry a node lives under), not a display string, so it was left alone per the standing rule. Pinned by a spec so it fails loudly when someone resolves it | ⚠️ **needs Richard** |
| L9 | ⚠️ **`docs:nodes:check` was already red on `cline-dev` @ `83ff84ba`** — `group`, `Button` and `Icon` stale since an example was rewritten and the generator never re-run. Nothing to do with this task; fixed in its own commit (`e756a975`) so it can be reverted separately | ✅ fixed, not ours |
| L10 | 🔴 **The acceptance's "drive it, do not infer it" was not performed.** No editor was launched in this lane. Three of the four suites are unit-level and were run; the jasmine one was not. See [Deferred verification](#deferred-verification) | 🔴 **open** |

## Decisions taken 2026-08-12 (Richard unavailable — each is one line to flip)

| # | Decision | What shipped | The alternative, and where the line is |
|---|---|---|---|
| D1 | **§2 Function copy** | **Option (a) — state the capability.** `NodePicker.chooser.ts`, the `JavaScriptFunction` entry: *"Runs when you send it a signal, and can fire several when it is done."* | Option (b), advice phrased as advice: *"Runs when you send it a signal. Keep it to one signal in and one out — a Function with five entry points is a component wearing a disguise."* Swap the `signals` string. ⚠️ Two specs in `tests-unit/lgc-001/chooserCopy.test.ts` assert the word `several` and forbid five one-in/one-out phrasings; option (b) needs the first relaxed and **must keep the second**. Rationale for (a): this card is the only place in the product the behaviour is written down, so under-documenting it is the NDA-017 failure shape exactly |
| D2 | **§3 docs-site path** | **Kept `logic-builder.md`, and no redirect was added** — because none is possible or needed. See L5: the path is `slugify(category)/slugify(typeName)` and both are frozen, so the rename could not have moved the file. ALPHA-006's 175/175 is intact and was counted before and after | There is no alternative to flip. Moving the page would mean renaming the *type id*, which phase 59 does not do |
| D3 | **§4 rail label** | **Renamed** — `nodelibraryexport.ts`, `name: 'Custom Code'` → `'Logic'`, plus the `description` beside it. Confirmed display-only first (L6): not in any saved project, not in `node-catalog.json`, not the docs-site path segment | Revert that one string. ⚠️ It is a merge key for module libraries (`NodeLibraryImporter.mergeInByName`) and appears in the generated `cloud-node-library.json`, which was regenerated. **Two consequences are open — L7 and L8.** No group-header system was built; the spec forbids it and the rail has no such affordance |
| D4 | **§3 type id** | **Frozen and proven.** `name: 'Logic Builder'` is unchanged everywhere; `displayNodeName` alone moved to `'Visual Function'`. Proof: a spec asserting the id, a grep across the repo, and the regenerated catalog diff showing `displayName` changed with `typeName` untouched | Not a decision — a standing constraint of the phase |

**Two further display strings followed the label**, both user-facing and neither the id:
`getInspectInfo()` (what the canvas hover reads) and the `unchanged` port description
(*"…what a freshly dropped Visual Function looks like"*).

## What was built, and where

| § | Change | File |
|---|---|---|
| §1 | Fifteen intercept terms, one shared list | `noodl-runtime/src/nodes/std-library/logic-search-tags.ts` (new) |
| §1 | The three nodes take them | `expression.ts:134` · `simplejavascript.ts:133` · `logic-builder.ts:129` |
| §1 | Non-name matches ranked by library order (**L4**) | `NodePicker.search.ts:149` `withLibraryOrder`, `:231` `FlatNode.ordinal`, `:372` the call |
| §2 | The comparative note for the three | `NodePicker.chooser.ts` (new) |
| §2 | Rendered above the reference prose | `NodePickerPreview.tsx:46,66` · `.module.scss` `.Chooser*` |
| §3 | Label only; id frozen and commented as such | `logic-builder.ts:102` (frozen) · `:114` (label) · `:475` (`getInspectInfo`) |
| §4 | Rail label, description, and the picker order | `nodelibraryexport.ts:816` |
| — | Regenerated: `node-catalog.json`, `node-catalog-enriched.json`, `cloud-node-library.json`, `docs-site/docs/nodes/**` | |

### What was verified, and how

- `npx tsc` clean on `noodl-runtime` and `noodl-editor` (and `tsconfig.tests.json`); the two
  pre-existing runtime errors and the 419 pre-existing `tsconfig.tests-main.json` errors were
  measured before and after and are **identical**, not inherited on faith.
- All five artifact gates re-run green: `catalog:check`, `catalog:merge:check --require-coverage`,
  `docs:nodes:check` (194 files / 175 nodes), `cloud-library:check`, `catalog:groups:check`.
- `noodl-runtime` jest: **2336 → 2362** specs, 0 failed. Editor `tests-unit`: **1658 → 1672**,
  0 failed. Both baselines measured in this worktree by removing the new files, not assumed.
- Each runnable suite was **proven red first**: removing `multiply` from the shared list, moving the
  type id, and reordering the category each fail exactly the row that names them.
- The freeze was grepped as well as specced — `name: 'Logic Builder'` appears unchanged in the
  runtime definition, both catalogs, the enrichment file, the example and the docs-site path.

## Deferred verification

⚠️ **Nothing below was done.** This work was built in a worktree with the editor deliberately out of
reach (a sibling session held the dev stack, and `lerna exec` resolves to the primary checkout), so
the acceptance's *"Drive it, do not infer it"* is outstanding. Treat the six items below as **the
task, not a formality**: a passing unit spec cannot tell you the preview column rendered, and this
repo has already banked the lesson that *"rendered clean" can mean nothing was drawn at all*.

**Before starting:** `npm run dev:stop -- --list` (the no-`--` spelling kills the stack), then open a
**copy** of a real project, not the example — a dev launch rewrites the example project.

1. **The jasmine suite has never run.** `packages/noodl-editor/tests/nodepicker/NodePickerSearch.test.ts`
   gained **8** specs under `NodePicker buildResults — the logic triad (LGC-001 §1)`. It is appended
   to a file the barrel already exports, so it will run — but it has only been typechecked.
   **Pass:** `npm run test:ci` prints a `Jasmine:` line with the same failure *names* as the
   6-failure baseline, and a spec total **8** higher than before. ⚠️ Only the `Jasmine:` line counts,
   and compare the **totals** to the primary checkout's, not the failure count.

   🔴 **Corrected 2026-08-12: this said 9, and the code yields 8.** The describe holds five `it(`
   calls, one of which is inside `for (const term of ['math','multiply','round','percent'])` — so
   4 looped + 4 standalone = **8**. Expecting +9 and seeing +8 reads as a spec that vanished, which
   is the one failure mode the surrounding warning exists to catch. ✅ The barrel chain *is* intact
   (`tests/index.ts:29` → `tests/nodepicker/index.ts` → `NodePickerSearch.test`), so it does run.

2. **`multiply` in the picker.** Open the node picker over a canvas, type `multiply`.
   **Pass:** three rows, in the order **Expression → Visual Function → Function**, each card's second
   line reading `tag · multiply`. **Fail** if Function leads (that is L4 regressing) or if any row is
   missing. Repeat for `add`, `round`, `sum`, `percent`, `math`, `formula`, `equation`.

3. **`function` still belongs to the Function node.** Type `function`.
   **Pass:** `Function` is the first row and `Visual Function` also appears, with the match
   highlighted at offset 7 of its label. **Fail** if Visual Function leads.

4. **The preview column, screenshotted — three times.** This is the item the acceptance singles out.
   Cursor each of Expression, Visual Function and Function in turn and **capture the preview column
   for each**. The picker is a popup over the canvas; per the CDP register a `.click()`-opened select
   never closes and it is one click per `eval`, so drive the cursor with `↑`/`↓` rather than clicking
   cards.
   **Pass, per row:** a headline, at least one code chip, and the execution sentence with the
   category-tinted left rule, **all visible without scrolling the pane** — they sit above the
   reference prose, which is long. On the Function row the sentence must read *"…and can fire several
   when it is done"*; a pane showing only the catalog prose means `getChooserNote` missed and the
   note rendered as nothing at all, silently.
   ⚠️ Below 760 px panel width the preview column is dropped entirely
   (`NODE_PICKER_PREVIEW_MIN_WIDTH`) — check the window is wide enough before reading a blank as a
   defect.

5. **The rail.** Confirm the rail reads **Logic** and not **Custom Code**, and look at what L7
   describes: `Logic & Utilities` still has a group heading called `Logic`. Decide L7 and L8 while
   looking at it — both are one line.

6. **The freeze, end to end.** Open a project saved **before** this change that contains a Logic
   Builder node. **Pass:** the node loads, is labelled *Visual Function* on the canvas, and its wires
   survive. **Fail loudly** if the graph opens with wires but no nodes — that is the signature of
   something throwing during load, and it would mean the id did move somewhere this lane did not
   grep.
