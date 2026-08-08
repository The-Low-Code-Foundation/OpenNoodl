# LAS-009 — design / plan / act: per-role model selection

**Status:** 📋 open · **Track 4 (models)** · Richard's request, 2026-08-08 (mid-audit, settled as
phase scope): *"add a 'design', 'plan' and 'act' mode … to allow the user to choose what model
does the design, the planning, the creation, like we do in Claude Code."*

## The seam — re-verified 2026-08-08, and **half of what this section claimed is false** (F33)

Re-read in source at session-4 close, because the phase rule applies to this document too. One of
the two claims below was right and one was a misread; the difference decides how big this task is.

- ✅ **Per-request `model` is real.** `withConfiguredModel` fills the global in only when the request
  omits it, so an explicit `model` wins
  ([AiClient.ts:157-160](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/client/AiClient.ts#L157)).
- ❌ **Per-request *provider* does not exist.** `getProvider()` takes **no arguments**
  ([AiClient.ts:98](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/client/AiClient.ts#L98)) —
  it reads `AiConfigStore.getActiveProvider()` and nothing else. Both `chat` and `chatStream` call it
  bare, and `AiChatRequest` has no provider field
  ([types.ts:75-93](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/client/types.ts#L75)).
  The `(providerId, override)` signature this section cited at line 135 belongs to **`verify()`**, a
  different function. Two functions were read as one.
- ✅ **The store layer really is per-provider**: `getModel(provider?)`, `getEndpoint(provider?)`,
  `getApiKey(provider?)` all take an optional target
  ([AiAssistantStore.ts:95-121](../../../packages/noodl-editor/src/editor/src/store/AiAssistantStore.ts#L95)).
  ⚠️ `isConfigured()` (line 160) is the exception — no argument, active provider only.
- ✅ No session passes a model today — everything rides the one global pair.

**So the task splits in two, and only the first half is small:**

| | Size |
|---|---|
| **Same provider, different model per role** (Opus plans, Sonnet acts) | genuinely small — the seam exists, wire the table |
| **Cross-provider per role** (Opus plans, local qwen acts) — which §2 calls "the point of the feature" | **new plumbing**: a provider argument through `getProvider`/`chat`/`chatStream`, an `isConfigured(provider?)`, and a decision about where the override travels (request field vs. call parameter) |

Neither is large. But "it is already plumbing" was not true, and a session that budgets for §1 and
discovers §2 mid-flight will ship the half that does not include Richard's actual example.

**The session inventory §1 says was never enumerated — now enumerated.** Seven call sites reach
`AiClient.chat`/`chatStream` outside `client/`:
`authoring/AuthoringSession.ts`, `authoring/PlanningSession.ts`, `authoring/DocSession.ts`,
`scoping/ScopingSession.ts`, `explain/ExplainSession.ts`, `review/ReviewDocSession.ts`,
`context/ai-api.ts`. Every one takes the same injectable `chat` seam the specs already script, so
the role wiring has one shape at all seven. Assigning them to roles is still this task's call —
`DocSession` and `ReviewDocSession` in particular are not obviously any of design/plan/act.

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
| F33 | **This task file's own "seam, verified" section was half wrong**, found at session-4 close by re-reading the three cited lines. `getProvider()` takes no arguments; the `(providerId, override)` signature cited from AiClient.ts:135 is `verify()`'s. `AiChatRequest` carries no provider. So cross-provider per-role — the case Richard named — is new plumbing, not existing plumbing, and the "this is a small task" heading is true only of the same-provider half | 🔴 OPEN — corrected above before the task starts; re-scope §2 accordingly |
