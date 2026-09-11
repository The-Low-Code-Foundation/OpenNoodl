# CMP-006 — The patterns the agent could not read

**Scoped:** 2026-09-11 (session 8), by promoting phase 85 README §7's second known gap, owner NONE.
**Status: AC1 ✅ AC2 ✅ AC3 ✅ — CLOSED s11.**

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

### AC3 ✅ CLOSED s11 — the default carries `antiPatterns`, and the objection was a budget on the wrong population

**s8 wrote: "Do not close this from the armchair, in either direction… a session that overturns this
should change that assertion deliberately and say what it measured."** This is that change, and what
it measured is **traffic**, not a replay.

#### The measurement that made the replay unnecessary

🔴 **`detail: "full"` has been called ONCE.** Counted across every transcript on the authoring
machine — all project directories under `~/.claude/projects`, 25 files containing calls — and every
one of the calls post-dates `detail` shipping (`c05310b5d`, 2026-07-25, DEBT-009), so this is not an
artefact of a young parameter:

| shape | calls | what it returns |
|---|---|---|
| default summary | **26** | summary, no `patterns`, no `antiPatterns` |
| `ports: [...]` | **18** | per-port detail only — **not even the summary prose** |
| `detail: "full"` | **1** | both arrays |
| | **45 total** | **44 of 45 returned neither** |

`ports` short-circuits *above* the summary path (`catalogTools.ts:95`), which is why it carries
neither field either. AC1 and AC2 put **203 authored warnings** onto a route taken **once, ever**.

⚠️ This is the third field carried onto the summary for this exact reason — `providedBy` (CN-009)
and `export` (FLD-013) both argued in their own doc comments that *"a field that only survives
`detail: "full"` is one the overwhelming majority of calls never see"*. **It is the first time that
claim was counted instead of asserted.**

#### 🔴 The cost that held the line was measured on the catalog, not on the traffic

AC3's argument against was *"a median 36% of a summary payload, and up to 151%"*. That figure is
**unweighted across all 176 types** — a budget measured on a fixture, so it is a budget on the
fixture. Re-measured against the **105 type-requests that actually happened**, through
`getNodeTypeSummary` itself rather than a reconstruction of it:

| | all 176 types (AC3's figure) | the 105 real type-requests |
|---|---|---|
| median | 36% | **17%** (weighted by call frequency) |
| max | 151% (`noodl.cloud.request`) | **59%** (`net.noodl.GlobalStore`) |
| whole traffic | — | **+5.8%** (13,405 B added to 229,601 B) |

The most-asked types are the cheap ones, because a long port list is what makes a summary long:
`Group` ×8 at **2%**, `net.noodl.controls.button` ×5 at **3%**, `net.noodl.controls.textinput` ×4 at
**3%**.

⚠️ **A reconstruction of the payload got this wrong by 30%** — hand-rolling `getNodeTypeSummary`'s
shape gave +7.6% against the real function's +5.8%, because the reconstruction missed the examples
and the real port-type labels. The number quoted above is the function's own output.

🔴 **And AWP-005 §2's anti-correlation does not transfer.** DeepSeek read 4 types and shipped;
Kimi read 21 and had authored nothing by turn 34 — that is a finding about **how many types an agent
reads**, not about how big one summary is. Carrying it across to a 5.8% payload increase is what
kept this closed, and it is [[a-budget-measured-on-a-fixture-is-a-budget-on-the-fixture]] wearing a
second hat.

#### 🔴 What this does NOT establish

**The benefit.** Whether a graph built against this default actually avoids the anti-patterns it now
names is **unmeasured**, and still wants the replay this AC described. The numbers killed the
*objection*, not the question. Two further limits, stated rather than buried:

- All 45 calls **predate AC2's routing description** (last call 2026-09-10T12:28Z; AC2 shipped
  2026-09-11 07:25), so this traffic cannot say whether that description has since pulled anyone to
  `full`.
- The population is development sessions on one machine, not clean cold authoring runs.

#### What shipped

- `getNodeTypeSummary` emits `antiPatterns` when the type has them — **unconditional on purpose**. A
  rule emitting them only for cheap types would reintroduce silence exactly where the warnings are
  densest: **Data and Cloud carry 127 of the 203 entries; Visual carries 14.**
