/**
 * AI provider configuration.
 *
 * Holds *which* provider, model and endpoint the user picked. Credentials live
 * in {@link AiCredentials} (OS-encrypted) and never in here — this store is
 * backed by the plain-text editor settings file.
 *
 * Replaces the old `OpenAiStore`, which hardcoded an OpenAI-only notion of
 * "version" (`full-beta` / `enterprise`). Existing settings are migrated on
 * first use; see {@link AiConfigStore.migrateLegacySettings}.
 *
 * @module store/AiAssistantStore
 */

import { getDefaultModel } from '@noodl-models/AiAssistant/client/models';
import { AI_PROVIDER_IDS, AiProviderId } from '@noodl-models/AiAssistant/client/types';
import { EditorSettings } from '@noodl-utils/editorsettings';

import { AiCredentials } from './AiCredentials';

export type AiProviderSelection = AiProviderId | 'disabled';

const PROVIDER_KEY = 'ai.provider';
const MODEL_KEY = (provider: AiProviderId) => `ai.model.${provider}`;
const ENDPOINT_KEY = (provider: AiProviderId) => `ai.endpoint.${provider}`;
const HAS_KEY_KEY = (provider: AiProviderId) => `ai.hasKey.${provider}`;
const VERIFIED_KEY = (provider: AiProviderId) => `ai.verified.${provider}`;
const MIGRATED_KEY = 'ai.migratedFromOpenAiStore';

// --- legacy (pre-AIX-001) keys, read only during migration -----------------
const LEGACY_VERSION_KEY = 'aiAssistant.version';
const LEGACY_API_KEY = 'aiAssistant.temporaryApiKey';
const LEGACY_ENDPOINT_KEY = 'aiAssistant.endpoint';
const LEGACY_MODEL_KEY = 'aiAssistant.model';
const LEGACY_VERIFIED_KEY = 'aiAssistant.verified';

export const AI_PROVIDER_LABELS: Record<AiProviderSelection, string> = {
  disabled: 'Disabled',
  anthropic: 'Anthropic (Claude)',
  openai: 'OpenAI',
  'openai-compatible': 'OpenAI-compatible endpoint',
  ollama: 'Ollama (local)'
};

function isProviderId(value: unknown): value is AiProviderId {
  return AI_PROVIDER_IDS.includes(value as AiProviderId);
}

/**
 * What the old `version` setting meant, in new terms. `full-beta` was
 * "OpenAI's own endpoint"; `enterprise` was "some other OpenAI-shaped URL".
 */
function fromLegacyVersion(version: unknown): AiProviderSelection | null {
  switch (version) {
    case 'disabled':
      return 'disabled';
    case 'full-beta':
      return 'openai';
    case 'enterprise':
      return 'openai-compatible';
    default:
      return null;
  }
}

