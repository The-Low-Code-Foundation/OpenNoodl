/**
 * Anthropic provider adapter.
 *
 * This is the reference implementation: it shows the shape every other adapter
 * follows — translate our message model into the vendor's, run the request,
 * translate the vendor's events back into `AiChatResponse`. No vendor type
 * escapes this file.
 *
 * Uses the official `@anthropic-ai/sdk`. The SDK client is described here by a
 * minimal structural type rather than imported types, which keeps the adapter
 * testable against a stub and immune to SDK type churn.
 *
 * @module AiAssistant/client/providers/anthropic
 */

import { resolveModel } from '@noodl-models/AiAssistant/client/models';
import {
  AiChatRequest,
  AiChatResponse,
  AiClientError,
  AiMessage,
  AiProvider,
  AiProviderConfig,
  AiProviderVerification,
  AiStopReason,
  AiStreamCallbacks,
  AiToolCall
} from '@noodl-models/AiAssistant/client/types';
import { parseToolArguments } from '@noodl-models/AiAssistant/client/providers/stream-utils';

import { errorMessage, errorStatus, isAbortError } from './errors';
import { finalizeUsage } from './usage';

/**
 * The wire shapes below describe only what this adapter reads, and are written
 * by hand rather than imported from the SDK — the same reason the client itself
 * is a structural type. Every field is optional because it comes off the wire:
 * naming them buys a typo check and an honest record of the contract, not a
 * guarantee that the server sent them.
 */
export interface AnthropicUsage {
  /**
   * Uncached input only. Anthropic reports cache reads and writes in their own
   * fields and does NOT fold them in here, so total prompt size is the sum of
   * all three — a fact worth knowing before reading a cached run's numbers as
   * a context-size win.
   */
  input_tokens?: number;
  output_tokens?: number;
  /** Prefix served from cache this request, billed at ~0.1x input. */
  cache_read_input_tokens?: number;
  /** Prefix written to cache this request, billed at ~1.25x input. */
  cache_creation_input_tokens?: number;
}

export interface AnthropicTextBlock {
  type: 'text';
  text: string;
}

export interface AnthropicToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input?: Record<string, unknown>;
}

/** `thinking` and any block type added later land in the third member. */
export type AnthropicContentBlock = AnthropicTextBlock | AnthropicToolUseBlock | { type: string };

export interface AnthropicMessage {
  model?: string;
  stop_reason?: string;
  content?: AnthropicContentBlock[];
  usage?: AnthropicUsage;
}

export interface AnthropicStreamEvent {
  type: string;
  /** Which content block this event belongs to; blocks stream interleaved. */
  index?: number;
  message?: { model?: string; usage?: AnthropicUsage };
  content_block?: { type?: string; id?: string; name?: string };
  delta?: { type?: string; text?: string; partial_json?: string; stop_reason?: string };
  usage?: AnthropicUsage;
}

/** `messages.create` returns a message, or an event stream when `stream: true`. */
export type AnthropicCreateResult = AnthropicMessage | AsyncIterable<AnthropicStreamEvent>;

/** The slice of `@anthropic-ai/sdk` this adapter uses. */
export interface AnthropicLike {
  messages: {
    create(params: Record<string, unknown>, options?: { signal?: AbortSignal }): Promise<AnthropicCreateResult>;
  };
}

function isEventStream(result: AnthropicCreateResult): result is AsyncIterable<AnthropicStreamEvent> {
  return result != null && Symbol.asyncIterator in result;
}

function isTextBlock(block: AnthropicContentBlock): block is AnthropicTextBlock {
  return block.type === 'text';
}

function isToolUseBlock(block: AnthropicContentBlock): block is AnthropicToolUseBlock {
  return block.type === 'tool_use';
}

export interface AnthropicProviderConfig extends AiProviderConfig {
  /** Injection seam for tests — defaults to a real SDK client. */
  client?: AnthropicLike;
}

