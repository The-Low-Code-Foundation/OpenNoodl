# LAS-006 — Structured plans: the tree as a form, not an essay

**Status:** ✅ **done** 2026-08-08 (session 4) · **Track 2 (surface)** · §3 depended on LAS-001

## The evidence

The plan step **worked cold on both models** — haiku's very first `create_plan` was a correct
9-operation decomposition, straight from the pushed doctrine. What failed is what the plan cannot
say: operations are `{kind, target, intent}` where `intent` is prose
([planTools.ts:280-286](../../../packages/noodl-mcp/src/tools/planTools.ts#L280)). Haiku's intents
never mentioned interfaces, so no downstream turn built `Component Inputs`, so every card died
(F2). The planning doctrine *asks* for interfaces in intents ("each section's intent states its
Component Inputs/Outputs" — `DECOMPOSITION_PLANNING`); nothing checks, and a weak model fills
forms far better than it follows essays (audit §D3).

## Build

### 1. Structured fields on plan operations

`create_plan` operations gain optional fields, validated when present:

```
inputs:  [{ name, type?, description? }]     // the component's Component Inputs
outputs: [{ name, type?, description? }]     // signals + values it reports upward
repeats: { source: 'static'|'query'|'variable'|'array', rowFields: [string] }
instantiates: [string]                        // component targets this one will place
```

The plan model is shared with the editor
(`authoring/plan`, imported by [planTools.ts:33-42](../../../packages/noodl-mcp/src/tools/planTools.ts#L33)) —
extend it **there**, one model, both clients. Optional at the schema: old callers keep working.

### 2. Teeth at plan validation

- A `create` targeting a component-ish path (`Components/`, `Cards/`, `Sections/` — derive the
  prefix list from what the corpus actually uses, don't guess) that declares neither
  inputs/outputs nor `repeats` → **advisory in the create_plan response** (not a rejection):
  "an interface stated vaguely is an interface that will not line up".
- A plan whose only operation is a single page → the static critic's one-liner: "plan the
  sections as create operations; the page instantiates them". (This is README candidate 3's
  cheap form; the LLM critic stays dead per the audit verdict.)
- `repeats` present → the row fields become the expected item-component inputs; say so in the
  response so the authoring turns inherit the contract.

### 3. The plan as a contract (needs LAS-001)

At `stage_plan_operation`: a staged component whose operation declared `inputs` must expose
exactly those `Component Inputs` — missing/renamed ones are rejected with the diff. LAS-001's
interface index does the reading; this task only compares declared-vs-exposed. Extra undeclared
inputs: allowed (the plan is a floor, not a ceiling) — record the decision.

### 4. The instructions lead with the order

Rewrite the authoring paragraph of the server `instructions`
([server.ts:41](../../../packages/noodl-mcp/src/server.ts#L41)) to state the order as the
workflow: **decide the component tree (create_plan, with interfaces and repeats) → author leaves →
sections → page**, and name `Static Data` and `Component Inputs` by name — the two primitives
nobody finds, now confirmed twice (haiku found neither; sonnet needed 75 exploration calls to find
both). The bag-of-nodes door stays open (settled: primitive-only, no ceremony for a two-node fix),
but `create_component` of a **page-typed** component when no plan exists gets one advisory line in
its response pointing at the plan door. Advisory, not refusal — measure whether it is enough in
LAS-011 before considering anything harder.

## Acceptance

- A cold mid-tier replay (haiku, the STOREFRONT-BRIEF protocol) produces plan operations carrying
  `inputs`/`repeats`; the ProductCard staged against it either exposes the declared inputs or is
  rejected with the diff naming them.
- Old-shape plans (no structured fields) create and stage exactly as before — pinned by spec.
- The single-page-op plan draws the critic line; jest pins both advisories.
- Editor planning loop still green (shared model change — run the editor jest suite and compare
  counts).

## What shipped

| § | Where | What |
|---|---|---|
| 1 | `authoring/plan.ts` | `inputs`/`outputs`/`repeats`/`instantiates` on `PlanOperation`, all optional; `PLAN_STRUCTURE_DESCRIPTIONS` written once and rendered into **both** clients' schemas (editor JSON Schema, MCP zod). `renderPlanContext` puts the declared interface under the intent, so the operation that *places* a card reads its input names verbatim |
| 2 | `planAdvisories()` | non-blocking advice on an accepted plan, returned by `create_plan` and put to the editor's planner once |
| 3 | `planInterfaceContract()` + `validateStaged` | a staged component must expose the inputs its operation promised; extra inputs allowed |
| 4 | `server.ts` instructions, `create_component` | the order stated as the workflow, `Static Data` and `Component Inputs` named; one advisory line on a page written with no plan |

**Gates at close:** `noodl-mcp` jest **24 suites / 250 specs** (22/230 at session-3 close); `noodl-editor`
jest **77 / 1048** (76/1029); `typecheck:editor` clean; all three catalog gates green.

## Register

| # | Finding | State |
|---|---|---|
| F25 | **The §2 prefix allowlist was wrong and the corpus said so.** The task file proposed keying the interface advisory on `Components/`\|`Cards/`\|`Sections/`. Measured over both corpora (`measurements/scan-component-paths.js`: 107 legacy + 12 v2, 613 components), those folders hold **16 of the 256** interface-bearing components; the other 240 live in "UI Components", "Product Details Page", "Search", "Checkout" and ~30 other ad-hoc folders, and 27 sit at the project root with no folder at all. A prefix gate would have been silent on **94%** of its own population | ✅ **CLOSED** — re-keyed on *shape*: **0 of 51** pages declare an input, **178 of 236 (75%)** instantiated non-pages do. Predicate is `looksLikePageComponent`, the existing single derivation, not a fourth copy |
| F26 | `instantiates` is checked, not just recorded: a declared target that neither exists nor is created by the plan is a plan-time **error**, the same class as an `update` of a nonexistent component. Decision recorded: the staged check is asymmetric — a candidate may instantiate more than it declared (the plan is a floor), but everything it declares must resolve | ✅ decided and specced |
| F27 | **The editor's advisory turn could have eaten an accepted plan.** `PlanningSession` returns `declined` on prose-without-a-tool-call; adding an advisory turn that invites "say so in prose if it is right" would have routed a valid plan into that branch. Found by reading the loop before writing it, not by a failing spec | ✅ the accepted plan is held and returned from every exit — prose, exhausted submits, and turn budget |
| F28 | One existing jasmine spec's chat script ran dry on the new advisory turn (its repaired plan is a single page create, which now draws the one-page advisory). **Fixture corrected, not gate weakened** — the script repeats its last submission, which is the documented path through an advisory, and now also asserts the advisory arrived | ✅ corrected in `authoring-plan.test.ts` |
