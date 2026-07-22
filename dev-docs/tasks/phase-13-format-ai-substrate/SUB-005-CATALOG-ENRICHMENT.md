# SUB-005: Catalog Enrichment — Semantics, Examples, Compatibility

## Metadata

| Field | Value |
|-------|-------|
| **ID** | SUB-005 |
| **Phase** | Phase 13 — Format & AI Substrate (Revival Track A) |
| **Priority** | 🟠 High |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | 3–4 weeks |
| **Prerequisites** | SUB-004 |
| **Branch** | `task/sub-005-catalog-enrichment` |
| **Recommended executor** | 🔵 **Fable 5** — this is authoring the semantics of a visual language: what each node *means*, which connections are legitimate, and how to describe both to a reader with no context. High judgement, low mechanical content. Sonnet can draft individual node descriptions once the framework and voice are established. |

## Objective

Turn the structural catalog into a semantic one: per-node descriptions and usage examples, connection-compatibility rules, and explicit modelling of runtime-only behaviour, so that a reader with no prior Noodl knowledge can author correct graphs from the catalog alone.

## Background

SUB-004 answers "what nodes and ports exist." It does not answer "what does this node do, when would I use it, and what may I legitimately connect to what." Those are the questions that separate an AI producing valid-but-nonsensical graphs from one producing graphs a human would have written.

The distinction matters more here than in a conventional API surface, because a node graph encodes intent in its wiring. Knowing that a Condition node has a `Result` output does not tell you that it emits a signal rather than a value, that it is typically wired to a gate rather than to a text field, or that the idiomatic pattern for a conditional UI is different from the idiomatic pattern for conditional logic. Those conventions currently live in the heads of experienced Noodl users, in tutorials, and in the shape of existing projects — nowhere machine-readable.

There is also a hard technical component. Some behaviour genuinely cannot be described statically: Function nodes execute arbitrary user code and discover their outputs at runtime; Expression nodes derive dependencies by parsing expression text; several nodes generate ports from configuration. `dev-docs/reference/LEARNINGS.md` records a feature that failed because it assumed port compatibility could be resolved statically. This task must encode as much as is honestly knowable and mark the rest as runtime-determined — not paper over it.

## Current State

- SUB-004's catalog: types, ports, parameters, defaults, dynamic flags, visual/logic classification. Structurally complete, semantically thin.
- Prose knowledge exists but is scattered and human-oriented: `dev-docs/reference/NODE-PATTERNS.md`, `dev-docs/reference/LEARNINGS*.md`, node source comments, and the in-editor node picker's descriptions.
- Connection compatibility is enforced at runtime by type coercion rules in the runtime engine, not declared anywhere consumable.
- No usage examples exist in machine-readable form.

## Desired State

The catalog gains, per node type:

- A **description** of what the node does and when to use it, written for a reader with no Noodl background
- One or more **usage examples** as real graph fragments (v2 JSON), not prose — an AI learns far more from a correct wiring than from a paragraph
- **Port semantics**: signal vs. value, edge-triggered vs. level, what a given input actually causes
- **Connection compatibility**: which output types may legitimately feed which input types, including coercions the runtime performs
- **Common patterns and anti-patterns** where they exist ("Repeater with a Query Records source" as a pattern; "chaining twenty Expression nodes" as an anti-pattern)
- **Runtime-determined behaviour** described precisely for dynamic nodes

## Scope

### In Scope
- [ ] Descriptions for every node type in the catalog
- [ ] Machine-readable usage examples as v2 graph fragments, verified valid against SUB-006's validator
- [ ] Connection-compatibility matrix derived from the runtime's actual coercion rules
- [ ] Explicit runtime-determined behaviour notes for dynamic-port nodes
- [ ] Pattern/anti-pattern library for the most-used node combinations
- [ ] Enrichment stored so that regenerating the structural catalog (SUB-004) does not destroy it

### Out of Scope
- The structural catalog itself (SUB-004)
- Validation logic (SUB-006)
- End-user documentation site (the catalog is a machine artifact; a docs site is a separate concern)
- Translating descriptions into other languages

## Technical Approach

### Storage design

