# BLD-012 — Messages can carry images

**Status:** ✅ **model layer built and jest-verified** · **Track B** · ⭐ **the long pole** · after BLD-011

> **Built 2026-08-08.** The waist is widened, `cacheBoundary` is redefined and pinned by a golden,
> and all three adapters carry an image or declare a substitution. **Nothing was driven** — the
> editor was owned by a concurrent phase-56 session, so this landed from a worktree with jest and
> tsc only. The one piece deliberately not built is the **chip**: BLD-011 has not shipped, so there
> is no reference and no chip row to mark. See the register.
>
> **Merged to `cline-dev` 2026-08-09**, after `bld-007` and in that order, as both branches' notes
> specified. The `AuthoringSession.ts` overlap between the two auto-merged — they touch different
> regions (imports + `finish()` here, the tool dispatch and constructor there) — and **both changes
> were verified present after the merge rather than assumed**. Full suite on the settled tree:
> **`Jasmine: 2582 specs, 6 failures`** (the inherited six, by name) · `test:main` **84 suites /
> 1125 tests**, of which 19 are this task's · `typecheck:editor` + `typecheck:editor-tests` clean.
>
> ✅ **The untested claim is now tested — 2026-08-09, session 9.** A real Anthropic endpoint accepted
> the image block this adapter builds, on **both** `chat` and `chatStream`, driven through the real
> `AnthropicProvider` with no injected client (so the real SDK path, not the stub the specs use).
>
> ⚠️ **The image was chosen so acceptance could not be confused with comprehension.** A 1px PNG would
> prove only that the request shape was not rejected. This sent a solid blue 16×16 PNG and asked
> *"What colour is this image?"* — the model answered **"Blue"**, which is only possible if the picture
> arrived *and* decoded. Verifying the consequence, not the mechanism.
>
> | | value |
> |---|---|
> | model id sent | `claude-haiku-4-5` (the registry's id) |
> | model served | `claude-haiku-4-5-20251001` |
> | answer | **"Blue"** · `stopReason: stop` |
> | usage | 22 in / 4 out, 0 cached |
> | **cost** | **$0.000042** |
> | `onActivity` calls | **6** (streaming path) |
>
> Three things fell out of one call beyond this task:
> - **The registry ships an id the endpoint accepts.** `claude-haiku-4-5` resolved server-side to a
>   real dated model rather than 404ing — worth knowing, given register #5 records that
>   `openai-compatible` ids resolve to nothing.
> - **BLD-005's R5 is closed.** Cost had never been checked against a real provider; every figure so
>   far came from a scripted hook returning fixed `usage`. $0.000042 is exactly
>   22×$1/MTok + 4×$5/MTok, so the editor's pricing arithmetic is correct on real numbers.
> - **BLD-004's heartbeat fired against a real provider** for the first time — `onActivity` 6 times on
>   one four-token answer. It had only ever been driven with a scripted hook.
>
> ⚠️ **Still not driven:** the *panel*. There is no UI that produces an image message (the chip is
> blocked on BLD-011), so this is verified at the adapter, not on screen. And OpenAI's leg remains
> stub-only — only Anthropic was exercised against a real endpoint.

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

## What was decided

**`cacheBoundary` keeps character-offset semantics for string content only; block content carries
`cache: true` on the last stable block.** The alternative — a block index — was rejected for three
reasons, recorded in full on `cacheBlockIndex`
([content.ts](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/client/content.ts)):
it would have given one field two meanings, an index is positional and drifts silently when a block
is inserted ahead of it, and a marker maps 1:1 onto Anthropic's own `cache_control`.

**The text twin is required, not optional.** That single type-level choice is what makes `degrade`
total: there is no image the module can be handed that it cannot render as text, so no adapter needs
a silent-drop branch and none has one.

## Acceptance

- [x] An image reference reaches Anthropic and OpenAI as a real image block; a fixture request is
      pinned for both. — `providers.test.ts`: Anthropic `source.type: base64` + `media_type`,
      OpenAI `image_url` with a `data:` URL.
- [~] The same reference against Ollama produces the text twin — **verified**; and *the chip says
      so* — **not built, blocked on BLD-011** (register #1). The substitution is declared in the
      injected text, which is the half that exists below the UI.
- [x] `cacheBoundary` behaviour is pinned by a spec for both string and block content, and a
      text-only turn produces a byte-identical request to before this task. —
      `anthropicRequest.golden.test.ts`, golden recorded from the adapter *before* the widening.
- [~] Every existing call site compiles unchanged — **true for producers, false for readers, and
      that is the correct outcome** (register #2).
- [x] No path exists that drops an image silently. — asserted as a test rather than a grep:
      one image turn through all three text-only paths, twin required in every serialized request.

## Verification

`typecheck:editor` 0 errors · `typecheck:editor-tests` 0 errors · `npx jest tests-unit` **885/885,
64 suites** (19 of them new here). Both load-bearing claims were mutation-tested: disabling the
Anthropic degrade path fails 2 specs, flipping `cacheBlockIndex` to first-match fails 1.
`noodl-mcp` unchanged at its 6 inherited tsc errors and 226 passing.

~~**Not driven.** No editor, no live provider call.~~ **Superseded 2026-08-09** — see the live table at
the top. A live Anthropic turn accepted the image and described it correctly on both `chat` and
`chatStream`. Two gaps remain and neither is the one this note was written about: **the panel** (no UI
produces an image message until BLD-011 ships the chip) and **OpenAI's leg** (stub-only; only Anthropic
was exercised against a real endpoint).

## Register

| # | Finding | State |
|---|---|---|
| 1 | **The chip is not built.** BLD-012's step 5 says degradation is "marked on the chip", but BLD-011 (`Reference` + the chip row) has not shipped, so there is no chip and no reference object to hang one on. Built instead: the substitution is *declared in the injected text*, so the model always knows it is reading a description. **Blocker: BLD-011.** The UI half is a two-line change once the chip row exists — read `capabilities.vision` for the turn's resolved model and render it. | 🚧 filed, blocked |
| 2 | **The widening is additive for producers, not for readers** — the task doc predicted "every existing call site compiles unchanged". Producers do; 20 readers across 6 Jasmine specs did not, because `content.slice(…)` no longer typechecks. All 20 fixed with `asText`. This is the widening working as intended: the compiler named every place that had to decide what an image means. | ✅ fixed |
| 3 | ⚠️ **`transcriptChars` counted blocks, not characters** — `AuthoringSession.ts` reduced over `m.content.length`, and **both branches of the union have `.length`**, so tsc could not catch it. A multimodal transcript would have under-reported by three orders of magnitude into the authoring metrics. Found by grepping readers after the typecheck came back clean, not by the typecheck. | ✅ fixed |
| 4 | **The two hosted open-weight models shared the `frontier` capability band**, which now carries `vision: true`. Left alone they would have claimed image input their endpoints reject. Split into `frontierTextOnly`. | ✅ fixed |
| 5 | ⚠️ **`findModel` maps `openai-compatible` → `openai`, so the two registered `openai-compatible` models never resolve to their own entries** ([models.ts](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/client/models.ts), `findModel`). DeepSeek V4 Pro and Qwen3-Coder always fall through to `unknownModel` — which also means they silently run with `tools: false`. Harmless for BLD-012 (unknown ⇒ no vision ⇒ degrade, the safe direction) and it makes the task doc's "the registry has zero `openai-compatible` models" note effectively still true. **Not fixed: out of scope.** Fixing it changes `tools` and pricing for those two ids, which is a behaviour change belonging to whoever owns LAS-011. | 📋 filed, not fixed |
| 6 | **Ollama's native `/api/chat` takes a sibling `images: [base64]` array, not content parts and not data URLs.** The wire shape is implemented and asserted below the vision gate, but no seeded Ollama model is flagged for vision, so in practice every Ollama request degrades today. Registering a vision model (e.g. a llava/qwen-vl pull) is the only thing needed to exercise it. | ✅ built, unexercised |
