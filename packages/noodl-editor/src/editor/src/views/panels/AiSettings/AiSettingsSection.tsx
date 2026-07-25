import { AI_PROVIDER_LABELS, AiConfigStore, AiProviderSelection } from '@noodl-store/AiAssistantStore';
import { AiCredentials } from '@noodl-store/AiCredentials';
import React, { useEffect, useMemo, useState } from 'react';
import { platform } from '@noodl/platform';

import { AiAssistantApi } from '@noodl-models/AiAssistant/api';
import { getModelsForProvider, PRICING_AS_OF } from '@noodl-models/AiAssistant/client/models';
import { authoringTelemetry } from '@noodl-models/AiAssistant/telemetry';
import { OLLAMA_DEFAULT_BASE_URL } from '@noodl-models/AiAssistant/client/providers/ollama';
import { OPENAI_DEFAULT_BASE_URL } from '@noodl-models/AiAssistant/client/providers/openai';
import { AI_PROVIDER_IDS, AiProviderId } from '@noodl-models/AiAssistant/client/types';

import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { VStack } from '@noodl-core-ui/components/layout/Stack';
import { PropertyPanelButton } from '@noodl-core-ui/components/property-panel/PropertyPanelButton';
import { PropertyPanelCheckbox } from '@noodl-core-ui/components/property-panel/PropertyPanelCheckbox';
import { PropertyPanelRow } from '@noodl-core-ui/components/property-panel/PropertyPanelInput';
import { PropertyPanelPasswordInput } from '@noodl-core-ui/components/property-panel/PropertyPanelPasswordInput';
import { PropertyPanelSelectInput } from '@noodl-core-ui/components/property-panel/PropertyPanelSelectInput';
import { PropertyPanelTextInput } from '@noodl-core-ui/components/property-panel/PropertyPanelTextInput';
import { CollapsableSection } from '@noodl-core-ui/components/sidebar/CollapsableSection';
import { Text } from '@noodl-core-ui/components/typography/Text';
import { Title, TitleSize } from '@noodl-core-ui/components/typography/Title';

import { ToastLayer } from '../../ToastLayer/ToastLayer';

export const AI_ASSISTANT_ENABLED_SUGGESTIONS_KEY = 'aiAssistant.enabledSuggestions';

/** Providers that authenticate with a key the user pastes in. */
const PROVIDERS_WITH_KEY: AiProviderId[] = ['anthropic', 'openai', 'openai-compatible'];

/** Providers whose endpoint is user-settable, with the placeholder to show. */
const ENDPOINT_PLACEHOLDER: Partial<Record<AiProviderId, string>> = {
  'openai-compatible': 'https://your-gateway.example.com/v1',
  ollama: OLLAMA_DEFAULT_BASE_URL,
  openai: OPENAI_DEFAULT_BASE_URL
};

const KEY_HELP: Partial<Record<AiProviderId, { label: string; url: string }>> = {
  anthropic: { label: 'Get an Anthropic API key', url: 'https://console.anthropic.com/settings/keys' },
  openai: { label: 'Get an OpenAI API key', url: 'https://platform.openai.com/account/api-keys' }
};

