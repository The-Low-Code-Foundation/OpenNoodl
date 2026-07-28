/**
 * ONE run payload shape, built in ONE place (WFA-003).
 *
 * THE PROBLEM THIS FIXES
 * ----------------------
 * A workflow (or a trigger-targeted cloud function) could be started five ways,
 * and each way handed it a different object:
 *
 *   webhook     { trigger:'webhook', triggerId, slug, headers, query, body }
 *   schedule    { trigger:'schedule', triggerId, firedAt, cron }
 *   manual fire { trigger:'manual', triggerId, ...body }        ← body SPREAD
 *   admin run   body.payload ?? body                            ← no envelope
 *   db change   { trigger:'db-change', triggerId, action, collection, id, record }
 *
 * The webhook wrapped the caller's JSON under `body`; the admin run did not wrap
 * at all. Phase 27's finding F13 recorded the consequence live: a workflow that
 * ran green from `POST /admin/workflow-defs/:id/run` failed from a webhook
 * carrying the same JSON with `Cannot order-compare undefined and 100` — the
 * engine failing loudly and correctly at a problem it should not have had. So
 * "triggered by a webhook AND on a schedule", which phase 19's exit criterion
 * asks for, was effectively unreachable for one definition.
 *
 * (F12 listed four entry points. There are FIVE — db-change was missed. Recorded
 * as F38.)
 *
 * THE SHAPE
 * ---------
 *   {
 *     trigger:     { type, id?, firedAt, slug?, cron?, collection?, action?, recordId? },
 *     triggerType: 'webhook',           // the bare string, for switching on entry
 *     body:        { … },               // ALWAYS the caller's own data, always here
 *     headers?:    { … },               // webhook only
 *     query?:      { … }                // webhook only
 *   }
 *
 * COMPATIBILITY, AND THE ONE KEY THAT COULD NOT BE KEPT
 * -----------------------------------------------------
 * Definitions and trigger-targeted functions exist in data directories today and
 * read the old top-level keys, so every entry point ALSO spreads exactly the keys
 * it used to deliver — deprecated, for one release. `legacy` below is that bag,
 * and it is spread FIRST so a canonical key always wins a collision. The
 * precedence is deliberate rather than a consequence of spread order: `body` must
 * be the caller's data even when the caller's data itself contains a `body` key
 * (in which case the legacy top-level view of it is shadowed, and it is reachable
 * as `body.body`).
 *
 * The exception is `trigger` itself, which was the type as a STRING and is now
 * the metadata object. One key cannot hold both. The object wins — it is what the
 * served value-language spec, the MCP tools and WFA-004's property editor are
 * written against — and the string is preserved beside it as `triggerType`.
 * `payload.trigger === 'webhook'` becomes `payload.triggerType === 'webhook'`, or
 * `payload.trigger.type`. Nothing in this repository read `payload.trigger`
 * (checked before deciding); `docs/runtime/TRIGGERS.md` documented it, and says
 * this now.
 *
 * @module nodegx-backend/workflow/runPayload
 */

import { isPlainObject } from './steps/values';
import type { RunTriggerContext } from './WorkflowRunner';

/** The canonical `trigger` envelope. Every field beyond `type` is contextual. */
export interface TriggerEnvelope {
  type: RunTriggerContext['type'];
  /** The trigger definition id, absent for a direct admin run. */
  id?: string;
  firedAt: string;
  /** Webhook slug. */
  slug?: string;
  /** Schedule cron expression. */
  cron?: string;
  /** db-change context. */
  collection?: string;
  action?: string;
  recordId?: string;
}

export interface RunPayloadInit {
  type: RunTriggerContext['type'];
  triggerId?: string;
  firedAt?: string;
  /** The caller's own data. Lands under `body`; `{}` when there is none. */
  body?: unknown;
  slug?: string;
  cron?: string;
  headers?: Record<string, unknown>;
  query?: Record<string, unknown>;
  change?: { action: string; collection: string; id?: string };
  /**
   * The pre-WFA-003 top-level keys for this entry point. Spread FIRST, so a
   * canonical key wins. Deprecated; removed a release after this one.
   */
  legacy?: Record<string, unknown>;
}

function defined<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

/**
 * A body that can be spread at the top level, for the deprecated legacy view.
 * A raw-text webhook body (or an array) is NOT spread — spreading a string
 * would scatter its characters across the payload as numeric keys, which is
 * worse than omitting it.
 */
export function spreadableBody(body: unknown): Record<string, unknown> {
  return isPlainObject(body) ? body : {};
}

/**
 * Build the run payload. The one place any entry point constructs one.
 */
export function buildRunPayload(init: RunPayloadInit): Record<string, unknown> {
  const trigger: TriggerEnvelope = defined({
    type: init.type,
    id: init.triggerId,
    firedAt: init.firedAt || new Date().toISOString(),
    slug: init.slug,
    cron: init.cron,
    collection: init.change?.collection,
    action: init.change?.action,
    recordId: init.change?.id
  });

  return {
    // Deprecated, first, so anything canonical below overrides it.
    ...(init.legacy || {}),
    trigger,
    triggerType: init.type,
    // `body` is always present. A caller that sent nothing sent `{}`, which is
    // what a schedule sends: a definition can read `body.x` unconditionally.
    body: init.body === undefined || init.body === null ? {} : init.body,
    ...(init.headers ? { headers: init.headers } : {}),
    ...(init.query ? { query: init.query } : {})
  };
}
