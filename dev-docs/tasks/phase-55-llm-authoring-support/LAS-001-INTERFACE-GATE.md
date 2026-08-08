# LAS-001 — The interface gate

**Status:** 📋 open · **Track 1 (gates)** · ⭐ highest-value task in the phase · fixes audit **F2**
**Blocks:** LAS-006 §3 (plan-as-contract), LAS-007 §1 (attach the recipe to this rejection), LAS-011

## The defect, measured

Haiku's cold replay (AUDIT-SESSION-1 §A) produced the architecturally ideal shape — ProductCard
instantiated ×4 with per-instance parameters (`image`, `name`, `description`, `price`…) — and
every card rendered as literal "Text" placeholders, because ProductCard exposes **no
`Component Inputs` node**. The parameters landed on ports that do not exist. `validate:project`:
**0 errors.** Nothing in the validator, the write gate, or the plan gate looks at instance
parameters against the target component's actual interface.

The evidence is preserved: `NodeGX test projects/phase55-replay-haiku`, components
`Components/ProductCard` + `Components/FeaturedProducts`, and
[measurements/haiku-full.png](measurements/haiku-full.png).

This is AIB-010's family (a name-typed parameter never checked for resolving), applied to the
single most load-bearing mechanism in the architecture doctrine: the component interface is what
makes "one card, four instances" work at all.

## Mechanism to verify before building (in this order)

1. **How an instance node is recognised.** A node instantiating a project component uses the
   component's legacyName as its node type (`/Components/ProductCard`). The validator's normalized
   project model (`normalizeV2Component`, `buildComponentRefs` — re-exported through
   `packages/noodl-mcp/src/editor-deps.ts`) already resolves component refs; find where
   `unresolvedComponentRef` does its lookup and hang the new rule beside it.
2. **Where a component's interface lives.** On its `Component Inputs` / `Component Outputs`
   *nodes* — the ports must be lifted to component level (the disk renderer had to reverse-engineer
   exactly this; see the header of `scripts/devtools/render-from-disk.js`). Determine how ports are
   declared on those nodes in the v2 format (the `ports` array on the node? `parameters`? read a
   real component — `phase55-replay-sonnet`'s `Cards/Product Card` has a correct one).
3. **The built-in ports every instance carries** regardless of interface (`mounted` at minimum —
   enumerate from source, likely the component-instance node factory in the runtime or the
   catalog's component-ref handling; do NOT hardcode a guessed list).
4. **Existing rule anatomy:** `validation/rules/repeatedSiblingSubtree.ts` +
   `validation/rules/index.ts` registration + its spec, as the template.

## Build

One new rule file, `validation/rules/instanceParameterInterface.ts` (name negotiable), two checks
over one shared interface index:

1. **`InstanceUnknownParameter`** (working name): a parameter set on a component-instance node
   whose name matches neither the target component's declared inputs nor the built-in instance
   ports. Diagnostic message carries: the parameter, the component, and **the component's actual
   input list** (or "this component declares no inputs") — the "did you mean" shape that measured
   a 100% self-correction rate in the replays. Location: the instance node, the offending
   parameter.
2. **`InterfacelessVariance`**: ≥2 instances of the same component (project-wide within the
   validated scope) whose parameter sets differ, where the component exposes no
   `Component Inputs` at all → one diagnostic on the *component* ("N instances vary but nothing
   can receive the variance — add Component Inputs whose names match the parameters").

Both halves must see **the plan overlay**: a component staged in the same plan counts as existing
with its staged interface (the `overlayProject` path in
[planTools.ts:125](../../../packages/noodl-mcp/src/tools/planTools.ts#L125) already builds this
view — the rule must read interfaces from it, not from disk).

**Severity decision, in this order:**

1. Run the rule over the corpus (`npm run validate:project` against the ~95 projects in
   `NodeGX test projects/` — the `repeated-sibling-subtree` calibration precedent: 17/95 hits →
   warning). Record the counts in the register below.
2. Expected outcome: `InstanceUnknownParameter` joins `AUTHORED_BLOCKING_WARNINGS`
   ([authoredCandidate.ts:149](../../../packages/noodl-editor/src/editor/src/validation/authoredCandidate.ts#L149))
   — the `PageWithoutPageNode` precedent, including its lesson: **fixtures teaching the broken
   shape get corrected, not the gate weakened.** Sweep the AI-suite fixtures for instance
   parameters with no interface before promoting.
3. `InterfacelessVariance` likely stays warning-severity project-wide; decide authored-blocking
   from the corpus numbers, not from enthusiasm.

## Acceptance

- Re-stage haiku's exact `ProductCard` + `FeaturedProducts` candidates → rejected, and the
  diagnostic names `image`/`name`/`price` and says the component declares no inputs.
- Sonnet's `Cards/Product Card` (a *correct* interface) passes untouched.
- Jest specs: both halves, the plan-overlay case (instance of a sibling staged create), the
  built-in-port allowance, and the update-baseline case (pre-existing violations in an `update`
  stay editable — the `validateStaged` baseline-subtraction contract in
  [planTools.ts:200](../../../packages/noodl-mcp/src/tools/planTools.ts#L200)).
- Corpus run documented. All standard gates green (see TASKS.md §Gates).

## Register

| # | Finding | State |
|---|---|---|
| — | | |
