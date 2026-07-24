/**
 * Central model registry.
 *
 * MAINTENANCE ITEM. This file is the one place model ids, context sizes and
 * pricing live. Keeping it current is a config change here, not a code change
 * anywhere else — no other module may hardcode a model id. The predecessor of
 * this subsystem rotted precisely because ids were scattered through templates
 * and agent loops.
 *
 * Adding a model: append an entry. Retiring one: delete it and, if it was a
 * default, move the `isDefault` flag. Nothing else needs to change.
 *
 * @module AiAssistant/client/models
 */

import { AiProviderId } from '@noodl-models/AiAssistant/client/types';

/**
 * Prices below were correct on this date. They are used only for the cost
 * readout; a stale price never breaks a request.
 */
export const PRICING_AS_OF = '2026-07-24';

/**
 * Rough capability bands. Features use these instead of matching model ids, so
 * a new model slots in without touching feature code.
 *
 * - `frontier`  — best available; multi-step agent flows are reliable
 * - `balanced`  — good general models; agent flows are reliable
 * - `small`     — fast/cheap; prefer single-shot prompts over agent loops
 * - `local`     — runs on the user's machine; assume `small` capability
 */
export type AiModelTier = 'frontier' | 'balanced' | 'small' | 'local';

export interface AiModelPricing {
  /** USD per million input tokens. */
  inputPerMTok: number;
  /** USD per million output tokens. */
  outputPerMTok: number;
}

export interface AiModelDefinition {
  /** The id sent on the wire. */
  id: string;
  provider: AiProviderId;
  displayName: string;
  tier: AiModelTier;
  contextWindow: number;
  maxOutputTokens: number;
  /** Omitted when unknown (e.g. self-hosted); cost is then reported as null. */
  pricing?: AiModelPricing;
  capabilities: {
    streaming: boolean;
    tools: boolean;
    /**
     * Whether the multi-step ReAct/agent templates should be used. False for
     * small and local models, which do better on the single-shot path.
     */
    agentFlow: boolean;
    /**
     * Whether the model accepts sampling parameters (`temperature` and
     * friends). Anthropic's current frontier models reject them with a 400, so
     * the adapter drops them rather than letting a feature's `temperature: 0`
     * break every request.
     */
    sampling: boolean;
    /**
     * Whether the model supports Anthropic adaptive thinking. Enabled with
     * `display: 'omitted'` so reasoning never leaks into the response text the
     * XML templates parse.
     */
    adaptiveThinking?: boolean;
  };
  /** The default pick for its provider. Exactly one per provider. */
  isDefault?: boolean;
}

const frontier = { streaming: true, tools: true, agentFlow: true, sampling: true } as const;
const small = { streaming: true, tools: true, agentFlow: false, sampling: true } as const;
const claudeFrontier = {
  streaming: true,
  tools: true,
  agentFlow: true,
  sampling: false,
  adaptiveThinking: true
} as const;

