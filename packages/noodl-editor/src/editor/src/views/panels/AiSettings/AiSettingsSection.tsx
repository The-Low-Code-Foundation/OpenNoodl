import { AI_PROVIDER_LABELS, AiConfigStore, AiProviderSelection } from '@noodl-store/AiAssistantStore';
import { AiCredentials } from '@noodl-store/AiCredentials';
import React, { useEffect, useMemo, useState } from 'react';
import { platform } from '@noodl/platform';

import { AiAssistantApi } from '@noodl-models/AiAssistant/api';
import { getModelsForProvider, PRICING_AS_OF } from '@noodl-models/AiAssistant/client/models';
import {
  AI_ROLES,
  AI_ROLE_DESCRIPTIONS,
  AI_ROLE_LABELS,
  type AiRole
} from '@noodl-models/AiAssistant/client/roles';
import { authoringTelemetry } from '@noodl-models/AiAssistant/telemetry';
import { OLLAMA_DEFAULT_BASE_URL } from '@noodl-models/AiAssistant/client/providers/ollama';
import { OPENAI_DEFAULT_BASE_URL } from '@noodl-models/AiAssistant/client/providers/openai';
import { AI_PROVIDER_IDS, AiProviderId } from '@noodl-models/AiAssistant/client/types';

import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { VStack } from '@noodl-core-ui/components/layout/Stack';
import { PropertyPanelButton } from '@noodl-core-ui/components/property-panel/PropertyPanelButton';
import { PropertyPanelCheckbox } from '@noodl-core-ui/components/property-panel/PropertyPanelCheckbox';
import { PropertyPanelPasswordInput } from '@noodl-core-ui/components/property-panel/PropertyPanelPasswordInput';
import { PropertyPanelSelectInput } from '@noodl-core-ui/components/property-panel/PropertyPanelSelectInput';
import { PropertyPanelTextInput } from '@noodl-core-ui/components/property-panel/PropertyPanelTextInput';
import { CollapsableSection } from '@noodl-core-ui/components/sidebar/CollapsableSection';
import { PanelRow, PanelRowVariant } from '@noodl-core-ui/components/sidebar/PanelRow';
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

/**
 * LAS-009 — the value encoding for a role picker.
 *
 * Provider and model are one control rather than two, deliberately. A model id
 * only means anything to the provider it belongs to, so two independent
 * pickers would let a user leave `claude-opus-5` selected while switching the
 * provider to Ollama — a configuration that looks set and fails at the endpoint.
 * One control means the pair always moves together, which is also what
 * `AiConfigStore.setRole` needs to avoid leaving half a selection behind.
 *
 * The empty string is "same as the main model", which is what every role ships
 * as and what most users will keep.
 */
const INHERIT = '';

function encodeRole(provider: AiProviderId, model: string): string {
  return `${provider}:${model}`;
}

function decodeRole(value: string): { provider?: AiProviderId; model?: string } {
  if (!value) return {};
  const separator = value.indexOf(':');
  if (separator < 0) return {};
  const provider = value.slice(0, separator) as AiProviderId;
  const model = value.slice(separator + 1);
  return AI_PROVIDER_IDS.includes(provider) && model ? { provider, model } : {};
}

/**
 * One row per role. Only providers that are actually configured are offered:
 * choosing an unconfigured one would resolve straight back to the global pair
 * with a console warning, which is a setting that reads as applied and is not.
 * A role already pointing at a provider that has since lost its credentials is
 * still shown — labelled — so it can be seen and cleared rather than silently
 * disappearing from the list that explains the behaviour.
 */
