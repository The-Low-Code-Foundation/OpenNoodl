/**
 * A typed SSE client for the realtime specs (PLAT-004).
 *
 * The frames are typed as the hub's own `OutFrame` union, not as a shape
 * invented here. That is the whole point: `RealtimeHub` used to declare
 * `data: unknown` over three distinct inline payloads, so `realtime-http.test.ts`
 * — the closest thing BAK-001 has to a contract test for the SSE wire — read
 * every field through `(f.data as any)`. Sharing the producer's union means a
 * rename in the hub breaks the spec at compile time, which is the check those
 * fifteen casts were costing.
 *
 * `waitFor` takes the event name as a separate argument rather than folding it
 * into the predicate, so the return type can be narrowed by `Extract` and the
 * caller gets `ChangeFrameData` with no assertion at all.
 */
import * as http from 'http';

import type { OutFrame } from '../../src/realtime/RealtimeHub';

/** A frame as it arrives on the wire: the hub's payload plus the SSE id. */
export type SseFrame = OutFrame & { id?: number };

export type FrameOf<E extends OutFrame['event']> = Extract<SseFrame, { event: E }>;

export interface SseHandle {
  /** Every frame received so far, in arrival order. */
  frames: SseFrame[];
  /** Resolve on the first frame of `event` satisfying `pred` (past or future). */
  waitFor<E extends OutFrame['event']>(
    event: E,
    pred?: (data: FrameOf<E>['data']) => boolean,
    ms?: number
  ): Promise<FrameOf<E>>;
  /** Every `change` frame received so far. */
  changes(): FrameOf<'change'>[];
  close(): void;
}

interface Waiter {
  match: (f: SseFrame) => boolean;
  resolve: (f: SseFrame) => void;
}

/**
 * Parse one `\n\n`-delimited SSE block. Returns null for a heartbeat comment or
 * a block with no recognisable event, which the caller drops.
 */
function parseBlock(block: string): SseFrame | null {
  let event: string | undefined;
  let data: unknown;
  let id: number | undefined;

  for (const line of block.split('\n')) {
    if (line.startsWith('id: ')) id = Number(line.slice(4));
    else if (line.startsWith('event: ')) event = line.slice(7);
    else if (line.startsWith('data: ')) data = JSON.parse(line.slice(6));
  }

  if (event === undefined) return null;
  // The hub is the only writer on this socket, so the event name determines the
  // payload; the cast names that fact once, here, instead of at every read.
  return { event, data, id } as SseFrame;
}

/** Open `GET /realtime` and parse its frames incrementally. */
export function openStream(base: string): Promise<SseHandle> {
  return new Promise((resolve, reject) => {
    const url = new URL(base + '/realtime');
    const req = http.get(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        headers: { Accept: 'text/event-stream' }
      },
      (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`stream status ${res.statusCode}`));
          return;
        }

        const frames: SseFrame[] = [];
        const waiters: Waiter[] = [];
        let buffer = '';

        res.setEncoding('utf8');
        res.on('data', (chunk: string) => {
          buffer += chunk;
          let sep: number;
          while ((sep = buffer.indexOf('\n\n')) !== -1) {
            const block = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);
            if (block.startsWith(':')) continue; // heartbeat comment

            const frame = parseBlock(block);
            if (!frame) continue;
            frames.push(frame);

            for (let i = waiters.length - 1; i >= 0; i--) {
              if (waiters[i].match(frame)) {
                waiters[i].resolve(frame);
                waiters.splice(i, 1);
              }
            }
          }
        });
        res.on('error', () => {});

        resolve({
          frames,
          waitFor<E extends OutFrame['event']>(
            event: E,
            pred?: (data: FrameOf<E>['data']) => boolean,
            ms = 5000
          ): Promise<FrameOf<E>> {
            // `f.event === event` establishes the branch, but TypeScript cannot
            // narrow a union by a *generic* discriminant, so the payload is
            // re-stated here. This is the one assertion the helper makes, and it
            // is what buys every call site an exact `data` with none.
            const match = (f: SseFrame): boolean =>
              f.event === event &&
              (pred === undefined || pred(f.data as unknown as FrameOf<E>['data']));

            const existing = frames.find(match);
            if (existing) return Promise.resolve(existing as FrameOf<E>);

            return new Promise<FrameOf<E>>((res2, rej2) => {
              const timer = setTimeout(
                () => rej2(new Error(`timed out waiting for an SSE '${event}' frame`)),
                ms
              );
              waiters.push({
                match,
                resolve: (f) => {
                  clearTimeout(timer);
                  res2(f as FrameOf<E>);
                }
              });
            });
          },
          changes(): FrameOf<'change'>[] {
            return frames.filter((f): f is FrameOf<'change'> => f.event === 'change');
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
