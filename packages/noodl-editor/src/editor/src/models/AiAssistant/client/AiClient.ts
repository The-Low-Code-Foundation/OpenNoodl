/**
 * The editor's single AI client.
 *
 * Every AI feature calls through here. It resolves the user's configured
 * provider, model, endpoint and credentials, hands the request to the matching
 * adapter, and reports usage. Features never construct a provider themselves
 * and never branch on which one is active.
 *
 * @module AiAssistant/client/AiClient
 */

import { AiConfigStore } from '@noodl-store/AiAssistantStore';

import { AiModelDefinition, resolveModel } from '@noodl-models/AiAssistant/client/models';
import {
  bindRoleConfig,
  resolveRole,
  roleRequestFields,
  type AiRoleRequestFields,
  type ResolvedRole
} from '@noodl-models/AiAssistant/client/roles';
import { AnthropicProvider } from '@noodl-models/AiAssistant/client/providers/anthropic';
import { OllamaProvider } from '@noodl-models/AiAssistant/client/providers/ollama';
import { OpenAiProvider } from '@noodl-models/AiAssistant/client/providers/openai';
import {
  AiChatRequest,
  AiChatResponse,
  AiNotConfiguredError,
  AiProvider,
  AiProviderConfig,
  AiProviderId,
  AiProviderVerification,
  AiRole,
  AiStreamCallbacks,
  AiUsage
} from '@noodl-models/AiAssistant/client/types';

export interface AiUsageRecord {
  provider: AiProviderId;
  model: string;
  usage: AiUsage;
  at: number;
  /** LAS-009 — which of design/plan/act issued it, when the caller said. */
  role?: AiRole;
}

/**
 * Build a provider adapter from an explicit config. Exported for the settings
 * UI, which needs to verify credentials the user has typed but not yet saved.
 */
export function createProvider(providerId: AiProviderId, config: AiProviderConfig): AiProvider {
  switch (providerId) {
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'openai':
      return new OpenAiProvider({ ...config, providerId: 'openai' });
    case 'openai-compatible':
      return new OpenAiProvider({ ...config, providerId: 'openai-compatible' });
    case 'ollama':
      return new OllamaProvider(config);
    default: {
      // Exhaustiveness guard: a new provider id must be handled here.
      const never: never = providerId;
      throw new Error(`Unknown AI provider: ${never}`);
    }
  }
}

/** In-memory usage log for the current editor session. */
const usageLog: AiUsageRecord[] = [];

function record(provider: AiProviderId, response: AiChatResponse, role?: AiRole) {
  usageLog.push({ provider, model: response.model, usage: response.usage, at: Date.now(), ...(role ? { role } : {}) });
  const { promptTokens, completionTokens, cacheReadTokens, cacheWriteTokens, costUsd } = response.usage;
  // AIX-007: `promptTokens` is the uncached remainder, so the cached share is
  // logged beside it — otherwise a cached turn reads as a tiny prompt.
  const cached = cacheReadTokens > 0 || cacheWriteTokens > 0 ? ` (+${cacheReadTokens} cached, ${cacheWriteTokens} written)` : '';
  // LAS-009: the role prefix is what makes a split configuration readable at
  // all — it is the difference between "two models ran" and knowing which one
  // planned and which one built.
  console.debug(
    `[ai] ${role ? `${role}: ` : ''}${provider}/${response.model} — ${promptTokens} in${cached} / ` +
      `${completionTokens} out, ${costUsd === null ? 'cost unknown' : `$${costUsd.toFixed(6)}`}`
  );
}

