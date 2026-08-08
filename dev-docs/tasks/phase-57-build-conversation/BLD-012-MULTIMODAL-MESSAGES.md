# BLD-012 — Messages can carry images

**Status:** 📋 not started · **Track B** · ⭐ **the long pole** · after BLD-011

## The defect, measured

**The editor's messages cannot carry an image at all.**

```ts
export interface AiMessage {
  role: AiMessageRole;
  content: string;
  ...
}
```
— [types.ts:39-41](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/client/types.ts#L39)

Every image-carrying feature in Track B — an uploaded design mock (BLD-013), a screenshot of the
running app or a URL (BLD-014) — is blocked on widening this.

## The encouraging half: the machinery already exists one layer down

The Anthropic adapter **already** builds block arrays, with an open block type, and **already**
promotes a string into blocks:

```ts
export interface AnthropicRequestBlock { type: string; [field: string]: unknown; }
export interface AnthropicRequestMessage { role: 'user' | 'assistant'; content: string | AnthropicRequestBlock[]; }
```
— [anthropic.ts:138-146](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/client/providers/anthropic.ts#L138)

`splitAtCacheBoundary` already turns one string into two text blocks
([:176-182](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/client/providers/anthropic.ts#L176)),
and `markCacheBreakpoint` already promotes string content to a block array so there is something to
mark ([:158+](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/client/providers/anthropic.ts#L158)).

**And the MCP surface is already multimodal** —
[renderTools.ts:91](../../../packages/noodl-mcp/src/tools/renderTools.ts#L91) returns
`{ type: 'image', data: shot.base64, mimeType: shot.mimeType }`. An agent talking to `noodl-mcp` can
already look at a page. Only the editor's own loop cannot.

So this is a narrow-waist widening, not a rewrite.

## The constraint that shapes it: open-weight models

Phase 55's standing rule: *a support system that only works with the strongest frontier model is not
a support system, it is a demo.* **Most mid-tier open-weight models cannot take an image at all.**
And LAS-009 shipped per-role providers — a user may legitimately have Anthropic on `design` and
Ollama on `act`, **in one build**.

**Therefore: degradation is declared, never silent.** A reference that cannot be sent as an image to
the model holding this role is sent as its text twin, and the UI says so on the chip. A silent drop
would produce the worst failure mode available — an agent confidently discussing a picture it never
received.

LAS-005 already built the text twin and said why: the render report returns the numbers *and* the
screenshots, because *"the JSON report is what a text-only agent can act on"*
([renderTools.ts:8-16](../../../packages/noodl-mcp/src/tools/renderTools.ts#L8)).

## Build

1. **Widen the type:** `content: string | AiContentBlock[]`, where `AiContentBlock` is a small closed
   union (`text`, `image`) — **not** an open bag. The provider block type can stay open; the shared
   one should not.
   - String stays the overwhelmingly common case. Every existing call site keeps compiling.
2. **`cacheBoundary` semantics must be redefined for block content.** It is a character offset into
   a string ([types.ts:47-59](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/client/types.ts#L47)),
   which is meaningless against blocks. ⚠️ **This is the subtle part of the task.** Either express
   the boundary as a block index, or keep the offset semantics for string content only and make the
   block form carry an explicit `cache: true` on the last stable block. Decide, document in the
   module note, and pin with a spec — a wrong answer here silently destroys prompt caching, which
   nothing on screen will tell you about.
3. **Adapt each provider:**
   - **Anthropic** — map to `{ type: 'image', source: { type: 'base64', media_type, data } }`.
   - **OpenAI** — map to `image_url` content parts.
   - **openai-compatible** — capability-flagged; many endpoints are text-only.
   - **Ollama** — model-dependent. Assume no unless the model registry says otherwise.
4. **A capability flag in the model registry** (`models.ts`) — `vision?: boolean`, beside
   `adaptiveThinking` and `effort` which already live there
   ([models.ts:70-100](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/client/models.ts#L70)).
   The registry is the one place that already knows what a model accepts. ⚠️ Note from LAS-009: the
   registry has **zero `openai-compatible` models**, so that leg needs a default, not a lookup.
5. **A `degrade()` path on the reference**, used when `vision` is false: send the text twin, mark the
   chip, and state the substitution in the injected text so the model knows it is reading a
   description rather than looking at a picture.

## Acceptance

- [ ] An image reference reaches Anthropic and OpenAI as a real image block; a fixture request is
      pinned for both.
- [ ] The same reference against Ollama produces the text twin, and **the chip says so** before send.
- [ ] `cacheBoundary` behaviour is pinned by a spec for both string and block content, and a
      text-only turn produces a byte-identical request to before this task.
- [ ] Every existing call site compiles unchanged (the widening is additive).
- [ ] No path exists that drops an image silently. Grep the adapters for it.

## Register

| # | Finding | State |
|---|---|---|
| | | |
