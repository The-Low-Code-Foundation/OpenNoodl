# CMP-006 — The patterns the agent could not read

**Scoped:** 2026-09-11 (session 8), by promoting phase 85 README §7's second known gap, owner NONE.
**Status: AC1 ✅ AC2 ✅ · AC3 OPEN (needs a measurement, not a decision).**

## 1. The person sentence

**An agent choosing a node is told the shapes to reach for and the shapes to avoid — the same
sentences a person gets in the editor's "Watch out for" panel.**

## 2. The defect, re-derived from the code before it was believed

§7 filed this as a 🔴 gap. Re-measured at `8898a7171` on 2026-09-11, and it was true exactly as
written:

`catalog.ts`'s `getNodeTypeDetail` copied `summary`, `description`, `whenToUse`, `runtimeBehavior`,
`relatedNodes` and `dynamicPorts` out of the enrichment **and stopped**. So both fields reached
exactly one reader — the EDITOR's node-docs panel
(`noodl-editor/src/editor/src/utils/nodeDocs.ts:161`, *"Watch out for"*), which is a person.

🔴 **And one thing §7 did not say, which explains the whole shape: `NodeEnrichment` in `catalog.ts`
never DECLARED `antiPatterns` at all.** `patterns` was declared and not copied; `antiPatterns` was
not in the interface, so no copy of it could have typechecked. The field existed in the JSON
(`noodl-types/src/node-catalog-enriched.d.ts:18`) and in the editor's own reader, and the MCP's view
of the same table simply had a hole in it. That is why this is not a one-line oversight: the server's
type said the field was not there.

**What was being withheld, counted on the shipped corpus** (`node-catalog-enriched.json`, 176 types):

| field | types carrying it | entries | median chars | p90 | max |
|---|---|---|---|---|---|
| `patterns` | **130** | 259 | 208 | 423 | 1124 |
| `antiPatterns` | **113** | 203 | 168 | 485 | 802 |

107 types carry both. ~59,500 characters of authored guidance, ~14.9k tokens across the whole
catalog, none of it reachable by the agent doing the authoring.

This is §2's shape for the fifth time in the phase: **the doctrine existed and nobody measured
whether it arrived.**

## 3. Acceptance criteria

### AC1 ✅ — `detail: "full"` relays both arrays, verbatim, from the corpus

`getNodeTypeDetail` now copies `patterns` and `antiPatterns`, and `NodeEnrichment` declares the
second one. Armed by `packages/noodl-mcp/tests/cmp006PatternsOnTheWire.test.ts`, five specs.

🔴 **The expectations are DERIVED FROM THE ARTEFACT, not written as literals.** The equality test
reads `node-catalog-enriched.json` and asserts the response *equals* the corpus arrays, per type. A
spec that hard-coded the prose would pass when the wire is right and also when the wire is right for
a stale corpus — and the phase has already had one literal move twice in two sessions (AC2's
percentage, 10 → 21 → 26). Exact per-field counts are deliberately **not** pinned; coverage is a
floor (`>= 100` / `>= 90`) and equality is per type.

⚠️ **One type per call, and the comment in the spec says why.** The five sampled types are ~100 KB
of full detail against `catalogTools.ts`'s 60 KB byte budget (DEBT-009), which degrades the tail to
**summaries** in-band — and a summary carries neither field by design. Batched, this spec would have
failed on its own construction and read as a broken relay. `Group` alone is ~47.8 KB.

The sibling spec at `phase85Doctrine.test.ts:131` reads the corpus *instead of* the response and says
in its own comment that it must not be quietly "fixed" by repointing it at a tool call. **It is
untouched**; this file's spec is the over-the-wire twin, not a rewrite of it.

**Controls, four arms, 5 of 5 tests running in every arm, sources restored md5-identical:**

| arm | change | result |
|---|---|---|
| A | strip both copies from `getNodeTypeDetail` | 2 red — equality fails on `patterns` (line 120) |
| B | strip **only** the `antiPatterns` copy | 2 red — equality fails on `antiPatterns` (line 121) |
| C | drop the two names from the tool description | 1 red — the routing spec |
| D | 🔴 **leak both fields into the DEFAULT summary** | 1 red — the negative assertion is live |

