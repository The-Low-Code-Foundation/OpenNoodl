/**
 * Usage accounting shared by all provider adapters.
 *
 * @module AiAssistant/client/providers/usage
 */

import { calculateCostUsd, resolveModel } from '@noodl-models/AiAssistant/client/models';
import { AiProviderId, AiUsage } from '@noodl-models/AiAssistant/client/types';

export function finalizeUsage(
  modelId: string,
  provider: AiProviderId,
  promptTokens: number,
  completionTokens: number
): AiUsage {
  const model = resolveModel(modelId, provider);
  return {
    promptTokens,
    completionTokens,
    costUsd: calculateCostUsd(model, promptTokens, completionTokens)
  };
}
