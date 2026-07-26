/**
 * TriggerRegistry — the persisted, deployable trigger definitions (WF-005).
 *
 * `<dataDir>/triggers.json` is policy: diffable, MCP-editable, and it deploys
 * WITH the backend (so triggers survive a restart and travel to a VPS). It is
 * validated strictly on load — an invalid file refuses to start, same doctrine
 * as security.json (a trigger that silently no-ops is an automation that fails
 * on a delay timer). Runtime status (last fired / last result / next fire) is
 * persisted back into the same file so the UI shows it across restarts.
 *
 * SECRETS DO NOT LIVE HERE. A webhook's per-hook secret lives in secrets.json
 * (SecretsStore, mode 0600); triggers.json records only the scheme. This is the
 * "secrets in secrets.json, policy in the diffable file" half of the shared
 * secrets convention.
 *
 * @module nodegx-backend/triggers/registry
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { SecretsStore, WEBHOOK_SECRETS_NAMESPACE } from '../config/SecretsStore';
import { validateCron } from './cron';

// ============================================================================
// Types
// ============================================================================

export type TriggerType = 'schedule' | 'webhook' | 'db-change';
export type MissedFirePolicy = 'skip' | 'run-once-on-start';
export type WebhookScheme = 'hmac-sha256' | 'token';
export type ChangeAction = 'create' | 'update' | 'delete';

export interface TriggerTarget {
  /**
   * 'function' invokes a cloud function directly; 'workflow' runs a WF-001
   * workflow definition through the engine (its `name` is the workflow id). Both
   * flow through the ONE dispatcher path — WF-001 added a target kind, not a
   * second dispatch path.
   */
  kind: 'function' | 'workflow';
  name: string;
}

export interface ScheduleConfig {
  cron: string;
  /**
   * What happens to fires that were due while the service was down.
   *   - 'skip' (default): ignore missed windows, resume at the next future fire.
   *   - 'run-once-on-start': if at least one fire was missed, run the target
   *     exactly ONCE at startup (never N times for N missed windows), then resume.
   */
  missedFirePolicy: MissedFirePolicy;
}

export interface WebhookConfig {
  /** URL slug: POST /hooks/<backendId>/<slug>. */
  slug: string;
  /** Verification scheme. Default hmac-sha256 (what GitHub/Stripe send). */
  scheme: WebhookScheme;
  /** Reject bodies larger than this many bytes (loud 413 + recorded). */
  maxBodyBytes: number;
}

export interface DbChangeConfig {
  collection: string;
  /** Which post-commit actions fire the trigger. */
  actions: ChangeAction[];
}

export interface TriggerResult {
  ok: boolean;
  at: string;
  statusCode?: number;
  error?: string;
}

export interface TriggerStatus {
  lastFiredAt: string | null;
  /** Schedule only — computed, not authored. */
  nextFireAt: string | null;
  lastResult: TriggerResult | null;
  fireCount: number;
}

export interface TriggerDef {
  id: string;
  type: TriggerType;
  /** Human label (optional). */
  name?: string;
  enabled: boolean;
  target: TriggerTarget;
  schedule?: ScheduleConfig;
  webhook?: WebhookConfig;
  dbChange?: DbChangeConfig;
  createdAt: string;
  updatedAt: string;
  status: TriggerStatus;
}

/** The whole-file shape. */
interface TriggersFile {
  version: 1;
  /**
   * Loop-protection depth cap for DB-change triggers (WF-005 loop rule). While
   * this many DB-change trigger handlers are in flight, further change events
   * are suppressed rather than re-triggering. Default 1 = "no re-trigger from
   * trigger-context writes."
   */
  maxChangeDepth: number;
  triggers: TriggerDef[];
}

const TRIGGERS_FILE = 'triggers.json';
const DEFAULT_MAX_BODY_BYTES = 1024 * 1024; // 1 MB
const DEFAULT_MAX_CHANGE_DEPTH = 1;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

export class TriggerConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TriggerConfigError';
  }
}