Arms A and B red the same two tests; the *failure messages* are what distinguish them, which is why
the content assertion names each half separately.

### AC2 ✅ — the description routes an agent there, and the resident surface got CHEAPER

A field nobody is told about is a field nobody reads — the whole shape of this defect. `summary` is
the default, so emitting the arrays on `full` changes nothing unless `full`'s description says what
it now buys.

🔴 **And the resident tool surface had FIVE TOKENS of headroom.** Measured: 8275 against
`toolDisclosure.test.ts`'s 8280 budget. The first wording — *"and the authored `patterns` to reach
for plus the `antiPatterns` to avoid"* — cost 19 tokens and took the surface to **8294, 14 over**.
The gate was NOT bumped; the text was funded:

- the prose paraphrases became the **real response keys** (`whenToUse, runtimeBehavior,
  relatedNodes, patterns, antiPatterns`) — shorter than describing them in words, and it tells an
  agent which keys to expect;
- *"the examples demonstrating the type"* → *"demonstrating it"*;
- the `detail` enum's *"every port as one line with its type and enum values"* was a near-verbatim
  duplicate of the main description's own sentence, paid for twice in one tool — collapsed to *"one
  line per port, as above"*.

**Final: 8272 tokens / 20 resident tools, 8 under budget — 3 tokens CHEAPER than before the work.**
Net-negative, not net-neutral.

### AC3 🔴 OPEN — should the DEFAULT carry `antiPatterns`? This needs a measurement

**Do not close this from the armchair, in either direction.** The argument for is real: `summary` is
the default, AWP-005 §2 measured that doc volume was *anti*-correlated with building (DeepSeek read
4 types and shipped a 12-component storefront; Kimi read 21 and had authored nothing by turn 34), so
a fix that lands only on `full` reaches an agent that mostly never calls `full` — which would make
this fix the very defect it closes, one level up.

The argument against is also measured, and it is why AC1 stopped at `full`:

- `antiPatterns` alone is a **median 36%** of a summary payload, and **up to 151%** — on
  `noodl.cloud.request`, 528 chars of anti-pattern against ~349 of summary. It roughly **doubles**
  the summary of a small logic node.
- On a big visual node it is free: 0.8% on `Group`, 1.2% on `net.noodl.controls.button`. The cost is
  inversely proportional to port count, so it is most expensive exactly where summaries are cheapest
  and most numerous.

**What would settle it:** a phase-55-style replay — the same brief against a server with and without
`antiPatterns` on the default — graded on whether the built graph avoids the named anti-patterns, not
on token count. Until that exists, `detail: "full"` carries them and the negative assertion in
arm D holds the line **on purpose**. A session that overturns this should change that assertion
deliberately and say what it measured.

## 4. Readings, 2026-09-11, at `8898a7171` + this work

- `npx jest` in `packages/noodl-mcp`: **3 failed / 1537 passed / 1540 total**, `EXIT=1`. The three
  reds are in the two pre-existing `*Drive` suites (`def018-def020-layout-drive`,
  `sbr009ThemeEditorDrive`), neither of which references anything here.
  ✅ **The delta reconciles: 1540 − 1535 = 5**, all in the new `cmp006PatternsOnTheWire.test.ts`.
  This is s7's floor exactly, re-taken.
- `npx tsc --noEmit -p packages/noodl-mcp`: **0 lines, EXIT=0.**
- `toolDisclosure.test.ts`: **18/18**, `[surface] 8272 tokens / 20 resident tools — 8 under`.
- `dist/noodl-mcp.cjs` rebuilt at **07:25:30**; carries all four anchor strings, including s7's
  *"A repeated row publishes to the repeater"* and s6's `comp-variant-badge-states`.

## 5. 🔴 What this cost to find, and the trap worth keeping

**The gate that caught this was a budget gate on a surface nobody was measuring per-change.**
`toolDisclosure.test.ts` prints its own margin on a passing run — a line CN-006 added for exactly
this reason — and that line is the only thing that turned "my description is 60 characters longer"
into "the resident surface has five tokens left". Without it the failure would have read as an
unrelated red in a suite about tool disclosure.

⚠️ **A description edit is a product change with a price.** Every word in a resident tool's
description is re-sent on every turn of every session. The headroom is now 8 tokens; the next field
that wants a sentence has to fund it the same way.
