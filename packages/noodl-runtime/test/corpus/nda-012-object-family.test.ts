/**
 * NDA-012 (Data) — the Object family and HTTP Request.
 *
 * Four nodes: `Object` (`Model2`), `Create New Object`, `Set Object Properties` and
 * `HTTP Request`. Three defects, all measured by driving a real graph — or, for the HTTP
 * rows, a real graph against a real `node:http` server — rather than read off the source:
 *
 * - **C1** the Object node dropped every `prop-…` value that arrived in a frame *earlier*
 *   than its Id, while its own comment said those values were written the moment an object
 *   arrived.
 * - **C2/C3** an empty Id (`null` or `''`) is not a missing Id: `Model.get` mints on read and
 *   `Model.get('')` is a **named** record, so `Set Object Properties` wrote into a
 *   process-wide shared record and reported `Done`, and the Object node minted a fresh
 *   throwaway per `null` and announced `Fetched` for it.
 * - **C4** a request that exceeded `Timeout (ms)` fired `Canceled` — the port an author only
 *   wires for their *own* aborts — with `Error` left `undefined`.
 *
 * ⚠️ Two facts about this runtime that these rows depend on, and that are easy to lose:
 *
 * 1. **`undefined` never crosses a connection.** `Node.prototype.sendValue` returns early on
 *    `undefined` (`node.ts:635`), so the `Model.get(undefined)` variant of the create-on-read
 *    shape — the one NDA-004 §2 fixed in `Set Parent Component Object Properties`, where the
 *    id came from an internal walk rather than a wire — is unreachable here. The reachable
 *    empty values are `null` and `''`, and only a corpus row that sends *those* can see it.
 * 2. **A value output cannot be cleared.** Same line: flagging an output whose value is
 *    `undefined` sends nothing, so the downstream input keeps what it last received. That is
 *    why C4 repairs the *signal and the message* and not the stale `Status Code` — see the
 *    row at the end, which pins the staleness as known rather than fixed.
 */

/* eslint-env jest */

import type { NodeInstance, NodeModule } from '@noodl/types';
import * as http from 'http';

import { createCorpusGraph, type CorpusGraph } from './graph-harness';

import ModelImport = require('../../src/model');
import ModelNode = require('../../src/nodes/std-library/data/modelnode2');
import NewModelNode = require('../../src/nodes/std-library/data/newmodelnode');
import SetModelProperties = require('../../src/nodes/std-library/data/setmodelpropertiesnode');
import HttpNode = require('../../src/nodes/std-library/data/httpnode');

const Model = ModelImport;

/**
 * The two `_internal` surfaces these rows reach into, named once rather than cast at each
 * site. Same rule as `WatcherInstance` below and as `agent/node-instances.d.ts`, whose
 * docstring names `(node as any)` as the thing being replaced: a cast per call site is
 * three descriptions of one object with nothing checking them against each other.
 */
interface ObjectNodeInstance extends NodeInstance {
  _internal: { model?: InstanceType<typeof ModelImport> };
}

interface HttpNodeInstance extends NodeInstance {
  _internal: { url: string };
}

interface TriggerInstance extends NodeInstance {
  go(): void;
  stop(): void;
  send(port: string, value: unknown): void;
}

/**
 * One node that can pulse two signals and push two values.
 *
 * Values go over a *connection* on purpose: a parameter is applied at load and would never
 * exercise the "an empty value arrived later" path these rows are about.
 */
const TriggerModule: NodeModule = {
  node: {
    name: 'corpus.Trigger',
    category: 'Corpus',
    outputs: {
      go: { type: 'signal' },
      stop: { type: 'signal' },
      a: {
        type: '*',
        getter: function (this: NodeInstance) {
          return this._internal.a;
        }
      },
      b: {
        type: '*',
        getter: function (this: NodeInstance) {
          return this._internal.b;
        }
      }
    },
    methods: {
      go(this: NodeInstance) {
        this.sendSignalOnOutput('go');
      },
      stop(this: NodeInstance) {
        this.sendSignalOnOutput('stop');
      },
      send(this: NodeInstance, port: string, value: unknown) {
        this._internal[port] = value;
        this.flagOutputDirty(port);
      }
    }
  }
};

type Wire = { sourcePort: string; targetPort: string };

