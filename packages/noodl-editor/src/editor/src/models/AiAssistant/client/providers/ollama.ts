/**
 * Ollama provider adapter — local models, no API key, no cost.
 *
 * Talks to Ollama's native `/api/chat` rather than its OpenAI-compatible
 * shim: the native endpoint reports token counts and tool calls reliably,
 * and it is the one Ollama itself treats as primary.
 *
 * Local models are first-class here because they are what makes classroom and
 * offline use possible at all — but they are also less capable, so the model
 * registry marks them `local` and features fall back to their simpler
 * single-shot paths.
 *
 * @module AiAssistant/client/providers/ollama
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
import { readNdjson } from '@noodl-models/AiAssistant/client/providers/stream-utils';

import { finalizeUsage } from './usage';

export const OLLAMA_DEFAULT_BASE_URL = 'http://localhost:11434';

export function toOllamaMessages(messages: AiMessage[]): Record<string, unknown>[] {
  return messages.map((message) => {
    if (message.role === 'tool') {
      return {
        role: 'tool',
        // Ollama matches results to calls by name, not by id.
        ...(message.name ? { tool_name: message.name } : {}),
        content: message.content
      };
    }

    if (message.role === 'assistant' && message.toolCalls?.length) {
      return {
        role: 'assistant',
        content: message.content || '',
        tool_calls: message.toolCalls.map((call) => ({
          function: { name: call.name, arguments: call.arguments }
        }))
      };
    }

    return { role: message.role, content: message.content };
  });
}

function toStopReason(doneReason: unknown): AiStopReason {
  switch (doneReason) {
    case 'stop':
      return 'stop';
    case 'length':
      return 'length';
    default:
      return 'stop';
  }
}

/** Ollama tool calls carry no id, so a stable synthetic one is minted. */
function toToolCall(raw: TSFixme, index: number): AiToolCall {
  const name = raw?.function?.name || '';
  const args = raw?.function?.arguments;
  return {
    id: raw?.id || `ollama-tool-${index}-${name}`,
    name,
    arguments: args && typeof args === 'object' ? (args as Record<string, unknown>) : {}
  };
}

export class OllamaProvider implements AiProvider {
  public readonly id = 'ollama' as const;

  private readonly config: AiProviderConfig;
  private readonly fetchImpl: typeof fetch;

  constructor(config: AiProviderConfig) {
    this.config = config;
    this.fetchImpl = config.fetchImpl || ((input, init) => fetch(input, init));
  }

  private get baseUrl(): string {
    return (this.config.baseUrl || OLLAMA_DEFAULT_BASE_URL).replace(/\/+$/, '');
  }

  private buildBody(request: AiChatRequest, stream: boolean): Record<string, unknown> {
    const modelId = request.model;
    if (!modelId) {
      throw new AiClientError('No model specified for the Ollama provider.', this.id);
    }

    const model = resolveModel(modelId, this.id);

    const options: Record<string, unknown> = {};
    if (typeof request.temperature === 'number') options.temperature = request.temperature;
    if (request.maxTokens) options.num_predict = Math.min(request.maxTokens, model.maxOutputTokens);

    const body: Record<string, unknown> = {
      model: modelId,
      messages: toOllamaMessages(request.messages),
      stream
    };

    if (Object.keys(options).length > 0) body.options = options;

    if (request.tools?.length) {
      body.tools = request.tools.map((tool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }
      }));
    }

    return body;
  }

  private async post(body: Record<string, unknown>, signal?: AbortSignal): Promise<Response> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal
      });
    } catch (error) {
      if ((error as TSFixme)?.name === 'AbortError') throw error;
      throw new AiClientError(
        `Could not reach Ollama at ${this.baseUrl}. Is it running? (${(error as Error).message})`,
        this.id,
        error
      );
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => response.statusText);
      if (response.status === 404) {
        throw new AiClientError(
          `Ollama does not have the model "${body.model}" pulled. Run: ollama pull ${body.model}`,
          this.id,
          detail,
          404
        );
      }
      throw new AiClientError(`Ollama request failed (HTTP ${response.status}): ${detail}`, this.id, detail, response.status);
    }

    return response;
  }

  async chat(request: AiChatRequest): Promise<AiChatResponse> {
    const body = this.buildBody(request, false);
    const response = await this.post(body, request.abortController?.signal);
    const json: TSFixme = await response.json();

    const toolCalls = (json.message?.tool_calls || []).map(toToolCall);

    return {
      text: json.message?.content || '',
      toolCalls,
      model: json.model || String(body.model),
      stopReason: toolCalls.length > 0 ? 'tool_calls' : toStopReason(json.done_reason),
      usage: finalizeUsage(String(body.model), this.id, json.prompt_eval_count ?? 0, json.eval_count ?? 0)
    };
  }

  async chatStream(request: AiChatRequest, callbacks: AiStreamCallbacks): Promise<AiChatResponse> {
    const body = this.buildBody(request, true);
    const signal = request.abortController?.signal;
    const response = await this.post(body, signal);

    if (!response.body) {
      throw new AiClientError('Ollama returned no response body to stream.', this.id);
    }

    let fullText = '';
    let promptTokens = 0;
    let completionTokens = 0;
    let stopReason: AiStopReason = 'unknown';
    let servedModel = String(body.model);
    const toolCalls: AiToolCall[] = [];

    try {
      for await (const line of readNdjson(response.body)) {
        if (signal?.aborted) break;

        let chunk: TSFixme;
        try {
          chunk = JSON.parse(line);
        } catch {
          console.warn('[ai] Skipping unparsable Ollama stream line.');
          continue;
        }

        if (chunk.error) {
          throw new AiClientError(`Ollama stream failed: ${chunk.error}`, this.id, chunk.error);
        }

        if (chunk.model) servedModel = chunk.model;

        const delta = chunk.message?.content;
        if (delta) {
          fullText += delta;
          callbacks.onText?.(fullText, delta);
        }

        // Unlike the SSE providers, Ollama emits each tool call complete in a
        // single message — there is nothing to accumulate.
        for (const raw of chunk.message?.tool_calls || []) {
          const call = toToolCall(raw, toolCalls.length);
          toolCalls.push(call);
          callbacks.onToolCall?.(call);
        }

        if (chunk.done) {
          promptTokens = chunk.prompt_eval_count ?? promptTokens;
          completionTokens = chunk.eval_count ?? completionTokens;
          stopReason = toolCalls.length > 0 ? 'tool_calls' : toStopReason(chunk.done_reason);
        }
      }
    } catch (error) {
      if ((error as TSFixme)?.name === 'AbortError' || signal?.aborted) {
        stopReason = 'aborted';
      } else {
        throw error;
      }
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
    const url = `${this.baseUrl}/api/tags`;
    try {
      const response = await this.fetchImpl(url, { method: 'GET' });
      if (!response.ok) {
        return { ok: false, error: `Ollama responded with HTTP ${response.status}.` };
      }
      const json: TSFixme = await response.json();
      const models = (json.models || []).map((item: TSFixme) => item.name || item.model).filter(Boolean);
      if (models.length === 0) {
        return { ok: true, models, error: 'Ollama is running but has no models pulled. Try: ollama pull qwen2.5-coder' };
      }
      return { ok: true, models };
    } catch (error) {
      return {
        ok: false,
        error: `Could not reach Ollama at ${this.baseUrl}. Is it running? (${(error as Error).message})`
      };
    }
  }
}
