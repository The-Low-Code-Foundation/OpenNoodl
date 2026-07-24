/**
 * OpenAI provider adapter, also used for any OpenAI-compatible endpoint
 * (Azure OpenAI, vLLM, LiteLLM, OpenRouter, a corporate gateway…).
 *
 * The only difference between the two provider ids is the base URL and whether
 * we send OpenAI-only extras, so they share one implementation.
 *
 * @module AiAssistant/client/providers/openai
 */

import { resolveModel } from '@noodl-models/AiAssistant/client/models';
import {
  AiChatRequest,
  AiChatResponse,
  AiClientError,
  AiMessage,
  AiProvider,
  AiProviderConfig,
  AiProviderId,
  AiProviderVerification,
  AiStopReason,
  AiStreamCallbacks,
  AiToolCall
} from '@noodl-models/AiAssistant/client/types';
import { parseToolArguments, readSseData } from '@noodl-models/AiAssistant/client/providers/stream-utils';

import { finalizeUsage } from './usage';

export const OPENAI_DEFAULT_BASE_URL = 'https://api.openai.com/v1';

const DEFAULT_MAX_TOKENS = 4_096;

/**
 * Accept either a base URL (`https://host/v1`) or a full chat-completions URL,
 * because the pre-existing "enterprise" setting stored the latter and users
 * should not have to re-enter it.
 */
export function toChatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '');
  if (trimmed.endsWith('/chat/completions')) return trimmed;
  return `${trimmed}/chat/completions`;
}

export function toModelsUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '');
  if (trimmed.endsWith('/chat/completions')) {
    return `${trimmed.slice(0, -'/chat/completions'.length)}/models`;
  }
  return `${trimmed}/models`;
}

export function toOpenAiMessages(messages: AiMessage[]): Record<string, unknown>[] {
  return messages.map((message) => {
    if (message.role === 'tool') {
      return {
        role: 'tool',
        tool_call_id: message.toolCallId,
        content: message.content
      };
    }

    if (message.role === 'assistant' && message.toolCalls?.length) {
      return {
        role: 'assistant',
        content: message.content || null,
        tool_calls: message.toolCalls.map((call) => ({
          id: call.id,
          type: 'function',
          function: { name: call.name, arguments: JSON.stringify(call.arguments) }
        }))
      };
    }

    return { role: message.role, content: message.content };
  });
}

function toStopReason(raw: unknown): AiStopReason {
  switch (raw) {
    case 'stop':
      return 'stop';
    case 'length':
      return 'length';
    case 'tool_calls':
    case 'function_call':
      return 'tool_calls';
    default:
      return 'unknown';
  }
}

export interface OpenAiProviderConfig extends AiProviderConfig {
  /** Which id this instance reports as — `openai` or `openai-compatible`. */
  providerId?: Extract<AiProviderId, 'openai' | 'openai-compatible'>;
}

export class OpenAiProvider implements AiProvider {
  public readonly id: Extract<AiProviderId, 'openai' | 'openai-compatible'>;

  private readonly config: OpenAiProviderConfig;
  private readonly fetchImpl: typeof fetch;

  constructor(config: OpenAiProviderConfig) {
    this.config = config;
    this.id = config.providerId || 'openai';
    this.fetchImpl = config.fetchImpl || ((input, init) => fetch(input, init));
  }

  private get baseUrl(): string {
    if (this.config.baseUrl) return this.config.baseUrl;
    if (this.id === 'openai-compatible') {
      throw new AiClientError('No endpoint configured for the custom OpenAI-compatible provider.', this.id);
    }
    return OPENAI_DEFAULT_BASE_URL;
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    // Compatible endpoints on a private network often need no key at all.
    if (this.config.apiKey) headers.Authorization = `Bearer ${this.config.apiKey}`;
    return headers;
  }

