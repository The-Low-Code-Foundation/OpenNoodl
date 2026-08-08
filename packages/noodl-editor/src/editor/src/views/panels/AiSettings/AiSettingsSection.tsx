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

/** "Same as main model" — what every role ships as, and what most users keep. */
const INHERIT = '';

/**
 * Providers whose model list is "whatever you installed or your gateway
 * serves", so the registry cannot enumerate it and the model has to be typed.
 *
 * This is the case that matters for mixing vendors: `openai-compatible` is how
 * a hosted open-weight gateway (DeepInfra and friends) is configured, and the
 * registry has **zero** models for it — a picker alone would offer a user
 * nothing to select, which is precisely the configuration this feature exists
 * to allow. Ollama is the same story: the registry knows two models, and the
 * one actually pulled is whatever `ollama pull` fetched.
 */
const PROVIDERS_WITH_TYPED_MODEL: AiProviderId[] = ['openai-compatible', 'ollama'];

/**
 * LAS-009 — one role, two controls: a provider and a model.
 *
 * Provider and model are separate controls because they are separate choices —
 * the point of the feature is mixing vendors, so "Anthropic for planning,
 * DeepInfra for acting" has to be expressible. They are still written together
 * by `AiConfigStore.setRole`, and changing the provider clears the model rather
 * than carrying it across: a `claude-opus-5` id left behind on an Ollama role
 * would read as configured and fail at the endpoint.
 *
 * Only configured providers are offered. Choosing an unconfigured one would
 * resolve straight back to the global pair with a console warning — a setting
 * that reads as applied and is not. A role already pointing at a provider that
 * has since lost its credentials is still shown, labelled, so it can be seen
 * and cleared rather than vanishing from the list that explains its behaviour.
 */
function RoleRow({ role, mainProvider }: { role: AiRole; mainProvider: AiProviderSelection }) {
  const [selection, setSelection] = useState(() => AiConfigStore.getRole(role));

  const providerOptions = useMemo(() => {
    const rows: { label: string; value: string }[] = [{ label: 'Same as main model', value: INHERIT }];

    for (const id of AI_PROVIDER_IDS) {
      if (AiConfigStore.isConfigured(id)) rows.push({ label: AI_PROVIDER_LABELS[id], value: id });
    }

    // A provider that has lost its credentials stays selectable so the user can
    // see what the role is still set to, and clear it.
    if (selection.provider && !rows.some((row) => row.value === selection.provider)) {
      rows.push({ label: `${AI_PROVIDER_LABELS[selection.provider]} (not configured)`, value: selection.provider });
    }

    return rows;
    // `mainProvider` is not read here, but changing it changes which providers
    // are configured — so it is what makes this list reload.
  }, [selection.provider, mainProvider]);

  const registryModels = useMemo(
    () => (selection.provider ? getModelsForProvider(selection.provider) : []),
    [selection.provider]
  );

  const modelOptions = useMemo(() => {
    const rows = registryModels.map((entry) => ({ label: entry.displayName, value: entry.id }));
    if (selection.model && !rows.some((row) => row.value === selection.model)) {
      rows.unshift({ label: `${selection.model} (custom)`, value: selection.model });
    }
    return rows;
  }, [registryModels, selection.model]);

  function write(next: { provider?: AiProviderId; model?: string }) {
    setSelection(next);
    AiConfigStore.setRole(role, next);
  }

  // Typed rather than picked, either because the provider has no registry (a
  // custom gateway) or because it has one that cannot be complete (Ollama).
  const typesModel = Boolean(selection.provider && PROVIDERS_WITH_TYPED_MODEL.includes(selection.provider));

  return (
    <>
      <PanelRow label={AI_ROLE_LABELS[role]} helpText={AI_ROLE_DESCRIPTIONS[role]}>
        <PropertyPanelSelectInput
          value={selection.provider ?? INHERIT}
          properties={{ options: providerOptions }}
          onChange={(next: string) => {
            // Changing provider drops the model: an id from the old vendor is
            // meaningless to the new one, and leaving it is how a role ends up
            // pointing at a model its endpoint has never heard of.
            if (!next) write({});
            else write({ provider: next as AiProviderId });
          }}
        />
      </PanelRow>

      {selection.provider && (
        <PanelRow
          label={`${AI_ROLE_LABELS[role]} model`}
          helpText={
            typesModel
              ? `Model id as ${AI_PROVIDER_LABELS[selection.provider]} names it. Leave blank to use that provider's configured model.`
              : undefined
          }
        >
          {typesModel ? (
            <PropertyPanelTextInput
              value={selection.model ?? ''}
              onChange={(next: string) => write({ provider: selection.provider, model: next || undefined })}
            />
          ) : (
            <PropertyPanelSelectInput
              value={selection.model ?? ''}
              properties={{ options: modelOptions }}
              onChange={(next: string) => write({ provider: selection.provider, model: next || undefined })}
            />
          )}
        </PanelRow>
      )}
    </>
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
