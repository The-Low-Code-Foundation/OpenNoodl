/**
 * The renderer's door to a backend's trigger registry (WFA-005).
 *
 * §5 of the spec: the panel and the canvas agree. They agree by going through
 * THIS module — one set of types, one set of IPC calls, one idea of what a
 * target is. Whatever the canvas can express, the panel can too, and neither has
 * a field the other silently ignores.
 *
 * Two properties worth stating, both mirrors of `WorkflowBackendClient`:
 *
 *  - **Every call names a backend.** A trigger belongs to the backend whose
 *    `triggers.json` holds it. There is no "the" backend.
 *  - **Triggers are backend objects, not part of a workflow.** Drawing one on a
 *    workflow's canvas is a VIEW of a backend object; deleting that node deletes
 *    the trigger from the backend, and a trigger targeting a function rather
 *    than a workflow never appears on a canvas at all.
 *
 * @module models/triggers/TriggerBackendClient
 */

import { ipcInvoke } from '@noodl-utils/ipc';

import { EventDispatcher } from '../../../../shared/utils/EventDispatcher';
import { deployedFunctionNames } from '../workflow/functionRefResolution';

export type TriggerType = 'schedule' | 'webhook' | 'db-change';
export type MissedFirePolicy = 'skip' | 'run-once-on-start';
export type WebhookScheme = 'hmac-sha256' | 'token';
export type ChangeAction = 'create' | 'update' | 'delete';

/** What a trigger invokes. `name` is the function name, or the workflow **id**. */
export interface TriggerTarget {
  kind: 'function' | 'workflow';
  name: string;
}

export interface TriggerStatus {
  lastFiredAt: string | null;
  nextFireAt: string | null;
  lastResult: { ok: boolean; at: string; statusCode?: number; error?: string } | null;
  fireCount: number;
}

export interface TriggerDef {
  id: string;
  type: TriggerType;
  name?: string;
  enabled: boolean;
  target: TriggerTarget;
  schedule?: { cron: string; missedFirePolicy: MissedFirePolicy; payload?: Record<string, unknown> };
  webhook?: { slug: string; scheme: WebhookScheme; maxBodyBytes: number };
  dbChange?: { collection: string; actions: ChangeAction[] };
  createdAt?: string;
  updatedAt?: string;
  status: TriggerStatus;
}

/** What a create/update sends. The registry owns status and timestamps. */
export interface TriggerInput {
  id?: string;
  type: TriggerType;
  name?: string;
  enabled?: boolean;
  target: TriggerTarget;
  schedule?: { cron: string; missedFirePolicy: MissedFirePolicy; payload?: Record<string, unknown> };
  webhook?: { slug: string; scheme?: WebhookScheme; maxBodyBytes?: number };
  dbChange?: { collection: string; actions: ChangeAction[] };
  secret?: string;
}

export interface TriggerCreated {
  trigger: TriggerDef;
  /** Plaintext webhook secret, returned exactly once and never recoverable. */
  secret?: string;
}

/**
 * What a backend can actually be pointed at.
 *
 * F9: the panel's target was free text, so a typo was accepted with a 201 and
 * only surfaced at the next fire — a mistake made in a form that knew the
 * function list. This is that list, read from the backend rather than assumed.
 */
export interface TriggerTargets {
  functions: string[];
  /** Workflow definitions, by id, with the name to show. */
  workflows: { id: string; name: string }[];
  /** True when the backend answered at all. False means "we do not know", not "there are none". */
  known: boolean;
}

/**
 * A trigger on a backend was created, edited, toggled, rotated or deleted
 * (WFA-008 §4).
 *
 * Emitted by the write functions below rather than by their callers, which is
 * the same rule WFA-006 used to close F48: a caller that must remember to
 * announce a change is a caller that will forget. Since §5 of WFA-005 every
 * surface writes through this module, so this is the one place a change is
 * known to have happened.
 *
 * The listener that matters is the open workflow canvas, whose entry nodes are a
 * VIEW of these objects — and a re-targeted trigger changes which workflow it
 * belongs to at all, so redrawing is not optional.
 */
export const TRIGGERS_CHANGED = 'backend:triggersChanged';

export interface TriggersChangedDetail {
  backendId: string;
}

function announceChanged(backendId: string): void {
  EventDispatcher.instance.emit(TRIGGERS_CHANGED, { backendId } satisfies TriggersChangedDetail);
}