async function graphWith(type: string, parameters: Record<string, unknown>, wires: Wire[]): Promise<CorpusGraph> {
  const graph = await createCorpusGraph({
    modules: [
      TriggerModule,
      ModelNode as unknown as NodeModule,
      NewModelNode as unknown as NodeModule,
      SetModelProperties as unknown as NodeModule,
      HttpNode as unknown as NodeModule
    ],
    rootComponent: '/root',
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            { id: 'trigger', type: 'corpus.Trigger' },
            { id: 'target', type, parameters }
          ],
          connections: wires.map((w) => ({
            sourceId: 'trigger',
            sourcePort: w.sourcePort,
            targetId: 'target',
            targetPort: w.targetPort
          }))
        }
      ]
    } as never
  });
  await graph.settle(3);
  return graph;
}

const ID_AND_VALUE: Wire[] = [
  { sourcePort: 'a', targetPort: 'modelId' },
  { sourcePort: 'b', targetPort: 'prop-name' }
];

describe('C1 — the Object node writes what arrived before its Id', () => {
  /**
   * The defect, and it is data loss on an ordinary graph: a `prop-…` value landing on one
   * frame and the Id on the next. `scheduleStore` keeps such values in `dirtyValues` (NDA-004
   * §2 deliberately left them there so a retry works), and nothing ever wrote them, because
   * `setModel` — the only place that learns an object has arrived — never asked for a store.
   *
   * **Measured before the fix: `{}`.**
   */
  it('a value that arrived a frame before the Id is not lost', async () => {
    const graph = await graphWith('Model2', { properties: 'name' }, ID_AND_VALUE);
    const trigger = graph.node<TriggerInstance>('trigger');

    trigger.send('b', 'Ada');
    await graph.settle(3);
    trigger.send('a', 'c1-late-id');
    await graph.settle(3);

    expect(Model.get('c1-late-id').data).toEqual({ name: 'Ada' });
  });

  /**
   * ✅ Pinned control. Same-frame arrival always worked — `scheduleAfterInputsHaveUpdated`
   * runs once every input in the pass has been applied — which is exactly why the gap
   * survived a careful read of this file. Without this row the fix above could be "achieved"
   * by making the node store on every input, and nothing here would notice.
   */
  it('(control) an Id and a value arriving together still store once', async () => {
    const graph = await graphWith('Model2', { properties: 'name' }, ID_AND_VALUE);
    const trigger = graph.node<TriggerInstance>('trigger');

    trigger.send('a', 'c1-same-frame');
    trigger.send('b', 'Ada');
    await graph.settle(3);

    expect(Model.get('c1-same-frame').data).toEqual({ name: 'Ada' });
  });
});

describe('C2 — Set Object Properties, an empty Id', () => {
  /**
   * `Model.get('')` and `Model.get(null)` are the **named** tier: one record per spelling,
   * kept for the life of the process and shared by every node in this state.
   *
   * Measured before the fix: `Done`, and `Model._models['null'].data === {name: 'Ada'}` — a
   * write reported as a success, into a record no id can ever read back, colliding silently
   * with every other node whose Id happened to be blank at the time.
   */
  it.each([
    ['null', null, 'null'],
    ["''", '', '']
  ])('%s fails instead of storing into a shared record', async (_label, value, key) => {
    const graph = await graphWith('SetModelProperties', { properties: 'name' }, [
      ...ID_AND_VALUE,
      { sourcePort: 'go', targetPort: 'store' }
    ]);
    const trigger = graph.node<TriggerInstance>('trigger');

    trigger.send('b', 'Ada');
    trigger.send('a', value);
    await graph.settle(3);
    trigger.go();
    await graph.settle(3);

    expect(graph.signalsFor('target')).toContain('failure');
    // ERG-001 §4: `stored` -> `done`. Asserted on the live name so it cannot pass vacuously.
    expect(graph.signalsFor('target')).not.toContain('done');
    expect(graph.errors.map((error) => error.code)).toContain('set-object-properties/no-object');
    // The half that matters most: no record was invented on the way past.
    expect(Model._models[key]).toBeUndefined();
  });

  /** ✅ Pinned control: a real id still stores, still says `Done`, still says nothing else. */
  it('(control) a real Id still stores', async () => {
    const graph = await graphWith('SetModelProperties', { properties: 'name' }, [
      ...ID_AND_VALUE,
      { sourcePort: 'go', targetPort: 'store' }
    ]);
    const trigger = graph.node<TriggerInstance>('trigger');

    trigger.send('b', 'Ada');
    trigger.send('a', 'c2-real-id');
    await graph.settle(3);
    trigger.go();
    await graph.settle(3);

    expect(graph.signalsFor('target')).toContain('done');
    expect(graph.signalsFor('target')).not.toContain('failure');
    expect(Model.get('c2-real-id').data).toEqual({ name: 'Ada' });
  });
});

