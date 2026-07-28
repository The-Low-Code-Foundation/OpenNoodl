/**
 * TriggersPanel (WF-005, reworked by WFA-005, edited by WFA-008)
 *
 * The editor face of the backend trigger registry: the schedule / webhook /
 * db-change triggers attached to a backend, edited against a running
 * nodegx-backend through `TriggerBackendClient` — the same door the workflow
 * canvas draws its entry nodes through, which is what §5's "the panel and the
 * canvas agree" means in code rather than in intent.
 *
 * WHAT WFA-005 CHANGED HERE
 *
 *  - **A trigger can target a workflow** (F9). The registry has supported
 *    `kind: 'workflow'` since WF-001 — "a target kind, not a second dispatch
 *    path" — and this panel hardcoded `{kind: 'function'}`, so the only way to
 *    schedule a workflow was the admin API or MCP.
 *  - **The target is picked from what the backend actually has** (F9). It was
 *    free text: a live test created a trigger against a nonexistent function,
 *    was told 201, and found out a minute later at the next fire — a mistake
 *    made in a form that knew the function list. Free text is still permitted,
 *    for a function that is not deployed yet, but it is flagged as unresolved
 *    rather than accepted silently, and the fire-time error is untouched.
 *  - **A schedule can carry a payload** (F8), delivered as the run's `body`.
 *  - **It re-reads when the backend's state changes** (F47), instead of showing
 *    whatever was true when it was opened.
 *
 * WHAT WFA-008 ADDS: EDITING (F53)
 *
 * Until now a wrong cron meant delete-and-recreate, and for a webhook that mints
 * a new secret and breaks every sender — the editor's only gesture was
 * destructive in a way nothing told the user about. `PUT /admin/triggers/:id`
 * **keeps** an existing secret, so an edit is exactly what delete-and-recreate
 * cannot be: a change that leaves senders working.
 *
 * Three rules make that true, and each of them is a decision rather than an
 * implementation detail (WFA-008-ASSESSMENT §2):
 *
 *  - **the form never sends `secret`.** Sending it *replaces* the secret, so
 *    rotation is a separate action that says it breaks every sender;
 *  - **the form never sends `enabled`.** Absent means "keep what is stored", so
 *    saving an edit cannot re-enable a trigger somebody turned off meanwhile;
 *  - **the form re-reads before it writes.** `updatedAt` moves for a
 *    configuration change and not for a fire, so it is a usable token: if it
 *    moved, the save is not sent and the panel says what changed.
 *
 * Rendered as a registered side panel, reached from LocalBackendCard or from the
 * workflow canvas's trigger node (which passes `editTriggerId`).
 *
 * @module panels/triggers/TriggersPanel
 */

