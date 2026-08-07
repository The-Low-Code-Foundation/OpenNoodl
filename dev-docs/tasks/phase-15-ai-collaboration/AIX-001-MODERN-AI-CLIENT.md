# AIX-001: Modern, Provider-Agnostic AI Client

## Metadata

| Field | Value |
|-------|-------|
| **ID** | AIX-001 |
| **Phase** | Phase 15 — AI Collaboration Experience (Revival Track C) |
| **Priority** | 🔴 Critical (everything else in the phase calls through it) |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | 2–3 weeks |
| **Prerequisites** | REV-001 |
| **Branch** | `task/aix-001-modern-ai-client` |
| **Recommended executor** | 🟠 **Opus 4.8** — the abstraction design (provider interface, streaming, tool-calling, cost accounting) shapes every later AI feature, and the migration of existing ReAct/template code needs care. Sonnet can handle individual template migrations once the client interface is settled. |

## Objective

Replace the editor's aging OpenAI-specific AI plumbing with a provider-agnostic client supporting current Claude and GPT models, configurable endpoints, and local models via Ollama — and migrate the existing node-generation features onto it.

## Background

OpenNoodl already ships an AI feature: a node-generation copilot that turns natural-language prompts into Function, Query, REST, Chart, CRUD, and Validation nodes, with a ReAct-style agent loop and streaming response parsing. Structurally it works, and the templating approach is sound.

What has aged badly is everything about the models it talks to. The client streams directly against a hardcoded OpenAI chat-completions endpoint, and the selectable models are `gpt-4o-mini` and `gpt-3.5-turbo` — with one interface still referencing `text-davinci-003`, a model OpenAI retired years ago. Token costs are hardcoded and wrong. One template module imports the GPT-4 variant for both its GPT-3 and GPT-4 aliases, a copy-paste bug that means a user selecting one model silently gets the other's prompt.

Meanwhile the newest AI code in the repository — the legacy-project migration helper — already uses a current Claude model through a small purpose-built client. That is the pattern to generalise.

Three reasons this task comes first in the phase. Every later AI feature (authoring, explain mode, review) needs a client, and building three of them would be absurd. The provider abstraction determines whether Noodl can ever run against local models, which is a hard requirement for the education wedge in Phase 17, where schools frequently cannot send student work to third-party APIs. And fixing the stale model IDs is the difference between an AI feature that works and one that errors on first use.

## Current State

In `packages/noodl-editor/src/editor/src/models/AiAssistant/`:

- `context/ai-api.ts` — streams against a hardcoded `https://api.openai.com/v1/chat/completions` (overridable for enterprise/Azure), using server-sent events. Version-gated by an `OpenAiStore` returning `'full-beta' | 'enterprise'`.
- `api.ts` — model definitions for `gpt-4o-mini` (mislabelled in its display name as "gpt-4 (8k context)") and `gpt-3.5-turbo`, with hardcoded and inaccurate token pricing.
- `interfaces.ts` — `ModelName` union limited to those two models; a text-provider interface still referencing `text-davinci-003`.
- `_backend/ReAct.ts` — the agent loop, with a hardcoded model.
- `_backend/{lexer,parser,mapper,commandLexer}.ts` — streaming XML/command parsing.
- `templates/` — per-feature prompt templates with `gpt-3-version.ts` / `gpt-4-version.ts` variants; `function-query-database.ts` imports the GPT-4 module for both aliases.
- `ChatHistory.ts`, `ChatMessage.ts`, `AiCopilotContext.ts`, `DatabaseSchemaExtractor.ts` — conversation state and context building.

Elsewhere: `packages/noodl-editor/src/editor/src/utils/migration/claudeClient.ts` uses a current Claude model — the only modern integration in the repo, and a useful reference.

## Desired State

- A single provider-agnostic client used by all AI features in the editor.
- Support for current Anthropic and OpenAI models, any OpenAI-compatible endpoint, and local models via Ollama.
- Model choice, endpoint, and credentials configurable by the user, with sensible defaults.
- Streaming, tool/function calling, and accurate token/cost accounting.
- Existing node-generation features working on the new client, with the copy-paste template bug fixed.
- Model definitions in one place so keeping them current is a config change, not a code change.

## Scope

### In Scope
- [x] Provider-agnostic client interface (chat, streaming, tool calling, token accounting)
- [x] Anthropic provider, OpenAI provider, OpenAI-compatible endpoint support, Ollama provider
- [x] Central model registry with capabilities and pricing, easy to update
- [x] Settings UI: provider, model, endpoint, API key, local-model configuration
- [x] Migrate the ReAct loop and all templates onto the new client
- [x] Fix the `function-query-database` import bug and the stale `text-davinci-003` reference
- [x] Secure credential storage (never in project files or plain-text config)
- [x] Graceful degradation when no provider is configured

