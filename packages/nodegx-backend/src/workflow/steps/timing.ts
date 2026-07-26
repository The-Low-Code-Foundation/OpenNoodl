/**
 * CF11-003 wait/delay step kinds: `wait` and `wait-until`.
 *
 * THE THING TO UNDERSTAND ABOUT WAITING ON A SERVER
 * --------------------------------------------------
 * In the browser a Timer is nearly free: the frame loop is running anyway, the
 * tab is the user's machine, and a pending timer costs nothing anybody bills
 * for. None of that is true here.
 *
 *   - There are no frames. A wait is a real pending timer in a real service
 *     process, and that process must stay alive for the wait to complete.
 *   - A waiting run HOLDS one of the workflow's `concurrency` slots
 *     (WF-001-SEMANTICS §6). A 10-minute wait in a workflow with the default
 *     cap of 1 means every other run of that workflow queues for 10 minutes.
 *   - Runs are IN-MEMORY (§5). A restart during a wait does not resume it —
 *     the run is recorded `error` with `metadata.interrupted`. A long wait is
 *     therefore a *fragile* wait, and the longer it is the more fragile.
 *   - On a metered host it is billed occupancy for doing nothing.
 *
 * Hence: a hard 24-hour ceiling enforced at WRITE time (so the rejection lands
 * on the author, not on a production run at 3am), and documentation that says
 * "for anything beyond minutes, use a WF-005 schedule trigger" — which costs
 * nothing while it waits and survives a restart, because it is persisted cron
 * rather than a held process.
 *
 * Both kinds are properly cancellable: cancelling the run or tripping a timeout
 * ends the wait immediately rather than sleeping out the remainder.
 *
 * @module nodegx-backend/workflow/steps/timing
 */

import type { StepExecContext, StepExecutor, StepExecResult } from '../StepExecutor';
import { StepExecutionError, stepResult } from '../StepExecutor';
import { resolveValue } from './conditions';
import { MAX_WAIT_MS, WAIT_UNIT_MS } from './kinds';
import { sleep } from './sleep';

function params(ctx: StepExecContext): Record<string, unknown> {
  return (ctx.step.params || {}) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// wait
// ---------------------------------------------------------------------------

export class WaitStepExecutor implements StepExecutor {
  async execute(ctx: StepExecContext): Promise<Record<string, unknown>> {
    const p = params(ctx);
    const unit = typeof p.unit === 'string' ? p.unit : 'milliseconds';
    const multiplier = WAIT_UNIT_MS[unit];
    if (!multiplier) {
      throw new StepExecutionError(
        `Step "${ctx.step.id}": unknown wait unit "${unit}" (${Object.keys(WAIT_UNIT_MS).join(', ')})`
      );
    }
    const duration = resolveValue(p.duration, ctx.input);
    if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) {
      throw new StepExecutionError(`Step "${ctx.step.id}": wait duration must resolve to a number > 0`);
    }

    const ms = duration * multiplier;
    if (ms > MAX_WAIT_MS) {
      throw new StepExecutionError(
        `Step "${ctx.step.id}": wait of ${duration} ${unit} exceeds the 24h cap — use a WF-005 schedule trigger`
      );
    }

    const { waitedMs } = await sleep(ms, ctx.signal);
    return { waitedMs };
  }
}

// ---------------------------------------------------------------------------
// wait-until
// ---------------------------------------------------------------------------

export class WaitUntilStepExecutor implements StepExecutor {
  async execute(ctx: StepExecContext): Promise<StepExecResult> {
    const p = params(ctx);
    const raw = resolveValue(p.target, ctx.input);
    const targetMs = parseInstant(raw);
    if (targetMs === null) {
      // An unparseable target must NOT degrade to "wait zero and carry on":
      // that turns a typo into a workflow that quietly stops honouring its
      // embargo. Fail loudly and let `onError` decide.
      throw new StepExecutionError(
        `Step "${ctx.step.id}": wait-until target ${JSON.stringify(raw)} is not an ISO-8601 date or epoch ms`
      );
    }

    const now = Date.now();
    const target = new Date(targetMs).toISOString();
    if (targetMs <= now) {
      return stepResult({ waitedMs: 0, skipped: true, target }, { select: ['skipped'] });
    }

    const delta = targetMs - now;
    if (delta > MAX_WAIT_MS) {
      throw new StepExecutionError(
        `Step "${ctx.step.id}": target ${target} is ${Math.round(delta / 3600000)}h away, beyond the 24h cap — ` +
          'use a WF-005 schedule trigger'
      );
    }

    const { waitedMs } = await sleep(delta, ctx.signal);
    return stepResult({ waitedMs, skipped: false, target }, { select: ['done'] });
  }
}

function parseInstant(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.getTime();
  if (typeof v === 'string' && v.trim()) {
    const asNumber = Number(v);
    if (Number.isFinite(asNumber) && /^\d+$/.test(v.trim())) return asNumber;
    const parsed = Date.parse(v);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}
