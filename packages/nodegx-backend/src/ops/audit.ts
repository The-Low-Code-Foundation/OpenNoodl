/**
 * The `_Audit` trail (BAK-009).
 *
 * WHO did WHAT, WHEN, from WHERE — for the privileged actions where "the
 * database changed and nobody knows why" is the failure mode: permission and
 * role edits, key issue/revoke, schema changes, backups and restores, config
 * edits, and admin logins including the failures.
 *
 * Three decisions worth stating, because each has an obvious wrong answer:
 *
 * 1. **Entries are written by the DISPATCHER, not by handlers.** A handler that
 *    forgets to call `audit()` is invisible, and reviewers do not catch that
 *    reliably — BAK-003 learned the same lesson about access gates. The
 *    dispatcher records every mutating admin route from its declared action
 *    (ops/audit-actions), and a CI test fails any such route without one.
 *    Handlers may ENRICH an entry (`ctx.audit({...})`), never create one.
 *
 * 2. **It is a plain table, and the DB owner can edit it.** No hash chain, no
 *    append-only pretence: anyone who can reach the SQLite file can rewrite
 *    history, and a tamper-proofing story that a `rm` defeats is worse than
 *    none, because it invites trust it cannot carry. The honest security
 *    boundary is "ship these rows somewhere the attacker does not control" —
 *    which the structured log already does, since every audited action also
 *    produces a log line carrying the same request id.
 *
 * 3. **Writing never blocks the action.** An audit failure is logged loudly and
 *    the operation still happens. The alternative — refusing a restore because
 *    the trail is unwritable — makes the trail a new way to lose the service.
 *
 * @module nodegx-backend/ops/audit
 */

import type { AdapterFacade } from '../persistence/AdapterFacade';
import { logger } from './logger';
import { redact } from './redact';

export const AUDIT_COLLECTION = '_Audit';

export interface AuditEntryInput {
  /** Declared action name (see ops/audit-actions). */
  action: string;
  /** 'admin' | 'admin:readonly' | 'user' | 'apiKey' | 'anonymous'. */
  actorKind: string;
  /** Stable identity within the kind: user id, key name, or '' for the single admin. */
  actor: string;
  /** What was acted on — usually the route's params (collection, role, id). */
  target?: Record<string, unknown>;
  /** Anything the handler wanted recorded. Redacted before it is stored. */
  detail?: Record<string, unknown>;
  outcome: 'success' | 'failure';
  /** HTTP status, when the action came in over HTTP. */
  status?: number;
  ip: string;
  requestId?: string;
  method?: string;
  route?: string;
}

export interface AuditQuery {
  action?: string;
  actorKind?: string;
  outcome?: 'success' | 'failure';
  /** Epoch ms bounds on `at`. */
  since?: number;
  until?: number;
  limit?: number;
  offset?: number;
}

/** Ensure `_Audit` exists. Idempotent — called from ensureSystemTables. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ensureAuditTable(schemaManager: any): void {
  if (!schemaManager) return;
  schemaManager.createTable({
    name: AUDIT_COLLECTION,
    columns: [
      { name: 'at', type: 'Date' },
      { name: 'action', type: 'String' },
      { name: 'actorKind', type: 'String' },
      { name: 'actor', type: 'String' },
      { name: 'outcome', type: 'String' },
      { name: 'status', type: 'Number' },
      { name: 'method', type: 'String' },
      { name: 'route', type: 'String' },
      { name: 'ip', type: 'String' },
      { name: 'requestId', type: 'String' },
      { name: 'target', type: 'Object' },
      { name: 'detail', type: 'Object' }
    ]
  });
}

export interface AuditLogDeps {
  facade: AdapterFacade;
  /** Live ops config — enabled/retention are editable without a restart. */
  getConfig: () => { enabled: boolean; retentionDays: number };
}

export class AuditLog {
  private readonly facade: AdapterFacade;
  private readonly getConfig: () => { enabled: boolean; retentionDays: number };
  private lastPrune = 0;

  constructor(deps: AuditLogDeps) {
    this.facade = deps.facade;
    this.getConfig = deps.getConfig;
  }

  get enabled(): boolean {
    return this.getConfig().enabled;
  }

  /**
   * Record one entry. Never throws and never rejects: the caller is in the
   * middle of finishing a request that has already happened, and there is no
   * useful way for it to react to a failed write beyond the loud log this
   * emits.
   */
  async record(input: AuditEntryInput): Promise<void> {
    if (!this.enabled) return;
    try {
      await this.facade.rawCreate(AUDIT_COLLECTION, {
        at: new Date().toISOString(),
        action: input.action,
        actorKind: input.actorKind,
        actor: input.actor,
        outcome: input.outcome,
        status: input.status ?? null,
        method: input.method || null,
        route: input.route || null,
        ip: input.ip,
        requestId: input.requestId || null,
        target: input.target ? (redact(input.target) as Record<string, unknown>) : null,
        detail: input.detail ? (redact(input.detail) as Record<string, unknown>) : null
      });
    } catch (e) {
      logger.error('audit.write-failed', {
        action: input.action,
        requestId: input.requestId,
        error: e instanceof Error ? e.message : String(e)
      });
      return;
    }
    void this.maybePrune();
  }

  /** Query the trail — the dashboard section, the MCP tool, and tests. */
  async query(query: AuditQuery = {}): Promise<{ entries: Record<string, unknown>[]; count: number }> {
    const where: Record<string, unknown> = {};
    if (query.action) where.action = query.action;
    if (query.actorKind) where.actorKind = query.actorKind;
    if (query.outcome) where.outcome = query.outcome;
    if (query.since !== undefined || query.until !== undefined) {
      const range: Record<string, unknown> = {};
      if (query.since !== undefined) range.$gte = new Date(query.since).toISOString();
      if (query.until !== undefined) range.$lte = new Date(query.until).toISOString();
      where.at = range;
    }
    const limit = Math.min(Math.max(query.limit || 100, 1), 1000);
    const { results } = await this.facade.rawQuery(AUDIT_COLLECTION, {
      where,
      limit,
      skip: query.offset || 0,
      sort: ['-at']
    });
    const count = await this.facade.rawCount(AUDIT_COLLECTION, where);
    return { entries: results as Record<string, unknown>[], count };
  }

  /**
   * Drop entries older than the retention window. Runs at most hourly, driven
   * by writes rather than a timer — this service already has three schedulers
   * and a fourth for a once-a-day delete would be ceremony.
   */
  async prune(now: number = Date.now()): Promise<number> {
    const { retentionDays } = this.getConfig();
    if (!retentionDays || retentionDays <= 0) return 0;
    const cutoff = new Date(now - retentionDays * 86_400_000).toISOString();
    try {
      const { results } = await this.facade.rawQuery(AUDIT_COLLECTION, {
        where: { at: { $lt: cutoff } },
        limit: 5000
      });
      for (const row of results) {
        await this.facade.rawDelete(AUDIT_COLLECTION, row.objectId as string);
      }
      if (results.length > 0) {
        logger.info('audit.pruned', { removed: results.length, retentionDays });
      }
      return results.length;
    } catch (e) {
      logger.warn('audit.prune-failed', { error: e instanceof Error ? e.message : String(e) });
      return 0;
    }
  }

  private async maybePrune(): Promise<void> {
    const now = Date.now();
    if (now - this.lastPrune < 3_600_000) return;
    this.lastPrune = now;
    await this.prune(now);
  }
}
