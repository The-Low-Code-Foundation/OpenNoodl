/**
 * NDA-004 criterion 2 — the send queue in a runtime that has no editor to send to.
 *
 * Found while establishing why a raised failure is invisible in a deployed build. `NoodlRuntime`
 * builds an `EditorConnection` in every runtime (`noodl-runtime.ts:285-288`, "it won't connect
 * and act as a no-op"), and the *connection* half of that claim turned out to be true while the
 * *no-op* half was not.
 *
 * `send` batches: while a timer is armed, or while disconnected, the message goes on `sendQueue`
 * and a 100ms flush is scheduled if one is not already pending. The flush returned early when
 * still disconnected — without clearing `sendTimer`. So after the first flush in a deployed
 * build, `sendTimer` is truthy for ever: every later `send` takes the queue branch, `!sendTimer`
 * is false so nothing re-arms, and `sendQueue` grows for the life of the page. Every runtime
 * warning goes down this path, so the growth is driven by exactly the diagnostics that can never
 * be delivered.
 *
 * These rows drive the real `send`/flush pair with fake timers rather than a fake queue, because
 * the defect is in the interaction between the guard at the top of `send` and the early return
 * inside the timer — a fake of either half would have kept it.
 */

/* eslint-env jest */

const EditorConnection = require('../src/editorconnection');

type ConnectionInternals = {
  sendQueue: unknown[];
  sendTimer: unknown;
  socket?: { readyState: number; send(data: string): void };
  send(data: unknown): void;
  isConnected(): boolean;
};

/** A connection as a deployed build has one: constructed, never connected, no socket. */
function aDisconnectedConnection(): ConnectionInternals {
  return new EditorConnection({
    platform: { getCurrentTime: () => Date.now(), webSocketClass: function FakeWebSocket() {} }
  });
}

describe('NDA-004 criterion 2: EditorConnection.send when there is no editor', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('H1: a disconnected flush does not leave the timer handle armed for ever', () => {
    const connection = aDisconnectedConnection();

    connection.send({ cmd: 'warning', n: 1 });
    expect(connection.sendTimer).toBeDefined();

    jest.advanceTimersByTime(150);

    // The handle is what the guard at the top of `send` reads. Leaving it set is what makes
    // every subsequent call a queue-only call with nothing left to drain it.
    expect(connection.sendTimer).toBeUndefined();
  });

  test('H2: the queue does not grow without bound while disconnected', () => {
    const connection = aDisconnectedConnection();

    // A hundred warnings over ten flush windows — a deployed app with one noisy node.
    for (let round = 0; round < 10; round++) {
      for (let i = 0; i < 10; i++) connection.send({ cmd: 'warning', round, i });
      jest.advanceTimersByTime(150);
    }

    expect(connection.sendQueue.length).toBe(0);
  });

  test('H3 (control): a connected flush still delivers everything it queued', () => {
    const connection = aDisconnectedConnection();
    const sent: string[] = [];

    connection.socket = { readyState: 1, send: (data: string) => sent.push(data) };
    (connection as unknown as { ws: { OPEN: number } }).ws = { OPEN: 1 };

    connection.send({ cmd: 'warning', n: 1 });
    connection.send({ cmd: 'warning', n: 2 });
    connection.send({ cmd: 'warning', n: 3 });
    jest.advanceTimersByTime(150);

    // Three messages, two deliveries: the first goes out immediately (`send`'s own comment —
    // "the first message will always be sent immediately … so initial message response time is
    // as low as possible"), the other two batch into one chunk. Asserting the *content* rather
    // than the chunk count is what makes this a control: "clear the queue" would otherwise pass
    // by throwing every queued message away.
    const flushed = sent.flatMap((chunk) => {
      const parsed = JSON.parse(chunk);
      return Array.isArray(parsed) ? parsed : [parsed];
    });

    expect(flushed).toEqual([
      { cmd: 'warning', n: 1 },
      { cmd: 'warning', n: 2 },
      { cmd: 'warning', n: 3 }
    ]);
    expect(connection.sendQueue.length).toBe(0);
    expect(connection.sendTimer).toBeUndefined();
  });

  test('H4: a connection that opens later reports current state rather than replaying boot', () => {
    const connection = aDisconnectedConnection();
    const sent: string[] = [];

    connection.send({ cmd: 'warning', n: 'raised-while-disconnected' });
    jest.advanceTimersByTime(150);

    (connection as unknown as { ws: { OPEN: number } }).ws = { OPEN: 1 };
    connection.socket = { readyState: 1, send: (data: string) => sent.push(data) };

    connection.send({ cmd: 'warning', n: 'raised-after-connect' });
    jest.advanceTimersByTime(150);

    // The dropped message is a deliberate decision, not an accident of the fix: these are
    // editor telemetry, and an editor attaching at minute ten wants the current warning set —
    // which the runtime re-sends — not a replay of everything since boot.
    const flushed = sent.flatMap((chunk) => JSON.parse(chunk));
    expect(flushed).toEqual([{ cmd: 'warning', n: 'raised-after-connect' }]);
  });
});
