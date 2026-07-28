/**
 * The form state behind creating AND editing a trigger (WFA-008 §1).
 *
 * One form, so one builder. WFA-005 put the create form in the Triggers panel
 * and the assessment's §1 decision keeps the edit form there with it, for the
 * reason this module exists to make structural: two forms over one `PUT` drift,
 * and the one that drifts is the one missing whatever field was added last.
 * `payload` is the worked example — F8 added it to the create form and the
 * registry, and nothing else, because nothing else existed.
 *
 * Everything here is pure. The panel owns React state and error banners; the
 * rules about what a trigger input may contain live here, where they can be
 * asserted without a running backend.
 *
 * @module models/triggers/triggerEditing
 */

import {
  ChangeAction,
  MissedFirePolicy,
  TriggerDef,
  TriggerInput,
  TriggerType,
  WebhookScheme
} from './TriggerBackendClient';

/** Everything the form holds, for every trigger type at once. */
export interface TriggerFormState {
  type: TriggerType;
  targetKind: 'function' | 'workflow';
  /** What the picker chose, or `OTHER` when the name is typed. */
  targetPick: string;
  targetTyped: string;
  cron: string;
  missedPolicy: MissedFirePolicy;
  /** The schedule payload as typed — JSON, parsed on submit so the error names this field. */
  payloadText: string;
  slug: string;
  scheme: WebhookScheme;
  collection: string;
  actions: Record<ChangeAction, boolean>;
}

/** The sentinel the target dropdown uses for "not in the list — let me type it". */
export const OTHER = ' other';

export const EMPTY_FORM: TriggerFormState = {
  type: 'schedule',
  targetKind: 'function',
  targetPick: '',
  targetTyped: '',
  cron: '0 * * * *',
  missedPolicy: 'skip',
  payloadText: '',
  slug: '',
  scheme: 'hmac-sha256',
  collection: '',
  actions: { create: true, update: false, delete: false }
};

/** What will actually be sent: the picked name, or the typed one. */
export function targetNameOf(form: TriggerFormState): string {
  return form.targetPick === OTHER || !form.targetPick ? form.targetTyped.trim() : form.targetPick;
}

/**
 * Fill the form from a stored definition, for editing.
 *
 * The name is put in BOTH halves — `targetPick` so the dropdown shows it when
 * the backend has it, and `targetTyped` so it survives when the backend does
 * not (a function that is not deployed yet is a legitimate target, WFA-005's
 * third value). The panel decides which control to show; neither loses the value.
 */
export function formStateFromDef(def: TriggerDef): TriggerFormState {
  return {
    type: def.type,
    targetKind: def.target.kind,
    targetPick: def.target.name,
    targetTyped: def.target.name,
    cron: def.schedule?.cron ?? EMPTY_FORM.cron,
    missedPolicy: def.schedule?.missedFirePolicy ?? 'skip',
    payloadText: def.schedule?.payload ? JSON.stringify(def.schedule.payload) : '',
    slug: def.webhook?.slug ?? '',
    scheme: def.webhook?.scheme ?? 'hmac-sha256',
    collection: def.dbChange?.collection ?? '',
    actions: {
      create: def.dbChange ? def.dbChange.actions.includes('create') : true,
      update: def.dbChange ? def.dbChange.actions.includes('update') : false,
      delete: def.dbChange ? def.dbChange.actions.includes('delete') : false
    }
  };
}

export type BuildResult = { input: TriggerInput } | { error: string };

/**
 * Build the input for a create or an update.
 *
 * **Built, not spread** — the registry checks the caller's KEYS before anything
 * is copied (WFA-005/F8), so a form that spread itself would send `slug` on a
 * schedule and earn a 400 naming a key the user never typed. Only the chosen
 * type's block is included.
 *
 * `enabled` and `secret` are never included, for an update or a create:
 *
 *  - `enabled` absent means "keep what is stored", so an edit cannot re-enable a
 *    trigger someone turned off while the form was open;
 *  - sending `secret` REPLACES a webhook's secret, which is the one thing an
 *    edit must not do as a side effect. Rotation is its own action.
 *
 * The `id` is not included either: for an update it is in the URL, and for a
 * create the registry mints it.
 */
