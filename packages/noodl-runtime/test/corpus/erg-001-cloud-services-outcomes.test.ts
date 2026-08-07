/**
 * ERG-001 §4 — the outcome contract on the Cloud Services family, runtime half.
 *
 * See `dev-docs/reference/OUTCOME-CONTRACT.md` for the decision and
 * `ERG-001-S0-MEASUREMENT.md` §0.1 for the ground: eleven live actions in this category, every
 * one of them already carrying `Success`/`Failure`. The viewer-side seven are in
 * `packages/noodl-viewer-react/tests/corpus/erg-001-cloud-services-outcomes.test.ts`; these four
 * live here because they are `noodl-runtime` sources.
 *
 * | Node | Action | Shape |
 * |---|---|---|
 * | `net.noodl.user.SetUserProperties` | `Do` | `success` **renamed** `done` · `failure` · `completed` |
 * | `Sign File URL` | `Sign` | `success` **renamed** `done` · `failure` · `completed` |
 * | `DbModel2` — Record | `Fetch` | `done` **added** · `failure` · `completed`; `fetched`/`changed` untouched |
 * | `net.noodl.user.User` | `Fetch` | `done` **added** · `failure` · `completed`; `fetched`/`changed` untouched |
 *
 * ## ⚠️ Why `Fetched` is not the rename
 *
 * `Fetched` and `Changed` are **value-level announcements**, in exactly the relationship
 * `Items Rendered` has to the Repeater's `Refresh`. On `Record` this is measurable rather than
 * argued: `setModel` fires `fetched` from the **`Id` input setter**, with no invocation anywhere
 * — so folding it into the outcome would report `Done` for a value binding. The rows below pin
 * that path as reporting *nothing*.
 *
 * ⚠️ **On `User` the two do co-fire, and that is recorded rather than hidden.** `User` has no
 * bind path, so `fetched` and `done` always arrive together today. Keeping both is the
 * deliberate choice: `Record` and `User` are documented twins (`dbmodelnode2.ts`'s own docblock,
 * `user.ts`'s `setUserModel`), and splitting the port set so that one says `Fetched` and the
 * other says `Done` for the same author gesture is the per-node divergence `outcome.ts`'s
 * docstring exists to prevent. The co-firing is a property of `User` having one path, not of the
 * two ports meaning the same thing.
 *
 * ## No `Unchanged` anywhere in this family, and each absence is measured
 *
 * - `Sign File URL` mints a fresh link every time; there is no post-condition that can already
 *   hold.
 * - `Set User Properties` writes whatever the inputs hold; the adapter does not diff.
 * - `Record`/`User` `Fetch` always re-reads the backend — that is the whole point of the port,
 *   and `Record`'s description says so ("replacing the copy held in memory").
 *
 * "A node that cannot be a no-op gets no `Unchanged` port", and §5's dead-end check would be
 * right to complain about a port that can never fire.
 *
 * ## ⚠️ One defect fixed, not merely adopted
 *
 * `ParseAuthAdapter.setUserProperties` wraps its whole body in `if (_cu !== undefined)` **with no
 * else**, so `Set User Properties` with nobody signed in called neither `success` nor `error` and
 * the chain died silently — the contract's headline class, and documented in the node's own `Do`
 * description ("does nothing at all while nobody is signed in"). `RestAuthAdapter` already
 * answers `'Nobody is signed in.'` on that path, so the fix is the REST twin's own sentence
 * rather than an invention. Its row is at the bottom of this file.
 *
 * ## What reverting reddens — predicted before running
 *
 * | Revert | Reddens |
 * |---|---|
 * | the `done` rename on `Set User Properties` / `Sign File URL` | every row naming `done` on those two; each has an `expect(...).not.toContain('success')` clause so the rename cannot pass vacuously |
 * | `Record`'s token minted in `setModelID` as well as in the `Fetch` handler | the Id-binding-is-silent row only |
 * | `Sign File URL`'s `cloudStore()` reporting a failure of its own *and* the caller reporting one | the unknown-backend row, on the `outcome/duplicate` raise |
 * | the `else` on `ParseAuthAdapter.setUserProperties` | the nobody-signed-in row only |
 */

/* eslint-env jest */

const metadata: Record<string, unknown> = {};