function RoleRow({ role, mainProvider }: { role: AiRole; mainProvider: AiProviderSelection }) {
  const [value, setValue] = useState(() => {
    const selection = AiConfigStore.getRole(role);
    return selection.provider && selection.model ? encodeRole(selection.provider, selection.model) : INHERIT;
  });

  const options = useMemo(() => {
    const rows = [{ label: 'Same as main model', value: INHERIT }];

    for (const provider of AI_PROVIDER_IDS) {
      if (!AiConfigStore.isConfigured(provider)) continue;
      for (const model of getModelsForProvider(provider)) {
        rows.push({
          label: `${AI_PROVIDER_LABELS[provider]} — ${model.displayName}`,
          value: encodeRole(provider, model.id)
        });
      }
    }

    // Whatever is currently selected must always be selectable, or the control
    // would render blank and the next change would look like a fresh choice.
    if (value !== INHERIT && !rows.some((row) => row.value === value)) {
      const { provider, model } = decodeRole(value);
      rows.push({
        label: provider
          ? `${AI_PROVIDER_LABELS[provider]} — ${model} ${AiConfigStore.isConfigured(provider) ? '(custom)' : '(not configured)'}`
          : value,
        value
      });
    }

    return rows;
    // `mainProvider` is not read here, but changing it changes which providers
    // are configured — so it is what makes this list reload.
  }, [value, mainProvider]);

  return (
    <PanelRow label={AI_ROLE_LABELS[role]} helpText={AI_ROLE_DESCRIPTIONS[role]}>
      <PropertyPanelSelectInput
        value={value}
        properties={{ options }}
        onChange={(next: string) => {
          setValue(next);
          AiConfigStore.setRole(role, decodeRole(next));
        }}
      />
    </PanelRow>
  );
}

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

  // PNL-004: the price used to ride in the option label —
  // "Claude Sonnet 5 — $2/$10 per Mtok" is 248px of text in a control that is a
  // `<select>` dressed as an `<input>`: `user-select: none`, and clicking opens
  // the dropdown rather than placing a caret. So below about a 380px panel the
  // model name just ended, with no way to read the rest. The name is what
  // identifies the row; the price is what `helpText` is for, and it now names
  // only the selected model rather than repeating itself on every option.
  const modelOptions = useMemo(() => {
    const options = registryModels.map((x) => ({
      label: x.displayName,
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

  /** The selected model's price, for the row's help text. */
  const modelPricing = useMemo(() => {
    const selected = registryModels.find((x) => x.id === model);
    if (!selected?.pricing) return undefined;
    const { inputPerMTok, outputPerMTok } = selected.pricing;
    if (inputPerMTok === 0 && outputPerMTok === 0) return 'Runs on this machine — no per-token cost.';
    return `$${inputPerMTok} in / $${outputPerMTok} out per million tokens, as published on ${PRICING_AS_OF}.`;
  }, [registryModels, model]);

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
          <PanelRow label="Provider">
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
          </PanelRow>

          {provider === 'disabled' && (
            <Box hasYSpacing>
              <Text>AI features are turned off. Pick a provider to enable them.</Text>
            </Box>
          )}

          {provider !== 'disabled' && (
            <>
              <PanelRow label="Model" helpText={modelPricing}>
                <PropertyPanelSelectInput
                  value={model}
                  properties={{ options: modelOptions }}
                  onChange={(value: string) => {
                    setModel(value);
                    AiConfigStore.setModel(value, provider);
                  }}
                />
              </PanelRow>

              {/* PNL-004: "API Key (saved)" and "Endpoint (optional)" are the two
                  labels the phase was reported over. The parenthetical is help
                  text wearing a label's clothes — it says something about the
                  field's *state*, not its name — and it is what pushed both past
                  the 104px column. Moved where it belongs; the labels now fit
                  the column at every band instead of wrapping to two lines. */}
              {needsKey && (
                <PanelRow
                  label="API key"
                  helpText={
                    [
                      hasSavedKey && !apiKey ? 'A key is saved. Enter a new one to replace it.' : null,
                      provider === 'openai-compatible'
                        ? 'Leave the key blank if your endpoint does not require one.'
                        : null
                    ]
                      .filter(Boolean)
                      .join(' ') || undefined
                  }
                >
                  <PropertyPanelPasswordInput value={apiKey} onChange={onSaveApiKey} />
                </PanelRow>
              )}

              <PanelRow
                label="Endpoint"
                helpText={
                  [
                    provider === 'openai-compatible' ? null : 'Optional.',
                    ENDPOINT_PLACEHOLDER[provider]
                      ? provider === 'openai-compatible'
                        ? `Base URL of your OpenAI-compatible API, for example ${ENDPOINT_PLACEHOLDER[provider]}`
                        : `Leave blank to use ${ENDPOINT_PLACEHOLDER[provider]}`
                      : null
                  ]
                    .filter(Boolean)
                    .join(' ') || undefined
                }
              >
                <PropertyPanelTextInput
                  value={endpoint}
                  onChange={(value: string) => {
                    setEndpoint(value);
                    AiConfigStore.setEndpoint(value, provider);
                  }}
                />
              </PanelRow>

              <PanelRow label="Connection">
                <PropertyPanelButton
                  properties={{
                    isPrimary: true,
                    buttonLabel: isVerifying ? 'Testing…' : 'Test connection',
                    onClick() {
                      onVerify();
                    }
                  }}
                />
              </PanelRow>

              {/* LAS-009: below the connection controls, because a role can
                  only name a provider that is already set up above. Ships
                  unset — the measured replays put the hard step at *acting*,
                  not designing, so no preset is suggested until LAS-011's
                  matrix says which way round it actually goes. */}
              <Box hasTopSpacing={3}>
                <Title size={TitleSize.Medium} hasBottomSpacing>
                  Model per role
                </Title>
                <Text hasBottomSpacing>
                  Point each stage of a build at a different model, the way you would in Claude Code. Anything left on
                  &quot;Same as main model&quot; follows the picker above.
                </Text>
              </Box>
              {AI_ROLES.map((role) => (
                <RoleRow key={role} role={role} mainProvider={provider} />
              ))}

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

              {/* The "as published on …" caveat moved onto the Model row's help
                  text, where it sits beside the number it qualifies. */}
            </>
          )}

          <PanelRow
            label="Usage log"
            variant={PanelRowVariant.Toggle}
            helpText={`Keeps an anonymous local log of AI authoring usage — outcomes, counts and cost only, never your prompts, component names, or project content. Nothing is sent anywhere; the file stays on this machine${
              telemetryEnabled ? ` at ${authoringTelemetry().logPath()}` : ''
            } and helps evaluate the authoring beta if you choose to share it.`}
          >
            <PropertyPanelCheckbox
              value={telemetryEnabled}
              onChange={(value: boolean) => {
                setTelemetryEnabled(value);
                authoringTelemetry().setEnabled(value);
              }}
            />
          </PanelRow>

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
