/**
 * The fields of a trigger, rendered once and used by both forms (WFA-008 §1).
 *
 * Creating and editing a trigger are the same fields over the same `TriggerInput`
 * — the only differences are the type control (fixed once the trigger exists,
 * F58) and the button. Extracting them is what makes "one form" a property of the
 * code rather than an intention: a field added here reaches both paths, and
 * neither can quietly lack one.
 *
 * @module panels/triggers/TriggerFormFields
 */

import React from 'react';

import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { ChangeAction, TriggerTargets, TriggerType } from '@noodl-models/triggers/TriggerBackendClient';
import { OTHER, TriggerFormState } from '@noodl-models/triggers/triggerEditing';

import css from './TriggersPanel.module.scss';

export interface TriggerFormFieldsProps {
  form: TriggerFormState;
  onChange: (patch: Partial<TriggerFormState>) => void;
  targets: TriggerTargets;
  /**
   * `edit` fixes the type. A trigger's type cannot change (F58: it would orphan
   * a webhook secret that a later change back silently re-uses), and a disabled
   * dropdown is a promise that it is editable somewhere, so the type is shown as
   * what it is.
   */
  mode: 'create' | 'edit';
}

const label = (text: string) => (
  <Text textType={TextType.Shy} style={{ fontSize: '10px' }}>
    {text}
  </Text>
);

export function TriggerFormFields({ form, onChange, targets, mode }: TriggerFormFieldsProps) {
  const options =
    form.targetKind === 'workflow'
      ? targets.workflows.map((w) => ({ value: w.id, label: w.name === w.id ? w.id : `${w.name} (${w.id})` }))
      : targets.functions.map((f) => ({ value: f, label: f }));

  /**
   * The typed-name box shows when the picker cannot offer the value: either the
   * user chose *Type a name…*, or the backend has no such list, or — the case
   * that only exists when editing — the stored name is not in the list, which is
   * a function that is not deployed yet and is a legitimate target (WFA-005).
   *
   * An EMPTY pick is none of those: it is a create form nobody has answered yet,
   * and it must read *Choose a …* rather than *Type a name…*.
   */
  const chosen = Boolean(form.targetPick) && form.targetPick !== OTHER;
  const pickHasValue = chosen && options.some((o) => o.value === form.targetPick);
  const showTyped = form.targetPick === OTHER || (chosen && !pickHasValue) || (!options.length && !chosen);
  const selectValue = pickHasValue ? form.targetPick : chosen || form.targetPick === OTHER ? OTHER : '';

  return (
    <>
      <label className={css.Field}>
        {label('type')}
        {mode === 'create' ? (
          <select
            className={css.Input}
            value={form.type}
            onChange={(e) => onChange({ type: e.target.value as TriggerType })}
            aria-label="Trigger type"
          >
            <option value="schedule">Schedule (cron)</option>
            <option value="webhook">Webhook</option>
            <option value="db-change">DB change</option>
          </select>
        ) : (
          <span className={css.TypeBadge} data-test="edit-type">
            {form.type}
          </span>
        )}
      </label>

      {/* F9: the target is {kind, name}, and both halves are chosen. */}
      <label className={css.Field}>
        {label('runs')}
        <select
          className={css.Input}
          value={form.targetKind}
          onChange={(e) =>
            onChange({ targetKind: e.target.value as 'function' | 'workflow', targetPick: '', targetTyped: '' })
          }
          aria-label="Target kind"
        >
          <option value="function">a cloud function</option>
          <option value="workflow">a workflow</option>
        </select>
      </label>

      <label className={css.Field}>
        {label(form.targetKind === 'workflow' ? 'workflow' : 'function')}
        <select
          className={css.Input}
          value={selectValue}
          onChange={(e) => onChange({ targetPick: e.target.value })}
          aria-label="Target"
        >
          <option value="">
            {options.length ? `Choose a ${form.targetKind}…` : `No ${form.targetKind}s on this backend`}
          </option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
          <option value={OTHER}>Type a name…</option>
        </select>
      </label>

      {showTyped && (
        <label className={css.Field}>
          {label('name')}
          <input
            className={css.Input}
            value={form.targetTyped}
            placeholder={form.targetKind === 'workflow' ? 'workflow id' : 'e.g. processOrder'}
            onChange={(e) => onChange({ targetTyped: e.target.value })}
            aria-label="Target name"
          />
        </label>
      )}

      {form.type === 'schedule' && (
        <>
          <label className={css.Field}>
            {label('cron')}
            <input
              className={css.Input}
              value={form.cron}
              onChange={(e) => onChange({ cron: e.target.value })}
              aria-label="Cron expression"
            />
          </label>
          <label className={css.Field}>
            {label('missed fires')}
            <select
              className={css.Input}
              value={form.missedPolicy}
              onChange={(e) => onChange({ missedPolicy: e.target.value as 'skip' | 'run-once-on-start' })}
              aria-label="Missed fires"
            >
              <option value="skip">skip</option>
              <option value="run-once-on-start">run once on start</option>
            </select>
          </label>
          <label className={css.Field}>
            {label('payload (JSON, optional)')}
            <input
              className={css.Input}
              value={form.payloadText}
              placeholder='{"mode":"nightly"}'
              onChange={(e) => onChange({ payloadText: e.target.value })}
              aria-label="Schedule payload"
            />
          </label>
        </>
      )}

      {form.type === 'webhook' && (
        <>
          <label className={css.Field}>
            {label('slug')}
            <input
              className={css.Input}
              value={form.slug}
              placeholder="e.g. github"
              onChange={(e) => onChange({ slug: e.target.value })}
              aria-label="Webhook slug"
            />
          </label>
          <label className={css.Field}>
            {label('secret scheme')}
            <select
              className={css.Input}
              value={form.scheme}
              onChange={(e) => onChange({ scheme: e.target.value as 'hmac-sha256' | 'token' })}
              aria-label="Secret scheme"
            >
              <option value="hmac-sha256">HMAC-SHA256 (GitHub/Stripe)</option>
              <option value="token">Shared token</option>
            </select>
          </label>
        </>
      )}

      {form.type === 'db-change' && (
        <>
          <label className={css.Field}>
            {label('collection')}
            <input
              className={css.Input}
              value={form.collection}
              placeholder="e.g. Orders"
              onChange={(e) => onChange({ collection: e.target.value })}
              aria-label="Collection"
            />
          </label>
          <div className={css.Field}>
            {label('on')}
            <div className={css.Controls}>
              {(['create', 'update', 'delete'] as const).map((a) => (
                <label key={a} className={css.Toggle}>
                  <input
                    type="checkbox"
                    checked={form.actions[a]}
                    onChange={(e) => onChange({ actions: { ...form.actions, [a]: e.target.checked } as Record<ChangeAction, boolean> })}
                  />
                  {label(a)}
                </label>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
