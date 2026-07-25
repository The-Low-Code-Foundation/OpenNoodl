/**
 * TriggersPanel (WF-005)
 *
 * The editor face of the backend trigger registry: the schedule / webhook /
 * db-change triggers attached to a backend's cloud functions, edited against a
 * running nodegx-backend through the `backend:*Trigger*` IPC (which proxies to
 * the service's /admin/triggers surface). Same registry the MCP trigger tools
 * and the deployed config drive — one model, three fronts.
 *
 * Each trigger shows its type, target function, enabled state, and live status
 * (last fired / next fire / last result), per the spec's "trigger configuration
 * section on the cloud function component." Rendered as a full-screen portal
 * overlay from LocalBackendCard, mirroring the Permissions / Data Browser panels.
 *
 * @module panels/triggers/TriggersPanel
 */

import React, { useCallback, useEffect, useState } from 'react';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { IconButton } from '@noodl-core-ui/components/inputs/IconButton';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { HStack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import css from './TriggersPanel.module.scss';

const { ipcRenderer } = window.require('electron');

type TriggerType = 'schedule' | 'webhook' | 'db-change';

interface TriggerStatus {
  lastFiredAt: string | null;
  nextFireAt: string | null;
  lastResult: { ok: boolean; at: string; statusCode?: number; error?: string } | null;
  fireCount: number;
}

interface TriggerDef {
  id: string;
  type: TriggerType;
  name?: string;
  enabled: boolean;
  target: { kind: 'function'; name: string };
  schedule?: { cron: string; missedFirePolicy: 'skip' | 'run-once-on-start' };
  webhook?: { slug: string; scheme: 'hmac-sha256' | 'token'; maxBodyBytes: number };
  dbChange?: { collection: string; actions: ('create' | 'update' | 'delete')[] };
  status: TriggerStatus;
}

export interface TriggersPanelProps {
  backendId: string;
  backendName: string;
  onClose: () => void;
}

function fmt(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

export function TriggersPanel({ backendId, backendName, onClose }: TriggersPanelProps) {
  const [triggers, setTriggers] = useState<TriggerDef[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [freshSecret, setFreshSecret] = useState<{ slug: string; secret: string } | null>(null);

  // New-trigger form state.
  const [newType, setNewType] = useState<TriggerType>('schedule');
  const [target, setTarget] = useState('');
  const [cron, setCron] = useState('0 * * * *');
  const [missedPolicy, setMissedPolicy] = useState<'skip' | 'run-once-on-start'>('skip');
  const [slug, setSlug] = useState('');
  const [scheme, setScheme] = useState<'hmac-sha256' | 'token'>('hmac-sha256');
  const [collection, setCollection] = useState('');
  const [actions, setActions] = useState<Record<'create' | 'update' | 'delete', boolean>>({
    create: true,
    update: false,
    delete: false
  });

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await ipcRenderer.invoke('backend:listTriggers', backendId);
      setTriggers(res.triggers || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [backendId]);

  useEffect(() => {
    load();
  }, [load]);

  const flash = useCallback((message: string) => {
    setNotice(message);
    setError(null);
    setTimeout(() => setNotice(null), 3000);
  }, []);
  const reportError = useCallback((err: unknown) => setError(err instanceof Error ? err.message : String(err)), []);

  const createTrigger = useCallback(async () => {
    if (!target.trim()) {
      reportError(new Error('A target function name is required.'));
      return;
    }
    const def: Record<string, unknown> = { type: newType, target: { kind: 'function', name: target.trim() } };
    if (newType === 'schedule') def.schedule = { cron, missedFirePolicy: missedPolicy };
    else if (newType === 'webhook') def.webhook = { slug: slug.trim(), scheme };
    else if (newType === 'db-change') {
      const acts = (Object.keys(actions) as ('create' | 'update' | 'delete')[]).filter((a) => actions[a]);
      def.dbChange = { collection: collection.trim(), actions: acts };
    }
    try {
      const res = await ipcRenderer.invoke('backend:createTrigger', backendId, def);
      if (res.secret) setFreshSecret({ slug: res.trigger.webhook?.slug || '', secret: res.secret });
      setTarget('');
      setSlug('');
      setCollection('');
      await load();
      flash('Trigger created.');
    } catch (err) {
      reportError(err);
    }
  }, [backendId, newType, target, cron, missedPolicy, slug, scheme, collection, actions, load, flash, reportError]);

  const toggle = useCallback(
    async (t: TriggerDef) => {
      try {
        await ipcRenderer.invoke('backend:setTriggerEnabled', backendId, t.id, !t.enabled);
        await load();
      } catch (err) {
        reportError(err);
      }
    },
    [backendId, load, reportError]
  );

  const remove = useCallback(
    async (t: TriggerDef) => {
      try {
        await ipcRenderer.invoke('backend:deleteTrigger', backendId, t.id);
        await load();
        flash('Trigger deleted.');
      } catch (err) {
        reportError(err);
      }
    },
    [backendId, load, flash, reportError]
  );

  const testFire = useCallback(
    async (t: TriggerDef) => {
      try {
        const res = await ipcRenderer.invoke('backend:fireTrigger', backendId, t.id, {});
        await load();
        flash(res.result?.ok ? 'Test fire succeeded.' : `Test fire failed: ${res.result?.error || 'see history'}`);
      } catch (err) {
        reportError(err);
      }
    },
    [backendId, load, flash, reportError]
  );

  function describeConfig(t: TriggerDef): string {
    if (t.type === 'schedule' && t.schedule) return `cron ${t.schedule.cron} (${t.schedule.missedFirePolicy})`;
    if (t.type === 'webhook' && t.webhook) return `POST /hooks/${backendId}/${t.webhook.slug} · ${t.webhook.scheme}`;
    if (t.type === 'db-change' && t.dbChange) return `${t.dbChange.collection}: ${t.dbChange.actions.join(', ')}`;
    return '';
  }

  return (
    <div className={css.Root}>
      <div className={css.Header}>
        <HStack hasSpacing>
          <div className={css.HeaderIcon}>
            <Icon icon={IconName.Refresh} size={IconSize.Small} />
          </div>
          <VStack>
            <Text textType={TextType.DefaultContrast}>Triggers</Text>
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
            <Text textType={TextType.Default}>{notice}</Text>
          </div>
        )}
        {freshSecret && (
          <div className={css.SecretBanner}>
            <Text textType={TextType.DefaultContrast} style={{ fontSize: '11px' }}>
              Copy the webhook secret for "{freshSecret.slug}" now — it is shown once and is unrecoverable. Send it as an
              X-Hub-Signature-256 HMAC (GitHub-style) or, for the token scheme, an X-Webhook-Token header.
            </Text>
            <code className={css.SecretValue}>{freshSecret.secret}</code>
            <PrimaryButton
              label="Copy & dismiss"
              size={PrimaryButtonSize.Small}
              variant={PrimaryButtonVariant.Muted}
              onClick={() => {
                navigator.clipboard.writeText(freshSecret.secret);
                setFreshSecret(null);
              }}
            />
          </div>
        )}

        {/* New trigger */}
        <div className={css.Section}>
          <Text textType={TextType.DefaultContrast} style={{ marginBottom: '8px' }}>
            Add a trigger
          </Text>
          <div className={css.InlineRow}>
            <label className={css.Field}>
              <Text textType={TextType.Shy} style={{ fontSize: '10px' }}>
                type
              </Text>
              <select className={css.Input} value={newType} onChange={(e) => setNewType(e.target.value as TriggerType)}>
                <option value="schedule">Schedule (cron)</option>
                <option value="webhook">Webhook</option>
                <option value="db-change">DB change</option>
              </select>
            </label>
            <label className={css.Field}>
              <Text textType={TextType.Shy} style={{ fontSize: '10px' }}>
                target function
              </Text>
              <input className={css.Input} value={target} placeholder="e.g. processOrder" onChange={(e) => setTarget(e.target.value)} />
            </label>

            {newType === 'schedule' && (
              <>
                <label className={css.Field}>
                  <Text textType={TextType.Shy} style={{ fontSize: '10px' }}>
                    cron
                  </Text>
                  <input className={css.Input} value={cron} onChange={(e) => setCron(e.target.value)} />
                </label>
                <label className={css.Field}>
                  <Text textType={TextType.Shy} style={{ fontSize: '10px' }}>
                    missed fires
                  </Text>
                  <select
                    className={css.Input}
                    value={missedPolicy}
                    onChange={(e) => setMissedPolicy(e.target.value as 'skip' | 'run-once-on-start')}
                  >
                    <option value="skip">skip</option>
                    <option value="run-once-on-start">run once on start</option>
                  </select>
                </label>
              </>
            )}

            {newType === 'webhook' && (
              <>
                <label className={css.Field}>
                  <Text textType={TextType.Shy} style={{ fontSize: '10px' }}>
                    slug
                  </Text>
                  <input className={css.Input} value={slug} placeholder="e.g. github" onChange={(e) => setSlug(e.target.value)} />
                </label>
                <label className={css.Field}>
                  <Text textType={TextType.Shy} style={{ fontSize: '10px' }}>
                    secret scheme
                  </Text>
                  <select className={css.Input} value={scheme} onChange={(e) => setScheme(e.target.value as 'hmac-sha256' | 'token')}>
                    <option value="hmac-sha256">HMAC-SHA256 (GitHub/Stripe)</option>
                    <option value="token">Shared token</option>
                  </select>
                </label>
              </>
            )}

            {newType === 'db-change' && (
              <>
                <label className={css.Field}>
                  <Text textType={TextType.Shy} style={{ fontSize: '10px' }}>
                    collection
                  </Text>
                  <input className={css.Input} value={collection} placeholder="e.g. Orders" onChange={(e) => setCollection(e.target.value)} />
                </label>
                <div className={css.Field}>
                  <Text textType={TextType.Shy} style={{ fontSize: '10px' }}>
                    on
                  </Text>
                  <div className={css.Controls}>
                    {(['create', 'update', 'delete'] as const).map((a) => (
                      <label key={a} className={css.Toggle}>
                        <input type="checkbox" checked={actions[a]} onChange={(e) => setActions((s) => ({ ...s, [a]: e.target.checked }))} />
                        <Text textType={TextType.Shy} style={{ fontSize: '10px' }}>
                          {a}
                        </Text>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}

            <PrimaryButton label="Add" size={PrimaryButtonSize.Small} variant={PrimaryButtonVariant.Muted} onClick={createTrigger} />
          </div>
        </div>

        {/* Existing triggers */}
        <div className={css.Section}>
          <Text textType={TextType.DefaultContrast} style={{ marginBottom: '8px' }}>
            Configured triggers
          </Text>
          {triggers.length === 0 && (
            <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
              No triggers yet.
            </Text>
          )}
          {triggers.map((t) => (
            <div key={t.id} className={css.TriggerRow}>
              <div className={css.TriggerHead}>
                <HStack hasSpacing>
                  <span className={css.TypeBadge}>{t.type}</span>
                  <VStack>
                    <Text textType={t.enabled ? TextType.DefaultContrast : TextType.Shy}>
                      {t.name || t.target.name} {t.enabled ? '' : '(disabled)'}
                    </Text>
                    <Text textType={TextType.Shy} style={{ fontSize: '10px' }}>
                      → {t.target.name} · {describeConfig(t)}
                    </Text>
                  </VStack>
                </HStack>
                <div className={css.Controls}>
                  <PrimaryButton
                    label="Test fire"
                    size={PrimaryButtonSize.Small}
                    variant={PrimaryButtonVariant.Muted}
                    onClick={() => testFire(t)}
                  />
                  <PrimaryButton
                    label={t.enabled ? 'Disable' : 'Enable'}
                    size={PrimaryButtonSize.Small}
                    variant={PrimaryButtonVariant.Muted}
                    onClick={() => toggle(t)}
                  />
                  <IconButton icon={IconName.Trash} size={IconSize.Tiny} onClick={() => remove(t)} />
                </div>
              </div>
              <div className={css.StatusLine}>
                <Text textType={TextType.Shy} style={{ fontSize: '10px' }}>
                  last fired: {fmt(t.status.lastFiredAt)} ({t.status.fireCount})
                </Text>
                {t.type === 'schedule' && (
                  <Text textType={TextType.Shy} style={{ fontSize: '10px' }}>
                    next fire: {fmt(t.status.nextFireAt)}
                  </Text>
                )}
                <Text
                  textType={TextType.Shy}
                  style={{ fontSize: '10px', color: t.status.lastResult ? (t.status.lastResult.ok ? 'var(--theme-color-success)' : 'var(--theme-color-danger)') : undefined }}
                >
                  last result: {t.status.lastResult ? (t.status.lastResult.ok ? 'ok' : `failed — ${t.status.lastResult.error || ''}`) : '—'}
                </Text>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
