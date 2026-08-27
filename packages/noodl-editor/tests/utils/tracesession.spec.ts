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
type Call =
  | { cmd: 'traceEnabled'; enabled: boolean }
  | { cmd: 'getTraceEvents'; afterSeq?: number }
  | { cmd: 'getTraceState' };

class FakeConnection {
  public calls: Call[] = [];
  /** What the next `getTraceEvents` answers with. Empty is a legitimate answer. */
  public buffer: TraceEventLike[] = [];
  /** When false, a pull goes unanswered — a preview that has gone away mid-request. */
  public answers = true;
  /**
   * HUD-004: this editor's id on the relay, which the real `sendTraceEnabled` stamps as `owner`.
   * Read by the session to work out which owners in a `traceState` reply are somebody else.
   */
  public clientId = 'editor-fake';
  /** What the runtime answers `getTraceState` with — nobody tracing, empty buffer, by default. */
  public traceState: { enabled: boolean; owners: string[]; highestSeq: number } = {
    enabled: false,
    owners: [],
    highestSeq: 0
  };
  /** When false the runtime never answers — a viewer bundle older than HUD-004. */
  public answersState = true;

  sendTraceEnabled(enabled: boolean) {
    this.calls.push({ cmd: 'traceEnabled', enabled });
  }

  sendGetTraceState(_clientId: string) {
    this.calls.push({ cmd: 'getTraceState' });
    if (!this.answersState) return;
    EventDispatcher.instance.emit('TraceState', { clientId: 'client-1', state: this.traceState });
  }

  sendGetTraceEvents(_clientId: string, afterSeq?: number) {
    this.calls.push({ cmd: 'getTraceEvents', afterSeq });
    if (!this.answers) return;
    const events = afterSeq === undefined ? this.buffer : this.buffer.filter((e) => e.seq > afterSeq);
    EventDispatcher.instance.emit('TraceEvents', { clientId: 'client-1', events });
  }

  /**
   * The commands, in order, **without the trace-state chatter**.
   *
   * `getTraceState` rides along with the arm and with every poll (HUD-004), and every assertion
   * in this file is about the ordering of arming against pulling — which is FH-011's whole
   * subject and would be unreadable with a third command interleaved through it.
   */
  cmds(): string[] {
    return this.calls.filter((c) => c.cmd !== 'getTraceState').map((c) => c.cmd);
  }