/** Input accepted by upsert — status/timestamps are owned by the registry. */
export interface TriggerInput {
  id?: string;
  type: TriggerType;
  name?: string;
  enabled?: boolean;
  target: TriggerTarget;
  schedule?: ScheduleConfig;
  webhook?: Omit<WebhookConfig, 'scheme' | 'maxBodyBytes'> &
    Partial<Pick<WebhookConfig, 'scheme' | 'maxBodyBytes'>>;
  dbChange?: DbChangeConfig;
  /** Webhook only: the plaintext secret. Generated if omitted on create. */
  secret?: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function emptyStatus(): TriggerStatus {
  return { lastFiredAt: null, nextFireAt: null, lastResult: null, fireCount: 0 };
}

// ============================================================================
// Validation (strict — unknown keys are errors)
// ============================================================================

const CHANGE_ACTIONS: ChangeAction[] = ['create', 'update', 'delete'];

/** Validate a fully-formed TriggerDef. Returns error strings; empty = valid. */
export function validateTriggerDef(raw: unknown): string[] {
  const errors: string[] = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return ['trigger must be an object'];
  const t = raw as Record<string, unknown>;

  const KEYS = new Set([
    'id', 'type', 'name', 'enabled', 'target', 'schedule', 'webhook', 'dbChange', 'createdAt', 'updatedAt', 'status'
  ]);
  for (const key of Object.keys(t)) if (!KEYS.has(key)) errors.push(`unknown key "${key}"`);

  if (typeof t.id !== 'string' || !t.id) errors.push('id must be a non-empty string');
  if (t.type !== 'schedule' && t.type !== 'webhook' && t.type !== 'db-change') {
    errors.push(`type must be one of schedule|webhook|db-change (got ${JSON.stringify(t.type)})`);
  }
  if (t.enabled !== undefined && typeof t.enabled !== 'boolean') errors.push('enabled must be a boolean');
  if (t.name !== undefined && typeof t.name !== 'string') errors.push('name must be a string');

  // target
  const target = t.target as Record<string, unknown> | undefined;
  if (!target || typeof target !== 'object') {
    errors.push('target is required');
  } else {
    if (target.kind !== 'function' && target.kind !== 'workflow') {
      errors.push('target.kind must be "function" or "workflow"');
    }
    if (typeof target.name !== 'string' || !target.name) errors.push('target.name must be a non-empty string');
  }

  // type-specific config presence
  if (t.type === 'schedule') {
    if (t.webhook || t.dbChange) errors.push('a schedule trigger must not carry webhook/dbChange config');
    const s = t.schedule as Record<string, unknown> | undefined;
    if (!s || typeof s !== 'object') {
      errors.push('schedule config is required for a schedule trigger');
    } else {
      for (const k of Object.keys(s)) if (k !== 'cron' && k !== 'missedFirePolicy') errors.push(`unknown schedule key "${k}"`);
      if (typeof s.cron !== 'string') errors.push('schedule.cron must be a string');
      else {
        const cronErr = validateCron(s.cron);
        if (cronErr) errors.push(`schedule.cron: ${cronErr}`);
      }
      if (s.missedFirePolicy !== 'skip' && s.missedFirePolicy !== 'run-once-on-start') {
        errors.push('schedule.missedFirePolicy must be "skip" or "run-once-on-start"');
      }
    }
  } else if (t.type === 'webhook') {
    if (t.schedule || t.dbChange) errors.push('a webhook trigger must not carry schedule/dbChange config');
    const w = t.webhook as Record<string, unknown> | undefined;
    if (!w || typeof w !== 'object') {
      errors.push('webhook config is required for a webhook trigger');
    } else {
      for (const k of Object.keys(w)) {
        if (k !== 'slug' && k !== 'scheme' && k !== 'maxBodyBytes') errors.push(`unknown webhook key "${k}"`);
      }
      if (typeof w.slug !== 'string' || !SLUG_RE.test(w.slug)) {
        errors.push('webhook.slug must match [a-z0-9][a-z0-9-]{0,63} (lowercase, digits, hyphens)');
      }
      if (w.scheme !== 'hmac-sha256' && w.scheme !== 'token') errors.push('webhook.scheme must be "hmac-sha256" or "token"');
      if (typeof w.maxBodyBytes !== 'number' || w.maxBodyBytes <= 0 || w.maxBodyBytes > 50 * 1024 * 1024) {
        errors.push('webhook.maxBodyBytes must be a positive number <= 50MB');
      }
    }
  } else if (t.type === 'db-change') {
    if (t.schedule || t.webhook) errors.push('a db-change trigger must not carry schedule/webhook config');
    const d = t.dbChange as Record<string, unknown> | undefined;
    if (!d || typeof d !== 'object') {
      errors.push('dbChange config is required for a db-change trigger');
    } else {
      for (const k of Object.keys(d)) if (k !== 'collection' && k !== 'actions') errors.push(`unknown dbChange key "${k}"`);
      if (typeof d.collection !== 'string' || !d.collection) errors.push('dbChange.collection must be a non-empty string');
      if (!Array.isArray(d.actions) || d.actions.length === 0) {
        errors.push('dbChange.actions must be a non-empty array');
      } else {
        for (const a of d.actions) if (!CHANGE_ACTIONS.includes(a as ChangeAction)) errors.push(`unknown dbChange action "${a}"`);
      }
    }
  }

  return errors;
}

// ============================================================================
// Registry
// ============================================================================

export class TriggerRegistry {
  private readonly filePath: string;
  private readonly secrets: SecretsStore;
  private triggers: TriggerDef[] = [];
  private maxChangeDepth = DEFAULT_MAX_CHANGE_DEPTH;

