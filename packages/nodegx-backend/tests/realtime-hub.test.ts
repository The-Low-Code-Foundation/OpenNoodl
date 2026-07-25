/**
 * BAK-001 RealtimeHub — SSE delivery, subscription gating, reconnect/resync, and
 * the bounded slow-client queue.
 *
 * The hub is driven through a real {@link ChangeBus} wrapped around a fake
 * adapter emitter (so the normalization path is real) and writes to a fake
 * SSEResponse that records frames and can simulate backpressure. This keeps the
 * tests deterministic while exercising the exact production code paths.
 */
import { ChangeBus } from '../src/realtime/ChangeBus';
import { RealtimeHub, SSEResponse, HubSecurity } from '../src/realtime/RealtimeHub';
import { Principal } from '../src/security/model';

// --- Fake adapter: an on/off/emit surface ChangeBus can tap. ----------------
function makeFakeAdapter() {
  const listeners: Record<string, ((p: unknown) => void)[]> = {};
  return {
    on(ev: string, h: (p: unknown) => void) {
      (listeners[ev] ||= []).push(h);
    },
    off(ev: string, h: (p: unknown) => void) {
      listeners[ev] = (listeners[ev] || []).filter((x) => x !== h);
    },
    emitRaw(ev: string, payload: unknown) {
      (listeners[ev] || []).forEach((h) => h(payload));
    }
  };
}

// --- Fake SSE response with controllable backpressure. ----------------------
interface Frame {
  id?: number;
  event?: string;
  data?: unknown;
  comment?: boolean;
}
function makeRes() {
  let onDrain: (() => void) | null = null;
  let onClose: (() => void) | null = null;
  let accept = true;
  const raw: string[] = [];
  const res: SSEResponse & {
    frames: () => Frame[];
    setAccept: (v: boolean) => void;
    triggerDrain: () => void;
    triggerClose: () => void;
    status?: number;
  } = {
    status: undefined,
    writeHead(status) {
      res.status = status;
    },
    write(chunk: string) {
      raw.push(chunk);
      return accept;
    },
    end() {
      /* noop */
    },
    on(ev, cb) {
      if (ev === 'drain') onDrain = cb;
      else if (ev === 'close') onClose = cb;
    },
    setAccept(v: boolean) {
      accept = v;
    },
    triggerDrain() {
      if (onDrain) onDrain();
    },
    triggerClose() {
      if (onClose) onClose();
    },
    frames() {
      return raw
        .filter((c) => c.trim().length > 0)
        .map((chunk) => {
          if (chunk.startsWith(':')) return { comment: true };
          const f: Frame = {};
          for (const line of chunk.split('\n')) {
            if (line.startsWith('id: ')) f.id = Number(line.slice(4));
            else if (line.startsWith('event: ')) f.event = line.slice(7);
            else if (line.startsWith('data: ')) f.data = JSON.parse(line.slice(6));
          }
          return f;
        });
    }
  };
  return res;
}

const openSecurity: HubSecurity = { devOpenActive: true, checkClp: () => ({ allowed: true, reason: 'dev-open' }) };
const anon: Principal = { kind: 'anonymous' };

function change(collection: string, action: string, record: Record<string, unknown>) {
  return { type: action === 'update' ? 'save' : action, collection, id: record.objectId, object: record };
}

