/**
 * CronScheduler — fires schedule triggers while the service runs (WF-005
 * implementation step 2).
 *
 * The scheduler loop is deliberately trivial (the parsing in cron.ts is the hard
 * part): for each enabled schedule trigger, compute the next fire and arm one
 * timer; on fire, dispatch and re-arm. Single process, no queue — honest v1
 * semantics.
 *
 * ## Missed-fire policy (decided + documented)
 *
 * The service is not always running, so fires can be "missed" while it is down.
 * The DEFAULT policy is **skip**: missed windows are ignored and the trigger
 * resumes at the next FUTURE occurrence. A trigger may opt into
 * **run-once-on-start**: if one or more fires were missed while down, the target
 * runs exactly ONCE at startup (never once per missed window — no thundering
 * catch-up), then resumes normally. This is `computeStartPlan`, unit-tested in
 * tests/scheduler.test.ts.
 *
 * Rationale: "run once to catch up, or skip" is the honest pair of choices for a
 * single-process scheduler; replaying every missed window risks a storm and
 * implies a durability guarantee we do not make (Risks table: "explicit
 * documented policy beats false precision"). The UI shows last-fired / next-fire
 * so the behavior is legible.
 *
 * @module nodegx-backend/triggers/scheduler
 */

import { parseCron, CronExpression } from './cron';
import type { TriggerDef, TriggerType } from './registry';
import type { FireInput, FireOutcome, RejectionInput, TriggerResultShape } from './dispatcher';

// setTimeout clamps delays > ~24.8 days; chunk long waits so a monthly/yearly
// schedule doesn't fire immediately from an overflowed delay.
const MAX_TIMER_MS = 2 ** 31 - 1;

/**
 * The minimal registry surface the scheduler drives. The concrete
 * `TriggerRegistry` (WF-005) satisfies this structurally; so does BAK-007's
 * backup schedule registry — this is what makes it ONE scheduler class with two
 * consumers, not two schedulers. The scheduler only ever reads schedule
 * triggers and stamps their next-fire time.
 */
export interface SchedulerRegistry {
  byType(type: TriggerType): TriggerDef[];
  get(id: string): TriggerDef | null;
  setNextFire(id: string, nextFireAt: string | null): void;
}

/**
 * The minimal dispatch surface the scheduler drives. `TriggerDispatcher`
 * (WF-005) satisfies this; BAK-007's backup dispatcher does too (its `fire`
 * runs a backup instead of a function). Both write LOUD execution records.
 */
export interface SchedulerDispatcher {
  fire(input: FireInput): Promise<FireOutcome>;
  recordRejection(input: RejectionInput): TriggerResultShape;
}

export interface SchedulerDeps {
  registry: SchedulerRegistry;
  dispatcher: SchedulerDispatcher;
  /** Injectable clock for tests. */
  now?: () => Date;
}

export interface StartPlan {
  /** Fire once immediately to satisfy run-once-on-start after a missed window. */
  fireNow: boolean;
  /** The next scheduled fire strictly after `now`. */
  nextFireAt: Date;
}

/**
 * Decide, at startup, whether a schedule trigger owes a catch-up fire and when
 * its next fire is. Pure — no timers, no IO — so the missed-fire policy is
 * tested directly.
 */
export function computeStartPlan(trigger: TriggerDef, now: Date): StartPlan {
  if (!trigger.schedule) throw new Error(`trigger ${trigger.id} is not a schedule trigger`);
  const cron: CronExpression = parseCron(trigger.schedule.cron);
  const nextFireAt = cron.next(now);

  let fireNow = false;
  if (trigger.schedule.missedFirePolicy === 'run-once-on-start' && trigger.status.lastFiredAt) {
    const last = new Date(trigger.status.lastFiredAt);
    if (!isNaN(last.getTime())) {
      // A fire was due between lastFired and now → we missed at least one.
      const dueAfterLast = cron.next(last);
      if (dueAfterLast.getTime() <= now.getTime()) fireNow = true;
    }
  }
  return { fireNow, nextFireAt };
}

