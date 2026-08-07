# AIX-001 — Audit & As-Built Notes

_Executor: Opus 4.8. Committed to `cline-dev`._

## 1. Audit of the pre-existing AI plumbing

Every call site of the old plumbing, and what it actually needed. This set defined the
client interface — nothing in it needed anything a chat/stream/tools/usage interface
cannot express.

| Call site | Needs | Notes |
|-----------|-------|-------|
| `context/ai-api.ts` → `Ai.chatStream` | streaming text | The only real entry point. Hardcoded `https://api.openai.com/v1/chat/completions`, SSE via `@microsoft/fetch-event-source`. |
| `context/ai-query.ts` → `AiQuery.chatStreamXml` | streaming text | Wraps `chatStream` with the XML tag parser. |
| `context/ai-query.ts` → `AiQuery.chatReAct` | streaming text | Wraps `chatStream` with the ReAct command lexer. |
| `_backend/ReAct.ts` → `ReActAgent.act` | streaming text, `temperature: 0` | Hardcoded `model: 'gpt-4o-mini'`. |
| `templates/*` (6 templates) | streaming text | Each hardcoded a model id in its `provider` block. |
| `views/Clippy/Commands/utils.tsx` → `makeChatRequest` | single-shot chat + usage | Own fetch, own (wrong) pricing table. |
| `views/Clippy/Commands/utils.tsx` → `makeImageGenerationRequest` | image generation | Not a chat completion — deliberately left on OpenAI, see §5. |
| `models/AiAssistant/api.ts` → `verifyOpenAiApiKey` | model listing | `GET /v1/models` against OpenAI only. |
| `utils/migration/claudeClient.ts` | single-shot chat + system prompt + usage | The one modern integration; its own SDK client and pricing table. |
| `utils/migration/keyStorage.ts` | key storage | Its own `safeStorage` + `electron-store`, separate from the AI settings key. |

**No call site needed tool calling or structured output.** Tool calling is in the
interface and implemented on all three providers anyway, because AIX-002/003 will need
it and retrofitting it across four adapters later is the expensive order.

### Defects found during the audit

