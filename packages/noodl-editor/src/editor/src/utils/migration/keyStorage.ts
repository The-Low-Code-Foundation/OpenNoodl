/**
 * API key storage for the legacy-project migration helper.
 *
 * AIX-001 folded this into the editor-wide credential store, so the migration
 * helper and the AI settings panel share one Anthropic key instead of keeping
 * two encrypted copies in two files. The functions here are kept as the
 * migration feature's own vocabulary.
 *
 * @module migration/keyStorage
 */

import { AiCredentials } from '@noodl-store/AiCredentials';

import { createProvider } from '@noodl-models/AiAssistant/client/AiClient';

/** Save the Anthropic API key with OS-level encryption where available. */
export async function saveApiKey(apiKey: string): Promise<void> {
  await AiCredentials.set('anthropic', apiKey);
}

export async function getApiKey(): Promise<string | null> {
  return AiCredentials.get('anthropic');
}

export async function clearApiKey(): Promise<void> {
  await AiCredentials.clear('anthropic');
}

/**
 * Test an Anthropic API key with a minimal live call.
 *
 * Throws on failure so the config panel can show the reason; the model used is
 * whatever the registry lists as the cheapest Anthropic option, not a
 * hardcoded id.
 */
export async function testAnthropicKey(apiKey: string): Promise<boolean> {
  const result = await createProvider('anthropic', { apiKey }).verify();
  if (!result.ok) {
    throw new Error(result.error || 'Could not verify the API key.');
  }
  return true;
}