describe('C3 — the Object node, an empty Id', () => {
  /**
   * The Object node reached the same `Model.get` by a second route: `typeof null === 'object'`
   * sent `null` into `Model.create(null)`, whose `data ? data : {}` then read
   * `Model.get(undefined)` — a *fresh anonymous record on every `null`*. The node bound it and
   * announced `Fetched`, so downstream sequencing fired for an object that had never existed
   * a moment earlier and that nothing else could ever name.
   */
  it('null binds nothing and does not announce Fetched', async () => {
    const graph = await graphWith('Model2', { properties: 'name' }, ID_AND_VALUE);
    const trigger = graph.node<TriggerInstance>('trigger');

    trigger.send('a', null);
    await graph.settle(3);

    expect(graph.signalsFor('target')).not.toContain('fetched');
    expect(graph.node<ObjectNodeInstance>('target')._internal.model).toBeUndefined();
  });

  /**
   * ⚠️ This row asserts on the node's *binding*, not on `Model._models['']`, and the
   * difference is not cosmetic. `Model._models` is process-wide and every suite in this file
   * shares it, so a registry assertion here reddens whenever the C2 row above regresses —
   * a discrimination check on `modelcrudbase` made this row fail for a defect in a different
   * file. The empty-string record is pinned once, in C2, where the node that mints it lives.
   */
  it("'' binds nothing rather than the record named by the empty string", async () => {
    const graph = await graphWith('Model2', { properties: 'name' }, ID_AND_VALUE);
    const trigger = graph.node<TriggerInstance>('trigger');

    trigger.send('a', '');
    await graph.settle(3);

    expect(graph.signalsFor('target')).not.toContain('fetched');
    expect(graph.node<ObjectNodeInstance>('target')._internal.model).toBeUndefined();
  });

  /**
   * ✅ Pinned control, and it is the load-bearing one: the Object node's create-on-read is
   * the *feature*. An author-typed Id that nothing has loaded is supposed to spring into
   * existence — that is what makes an Object node usable as local state — so the guard must
   * reject only the empty spellings and nothing else.
   */
  it('(control) a real Id still binds, mints on read and announces Fetched', async () => {
    const graph = await graphWith('Model2', { properties: 'name' }, ID_AND_VALUE);
    const trigger = graph.node<TriggerInstance>('trigger');

    trigger.send('a', 'c3-never-seen-before');
    await graph.settle(3);

    expect(graph.signalsFor('target')).toContain('fetched');
    expect(Model.exists('c3-never-seen-before')).toBe(true);
  });

  /**
   * ✅ Pinned control for the *other* half of that setter: a plain JS object wired to `Id` is
   * still dereferenced into a record. Guarding `null` there is one character away from
   * breaking this, and nothing else covers it.
   */
  it('(control) a plain JS object wired to Id is still dereferenced', async () => {
    const graph = await graphWith('Model2', { properties: 'name' }, ID_AND_VALUE);
    const trigger = graph.node<TriggerInstance>('trigger');

    trigger.send('a', { name: 'FromLiteral' });
    await graph.settle(3);

    const bound = graph.node<ObjectNodeInstance>('target')._internal.model;
    expect(bound).toBeDefined();
    expect(bound!.get('name')).toBe('FromLiteral');
  });
});

describe('Create New Object', () => {
  /**
   * No defect found; this is the row that says so, and it pins the two things a change to
   * the shared mixin would break first — a *distinct* object per `Do`, and the property
   * values carried onto each.
   */
  it('mints a distinct object per Do and writes the pending values onto each', async () => {
    const graph = await graphWith('NewModel', { properties: 'name' }, [
      { sourcePort: 'go', targetPort: 'new' },
      { sourcePort: 'b', targetPort: 'prop-name' }
    ]);
    const trigger = graph.node<TriggerInstance>('trigger');

    trigger.send('b', 'Ada');
    await graph.settle(2);
    trigger.go();
    await graph.settle(3);
    const first = graph.node<ObjectNodeInstance>('target')._internal.model!.getId();

    trigger.go();
    await graph.settle(3);
    const second = graph.node<ObjectNodeInstance>('target')._internal.model!.getId();

    // ERG-001 §4: `created` -> `done`.
    expect(graph.signalsFor('target').filter((s) => s === 'done')).toHaveLength(2);
    expect(first).not.toBe(second);
    expect(Model.get(first).data).toEqual({ name: 'Ada' });
    expect(Model.get(second).data).toEqual({ name: 'Ada' });
  });
});