- `patterns` stays off the default and its negative assertion is still live. AC3 asked about
  `antiPatterns`; `patterns` is the larger half (259 entries over 130 types) and has not been priced.
- The tool description moved `antiPatterns` into the default sentence and out of the `full` list —
  an agent paying ~11k tokens for something it already received is the defect one level up. The
  resident surface went **8272 → 8275, still 5 under the 8280 budget**, not bumped.

**Controls, four arms, 49 of 49 tests running in every arm, sources restored md5-identical:**

| arm | change | result |
|---|---|---|
| A | drop the `antiPatterns` copy from `getNodeTypeSummary` | 1 red — the AC3 equality |
| B | revert the description to naming `antiPatterns` only under `full` | 1 red — the routing spec's **order** assertion |
| C | leak `patterns` onto the default as well | 1 red — the surviving negative |
| D | 🔴 sample two types the corpus gives **no** `antiPatterns` | 1 red — the arming check |

**Arm D is the arm that mattered.** Without its `toBeGreaterThan(0)` on the corpus, the equality
assertion is `undefined === undefined` and the spec passes on nothing — a rule reading zero in both
arms grades nothing. A `toContain` on both field names was likewise not enough for arm B: it passed
before this change and would pass again with the two names swapped back, so the spec asserts their
**order** around the "enough to author from" boundary instead.

#### 🔴 The gate this work tripped had 290 bytes of headroom

`tools.test.ts`'s *"summary mode: compact shape, always small"* asserted a round **`30_000`** bytes
for a worst-case 8-type call. The real figure had already reached **29,710 B** — so the ceiling had
**290 bytes** left, and the next person to enrich anything in the catalog would have owned the red
without having done anything wrong. `antiPatterns` added **909 B (3.1%)** and tipped it to 30,638.

✅ **The literal was not bumped; it was replaced by the constraint it was standing in for.**
`FULL_DETAIL_BYTE_BUDGET` (60,000) is the size at which **full** mode starts degrading its tail, and
summary mode has no degradation step — so the assertion now reads *"summary mode stays safe WITHOUT
the mechanism full mode needs"*, which is the property actually worth guarding. It prints its own
margin on a passing run (CN-006's trick, the one AC2 credited with catching its 5-token headroom):
`[summary] 30638 bytes for 8 heavy types — 29362 under the 60000 full-detail budget`.

## 4. Readings, 2026-09-11 (session 11), at `741e4e3fb` + AC3

- `npx jest` in `packages/noodl-mcp`: **7 failed / 1557 passed / 1564 total**, `EXIT=1`.
  ✅ **1564 = s10's 1564 exactly** — AC3 replaced its predecessor spec 1:1 rather than adding one,
  so nothing was added or lost. 🔴 **4 of the 7 are load flakes, not the floor**: re-run in
  isolation, `def003PageTitleDrive` + `projectOwnsBackend` are **19/19, EXIT=0**. The floor is the
  same three, in the same two `*Drive` suites (`def018-def020-layout-drive`,
  `sbr009ThemeEditorDrive`). `projectOwnsBackend` flaking under full parallel load is s9's reading,
  re-confirmed; `def003PageTitleDrive` joins it, and both provision or drive real resources.
  ⚠️ The first isolation attempt reported `Tests: 0 total` from the repo root — that is the babel
  runner, not this package's. `cd packages/noodl-mcp` first.
- `npx tsc --noEmit -p packages/noodl-mcp`: **0 lines, EXIT=0.**
- `toolDisclosure.test.ts`: `[surface] **8275** tokens / 20 resident tools — **5 under** the 8280
  budget`. AC2 left it at 8272 with 8 under; AC3's description edit cost **3**, and was funded by
  moving `antiPatterns` out of the `full` list rather than by bumping the gate.
- `tools.test.ts`: `[summary] **30638** bytes for 8 heavy types — **29362 under** the 60000
  full-detail budget` — a margin line that did not exist before, on a ceiling that had 290 bytes.
- Four control arms, **49 of 49 tests running in every arm**, sources restored **md5-identical**.

## 4b. Readings, 2026-09-11 (session 8), at `8898a7171`

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