export const AiConfigStore = {
  getProvider(): AiProviderSelection {
    const stored = EditorSettings.instance.get(PROVIDER_KEY);
    if (stored === 'disabled' || isProviderId(stored)) return stored;

    // Read through to the legacy setting so behaviour is right even before
    // migrateLegacySettings() has had a chance to run.
    return fromLegacyVersion(EditorSettings.instance.get(LEGACY_VERSION_KEY)) ?? 'disabled';
  },

  setProvider(value: AiProviderSelection): void {
    EditorSettings.instance.set(PROVIDER_KEY, value);
  },

  isEnabled(): boolean {
    return this.getProvider() !== 'disabled';
  },

  /** The provider to actually send requests to, or null when disabled. */
  getActiveProvider(): AiProviderId | null {
    const provider = this.getProvider();
    return provider === 'disabled' ? null : provider;
  },

  getPrettyProvider(): string | null {
    const provider = this.getProvider();
    return provider === 'disabled' ? null : AI_PROVIDER_LABELS[provider];
  },

  getModel(provider?: AiProviderId): string {
    const target = provider || this.getActiveProvider();
    if (!target) return '';
    return EditorSettings.instance.get(MODEL_KEY(target)) || getDefaultModel(target).id;
  },

  setModel(value: string, provider?: AiProviderId): void {
    const target = provider || this.getActiveProvider();
    if (!target) return;
    EditorSettings.instance.set(MODEL_KEY(target), value);
  },

  /** Base URL override. Empty string means "use the provider's default". */
  getEndpoint(provider?: AiProviderId): string {
    const target = provider || this.getActiveProvider();
    if (!target) return '';
    return EditorSettings.instance.get(ENDPOINT_KEY(target)) || '';
  },

  setEndpoint(value: string, provider?: AiProviderId): void {
    const target = provider || this.getActiveProvider();
    if (!target) return;
    EditorSettings.instance.set(ENDPOINT_KEY(target), value);
  },

  async getApiKey(provider?: AiProviderId): Promise<string | null> {
    const target = provider || this.getActiveProvider();
    if (!target) return null;
    return AiCredentials.get(target);
  },

  async setApiKey(value: string, provider?: AiProviderId): Promise<void> {
    const target = provider || this.getActiveProvider();
    if (!target) return;
    await AiCredentials.set(target, value);
    EditorSettings.instance.set(HAS_KEY_KEY(target), Boolean(value));
    if (!value) EditorSettings.instance.set(VERIFIED_KEY(target), false);
  },

  /**
   * Whether a key is on file, without reading it. Synchronous so the UI can
   * gate on it during render.
   */
  hasApiKey(provider?: AiProviderId): boolean {
    const target = provider || this.getActiveProvider();
    if (!target) return false;
    return Boolean(EditorSettings.instance.get(HAS_KEY_KEY(target)));
  },

  setIsVerified(value: boolean, provider?: AiProviderId): void {
    const target = provider || this.getActiveProvider();
    if (!target) return;
    EditorSettings.instance.set(VERIFIED_KEY(target), value);
  },

  getIsVerified(provider?: AiProviderId): boolean {
    const target = provider || this.getActiveProvider();
    if (!target) return false;
    return Boolean(EditorSettings.instance.get(VERIFIED_KEY(target)));
  },

  /**
   * Whether the active provider has everything it needs to make a request.
   * Ollama and private compatible endpoints legitimately have no key.
   */
  isConfigured(): boolean {
    const provider = this.getActiveProvider();
    if (!provider) return false;

    switch (provider) {
      case 'ollama':
        return true;
      case 'openai-compatible':
        return Boolean(this.getEndpoint(provider));
      default:
        return this.hasApiKey(provider);
    }
  },

  /**
   * Move pre-AIX-001 settings into the new layout and lift the API key out of
   * the plain-text settings file into OS-encrypted storage.
   *
   * Idempotent, and safe to call before the user has ever configured AI.
   */
  async migrateLegacySettings(): Promise<void> {
    if (EditorSettings.instance.get(MIGRATED_KEY)) return;

    const legacyProvider = fromLegacyVersion(EditorSettings.instance.get(LEGACY_VERSION_KEY));
    if (legacyProvider && !EditorSettings.instance.get(PROVIDER_KEY)) {
      EditorSettings.instance.set(PROVIDER_KEY, legacyProvider);
    }

    const target: AiProviderId = legacyProvider && legacyProvider !== 'disabled' ? legacyProvider : 'openai';

    const legacyEndpoint = EditorSettings.instance.get(LEGACY_ENDPOINT_KEY);
    if (legacyEndpoint) {
      EditorSettings.instance.set(ENDPOINT_KEY(target), legacyEndpoint);
    }

    // The old 'gpt-3' value was never a real model id — it selected a prompt
    // variant. Anything unrecognised falls through to the provider default.
    const legacyModel = EditorSettings.instance.get(LEGACY_MODEL_KEY);
    if (legacyModel && legacyModel !== 'gpt-3') {
      EditorSettings.instance.set(MODEL_KEY(target), legacyModel);
    }

    const legacyKey = EditorSettings.instance.get(LEGACY_API_KEY);
    if (legacyKey) {
      try {
        await AiCredentials.set(target, legacyKey);
        EditorSettings.instance.set(HAS_KEY_KEY(target), true);
        EditorSettings.instance.set(VERIFIED_KEY(target), Boolean(EditorSettings.instance.get(LEGACY_VERIFIED_KEY)));
        // Only clear the plain-text copy once the encrypted one is written —
        // failing the other way round loses the user's key.
        EditorSettings.instance.set(LEGACY_API_KEY, undefined);
      } catch (error) {
        console.error('[ai] Could not move the stored API key into secure storage; leaving it in place.', error);
        return; // Retry on the next launch rather than marking this done.
      }
    }

    EditorSettings.instance.set(MIGRATED_KEY, true);
  }
};
