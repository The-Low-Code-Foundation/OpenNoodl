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
  AiStreamCallbacks,
  AiUsage
} from '@noodl-models/AiAssistant/client/types';

export interface AiUsageRecord {
  provider: AiProviderId;
  model: string;
  usage: AiUsage;
  at: number;
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

function record(provider: AiProviderId, response: AiChatResponse) {
  usageLog.push({ provider, model: response.model, usage: response.usage, at: Date.now() });
  const cost = response.usage.costUsd;
  console.debug(
    `[ai] ${provider}/${response.model} — ${response.usage.promptTokens} in / ` +
      `${response.usage.completionTokens} out, ${cost === null ? 'cost unknown' : `$${cost.toFixed(6)}`}`
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

  async getProvider(): Promise<AiProvider> {
    const providerId = AiConfigStore.getActiveProvider();
    if (!providerId) {
      throw new AiNotConfiguredError();
    }

    if (!AiConfigStore.isConfigured()) {
      throw new AiNotConfiguredError(
        providerId === 'openai-compatible'
          ? 'No endpoint is set for the custom AI provider. Open Editor Settings to add one.'
          : `No API key is set for ${providerId}. Open Editor Settings to add one.`
      );
    }

    const endpoint = AiConfigStore.getEndpoint(providerId);
    return createProvider(providerId, {
      apiKey: (await AiConfigStore.getApiKey(providerId)) || undefined,
      baseUrl: endpoint || undefined
    });
  },

  async chat(request: AiChatRequest): Promise<AiChatResponse> {
    const provider = await this.getProvider();
    const response = await provider.chat(withConfiguredModel(request));
    record(provider.id, response);
    return response;
  },

  async chatStream(request: AiChatRequest, callbacks: AiStreamCallbacks = {}): Promise<AiChatResponse> {
    const provider = await this.getProvider();
    const response = await provider.chatStream(withConfiguredModel(request), callbacks);
    record(provider.id, response);
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
  }
};

/** Features may omit `model`; the user's configured model is filled in here. */
function withConfiguredModel(request: AiChatRequest): AiChatRequest {
  if (request.model) return request;
  return { ...request, model: AiConfigStore.getModel() };
}
