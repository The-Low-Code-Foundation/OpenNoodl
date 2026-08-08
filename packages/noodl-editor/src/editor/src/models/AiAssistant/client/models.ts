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

import { AiProviderId, AiRole } from '@noodl-models/AiAssistant/client/types';

/**
 * Prices below were correct on this date. They are used only for the cost
 * readout; a stale price never breaks a request.
 */
export const PRICING_AS_OF = '2026-07-26';

/**
 * Prompt-cache rate multipliers, applied to a model's *input* price.
 *
 * A cache read costs a tenth of a fresh input token; a cache write costs a
 * quarter more than one. With the 5-minute TTL that is break-even at two
 * requests — which is why the authoring loop, at 2–3 turns, is worth caching
 * at all. The 1-hour TTL doubles the write instead (2x) and needs three reads
 * to pay for itself; this traffic shape does not reliably deliver them, so it
 * is deliberately not used.
 */
export const CACHE_READ_MULTIPLIER = 0.1;
export const CACHE_WRITE_MULTIPLIER = 1.25;

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
  /**
   * Roles this model is recommended for, best-first within each role.
   *
   * LAS-011. The phase-55 acceptance matrix ended in a decision about which
   * models to point people at, and this is where that decision lives so the
   * settings UI and the docs cannot drift from each other. Richard's wording:
   * Opus for scoping larger creations and high-level design, Sonnet for the
   * creation work.
   */
  recommendedFor?: readonly AiRole[];
  /**
   * Whether this model was actually replayed against the storefront benchmark.
   *
   * The distinction is load-bearing, not decorative. Three models were measured
   * in phase 55; every other recommendation here rests on reputation, including
   * the peers Richard explicitly waived testing for. A table that cannot tell
   * you which is which quietly upgrades an assumption into evidence — the exact
   * failure this phase spent six sessions documenting.
   */
  measured: boolean;
  /** Open weights, wherever it happens to be hosted. Informational. */
  openWeights?: boolean;
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
    /**
     * Whether the model accepts a reasoning-depth setting (`output_config.effort`
     * on Anthropic). Absent means the adapter must not send one — an unsupported
     * model rejects it rather than ignoring it.
     */
    effort?: boolean;
    /**
     * Whether the provider caches a repeated prompt prefix for this model, so
     * the adapter should place cache breakpoints. Cheap when it works and free
     * when it does not — but the flag keeps `cache_control` off models whose
     * API would reject the field.
     */
    promptCaching?: boolean;
    /**
     * Smallest prefix the provider will cache, in tokens. A shorter prefix is
     * silently not cached — no error, just no hit — so this is documentation
     * for whoever wonders why a breakpoint did nothing.
     */
    minCacheableTokens?: number;
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
  adaptiveThinking: true,
  effort: true,
  promptCaching: true,
  minCacheableTokens: 1024
} as const;