  private buildBody(request: AiChatRequest, stream: boolean): Record<string, unknown> {
    const modelId = request.model;
    if (!modelId) {
      throw new AiClientError('No model specified for the OpenAI provider.', this.id);
    }

    const model = resolveModel(modelId, this.id);

    const body: Record<string, unknown> = {
      model: modelId,
      messages: toOpenAiMessages(request.messages),
      max_tokens: Math.min(request.maxTokens ?? DEFAULT_MAX_TOKENS, model.maxOutputTokens),
      stream
    };

    if (model.capabilities.sampling && typeof request.temperature === 'number') {
      body.temperature = request.temperature;
    }

    if (stream && this.id === 'openai') {
      // Without this, a streamed OpenAI response reports no usage at all and
      // the cost readout is silently zero. Only sent to OpenAI proper —
      // compatible gateways reject unknown fields.
      body.stream_options = { include_usage: true };
    }

    if (request.tools?.length) {
      body.tools = request.tools.map((tool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }
      }));
      if (request.toolChoice) body.tool_choice = request.toolChoice;
    }

    return body;
  }

  private async post(body: Record<string, unknown>, signal?: AbortSignal): Promise<Response> {
    let response: Response;
    try {
      response = await this.fetchImpl(toChatCompletionsUrl(this.baseUrl), {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
        signal
      });
    } catch (error) {
      if ((error as TSFixme)?.name === 'AbortError') throw error;
      throw new AiClientError(`Could not reach ${this.baseUrl}: ${(error as Error).message}`, this.id, error);
    }

    if (!response.ok) {
      throw await toHttpError(response, this.id);
    }

    return response;
  }

  async chat(request: AiChatRequest): Promise<AiChatResponse> {
    const body = this.buildBody(request, false);
    const response = await this.post(body, request.abortController?.signal);
    const json: TSFixme = await response.json();

    const choice = json.choices?.[0];
    const toolCalls: AiToolCall[] = (choice?.message?.tool_calls || []).map((call: TSFixme) => ({
      id: call.id,
      name: call.function?.name,
      arguments: parseToolArguments(call.function?.arguments || '')
    }));

    return {
      text: choice?.message?.content || '',
      toolCalls,
      model: json.model || String(body.model),
      stopReason: toStopReason(choice?.finish_reason),
      usage: finalizeUsage(
        String(body.model),
        this.id,
        json.usage?.prompt_tokens ?? 0,
        json.usage?.completion_tokens ?? 0
      )
    };
  }

  async chatStream(request: AiChatRequest, callbacks: AiStreamCallbacks): Promise<AiChatResponse> {
    const body = this.buildBody(request, true);
    const signal = request.abortController?.signal;
    const response = await this.post(body, signal);

    if (!response.body) {
      throw new AiClientError('The endpoint returned no response body to stream.', this.id);
    }

    let fullText = '';
    let promptTokens = 0;
    let completionTokens = 0;
    let stopReason: AiStopReason = 'unknown';
    let servedModel = String(body.model);

    // Tool calls arrive as fragments keyed by `index`, with the id and name on
    // the first fragment only, so they are assembled before being emitted.
    const pendingTools = new Map<number, { id: string; name: string; json: string }>();

    try {
      for await (const data of readSseData(response.body)) {
        if (signal?.aborted) break;

        let chunk: TSFixme;
        try {
          chunk = JSON.parse(data);
        } catch {
          // A malformed keepalive or proxy artefact must not kill the stream.
          console.warn('[ai] Skipping unparsable stream chunk.');
          continue;
        }

        if (chunk.error) {
          // Some gateways report mid-stream failures in-band with HTTP 200.
          throw new AiClientError(
            `Stream failed: ${chunk.error.message || JSON.stringify(chunk.error)}`,
            this.id,
            chunk.error
          );
        }

        if (chunk.model) servedModel = chunk.model;
        if (chunk.usage) {
          promptTokens = chunk.usage.prompt_tokens ?? promptTokens;
          completionTokens = chunk.usage.completion_tokens ?? completionTokens;
        }

        const choice = chunk.choices?.[0];
        if (!choice) continue;

        if (choice.finish_reason) stopReason = toStopReason(choice.finish_reason);

        const delta = choice.delta;
        if (delta?.content) {
          fullText += delta.content;
          callbacks.onText?.(fullText, delta.content);
        }

        for (const call of delta?.tool_calls || []) {
          const index = call.index ?? 0;
          const pending = pendingTools.get(index) || { id: '', name: '', json: '' };
          if (call.id) pending.id = call.id;
          if (call.function?.name) pending.name = call.function.name;
          if (call.function?.arguments) pending.json += call.function.arguments;
          pendingTools.set(index, pending);
        }
      }
    } catch (error) {
      if ((error as TSFixme)?.name === 'AbortError' || signal?.aborted) {
        stopReason = 'aborted';
      } else {
        throw error;
      }
    }

    const toolCalls: AiToolCall[] = [];
    for (const pending of [...pendingTools.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v)) {
      const call: AiToolCall = {
        id: pending.id,
        name: pending.name,
        arguments: parseToolArguments(pending.json)
      };
      toolCalls.push(call);
      callbacks.onToolCall?.(call);
    }

    if (signal?.aborted) stopReason = 'aborted';
    callbacks.onEnd?.();

    return {
      text: fullText,
      toolCalls,
      model: servedModel,
      stopReason,
      usage: finalizeUsage(String(body.model), this.id, promptTokens, completionTokens)
    };
  }

  async verify(): Promise<AiProviderVerification> {
    if (this.id === 'openai' && !this.config.apiKey) {
      return { ok: false, error: 'No API key set.' };
    }

    let url: string;
    try {
      url = toModelsUrl(this.baseUrl);
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }

    try {
      const response = await this.fetchImpl(url, { method: 'GET', headers: this.headers() });
      if (!response.ok) {
        const error = await toHttpError(response, this.id);
        return { ok: false, error: error.message };
      }
      const json: TSFixme = await response.json();
      const models = (json.data || []).map((item: TSFixme) => item.id).filter(Boolean);
      return { ok: true, models };
    } catch (error) {
      return { ok: false, error: `Could not reach ${url}: ${(error as Error).message}` };
    }
  }
}

async function toHttpError(response: Response, provider: AiProviderId): Promise<AiClientError> {
  let detail = '';
  try {
    const text = await response.text();
    try {
      const json = JSON.parse(text);
      detail = json?.error?.message || text;
    } catch {
      detail = text;
    }
  } catch {
    detail = response.statusText;
  }

  if (response.status === 401) {
    return new AiClientError('The endpoint rejected the API key.', provider, detail, 401);
  }
  if (response.status === 404) {
    return new AiClientError(
      'The endpoint does not recognise the selected model or path. Check the model and endpoint in Editor Settings.',
      provider,
      detail,
      404
    );
  }
  if (response.status === 429) {
    return new AiClientError('Rate limit reached. Try again shortly.', provider, detail, 429);
  }

  return new AiClientError(`Request failed (HTTP ${response.status}): ${detail}`, provider, detail, response.status);
}