export function AiSettingsSection() {
  const [provider, setProviderState] = useState<AiProviderSelection>(AiConfigStore.getProvider());
  const [apiKey, setApiKey] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [model, setModel] = useState('');
  const [discoveredModels, setDiscoveredModels] = useState<string[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [telemetryEnabled, setTelemetryEnabled] = useState(() => authoringTelemetry().isEnabled());

  // Legacy settings are lifted into the new layout (and the key into OS
  // encryption) the first time anyone opens this panel.
  useEffect(() => {
    AiConfigStore.migrateLegacySettings()
      .then(() => setProviderState(AiConfigStore.getProvider()))
      .catch((error) => console.error('[ai] Settings migration failed.', error));
  }, []);

  // Every field is per-provider, so switching providers reloads all of them.
  useEffect(() => {
    if (provider === 'disabled') return;

    setEndpoint(AiConfigStore.getEndpoint(provider));
    setModel(AiConfigStore.getModel(provider));
    setDiscoveredModels([]);
    // The stored key is deliberately not read back into the field: showing it
    // would put the plaintext key in the DOM for no benefit. An empty field
    // over a saved key means "unchanged".
    setApiKey('');
  }, [provider]);

  const registryModels = useMemo(
    () => (provider === 'disabled' ? [] : getModelsForProvider(provider)),
    [provider]
  );

  const modelOptions = useMemo(() => {
    const options = registryModels.map((x) => ({
      label: x.pricing
        ? `${x.displayName} — $${x.pricing.inputPerMTok}/$${x.pricing.outputPerMTok} per Mtok`
        : x.displayName,
      value: x.id
    }));

    // Anything the endpoint reported that the registry does not know about,
    // so custom gateways and freshly pulled Ollama models are selectable.
    for (const id of discoveredModels) {
      if (!options.some((option) => option.value === id)) {
        options.push({ label: id, value: id });
      }
    }

    if (model && !options.some((option) => option.value === model)) {
      options.unshift({ label: `${model} (custom)`, value: model });
    }

    return options;
  }, [registryModels, discoveredModels, model]);

  const hasSavedKey = provider !== 'disabled' && AiConfigStore.hasApiKey(provider);
  const needsKey = provider !== 'disabled' && PROVIDERS_WITH_KEY.includes(provider);
  const keyHelp = provider !== 'disabled' ? KEY_HELP[provider] : undefined;

  async function onSaveApiKey(value: string) {
    if (provider === 'disabled') return;
    setApiKey(value);
    try {
      await AiConfigStore.setApiKey(value, provider);
    } catch (error) {
      ToastLayer.showError(`Could not save the API key: ${(error as Error).message}`);
    }
  }

  async function onVerify() {
    if (provider === 'disabled') return;

    setIsVerifying(true);
    try {
      // Verify what is on screen, including a key that was just typed.
      const override = {
        apiKey: apiKey || (await AiConfigStore.getApiKey(provider)) || undefined,
        baseUrl: endpoint || undefined
      };

      const result = await AiAssistantApi.verify(provider, override);
      AiConfigStore.setIsVerified(result.ok, provider);

      if (result.models?.length) setDiscoveredModels(result.models);

      if (result.ok && result.error) {
        // Reachable but not usable yet — Ollama running with nothing pulled.
        ToastLayer.showError(result.error);
      } else if (result.ok) {
        ToastLayer.showSuccess(
          result.models?.length
            ? `Connected. ${result.models.length} models available.`
            : 'Connected.'
        );
      } else {
        ToastLayer.showError(result.error || 'Could not connect.');
      }
    } finally {
      setIsVerifying(false);
    }
  }

  return (
    <CollapsableSection title="AI">
      <Box hasXSpacing>
        <VStack>
          <PropertyPanelRow label="Provider" isChanged={false}>
            <PropertyPanelSelectInput
              value={provider}
              properties={{
                options: [
                  { label: AI_PROVIDER_LABELS.disabled, value: 'disabled' },
                  ...AI_PROVIDER_IDS.map((id) => ({ label: AI_PROVIDER_LABELS[id], value: id }))
                ]
              }}
              onChange={(value: AiProviderSelection) => {
                setProviderState(value);
                AiConfigStore.setProvider(value);
              }}
            />
          </PropertyPanelRow>

          {provider === 'disabled' && (
            <Box hasYSpacing>
              <Text>AI features are turned off. Pick a provider to enable them.</Text>
            </Box>
          )}

          {provider !== 'disabled' && (
            <>
              <PropertyPanelRow label="Model" isChanged={false}>
                <PropertyPanelSelectInput
                  value={model}
                  properties={{ options: modelOptions }}
                  onChange={(value: string) => {
                    setModel(value);
                    AiConfigStore.setModel(value, provider);
                  }}
                />
              </PropertyPanelRow>

              {needsKey && (
                <>
                  <PropertyPanelRow
                    label={hasSavedKey && !apiKey ? 'API Key (saved)' : 'API Key'}
                    isChanged={false}
                  >
                    <PropertyPanelPasswordInput value={apiKey} onChange={onSaveApiKey} />
                  </PropertyPanelRow>
                  {provider === 'openai-compatible' && (
                    <Box hasBottomSpacing={2}>
                      <Text>Leave the key blank if your endpoint does not require one.</Text>
                    </Box>
                  )}
                </>
              )}

              <PropertyPanelRow
                label={provider === 'openai-compatible' ? 'Endpoint' : 'Endpoint (optional)'}
                isChanged={false}
              >
                <PropertyPanelTextInput
                  value={endpoint}
                  onChange={(value: string) => {
                    setEndpoint(value);
                    AiConfigStore.setEndpoint(value, provider);
                  }}
                />
              </PropertyPanelRow>

              {ENDPOINT_PLACEHOLDER[provider] && (
                <Box hasBottomSpacing={2}>
                  <Text>
                    {provider === 'openai-compatible'
                      ? `Base URL of your OpenAI-compatible API, for example ${ENDPOINT_PLACEHOLDER[provider]}`
                      : `Leave blank to use ${ENDPOINT_PLACEHOLDER[provider]}`}
                  </Text>
                </Box>
              )}

              <PropertyPanelRow label="Connection" isChanged={false}>
                <PropertyPanelButton
                  properties={{
                    isPrimary: true,
                    buttonLabel: isVerifying ? 'Testing…' : 'Test connection',
                    onClick() {
                      onVerify();
                    }
                  }}
                />
              </PropertyPanelRow>

              {provider === 'ollama' && (
                <Box hasYSpacing>
                  <Text hasBottomSpacing>
                    Ollama runs models on this machine — no API key, no cost, and nothing leaves the device. Install
                    it, then pull a model, for example: ollama pull qwen2.5-coder
                  </Text>
                  <Text>
                    Local models are less capable than the hosted ones, so the multi-step AI commands are hidden while
                    a local model is selected.
                  </Text>
                </Box>
              )}

              {keyHelp && (
                <Box hasBottomSpacing={2}>
                  <PrimaryButton
                    variant={PrimaryButtonVariant.Muted}
                    size={PrimaryButtonSize.Small}
                    isGrowing
                    label={keyHelp.label}
                    onClick={() => platform.openExternal(keyHelp.url)}
                  />
                </Box>
              )}

              {needsKey && !AiCredentials.isOsEncryptionAvailable() && (
                <Box hasYSpacing>
                  <Text>
                    This system has no OS keychain available, so the API key is only obfuscated on disk rather than
                    encrypted. It is still kept out of your project files.
                  </Text>
                </Box>
              )}

              <Box hasYSpacing>
                <Text>Prices shown are per million tokens, as published on {PRICING_AS_OF}.</Text>
              </Box>
            </>
          )}

          <PropertyPanelRow label="Usage log" isChanged={false}>
            <PropertyPanelCheckbox
              value={telemetryEnabled}
              onChange={(value: boolean) => {
                setTelemetryEnabled(value);
                authoringTelemetry().setEnabled(value);
              }}
            />
          </PropertyPanelRow>
          <Box hasBottomSpacing={2}>
            <Text>
              Keeps an anonymous local log of AI authoring usage — outcomes, counts and cost only, never your
              prompts, component names, or project content. Nothing is sent anywhere; the file stays on this
              machine{telemetryEnabled ? ` at ${authoringTelemetry().logPath()}` : ''} and helps evaluate the
              authoring beta if you choose to share it.
            </Text>
          </Box>

          <Box
            hasXSpacing={3}
            hasYSpacing={3}
            UNSAFE_style={{ borderRadius: '2px', background: 'var(--theme-color-bg-3)' }}
          >
            <Title size={TitleSize.Medium} hasBottomSpacing>
              AI docs
            </Title>
            <Text hasBottomSpacing>See setup instructions and guides for how to use the AI features.</Text>
            <PrimaryButton
              variant={PrimaryButtonVariant.Muted}
              size={PrimaryButtonSize.Small}
              isGrowing
              label="Open docs"
              onClick={() => {
                platform.openExternal('https://docs.noodl.net/#/docs/getting-started/noodl-ai/');
              }}
            />
          </Box>
        </VStack>
      </Box>
    </CollapsableSection>
  );
}