export async function listTriggers(backendId: string): Promise<TriggerDef[]> {
  const result = await ipcInvoke<{ triggers?: TriggerDef[] }>('backend:listTriggers', backendId);
  return result?.triggers || [];
}

/**
 * One trigger, read fresh.
 *
 * The edit form opens from THIS rather than from the list the panel rendered,
 * and keeps the `updatedAt` it answers with as its concurrency token: a form
 * prefilled from a stale snapshot would write stale values back for every field
 * the user did not touch.
 */
export async function getTrigger(backendId: string, triggerId: string): Promise<TriggerDef | null> {
  const result = await ipcInvoke<{ trigger?: TriggerDef }>('backend:getTrigger', backendId, triggerId);
  return result?.trigger || null;
}

export async function createTrigger(backendId: string, input: TriggerInput): Promise<TriggerCreated> {
  const created = await ipcInvoke<TriggerCreated>('backend:createTrigger', backendId, input);
  announceChanged(backendId);
  return created;
}

/**
 * Change an existing trigger's configuration (WFA-008).
 *
 * Two things this deliberately does not do, both of which would be
 * data-loss-shaped:
 *
 *  - **it does not send `secret`.** `upsert` keeps a webhook's stored secret
 *    unless the caller sends one, which is the whole reason editing beats
 *    delete-and-recreate; sending it would rotate as a side effect of changing a
 *    cron. Rotation is `rotateTriggerSecret`.
 *  - **it does not send `enabled`.** Absent means "keep what is stored", so a
 *    trigger someone disabled while the form was open stays disabled.
 *
 * A `type` different from the stored one, and an id the backend does not hold,
 * are both refused by the backend (F58, F59) rather than defended against here.
 */
export async function updateTrigger(
  backendId: string,
  triggerId: string,
  input: TriggerInput
): Promise<TriggerCreated> {
  const result = await ipcInvoke<TriggerCreated>('backend:updateTrigger', backendId, triggerId, input);
  announceChanged(backendId);
  return result;
}

/**
 * Mint a new secret for a webhook trigger, returned once.
 *
 * Every sender still holding the previous secret is rejected from this moment,
 * so the caller must have said so before getting here.
 */
export async function rotateTriggerSecret(
  backendId: string,
  triggerId: string
): Promise<TriggerCreated> {
  const result = await ipcInvoke<TriggerCreated>('backend:rotateTriggerSecret', backendId, triggerId);
  announceChanged(backendId);
  return result;
}

export async function setTriggerEnabled(backendId: string, triggerId: string, enabled: boolean): Promise<void> {
  await ipcInvoke('backend:setTriggerEnabled', backendId, triggerId, enabled);
  announceChanged(backendId);
}

export async function deleteTrigger(backendId: string, triggerId: string): Promise<void> {
  await ipcInvoke('backend:deleteTrigger', backendId, triggerId);
  announceChanged(backendId);
}

export async function fireTrigger(
  backendId: string,
  triggerId: string,
  payload: Record<string, unknown> = {}
): Promise<{ result?: { ok?: boolean; error?: string } }> {
  return await ipcInvoke<{ result?: { ok?: boolean; error?: string } }>(
    'backend:fireTrigger',
    backendId,
    triggerId,
    payload
  );
}

/**
 * The two lists a target can be chosen from, read off the running backend.
 *
 * Both are best-effort by design: `known: false` means the backend could not be
 * asked, and an unknown target must then be shown as *unknown*, never as wrong.
 * Free text stays permitted for a function that is not deployed yet — flagging
 * an unresolved target is an addition to the fire-time error, not a replacement
 * for it.
 */