  constructor(private readonly dataDir: string, secrets: SecretsStore) {
    this.filePath = path.join(dataDir, TRIGGERS_FILE);
    this.secrets = secrets;
    this.load();
  }

  /** Load + validate triggers.json. An invalid file refuses to start (loud). */
  private load(): void {
    if (!fs.existsSync(this.filePath)) {
      this.triggers = [];
      this.maxChangeDepth = DEFAULT_MAX_CHANGE_DEPTH;
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
    } catch (e) {
      throw new TriggerConfigError(`${this.filePath} is not valid JSON: ${e instanceof Error ? e.message : e}`);
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new TriggerConfigError(`${this.filePath} must be a JSON object`);
    }
    const file = parsed as Record<string, unknown>;
    if (file.version !== 1) throw new TriggerConfigError(`${this.filePath}: unsupported version ${JSON.stringify(file.version)}`);
    if (!Array.isArray(file.triggers)) throw new TriggerConfigError(`${this.filePath}: triggers must be an array`);

    const allErrors: string[] = [];
    const seenIds = new Set<string>();
    const seenSlugs = new Set<string>();
    for (const raw of file.triggers) {
      const errs = validateTriggerDef(raw);
      const t = raw as TriggerDef;
      if (errs.length === 0) {
        if (seenIds.has(t.id)) allErrors.push(`duplicate trigger id "${t.id}"`);
        seenIds.add(t.id);
        if (t.type === 'webhook' && t.webhook) {
          if (seenSlugs.has(t.webhook.slug)) allErrors.push(`duplicate webhook slug "${t.webhook.slug}"`);
          seenSlugs.add(t.webhook.slug);
        }
      }
      for (const e of errs) allErrors.push(`trigger ${t && t.id ? `"${t.id}"` : '(unknown)'}: ${e}`);
    }
    if (allErrors.length > 0) {
      throw new TriggerConfigError(
        `${this.filePath} is invalid — refusing to start with triggers that would not fire correctly:\n` +
          allErrors.map((e) => `  - ${e}`).join('\n')
      );
    }

    this.triggers = (file.triggers as TriggerDef[]).map((t) => ({ ...t, status: { ...emptyStatus(), ...t.status } }));
    this.maxChangeDepth =
      typeof file.maxChangeDepth === 'number' && file.maxChangeDepth >= 0 ? file.maxChangeDepth : DEFAULT_MAX_CHANGE_DEPTH;
  }

  private persist(): void {
    fs.mkdirSync(this.dataDir, { recursive: true });
    const file: TriggersFile = { version: 1, maxChangeDepth: this.maxChangeDepth, triggers: this.triggers };
    const tmp = `${this.filePath}.tmp-${process.pid}`;
    fs.writeFileSync(tmp, JSON.stringify(file, null, 2) + '\n');
    fs.renameSync(tmp, this.filePath);
  }

  getMaxChangeDepth(): number {
    return this.maxChangeDepth;
  }

  /** All triggers (secret material never included — TriggerDef carries none). */
  list(): TriggerDef[] {
    return this.triggers.map((t) => ({ ...t }));
  }

  get(id: string): TriggerDef | null {
    const t = this.triggers.find((x) => x.id === id);
    return t ? { ...t } : null;
  }

  /** Enabled triggers of a type. */
  byType(type: TriggerType): TriggerDef[] {
    return this.triggers.filter((t) => t.type === type);
  }

  /** An ENABLED webhook trigger by slug, or null. */
  enabledWebhookBySlug(slug: string): TriggerDef | null {
    const t = this.triggers.find((x) => x.type === 'webhook' && x.enabled && x.webhook && x.webhook.slug === slug);
    return t ? { ...t } : null;
  }

  /** The plaintext webhook secret for a trigger (internal — verification only). */
  getWebhookSecret(id: string): string | undefined {
    return this.secrets.get(WEBHOOK_SECRETS_NAMESPACE, id);
  }