const DEFAULT_MAX_TOKENS = 16_000;

/**
 * Anthropic accepts at most four `cache_control` markers per request and
 * rejects the request outright past that — so the count is budgeted, not
 * hoped for. We spend three; the fourth is headroom for a future call site.
 */
const MAX_CACHE_BREAKPOINTS = 4;

function createSdkClient(config: AnthropicProviderConfig): AnthropicLike {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Anthropic = require('@anthropic-ai/sdk');
  const Ctor = Anthropic.default || Anthropic;
  return new Ctor({
    apiKey: config.apiKey,
    ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
    // Safe in Electron: this runs in the desktop app's own renderer against
    // the user's own key, not in a page served to third parties.
    dangerouslyAllowBrowser: true
  });
}

/** A block in a request *we* build — `text`, `tool_use` or `tool_result`. */
export interface AnthropicRequestBlock {
  type: string;
  [field: string]: unknown;
}

export interface AnthropicRequestMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicRequestBlock[];
}

/** The marker that makes a block a cache breakpoint. 5-minute TTL (the default). */
const CACHE_CONTROL = { type: 'ephemeral' } as const;

/**
 * Mark a message's last content block as a cache breakpoint, promoting string
 * content to a block array so there is something to mark.
 *
 * An empty message is left alone: there is no block to carry the marker, and
 * an empty text block is rejected outright.
 */
function markCacheBreakpoint(message: AnthropicRequestMessage): boolean {
  if (typeof message.content === 'string') {
    if (!message.content) return false;
    message.content = [{ type: 'text', text: message.content }];
  }
  const last = message.content[message.content.length - 1];
  if (!last) return false;
  last.cache_control = CACHE_CONTROL;
  return true;
}

/**
 * Split a user turn at its `cacheBoundary` into a stable block and a variable
 * block, and mark the stable one. Returns false when the boundary is unusable
 * (absent, or at either end) and the turn should be sent whole — a breakpoint
 * on a block that is not actually a shared prefix costs a write and earns no
 * reads.
 */
function splitAtCacheBoundary(message: AiMessage): AnthropicRequestBlock[] | null {
  const boundary = message.cacheBoundary;
  if (typeof boundary !== 'number' || boundary <= 0 || boundary >= message.content.length) return null;
  return [
    { type: 'text', text: message.content.slice(0, boundary), cache_control: CACHE_CONTROL },
    { type: 'text', text: message.content.slice(boundary) }
  ];
}

/**
 * Translate our flat message list into Anthropic's system + messages split.
 *
 * Three things need care: system messages are hoisted out entirely; assistant
 * tool calls become `tool_use` blocks; and tool results become `user` messages
 * with `tool_result` blocks, merged when adjacent so parallel calls answer in
 * a single turn (splitting them trains the model out of parallel calls).
 *
 * With `cacheBoundaries`, a user message carrying one is additionally split in
 * two so a breakpoint can sit exactly where the stable half ends. Off, the
 * boundary is ignored and the turn is sent as one block — identical bytes
 * either way, so this changes cost, never meaning.
 *
 * `maxBoundaries` caps how many of those splits are made, because breakpoints
 * are a budgeted resource and the API rejects a request that overspends them.
 * The earliest boundaries win: they cover the longest prefixes, and anything
 * later is already covered by the caller's breakpoint on the newest turn.
 */
