/**
 * FH-011 — the recorder half of the provenance surface.
 *
 * `walkEngine` is unit-tested to death and `TraceSession` had no test at all, which is exactly
 * the wrong way round for the defect that was reported: the walk was never broken, the *pull*
 * was. Record → click the app → Stop showed an empty panel every time, because nothing pulled
 * the runtime's buffer unless a walk happened to be on screen and `stop()` disarmed the runtime
 * — which drops the buffer — before reading it.
 *
 * So what is asserted here is ordering and arming, not analysis:
 *
 *  - a pull happens on the session's own timer, with no walk and no panel;
 *  - `stop()` reads the buffer **before** it disarms, because after the disarm there is none;
 *  - Record refuses to arm when there is no preview to record;
 *  - a viewer that (re)registers is re-armed, since a reloaded page starts untraced;
 *  - switching project turns the runtime's trace off instead of leaving it on forever.
 *
 * ⚠️ These specs run in Electron under `devMode === 'test'`, where `ViewerConnection.instance`
 * is deliberately never constructed (`ViewerConnection.ts:1301`). The fake below is not a
 * convenience — it is the only thing there is — and it doubles as the relay: answering a
 * `getTraceEvents` by emitting `TraceEvents` back is what the runtime does, so the pull path is
 * exercised end to end on the editor side.
 */

import { NodeLibraryImporter } from '@noodl-models/nodelibrary/NodeLibraryImporter';
import { LIVE_POLL_MS, TraceSession } from '@noodl-utils/provenance/TraceSession';
import type { TraceEventLike } from '@noodl-utils/provenance/walkEngine';

import { ViewerConnection } from '../../src/editor/src/ViewerConnection';
import { EventDispatcher } from '../../src/shared/utils/EventDispatcher';

function event(seq: number): TraceEventLike {
  return {
    seq,
    t: 1000 + seq,
    cause: 0,
    from: { node: 'button', port: 'click' },
    to: { node: 'counter', port: 'increment' },
    value: 'signal',
    kind: 'signal'
  };
}

/** What the fake connection was asked to do, in order. Order is the assertion. */
type Call = { cmd: 'traceEnabled'; enabled: boolean } | { cmd: 'getTraceEvents'; afterSeq?: number };

class FakeConnection {
  public calls: Call[] = [];
  /** What the next `getTraceEvents` answers with. Empty is a legitimate answer. */
  public buffer: TraceEventLike[] = [];
  /** When false, a pull goes unanswered — a preview that has gone away mid-request. */
  public answers = true;

  sendTraceEnabled(enabled: boolean) {
    this.calls.push({ cmd: 'traceEnabled', enabled });
  }

  sendGetTraceEvents(_clientId: string, afterSeq?: number) {
    this.calls.push({ cmd: 'getTraceEvents', afterSeq });
    if (!this.answers) return;
    const events = afterSeq === undefined ? this.buffer : this.buffer.filter((e) => e.seq > afterSeq);
    EventDispatcher.instance.emit('TraceEvents', { clientId: 'client-1', events });
  }

  cmds(): string[] {
    return this.calls.map((c) => c.cmd);
  }
}