export function buildTriggerInput(form: TriggerFormState): BuildResult {
  const name = targetNameOf(form);
  if (!name) return { error: `A target ${form.targetKind} is required.` };

  const input: TriggerInput = { type: form.type, target: { kind: form.targetKind, name } };

  if (form.type === 'schedule') {
    input.schedule = { cron: form.cron.trim(), missedFirePolicy: form.missedPolicy };
    const text = form.payloadText.trim();
    if (text) {
      // Parsed here rather than posted as a string, so a malformed payload is a
      // message about THIS field instead of a validator error about a type.
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        return { error: `The payload is not valid JSON: ${e instanceof Error ? e.message : String(e)}` };
      }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { error: 'The payload must be a JSON object — it is delivered as the run’s body.' };
      }
      input.schedule.payload = parsed as Record<string, unknown>;
    }
  } else if (form.type === 'webhook') {
    input.webhook = { slug: form.slug.trim(), scheme: form.scheme };
  } else if (form.type === 'db-change') {
    input.dbChange = {
      collection: form.collection.trim(),
      actions: (Object.keys(form.actions) as ChangeAction[]).filter((a) => form.actions[a])
    };
  }

  return { input };
}

/** The trigger's human name, for a sentence about it. */
export function triggerLabelOf(def: TriggerDef): string {
  return def.name || def.webhook?.slug || def.dbChange?.collection || def.target.name || def.id;
}

/**
 * What changed between two reads of the same trigger, in words.
 *
 * The conflict message an editor shows when the registry moved under an open
 * form (assessment §2). Field by field rather than "it changed", because the
 * thing quietly reverted could be *this hook was disabled because it was firing
 * into production* — and a user cannot weigh that against their own edit without
 * being told which it was.
 *
 * `status`, `createdAt` and `updatedAt` are deliberately not compared: they move
 * on their own (a fire, the write itself) and reporting them would make every
 * save look contested.
 */
export function describeTriggerChange(before: TriggerDef, after: TriggerDef): string[] {
  const changes: string[] = [];

  if (before.enabled !== after.enabled) changes.push(after.enabled ? 'it was enabled' : 'it was disabled');
  if ((before.name || '') !== (after.name || '')) changes.push(`its name is now “${after.name || '(none)'}”`);
  if (before.target.kind !== after.target.kind || before.target.name !== after.target.name) {
    changes.push(`it now runs the ${after.target.kind} “${after.target.name}”`);
  }

  if (before.schedule?.cron !== after.schedule?.cron) changes.push(`its cron is now “${after.schedule?.cron}”`);
  if (before.schedule?.missedFirePolicy !== after.schedule?.missedFirePolicy) {
    changes.push(`its missed-fire policy is now “${after.schedule?.missedFirePolicy}”`);
  }
  if (JSON.stringify(before.schedule?.payload) !== JSON.stringify(after.schedule?.payload)) {
    changes.push('its payload changed');
  }

  if (before.webhook?.slug !== after.webhook?.slug) changes.push(`its URL slug is now “${after.webhook?.slug}”`);
  if (before.webhook?.scheme !== after.webhook?.scheme) changes.push(`its scheme is now “${after.webhook?.scheme}”`);

  if (before.dbChange?.collection !== after.dbChange?.collection) {
    changes.push(`it now watches “${after.dbChange?.collection}”`);
  }
  if ((before.dbChange?.actions || []).join(',') !== (after.dbChange?.actions || []).join(',')) {
    changes.push(`it now fires on ${(after.dbChange?.actions || []).join(', ') || 'nothing'}`);
  }

  // The fallback is not decoration: `updatedAt` moving with no visible diff is
  // exactly what a secret rotation looks like, and that is worth saying rather
  // than reporting "nothing changed" over a definition that plainly did.
  if (changes.length === 0) changes.push('its configuration was written by something else (its secret may have been rotated)');

  return changes;
}
