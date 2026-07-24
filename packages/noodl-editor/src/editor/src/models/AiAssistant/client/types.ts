/**
 * Provider-agnostic AI client types.
 *
 * The shape here is driven by what the editor's *features* need — send a
 * conversation, stream a response, optionally offer tools and receive tool
 * calls, report usage — not by any one vendor's API. Providers adapt to this;
 * features never branch on provider.
 *
 * @module AiAssistant/client/types
 */

export type AiProviderId = 'anthropic' | 'openai' | 'openai-compatible' | 'ollama';

export const AI_PROVIDER_IDS: readonly AiProviderId[] = [
  'anthropic',
  'openai',
  'openai-compatible',
  'ollama'
] as const;

export type AiMessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface AiToolCall {
  /** Provider-assigned id, echoed back on the matching tool result. */
  id: string;
  name: string;
  /** Parsed arguments. Providers stream JSON text and parse it before emitting. */
  arguments: Record<string, unknown>;
}

export interface AiMessage {
  role: AiMessageRole;
  content: string;
  /** Only on assistant messages that requested tools. */
  toolCalls?: AiToolCall[];
  /** Only on `role: 'tool'` messages — the id of the call being answered. */
  toolCallId?: string;
  /** Only on `role: 'tool'` messages — the tool that was called. */
  name?: string;
}

export interface AiToolDefinition {
  name: string;
  description: string;
  /** JSON Schema for the tool's arguments object. */
  parameters: Record<string, unknown>;
}

/** `auto` lets the model decide; `required` forces at least one call. */
export type AiToolChoice = 'auto' | 'none' | 'required';

export interface AiChatRequest {
  messages: AiMessage[];
  /**
   * Model id. Omit to use whatever the user configured — features should
   * normally omit it, so a single settings change moves every feature.
   */
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: AiToolDefinition[];
  toolChoice?: AiToolChoice;
  abortController?: AbortController;
}

export interface AiUsage {
  promptTokens: number;
  completionTokens: number;
  /**
   * Cost in USD, or `null` when the model has no pricing in the registry
   * (custom endpoints, unknown ids). Null means "unknown", never "free" —
   * local models report 0.
   */
  costUsd: number | null;
}

export type AiStopReason = 'stop' | 'length' | 'tool_calls' | 'aborted' | 'unknown';

export interface AiChatResponse {
  text: string;
  toolCalls: AiToolCall[];
  usage: AiUsage;
  /** The model that actually served the request, as reported by the provider. */
  model: string;
  stopReason: AiStopReason;
}

export interface AiStreamCallbacks {
  /** Called per delta with both the delta and the accumulated text. */
  onText?: (fullText: string, delta: string) => void;
  /** Called once per tool call, when its arguments have finished streaming. */
  onToolCall?: (toolCall: AiToolCall) => void;
  onEnd?: () => void;
}

/** Everything a provider needs to talk to its endpoint. */
export interface AiProviderConfig {
  apiKey?: string;
  /** Base URL override. Providers fall back to their own default. */
  baseUrl?: string;
  /** Injection seam for tests — defaults to global `fetch`. */
  fetchImpl?: typeof fetch;
}

export interface AiProviderVerification {
  ok: boolean;
  /** Model ids the endpoint reports, when it can enumerate them. */
  models?: string[];
  error?: string;
}

export interface AiProvider {
  readonly id: AiProviderId;

  /** Single-shot completion. */
  chat(request: AiChatRequest): Promise<AiChatResponse>;

  /** Streaming completion. Resolves with the same shape once the stream ends. */
  chatStream(request: AiChatRequest, callbacks: AiStreamCallbacks): Promise<AiChatResponse>;

  /** Check credentials/reachability and, where possible, list models. */
  verify(): Promise<AiProviderVerification>;
}

/** Thrown for every provider-side failure, so callers never parse vendor errors. */
export class AiClientError extends Error {
  constructor(
    message: string,
    public readonly provider: AiProviderId | 'none',
    public readonly cause?: unknown,
    public readonly status?: number
  ) {
    super(message);
    this.name = 'AiClientError';
  }
}

/** Thrown when no provider is configured, so the UI can offer a setup path. */
export class AiNotConfiguredError extends AiClientError {
  constructor(message = 'No AI provider is configured. Open Editor Settings to set one up.') {
    super(message, 'none');
    this.name = 'AiNotConfiguredError';
  }
}
