# LAS-009 — design / plan / act: per-role model selection

**Status:** 📋 open · **Track 4 (models)** · Richard's request, 2026-08-08 (mid-audit, settled as
phase scope): *"add a 'design', 'plan' and 'act' mode … to allow the user to choose what model
does the design, the planning, the creation, like we do in Claude Code."*

## The seam, verified — this is a small task

- Every `AiChatRequest` already honours an explicit `model`; the global is only a fallback
  (`withConfiguredModel`,
  [AiClient.ts:157-160](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/client/AiClient.ts#L157)).
- `getProvider(providerId)` already takes a provider override
  ([AiClient.ts:135](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/client/AiClient.ts#L135)).
- No session passes either today (verified by grep) — everything rides the one global pair.
- Config storage: `ai.provider`, `ai.model.<provider>`, `ai.endpoint.<provider>` in
  `store/AiAssistantStore.ts` / `EditorSettings`; keys per provider already exist, credentials per
  provider already exist. Local models: ollama `isConfigured()` is unconditionally true;
  `unknownModel()` accepts unregistered ids — the provider layer is done (phase 15).

## Build

### 1. Roles, in one table

`ai.role.design`, `ai.role.plan`, `ai.role.act` — each optional `{provider?, model}`, falling
back to the global pair. One exported mapping decides which session is which role — a table, not
scattered conditionals:

| Role | Sessions |
|---|---|
| design | `ScopingSession` + the token/identity turns (verify where `set_project_tokens`-adjacent scoping turns run before assigning them) |
| plan | `PlanningSession` (and `planFromScope`-driven runs) |
| act | `AuthoringSession` — authoring, refine, apply-adjacent turns |

Anything unmapped (explain, review, templates) stays global — record that decision in the table
itself. Verify each session's request construction site before wiring; the audit checked
AuthoringSession/PlanningSession/scoping pass no model, but the full session inventory
(`explain/`, `review/`) was not enumerated.

### 2. Wiring

Each mapped session resolves its role once at session start (not per request — a session that
changes model mid-flight is a debugging nightmare) and passes `model` (+ provider override when
the role names a different provider) on every request. Cross-provider is in scope — it is the
point of the feature (Opus plans, local qwen acts) — and the provider override path plus
per-provider credentials make it plumbing, not architecture. Where a role's provider is
unconfigured (no key), fall back to global **loudly**: one console warning naming the role.

### 3. Cost visibility

The usage log already records per-model usage (`usageLog`,
[AiClient.ts:63](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/client/AiClient.ts#L63)).
Surface per-role spend in the session cost line so a user running Opus-plans/local-acts can see
what the split buys. Small: the role is known at request time — tag the log entry.

### 4. Settings UI

One row/section in the AI settings panel (`AiSettingsSection.tsx`): three pickers labelled
Design / Plan / Act, each defaulting to **"Same as main model"**, reusing the existing
provider+model picker components (ollama and openai-compatible appear exactly as in the main
picker). No new visual language — this is a settings row, not a feature page.

### 5. Defaults ship unset

Everything = global until LAS-011 says otherwise. The audit's caution is explicit: the intuitive
mapping (strong designs, weak acts) ran **backwards** in the measured replays — planning was the
step haiku did *well*; acting (interfaces, encoding, wiring) is where strength or structure was
needed. Any recommended preset comes from the acceptance matrix, not from intuition. If a preset
is ever shipped, it is a suggestion in the UI copy, never a silent change to existing configs.

## Acceptance

- Jest: role→(provider, model) resolution — fallbacks, cross-provider, unconfigured-provider
  loud-fallback.
- Live (run-editor recipe): plan=haiku / act=sonnet visibly logs both models in the usage line
  across one scoping→plan→author run; settings row round-trips through EditorSettings.
- `typecheck:editor` + editor jest green, counts compared.
- MCP surface unaffected (external agents bring their own model — nothing here touches
  noodl-mcp; state that in the commit message so nobody looks for the other half).

## Register

| # | Finding | State |
|---|---|---|
| — | | |