describe('RealtimeHub', () => {
  it('hands the client a clientId in the first frame', () => {
    const adapter = makeFakeAdapter();
    const hub = new RealtimeHub(new ChangeBus(adapter), openSecurity, { heartbeatMs: 0 });
    const res = makeRes();
    const clientId = hub.addConnection(res, anon);
    const first = res.frames()[0];
    expect(res.status).toBe(200);
    expect(first.event).toBe('connected');
    expect((first.data as { clientId: string }).clientId).toBe(clientId);
    hub.close();
  });

  it('delivers only matching, subscribed changes; ids are monotonic', () => {
    const adapter = makeFakeAdapter();
    const hub = new RealtimeHub(new ChangeBus(adapter), openSecurity, { heartbeatMs: 0 });
    const res = makeRes();
    const clientId = hub.addConnection(res, anon);
    hub.setSubscriptions(clientId, [{ collection: 'Doc', filter: { n: { $gte: 5 } } }]);

    adapter.emitRaw('create', change('Doc', 'create', { objectId: '1', n: 9, ACL: null }));
    adapter.emitRaw('create', change('Doc', 'create', { objectId: '2', n: 1, ACL: null })); // filtered out
    adapter.emitRaw('save', change('Other', 'update', { objectId: '3', n: 9, ACL: null })); // wrong collection
    adapter.emitRaw('delete', change('Doc', 'delete', { objectId: '1', n: 7, ACL: null }));

    const changes = res.frames().filter((f) => f.event === 'change');
    expect(changes.map((f) => (f.data as { record: { objectId: string } }).record.objectId)).toEqual(['1', '1']);
    expect(changes.map((f) => (f.data as { action: string }).action)).toEqual(['create', 'delete']);

    const ids = res.frames().filter((f) => f.id !== undefined).map((f) => f.id as number);
    for (let i = 1; i < ids.length; i++) expect(ids[i]).toBeGreaterThan(ids[i - 1]);
    hub.close();
  });

  it('reconnect (Last-Event-ID present) yields an immediate resync', () => {
    const adapter = makeFakeAdapter();
    const hub = new RealtimeHub(new ChangeBus(adapter), openSecurity, { heartbeatMs: 0 });
    const res = makeRes();
    hub.addConnection(res, anon, '42');
    const events = res.frames().map((f) => f.event);
    expect(events[0]).toBe('connected');
    expect(events).toContain('resync');
    expect((res.frames().find((f) => f.event === 'resync')!.data as { reason: string }).reason).toBe('reconnect');
    hub.close();
  });

  it('a slow client that overflows the bounded queue gets one resync, not unbounded buffering', () => {
    const adapter = makeFakeAdapter();
    const hub = new RealtimeHub(new ChangeBus(adapter), openSecurity, { heartbeatMs: 0, maxQueue: 3 });
    const res = makeRes();
    const clientId = hub.addConnection(res, anon); // 'connected' written while accepting
    hub.setSubscriptions(clientId, [{ collection: 'Doc' }]);

    res.setAccept(false); // socket buffer full — client stopped reading
    for (let i = 0; i < 20; i++) {
      adapter.emitRaw('create', change('Doc', 'create', { objectId: `r${i}`, n: i, ACL: null }));
    }
    // At most maxQueue+1 frames ever leave (connected + one that hit backpressure);
    // the rest are collapsed into the queue, capped at the bound.
    res.setAccept(true);
    res.triggerDrain();

    const frames = res.frames();
    const lastFrame = frames[frames.length - 1];
    expect(lastFrame.event).toBe('resync');
    expect((lastFrame.data as { reason: string }).reason).toBe('overflow');
    // Far fewer than 20 change frames were delivered — bounded, not unbounded.
    const delivered = frames.filter((f) => f.event === 'change').length;
    expect(delivered).toBeLessThan(20);
    hub.close();
  });

  it('gates subscription CREATION on the find CLP when enforcement is on', () => {
    const adapter = makeFakeAdapter();
    const lockedSecurity: HubSecurity = {
      devOpenActive: false,
      checkClp: (_p, collection) =>
        collection === 'Allowed'
          ? { allowed: true, reason: 'ok' }
          : { allowed: false, reason: 'denied by find CLP' }
    };
    const hub = new RealtimeHub(new ChangeBus(adapter), lockedSecurity, { heartbeatMs: 0 });
    const res = makeRes();
    const clientId = hub.addConnection(res, { kind: 'user', userId: 'u1', roles: [] });

    const result = hub.setSubscriptions(clientId, [{ collection: 'Allowed' }, { collection: 'Secret' }]);
    expect(result!.accepted.map((s) => s.collection)).toEqual(['Allowed']);
    expect(result!.rejected.map((r) => r.collection)).toEqual(['Secret']);

    // And an event on the rejected collection is never delivered.
    adapter.emitRaw('create', change('Secret', 'create', { objectId: 's1', ACL: null }));
    expect(res.frames().filter((f) => f.event === 'change').length).toBe(0);
    hub.close();
  });

  it('enforces row-level ACL at delivery when enforcement is on', () => {
    const adapter = makeFakeAdapter();
    const lockedSecurity: HubSecurity = { devOpenActive: false, checkClp: () => ({ allowed: true, reason: 'ok' }) };
    const hub = new RealtimeHub(new ChangeBus(adapter), lockedSecurity, { heartbeatMs: 0 });
    const res = makeRes();
    const clientId = hub.addConnection(res, { kind: 'user', userId: 'u1', roles: [] });
    hub.setSubscriptions(clientId, [{ collection: 'Doc' }]);

    // Readable by u1, and one readable only by u2.
    adapter.emitRaw('create', change('Doc', 'create', { objectId: 'mine', ACL: { u1: { read: true } } }));
    adapter.emitRaw('create', change('Doc', 'create', { objectId: 'theirs', ACL: { u2: { read: true } } }));

    const ids = res
      .frames()
      .filter((f) => f.event === 'change')
      .map((f) => (f.data as { record: { objectId: string } }).record.objectId);
    expect(ids).toEqual(['mine']);
    hub.close();
  });

  it('setSubscriptions on an unknown clientId returns null (→ 404)', () => {
    const adapter = makeFakeAdapter();
    const hub = new RealtimeHub(new ChangeBus(adapter), openSecurity, { heartbeatMs: 0 });
    expect(hub.setSubscriptions('nope', [{ collection: 'Doc' }])).toBeNull();
    hub.close();
  });

  it('a closed connection stops receiving and is dropped', () => {
    const adapter = makeFakeAdapter();
    const hub = new RealtimeHub(new ChangeBus(adapter), openSecurity, { heartbeatMs: 0 });
    const res = makeRes();
    const clientId = hub.addConnection(res, anon);
    hub.setSubscriptions(clientId, [{ collection: 'Doc' }]);
    expect(hub.connectionCount).toBe(1);

    res.triggerClose();
    expect(hub.connectionCount).toBe(0);

    const before = res.frames().length;
    adapter.emitRaw('create', change('Doc', 'create', { objectId: 'x', ACL: null }));
    expect(res.frames().length).toBe(before); // nothing new
    hub.close();
  });
});