/**
 * The package index, as these four node files reach for it.
 *
 * `Services.UserService` is what `user.ts` and `setuserproperties.ts` call; `instance` is what
 * `cloudstore.js` reads for `cloudservices`. `Node` is present because `user.ts` captures it at
 * module scope for `_onNodeDeleted` — no row deletes a node, but a mock that omits it would fail
 * at *import* time rather than in the row that needed it.
 */
jest.mock('../../noodl-runtime', () => ({
  instance: { getMetaData: (key: string) => metadata[key] },
  Node: require('../../src/node'),
  Services: {
    UserService: {
      forScope: () => mockUserService
    }
  }
}));

import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from './graph-harness';

import CloudFile = require('../../src/api/cloudfile');
import CloudStore = require('../../src/api/cloudstore');
import DbModelModule = require('../../src/nodes/std-library/data/dbmodelnode2');
import SetUserPropertiesModule = require('../../src/nodes/std-library/user/setuserproperties');
import SignFileUrlModule = require('../../src/nodes/std-library/data/signfileurl');
import UserModule = require('../../src/nodes/std-library/user/user');

import { ParseAuthAdapter } from '../../src/api/backends/ParseAuthAdapter';

// =================================================================================================
// Doubles
// =================================================================================================

interface ServiceCall {
  method: string;
  options: { success(response?: unknown): void; error(error?: string): void } & Record<string, unknown>;
}

/** Recorded rather than auto-answered: several rows settle the callback *after* asserting. */
const mockUserService: Record<string, unknown> & { calls: ServiceCall[] } = {
  calls: [],
  current: undefined,
  currentFor: () => undefined,
  on: () => {
    /* the User node subscribes to four session events; nothing here emits them */
  },
  fetchCurrentUser(options: ServiceCall['options']) {
    mockUserService.calls.push({ method: 'fetchCurrentUser', options });
  },
  setUserProperties(options: ServiceCall['options']) {
    mockUserService.calls.push({ method: 'setUserProperties', options });
  }
};

function lastCall(method: string): ServiceCall {
  const found = mockUserService.calls.filter((c) => c.method === method);
  if (found.length === 0) throw new Error('no ' + method + ' call was made');
  return found[found.length - 1];
}

