/**
 * DbChangeTriggers — fires db-change triggers from post-commit change events
 * (WF-005 implementation step 4).
 *
 * ## One tap, second consumer (contract)
 *
 * This class does NOT touch the adapter. It is the SECOND consumer of BAK-001's
 * ChangeBus — the realtime SSE hub is the first — subscribing to the SAME bus
 * instance the service constructs in service.ts via `bus.subscribe()`. There is
 * no second event tap: the "one tap, two consumers" contract from the ChangeBus
 * docblock holds. Events are already post-commit and `delete` already carries
 * the pre-delete record (BAK-001), so a delete-triggered handler sees the row.
 *
 * ## Loop protection (decided + documented + tested)
 *
 * A handler that writes to its own trigger table would emit another ChangeEvent
 * and recurse. The rule is a DEPTH CAP: while `maxChangeDepth` db-change handlers
 * are in flight, further change events are SUPPRESSED rather than re-triggering.
 * The default cap is 1 — i.e. "no re-trigger from trigger-context writes": a
 * handler's own writes (and any writes happening during its run) do not fire
 * db-change triggers again. A larger cap permits bounded chains.
 *
 * Consequence, documented honestly: because the guard is time-window based
 * (single process, no per-write provenance tagging across the loopback HTTP
 * boundary), an UNRELATED external write that lands while a db-change handler is
 * running is also suppressed. For single-process v1 this is the safe trade — a
 * missed delivery over an unbounded loop — and it is recorded here and in the
 * docs, not hidden. Tested in tests/dbchange.test.ts (a handler that writes to
 * its own table does not recurse unbounded).
 *
 * @module nodegx-backend/triggers/dbchange
 */

import type { ChangeBus, ChangeEvent } from '../realtime/ChangeBus';
import type { TriggerDef, TriggerRegistry } from './registry';
import type { TriggerDispatcher } from './dispatcher';

export interface DbChangeDeps {
  /** The SAME ChangeBus the RealtimeHub subscribes to (from service.ts). */
  bus: ChangeBus;
  registry: TriggerRegistry;
  dispatcher: TriggerDispatcher;
}

export class DbChangeTriggers {
  private readonly bus: ChangeBus;
  private readonly registry: TriggerRegistry;
  private readonly dispatcher: TriggerDispatcher;
  private unsubscribe: (() => void) | null = null;

  /** Number of db-change handlers currently in flight (the loop-guard depth). */
  private inFlight = 0;
  /** How many events the loop guard has suppressed (introspection / tests). */
  suppressedCount = 0;

  constructor(deps: DbChangeDeps) {
    this.bus = deps.bus;
    this.registry = deps.registry;
    this.dispatcher = deps.dispatcher;
  }

  /** Attach as the bus's second consumer. */
  start(): void {
    if (this.unsubscribe) return;
    this.unsubscribe = this.bus.subscribe((event) => this.onChange(event));
  }

  stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  private onChange(event: ChangeEvent): void {
    // Loop guard: suppress while at/over the depth cap. maxDepth 1 => a handler's
    // own writes (in flight during its run) never re-trigger.
    const maxDepth = this.registry.getMaxChangeDepth();
    if (this.inFlight >= maxDepth) {
      this.suppressedCount++;
      return;
    }

    const matching = this.registry
      .byType('db-change')
      .filter(
        (t) =>
          t.enabled &&
          t.dbChange &&
          t.dbChange.collection === event.collection &&
          t.dbChange.actions.includes(event.action)
      );

    for (const trigger of matching) this.dispatch(trigger, event);
  }

  private dispatch(trigger: TriggerDef, event: ChangeEvent): void {
    // Increment BEFORE firing so a synchronous nested write during the handler is
    // seen at depth >= maxDepth and suppressed.
    this.inFlight++;
    const done = () => {
      this.inFlight--;
    };
    Promise.resolve(
      this.dispatcher.fire({
        trigger,
        triggerType: 'db_change',
        source: `db-change ${event.action} on ${event.collection}`,
        payload: {
          trigger: 'db-change',
          triggerId: trigger.id,
          action: event.action,
          collection: event.collection,
          id: event.id,
          record: event.record
        }
      })
    ).then(done, done);
  }
}
