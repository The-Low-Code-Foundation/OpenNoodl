# AIX-006: The Style Vocabulary — Tokens, Variants, and the Style Linter for AI Authoring

## Metadata

| Field | Value |
|-------|-------|
| **ID** | AIX-006 |
| **Phase** | Phase 15 — AI Collaboration (Revival Track C) |
| **Priority** | 🟠 High (directly improves the G2 demo's output quality for days of work) |
| **Difficulty** | 🟢 Easy to 🟡 Medium |
| **Estimated Time** | ~1 week |
| **Prerequisites** | None hard. Coordinates with AIX-002 (context assembly) and SUB-008 (MCP); the styles system it consumes is shipped |
| **Branch** | `task/aix-006-style-vocabulary` |
| **Recommended executor** | 🟠 **Opus 4.8** — the integration is mechanical, but deciding what subset of the token/variant vocabulary the agent sees (and how the linter's findings feed refinement) affects generation quality and needs judgment. |

## Objective

Expose the shipped phase-9 styles system — design tokens, element variants/sizes, and the StyleAnalyzer — to the AI authoring substrate, so agents emit on-system styling instead of raw hex values, and generated output gets style-linted the same way it gets semantically validated.

## Background

The 2026-07-24 salvage audit ([PRE-REVIVAL-SALVAGE-AUDIT.md](../../reviews/PRE-REVIVAL-SALVAGE-AUDIT.md) §2) found the styles overhaul in far better shape than its docs claimed: `StyleTokensModel` (~1,196 lines) with CSS-variable injection into preview *and* deployed builds, the `ElementConfigs` variant/size registry (~871 lines), five `StylePresets`, and a tested `StyleAnalyzer` (~605 lines + 693 lines of tests) already wired into the property panel.

It also found **zero connection** between any of this and the AI substrate — neither SUB-004 nor AIX-002 mentions tokens at all. The consequence is exactly the failure mode SUB-004 was built to prevent, transposed to styling: an agent that sets `#3B82F6` on a node is emitting schema-valid nonsense the same way an agent inventing port names does. The graph loads, the validator passes, and the output looks like a prototype instead of a product — which matters because Gate G2's bar is explicitly "something a stranger could look at and want."

The pieces map one-to-one onto the substrate pattern that already works:

| Substrate piece (shipped) | Style-side twin (this task) |
|---|---|
| `node-catalog.json` — legal nodes/ports | Token + variant vocabulary — legal style values |
| SUB-006 semantic validator | `StyleAnalyzer.analyzeProject()` as post-generation linter |
| Catalog subset in AIX-002 context assembly | Token/variant subset in the same context |

## Current State

- `StyleTokensModel` (`packages/noodl-editor/src/editor/src/models/StyleTokensModel/`): `DefaultTokens.ts` (457 lines), `TOKEN_CATEGORIES` (`TokenCategories.ts`), `TokenResolver`, `setToken` API — the resolvable vocabulary.
- `ElementConfigs` registry: `getVariantNames(elementType)` / `getSizeNames(elementType)` — the legal enum per element. (Note: no `addVariant` exists; variant *persistence* is a PLAT-005 item, not this task.)
- `StylePresets`: five presets applied at project creation.
- `StyleAnalyzer`: detects repeated raw colors/spacing and off-system elements; currently surfaces suggestions to humans via the property-panel banner.
- AIX-002's context assembly selects the catalog subset the agent sees; SUB-006's validator runs as the "compiler errors" pass; neither knows styles exist.
- MCP (SUB-008) exposes catalog/project tools; no style tools.

## Desired State

- **Context:** AIX-002's assembled context includes the project's resolved token vocabulary (semantic names by category, not resolved values the agent doesn't need) and, for each element type in play, its legal variants/sizes — with instruction to reference tokens (`var(--…)` / token names as the parameter format actually is — verify against how the property system stores token references) rather than raw values.
- **Linting:** after generation, `StyleAnalyzer.analyzeProject()` (scoped to the generated components) runs alongside SUB-006 validation; its findings ("raw color #3B82F6 used 4×; nearest token: `color-primary`") feed the same refine loop as validator errors.
- **MCP:** an agent can enumerate tokens/variants (`get_style_vocabulary` or equivalent) and set project tokens — so external agents (Claude Desktop/Code via SUB-010's path) get the same vocabulary as the in-editor loop.
- **Presets:** project creation through the authoring loop can select a StylePreset, giving generated projects a coherent starting scheme for free.

## Scope

### In Scope
- [ ] A serializable style-vocabulary export (tokens by category + variants/sizes per element) — the style analogue of the catalog; decide whether it lives in the catalog file, beside it, or is assembled live (record the decision; live assembly from the models is likely right since tokens are per-project)
- [ ] Token/variant subset in AIX-002 context assembly, with emission guidance in the prompt templates
- [ ] `StyleAnalyzer` wired into the post-generation pass; findings formatted for the refine loop
- [ ] MCP tools: enumerate vocabulary; set tokens
- [ ] Preset selection in the project-creation authoring path
- [ ] Verification: author the same page with and without the vocabulary; compare on-system rates (raw values vs token references) and record the result

### Out of Scope
- Variant persistence / `addVariant` (PLAT-005's stub)
- New tokens, categories, or presets (the vocabulary is consumed, not extended)
- Auto-fixing style findings without the refine loop (the linter suggests; the loop decides)
- Teaching the SUB-006 validator about styles (the analyzer *is* the style validator; don't duplicate)

## Implementation Steps

1. **Verify the reference format** — how a token-valued parameter is actually stored (CSS var string? token name?) by reading `ProjectTokenCss`/`TokenResolver` and one live usage; the agent must emit what the system stores.
2. **Vocabulary export** function + shape.
3. **Context assembly** integration + prompt guidance (coordinate with AIX-002's budget structure — the vocabulary must fit the structural budget; category summaries over full dumps if tight).
4. **Post-generation lint** via `StyleAnalyzer`, findings into the refine loop.
5. **MCP tools.**
6. **Preset hook** in project creation.
7. **A/B verification** and record.

## Success Criteria

- [ ] Generated components reference tokens/variants where applicable; raw-value rate measurably drops in the A/B check
- [ ] StyleAnalyzer findings appear in the refine loop and are actionable by the agent
- [ ] External agents can enumerate the vocabulary and set tokens via MCP
- [ ] A project authored end-to-end lands with a coherent preset-based scheme
- [ ] No regression in AIX-002's token budget or loop latency worth caring about

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Vocabulary bloats the context budget | Category summaries + per-element subsets; AIX-002's budget is structural — fit inside it, don't grow it |
| Agent emits token references in a format the runtime doesn't resolve | Step 1 verifies the stored format against the resolver before any prompt work |
| Analyzer findings are noisy on generated output | Scope analysis to generated components; threshold repeated-value detection; if quality is poor, fix thresholds before wiring the loop (same rule as PLAT-005's banner) |
| Duplicate validation surfaces confuse the loop | One merged findings list to the refine step: validator errors first, style findings second, clearly labeled |

## References

- [PRE-REVIVAL-SALVAGE-AUDIT.md](../../reviews/PRE-REVIVAL-SALVAGE-AUDIT.md) §2 — the styles audit and the substrate-mapping table
- `dev-docs/tasks/phase-9-styles-overhaul/` — STYLE-001…005
- AIX-002 (context assembly + refine loop), SUB-004/005 (the pattern to mirror), SUB-008 (MCP)
- Related: PLAT-005 (analyzer quality verification + variant persistence)

## Checklist

- [ ] Verify token reference format against the resolver
- [ ] Vocabulary export; context integration; prompt guidance
- [ ] Analyzer lint in the loop; MCP tools; preset hook
- [ ] A/B verification recorded; CHANGELOG
