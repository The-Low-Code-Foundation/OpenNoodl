# Phase 54 — the tasks (DSG: pages that look designed)

**Created:** 2026-08-10, out of [README.md](README.md) — **written after most of the work had already
shipped.** Three of this phase's six deliverables landed on 2026-08-08 with no task file behind them,
inside four hours, and phase 55 opened on the result the same afternoon. These files record what
landed with the evidence, and spec what did not.

**Every claim about existing code in these files was read in source on 2026-08-10.** Two rows of the
README's register are wrong today and both corrections are at the bottom of this file. Anything
marked ⚠️ **unverified** must be confirmed before the task depending on it is worked.

## The one-line premise

There was **no design knowledge anywhere in the authoring stack** — measured, not asserted — so the
model was handed a paint set, nineteen visual node types and no worked example of what a page looks
like, and did the only thing available: stacked Groups in a column.

## Where the phase actually stands

| Task | File | One line | State |
|---|---|---|---|
| DSG-001 | [DSG-001-THE-REFERENCE-BUILD.md](DSG-001-THE-REFERENCE-BUILD.md) | build a real storefront and measure the DOM, because the deliverable is distilled from it | ✅ **done** — 5 components, 132 nodes, measured |
| DSG-002 | [DSG-002-A-DOCTRINE-BOTH-CLIENTS-READ.md](DSG-002-A-DOCTRINE-BOTH-CLIENTS-READ.md) | one module, three consumers, the shape `decomposition.ts` already proved | ✅ **done** `2ef44128` |
| DSG-003 | [DSG-003-THE-COMPOSITION-RECIPES.md](DSG-003-THE-COMPOSITION-RECIPES.md) | arrangements in the example corpus, not only wirings | 🟠 **6 of 10** — five named recipes unbuilt |
| DSG-004 ⭐ | [DSG-004-THE-GATES-BEHIND-THE-DOCTRINE.md](DSG-004-THE-GATES-BEHIND-THE-DOCTRINE.md) | **the load-bearing one** — a doctrine nothing enforces is advice, and advice gets skipped | 🟠 **2 rules** of six; four filed |
| DSG-005 | [DSG-005-THE-VOCABULARY-TEACHES-ARRANGEMENTS.md](DSG-005-THE-VOCABULARY-TEACHES-ARRANGEMENTS.md) | `get_style_vocabulary` still hands over atoms only — the one untouched deliverable | 📋 **open** |
| DSG-006 | [DSG-006-THE-COLD-BENCHMARK.md](DSG-006-THE-COLD-BENCHMARK.md) | the only honest proof: replay cold, judge side by side | 🟠 **run in phase 55** — the design half was never scored |
| DSG-007 | [DSG-007-A-PROJECT-THAT-CAN-OWN-ITS-BACKEND.md](DSG-007-A-PROJECT-THAT-CAN-OWN-ITS-BACKEND.md) | register F2, still true and now visible on disk as two backends of the same name | 🔴 **open** |

Three tracks in the README map onto these as: **A** = DSG-001; **B** = DSG-002 (doctrine),
DSG-003 (recipes), DSG-005 (vocabulary); **C** = DSG-004 (gates), DSG-006 (benchmark). DSG-007 is
register work the phase acquired while building A.

## Suggested order, and why

1. **DSG-004 first**, and it is the only one that is urgent. The phase's own evidence is that prose
   loses: the author of the design doctrine broke it in the reference build **three commits later**
   (`ef945bdc`), and the audit measured all three replay models ignoring a warning that fired
   correctly on every one of them. Two rules exist; the four in §2 are where the remaining value is.
2. **DSG-005 next**, because it is the cheapest untouched thing in the phase and the only seam that
   reaches both clients *without* costing prompt tokens on every turn — the vocabulary is fetched on
   demand, the doctrine is prepended always.
3. **DSG-003's five recipes** whenever a build produces one honestly. ⚠️ **Do not author a recipe
   from taste** — every shipped one was lifted from a measured DOM, and the three that were not
   measured for interface direction shipped the exact defect they were teaching against (F23).
4. **DSG-006 last**, and only once DSG-004 and DSG-005 have landed, because a benchmark run before
   the thing it measures is a cost with no information in it. ⚠️ It costs real money — see the
   standing constraints.
5. **DSG-007 independently**, at any point. It blocks nothing here and will keep costing an hour a
   phase until it is fixed.

## Standing constraints

- **NodeGX stays primitive-only.** No opinionated composite node library (Container/Section/Card/
  Hero). Richard, 2026-08-08, settled — invest in primitive defaults, machine-checkable gates and a
  render→critique loop. Every task here obeys it: this phase ships **knowledge and gates, never node
  types**.