export const AI_MODELS: readonly AiModelDefinition[] = [
  // --- Anthropic ---------------------------------------------------------
  {
    // LAS-011. Added on Richard's verdict: "recommend Opus for scoping larger
    // creations and doing high level design". The registry had only Opus 4.8
    // when that was written, so the recommendation had no model to point at.
    id: 'claude-opus-5',
    provider: 'anthropic',
    displayName: 'Claude Opus 5',
    tier: 'frontier',
    contextWindow: 1_000_000,
    maxOutputTokens: 128_000,
    pricing: { inputPerMTok: 5.0, outputPerMTok: 25.0 },
    capabilities: claudeFrontier,
    recommendedFor: ['design', 'plan'],
    measured: false
  },
  {
    id: 'claude-opus-4-8',
    provider: 'anthropic',
    displayName: 'Claude Opus 4.8',
    tier: 'frontier',
    contextWindow: 1_000_000,
    maxOutputTokens: 128_000,
    pricing: { inputPerMTok: 5.0, outputPerMTok: 25.0 },
    capabilities: claudeFrontier,
    measured: false
  },
  {
    id: 'claude-sonnet-5',
    provider: 'anthropic',
    displayName: 'Claude Sonnet 5',
    tier: 'balanced',
    contextWindow: 1_000_000,
    maxOutputTokens: 128_000,
    // MAINTENANCE: introductory pricing, $2/$10, ends 2026-08-31 — after that
    // this entry reverts to the standard $3/$15. A stale price here does not
    // break requests, it only misreports cost.
    pricing: { inputPerMTok: 2.0, outputPerMTok: 10.0 },
    capabilities: claudeFrontier,
    // AIX-007: the default moved here from `claude-opus-4-8` on measurement,
    // not on tier. Over the 8-prompt authoring corpus both reached 8/8
    // first-attempt validity; Sonnet did it at $0.0352/component against
    // Opus's $0.0923, and faster. Opus stays one click away for anyone who
    // wants it. Re-check with the measurement harness before moving this.
    isDefault: true,
    // LAS-011: the only model that cleared the phase-55 storefront bar. It
    // built the whole brief, rendered clean at 1280px and at a true 390px,
    // and did it in 92 turns / $5.10 — down from 147 / $7.86 pre-gates.
    recommendedFor: ['act'],
    measured: true
  },
  {
    id: 'claude-haiku-4-5',
    provider: 'anthropic',
    displayName: 'Claude Haiku 4.5',
    tier: 'small',
    contextWindow: 200_000,
    maxOutputTokens: 64_000,
    pricing: { inputPerMTok: 1.0, outputPerMTok: 5.0 },
    capabilities: small,
    // Replayed in phase 55: architecturally correct, but its repeaters carried
    // no `template` so half the page never drew (F38 / LAS-012). Not
    // recommended for authoring until that gate lands.
    measured: true
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
    isDefault: true,
    measured: false
  },
  {
    id: 'gpt-4.1-mini',
    provider: 'openai',
    displayName: 'GPT-4.1 mini',
    tier: 'balanced',
    contextWindow: 1_047_576,
    maxOutputTokens: 32_768,
    pricing: { inputPerMTok: 0.4, outputPerMTok: 1.6 },
    capabilities: frontier,
    measured: false
  },
  {
    id: 'gpt-4o',
    provider: 'openai',
    displayName: 'GPT-4o',
    tier: 'balanced',
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    pricing: { inputPerMTok: 2.5, outputPerMTok: 10.0 },
    capabilities: frontier,
    measured: false
  },
  {
    id: 'gpt-4o-mini',
    provider: 'openai',
    displayName: 'GPT-4o mini',
    tier: 'small',
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    pricing: { inputPerMTok: 0.15, outputPerMTok: 0.6 },
    capabilities: small,
    measured: false
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
    isDefault: true,
    openWeights: true,
    measured: false
  },
  {
    id: 'llama3.1:8b',
    provider: 'ollama',
    displayName: 'Llama 3.1 8B (local)',
    tier: 'local',
    contextWindow: 32_768,
    maxOutputTokens: 8_192,
    pricing: { inputPerMTok: 0, outputPerMTok: 0 },
    capabilities: { streaming: true, tools: true, agentFlow: false, sampling: true },
    openWeights: true,
    measured: false
  },

  // --- OpenAI-compatible gateways ----------------------------------------
  //
  // LAS-011 / F35. `openai-compatible` had no entries of its own, so
  // `getModelsForProvider` fell through to the OpenAI catalogue and offered a
  // DeepInfra or vLLM user `gpt-4.1` — an id their gateway does not serve.
  //
  // Richard's verdict allows open weights *hosted behind an API* ("DeepSeek v4
  // or the latest Qwen, the big ones"), and rules out local ollama for
  // authoring. These are the two that decision names.
  //
  // ⚠️ No `pricing` on purpose. The same weights cost different amounts on
  // different gateways, so any number here would be wrong for most users; cost
  // is reported as null rather than confidently wrong. Context windows are the
  // model's own property and are taken from the serving catalogue.
  {
    id: 'deepseek-ai/DeepSeek-V4-Pro',
    provider: 'openai-compatible',
    displayName: 'DeepSeek V4 Pro (open weights, hosted)',
    tier: 'frontier',
    contextWindow: 1_048_576,
    maxOutputTokens: 32_768,
    capabilities: frontier,
    openWeights: true,
    measured: false
  },
  {
    id: 'Qwen/Qwen3-Coder-480B-A35B-Instruct-Turbo',
    provider: 'openai-compatible',
    displayName: 'Qwen3 Coder 480B (open weights, hosted)',
    tier: 'frontier',
    contextWindow: 262_144,
    maxOutputTokens: 32_768,
    capabilities: frontier,
    openWeights: true,
    measured: false
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
    // An id nobody registered has, by definition, not been through the bench.
    measured: false,
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
  // model list is whatever the user types. It used to map straight onto the
  // OpenAI catalogue, which meant a DeepInfra or vLLM user was offered
  // `gpt-4.1` — an id their gateway does not serve (F35). Its own entries come
  // first now; the OpenAI catalogue still follows, because Azure and similar
  // shims genuinely do serve those ids.
  if (provider === 'openai-compatible') {
    return [
      ...AI_MODELS.filter((x) => x.provider === 'openai-compatible'),
      ...AI_MODELS.filter((x) => x.provider === 'openai')
    ];
  }
  return AI_MODELS.filter((x) => x.provider === provider);
}

/**
 * The models recommended for a role, best-first.
 *
 * LAS-011, and the reason it is a function rather than a constant: the
 * recommendation is a property of the models themselves, so adding a model
 * cannot leave a separate lookup table stale. Ordering within a role follows
 * registry order, which is deliberately best-first per provider.
 */
export function getRecommendedModels(role: AiRole, provider?: AiProviderId): AiModelDefinition[] {
  return AI_MODELS.filter(
    (x) => (x.recommendedFor || []).includes(role) && (!provider || x.provider === provider)
  );
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

/** Cached input tokens, priced off the same input rate at their own multipliers. */
export interface CacheTokens {
  /** Served from cache — the cheap ones. */
  cacheReadTokens?: number;
  /** Written to cache — paid once, at a premium. */
  cacheWriteTokens?: number;
}

/**
 * Price one request.
 *
 * `promptTokens` is the *uncached* input only: cache reads and writes are
 * billed at their own multipliers and passed separately, never folded in.
 * Omitting them prices a request that used no cache, which is exactly what a
 * provider without caching reports — so the three-argument form stays correct
 * rather than becoming a lie.
 */
export function calculateCostUsd(
  model: AiModelDefinition,
  promptTokens: number,
  completionTokens: number,
  cache: CacheTokens = {}
): number | null {
  if (!model.pricing) return null;
  const cost =
    (promptTokens / 1_000_000) * model.pricing.inputPerMTok +
    ((cache.cacheReadTokens ?? 0) / 1_000_000) * model.pricing.inputPerMTok * CACHE_READ_MULTIPLIER +
    ((cache.cacheWriteTokens ?? 0) / 1_000_000) * model.pricing.inputPerMTok * CACHE_WRITE_MULTIPLIER +
    (completionTokens / 1_000_000) * model.pricing.outputPerMTok;
  // Sub-cent precision matters here: a single node generation is fractions of
  // a cent, and rounding to 4 dp would report every call as $0.
  return Math.round(cost * 1_000_000) / 1_000_000;
}