import { useBackendStatusChanged } from '@noodl-hooks/useBackendStatusChanged';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { IconButton } from '@noodl-core-ui/components/inputs/IconButton';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { HStack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import {
  cronGloss,
  createTrigger,
  deleteTrigger,
  fetchBackendEndpoint,
  fetchTriggerTargets,
  fireTrigger,
  getTrigger,
  isTargetResolved,
  listTriggers,
  rotateTriggerSecret,
  setTriggerEnabled,
  TriggerDef,
  TriggerTargets,
  updateTrigger,
  webhookUrl
} from '@noodl-models/triggers/TriggerBackendClient';
import {
  buildTriggerInput,
  describeTriggerChange,
  EMPTY_FORM,
  formStateFromDef,
  targetNameOf,
  triggerLabelOf,
  TriggerFormState
} from '@noodl-models/triggers/triggerEditing';

import { TriggerFormFields } from './TriggerFormFields';

import css from './TriggersPanel.module.scss';

export interface TriggersPanelProps {
  backendId: string;
  backendName: string;
  /** WFA-008: open with this trigger's edit form showing (from the canvas node). */
  editTriggerId?: string;
  onClose: () => void;
}

function fmt(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

const NO_TARGETS: TriggerTargets = { functions: [], workflows: [], known: false };

/** The trigger being edited: the definition the form was filled FROM, and the form. */
interface EditSession {
  def: TriggerDef;
  form: TriggerFormState;
}

export function TriggersPanel({ backendId, backendName, editTriggerId, onClose }: TriggersPanelProps) {
  const [triggers, setTriggers] = useState<TriggerDef[]>([]);
  const [targets, setTargets] = useState<TriggerTargets>(NO_TARGETS);
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [freshSecret, setFreshSecret] = useState<{ slug: string; secret: string; rotated: boolean } | null>(null);

  const [newForm, setNewForm] = useState<TriggerFormState>(EMPTY_FORM);
  const [editing, setEditing] = useState<EditSession | null>(null);
  /** What changed on the backend while the form was open, in words. Never a silent overwrite. */
  const [conflict, setConflict] = useState<string[] | null>(null);

  const newTargetName = targetNameOf(newForm);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [list, available, url] = await Promise.all([
        listTriggers(backendId),
        fetchTriggerTargets(backendId),
        fetchBackendEndpoint(backendId)
      ]);
      setTriggers(list);
      setTargets(available);
      setEndpoint(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [backendId]);

  useEffect(() => {
    load();
  }, [load]);

  // F47: a backend started, stopped or died while this panel is open changes
  // every answer on it — including whether the target lists mean anything.
  useBackendStatusChanged(load);

  const flash = useCallback((message: string) => {
    setNotice(message);
    setError(null);
    setTimeout(() => setNotice(null), 3000);
  }, []);
  const reportError = useCallback((err: unknown) => setError(err instanceof Error ? err.message : String(err)), []);

  /**
   * Open the edit form from a FRESH read of the trigger.
   *
   * Not from the list this panel rendered: a form prefilled from a stale snapshot
   * writes stale values back for every field the user did not touch, and the
   * `updatedAt` it keeps as its concurrency token has to be the one it actually
   * read the values with.
   */
  const beginEdit = useCallback(
    async (triggerId: string) => {
      setConflict(null);
      setError(null);
      try {
        const def = await getTrigger(backendId, triggerId);
        if (!def) {
          reportError(new Error('That trigger no longer exists on this backend — nothing was changed.'));
          await load();
          return;
        }
        setEditing({ def, form: formStateFromDef(def) });
      } catch (err) {
        reportError(err);
      }
    },
    [backendId, load, reportError]
  );

  // The canvas's *Edit this trigger…* lands here. Once — reopening the panel is
  // what re-arms it, and re-running on every render would fight the user's own
  // Cancel.
  const armedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!editTriggerId || armedFor.current === editTriggerId) return;
    armedFor.current = editTriggerId;
    void beginEdit(editTriggerId);
  }, [editTriggerId, beginEdit]);

  const create = useCallback(async () => {
    const built = buildTriggerInput(newForm);
    if ('error' in built) {
      reportError(new Error(built.error));
      return;
    }
    try {
      const res = await createTrigger(backendId, built.input);
      if (res.secret) {
        setFreshSecret({ slug: res.trigger.webhook?.slug || '', secret: res.secret, rotated: false });
      }
      setNewForm({ ...EMPTY_FORM, type: newForm.type, targetKind: newForm.targetKind });
      await load();
      flash('Trigger created.');
    } catch (err) {
      reportError(err);
    }
  }, [backendId, newForm, load, flash, reportError]);

  /**
   * Save an edit, having first checked that the trigger is still the one the
   * form was filled from.
   *
   * The check is not defensive coding: at least four writers can change a
   * trigger (this panel, the canvas node menu, MCP, and — for status only — the
   * running service), and the write that would lose silently could be *this hook
   * was disabled because it was firing into production*.
   */
  const saveEdit = useCallback(async () => {
    if (!editing) return;
    const built = buildTriggerInput(editing.form);
    if ('error' in built) {
      reportError(new Error(built.error));
      return;
    }

    let current: TriggerDef | null;
    try {
      current = await getTrigger(backendId, editing.def.id);
    } catch (err) {
      reportError(err);
      return;
    }

    if (!current) {
      setEditing(null);
      reportError(new Error('That trigger was deleted while you were editing it — nothing was changed.'));
      await load();
      return;
    }

    if (current.updatedAt !== editing.def.updatedAt) {
      setConflict(describeTriggerChange(editing.def, current));
      // The current definition becomes what a reload would fill the form from.
      setEditing({ def: current, form: editing.form });
      return;
    }

    // The one change that breaks senders without touching the credential: the
    // URL moves. Said before the write, not reported after it.
    const oldSlug = editing.def.webhook?.slug;
    const newSlug = built.input.webhook?.slug;
    if (oldSlug && newSlug && oldSlug !== newSlug) {
      const ok =
        typeof window === 'undefined' ||
        window.confirm(
          `Change this webhook's URL from /hooks/${backendId}/${oldSlug} to /hooks/${backendId}/${newSlug}?\n\n` +
            `Anything currently posting to the old URL will get a 404 until it is updated. The secret itself does ` +
            `not change — the same credential works at the new address.`
        );
      if (!ok) return;
    }

    try {
      await updateTrigger(backendId, editing.def.id, built.input);
      setEditing(null);
      setConflict(null);
      await load();
      flash('Trigger updated. A webhook keeps its existing secret.');
    } catch (err) {
      reportError(err);
    }
  }, [backendId, editing, load, flash, reportError]);

  /** Fill the open form from the backend's current definition, discarding edits. */
  const reloadEdit = useCallback(async () => {
    if (!editing) return;
    setConflict(null);
    await beginEdit(editing.def.id);
  }, [editing, beginEdit]);

  const rotate = useCallback(
    async (t: TriggerDef) => {
      const confirmed =
        typeof window === 'undefined' ||
        window.confirm(
          `Rotate the secret for the webhook "${triggerLabelOf(t)}" on ${backendName}?\n\n` +
            `Every sender using the current secret STOPS WORKING the moment this happens, until it is given the ` +
            `new one. The new secret is shown once and cannot be read back. Editing this trigger does not need ` +
            `this — an edit keeps the existing secret.`
        );
      if (!confirmed) return;
      try {
        const res = await rotateTriggerSecret(backendId, t.id);
        if (res.secret) setFreshSecret({ slug: t.webhook?.slug || '', secret: res.secret, rotated: true });
        // A rotation moves `updatedAt`, so an open form is now out of date about
        // the trigger it is editing — refill it rather than letting the next
        // save report a conflict the user just caused deliberately.
        if (editing?.def.id === t.id) await beginEdit(t.id);
        await load();
      } catch (err) {
        reportError(err);
      }
    },
    [backendId, backendName, editing, beginEdit, load, reportError]
  );

  const toggle = useCallback(
    async (t: TriggerDef) => {
      try {
        await setTriggerEnabled(backendId, t.id, !t.enabled);
        if (editing?.def.id === t.id) await beginEdit(t.id);
        await load();
      } catch (err) {
        reportError(err);
      }
    },
    [backendId, editing, beginEdit, load, reportError]
  );

  const remove = useCallback(
    async (t: TriggerDef) => {
      try {
        await deleteTrigger(backendId, t.id);
        if (editing?.def.id === t.id) setEditing(null);
        await load();
        flash('Trigger deleted.');
      } catch (err) {
        reportError(err);
      }
    },
    [backendId, editing, load, flash, reportError]
  );

  const testFire = useCallback(
    async (t: TriggerDef) => {
      try {
        const res = await fireTrigger(backendId, t.id, {});
        await load();
        flash(res.result?.ok ? 'Test fire succeeded.' : `Test fire failed: ${res.result?.error || 'see history'}`);
      } catch (err) {
        reportError(err);
      }
    },
    [backendId, load, flash, reportError]
  );

  function describeConfig(t: TriggerDef): string {
    if (t.type === 'schedule' && t.schedule) {
      const gloss = cronGloss(t.schedule.cron);
      const payload = t.schedule.payload ? ` · payload ${Object.keys(t.schedule.payload).length} key(s)` : '';
      return `cron ${t.schedule.cron}${gloss ? ` — ${gloss}` : ''} (${t.schedule.missedFirePolicy})${payload}`;
    }
    if (t.type === 'webhook' && t.webhook) {
      const url = endpoint ? webhookUrl(endpoint, backendId, t.webhook.slug) : `/hooks/${backendId}/${t.webhook.slug}`;
      return `POST ${url} · ${t.webhook.scheme}`;
    }
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
              {freshSecret.rotated
                ? `The webhook "${freshSecret.slug}" has a NEW secret. Every sender using the previous one is being
                   rejected from now until it is given this value.`
                : `Copy the webhook secret for "${freshSecret.slug}" now — it is shown once and is unrecoverable.`}{' '}
              Send it as an X-Hub-Signature-256 HMAC (GitHub-style) or, for the token scheme, as X-Webhook-Token,
              Authorization: Bearer, or ?token=.
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
            <TriggerFormFields
              form={newForm}
              targets={targets}
              mode="create"
              onChange={(patch) => setNewForm((f) => ({ ...f, ...patch }))}
            />
            <PrimaryButton label="Add" size={PrimaryButtonSize.Small} variant={PrimaryButtonVariant.Muted} onClick={create} />
          </div>

          {/* Author-time warning, never a refusal: a function that is not
              deployed yet is a legitimate thing to point at. */}
          {newTargetName && isTargetResolved({ kind: newForm.targetKind, name: newTargetName }, targets) === false && (
            <Text textType={TextType.Shy} style={{ fontSize: '10px' }}>
              ⚠ This backend has no {newForm.targetKind} called &quot;{newTargetName}&quot;. You can still create the
              trigger — it will fail loudly at its next fire until the {newForm.targetKind} exists.
            </Text>
          )}
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
          {triggers.map((t) => {
            const resolved = isTargetResolved(t.target, targets);
            const isEditing = editing?.def.id === t.id;
            return (
              <div key={t.id} className={css.TriggerRow}>
                <div className={css.TriggerHead}>
                  <HStack hasSpacing>
                    <span className={css.TypeBadge}>{t.type}</span>
                    <VStack>
                      <Text textType={t.enabled ? TextType.DefaultContrast : TextType.Shy}>
                        {t.name || t.target.name} {t.enabled ? '' : '(disabled)'}
                      </Text>
                      <Text textType={TextType.Shy} style={{ fontSize: '10px' }}>
                        → {t.target.kind} {t.target.name}
                        {resolved === false ? ' ⚠ not on this backend' : ''} · {describeConfig(t)}
                      </Text>
                    </VStack>
                  </HStack>
                  <div className={css.Controls}>
                    <PrimaryButton
                      label={isEditing ? 'Cancel' : 'Edit'}
                      size={PrimaryButtonSize.Small}
                      variant={PrimaryButtonVariant.Muted}
                      onClick={() => {
                        if (isEditing) {
                          setEditing(null);
                          setConflict(null);
                        } else {
                          void beginEdit(t.id);
                        }
                      }}
                    />
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

                {isEditing && editing && (
                  <div className={css.EditForm}>
                    {conflict && (
                      <div className={css.ErrorBanner}>
                        <Text textType={TextType.Default} style={{ whiteSpace: 'pre-wrap' }}>
                          {`This trigger changed on ${backendName} while you were editing it:\n` +
                            conflict.map((c) => `  • ${c}`).join('\n') +
                            `\n\nNothing was saved. Reload the form to start from what the backend has now, or press ` +
                            `Save again to write your version over it.`}
                        </Text>
                        <div className={css.Controls} style={{ marginTop: '8px' }}>
                          <PrimaryButton
                            label="Reload the form"
                            size={PrimaryButtonSize.Small}
                            variant={PrimaryButtonVariant.Muted}
                            onClick={() => void reloadEdit()}
                          />
                        </div>
                      </div>
                    )}

                    <div className={css.InlineRow}>
                      <TriggerFormFields
                        form={editing.form}
                        targets={targets}
                        mode="edit"
                        onChange={(patch) => setEditing((s) => (s ? { ...s, form: { ...s.form, ...patch } } : s))}
                      />
                      <PrimaryButton
                        label="Save changes"
                        size={PrimaryButtonSize.Small}
                        variant={PrimaryButtonVariant.Muted}
                        onClick={() => void saveEdit()}
                      />
                    </div>

                    {/* The two things an editor must say out loud about a
                        webhook: what an edit does NOT do, and where the
                        sender-breaking action is. */}
                    {t.type === 'webhook' && (
                      <HStack hasSpacing>
                        <Text textType={TextType.Shy} style={{ fontSize: '10px' }}>
                          Saving keeps this webhook&apos;s existing secret, so senders keep working. Changing the slug
                          moves the URL.
                        </Text>
                        <PrimaryButton
                          label="Rotate secret…"
                          size={PrimaryButtonSize.Small}
                          variant={PrimaryButtonVariant.Muted}
                          onClick={() => void rotate(t)}
                        />
                      </HStack>
                    )}

                    {editing.form.type === 'webhook' &&
                      editing.def.webhook &&
                      editing.form.slug.trim() !== editing.def.webhook.slug && (
                        <Text textType={TextType.Shy} style={{ fontSize: '10px' }}>
                          ⚠ The URL will change to /hooks/{backendId}/{editing.form.slug.trim() || '…'} — anything still
                          posting to /hooks/{backendId}/{editing.def.webhook.slug} will get a 404.
                        </Text>
                      )}
                  </div>
                )}

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
                    style={{
                      fontSize: '10px',
                      color: t.status.lastResult
                        ? t.status.lastResult.ok
                          ? 'var(--theme-color-success)'
                          : 'var(--theme-color-danger)'
                        : undefined
                    }}
                  >
                    last result:{' '}
                    {t.status.lastResult
                      ? t.status.lastResult.ok
                        ? 'ok'
                        : `failed — ${t.status.lastResult.error || ''}`
                      : '—'}
                  </Text>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
