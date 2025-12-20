/**
 * API Key Storage with Encryption
 *
 * Securely stores Anthropic API keys using Electron's safeStorage API
 * for OS-level encryption, with electron-store as a fallback.
 *
 * @module migration/keyStorage
 */

import Store from 'electron-store';

// safeStorage is available on remote in Electron
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { safeStorage } = require('@electron/remote');

const store = new Store({
  name: 'ai-config',
  encryptionKey: 'opennoodl-migration' // Additional layer
});

/**
 * Save an API key with OS-level encryption
 */
export async function saveApiKey(apiKey: string): Promise<void> {
  // Use Electron's safeStorage for OS-level encryption
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(apiKey);
    store.set('anthropic.apiKey', encrypted.toString('base64'));
  } else {
    // Fallback to electron-store encryption
    store.set('anthropic.apiKey', apiKey);
  }
}

/**
 * Retrieve the stored API key
 */
export async function getApiKey(): Promise<string | null> {
  const stored = store.get('anthropic.apiKey') as string | undefined;
  if (!stored) return null;

  if (safeStorage.isEncryptionAvailable()) {
    try {
      const buffer = Buffer.from(stored, 'base64');
      return safeStorage.decryptString(buffer);
    } catch {
      return null;
    }
  }

  return stored;
}

/**
 * Clear the stored API key
 */
export async function clearApiKey(): Promise<void> {
  store.delete('anthropic.apiKey');
}

/**
 * Test an Anthropic API key by making a minimal API call
 */
export async function testAnthropicKey(apiKey: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true // Safe in Electron - code runs locally, not in public browser
  });

  try {
    // Make a minimal API call to verify the key
    await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Hi' }]
    });
    return true;
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err.status === 401) {
      throw new Error('Invalid API key');
    }
    if (err.status === 403) {
      throw new Error('API key does not have required permissions');
    }
    throw new Error(`API error: ${err.message || 'Unknown error'}`);
  }
}
