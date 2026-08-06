/**
 * HUD-003 — the handoff between the two halves of the product split.
 *
 * The recording HUD says *that* something happened; the Provenance panel is the only thing that
 * says *why*. Getting from one to the other is a request that has to survive the panel not
 * existing yet, and the reason this file exists is that the naive version of it —
 *
 * ```ts
 * EventDispatcher.instance.emit('provenance:root', root);
 * SidebarModel.instance.switch('provenance');
 * ```
 *
 * — loses every request whose panel has not been constructed. That is not the rare case here: a
 * whole recording can happen without anyone opening Provenance (`SidePanel` builds a panel only
 * on first open), so the *first* click on an interaction is always the losing one.
 *
 * What is asserted is the contract, not the panel: stash-then-claim, claimed exactly once, a live
 * listener consumes it so a later remount does not replay an old walk, and one pending request at
 * a time. Plus `interactionList`, which is what the HUD draws.
 *
 * ⚠️ `SidebarModel.instance.switch` is stubbed. These specs run in Electron with no sidebar
 * registered, and `switch()`'s own catch-all recovers by selecting "the first visible item" —
 * of which there are none.
 */

import { SidebarModel } from '@noodl-models/sidebar';
import {
  clearPendingProvenanceRequests,
  clearPendingProvenanceRoot,
  clearPendingProvenanceWalk,
  requestProvenanceRootWalk,
  requestProvenanceWalk,
  takePendingProvenanceRoot,
  takePendingProvenanceWalk
} from '@noodl-utils/provenance/provenanceRequest';
import { INTERACTION_LIMIT, interactionList } from '@noodl-utils/provenance/recordingHud';
import { RootEvent, TraceEventLike, Topology, buildIndex } from '@noodl-utils/provenance/walkEngine';

import { EventDispatcher } from '../../src/shared/utils/EventDispatcher';

function rootEvent(seq: number, from = 'button'): RootEvent {
  return {
    event: {
      seq,
      t: seq,
      cause: 0,
      from: { node: from, port: 'click' },
      to: { node: 'counter', port: 'increment' },
      value: 'signal',
      kind: 'signal'
    },
    size: 1
  };
}

describe('provenanceRequest', () => {
  beforeEach(() => {
    spyOn(SidebarModel.instance, 'switch').and.returnValue(true);
    clearPendingProvenanceRequests();
  });

  afterEach(() => {
    clearPendingProvenanceRequests();
  });

  it('stashes a root so a panel that mounts afterwards can claim it', () => {
    const root = rootEvent(7);
    requestProvenanceRootWalk(root);

    expect(SidebarModel.instance.switch).toHaveBeenCalledWith('provenance');
    expect(takePendingProvenanceRoot()).toBe(root);
  });

  it('hands the same root out only once, so a later remount does not replay it', () => {
    requestProvenanceRootWalk(rootEvent(7));

    expect(takePendingProvenanceRoot()).toBeDefined();
    expect(takePendingProvenanceRoot()).toBeUndefined();
  });

  it('lets a live listener consume the root, so the mount path never sees it', () => {
    // The already-mounted panel: its listener runs synchronously inside `emit` and clears the
    // stash. Without this a switch back to the panel would silently repeat the last walk.
    const group = {};
    EventDispatcher.instance.on('provenance:root', () => clearPendingProvenanceRoot(), group);

    let delivered: RootEvent | undefined;
    EventDispatcher.instance.on('provenance:root', (root: RootEvent) => (delivered = root), group);

    const root = rootEvent(7);
    requestProvenanceRootWalk(root);

    expect(delivered).toBe(root);
    expect(takePendingProvenanceRoot()).toBeUndefined();

    EventDispatcher.instance.off(group);
  });

  it('keeps one pending request at a time — the last gesture wins', () => {
    requestProvenanceWalk({ node: 'text', port: 'text' });
    requestProvenanceRootWalk(rootEvent(7));

    expect(takePendingProvenanceWalk()).toBeUndefined();
    expect(takePendingProvenanceRoot()).toBeDefined();

    requestProvenanceRootWalk(rootEvent(8));
    requestProvenanceWalk({ node: 'text', port: 'text' });

    expect(takePendingProvenanceRoot()).toBeUndefined();
    expect(takePendingProvenanceWalk()).toBeDefined();
  });

  it('still honours the walk contract it inherited', () => {
    const ref = { node: 'text', port: 'text' };
    requestProvenanceWalk(ref);

    expect(takePendingProvenanceWalk()).toBe(ref);
    expect(takePendingProvenanceWalk()).toBeUndefined();

    requestProvenanceWalk(ref);
    clearPendingProvenanceWalk();
    expect(takePendingProvenanceWalk()).toBeUndefined();
  });

  it('drops every unclaimed request when the buffer they were about is replaced', () => {
    // `seq` restarts at 1 on a preview reload, so a root claimed after one names a different
    // event with total confidence. `TraceSession` announces the reset; this is the other half.
    requestProvenanceRootWalk(rootEvent(7));
    clearPendingProvenanceRequests();

    expect(takePendingProvenanceRoot()).toBeUndefined();
    expect(takePendingProvenanceWalk()).toBeUndefined();
  });
});

describe('interactionList', () => {
  const topology: Topology = {
    nodes: {
      button: { name: 'Add To Cart', type: 'net.noodl.controls.button', component: '/Cart' },
      timer: { name: 'Poll', type: 'Timer', component: '/Cart' },
      counter: { name: 'Count', type: 'Counter', component: '/Cart' }
    },
    edges: [{ from: { node: 'button', port: 'click' }, to: { node: 'counter', port: 'increment' } }]
  };

  function index(events: TraceEventLike[]) {
    return buildIndex(topology, events, {}, { recording: true });
  }

  function click(seq: number, from = 'button'): TraceEventLike {
    return {
      seq,
      t: seq,
      cause: 0,
      from: { node: from, port: 'click' },
      to: { node: 'counter', port: 'increment' },
      value: 'signal',
      kind: 'signal'
    };
  }

  /** A descendant of `cause` — the cascade a click makes, which must never appear as a row. */
  function effect(seq: number, cause: number): TraceEventLike {
    return {
      seq,
      t: seq,
      cause,
      from: { node: 'counter', port: 'count' },
      to: { node: 'text', port: 'text' },
      value: '1',
      kind: 'value'
    };
  }

  it('lists roots newest first, with the editor label and the size of the tree', () => {
    const list = interactionList(index([click(1), effect(2, 1), click(3, 'timer')]));

    expect(list.rows.length).toBe(2);
    expect(list.rows[0].seq).toBe(3);
    expect(list.rows[0].label).toBe('Poll.click');
    expect(list.rows[1].seq).toBe(1);
    expect(list.rows[1].label).toBe('Add To Cart.click');
    // The click plus everything it caused — which is the whole reason roots are listed and
    // events are not.
    expect(list.rows[1].size).toBe(2);
    expect(list.hidden).toBe(0);
  });

  it('caps the list at the newest, and says how many it left out', () => {
    const events: TraceEventLike[] = [];
    for (let seq = 1; seq <= INTERACTION_LIMIT + 5; seq++) events.push(click(seq));

    const list = interactionList(index(events));

    expect(list.rows.length).toBe(INTERACTION_LIMIT);
    expect(list.rows[0].seq).toBe(INTERACTION_LIMIT + 5);
    expect(list.hidden).toBe(5);
  });

  it('is empty when a recording has captured nothing', () => {
    const list = interactionList(index([]));
    expect(list.rows.length).toBe(0);
    expect(list.hidden).toBe(0);
  });
});
