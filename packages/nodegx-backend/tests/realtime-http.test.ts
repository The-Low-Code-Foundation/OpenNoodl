/**
 * BAK-001 realtime over real HTTP — the headless stand-in for the "two browsers
 * on a deployed app" success criterion.
 *
 * A live SSE connection (one "browser") subscribes to a collection; a SEPARATE
 * HTTP client (the other "browser") creates/updates/deletes records; the change
 * events arrive on the stream, filtered server-side, without any polling. Runs
 * against a real BackendService on a real node:sqlite database.
 */
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';

import { BackendService } from '../src/service';

jest.setTimeout(20000);

interface SseHandle {
  frames: { id?: number; event?: string; data: unknown }[];
  waitFor: (pred: (f: { event?: string; data: unknown }) => boolean, ms?: number) => Promise<{ event?: string; data: unknown }>;
  close: () => void;
}

/** Open GET /realtime and parse its SSE frames incrementally. */
function openStream(base: string): Promise<SseHandle> {
  return new Promise((resolve, reject) => {
    const url = new URL(base + '/realtime');
    const req = http.get(
      { hostname: url.hostname, port: url.port, path: url.pathname, headers: { Accept: 'text/event-stream' } },
      (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`stream status ${res.statusCode}`));
          return;
        }
        const frames: SseHandle['frames'] = [];
        const waiters: { pred: (f: { event?: string; data: unknown }) => boolean; resolve: (f: { event?: string; data: unknown }) => void }[] = [];
        let buffer = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => {
          buffer += chunk;
          let sep: number;
          while ((sep = buffer.indexOf('\n\n')) !== -1) {
            const block = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);
            if (block.startsWith(':')) continue; // heartbeat comment
            const f: { id?: number; event?: string; data: unknown } = { data: undefined };
            for (const line of block.split('\n')) {
              if (line.startsWith('id: ')) f.id = Number(line.slice(4));
              else if (line.startsWith('event: ')) f.event = line.slice(7);
              else if (line.startsWith('data: ')) f.data = JSON.parse(line.slice(6));
            }
            frames.push(f);
            for (let i = waiters.length - 1; i >= 0; i--) {
              if (waiters[i].pred(f)) {
                waiters[i].resolve(f);
                waiters.splice(i, 1);
              }
            }
          }
        });
        res.on('error', () => {});
        resolve({
          frames,
          waitFor(pred, ms = 5000) {
            const existing = frames.find(pred);
            if (existing) return Promise.resolve(existing);
            return new Promise((res2, rej2) => {
              const timer = setTimeout(() => rej2(new Error('timed out waiting for SSE frame')), ms);
              waiters.push({
                pred,
                resolve: (f) => {
                  clearTimeout(timer);
                  res2(f);
                }
              });
            });
          },
          close() {
            req.destroy();
            res.destroy();
          }
        });
      }
    );
    req.on('error', reject);
  });
}

async function post(base: string, pathName: string, body: unknown): Promise<{ status: number; json: any }> {
  const res = await fetch(base + pathName, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

describe('BAK-001 realtime over HTTP', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;

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
    const res = await fetch(base + '/realtime');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.transport).toBe('sse');
  });

  it('a subscriber receives create/update/delete from a separate client', async () => {
    const stream = await openStream(base);
    const connected = await stream.waitFor((f) => f.event === 'connected');
    const clientId = (connected.data as { clientId: string }).clientId;
    expect(clientId).toBeTruthy();

    const sub = await post(base, '/realtime/subscriptions', { clientId, subscriptions: [{ collection: 'Live' }] });
    expect(sub.status).toBe(200);
    expect(sub.json.accepted).toHaveLength(1);

    // A separate client creates a record.
    const created = await post(base, '/classes/Live', { title: 'hello', n: 5 });
    expect(created.status).toBe(201);
    const objectId = created.json.objectId;

    const createFrame = await stream.waitFor(
      (f) => f.event === 'change' && (f.data as any).action === 'create' && (f.data as any).record.objectId === objectId
    );
    expect((createFrame.data as any).collection).toBe('Live');
    expect((createFrame.data as any).record.title).toBe('hello');

    // Update it.
    await fetch(`${base}/classes/Live/${objectId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'updated' })
    });
    const updateFrame = await stream.waitFor((f) => f.event === 'change' && (f.data as any).action === 'update');
    expect((updateFrame.data as any).record.title).toBe('updated');

    // Delete it — the deleted record rides the event.
    await fetch(`${base}/classes/Live/${objectId}`, { method: 'DELETE' });
    const deleteFrame = await stream.waitFor((f) => f.event === 'change' && (f.data as any).action === 'delete');
    expect((deleteFrame.data as any).record.objectId).toBe(objectId);

    stream.close();
  });

  it('a filtered subscription receives only matching records', async () => {
    const stream = await openStream(base);
    const connected = await stream.waitFor((f) => f.event === 'connected');
    const clientId = (connected.data as { clientId: string }).clientId;

    await post(base, '/realtime/subscriptions', {
      clientId,
      subscriptions: [{ collection: 'Filtered', filter: { priority: { $gte: 3 } } }]
    });

    await post(base, '/classes/Filtered', { title: 'low', priority: 1 }); // excluded
    const hi = await post(base, '/classes/Filtered', { title: 'high', priority: 5 }); // included

    const frame = await stream.waitFor((f) => f.event === 'change' && (f.data as any).record.objectId === hi.json.objectId);
    expect((frame.data as any).record.title).toBe('high');

    // The low-priority create must never have been delivered.
    const lowDelivered = stream.frames.some(
      (f) => f.event === 'change' && (f.data as any).record && (f.data as any).record.title === 'low'
    );
    expect(lowDelivered).toBe(false);

    stream.close();
  });

  it('replacing subscriptions (Pocketbase-style) stops the old collection', async () => {
    const stream = await openStream(base);
    const connected = await stream.waitFor((f) => f.event === 'connected');
    const clientId = (connected.data as { clientId: string }).clientId;

    await post(base, '/realtime/subscriptions', { clientId, subscriptions: [{ collection: 'A' }] });
    await post(base, '/realtime/subscriptions', { clientId, subscriptions: [{ collection: 'B' }] }); // replace, not add

    await post(base, '/classes/A', { title: 'in A' });
    const b = await post(base, '/classes/B', { title: 'in B' });

    await stream.waitFor((f) => f.event === 'change' && (f.data as any).record.objectId === b.json.objectId);
    const aDelivered = stream.frames.some((f) => f.event === 'change' && (f.data as any).collection === 'A');
    expect(aDelivered).toBe(false);

    stream.close();
  });
});
