import NodeTypeAdapter from './NodeTypeAdapter';

/** The `Model.parametersChanged` event, as much of it as this adapter reads. */
interface ParametersChangedEvent {
  model: { setParameter(name: string, value: unknown, options: { undo: unknown }): void };
  args: { name: string; oldValue?: unknown; value?: unknown; undo?: unknown };
}

/**
 * FH-021 — clear the Filter when the watched Class changes.
 *
 * The same rule as {@link QueryRecordsAdapter}, and it matters more here than it does
 * there. A filter left behind names columns of the class the author just moved away from;
 * on Query Records that produces a query the server rejects out loud, but a *subscription*
 * filter is evaluated per changed record by `nodegx-backend/src/realtime/filter.ts`, and a
 * condition on a column the record does not have simply matches nothing. The result is a
 * subscription that connects, confirms, reports `Subscribed`, and then delivers no events
 * at all — with nothing anywhere saying why.
 *
 * There is no `visualSort` to clear: a subscription has no order.
 */
export class SubscribeToChangesAdapter extends NodeTypeAdapter {
  events: Record<string, (e: ParametersChangedEvent) => void>;

  constructor() {
    super('SubscribeToChanges');

    this.events = {
      'parametersChanged:SubscribeToChanges': this.parametersChanged.bind(this)
    };
  }

  parametersChanged(e: ParametersChangedEvent) {
    const node = e.model;

    // Only when the class actually moved, and only inside an undo group — the same two
    // guards Query Records uses, so an import or a programmatic set does not wipe a filter
    // the author cannot get back.
    if (e.args.name === 'collectionName' && e.args.oldValue !== e.args.value && e.args.undo) {
      node.setParameter('visualFilter', undefined, { undo: e.args.undo });
    }
  }
}