### Out of Scope
- New AI features (AIX-002 onwards)
- Prompt-quality improvements beyond what migration requires
- Hosting a model service
- Fine-tuning

## Technical Approach

### New Files to Create

| File | Purpose |
|------|---------|
| `.../models/AiAssistant/client/AiClient.ts` | Provider-agnostic interface + implementation |
| `.../models/AiAssistant/client/providers/{anthropic,openai,ollama}.ts` | Per-provider adapters |
| `.../models/AiAssistant/client/models.ts` | Model registry: ids, capabilities, context sizes, pricing |
| `.../views/panels/AiSettings/` | Configuration UI |

### Design notes

Model the interface on what the *features* need rather than on any one vendor's API shape: send a conversation, stream a response, optionally offer tools and receive tool calls, and report usage. Providers adapt to that; features never branch on provider.

Keep the model registry data-shaped and separate from code. The single most predictable failure mode of this subsystem is exactly what happened to its predecessor — model identifiers going stale — and the mitigation is making updates trivial and obvious rather than scattered through templates and agent loops.

Ollama support is not a nice-to-have here: it is what makes Phase 17's classroom deployment possible at all, and it also gives contributors a way to develop AI features without API costs. Treat it as a first-class provider, and note that local models are less capable — features should degrade gracefully rather than assume frontier-model behaviour.

## Implementation Steps

1. **Audit current usage.** Enumerate every call site of the existing AI plumbing and what each needs (streaming? tools? structured output?). That set defines the interface.
2. **Design the client interface** against that set; review before implementing.
3. **Implement the client and the model registry**, then the Anthropic provider (the reference implementation), then OpenAI/compatible, then Ollama.
4. **Credential storage** via the platform's secure storage rather than plain config.
5. **Migrate the ReAct loop** onto the client.
6. **Migrate the templates**, fixing the `function-query-database` import bug and removing the retired-model references as you go.
7. **Settings UI** for provider, model, endpoint, key, and local-model setup.
8. **Verify the existing node-generation features** still work end to end on at least two providers plus Ollama.

## Testing Plan

- Unit tests per provider adapter against recorded fixtures (no live API calls in CI).
- Streaming behaviour: partial chunks, mid-stream errors, cancellation.
- Tool-calling round trip on each provider that supports it.
- Manual: run every existing node-generation template against Anthropic, OpenAI, and Ollama; compare output quality and note where local models fall short.
- No-provider-configured path shows a helpful message rather than failing obscurely.

## Success Criteria

- [x] One client serves all editor AI features
- [x] Anthropic, OpenAI, OpenAI-compatible, and Ollama providers working
- [x] Model registry centralised; updating a model id is a one-line change
- [x] All existing node-generation features migrated — working verified by typecheck and unit specs; live generation runs still outstanding
- [x] `function-query-database` import bug fixed; retired-model references removed
- [x] Credentials stored securely; never written to project files
- [x] Graceful behaviour with no provider configured
- [ ] Local-model path verified end to end (prerequisite for Phase 17) — adapter implemented and unit-tested; a live Ollama run is still outstanding

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| The abstraction leaks provider specifics and later features branch on provider | Design from feature needs (step 1–2); review the interface before implementing; no provider checks outside the adapters |
| Local models underperform and features feel broken on Ollama | Set expectations in the settings UI; degrade gracefully; document which features need frontier models |
| Migration of ReAct/templates changes AI behaviour subtly | Compare outputs before and after on a fixed prompt set; treat unexplained differences as bugs |
| Model identifiers go stale again | Central registry, data-shaped, documented as a maintenance item — this is the specific failure being corrected |
| API keys leak into project files or logs | Secure platform storage; redact in logs; test that nothing is written to project directories |

## References

- [Viability report — Appendix H (AiAssistant findings)](../../reviews/NOODL-VIABILITY-REPORT.md)
- [Revival roadmap — Track C](../../reviews/NOODL-REVIVAL-ROADMAP.md)
- `packages/noodl-editor/src/editor/src/utils/migration/claudeClient.ts` — the modern pattern to generalise
- Consumers: AIX-002, AIX-003, AIX-004; Phase 17 LEARN-005 (local models for classrooms)

## Checklist

- [x] Branch — committed directly to `cline-dev` per project convention
- [x] Audit all existing AI call sites and their requirements
- [x] Design and review the client interface
- [x] Implement client, registry, and the four providers
- [x] Secure credential storage
- [x] Migrate ReAct loop and templates; fix the import bug and stale model refs
- [x] Settings UI — built; live verification on two cloud providers + Ollama still outstanding
- [x] As-built notes in [NOTES.md](./NOTES.md); no PR (project works on `cline-dev`)