beforeEach(() => {
  mockUserService.calls = [];
  for (const key of Object.keys(metadata)) delete metadata[key];
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function graphWith(module: unknown, type: string, parameters: Record<string, unknown> = {}): Promise<CorpusGraph> {
  const graph = await createCorpusGraph({
    modules: [module as NodeModule],
    data: {
      components: [{ name: '/root', nodes: [{ id: 'node', type, parameters }], connections: [] }]
    } as never
  });
  await graph.settle(2);
  return graph;
}

/** The signals a node sent, with the value-level announcements a row never asserts on removed. */
function outcomesOf(graph: CorpusGraph, id = 'node'): string[] {
  return graph.signalsFor(id).filter((s) => s === 'done' || s === 'unchanged' || s === 'failure');
}

function pulse(graph: CorpusGraph, port: string, id = 'node'): void {
  const node = graph.node(id);
  node.setInputValue(port, false);
  node.setInputValue(port, true);
}

// =================================================================================================
// Set User Properties — a rename plus a real Completed
// =================================================================================================

describe('ERG-001 §4: Set User Properties', () => {
  test('a successful write reports Done and then Completed, and no longer says "success"', async () => {
    const graph = await graphWith(SetUserPropertiesModule, 'net.noodl.user.SetUserProperties');
    pulse(graph, 'store');
    await graph.settle(2);

    lastCall('setUserProperties').options.success({});
    await graph.settle(2);

    const signals = graph.signalsFor('node');
    expect(outcomesOf(graph)).toEqual(['done']);
    expect(signals).toContain('completed');
    expect(signals.indexOf('completed')).toBeGreaterThan(signals.indexOf('done'));
    // The rename cannot pass vacuously: the old wire name must be gone, not merely unasserted.
    expect(signals).not.toContain('success');
  });

  test('a refused write reports Failure with its code, then Completed', async () => {
    const graph = await graphWith(SetUserPropertiesModule, 'net.noodl.user.SetUserProperties');
    pulse(graph, 'store');
    await graph.settle(2);

    lastCall('setUserProperties').options.error('Username already taken');
    await graph.settle(2);

    expect(outcomesOf(graph)).toEqual(['failure']);
    expect(graph.signalsFor('node')).toContain('completed');
    expect(graph.errors.map((e) => e.code)).toEqual(['user/set-properties-failed']);
    expect(graph.errors[0].message).toBe('Username already taken');
    expect(graph.node('node').getOutput('error').value).toBe('Username already taken');
  });

  test('two Do pulses in one frame coalesce into one write and still report two outcomes', async () => {
    const graph = await graphWith(SetUserPropertiesModule, 'net.noodl.user.SetUserProperties');

    // `storeScheduled` drops the second pulse's *work*, deliberately — that is how "set the
    // fields, then Do" batches. It must not drop the second pulse's *outcome*: two invocations
    // are two invocations. `foreach.tsx`'s `pendingRefreshOutcomes` is the same shape.
    pulse(graph, 'store');
    pulse(graph, 'store');
    await graph.settle(2);

    expect(mockUserService.calls.filter((c) => c.method === 'setUserProperties')).toHaveLength(1);
    lastCall('setUserProperties').options.success({});
    await graph.settle(2);

    expect(outcomesOf(graph)).toEqual(['done', 'done']);
    expect(graph.signalsFor('node').filter((s) => s === 'completed')).toHaveLength(2);
  });

  // ✅ Pinned control. Nobody has pressed Do, so nothing has been invoked.
  test('(pinned control) booting reports no outcome and raises nothing', async () => {
    const graph = await graphWith(SetUserPropertiesModule, 'net.noodl.user.SetUserProperties');
    await graph.settle(4);

    expect(graph.signalsFor('node')).toEqual([]);
    expect(graph.errors).toEqual([]);
  });

  // ✅ Pinned control. This node writes whatever the inputs hold and the adapter does not diff,
  // so there is no post-condition that can already hold. "A node that cannot be a no-op gets no
  // `Unchanged` port" — and §5's dead-end check must not be taught to expect one here.
  test('(pinned control) has no Unchanged port, because the write cannot be a no-op', async () => {
    const graph = await graphWith(SetUserPropertiesModule, 'net.noodl.user.SetUserProperties');
    expect(graph.node('node').hasOutput('unchanged')).toBe(false);
    expect(graph.node('node').hasOutput('completed')).toBe(true);
  });
});

// =================================================================================================
// Sign File URL — a rename, and the double-report the token shape makes visible
// =================================================================================================

describe('ERG-001 §4: Sign File URL', () => {
  function stubStore(impl: Record<string, unknown> | undefined): void {
    jest
      .spyOn(CloudStore as unknown as { forBackend: (...a: unknown[]) => unknown }, 'forBackend')
      .mockReturnValue(impl as never);
  }

  test('a minted link reports Done then Completed, and no longer says "success"', async () => {
    stubStore({
      signFileUrl: (options: { success(r: unknown): void }) =>
        options.success({ url: 'https://example.test/f?sig=1', kind: 'signed', ttlSeconds: 300 })
    });

    const graph = await graphWith(SignFileUrlModule, 'Sign File URL');
    graph.node('node').setInputValue('file', new CloudFile({ name: 'a.png', url: 'https://example.test/a.png' }));
    pulse(graph, 'sign');
    await graph.settle(2);

    const signals = graph.signalsFor('node');
    expect(outcomesOf(graph)).toEqual(['done']);
    expect(signals).toContain('completed');
    expect(signals).not.toContain('success');
    expect(graph.node('node').getOutput('url').value).toBe('https://example.test/f?sig=1');
  });

  test('signing with no file reports Failure once, with its code, then Completed', async () => {
    const graph = await graphWith(SignFileUrlModule, 'Sign File URL');
    pulse(graph, 'sign');
    await graph.settle(2);

    expect(outcomesOf(graph)).toEqual(['failure']);
    expect(graph.signalsFor('node')).toContain('completed');
    expect(graph.errors.map((e) => e.code)).toEqual(['sign-file-url/sign-failed']);
    expect(graph.errors[0].message).toBe('No file specified');
  });

  /**
   * ⚠️ The shape that makes a double-report visible rather than merely unlikely.
   *
   * `cloudStore()` reports the refusal itself and answers `undefined`; the caller then returns.
   * Before the token, both halves called `setError` independently and a second `failure` was a
   * silent extra pulse. `reportOutcome`'s duplicate guard turns that into an
   * `outcome/duplicate` raise, so this row reads the *absence* of one.
   */
  test('an unknown backend reports exactly one Failure — no outcome/duplicate', async () => {
    stubStore(undefined);

    const graph = await graphWith(SignFileUrlModule, 'Sign File URL');
    graph.node('node').setInputValue('file', new CloudFile({ name: 'a.png', url: 'https://example.test/a.png' }));
    pulse(graph, 'sign');
    await graph.settle(2);

    expect(outcomesOf(graph)).toEqual(['failure']);
    expect(graph.errors.map((e) => e.code)).toEqual(['sign-file-url/sign-failed']);
    expect(graph.errors.map((e) => e.code)).not.toContain('outcome/duplicate');
  });

  // ✅ Pinned control. Every Sign mints a fresh link; nothing can already hold.
  test('(pinned control) has no Unchanged port', async () => {
    const graph = await graphWith(SignFileUrlModule, 'Sign File URL');
    expect(graph.node('node').hasOutput('unchanged')).toBe(false);
    expect(graph.node('node').hasOutput('completed')).toBe(true);
  });
});

// =================================================================================================
// Record — `done` added beside `fetched`, and the binding path stays silent
// =================================================================================================

describe('ERG-001 §4: Record', () => {
  test('a successful Fetch reports Done and Completed, and still fires Fetched', async () => {
    jest
      .spyOn(CloudStore as unknown as { forBackend: (...a: unknown[]) => unknown }, 'forBackend')
      .mockReturnValue({
        fetch: (options: { success(r: Record<string, unknown>): void }) => options.success({ objectId: 'r1', title: 'x' }),
        _fromJSON: (json: Record<string, unknown>) => ({
          getId: () => json.objectId,
          data: json,
          on: () => {},
          off: () => {}
        })
      } as never);

    const graph = await graphWith(DbModelModule, 'DbModel2', { collectionName: 'articles' });
    graph.node('node').setInputValue('modelId', 'r1');
    await graph.settle(2);
    pulse(graph, 'fetch');
    await graph.settle(2);

    const signals = graph.signalsFor('node');
    expect(outcomesOf(graph)).toEqual(['done']);
    expect(signals).toContain('completed');
    // The value-level announcement is left alone, exactly as `Items Rendered` was.
    expect(signals).toContain('fetched');
  });

  /**
   * ⚠️ The claim the whole "do not fold `Fetched` in" decision rests on.
   *
   * `setModelID` → `setModel` fires `fetched` from a *value setter*. There is no invocation, so
   * there must be no outcome — and if the token were minted anywhere but the `Fetch` handler,
   * this row would see one.
   */
  test('binding Id reports no outcome at all, though it does announce Fetched', async () => {
    const graph = await graphWith(DbModelModule, 'DbModel2', { collectionName: 'articles' });
    graph.node('node').setInputValue('modelId', 'r1');
    await graph.settle(2);

    expect(graph.signalsFor('node')).toContain('fetched');
    expect(outcomesOf(graph)).toEqual([]);
    expect(graph.signalsFor('node')).not.toContain('completed');
  });

  test('a Fetch with no Id reports Failure with the family code, then Completed', async () => {
    const graph = await graphWith(DbModelModule, 'DbModel2', { collectionName: 'articles' });
    pulse(graph, 'fetch');
    await graph.settle(2);

    expect(outcomesOf(graph)).toEqual(['failure']);
    expect(graph.signalsFor('node')).toContain('completed');
    expect(graph.errors.map((e) => e.code)).toEqual(['record/storage-op-failed']);
    expect(graph.errors[0].message).toBe('Missing Id.');
  });

  // ✅ Pinned control. `Fetch` always re-reads the backend — "replacing the copy held in
  // memory" is the port's own description — so it cannot no-op.
  test('(pinned control) has no Unchanged port', async () => {
    const graph = await graphWith(DbModelModule, 'DbModel2');
    expect(graph.node('node').hasOutput('unchanged')).toBe(false);
    expect(graph.node('node').hasOutput('completed')).toBe(true);
  });
});

// =================================================================================================
// User — the twin, with the co-firing recorded rather than designed away
// =================================================================================================

describe('ERG-001 §4: User', () => {
  test('a successful Fetch reports Done and Completed beside the existing Fetched', async () => {
    const graph = await graphWith(UserModule, 'net.noodl.user.User');
    pulse(graph, 'fetch');
    await graph.settle(2);

    lastCall('fetchCurrentUser').options.success({});
    await graph.settle(2);

    const signals = graph.signalsFor('node');
    expect(outcomesOf(graph)).toEqual(['done']);
    expect(signals).toContain('completed');
    // ⚠️ Recorded, not hidden: on this node the two co-fire, because `User` has no bind path.
    // `Record`'s rows above are where the two come apart, and why both ports exist.
    expect(signals).toContain('fetched');
    expect(signals.indexOf('done')).toBeGreaterThan(signals.indexOf('fetched'));
  });

  test('a failed Fetch reports Failure with its code, then Completed', async () => {
    const graph = await graphWith(UserModule, 'net.noodl.user.User');
    pulse(graph, 'fetch');
    await graph.settle(2);

    lastCall('fetchCurrentUser').options.error('Invalid session token');
    await graph.settle(2);

    expect(outcomesOf(graph)).toEqual(['failure']);
    expect(graph.signalsFor('node')).toContain('completed');
    expect(graph.errors.map((e) => e.code)).toEqual(['user/fetch-failed']);
    expect(graph.signalsFor('node')).not.toContain('fetched');
  });

  // ✅ Pinned control. The four session events (`loggedIn`, `loggedOut`, `sessionGained`,
  // `sessionLost`) run `setUserModel` with no invocation behind them. None may report.
  test('(pinned control) booting and binding report no outcome', async () => {
    const graph = await graphWith(UserModule, 'net.noodl.user.User');
    await graph.settle(4);

    expect(outcomesOf(graph)).toEqual([]);
    expect(graph.signalsFor('node')).not.toContain('completed');
  });

  test('(pinned control) has no Unchanged port', async () => {
    const graph = await graphWith(UserModule, 'net.noodl.user.User');
    expect(graph.node('node').hasOutput('unchanged')).toBe(false);
    expect(graph.node('node').hasOutput('completed')).toBe(true);
  });
});

// =================================================================================================
// The adapter defect — a dead chain, measured
// =================================================================================================

describe('ERG-001 §4: ParseAuthAdapter.setUserProperties with nobody signed in', () => {
  /**
   * The whole body sat inside `if (_cu !== undefined)` with no `else`, so **neither** callback
   * ran. The node above cannot report an outcome for a call that never answers, which is the
   * contract's headline class — "a node that emits nothing is a dead chain with no diagnostic" —
   * and the node's own `Do` description had documented it as behaviour.
   *
   * The sentence is `RestAuthAdapter`'s, verbatim, because the REST twin already had this right
   * and two wordings for one condition is what the Failure Contract calls noise.
   */
  test('answers on the error callback rather than silently returning', () => {
    const adapter = new ParseAuthAdapter({ serializeObject: (data) => data });
    jest.spyOn(adapter, 'getCurrentUser').mockReturnValue(undefined as never);

    const seen: string[] = [];
    adapter.setUserProperties({ id: '_active_', type: 'nodegx', name: 'x', url: 'http://t' } as never, {
      properties: { nickname: 'a' },
      success: () => seen.push('success'),
      error: (e?: string) => seen.push('error:' + e)
    });

    expect(seen).toEqual(['error:Nobody is signed in.']);
  });
});

// =================================================================================================
// The family-wide shape
// =================================================================================================

describe('ERG-001 §4: the runtime half of the family, as a set', () => {
  const FAMILY: Array<{ label: string; module: unknown; type: string; renamed: boolean }> = [
    { label: 'Set User Properties', module: SetUserPropertiesModule, type: 'net.noodl.user.SetUserProperties', renamed: true },
    { label: 'Sign File URL', module: SignFileUrlModule, type: 'Sign File URL', renamed: true },
    { label: 'Record', module: DbModelModule, type: 'DbModel2', renamed: false },
    { label: 'User', module: UserModule, type: 'net.noodl.user.User', renamed: false }
  ];

  test.each(FAMILY)('$label declares done, failure and completed', async ({ module, type, renamed }) => {
    const graph = await graphWith(module, type);
    const node = graph.node<NodeInstance>('node');

    expect(node.hasOutput('done')).toBe(true);
    expect(node.hasOutput('failure')).toBe(true);
    // "Completed is universal, and it is the one port with no exemption."
    expect(node.hasOutput('completed')).toBe(true);
    if (renamed) expect(node.hasOutput('success')).toBe(false);
  });
});
