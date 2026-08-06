/**
 * CWF-016 slice 2 — the claim store, and the race it exists for.
 *
 * ## Written before the store, on purpose
 *
 * The task's own slice order says the concurrent case is "the one that will be
 * wrong", so this file was authored first and the implementation was made to
 * satisfy it. The naive shape — `if (!seen(key)) run()` — passes every
 * sequential test ever written and fails the only one that matters, because two
 * deliveries in flight at once both check, both miss, and both run.
 *
 * ## What makes the concurrency here REAL rather than theatrical
 *
 * `node:sqlite` is synchronous, so two `claim()` calls inside one process cannot
 * interleave *inside* the call. That is exactly why a test of two awaited calls
 * in one connection proves nothing: it would pass against a plain JS `Set`.
 *
 * So the race is staged the two ways it actually occurs in production:
 *
 *  1. **Two connections to the same database file** (`racingHandles`) — the
 *     cross-process case, which is what a restarted-alongside or
 *     accidentally-doubled backend is. Nothing in JavaScript is coordinating
 *     these; the row's PRIMARY KEY is the only thing that can, and if the store
 *     ever grew a check-then-insert this test fails.
 *  2. **A claim held across an await** (`concurrentGraphRuns`) — the in-process
 *     case, and the one the endpoint actually hits: the winner claims, then
 *     awaits a graph for hundreds of milliseconds, and every duplicate that
 *     arrives during that window must see the claim rather than an empty table.
 *
 * The HTTP half of the same promise — same key twice over the wire, once
 * concurrently, once across a restart — is `cwf-016-idempotency.test.ts`.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { IdempotencyStore, SqlDatabase } from '../src/execution/IdempotencyStore';

jest.setTimeout(20000);

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { DatabaseSync } = require('node:sqlite');

function openStore(dbPath: string, options: { ttlMs?: number; staleClaimMs?: number } = {}): IdempotencyStore {
  const db = new DatabaseSync(dbPath) as SqlDatabase;
  const store = new IdempotencyStore();
  store.open(db, {
    getTtlMs: () => (options.ttlMs === undefined ? 24 * 3_600_000 : options.ttlMs),
    staleClaimMs: options.staleClaimMs
  });
  return store;
}

describe('CWF-016 idempotency store', () => {
  let dir: string;
  let dbPath: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-idem-'));
    dbPath = path.join(dir, 'executions.sqlite');
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  // ==========================================================================
  // The race — written first
  // ==========================================================================

  it('racingHandles: two connections to the same file, one winner, and the loser is told who holds it', () => {
    const a = openStore(dbPath);
    const b = openStore(dbPath);

    const first = a.claim('charge', 'evt_1');
    const second = b.claim('charge', 'evt_1');

    expect(first.outcome).toBe('claimed');
    expect(second.outcome).toBe('inflight');
    if (first.outcome !== 'claimed' || second.outcome !== 'inflight') throw new Error('unreachable');

    // The loser is handed the WINNER's claim id, not its own — that is what
    // makes "wait for that run" expressible at all.
    expect(second.claimId).toBe(first.claimId);

    a.close();
    b.close();
  });

  it('racingHandles: ten interleaved claimants across two connections produce exactly one winner', () => {
    const handles = [openStore(dbPath), openStore(dbPath)];
    const outcomes: string[] = [];

    for (let i = 0; i < 10; i++) {
      outcomes.push(handles[i % 2].claim('charge', 'evt_burst').outcome);
    }

    expect(outcomes.filter((o) => o === 'claimed')).toHaveLength(1);
    expect(outcomes.filter((o) => o === 'inflight')).toHaveLength(9);
    handles.forEach((h) => h.close());
  });

  it('concurrentGraphRuns: a claim held across an await is seen by everything that arrives during it', async () => {
    const store = openStore(dbPath);
    let graphRuns = 0;

    // The endpoint's exact shape, minus HTTP: claim, run, complete.
    async function deliver(key: string): Promise<string> {
      for (let attempt = 0; attempt < 200; attempt++) {
        const claim = store.claim('charge', key);
        if (claim.outcome === 'replay') return claim.body;
        if (claim.outcome === 'claimed') {
          graphRuns += 1;
          const body = await new Promise<string>((resolve) => setTimeout(() => resolve(`run-${graphRuns}`), 60));
          store.complete('charge', key, claim.claimId, 200, body);
          return body;
        }
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      throw new Error('never settled');
    }

    // Five deliveries genuinely in flight together — no await between them.
    const bodies = await Promise.all([
      deliver('evt_2'),
      deliver('evt_2'),
      deliver('evt_2'),
      deliver('evt_2'),
      deliver('evt_2')
    ]);

    expect(graphRuns).toBe(1);
    expect(new Set(bodies).size).toBe(1);
    expect(bodies[0]).toBe('run-1');
    store.close();
  });

  // ==========================================================================
  // Replay, scope and identity
  // ==========================================================================

  it('replays the stored answer, byte for byte, once the winner completes', () => {
    const store = openStore(dbPath);
    const claim = store.claim('charge', 'evt_3');
    if (claim.outcome !== 'claimed') throw new Error('expected to claim');

    expect(store.complete('charge', 'evt_3', claim.claimId, 201, '{"orderId":"A-7"}')).toBe(true);

    const again = store.claim('charge', 'evt_3');
    expect(again.outcome).toBe('replay');
    if (again.outcome !== 'replay') throw new Error('unreachable');
    expect(again.statusCode).toBe(201);
    expect(again.body).toBe('{"orderId":"A-7"}');
    store.close();
  });

  it('scopes keys per function: the same key on two functions is two claims', () => {
    const store = openStore(dbPath);
    expect(store.claim('charge', 'evt_4').outcome).toBe('claimed');
    expect(store.claim('refund', 'evt_4').outcome).toBe('claimed');
    store.close();
  });

  it('a different key runs again', () => {
    const store = openStore(dbPath);
    const first = store.claim('charge', 'evt_5');
    if (first.outcome !== 'claimed') throw new Error('expected to claim');
    store.complete('charge', 'evt_5', first.claimId, 200, '{"n":1}');

    expect(store.claim('charge', 'evt_6').outcome).toBe('claimed');
    store.close();
  });

  it('a stale claim id cannot complete or release a claim it does not hold', () => {
    const store = openStore(dbPath);
    const claim = store.claim('charge', 'evt_7');
    if (claim.outcome !== 'claimed') throw new Error('expected to claim');

    expect(store.complete('charge', 'evt_7', 'someone-elses-claim', 200, '{}')).toBe(false);
    expect(store.release('charge', 'evt_7', 'someone-elses-claim')).toBe(false);
    expect(store.claim('charge', 'evt_7').outcome).toBe('inflight');
    store.close();
  });

  // ==========================================================================
  // A failed run releases the key — the trap the task names
  // ==========================================================================

  it('release makes the next delivery the new claimant — a failure is not cached', () => {
    const store = openStore(dbPath);
    const first = store.claim('charge', 'evt_8');
    if (first.outcome !== 'claimed') throw new Error('expected to claim');

    expect(store.release('charge', 'evt_8', first.claimId)).toBe(true);

    const second = store.claim('charge', 'evt_8');
    expect(second.outcome).toBe('claimed');
    store.close();
  });

  it('releaseInFlight clears claims a dead process left behind, and leaves completed ones alone', () => {
    const store = openStore(dbPath);
    const done = store.claim('charge', 'evt_done');
    if (done.outcome !== 'claimed') throw new Error('expected to claim');
    store.complete('charge', 'evt_done', done.claimId, 200, '{"ok":true}');
    store.claim('charge', 'evt_crashed');
    store.close();

    // The next process start.
    const restarted = openStore(dbPath);
    expect(restarted.releaseInFlight()).toBe(1);
    expect(restarted.claim('charge', 'evt_crashed').outcome).toBe('claimed');
    expect(restarted.claim('charge', 'evt_done').outcome).toBe('replay');
    restarted.close();
  });

  it('a claim older than the stale window is taken over rather than waited on forever', () => {
    const store = openStore(dbPath, { staleClaimMs: 40 });
    const first = store.claim('charge', 'evt_9');
    if (first.outcome !== 'claimed') throw new Error('expected to claim');
    expect(store.claim('charge', 'evt_9').outcome).toBe('inflight');

    const then = Date.now() + 60;
    while (Date.now() < then) {
      /* the stale window, spent */
    }

    const takeover = store.claim('charge', 'evt_9');
    expect(takeover.outcome).toBe('claimed');
    if (takeover.outcome !== 'claimed') throw new Error('unreachable');
    // The original holder can no longer complete: it lost the claim.
    expect(store.complete('charge', 'evt_9', first.claimId, 200, '{}')).toBe(false);
    expect(store.complete('charge', 'evt_9', takeover.claimId, 200, '{}')).toBe(true);
    store.close();
  });

  // ==========================================================================
  // Durability and TTL
  // ==========================================================================

  it('survives a reopen of the database — the whole reason this is not a Map', () => {
    const store = openStore(dbPath);
    const claim = store.claim('charge', 'evt_10');
    if (claim.outcome !== 'claimed') throw new Error('expected to claim');
    store.complete('charge', 'evt_10', claim.claimId, 200, '{"paid":true}');
    store.close();

    const reopened = openStore(dbPath);
    const replay = reopened.claim('charge', 'evt_10');
    expect(replay.outcome).toBe('replay');
    if (replay.outcome !== 'replay') throw new Error('unreachable');
    expect(replay.body).toBe('{"paid":true}');
    reopened.close();
  });

  it('sweep drops completed rows past the TTL and abandoned claims past the stale window', () => {
    const store = openStore(dbPath, { ttlMs: 1000, staleClaimMs: 1000 });
    const a = store.claim('charge', 'evt_old');
    if (a.outcome !== 'claimed') throw new Error('expected to claim');
    store.complete('charge', 'evt_old', a.claimId, 200, '{}');
    store.claim('charge', 'evt_abandoned');

    const b = store.claim('charge', 'evt_fresh');
    if (b.outcome !== 'claimed') throw new Error('expected to claim');
    store.complete('charge', 'evt_fresh', b.claimId, 200, '{}');

    // Sweep with a clock far enough ahead that both the TTL and the stale
    // window have passed for the first two rows only.
    expect(store.sweep(Date.now() + 2000)).toBe(3);
    expect(store.count()).toBe(0);

    // And with a clock that has not moved, nothing goes.
    const c = store.claim('charge', 'evt_now');
    if (c.outcome !== 'claimed') throw new Error('expected to claim');
    store.complete('charge', 'evt_now', c.claimId, 200, '{}');
    expect(store.sweep(Date.now())).toBe(0);
    expect(store.count()).toBe(1);
    store.close();
  });

  it('an expired row is not replayed even before the hourly sweep reaches it', () => {
    // The sweep is write-driven and hourly (it rides ExecutionHistory.prune, so
    // there is no fourth timer). A 24h TTL that is 25h in practice is a TTL
    // nobody can reason about, so the read enforces it too.
    const store = openStore(dbPath, { ttlMs: 30 });
    const claim = store.claim('charge', 'evt_11');
    if (claim.outcome !== 'claimed') throw new Error('expected to claim');
    store.complete('charge', 'evt_11', claim.claimId, 200, '{"stale":true}');

    const then = Date.now() + 50;
    while (Date.now() < then) {
      /* past the TTL */
    }

    expect(store.claim('charge', 'evt_11').outcome).toBe('claimed');
    store.close();
  });

  it('ttl 0 means keep until swept by nothing — an operator opt-out, not an accident', () => {
    const store = openStore(dbPath, { ttlMs: 0 });
    const claim = store.claim('charge', 'evt_12');
    if (claim.outcome !== 'claimed') throw new Error('expected to claim');
    store.complete('charge', 'evt_12', claim.claimId, 200, '{}');

    expect(store.sweep(Date.now() + 10 * 365 * 86_400_000)).toBe(0);
    expect(store.claim('charge', 'evt_12').outcome).toBe('replay');
    store.close();
  });

  // ==========================================================================
  // Disabled is a state, not a crash
  // ==========================================================================

  it('a store that was never opened refuses every operation quietly rather than throwing', () => {
    const store = new IdempotencyStore();
    expect(store.enabled).toBe(false);
    expect(store.claim('charge', 'evt_13').outcome).toBe('disabled');
    expect(store.complete('charge', 'evt_13', 'x', 200, '{}')).toBe(false);
    expect(store.release('charge', 'evt_13', 'x')).toBe(false);
    expect(store.sweep()).toBe(0);
    expect(store.releaseInFlight()).toBe(0);
    expect(store.count()).toBe(0);
  });
});
