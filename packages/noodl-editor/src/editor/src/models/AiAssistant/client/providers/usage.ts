/**
 * Usage accounting shared by all provider adapters.
 *
 * Cache tokens are part of the contract rather than an Anthropic detail: a
 * provider that does not cache reports zeroes, which is the truth, and the
 * cost math has one shape everywhere.
 *
 * @module AiAssistant/client/providers/usage
 */

import { calculateCostUsd, CacheTokens, resolveModel } from '@noodl-models/AiAssistant/client/models';
import { AiProviderId, AiUsage } from '@noodl-models/AiAssistant/client/types';

export function finalizeUsage(
  modelId: string,
  provider: AiProviderId,
  promptTokens: number,
  completionTokens: number,
  cache: CacheTokens = {}
): AiUsage {
  const model = resolveModel(modelId, provider);
  const cacheReadTokens = cache.cacheReadTokens ?? 0;
  const cacheWriteTokens = cache.cacheWriteTokens ?? 0;
  return {
    promptTokens,
    completionTokens,
    cacheReadTokens,
    cacheWriteTokens,
    costUsd: calculateCostUsd(model, promptTokens, completionTokens, { cacheReadTokens, cacheWriteTokens })
  };
}