export function toAnthropicMessages(
  messages: AiMessage[],
  options: { cacheBoundaries?: boolean; maxBoundaries?: number } = {}
): {
  system: string | undefined;
  messages: AnthropicRequestMessage[];
  /** How many breakpoints the messages already carry, against the cap of 4. */
  breakpoints: number;
} {
  const systemParts: string[] = [];
  const out: AnthropicRequestMessage[] = [];
  let breakpoints = 0;

  for (const message of messages) {
    if (message.role === 'system') {
      if (message.content) systemParts.push(message.content);
      continue;
    }

    if (options.cacheBoundaries && message.role === 'user' && breakpoints < (options.maxBoundaries ?? Infinity)) {
      const split = splitAtCacheBoundary(message);
      if (split) {
        out.push({ role: 'user', content: split });
        breakpoints++;
        continue;
      }
    }

    if (message.role === 'tool') {
      const block = {
        type: 'tool_result',
        tool_use_id: message.toolCallId,
        content: message.content
      };

      const previous = out[out.length - 1];
      if (previous && previous.role === 'user' && Array.isArray(previous.content)) {
        previous.content.push(block);
      } else {
        out.push({ role: 'user', content: [block] });
      }
      continue;
    }

    if (message.role === 'assistant' && message.toolCalls?.length) {
      const content: AnthropicRequestBlock[] = [];
      if (message.content) content.push({ type: 'text', text: message.content });
      for (const call of message.toolCalls) {
        content.push({ type: 'tool_use', id: call.id, name: call.name, input: call.arguments });
      }
      out.push({ role: 'assistant', content });
      continue;
    }

    out.push({ role: message.role, content: message.content });
  }

  // The API requires the first message to be `user`. Templates that open with
  // an assistant turn would otherwise 400 on an error nobody can act on.
  if (out.length > 0 && out[0].role === 'assistant') {
    out.unshift({ role: 'user', content: '(continue)' });
  }

  return {
    system: systemParts.length > 0 ? systemParts.join('\n\n') : undefined,
    messages: out,
    breakpoints
  };
}

function toStopReason(raw: unknown): AiStopReason {
  switch (raw) {
    case 'end_turn':
    case 'stop_sequence':
      return 'stop';
    case 'max_tokens':
      return 'length';
    case 'tool_use':
      return 'tool_calls';
    case 'refusal':
      return 'stop';
    default:
      return 'unknown';
  }
}

export class AnthropicProvider implements AiProvider {
  public readonly id = 'anthropic' as const;

  private readonly config: AnthropicProviderConfig;
  private _client: AnthropicLike | undefined;

  constructor(config: AnthropicProviderConfig) {
    this.config = config;
    this._client = config.client;
  }

  private get client(): AnthropicLike {
    if (!this._client) {
      this._client = createSdkClient(this.config);
    }
    return this._client;
  }