export class CronScheduler {
  private readonly registry: SchedulerRegistry;
  private readonly dispatcher: SchedulerDispatcher;
  private readonly now: () => Date;
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private running = false;

  constructor(deps: SchedulerDeps) {
    this.registry = deps.registry;
    this.dispatcher = deps.dispatcher;
    this.now = deps.now || (() => new Date());
  }

  /** Arm every enabled schedule trigger. Idempotent (clears then re-arms). */
  start(): void {
    this.running = true;
    this.stop(false);
    for (const trigger of this.registry.byType('schedule')) {
      if (!trigger.enabled || !trigger.schedule) continue;
      this.arm(trigger.id);
    }
  }

  /** Recompute after a registry change (admin/MCP edited triggers). */
  reschedule(): void {
    if (this.running) this.start();
  }

  private arm(triggerId: string): void {
    const trigger = this.registry.get(triggerId);
    if (!trigger || !trigger.enabled || !trigger.schedule) return;

    let plan: StartPlan;
    try {
      plan = computeStartPlan(trigger, this.now());
    } catch (e) {
      // An unreachable/invalid cron (should have failed validation) — record a
      // loud rejection and do not arm, rather than throwing in startup.
      this.dispatcher.recordRejection({
        triggerType: 'schedule',
        triggerId: trigger.id,
        workflowId: trigger.target.name,
        source: `schedule ${trigger.id}`,
        reason: `schedule not armed: ${e instanceof Error ? e.message : String(e)}`,
        triggerData: { cron: trigger.schedule.cron }
      });
      return;
    }

    this.registry.setNextFire(trigger.id, plan.nextFireAt.toISOString());

    if (plan.fireNow) {
      // One-shot catch-up; do not await (fire-and-forget, loud on failure).
      void this.fire(trigger.id, 'run-once-on-start catch-up');
    }

    this.armAt(trigger.id, plan.nextFireAt);
  }

  /** Arm a timer for a specific instant, chunking waits past the setTimeout cap. */
  private armAt(triggerId: string, when: Date): void {
    const delay = when.getTime() - this.now().getTime();
    if (delay > MAX_TIMER_MS) {
      const t = setTimeout(() => this.armAt(triggerId, when), MAX_TIMER_MS);
      if (typeof t.unref === 'function') t.unref();
      this.timers.set(triggerId, t);
      return;
    }
    const t = setTimeout(() => this.onFire(triggerId), Math.max(0, delay));
    if (typeof t.unref === 'function') t.unref();
    this.timers.set(triggerId, t);
  }

  private onFire(triggerId: string): void {
    const trigger = this.registry.get(triggerId);
    if (!trigger || !trigger.enabled || !trigger.schedule) return;

    void this.fire(triggerId, `schedule ${trigger.schedule.cron}`);

    // Re-arm for the following occurrence.
    try {
      const cron = parseCron(trigger.schedule.cron);
      const next = cron.next(this.now());
      this.registry.setNextFire(triggerId, next.toISOString());
      this.armAt(triggerId, next);
    } catch {
      // Unreachable cron mid-run — stop re-arming (already recorded on arm()).
    }
  }

  private async fire(triggerId: string, source: string): Promise<void> {
    const trigger = this.registry.get(triggerId);
    if (!trigger) return;
    await this.dispatcher.fire({
      trigger,
      triggerType: 'schedule',
      source,
      payload: {
        trigger: 'schedule',
        triggerId,
        firedAt: this.now().toISOString(),
        cron: trigger.schedule ? trigger.schedule.cron : undefined
      }
    });
  }

  /** Disarm all timers. Pass false to keep `running` (internal re-arm). */
  stop(markStopped = true): void {
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
    if (markStopped) this.running = false;
  }
}
