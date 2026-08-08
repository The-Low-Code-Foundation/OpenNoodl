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

/**
 * LAS-009 — the three jobs a build is made of, which a user may point at
 * different models. Defined here rather than in `roles.ts` so that a request
 * can carry one without `types.ts` and `roles.ts` importing each other;
 * `roles.ts` re-exports it and owns everything else about roles.
 */
export type AiRole = 'design' | 'plan' | 'act';

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
  /**
   * Prompt-cache boundary, as a character offset into `content`: everything
   * before it is byte-stable across requests (handed-out context), everything
   * after it varies per request (the task itself). Providers with prefix
   * caching may split the message here and set a cache breakpoint on the
   * stable half; every other provider ignores it and sends `content` whole.
   *
   * Only meaningful on a message whose stable part is worth caching — the
   * opening turn. Caching is a prefix match, so a message carrying this must
   * be ordered stable-first; see `prompts/authoring.ts`.
   */
  cacheBoundary?: number;
}

export interface AiToolDefinition {
  name: string;
  description: string;
  /** JSON Schema for the tool's arguments object. */
  parameters: Record<string, unknown>;
}

/** `auto` lets the model decide; `required` forces at least one call. */
export type AiToolChoice = 'auto' | 'none' | 'required';

/**
 * How much reasoning to spend on a request, cheapest first. Providers that
 * expose a reasoning-depth control map this onto it; the rest ignore it.
 *
 * Unset does NOT mean "cheap": Anthropic's default is `high`, so every call
 * site that cares about cost should say what it wants rather than inherit.
 */
export type AiEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export const AI_EFFORT_LEVELS: readonly AiEffort[] = ['low', 'medium', 'high', 'xhigh', 'max'] as const;

export interface AiChatRequest {
  messages: AiMessage[];
  /**
   * Model id. Omit to use whatever the user configured — features should
   * normally omit it, so a single settings change moves every feature.
   */
  model?: string;
  /**
   * LAS-009 — send this request to a provider other than the active one.
   * Omit for everything except a per-role override, which is the only thing
   * that should ever contradict the user's chosen provider.
   *
   * Set this and you almost always want `model` set too: the two are resolved
   * together by `resolveRole`, because the active provider's model id means
   * nothing to a different provider.
   */
  provider?: AiProviderId;
  /**
   * LAS-009 — which of design/plan/act issued this request. Purely a label:
   * it tags the usage log and the `[ai]` console line so a split configuration
   * can be read back, and it never affects routing. Routing is `provider` and
   * `model`, both already resolved by the time a request is built.
   */
  role?: AiRole;
  temperature?: number;
  maxTokens?: number;
  tools?: AiToolDefinition[];
  toolChoice?: AiToolChoice;
  /**
   * Reasoning depth. Omit only when the call site genuinely has no opinion —
   * omitting inherits the provider's default, which on Anthropic is `high`
   * and is the expensive end of the range.
   */
  effort?: AiEffort;
  abortController?: AbortController;
}

export interface AiUsage {
  /**
   * Input tokens billed at the full input rate. This is the *uncached*
   * remainder: when a provider serves part of the prefix from its prompt
   * cache, those tokens are reported in `cacheReadTokens` instead and are NOT
   * counted here. Total prompt size is the sum of all three input fields —
   * see `totalPromptTokens`.
   */
  promptTokens: number;
  completionTokens: number;
  /**
   * Input tokens served from the provider's prompt cache, billed at ~0.1x the
   * input rate. Non-zero only where the provider both supports caching and
   * found a matching prefix; zero is a real answer, not "unknown".
   */
  cacheReadTokens: number;
  /**
   * Input tokens written to the provider's prompt cache, billed at ~1.25x the
   * input rate (5-minute TTL). Paid once, to make the reads above cheap.
   */
  cacheWriteTokens: number;
  /**
   * Cost in USD, or `null` when the model has no pricing in the registry
   * (custom endpoints, unknown ids). Null means "unknown", never "free" —
   * local models report 0.
   */
  costUsd: number | null;
}

/**
 * Every input token the request actually carried, cached or not. Use this —
 * never `promptTokens` alone — when comparing prompt size across runs: caching
 * moves tokens between the three fields without changing what was sent, so
 * `promptTokens` on its own drops the moment caching lands and flatters the
 * comparison.
 */
export function totalPromptTokens(usage: AiUsage): number {
  return usage.promptTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
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
  /**
   * Called per argument fragment of an in-flight tool call, with the
   * accumulated (still incomplete) JSON text — the tool-call analogue of
   * `onText`. `index` distinguishes parallel calls in one response. Providers
   * that receive arguments whole (Ollama) never call this; consumers must
   * treat it as best-effort progress, with `onToolCall` as the source of truth.
   */
  onToolCallPartial?: (partial: { index: number; name: string; argsText: string }) => void;
  /** Called once per tool call, when its arguments have finished streaming. */
  onToolCall?: (toolCall: AiToolCall) => void;
  /**
   * AIB-009 F11: called once per event received from the provider's stream,
   * including the ones that carry nothing a user would see — pings, keepalives,
   * and the reasoning deltas this client deliberately drops.
   *
   * It reports that the stream is *alive*, not that the model said anything, and
   * it is the only signal that separates a model thinking hard from a provider
   * that has stopped answering. `withTurnDeadline` is its consumer.
   */
  onActivity?: () => void;
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