describe('C4 — HTTP Request, a timeout is a failure', () => {
  let server: http.Server;
  let base = '';

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      if ((req.url || '').startsWith('/slow')) {
        // Longer than any timeout a row here sets, so the abort always wins the race.
        setTimeout(() => {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end('{"ok":true}');
        }, 5000).unref();
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"ok":true,"n":7}');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  async function httpGraph(parameters: Record<string, unknown>): Promise<CorpusGraph> {
    return graphWith('net.noodl.HTTP', parameters, [
      { sourcePort: 'go', targetPort: 'fetch' },
      { sourcePort: 'stop', targetPort: 'cancel' }
    ]);
  }

  /**
   * The defect. `AbortController` hands the `catch` one `AbortError` for both causes, and the
   * handler answered `canceled` for both — so `Timeout (ms)`, a port whose entire job is to
   * abandon a request, reported on the port an author wires only for their own aborts, and
   * left `Error` `undefined`. Nothing anywhere said what had happened.
   */
  it('exceeding Timeout fires Failure, with a message naming the timeout', async () => {
    const graph = await httpGraph({ url: base + '/slow', method: 'GET', timeout: 150 });
    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(2);
    await wait(600);

    expect(graph.signalsFor('target')).toContain('failure');
    expect(graph.signalsFor('target')).not.toContain('canceled');
    expect(graph.node('target').getOutput('error').value).toEqual(expect.stringContaining('timed out after 150'));
  });

  /**
   * ✅ The discriminating control, and the reason the fix is a flag rather than a rewrite of
   * the branch: an abort the *author* asked for is still a cancellation, still silent, and
   * still not a failure. Delete the `timedOut` flag and make the branch unconditional and
   * this row is the one that reddens.
   */
  it('(control) Cancel on a request in flight still fires Canceled and reports nothing', async () => {
    const graph = await httpGraph({ url: base + '/slow', method: 'GET', timeout: 30000 });
    const trigger = graph.node<TriggerInstance>('trigger');

    trigger.go();
    await graph.settle(2);
    await wait(100);
    trigger.stop();
    await graph.settle(2);
    await wait(300);

    expect(graph.signalsFor('target')).toContain('canceled');
    expect(graph.signalsFor('target')).not.toContain('failure');
    expect(graph.node('target').getOutput('error').value).toBeUndefined();
  });

  /** ✅ Pinned control: an ordinary request is unaffected by any of the above. */
  it('(control) a request that answers still succeeds', async () => {
    const graph = await httpGraph({ url: base + '/ok', method: 'GET' });
    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(2);
    await wait(400);

    expect(graph.signalsFor('target')).toContain('success');
    expect(graph.node('target').getOutput('statusCode').value).toBe(200);
  });

  /**
   * ⚠️ **Known and deliberately not fixed** — this row pins the behaviour so the next reader
   * does not spend the afternoon rediscovering why it cannot be repaired here.
   *
   * After a request that never reached the server, `Status Code` and `Response` still read
   * the *previous* request's answer. Clearing them is not available: `Node.prototype.sendValue`
   * returns early on `undefined` (`node.ts:635`), so flagging an output back to `undefined`
   * sends nothing at all and the downstream input keeps what it had. Making the outputs
   * honest needs a runtime-wide answer to "how does a value output become empty", which is
   * larger than this node.
   *
   * What NDA-012 did do is make it *sayable*: `Error` now names the timeout, `Failure` fires,
   * and both ports' descriptions state that they hold the previous answer.
   */
  it('(pinned, unfixed) a failed request leaves the previous Status Code in place', async () => {
    const graph = await httpGraph({ url: base + '/ok', method: 'GET', timeout: 250 });
    const trigger = graph.node<TriggerInstance>('trigger');

    trigger.go();
    await graph.settle(2);
    await wait(400);
    expect(graph.node('target').getOutput('statusCode').value).toBe(200);

    graph.node<HttpNodeInstance>('target')._internal.url = base + '/slow';
    trigger.go();
    await graph.settle(2);
    await wait(700);

    expect(graph.signalsFor('target')).toContain('failure');
    expect(graph.node('target').getOutput('statusCode').value).toBe(200);
  });
});
