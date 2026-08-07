/**
 * BAK-001 realtime over real HTTP — the headless stand-in for the "two browsers
 * on a deployed app" success criterion.
 *
 * A live SSE connection (one "browser") subscribes to a collection; a SEPARATE
 * HTTP client (the other "browser") creates/updates/deletes records; the change
 * events arrive on the stream, filtered server-side, without any polling. Runs
 * against a real BackendService on a real node:sqlite database.
 *
 * The SSE client and the JSON client both live in `tests/helpers` and are typed
 * against the hub's own `OutFrame` union (PLAT-004), so this file asserts on the
 * wire contract rather than on `(f.data as any)`.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import type { SubscriptionResult } from '../src/realtime/RealtimeHub';
import { BackendService } from '../src/service';

import { httpClient, ParseRecord } from './helpers/http';
import { openStream } from './helpers/sse';

jest.setTimeout(20000);

/** The finite JSON description `GET /realtime` returns without an SSE Accept. */
interface RealtimeHint {
  realtime: boolean;
  transport: string;
  hint: string;
}

describe('BAK-001 realtime over HTTP', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;
  const http = httpClient(() => base);

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-rt-'));
    fs.mkdirSync(path.join(dataDir, 'workflows'), { recursive: true });
    service = new BackendService({ dataDir, port: 0, backendId: 'rt_test', backendName: 'Realtime Test' });
    const started = await service.start();
    base = started.listen.url;
  });

  afterAll(async () => {
    await service.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('GET /realtime without the SSE Accept header returns a finite JSON hint (never hangs)', async () => {
    const res = await http.get<RealtimeHint>('/realtime');
    expect(res.status).toBe(200);
    expect(res.json.transport).toBe('sse');
  });

  it('a subscriber receives create/update/delete from a separate client', async () => {
    const stream = await openStream(base);
    const connected = await stream.waitFor('connected');
    const clientId = connected.data.clientId;
    expect(clientId).toBeTruthy();

    const sub = await http.post<SubscriptionResult>('/realtime/subscriptions', {
      clientId,
      subscriptions: [{ collection: 'Live' }]
    });
    expect(sub.status).toBe(200);
    expect(sub.json.accepted).toHaveLength(1);

    // A separate client creates a record.
    const created = await http.post<ParseRecord>('/classes/Live', { title: 'hello', n: 5 });
    expect(created.status).toBe(201);
    const objectId = created.json.objectId;

    const createFrame = await stream.waitFor(
      'change',
      (d) => d.action === 'create' && d.record.objectId === objectId
    );
    expect(createFrame.data.collection).toBe('Live');
    expect(createFrame.data.record.title).toBe('hello');

    // Update it.
    await http.put(`/classes/Live/${objectId}`, { title: 'updated' });
    const updateFrame = await stream.waitFor('change', (d) => d.action === 'update');
    expect(updateFrame.data.record.title).toBe('updated');

    // Delete it — the deleted record rides the event.
    await http.del(`/classes/Live/${objectId}`);
    const deleteFrame = await stream.waitFor('change', (d) => d.action === 'delete');
    expect(deleteFrame.data.record.objectId).toBe(objectId);

    stream.close();
  });

  it('a filtered subscription receives only matching records', async () => {
    const stream = await openStream(base);
    const connected = await stream.waitFor('connected');

    await http.post<SubscriptionResult>('/realtime/subscriptions', {
      clientId: connected.data.clientId,
      subscriptions: [{ collection: 'Filtered', filter: { priority: { $gte: 3 } } }]
    });

    await http.post<ParseRecord>('/classes/Filtered', { title: 'low', priority: 1 }); // excluded
    const hi = await http.post<ParseRecord>('/classes/Filtered', { title: 'high', priority: 5 }); // included

    const frame = await stream.waitFor('change', (d) => d.record.objectId === hi.json.objectId);
    expect(frame.data.record.title).toBe('high');

    // The low-priority create must never have been delivered.
    const lowDelivered = stream.changes().some((f) => f.data.record && f.data.record.title === 'low');
    expect(lowDelivered).toBe(false);

    stream.close();
  });

  it('replacing subscriptions (Pocketbase-style) stops the old collection', async () => {
    const stream = await openStream(base);
    const connected = await stream.waitFor('connected');
    const clientId = connected.data.clientId;

    await http.post<SubscriptionResult>('/realtime/subscriptions', {
      clientId,
      subscriptions: [{ collection: 'A' }]
    });
    // Replace, not add.
    await http.post<SubscriptionResult>('/realtime/subscriptions', {
      clientId,
      subscriptions: [{ collection: 'B' }]
    });

    await http.post<ParseRecord>('/classes/A', { title: 'in A' });
    const b = await http.post<ParseRecord>('/classes/B', { title: 'in B' });

    await stream.waitFor('change', (d) => d.record.objectId === b.json.objectId);
    const aDelivered = stream.changes().some((f) => f.data.collection === 'A');
    expect(aDelivered).toBe(false);

    stream.close();
  });
});