  private buildParams(request: AiChatRequest, stream: boolean): Record<string, unknown> {
    const modelId = request.model;
    if (!modelId) {
      throw new AiClientError('No model specified for the Anthropic provider.', this.id);
    }

    const model = resolveModel(modelId, this.id);
    const caching = model.capabilities.promptCaching === true;
    // Two of the four markers are spoken for here — one for system, one for the
    // newest turn — so the mapper may spend at most the remaining two. It is
    // budgeted rather than checked afterwards: an over-budget request is a 400,
    // and there is no partial success to fall back to.
    const { system, messages, breakpoints } = toAnthropicMessages(request.messages, {
      cacheBoundaries: caching,
      maxBoundaries: MAX_CACHE_BREAKPOINTS - 2
    });

    const params: Record<string, unknown> = {
      model: modelId,
      max_tokens: Math.min(request.maxTokens ?? DEFAULT_MAX_TOKENS, model.maxOutputTokens),
      messages,
      ...(stream ? { stream: true } : {})
    };

    // AIX-007 — prompt caching. Anthropic renders tools, then system, then
    // messages, so a breakpoint on the last system block covers the tool
    // definitions too: one marker, the whole fixed preamble.
    //
    // Three breakpoints at most, against a cap of four:
    //   1. end of system (and therefore of tools)
    //   2. end of the opening turn's reference blocks (set by the mapper)
    //   3. end of the newest turn — the growing conversation prefix
    //
    // (3) is what makes turn N+1 read turns 1..N. Each request moves it
    // forward by one turn, and a turn adds a handful of blocks at most, so it
    // stays inside the 20-block lookback that a breakpoint searches for a
    // prior entry.
    let spent = breakpoints;
    if (system) {
      params.system = caching ? [{ type: 'text', text: system, cache_control: CACHE_CONTROL }] : system;
      if (caching) spent++;
    }

    if (caching && messages.length > 0 && spent < MAX_CACHE_BREAKPOINTS) {
      markCacheBreakpoint(messages[messages.length - 1]);
    }

    // Current Claude frontier models reject `temperature` with a 400. Features
    // pass `temperature: 0` for determinism without knowing which provider
    // they're on, so dropping it here is the whole point of the adapter layer.
    if (model.capabilities.sampling && typeof request.temperature === 'number') {
      params.temperature = request.temperature;
    }

    // Adaptive thinking with the reasoning hidden: better answers, and the
    // visible text stays clean for the XML-parsing templates.
    if (model.capabilities.adaptiveThinking) {
      params.thinking = { type: 'adaptive', display: 'omitted' };
    }

    // AIX-007 — reasoning depth. Unset inherits Anthropic's default of `high`,
    // which is why every cost-sensitive call site passes one explicitly rather
    // than leaving it to the API.
    if (model.capabilities.effort && request.effort) {
      params.output_config = { effort: request.effort };
    }

    if (request.tools?.length) {
      params.tools = request.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.parameters
      }));

      if (request.toolChoice === 'required') params.tool_choice = { type: 'any' };
      else if (request.toolChoice === 'none') params.tool_choice = { type: 'none' };
    }

    return params;
  }

  async chat(request: AiChatRequest): Promise<AiChatResponse> {
    const params = this.buildParams(request, false);

    let result: AnthropicCreateResult;
    try {
      result = await this.client.messages.create(params, { signal: request.abortController?.signal });
    } catch (error) {
      throw wrapError(error);
    }

    if (isEventStream(result)) {
      throw new AiClientError('Anthropic streamed a response to a non-streaming request.', this.id);
    }

    const raw: AnthropicMessage = result;

    const text = (raw.content || [])
      .filter(isTextBlock)
      .map((block) => block.text)
      .join('');

    const toolCalls: AiToolCall[] = (raw.content || []).filter(isToolUseBlock).map((block) => ({
      id: block.id,
      name: block.name,
      arguments: block.input || {}
    }));

    return {
      text,
      toolCalls,
      model: raw.model || String(params.model),
      stopReason: toStopReason(raw.stop_reason),
      usage: finalizeUsage(String(params.model), this.id, raw.usage?.input_tokens ?? 0, raw.usage?.output_tokens ?? 0, {
        cacheReadTokens: raw.usage?.cache_read_input_tokens ?? 0,
        cacheWriteTokens: raw.usage?.cache_creation_input_tokens ?? 0
      })
    };
  }

  async chatStream(request: AiChatRequest, callbacks: AiStreamCallbacks): Promise<AiChatResponse> {
    const params = this.buildParams(request, true);
    const signal = request.abortController?.signal;

    let fullText = '';
    const toolCalls: AiToolCall[] = [];
    let promptTokens = 0;
    let completionTokens = 0;
    // Cache counts arrive once, on `message_start`, alongside the input count.
    let cacheReadTokens = 0;
    let cacheWriteTokens = 0;
    let stopReason: AiStopReason = 'unknown';
    let servedModel = String(params.model);

    // Tool-call blocks stream their arguments as JSON fragments keyed by the
    // content-block index, so partials are accumulated per index and parsed
    // only once the block closes.
    const pendingTools = new Map<number, { id: string; name: string; json: string }>();

    try {
      const stream = await this.client.messages.create(params, { signal });
      if (!isEventStream(stream)) {
        throw new AiClientError('Anthropic returned a single message for a streaming request.', this.id);
      }

      for await (const event of stream) {
        if (signal?.aborted) break;

        switch (event.type) {
          case 'message_start':
            promptTokens = event.message?.usage?.input_tokens ?? promptTokens;
            completionTokens = event.message?.usage?.output_tokens ?? completionTokens;
            cacheReadTokens = event.message?.usage?.cache_read_input_tokens ?? cacheReadTokens;
            cacheWriteTokens = event.message?.usage?.cache_creation_input_tokens ?? cacheWriteTokens;
            servedModel = event.message?.model || servedModel;
            break;

          case 'content_block_start':
            if (event.content_block?.type === 'tool_use') {
              pendingTools.set(event.index ?? 0, {
                id: event.content_block.id,
                name: event.content_block.name,
                json: ''
              });
            }
            break;

          case 'content_block_delta': {
            const delta = event.delta;
            if (delta?.type === 'text_delta' && delta.text) {
              fullText += delta.text;
              callbacks.onText?.(fullText, delta.text);
            } else if (delta?.type === 'input_json_delta') {
              const index = event.index ?? 0;
              const pending = pendingTools.get(index);
              if (pending && delta.partial_json) {
                pending.json += delta.partial_json;
                callbacks.onToolCallPartial?.({ index, name: pending.name, argsText: pending.json });
              }
            }
            // `thinking_delta` is deliberately ignored: reasoning is requested
            // with display 'omitted' and must never reach the response text.
            break;
          }

          case 'content_block_stop': {
            const pending = pendingTools.get(event.index ?? 0);
            if (pending) {
              const call: AiToolCall = {
                id: pending.id,
                name: pending.name,
                arguments: parseToolArguments(pending.json)
              };
              toolCalls.push(call);
              callbacks.onToolCall?.(call);
              pendingTools.delete(event.index ?? 0);
            }
            break;
          }

          case 'message_delta':
            if (event.delta?.stop_reason) stopReason = toStopReason(event.delta.stop_reason);
            if (event.usage?.output_tokens != null) completionTokens = event.usage.output_tokens;
            break;

          default:
            break;
        }
      }
    } catch (error) {
      if (isAbortError(error, signal)) {
        stopReason = 'aborted';
      } else {
        throw wrapError(error);
      }
    }

    if (signal?.aborted) stopReason = 'aborted';
    callbacks.onEnd?.();

    return {
      text: fullText,
      toolCalls,
      model: servedModel,
      stopReason,
      usage: finalizeUsage(String(params.model), this.id, promptTokens, completionTokens, {
        cacheReadTokens,
        cacheWriteTokens
      })
    };
  }

  async verify(): Promise<AiProviderVerification> {
    if (!this.config.apiKey) {
      return { ok: false, error: 'No API key set.' };
    }

    try {
      // A one-token request is the cheapest proof that the key works and the
      // model is reachable — there is no free "validate key" endpoint.
      await this.client.messages.create({
        model: resolveModel('claude-haiku-4-5', this.id).id,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'Hi' }]
      });
      return { ok: true };
    } catch (error) {
      const wrapped = wrapError(error);
      return { ok: false, error: wrapped.message };
    }
  }
}

function wrapError(error: unknown): AiClientError {
  // The adapter throws these itself for contract violations; re-wrapping one
  // would bury its message under a generic "request failed".
  if (error instanceof AiClientError) return error;

  const status = errorStatus(error);
  if (status === 401) {
    return new AiClientError('Anthropic rejected the API key.', 'anthropic', error, status);
  }
  if (status === 403) {
    return new AiClientError('This Anthropic API key does not have access to the selected model.', 'anthropic', error, status);
  }
  if (status === 404) {
    return new AiClientError(
      'Anthropic does not recognise the selected model. Pick another model in Editor Settings.',
      'anthropic',
      error,
      status
    );
  }
  if (status === 429) {
    return new AiClientError('Anthropic rate limit reached. Try again shortly.', 'anthropic', error, status);
  }
  return new AiClientError(`Anthropic request failed: ${errorMessage(error)}`, 'anthropic', error, status);
}
