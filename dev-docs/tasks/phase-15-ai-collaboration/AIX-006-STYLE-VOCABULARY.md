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

- [x] Verify token reference format against the resolver
- [x] Vocabulary export; context integration; prompt guidance
- [x] Analyzer lint in the loop; MCP tools; preset hook
- [x] A/B verification recorded; CHANGELOG

---

## As-Built (2026-07-25, Opus 4.8 on `cline-dev`)

### Step 1 — verified token-reference storage format (gates correctness)

**A token-valued parameter is stored as the literal CSS string `var(--token-name)`.** Verified against the resolver and one live usage:

- `SuggestionActionHandler.applyTokenAction` (the "Switch to Token" / "Create Token" path) writes the parameter with `node.setParameter(prop, 'var(${tokenName})')` where `tokenName` is e.g. `--primary` (`.../services/StyleAnalyzer/SuggestionActionHandler.ts:57,64,73`).
- Every `ElementConfig` variant/size/default stores the same shape (`backgroundColor: 'var(--primary)'`, `paddingTop: 'var(--space-2)'` — `.../models/ElementConfigs/configs/ButtonConfig.ts`).
- `TokenResolver` matches exactly `^var\((--[\w-]+)\)$`; `StyleAnalyzer` treats `value.startsWith('var(')` as an on-system reference.
- Token records are keyed by the CSS custom-property NAME (`--primary`, `--space-4`, `--text-sm`); the runtime resolves `var(--…)` against the `:root` block `ProjectTokenCss.generateProjectTokenCss` stamps into preview and deployed builds (REV-009 parity).

So the agent must emit **`var(--token-name)`** — not the bare name, not the resolved hex. The `_variant`/`_size` markers store a bare name, but the viewer does NOT expand them at runtime (variants are stamped into concrete params at author time), so the vocabulary hands the agent each variant's concrete token-referenced params to copy, and the lint checks the concrete params.

### Vocabulary export — where it lives + shape

Pure module `.../models/StyleTokensModel/StyleVocabulary.ts` (exported from the barrel). **Decision: live assembly from the models, not a baked file** — tokens are per-project (overrides in `metadata.designTokens`), and variants/presets are static registries; there is nothing to precompute. It reads project overrides through the same `MetaDataSource` seam as `ProjectTokenCss`, so it works in the renderer (ProjectModel), the headless harness (serialized `project.metadata`), and the esbuild-bundled MCP server — and it is **pure** (no ProjectModel/Electron), which is what let the authoring loop and MCP consume it. `buildStyleVocabulary(source?)` → `{ categories[], elements[], presets[] }`; `renderStyleVocabulary()` → a compact prompt block (token names by category, per-element variants + the token styles each implies). Defaults-only when no source is given is correct for the token *names* the agent emits.

### Context + refine-loop integration

- **Context (AIX-002 budget-fit):** `AuthoringContextBuilder` gained a charged `styleVocabulary()` handout and an injected `styleVocab` (defaults if none). It rides in the opening `initialUserMessage`/`updateUserMessage` under `--- STYLE VOCABULARY ---`, and the system prompt gained an `ON-SYSTEM STYLING` section (emit `var(--token)`, prefer a listed variant's combo, never a listed token you didn't see). Measured cost: **~5.1k chars** (opening message ~10.5k with vs ~5.4k without) — ~4% of the 120k budget. Category summaries are names-only; raw palette scales are elided.
- **Lint → refine loop:** new pure `styleLint.ts` runs `StyleAnalyzer`'s detector over the *candidate's own nodes* (scoped to the generated component) after it passes the structural+semantic gate. To keep the loop headless-bundleable, the analyzer's detection was extracted into a pure `StyleAnalyzerCore` (no ProjectModel) that both `StyleAnalyzer.analyzeProject` and the lint share — one detector, no second style validator. Findings feed the **same** refine conversation as validator errors, as a clearly-labelled second tier: **validator errors reject and drive repair; style findings are advisory** and earn at most **one** `styleAdvisoryMessage` pass ("your component is valid and accepted — one optional on-system improvement…"). A style suggestion can never downgrade a valid authoring: the good candidate is staged the moment it passes, and every exhaustion path falls back to it, so an ignored/failed style pass still finishes `authored`.

### MCP tools (`packages/noodl-mcp`)

- `get_style_vocabulary` (read, always registered) — the full structured vocabulary, or `detail:"prompt"` for the compact block; reflects the project's token overrides.
- `set_project_tokens` (write, `--allow-writes`) — merge token overrides into `nodegx.project.json → metadata.designTokens` (validated: names must be `--…`); the importer restores that block into ProjectModel, so the editor reads back exactly what was written.
- `set_style_preset` (write, `--allow-writes`) — apply a built-in preset's overrides (Modern clears overrides = defaults).