1. **`function-query-database.ts` imported the gpt-4 module under both aliases** — the
   spec's known copy-paste bug. Compounding it: the "gpt-3" module exports `generate`,
   not `execute`, so the aliased call would have thrown had it ever been reached. Both
   fixed (the simple module's export is renamed to `execute` for symmetry).
2. **`ReAct.ts` sent `temperature: 0` unconditionally.** Current Claude frontier models
   reject sampling parameters with a 400 — every agent-loop request would have failed on
   Anthropic. The adapter now drops the parameter per model capability.
3. **`claudeClient.ts` pinned `claude-sonnet-4-20250514`**, whose retirement date
   (2026-06-15) has passed. The migration helper was calling a retired model.
4. **The AI settings section was rendered inside the `experimentalPanels.length` guard**
   in `EditorSettingsPanel`, so with no experimental panels registered the entire AI
   configuration UI was unreachable. Moved out of the conditional.
5. **API keys were stored in the plain-text editor settings JSON**
   (`aiAssistant.temporaryApiKey`). Now in OS-encrypted storage, with a one-shot
   migration that only clears the plaintext copy after the encrypted write succeeds.

## 2. The interface

`client/types.ts`. Modelled on feature needs, not on any vendor:

```
chat(request)                → AiChatResponse
chatStream(request, callbacks) → AiChatResponse
verify()                     → AiProviderVerification
```

`AiChatRequest` carries messages, an optional model, temperature, maxTokens, tools,
toolChoice and an AbortController. `AiChatResponse` carries text, toolCalls, usage
(`promptTokens`/`completionTokens`/`costUsd`) and a normalised `stopReason`.

Two decisions worth recording:

- **`costUsd` is `number | null`, never an implicit 0.** `null` means "this model has no
  pricing in the registry" (custom gateway, model newer than this build); local models
  report a real `0`. Collapsing the two would have made a custom endpoint look free.
- **Features omit `model`.** The client fills in the configured one. Only the migration
  helper pins a model, and it pins the registry default rather than a literal.

## 3. The registry

`client/models.ts` is the single place model ids, context sizes, pricing and capabilities
live. Capabilities drive behaviour that used to be model-id matching:

| Capability | Replaces | Used by |
|-----------|----------|---------|
| `agentFlow` | `hasGPT4` / `version === 'full-beta'` | `templates/function.ts`, `templates/function-query-database.ts`, Clippy command filtering |
| `sampling` | nothing (this was the latent 400) | Anthropic + OpenAI adapters, to drop `temperature` |
| `adaptiveThinking` | nothing | Anthropic adapter |

`resolveModel(id, provider)` falls back to a permissive `unknownModel` entry, so a model
released after this build still works — it just reports unknown pricing. That is the
property that keeps the registry from becoming a gate.

## 4. Providers

- **`anthropic.ts`** — reference implementation, on the official `@anthropic-ai/sdk`
  (already a dependency). The SDK client is described by a minimal structural type
  (`AnthropicLike`) rather than imported SDK types: it is the test injection seam, and it
  makes the adapter immune to SDK type churn. Streaming uses `messages.create({stream:
  true})` and consumes raw events, so the same accumulate-and-emit shape as the HTTP
  providers. Adaptive thinking is requested with `display: 'omitted'` — better answers,
  and reasoning can never leak into the text the XML templates parse. `thinking_delta` is
  explicitly dropped.
- **`openai.ts`** — serves both `openai` and `openai-compatible`. `stream_options:
  {include_usage: true}` is sent **only** to OpenAI proper; gateways reject unknown
  fields, and without it a streamed response reports no usage at all. `toChatCompletionsUrl`
  accepts either a base URL or a full `/chat/completions` URL, because the old
  "enterprise" setting stored the latter and users should not have to re-enter it.
- **`ollama.ts`** — native `/api/chat` (NDJSON), not the OpenAI shim: the native endpoint
  reports token counts and tool calls reliably. Tool calls arrive complete in one message
  and carry no id, so ids are synthesised. `/api/tags` backs both verification and model
  discovery.

Shared line/SSE/NDJSON parsing is in `providers/stream-utils.ts` — the chunk-boundary
case (a line split across two reads) is the one that silently truncates generated code,
so it has its own specs.

## 5. Deliberately out of scope

**`makeImageGenerationRequest`** still calls OpenAI's images endpoint directly. It is not
a chat completion, so routing it through a chat client would be a lie about the
abstraction. It now reads the OpenAI key explicitly and throws a typed
`AiNotConfiguredError` naming what is missing, rather than 401-ing when the user is on
Anthropic. A provider-agnostic image interface belongs to whichever later task needs it.

## 6. Verification

- `npm run test:ci` — 1060 specs, of which **69 are new AI specs**. No network calls: the
  HTTP providers take an injected `fetch`, the Anthropic provider an injected SDK client.
  Covered: registry invariants (one default per provider, no duplicate ids, cost
  arithmetic incl. the sub-cent case, unknown-model fallback), stream parsing (chunk
  boundaries, CRLF, `[DONE]`, malformed chunks, truncated tool JSON), per-provider
  request translation, streaming accumulation, tool-call assembly from fragments,
  mid-stream errors under HTTP 200, cancellation, error mapping, and the
  no-provider-configured path.
- `npx tsc --noEmit` clean.
- Live smoke test in the running editor: see §7.

## 7. Open items

- **Live runs against real providers are unverified.** The specs prove translation and
  parsing against recorded shapes; they do not prove the shapes are current. Someone with
  keys should run each node-generation template against Anthropic, OpenAI and Ollama and
  compare output quality — that is step 8 of the spec and the one thing an offline agent
  cannot do.
- **OpenAI model ids and prices** in the registry are as published on the `PRICING_AS_OF`
  date and should be re-checked against OpenAI's current catalogue. This is the
  maintenance item the registry exists to make cheap.
- The migration feature (`AIConfigPanel`) still carries its own `apiKey` through an
  `AIConfig` object rather than reading the shared credential store. The key *storage* is
  now unified; the config plumbing was left alone as out-of-scope churn.