  /**
   * Create or update a trigger. Validates strictly and rejects (throws
   * TriggerConfigError) rather than persisting an unenforceable definition.
   * Returns the stored def and, for a webhook whose secret was just set/minted,
   * the plaintext secret ONCE (never retrievable again — like an API key).
   */
  upsert(input: TriggerInput): { trigger: TriggerDef; secret?: string } {
    const existing = input.id ? this.triggers.find((t) => t.id === input.id) : undefined;
    const id = input.id || 'trg_' + crypto.randomBytes(9).toString('base64url');
    const now = nowIso();

    const def: TriggerDef = {
      id,
      type: input.type,
      name: input.name,
      enabled: input.enabled !== undefined ? input.enabled : existing ? existing.enabled : true,
      target: input.target,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
      status: existing ? existing.status : emptyStatus()
    };

    let mintedSecret: string | undefined;

    if (input.type === 'schedule') {
      def.schedule = {
        cron: input.schedule ? input.schedule.cron : '',
        missedFirePolicy: input.schedule && input.schedule.missedFirePolicy ? input.schedule.missedFirePolicy : 'skip'
      };
    } else if (input.type === 'webhook') {
      const w = input.webhook;
      def.webhook = {
        slug: w ? w.slug : '',
        scheme: w && w.scheme ? w.scheme : 'hmac-sha256',
        maxBodyBytes: w && w.maxBodyBytes ? w.maxBodyBytes : DEFAULT_MAX_BODY_BYTES
      };
    } else if (input.type === 'db-change') {
      def.dbChange = input.dbChange ? { collection: input.dbChange.collection, actions: input.dbChange.actions } : undefined;
    }

    const errors = validateTriggerDef(def);
    if (errors.length > 0) {
      throw new TriggerConfigError(`Invalid trigger:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
    }

    // Unique slug guard (across the whole set, excluding self).
    if (def.type === 'webhook' && def.webhook) {
      const clash = this.triggers.find(
        (t) => t.id !== id && t.type === 'webhook' && t.webhook && t.webhook.slug === def.webhook!.slug
      );
      if (clash) throw new TriggerConfigError(`webhook slug "${def.webhook.slug}" is already used by trigger "${clash.id}"`);
    }

    // Secret handling (webhook only): store in secrets.json, mint if needed.
    if (def.type === 'webhook') {
      if (input.secret) {
        this.secrets.set(WEBHOOK_SECRETS_NAMESPACE, id, input.secret);
        mintedSecret = input.secret;
      } else if (!this.secrets.get(WEBHOOK_SECRETS_NAMESPACE, id)) {
        const secret = 'whsec_' + crypto.randomBytes(24).toString('base64url');
        this.secrets.set(WEBHOOK_SECRETS_NAMESPACE, id, secret);
        mintedSecret = secret;
      }
    }

    if (existing) {
      this.triggers = this.triggers.map((t) => (t.id === id ? def : t));
    } else {
      this.triggers.push(def);
    }
    this.persist();
    return { trigger: { ...def }, secret: mintedSecret };
  }

  setEnabled(id: string, enabled: boolean): TriggerDef | null {
    const t = this.triggers.find((x) => x.id === id);
    if (!t) return null;
    t.enabled = enabled;
    t.updatedAt = nowIso();
    this.persist();
    return { ...t };
  }

  delete(id: string): boolean {
    const before = this.triggers.length;
    this.triggers = this.triggers.filter((t) => t.id !== id);
    if (this.triggers.length === before) return false;
    this.secrets.delete(WEBHOOK_SECRETS_NAMESPACE, id);
    this.persist();
    return true;
  }

  /** Update runtime status after a fire (persisted so the UI survives restart). */
  recordFire(id: string, patch: { firedAt?: string; result?: TriggerResult; nextFireAt?: string | null }): void {
    const t = this.triggers.find((x) => x.id === id);
    if (!t) return;
    if (patch.firedAt) {
      t.status.lastFiredAt = patch.firedAt;
      t.status.fireCount += 1;
    }
    if (patch.result !== undefined) t.status.lastResult = patch.result;
    if (patch.nextFireAt !== undefined) t.status.nextFireAt = patch.nextFireAt;
    this.persist();
  }

  /** Set the computed next-fire time for a schedule trigger (no fire count bump). */
  setNextFire(id: string, nextFireAt: string | null): void {
    const t = this.triggers.find((x) => x.id === id);
    if (!t) return;
    t.status.nextFireAt = nextFireAt;
    this.persist();
  }
}
