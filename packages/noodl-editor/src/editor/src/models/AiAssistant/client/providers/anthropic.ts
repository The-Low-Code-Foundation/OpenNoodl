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
  input_tokens?: number;
  output_tokens?: number;
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

/**
 * Translate our flat message list into Anthropic's system + messages split.
 *
 * Three things need care: system messages are hoisted out entirely; assistant
 * tool calls become `tool_use` blocks; and tool results become `user` messages
 * with `tool_result` blocks, merged when adjacent so parallel calls answer in
 * a single turn (splitting them trains the model out of parallel calls).
 */
export function toAnthropicMessages(messages: AiMessage[]): {
  system: string | undefined;
  messages: AnthropicRequestMessage[];
} {
  const systemParts: string[] = [];
  const out: AnthropicRequestMessage[] = [];

  for (const message of messages) {
    if (message.role === 'system') {
      if (message.content) systemParts.push(message.content);
      continue;
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
    messages: out
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
    const { system, messages } = toAnthropicMessages(request.messages);

    const params: Record<string, unknown> = {
      model: modelId,
      max_tokens: Math.min(request.maxTokens ?? DEFAULT_MAX_TOKENS, model.maxOutputTokens),
      messages,
      ...(stream ? { stream: true } : {})
    };

    if (system) params.system = system;

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
      usage: finalizeUsage(
        String(params.model),
        this.id,
        raw.usage?.input_tokens ?? 0,
        raw.usage?.output_tokens ?? 0
      )
    };
  }

  async chatStream(request: AiChatRequest, callbacks: AiStreamCallbacks): Promise<AiChatResponse> {
    const params = this.buildParams(request, true);
    const signal = request.abortController?.signal;

    let fullText = '';
    const toolCalls: AiToolCall[] = [];
    let promptTokens = 0;
    let completionTokens = 0;
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
      usage: finalizeUsage(String(params.model), this.id, promptTokens, completionTokens)
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