describe('TraceSession — Record has to record', () => {
  const session = TraceSession.instance;
  let connection: FakeConnection;
  let previous: ViewerConnection;

  beforeEach(() => {
    connection = new FakeConnection();
    previous = ViewerConnection.instance;
    ViewerConnection.instance = connection as unknown as ViewerConnection;
    spyOn(NodeLibraryImporter.instance, 'clientsWithRuntime').and.returnValue(['client-1']);
  });

  afterEach(() => {
    // The session is a singleton with a live timer on it; a spec that left one armed would
    // poll through every spec that follows.
    (session as unknown as { forget(): void }).forget();
    ViewerConnection.instance = previous;
  });

  it('refuses to arm when there is no preview to record', () => {
    (NodeLibraryImporter.instance.clientsWithRuntime as jasmine.Spy).and.returnValue([]);

    expect(session.start()).toBe(false);
    expect(session.recording).toBe(false);
    // Not "sent and ignored" — nothing was sent. `send()` no-ops on a closed socket, which is
    // how this arrived at a button that said "Stop" over a dead session.
    expect(connection.calls.length).toBe(0);
  });

  it('arms the runtime and starts pulling on its own timer, with no walk on screen', async () => {
    jasmine.clock().install();
    try {
      expect(session.start()).toBe(true);
      expect(connection.calls).toEqual([{ cmd: 'traceEnabled', enabled: true }]);

      connection.buffer = [event(1), event(2)];
      jasmine.clock().tick(LIVE_POLL_MS + 1);

      expect(connection.cmds()).toEqual(['traceEnabled', 'getTraceEvents']);
      expect(session.traceEvents.length).toBe(2);
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('asks only for what it does not already hold, and stops asking once stopped', async () => {
    jasmine.clock().install();
    try {
      session.start();
      connection.buffer = [event(1)];
      jasmine.clock().tick(LIVE_POLL_MS + 1);
      // Let the in-flight guard clear before the next tick — the pull resolves on a microtask.
      await Promise.resolve();

      connection.buffer = [event(1), event(2)];
      jasmine.clock().tick(LIVE_POLL_MS + 1);
      await Promise.resolve();

      expect(session.traceEvents.map((e) => e.seq)).toEqual([1, 2]);
      const pulls = connection.calls.filter((c) => c.cmd === 'getTraceEvents');
      expect(pulls.length).toBe(2);
      expect((pulls[1] as { afterSeq?: number }).afterSeq).toBe(1);
    } finally {
      jasmine.clock().uninstall();
    }

    await session.stop();

    jasmine.clock().install();
    try {
      const before = connection.calls.length;
      jasmine.clock().tick(LIVE_POLL_MS * 3);
      expect(connection.calls.length).toBe(before);
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('reads the buffer BEFORE it disarms the runtime — the disarm destroys it', async () => {
    session.start();
    connection.buffer = [event(1), event(2), event(3)];

    await session.stop();

    // The order is the whole fix. `setTraceEnabled(false)` drops the runtime's TraceBuffer, so
    // a disarm-then-read is a read of nothing, and no later Refresh can recover it.
    expect(connection.cmds()).toEqual(['traceEnabled', 'getTraceEvents', 'traceEnabled']);
    expect(session.traceEvents.map((e) => e.seq)).toEqual([1, 2, 3]);
    expect(session.recording).toBe(false);
  });

  it('keeps hasTrace after Stop, so a walk still knows which hops never fired', async () => {
    session.start();
    connection.buffer = [event(1)];
    await session.stop();

    expect(session.recording).toBe(false);
    // Reading `recording` for this is what turned every ✕ back into `·` the moment the user
    // finished recording — i.e. exactly when they turned round to read it.
    expect(session.hasTrace).toBe(true);
  });

  it('records a recording in which nothing fired, rather than reporting no recording', async () => {
    session.start();
    connection.buffer = [];

    await session.stop();

    expect(session.traceEvents.length).toBe(0);
    // The one case the feature exists for: the user reproduced the bug and the chain did not
    // fire. `hasTrace` is what makes that a wall of ✕ rather than a shrug.
    expect(session.hasTrace).toBe(true);
  });

  it('answers an empty pull instead of timing out on it', async () => {
    session.start();
    connection.buffer = [];

    // Resolves because the runtime's (empty) reply is treated as an answer. Before, this
    // waited out the full 2s request deadline on every tick of an idle recording — and a
    // deadline is what a hung preview looks like.
    const settled = await Promise.race([
      session.refreshEvents().then(() => 'answered'),
      new Promise((resolve) => setTimeout(() => resolve('timed out'), 500))
    ]);

    expect(settled).toBe('answered');
  });

  it('re-arms a viewer that registers while a recording is running', () => {
    session.start();
    connection.calls = [];

    // A preview reload builds a fresh NodeContext with traceEnabled = false. Nothing told it
    // otherwise, so the button said "Stop" over a runtime that had quietly stopped tracing.
    EventDispatcher.instance.emit('ViewerRegistered', { clientId: 'client-1' });

    expect(connection.calls).toEqual([{ cmd: 'traceEnabled', enabled: true }]);
  });

  it('does not arm a registering viewer when nothing is recording', () => {
    session.refreshEvents(); // gets the listeners registered without arming anything
    connection.calls = [];

    EventDispatcher.instance.emit('ViewerRegistered', { clientId: 'client-1' });

    expect(connection.calls.filter((c) => c.cmd === 'traceEnabled').length).toBe(0);
  });

  it('turns the runtime trace off when the project is switched out from under it', () => {
    session.start();
    connection.calls = [];

    EventDispatcher.instance.emit('ProjectModel.instanceHasChanged', { oldInstance: undefined });

    // Otherwise the preview keeps filling a ring buffer for a recording no surface is watching
    // and no gesture can stop: the flag that could have stopped it was just cleared.
    expect(connection.calls).toEqual([{ cmd: 'traceEnabled', enabled: false }]);
    expect(session.recording).toBe(false);
    expect(session.hasTrace).toBe(false);
  });
});
