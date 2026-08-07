/**
 * AuthPanel (BAK-004)
 *
 * The editor face of "how do end users sign in to my app": OAuth/OIDC
 * providers, magic links, the redirect allow-list, and the account-linking
 * policy. Edited against a running nodegx-backend through the `backend:*auth*`
 * IPC, which proxies to the service's `/admin/auth` surface — the same one the
 * served dashboard's Sign-in view and the MCP auth tools use, so there is no
 * second implementation to drift from.
 *
 * Rendered as a full-screen portal overlay from LocalBackendCard, alongside
 * Permissions/Email/Search/Triggers/Schema. That is the one-panel constraint
 * (from RUN-003's consolidation): a section here, never a new top-level panel.
 *
 * ## What this panel is FOR
 *
 * Displaying the callback URL. Everything else here is a form over JSON that
 * an agent could also write, but the redirect-URI mismatch is the single most
 * expensive mistake in setting up an OAuth client, and the fix is to never make
 * a human assemble that string. It is shown per provider, selectable in one
 * click, and it changes when the backend's Base URL does — which is why the
 * panel says loudly when that Base URL is still the local fallback.
 *
 * @module panels/auth/AuthPanel
 */

import React, { useCallback, useEffect, useState } from 'react';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { IconButton } from '@noodl-core-ui/components/inputs/IconButton';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { HStack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import css from './AuthPanel.module.scss';

const { ipcRenderer } = window.require('electron');

type PresetName = 'google' | 'github' | 'oidc';

interface ProviderPreset {
  kind: 'oidc' | 'github';
  displayName: string;
  issuer: string;
  scopes: string[];
  consoleUrl: string;
  note: string;
}

interface ProviderView {
  id: string;
  kind: 'oidc' | 'github';
  displayName: string;
  enabled: boolean;
  clientId: string;
  issuer: string;
  scopes: string[];
  allowSignup: boolean;
  hasClientSecret: boolean;
  ready: boolean;
  notReadyReason: string | null;
  callbackUrl: string;
}

interface AuthConfigResponse {
  config: {
    providers: ProviderView[];
    magicLink: { enabled: boolean; ttlMinutes: number; allowSignup: boolean };
    redirectAllowList: string[];
    linking: { autoLinkVerifiedEmail: boolean };
  };
  presets: Record<PresetName, ProviderPreset>;
  baseUrl: { url: string; usedFallback: boolean; warning: string | null };
  magicLinkReady: boolean;
  magicLinkNotReadyReason: string | null;
}

/** The provider form's editable state — a draft, applied on Save. */
interface ProviderDraft {
  id: string;
  preset: PresetName | '';
  displayName: string;
  issuer: string;
  clientId: string;
  clientSecret: string;
  scopes: string;
  enabled: boolean;
  allowSignup: boolean;
  /** True while adding, which is when the id is still editable. */
  isNew: boolean;
}

function draftFrom(provider: ProviderView): ProviderDraft {
  return {
    id: provider.id,
    preset: '',
    displayName: provider.displayName,
    issuer: provider.issuer,
    clientId: provider.clientId,
    clientSecret: '',
    scopes: (provider.scopes || []).join(' '),
    enabled: provider.enabled,
    allowSignup: provider.allowSignup,
    isNew: false
  };
}

function draftFromPreset(name: PresetName, preset: ProviderPreset): ProviderDraft {
  return {
    id: name === 'oidc' ? '' : name,
    preset: name,
    displayName: preset.displayName,
    issuer: preset.issuer,
    clientId: '',
    clientSecret: '',
    scopes: preset.scopes.join(' '),
    enabled: true,
    allowSignup: true,
    isNew: true
  };
}

export interface AuthPanelProps {
  backendId: string;
  backendName: string;
  onClose: () => void;
}

export function AuthPanel({ backendId, backendName, onClose }: AuthPanelProps) {
  const [data, setData] = useState<AuthConfigResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<ProviderDraft | null>(null);

  // Policy fields, kept as local drafts so a half-typed allow-list is not
  // saved on every keystroke.
  const [magicEnabled, setMagicEnabled] = useState(false);
  const [magicTtl, setMagicTtl] = useState('15');
  const [magicSignup, setMagicSignup] = useState(true);
  const [autoLink, setAutoLink] = useState(true);
  const [allowList, setAllowList] = useState('');

  const reportError = useCallback((err: unknown) => {
    setError(err instanceof Error ? err.message : String(err));
    setNotice(null);
  }, []);

  const flash = useCallback((message: string) => {
    setNotice(message);
    setError(null);
    setTimeout(() => setNotice(null), 4000);
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result: AuthConfigResponse = await ipcRenderer.invoke('backend:getAuthConfig', backendId);
      setData(result);
      setMagicEnabled(result.config.magicLink.enabled);
      setMagicTtl(String(result.config.magicLink.ttlMinutes));
      setMagicSignup(result.config.magicLink.allowSignup);
      setAutoLink(result.config.linking.autoLinkVerifiedEmail);
      setAllowList((result.config.redirectAllowList || []).join('\n'));
    } catch (err) {
      reportError(err);
    }
  }, [backendId, reportError]);

  useEffect(() => {
    load();
  }, [load]);

  const saveProvider = useCallback(async () => {
    if (!draft) return;
    const id = draft.id.trim();
    if (!id) {
      setError('A provider id is required. It appears in the callback URL, so pick something stable.');
      return;
    }
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        displayName: draft.displayName.trim(),
        issuer: draft.issuer.trim(),
        clientId: draft.clientId.trim(),
        scopes: draft.scopes.split(/\s+/).filter(Boolean),
        enabled: draft.enabled,
        allowSignup: draft.allowSignup
      };
      if (draft.preset) body.preset = draft.preset;
      if (draft.clientSecret) body.clientSecret = draft.clientSecret;

      const result = await ipcRenderer.invoke('backend:setAuthProvider', backendId, id, body);
      setDraft(null);
      await load();
      flash(
        result.provider && result.provider.ready
          ? `Saved. Register this callback URL with the provider: ${result.provider.callbackUrl}`
          : `Saved, but not usable yet: ${result.provider && result.provider.notReadyReason}`
      );
    } catch (err) {
      reportError(err);
    } finally {
      setBusy(false);
    }
  }, [backendId, draft, flash, load, reportError]);

  const removeProvider = useCallback(
    async (provider: ProviderView) => {
      setBusy(true);
      try {
        await ipcRenderer.invoke('backend:deleteAuthProvider', backendId, provider.id);
        await load();
        flash(
          `Removed "${provider.id}". Linked identities are kept, so re-adding the same id restores sign-in for ` +
            'those accounts.'
        );
      } catch (err) {
        reportError(err);
      } finally {
        setBusy(false);
      }
    },
    [backendId, flash, load, reportError]
  );

  const savePolicy = useCallback(async () => {
    setBusy(true);
    try {
      await ipcRenderer.invoke('backend:setAuthPolicy', backendId, {
        magicLink: {
          enabled: magicEnabled,
          ttlMinutes: Number(magicTtl) || 15,
          allowSignup: magicSignup
        },
        redirectAllowList: allowList
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        linking: { autoLinkVerifiedEmail: autoLink }
      });
      await load();
      flash('Sign-in policy saved.');
    } catch (err) {
      reportError(err);
    } finally {
      setBusy(false);
    }
  }, [allowList, autoLink, backendId, flash, load, magicEnabled, magicSignup, magicTtl, reportError]);

  const providers = data ? data.config.providers : [];

  return (
    <div className={css.Root}>
      <div className={css.Header}>
        <HStack hasSpacing>
          <div className={css.HeaderIcon}>
            <Icon icon={IconName.User} size={IconSize.Small} />
          </div>
          <VStack>
            <Text textType={TextType.DefaultContrast}>Sign-in</Text>
            <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
              {backendName}
            </Text>
          </VStack>
        </HStack>
        <IconButton icon={IconName.Close} onClick={onClose} />
      </div>

      <div className={css.Body}>
        {error && (
          <div className={css.ErrorBanner}>
            <Text textType={TextType.Default} style={{ whiteSpace: 'pre-wrap' }}>
              {error}
            </Text>
          </div>
        )}
        {notice && (
          <div className={css.NoticeBanner}>
            <Text textType={TextType.Default} style={{ whiteSpace: 'pre-wrap' }}>
              {notice}
            </Text>
          </div>
        )}
        {data && data.baseUrl.usedFallback && (
          <div className={css.WarningBanner}>
            <Text textType={TextType.DefaultContrast} style={{ fontSize: '12px' }}>
              {data.baseUrl.warning}
            </Text>
          </div>
        )}

        {/* ---------------------------------------------------- providers -- */}
        <div className={css.Section}>
          <div className={css.SpreadRow}>
            <VStack>
              <Text textType={TextType.DefaultContrast}>Identity providers</Text>
              <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
                {providers.length === 0
                  ? 'None configured. Google and GitHub are presets; any other OpenID Connect issuer works by ' +
                    'configuration alone.'
                  : `${providers.length} configured.`}
              </Text>
            </VStack>
            <PrimaryButton
              label="Add provider"
              size={PrimaryButtonSize.Small}
              variant={PrimaryButtonVariant.Muted}
              isDisabled={busy || !data}
              onClick={() => data && setDraft(draftFromPreset('google', data.presets.google))}
            />
          </div>

          {providers.map((provider) => (
            <div key={provider.id} className={css.ProviderRow}>
              <div className={css.ProviderHeader}>
                <VStack>
                  <Text textType={TextType.DefaultContrast}>{provider.displayName}</Text>
                  <Text textType={TextType.Shy} style={{ fontSize: '10px' }}>
                    {provider.id} · {provider.kind === 'github' ? 'GitHub' : 'OpenID Connect'}
                  </Text>
                </VStack>
                <Text
                  textType={TextType.Shy}
                  style={{
                    fontSize: '10px',
                    color: provider.ready && provider.enabled
                      ? 'var(--theme-color-success)'
                      : 'var(--theme-color-notice)'
                  }}
                >
                  {!provider.enabled ? 'disabled' : provider.ready ? 'ready' : 'incomplete'}
                </Text>
              </div>

              <Text textType={TextType.Shy} style={{ fontSize: '10px' }}>
                Callback URL to register with the provider:
              </Text>
              <code className={css.CallbackUrl}>{provider.callbackUrl}</code>

              {provider.notReadyReason && (
                <Text textType={TextType.Shy} style={{ fontSize: '11px', color: 'var(--theme-color-notice)' }}>
                  {provider.notReadyReason}
                </Text>
              )}

              <div className={css.RowActions}>
                <PrimaryButton
                  label="Edit"
                  size={PrimaryButtonSize.Small}
                  variant={PrimaryButtonVariant.Muted}
                  isDisabled={busy}
                  onClick={() => setDraft(draftFrom(provider))}
                />
                <PrimaryButton
                  label="Remove"
                  size={PrimaryButtonSize.Small}
                  variant={PrimaryButtonVariant.Muted}
                  isDisabled={busy}
                  onClick={() => removeProvider(provider)}
                />
              </div>
            </div>
          ))}
        </div>

        {/* ------------------------------------------------ provider form -- */}
        {draft && data && (
          <div className={css.Section}>
            <Text textType={TextType.DefaultContrast} style={{ marginBottom: '8px' }}>
              {draft.isNew ? 'Add a provider' : `Edit ${draft.id}`}
            </Text>

            {draft.isNew && (
              <div className={css.Field}>
                <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
                  Preset
                </Text>
                <select
                  className={css.Select}
                  value={draft.preset}
                  onChange={(e) => {
                    const name = e.target.value as PresetName;
                    setDraft(draftFromPreset(name, data.presets[name]));
                  }}
                >
                  <option value="google">Google</option>
                  <option value="github">GitHub</option>
                  <option value="oidc">Other OpenID Connect issuer</option>
                </select>
                {draft.preset && (
                  <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
                    {data.presets[draft.preset].note}
                  </Text>
                )}
              </div>
            )}

            <div className={css.Grid2}>
              <label className={css.Field}>
                <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
                  Provider id (appears in the callback URL)
                </Text>
                <input
                  className={css.Input}
                  value={draft.id}
                  disabled={!draft.isNew}
                  placeholder="google"
                  onChange={(e) => setDraft({ ...draft, id: e.target.value })}
                />
              </label>
              <label className={css.Field}>
                <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
                  Button label
                </Text>
                <input
                  className={css.Input}
                  value={draft.displayName}
                  onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
                />
              </label>
              <label className={css.Field}>
                <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
                  Issuer URL (OpenID Connect only)
                </Text>
                <input
                  className={css.Input}
                  value={draft.issuer}
                  placeholder="https://keycloak.example.com/realms/myrealm"
                  onChange={(e) => setDraft({ ...draft, issuer: e.target.value })}
                />
              </label>
              <label className={css.Field}>
                <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
                  Scopes (space separated)
                </Text>
                <input
                  className={css.Input}
                  value={draft.scopes}
                  onChange={(e) => setDraft({ ...draft, scopes: e.target.value })}
                />
              </label>
              <label className={css.Field}>
                <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
                  Client id
                </Text>
                <input
                  className={css.Input}
                  value={draft.clientId}
                  onChange={(e) => setDraft({ ...draft, clientId: e.target.value })}
                />
              </label>
              <label className={css.Field}>
                <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
                  Client secret {draft.isNew ? '' : '(leave blank to keep the current one)'}
                </Text>
                <input
                  className={css.Input}
                  type="password"
                  value={draft.clientSecret}
                  onChange={(e) => setDraft({ ...draft, clientSecret: e.target.value })}
                />
              </label>
            </div>

            <div className={css.RowActions}>
              <label className={css.Check}>
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
                />
                <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
                  Enabled
                </Text>
              </label>
              <label className={css.Check}>
                <input
                  type="checkbox"
                  checked={draft.allowSignup}
                  onChange={(e) => setDraft({ ...draft, allowSignup: e.target.checked })}
                />
                <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
                  May create new accounts
                </Text>
              </label>
            </div>

            <div className={css.RowActions}>
              <PrimaryButton
                label={busy ? 'Saving…' : 'Save provider'}
                size={PrimaryButtonSize.Small}
                variant={PrimaryButtonVariant.Muted}
                isDisabled={busy}
                onClick={saveProvider}
              />
              <PrimaryButton
                label="Cancel"
                size={PrimaryButtonSize.Small}
                variant={PrimaryButtonVariant.Muted}
                isDisabled={busy}
                onClick={() => setDraft(null)}
              />
            </div>
          </div>
        )}

        {/* -------------------------------------------------- magic links -- */}
        <div className={css.Section}>
          <Text textType={TextType.DefaultContrast} style={{ marginBottom: '8px' }}>
            Magic links
          </Text>
          {data && !data.magicLinkReady && data.magicLinkNotReadyReason && (
            <Text textType={TextType.Shy} style={{ fontSize: '11px', color: 'var(--theme-color-notice)' }}>
              {data.magicLinkNotReadyReason}
            </Text>
          )}
          <div className={css.RowActions}>
            <label className={css.Check}>
              <input type="checkbox" checked={magicEnabled} onChange={(e) => setMagicEnabled(e.target.checked)} />
              <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
                Passwordless email sign-in enabled
              </Text>
            </label>
            <label className={css.Check}>
              <input type="checkbox" checked={magicSignup} onChange={(e) => setMagicSignup(e.target.checked)} />
              <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
                An unknown address may create an account
              </Text>
            </label>
          </div>
          <label className={css.Field} style={{ maxWidth: '220px', marginTop: '8px' }}>
            <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
              Link lifetime (minutes)
            </Text>
            <input className={css.Input} type="number" value={magicTtl} onChange={(e) => setMagicTtl(e.target.value)} />
          </label>
        </div>

        {/* ------------------------------------------ redirect allow-list -- */}
        <div className={css.Section}>
          <Text textType={TextType.DefaultContrast} style={{ marginBottom: '4px' }}>
            Redirect allow-list
          </Text>
          <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
            One app origin per line. A completed sign-in may only be redirected to this backend&apos;s own origin or to
            one of these — which is what stops the callback being used as an open redirect. If your app is served from
            a different origin than the backend, add it here or every sign-in is refused before it starts.
          </Text>
          <textarea
            className={css.Textarea}
            style={{ marginTop: '8px' }}
            value={allowList}
            placeholder="https://app.example.com"
            onChange={(e) => setAllowList(e.target.value)}
          />
        </div>

        {/* -------------------------------------------- account linking --- */}
        <div className={css.Section}>
          <Text textType={TextType.DefaultContrast} style={{ marginBottom: '4px' }}>
            Account linking
          </Text>
          <label className={css.Check}>
            <input type="checkbox" checked={autoLink} onChange={(e) => setAutoLink(e.target.checked)} />
            <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
              Link a provider sign-in to an existing account with the same verified address
            </Text>
          </label>
          <Text textType={TextType.Shy} style={{ fontSize: '11px', marginTop: '6px', display: 'block' }}>
            Only a provider-VERIFIED address ever matches. If the local account had never verified its own address,
            its password and sessions are revoked at the moment of linking — that is what stops someone registering
            your address before you do and keeping access afterwards. Every such event is recorded in the audit trail
            as auth.link.credentials-revoked. Turning this off means such a sign-in is refused rather than linked.
          </Text>
        </div>

        <div className={css.RowActions}>
          <PrimaryButton
            label={busy ? 'Saving…' : 'Save policy'}
            size={PrimaryButtonSize.Small}
            variant={PrimaryButtonVariant.Muted}
            isDisabled={busy}
            onClick={savePolicy}
          />
        </div>
      </div>
    </div>
  );
}
