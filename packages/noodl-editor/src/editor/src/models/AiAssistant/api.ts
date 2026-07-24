/**
 * Public surface for querying which AI models are available.
 *
 * Before AIX-001 this file hardcoded two OpenAI models with wrong prices and a
 * verification call that only ever asked OpenAI. Both now come from the model
 * registry and the provider adapters.
 *
 * @module AiAssistant/api
 */

import { AiConfigStore } from '@noodl-store/AiAssistantStore';

import { AiClient } from '@noodl-models/AiAssistant/client/AiClient';
import { AiModelDefinition, getModelsForProvider } from '@noodl-models/AiAssistant/client/models';
import { AiProviderId, AiProviderVerification } from '@noodl-models/AiAssistant/client/types';

export namespace AiAssistantApi {
  /** Models known to the registry for a provider. */
  export function getModels(provider?: AiProviderId): AiModelDefinition[] {
    const target = provider || AiConfigStore.getActiveProvider();
    return target ? getModelsForProvider(target) : [];
  }

  /**
   * Check that a provider's credentials/endpoint work. Pass `override` to test
   * values the user has typed but not yet saved.
   */
  export function verify(
    provider?: AiProviderId,
    override?: { apiKey?: string; baseUrl?: string }
  ): Promise<AiProviderVerification> {
    return AiClient.verify(provider, override);
  }
}