- **One substrate, two clients.** Anything added reaches the in-editor loop *and* `noodl-mcp` from a
  single export, the way [`decomposition.ts`](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/prompts/decomposition.ts)
  and [`design.ts`](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/prompts/design.ts)
  do. A second dialect is the BCN-003 mistake.
- ⚠️ **An example that does not validate is worse than no example.** `npm run catalog:examples`
  rejects anything not error- **and** warning-free
  ([`validate-examples.ts:5-9`](../../../scripts/validate-examples.ts)). This is a gate, not a
  linting suggestion.
- ⚠️ **A recipe is a graph an agent will imitate verbatim, defects included.** All 11 `Component
  Inputs` ports across the first three recipes were declared `plug: "input"` — backwards — so 12
  connections drawn out of them were dropped as unhealthy, in the corpus that exists to teach the
  right shape (phase 55 F23, fixed by LAS-007). The example format now declares `ports[].plug`
  explicitly ([`validate-examples.ts:51-56`](../../../scripts/validate-examples.ts)) *because* of it.
- ⚠️ **Doctrine text is Richard's**, and
  [`dev-docs/best-practices/05-WORKED-EXAMPLE-STOREFRONT.md`](../../best-practices/05-WORKED-EXAMPLE-STOREFRONT.md)
  is his architecture. Encode it; do not rewrite it from model taste.
- ⚠️ **A benchmark drive spends money.** The editor has a real Anthropic provider configured; phase
  55's matrix cost $5.10–$7.86 per replay. Never start one without saying so first.
- **Calibrate every new rule on the corpus before trusting it.** The AIB-001 habit, and the reason
  `repeated-sibling-subtree` sits at three copies rather than the doctrine's two: at a floor of two
  it fired on icon+label pairs. A false positive teaches an agent to distrust the whole diagnostic
  set.
- **Verify the consequence, not the mechanism.** A rendered screenshot is the evidence; a green
  validator is not. Both instruments that measured this phase lied at least once — see the README's
  F4 and F5, where the *renderer* produced the exact signature of "the styling was discarded".

## What is deliberately not here

- **A composite node library.** The single largest idea available — ship `Section`, `Card`, `Hero`
  as node types — is settled against, above. It would make good pages easy and would make NodeGX a
  different product; the primitive set plus recipes keeps the ceiling where it is.
- **Design-time rendering inside the editor.** §11 of the doctrine tells the agent to look at the
  page, and the thing it looks with is a **script** (`scripts/devtools/render-from-disk.js`) plus
  phase 55's LAS-005 render report. Making that routine and cheap enough to run inside every build
  is phase 55's audit question, not a task here.
- **A "make it pretty" pass on the editor's own chrome.** Phases 23/24/50 own that. This phase is
  entirely about what the *authored project* looks like.
- **Retrieval of recipes at the point of rejection.** Shipped in phase 55 as LAS-007 (the recipe
  rides the rejection), which is the mechanism that makes DSG-003's corpus reachable under pressure.
  Nothing here duplicates it.

## Register — corrections to the README, verified 2026-08-10

**Grep this table before believing a README row is still true** — registers outlive their fixes.

| # | Row | State on 2026-08-10 |
|---|---|---|
| F2 | "worked around by hand for `ecommerce-example` (wrote `id`, stamped `projectIds`)" | ⚠️ **Half of the workaround is gone.** `nodegx.project.json` has **no `id`** today (checked; `Puppy test 3` has none either), while `~/.noodl/backends/backend_msk1w1ujnckt4/config.json` still carries `projectIds: ["ecommerce-example"]` — the *project name*, which is not what the matcher reads. The defect is unchanged and now has a second witness: **two `Stock Cupboard Backend`s, ports 8583 and 8584**, each owning a different id. See [DSG-007](DSG-007-A-PROJECT-THAT-CAN-OWN-ITS-BACKEND.md), which also records the mitigation the README does not mention. |
| F3 | "`Lint` and `Test (editor)` still red — not investigated here" | 🔴 **Still red, and now unmeasured.** The most recent CI run on `cline-dev` is `31245059056` (2026-08-08 06:56Z): `Lint`, `Test (editor)` and `Node catalog freshness` all failed. That run **predates F1's fix** (`d2b5a7f4`, 07:37Z), and there has been no run since — `origin/cline-dev` is **140 commits behind local**. Every phase 55–58 fix is invisible to CI. |
| F5 | "`stage_plan_operation` reports a warning COUNT" — marked fixed by LAS-002 | ✅ Confirmed still fixed. |
| F1, F4 | catalog regeneration; the disk renderer's font and token bugs | ✅ Confirmed still fixed; F4's fallback block still names `TokenResolver.generateCss` as the thing to keep in step. |
</content>
</invoke>