export async function fetchTriggerTargets(backendId: string): Promise<TriggerTargets> {
  const empty: TriggerTargets = { functions: [], workflows: [], known: false };
  try {
    const [status, defsPerBackend] = await Promise.all([
      ipcInvoke<{ initialized?: boolean; functions?: unknown }>('backend:workflow-status', backendId),
      ipcInvoke<{ backendId: string; workflows?: { id: string; name?: string }[]; error?: string }[]>(
        'backend:list-workflow-defs'
      )
    ]);

    // F54: `GET /admin/workflows` answers `functions: {name, workflow}[]`, so the
    // `.map(String)` this used to do produced `["[object Object]"]` — the picker
    // listed a placeholder and `isTargetResolved` then answered FALSE for a
    // function that is deployed, which is the wrong warning about a working
    // trigger that its own third value exists to prevent. One reader for both
    // surfaces now, shared with WFA-006's resolution helper.
    const functions: string[] = deployedFunctionNames(status).names;

    // `list-workflow-defs` answers for EVERY running backend; a trigger can only
    // point at its own backend's workflows, so the others are dropped here
    // rather than offered as targets that would 404 at fire time.
    const mine = (defsPerBackend || []).find((b) => b.backendId === backendId);
    const workflows = (mine?.workflows || []).map((w) => ({ id: w.id, name: w.name || w.id }));

    return { functions, workflows, known: Boolean(status?.initialized) && !mine?.error };
  } catch {
    return empty;
  }
}

/**
 * Does this backend have what the trigger points at?
 *
 * `null` when the lists could not be read — the caller must say "cannot check"
 * rather than "not found", because a wrong warning about a working trigger is
 * worse than no warning at all.
 */
export function isTargetResolved(target: TriggerTarget, targets: TriggerTargets): boolean | null {
  if (!targets.known) return null;
  return target.kind === 'workflow'
    ? targets.workflows.some((w) => w.id === target.name)
    : targets.functions.includes(target.name);
}

/**
 * Where this backend is listening, or `null` when it is not running.
 *
 * Built from the port the service actually bound (`status.port`) rather than the
 * configured one, because a backend started on port 0 binds something else and
 * the URL is the thing a user pastes into a third-party service.
 */
export async function fetchBackendEndpoint(backendId: string): Promise<string | null> {
  try {
    const status = await ipcInvoke<{ running?: boolean; port?: number; endpoint?: string }>(
      'backend:status',
      backendId
    );
    if (!status?.running) return null;
    return status.port ? `http://127.0.0.1:${status.port}` : status.endpoint || null;
  } catch {
    return null;
  }
}

/** `POST /hooks/<backendId>/<slug>` — the single most-wanted string in this feature. */
export function webhookUrl(endpoint: string, backendId: string, slug: string): string {
  return `${endpoint.replace(/\/+$/, '')}/hooks/${backendId}/${slug}`;
}

/**
 * A plain-English gloss of a cron expression, for the canvas card and the panel.
 *
 * Deliberately partial: it recognises the shapes people actually author and
 * otherwise says nothing rather than guessing. A wrong gloss on a schedule is
 * worse than no gloss — it is read as the truth about when this fires.
 */
export function cronGloss(cron: string): string | null {
  const expr = cron.trim();
  const presets: Record<string, string> = {
    '@yearly': 'once a year, on 1 January',
    '@monthly': 'on the 1st of every month',
    '@weekly': 'every Sunday',
    '@daily': 'every day at midnight',
    '@hourly': 'every hour, on the hour',
    '@minutely': 'every minute'
  };
  if (presets[expr]) return presets[expr];

  const parts = expr.split(/\s+/);
  if (parts.length !== 5) return null;
  const [min, hour, dom, month, dow] = parts;
  const everyDate = dom === '*' && month === '*' && dow === '*';

  const stepMinutes = /^\*\/(\d+)$/.exec(min);
  if (stepMinutes && hour === '*' && everyDate) {
    const n = Number(stepMinutes[1]);
    return n === 1 ? 'every minute' : `every ${n} minutes`;
  }
  if (min === '*' && hour === '*' && everyDate) return 'every minute';

  const stepHours = /^\*\/(\d+)$/.exec(hour);
  if (/^\d+$/.test(min) && stepHours && everyDate) {
    const n = Number(stepHours[1]);
    return `every ${n === 1 ? 'hour' : `${n} hours`}, at ${min.padStart(2, '0')} past`;
  }
  if (/^\d+$/.test(min) && hour === '*' && everyDate) {
    return `every hour, at ${min.padStart(2, '0')} past`;
  }
  if (/^\d+$/.test(min) && /^\d+$/.test(hour)) {
    const at = `${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;
    if (everyDate) return `at ${at} daily`;
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    if (dom === '*' && month === '*' && /^[0-7]$/.test(dow)) {
      return `at ${at} every ${days[Number(dow) % 7]}`;
    }
    if (/^\d+$/.test(dom) && month === '*' && dow === '*') {
      return `at ${at} on day ${dom} of the month`;
    }
  }
  return null;
}
