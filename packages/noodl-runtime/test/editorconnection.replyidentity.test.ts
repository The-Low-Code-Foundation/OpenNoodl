/**
 * BEN-003 / register B15 — a reply on the trace channel must say who sent it.
 *
 * The relay forwards viewer traffic to **every** editor peer, verbatim: it stamps nothing on a
 * message it did not originate. So a reply that omits `clientId` is indistinguishable from any
 * other viewer's reply once it reaches the editor, and `ViewerConnection` passes that undefined
 * straight on to every consumer.
 *
 * Measured live on 2026-08-08, before this was fixed: all eight replies of the BEN-003 probe —
 * `portValues`, `traceState`, `traceDictionary`, `traceEvents` — arrived with
 * `clientId: undefined`. `TraceSession` de-duplicates by `seq`, which defends against
 * re-delivery of *its own* client's buffer but not against a second traced client, whose
 * buffer numbers from 1 independently and therefore takes the buffer-reset branch — replacing
 * a human's recording with the component bench's.
 *
 * `sendInputResult` and `sendNodeLibrary` already stamped it. These four were simply missed,
 * which is why the rows below are about the *set* being consistent rather than about any one
 * command.
 */

/* eslint-env jest */

const EditorConnection = require('../src/editorconnection');

type Sent = { cmd: string; clientId?: string; content?: unknown };

/** A connected connection whose socket records what was written. */
function aConnectedConnection(clientId: string): { connection: any; sent: Sent[] } {
  const sent: Sent[] = [];
  const connection = new EditorConnection({
    platform: { getCurrentTime: () => Date.now(), webSocketClass: function FakeWebSocket() {} }
  });
  connection.clientId = clientId;
  connection.ws = { OPEN: 1 };
  connection.socket = {
    readyState: 1,
    send(data: string) {
      const parsed = JSON.parse(data);
      for (const message of Array.isArray(parsed) ? parsed : [parsed]) sent.push(message);
    }
  };
  return { connection, sent };
}

describe('BEN-003 B15: every reply on the trace/port channel identifies its sender', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  /**
   * `send` batches on a 200ms timer, so the flush has to be driven before anything is on the
   * socket. Driving the real pair rather than stubbing `send` is deliberate: the stamp has to
   * survive batching, and a message that only carries its id on the immediate path would look
   * correct here and be wrong in the only case that matters.
   */
  function flush(connection: { sendTimer?: unknown }) {
    jest.advanceTimersByTime(250);
  }

  test('H1: sendPortValues carries the runtime’s own clientId', () => {
    const { connection, sent } = aConnectedConnection('sandbox-abc');
    connection.sendPortValues([{ node: 'bench-subject', port: 'Count', direction: 'output' }]);
    flush(connection);

    const reply = sent.find((m) => m.cmd === 'portValues');
    expect(reply).toBeDefined();
    expect(reply.clientId).toBe('sandbox-abc');
  });

  test('H2: the trace replies carry it too, so a second traced client is distinguishable', () => {
    const { connection, sent } = aConnectedConnection('sandbox-abc');

    connection.sendTraceEvents([{ seq: 1 }]);
    connection.sendTraceState({ enabled: true, owners: [], highestSeq: 1 });
    connection.sendTraceDictionary({ nodes: {}, edges: [] });
    flush(connection);

    for (const cmd of ['traceEvents', 'traceState', 'traceDictionary']) {
      const reply = sent.find((m) => m.cmd === cmd);
      expect(reply).toBeDefined();
      expect(reply.clientId).toBe('sandbox-abc');
    }
  });

  /**
   * The stamp must not disturb the payload. `traceDictionary` is the one at risk: its whole
   * content *is* the dictionary, so an id folded into `content` rather than onto the message
   * would change a shape `withEditorLabels` reads.
   */
  test('H3: the dictionary payload is untouched — the id rides on the message, not in it', () => {
    const { connection, sent } = aConnectedConnection('sandbox-abc');
    connection.sendTraceDictionary({ nodes: { a: { name: 'A' } }, edges: [] });
    flush(connection);

    const reply = sent.find((m) => m.cmd === 'traceDictionary');
    expect(JSON.parse(reply.content as string)).toEqual({ nodes: { a: { name: 'A' } }, edges: [] });
  });

  test('H4: two clients answering the same broadcast are now told apart', () => {
    const app = aConnectedConnection('9b2c7241-app-preview');
    const bench = aConnectedConnection('sandbox-f49f74cd');

    app.connection.sendTraceEvents([{ seq: 40 }]);
    bench.connection.sendTraceEvents([{ seq: 1 }]);
    flush(app.connection);

    expect(app.sent.find((m) => m.cmd === 'traceEvents').clientId).toBe('9b2c7241-app-preview');
    expect(bench.sent.find((m) => m.cmd === 'traceEvents').clientId).toBe('sandbox-f49f74cd');
  });
});