export const AiClient = {
  isConfigured(): boolean {
    return AiConfigStore.isConfigured();
  },

  /**
   * The model that requests will use, or null when AI is off. Features read
   * `capabilities` off this to decide how much to ask of the model rather than
   * checking model ids.
   */
  getActiveModel(): AiModelDefinition | null {
    const provider = AiConfigStore.getActiveProvider();
    if (!provider) return null;
    return resolveModel(AiConfigStore.getModel(provider), provider);
  },

  /**
   * Whether the configured model is capable enough for the multi-step agent
   * templates. Small and local models get the single-shot path instead.
   */
  supportsAgentFlow(): boolean {
    return this.getActiveModel()?.capabilities.agentFlow ?? false;
  },

  /**
   * LAS-009 — resolve a role against the user's settings. Call once, when a
   * session starts, and spread the result onto every request that session
   * sends: resolving per request would let a settings change move the model
   * mid-conversation, which makes a transcript impossible to read back.
   *
   * An unset role (the shipped default, and what almost every user will have)
   * contributes only the `role` label, so the request is otherwise identical
   * to the one that would have been sent before this existed.
   */
  resolveRole(role: AiRole): ResolvedRole {
    return resolveRole(role, bindRoleConfig(AiConfigStore));
  },

  /**
   * The request fields a role contributes, or nothing at all for `'global'` —
   * the opt-out that reproduces the exact pre-LAS-009 request, which is what
   * the measurement harness wants when it is sweeping one variable at a time.
   * See {@link AiClient.resolveRole}.
   */
  roleRequestFields(role: AiRole | 'global'): AiRoleRequestFields {
    if (role === 'global') return {};
    return roleRequestFields(this.resolveRole(role));
  },

  /**
   * The adapter a request will be served by. Defaults to the active provider;
   * LAS-009 passes an override so a per-role selection can send one session's
   * turns somewhere else entirely (Opus plans, a local model acts).
   *
   * Note the override is still checked against that provider's own
   * credentials — a role pointing at an unconfigured provider fails here with
   * the same message the user would get from the main picker, not silently on
   * the active one's key.
   */
  async getProvider(providerId?: AiProviderId): Promise<AiProvider> {
    const target = providerId || AiConfigStore.getActiveProvider();
    if (!target) {
      throw new AiNotConfiguredError();
    }

    if (!AiConfigStore.isConfigured(target)) {
      throw new AiNotConfiguredError(
        target === 'openai-compatible'
          ? 'No endpoint is set for the custom AI provider. Open Editor Settings to add one.'
          : `No API key is set for ${target}. Open Editor Settings to add one.`
      );
    }

    const endpoint = AiConfigStore.getEndpoint(target);
    return createProvider(target, {
      apiKey: (await AiConfigStore.getApiKey(target)) || undefined,
      baseUrl: endpoint || undefined
    });
  },

  async chat(request: AiChatRequest): Promise<AiChatResponse> {
    const provider = await this.getProvider(request.provider);
    const response = await provider.chat(withConfiguredModel(request));
    record(provider.id, response, request.role);
    return response;
  },

  async chatStream(request: AiChatRequest, callbacks: AiStreamCallbacks = {}): Promise<AiChatResponse> {
    const provider = await this.getProvider(request.provider);
    const response = await provider.chatStream(withConfiguredModel(request), callbacks);
    record(provider.id, response, request.role);
    return response;
  },

  /** Verify a provider's configuration. Defaults to the active one. */
  async verify(providerId?: AiProviderId, override?: AiProviderConfig): Promise<AiProviderVerification> {
    const target = providerId || AiConfigStore.getActiveProvider();
    if (!target) return { ok: false, error: 'AI is disabled.' };

    const config: AiProviderConfig = override || {
      apiKey: (await AiConfigStore.getApiKey(target)) || undefined,
      baseUrl: AiConfigStore.getEndpoint(target) || undefined
    };

    return createProvider(target, config).verify();
  },

  getUsageLog(): readonly AiUsageRecord[] {
    return usageLog;
  },

  /** Total spend this editor session, ignoring models with unknown pricing. */
  getSessionCostUsd(): number {
    return usageLog.reduce((total, entry) => total + (entry.usage.costUsd ?? 0), 0);
  },

  /**
   * LAS-009 — spend this editor session, split by role, so a user running a
   * strong planner and a cheap builder can see what the split actually costs.
   * Untagged turns (explain, review, the legacy copilot) are grouped under
   * `global`.
   *
   * ⚠️ Editor-session totals, not per-run: this log spans the whole editor
   * lifetime and has no run boundary in it. The per-run cost line in the
   * authoring panel is fed by `PlanRun`, not by this — see F34.
   */
  getSessionCostByRole(): Record<AiRole | 'global', number> {
    const totals: Record<AiRole | 'global', number> = { design: 0, plan: 0, act: 0, global: 0 };
    for (const entry of usageLog) {
      totals[entry.role ?? 'global'] += entry.usage.costUsd ?? 0;
    }
    return totals;
  }
};

/**
 * Features may omit `model`; the user's configured model is filled in here.
 *
 * LAS-009: when the request names a provider, the model has to come from *that*
 * provider's settings. Filling from the active one instead is how a Claude
 * model id gets sent to Ollama — the request would reach the right endpoint
 * carrying a model that endpoint has never heard of.
 */
function withConfiguredModel(request: AiChatRequest): AiChatRequest {
  if (request.model) return request;
  return { ...request, model: AiConfigStore.getModel(request.provider) };
}