  allCmds(): string[] {
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
    // GAT-004: the suite-wide listener rollback (tests/index.ts) strips every
    // EventDispatcher subscription a spec registers, including the ones
    // listen() makes on first use — but listen()'s `listening` latch would stop
    // it re-registering, leaving every spec after the first deaf (all 10 specs
    // here failed that way, 2026-08-27, seed 00697). Reset the latch so each
    // spec's first listen() registers fresh subscriptions inside its own window.
    (session as unknown as { listening: boolean }).listening = false;
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
      // ⚠️ The state request comes *first* (HUD-004): the answer wanted is the one describing
      // the trace before this editor touched it.
      expect(connection.allCmds()).toEqual(['getTraceState', 'traceEnabled']);

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

    // ⚠️ And it re-sends the *owner* with it (HUD-004) — `sendTraceEnabled` stamps it, which is
    // why arming is never expressed as a bare boolean anywhere above this line. A reloaded page
    // starts with an empty owner set, so a re-arm that forgot its name would land on the
    // anonymous key and share the switch with an agent all over again.
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

  // -------------------------------------------------------------------------
  // HUD-004 — the trace has owners
  // -------------------------------------------------------------------------

  describe('when another peer is tracing the same preview', () => {
    it('starts reading from where the runtime already is, not from zero', async () => {
      // An agent has been tracing for a while; the buffer is 40 events deep. Arming used to
      // clear it, so `lastSeq = 0` was safe. It no longer does — so a pull from zero would
      // hand this session the agent's forty events and present them as what the user had just
      // recorded.
      connection.traceState = { enabled: true, owners: ['observe-1'], highestSeq: 40 };

      session.start();
      connection.buffer = [event(41)];
      await session.refreshEvents();

      const pull = connection.calls.find((c) => c.cmd === 'getTraceEvents') as { afterSeq?: number };
      expect(pull.afterSeq).toBe(40);
      expect(session.traceEvents.map((e) => e.seq)).toEqual([41]);
    });

    it('knows it joined a trace somebody else had already started', () => {
      connection.traceState = { enabled: true, owners: ['observe-1'], highestSeq: 40 };

      session.start();

      expect(session.joinedExistingTrace).toBe(true);
      expect(session.otherOwners).toEqual(['observe-1']);
    });

    it('does not claim to have joined one when it started the trace itself', () => {
      session.start();

      expect(session.joinedExistingTrace).toBe(false);
      expect(session.otherOwners).toEqual([]);
    });

    it('does not count itself among the other owners', () => {
      connection.traceState = { enabled: true, owners: ['editor-fake', 'observe-1'], highestSeq: 3 };

      session.start();

      expect(session.otherOwners).toEqual(['observe-1']);
    });

    it('notices an agent arriving and leaving while a recording runs', () => {
      session.start();
      expect(session.otherOwners).toEqual([]);

      let announcements = 0;
      const group = {};
      session.on('ownersChanged', () => announcements++, group);

      // ⚠️ Driven by the reply, not by the poll that asks for it. A `tick()` cannot advance a
      // pull that resolves on a microtask, so a spec that drove this through the timer would be
      // asserting the test harness rather than the session. That the poll *asks* is the spec
      // below.
      const say = (owners: string[]) =>
        EventDispatcher.instance.emit('TraceState', {
          clientId: 'client-1',
          state: { enabled: true, owners, highestSeq: 2 }
        });

      say(['editor-fake', 'observe-1']);
      expect(session.otherOwners).toEqual(['observe-1']);

      // The same answer again is not news. Without this the header would re-render on every
      // poll for the life of the recording.
      say(['editor-fake', 'observe-1']);

      say(['editor-fake']);
      expect(session.otherOwners).toEqual([]);

      // Both transitions announced, the repeat not — a header that quietly loses a phrase is
      // indistinguishable from one that never had it, which is what the whole bug looked like.
      expect(announcements).toBe(2);
      session.off(group);
    });

    it('asks who is tracing on every poll, so an agent leaving is not invisible', () => {
      // ⚠️ The clock goes in **before** `start()`: the poll's interval is registered there, and
      // one registered against the real timer is one `tick()` can never fire.
      jasmine.clock().install();
      try {
        session.start();
        const before = connection.allCmds().filter((c) => c === 'getTraceState').length;

        jasmine.clock().tick(LIVE_POLL_MS + 1);

        // Nothing announces an agent arming or disarming — the runtime never pushes — so the
        // only way the header can be current is by asking alongside the pull it already makes.
        expect(connection.allCmds().filter((c) => c === 'getTraceState').length).toBe(before + 1);
      } finally {
        jasmine.clock().uninstall();
      }
    });

    it('takes the buffer position from the arm only, never from a later reply', async () => {
      // The polled `traceState` keeps the *owners* current and must not touch `lastSeq`: the
      // runtime answers "where I am now", and events arriving between that answer and the pull
      // landing would be skipped forever.
      session.start();
      connection.buffer = [event(1), event(2)];
      await session.refreshEvents();

      EventDispatcher.instance.emit('TraceState', {
        clientId: 'client-1',
        state: { enabled: true, owners: ['editor-fake'], highestSeq: 900 }
      });

      connection.buffer = [event(1), event(2), event(3)];
      await session.refreshEvents();

      expect(session.traceEvents.map((e) => e.seq)).toEqual([1, 2, 3]);
    });

    it('records normally against a viewer too old to answer at all', async () => {
      // A viewer bundle built before HUD-004 never replies to `getTraceState`. The arm must not
      // wait on it forever — a recording that captures nothing under a live counter is strictly
      // worse than the behaviour this replaced.
      connection.answersState = false;

      jasmine.clock().install();
      try {
        session.start();
        connection.buffer = [event(1)];

        // Blocked while the deadline is outstanding, rather than pulling from zero.
        jasmine.clock().tick(LIVE_POLL_MS + 1);
        expect(connection.cmds().filter((c) => c === 'getTraceEvents').length).toBe(0);

        // Deadline expires; the next poll behaves exactly as it did before this task.
        jasmine.clock().tick(LIVE_POLL_MS * 3);
      } finally {
        jasmine.clock().uninstall();
      }

      await session.refreshEvents();
      expect(session.traceEvents.map((e) => e.seq)).toEqual([1]);
    });

    it('stops only its own hold — Stop is not a global switch any more', async () => {
      connection.traceState = { enabled: true, owners: ['observe-1'], highestSeq: 0 };
      session.start();

      await session.stop();

      // One `traceEnabled: false`, carrying this editor's owner (stamped by the real
      // `ViewerConnection.sendTraceEnabled`). Nothing here asks the runtime to stop capturing —
      // that is the runtime's decision once its owner set empties, and the agent is still in it.
      const disarms = connection.calls.filter((c) => c.cmd === 'traceEnabled' && c.enabled === false);
      expect(disarms.length).toBe(1);
      expect(session.recording).toBe(false);
    });
  });
});