Wired in `editor-deps.ts` (pure submodule imports only) + `ProjectStore.designTokenMetaSource()`/`writeDesignTokens()`.

### Preset hook (project-creation authoring path)

- **External authoring path (SUB-010):** `set_style_preset` MCP tool gives an agent creating/styling a project a coherent scheme in one call.
- **In-editor launcher:** preset selection already exists at project creation (`ProjectsPage` → `setPendingPresetId` → `StyleTokensModel` consumes it on first load); left as-is.
- The in-editor authoring panel now injects the project's live vocabulary + token records into every session (`AiAuthoringPanel`), so generated components style against the active preset for free.

### A/B verification

Harness gained `--styles=on|off` (control = no vocabulary, no lint) and a raw-vs-token style-value counter (`countStyleValues`); each run reports the **token-reference rate** and writes it per-session.

**Result (2026-07-25, `claude-sonnet-5`, 3 visual prompts — hello-cta, profile-card, login-form — over the git-repo-utf8 corpus):**

| Arm | Tokenised style props | Raw props | On-system rate | Mean context |
|-----|----------------------:|----------:|---------------:|-------------:|
| `--styles=off` (control) | 22 | 4 | 85% | 27.4k chars |
| `--styles=on` (treatment) | **53** | 6 | **90%** | 36.9k chars |

Both arms: 3/3 valid on first attempt, no regression in the gate.

**What the vocabulary changed: styling *coverage*.** With the vocabulary the agent applied **2.4× more on-system styling** (53 vs 22 tokenised properties — tokenised colours, spacing, radius, and type throughout) at an equal-or-better on-system rate (90% vs 85%). That is exactly the "prototype → product" goal: the treatment output reads as a designed component; the control output is sparsely styled.

**On the raw stragglers:** neither arm emitted a single raw HEX/rgb *colour* in its final component — the corpus is token-rich, so even the control imitated the existing tokenised components it read (`login-form` copied the project's Sign-in page). The handful of "raw" values the counter flags are legitimate layout dimensions — `width: 100%`, `height: 100%` — which `countStyleValues` counts as raw spacing (a blunt-instrument caveat; `100%` is not a token candidate). So on this unusually on-system corpus the raw-*colour* rate was already ~0 before the vocabulary; the vocabulary's measurable win here is coverage. On a fresh project with no tokenised examples to imitate, the vocabulary's effect on raw-hex avoidance would be starker — the corpus baseline is atypically high. Cost: ~2× (richer output, more tokens), ~$0.24/component vs ~$0.12; context +9.5k chars (the vocabulary block), well inside budget. Records: `scratchpad/ab-styles-{off,on}.jsonl` (per-session transcripts) — rerun any time with the two commands below.

### Automated checks

- `npx tsc --noEmit` — **clean** (noodl-editor and noodl-mcp).
- noodl-mcp jest — **39/39 pass** (+7 new `styleTools.test.ts`: vocabulary enumeration, prompt detail, token persistence + round-trip reflection, `--` rejection, preset apply/reject, read-only tool absence).
- Editor suite runs under Electron (not startable here — concurrent-Electron rule). New `tests/ai/authoring-style.test.ts` (8 specs) is registered in the AI barrel and typechecks; its logic was additionally **run headlessly** (esbuild bundle + real `SemanticValidator`, the AIX-002 recipe, no Electron): **17/17 assertions pass** — vocabulary shape, render block, candidate lint (raw→findings, on-system→clean), raw/token counting, vocabulary injected only when guidance on, the one-shot advisory pass then on-system accept, ignored-advisory-still-authored, and guidance-off immediate accept.
- MCP standalone bundle + measurement-harness bundle both rebuild green (the new imports stay Electron-free; still the one `AiAssistantStore` shim).

### Coordinator handoffs / residuals

- **Editor Electron suite:** run `npm run test:ci` in noodl-editor when no other Electron instance is active, to exercise `authoring-style.test.ts` and the untouched `StyleAnalyzer` specs (the analyzer refactor preserves behaviour; the pure core was exercised headlessly, but the two live `StyleAnalyzer.test.ts` files run only under Electron).
- **Live A/B rerun (optional, one command each):** `node packages/noodl-editor/scripts/aix002-measure/build.mjs` then the same harness with `--styles=off` and `--styles=on` over a visual subset — see the recorded result above for the numbers this pass produced.
- No shared-file conflicts: I stayed inside my surface. The one additive edit outside pure additions was refactoring `StyleAnalyzer.ts` to delegate to `StyleAnalyzerCore` (behaviour-preserving, its own file).
