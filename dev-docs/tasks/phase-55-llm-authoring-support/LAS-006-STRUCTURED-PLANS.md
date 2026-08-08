# LAS-006 — Structured plans: the tree as a form, not an essay

**Status:** 📋 open · **Track 2 (surface)** · §3 depends on LAS-001

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

## Register

| # | Finding | State |
|---|---|---|
| — | | |