export const AI_MODELS: readonly AiModelDefinition[] = [
  // --- Anthropic ---------------------------------------------------------
  {
    id: 'claude-opus-4-8',
    provider: 'anthropic',
    displayName: 'Claude Opus 4.8',
    tier: 'frontier',
    contextWindow: 1_000_000,
    maxOutputTokens: 128_000,
    pricing: { inputPerMTok: 5.0, outputPerMTok: 25.0 },
    capabilities: claudeFrontier,
    isDefault: true
  },
  {
    id: 'claude-sonnet-5',
    provider: 'anthropic',
    displayName: 'Claude Sonnet 5',
    tier: 'balanced',
    contextWindow: 1_000_000,
    maxOutputTokens: 128_000,
    pricing: { inputPerMTok: 3.0, outputPerMTok: 15.0 },
    capabilities: claudeFrontier
  },
  {
    id: 'claude-haiku-4-5',
    provider: 'anthropic',
    displayName: 'Claude Haiku 4.5',
    tier: 'small',
    contextWindow: 200_000,
    maxOutputTokens: 64_000,
    pricing: { inputPerMTok: 1.0, outputPerMTok: 5.0 },
    capabilities: small
  },

  // --- OpenAI ------------------------------------------------------------
  {
    id: 'gpt-4.1',
    provider: 'openai',
    displayName: 'GPT-4.1',
    tier: 'frontier',
    contextWindow: 1_047_576,
    maxOutputTokens: 32_768,
    pricing: { inputPerMTok: 2.0, outputPerMTok: 8.0 },
    capabilities: frontier,
    isDefault: true
  },
  {
    id: 'gpt-4.1-mini',
    provider: 'openai',
    displayName: 'GPT-4.1 mini',
    tier: 'balanced',
    contextWindow: 1_047_576,
    maxOutputTokens: 32_768,
    pricing: { inputPerMTok: 0.4, outputPerMTok: 1.6 },
    capabilities: frontier
  },
  {
    id: 'gpt-4o',
    provider: 'openai',
    displayName: 'GPT-4o',
    tier: 'balanced',
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    pricing: { inputPerMTok: 2.5, outputPerMTok: 10.0 },
    capabilities: frontier
  },
  {
    id: 'gpt-4o-mini',
    provider: 'openai',
    displayName: 'GPT-4o mini',
    tier: 'small',
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    pricing: { inputPerMTok: 0.15, outputPerMTok: 0.6 },
    capabilities: small
  },

  // --- Ollama (local) ----------------------------------------------------
  // Local models are discovered at runtime from /api/tags; these are seeds so
  // the settings UI has something to show before a connection is made. Context
  // windows depend on how the model was pulled, so they are conservative.
  {
    id: 'qwen2.5-coder:7b',
    provider: 'ollama',
    displayName: 'Qwen2.5 Coder 7B (local)',
    tier: 'local',
    contextWindow: 32_768,
    maxOutputTokens: 8_192,
    pricing: { inputPerMTok: 0, outputPerMTok: 0 },
    capabilities: { streaming: true, tools: true, agentFlow: false, sampling: true },
    isDefault: true
  },
  {
    id: 'llama3.1:8b',
    provider: 'ollama',
    displayName: 'Llama 3.1 8B (local)',
    tier: 'local',
    contextWindow: 32_768,
    maxOutputTokens: 8_192,
    pricing: { inputPerMTok: 0, outputPerMTok: 0 },
    capabilities: { streaming: true, tools: true, agentFlow: false, sampling: true }
  }
];

/** What an unregistered model id gets: usable, but with unknown pricing. */
export function unknownModel(id: string, provider: AiProviderId): AiModelDefinition {
  return {
    id,
    provider,
    displayName: id,
    tier: provider === 'ollama' ? 'local' : 'balanced',
    contextWindow: 32_768,
    maxOutputTokens: 4_096,
    pricing: provider === 'ollama' ? { inputPerMTok: 0, outputPerMTok: 0 } : undefined,
    capabilities: {
      streaming: true,
      tools: false,
      agentFlow: provider !== 'ollama',
      // An unknown Anthropic id is far more likely to be a new frontier model
      // (which rejects sampling params) than an old one, so assume it does.
      sampling: provider !== 'anthropic'
    }
  };
}

export function getModelsForProvider(provider: AiProviderId): AiModelDefinition[] {
  // `openai-compatible` points at an arbitrary OpenAI-shaped endpoint, so the
  // model list is whatever the user types — but the OpenAI catalogue is a
  // reasonable starting set for Azure and friends.
  const lookup = provider === 'openai-compatible' ? 'openai' : provider;
  return AI_MODELS.filter((x) => x.provider === lookup);
}

export function findModel(id: string, provider?: AiProviderId): AiModelDefinition | undefined {
  if (provider) {
    const lookup = provider === 'openai-compatible' ? 'openai' : provider;
    return AI_MODELS.find((x) => x.id === id && x.provider === lookup);
  }
  return AI_MODELS.find((x) => x.id === id);
}

export function getDefaultModel(provider: AiProviderId): AiModelDefinition {
  const models = getModelsForProvider(provider);
  const found = models.find((x) => x.isDefault) || models[0];
  if (!found) {
    throw new Error(`No models registered for provider "${provider}".`);
  }
  return found;
}

/**
 * Resolve a model id to its definition, falling back to a permissive
 * unknown-model entry so custom endpoints and freshly released ids still work.
 */
export function resolveModel(id: string, provider: AiProviderId): AiModelDefinition {
  return findModel(id, provider) || unknownModel(id, provider);
}

export function calculateCostUsd(
  model: AiModelDefinition,
  promptTokens: number,
  completionTokens: number
): number | null {
  if (!model.pricing) return null;
  const cost =
    (promptTokens / 1_000_000) * model.pricing.inputPerMTok +
    (completionTokens / 1_000_000) * model.pricing.outputPerMTok;
  // Sub-cent precision matters here: a single node generation is fractions of
  // a cent, and rounding to 4 dp would report every call as $0.
  return Math.round(cost * 1_000_000) / 1_000_000;
}