The central design constraint: SUB-004's catalog is **generated** and will be regenerated on every build, while this enrichment is **authored** and must survive. Keep them in separate files keyed by node type, merged at build time into the published catalog. A node present in the generated catalog with no enrichment entry should produce a warning, so new nodes cannot ship undocumented.

### New Files to Create

| File | Purpose |
|------|---------|
| `docs/node-catalog/enrichment/<node-type>.json` (or a single keyed file) | Authored semantics per node type |
| `docs/node-catalog/examples/` | Verified v2 graph fragments used as examples |
| `docs/node-catalog/compatibility.json` | Connection-compatibility matrix |
| `docs/node-catalog/patterns.md` | Pattern / anti-pattern library |
| `scripts/merge-node-catalog.ts` | Merge generated + authored into the published catalog |

## Implementation Steps

1. **Derive compatibility from the runtime, not from intuition.** Read the engine's type-coercion behaviour and encode what it actually permits. Where compatibility is decided at runtime, say so rather than guessing.
2. **Establish the description framework and voice** on ten representative nodes first — one visual, one control, one logic, one data, one event, one navigation, one dynamic (Function), and a few awkward cases. Review these before scaling.
3. **Author examples as real graph fragments**, each validated by SUB-006's validator (or by loading them in the editor if SUB-006 has not landed). An example that does not load is worse than no example.
4. **Scale to the full node set.** This is the bulk of the time. With the framework fixed, individual entries can be drafted quickly and reviewed in batches.
5. **Pattern library** — mine real projects and the fixture corpus from SUB-002 for the combinations that actually occur, rather than inventing idealised ones.
6. **Merge tooling and warnings** for undocumented nodes.
7. **Re-run SUB-004's LLM acceptance test** with the enriched catalog and compare quality against the structural-only baseline. That delta is the measure of this task's success.

## Testing Plan

- Every example fragment validates and loads in the editor.
- Compatibility matrix agrees with runtime behaviour on a sampled set of connection pairs (test both permitted and rejected pairs).
- Coverage check: every node type in the generated catalog has an enrichment entry.
- **Comparative acceptance test:** an LLM given the enriched catalog authors a small feature (e.g. a list page backed by a query) and its output is measurably better than with the structural catalog alone — fewer invalid ports, more idiomatic wiring. Record both results.

## Success Criteria

- [ ] Every node type has a description and at least one validated example
- [ ] Compatibility matrix derived from runtime behaviour and spot-verified
- [ ] Dynamic nodes' runtime-determined behaviour explicitly described
- [ ] Pattern/anti-pattern library covers the common combinations found in real projects
- [ ] Regenerating the structural catalog preserves all enrichment; undocumented nodes warn
- [ ] Comparative LLM acceptance test shows clear improvement over SUB-004 alone

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Descriptions become a large, quickly-stale prose corpus | Tie coverage to CI warnings; keep entries short and factual; prefer examples over prose since examples are testable |
| Compatibility rules are asserted rather than derived, and are subtly wrong | Derive from the runtime's coercion code and verify by test against real connection pairs |
| Effort scales badly across the full node set | Fix the framework on ten nodes first; batch the rest; accept that deprecated nodes get minimal entries |
| Examples rot as the format evolves | Validate every example in CI |

## References

- [Revival roadmap — Track A](../../reviews/NOODL-REVIVAL-ROADMAP.md)
- `dev-docs/reference/NODE-PATTERNS.md`, `dev-docs/reference/LEARNINGS.md` (dynamic ports; the failed static-compatibility feature)
- Depends on: SUB-004. Consumers: SUB-006, SUB-008, Phase 15 (AIX-002/004), Phase 18

## Checklist

- [ ] Branch `task/sub-005-catalog-enrichment`
- [ ] Derive compatibility rules from runtime coercion behaviour
- [ ] Establish description framework on ten representative nodes; review
- [ ] Author and validate example fragments
- [ ] Scale to full node set; build pattern library from real projects
- [ ] Merge tooling + undocumented-node warnings
- [ ] Comparative LLM acceptance test; record the delta
- [ ] CHANGELOG; open PR
