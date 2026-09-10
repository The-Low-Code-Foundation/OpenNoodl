/**
 * FLD-008 / issue #14 — **an aggregation that cannot answer says so.**
 *
 * ## What was reported
 *
 * Aggregate Records with a filter returned **250 where 125 was expected**, and *"in some
 * cases it seems to ignore the filter conditions"*. The filter was a JavaScript one with two
 * top-level keys:
 *
 * ```js
 * where({ campaignId: { equalTo: '…' }, status: { equalTo: 'approved' } })
 * ```
 *
 * ## The mechanism, and why it was invisible
 *
 * That filter is **correctly refused** — `translators/walk.ts` enforces one key per node and
 * says so in a sentence naming both keys. `convertFilterOp` reports the refusal through
 * `options.error(…)` and returns `{}`. The node's `error` callback did exactly one thing with
 * it: call `context.editorConnection.sendWarning(…)`.
 *
 * 🔴 **There is no `editorConnection` in a deployed cloud function.** So that line threw a
 * `TypeError`, the throw unwound out of the filter script into `catch (e) { console.log(…) }`,
 * `_filter` was never assigned, and `{ where: {} }` reached `CloudStore.aggregate`. The node
 * aggregated over the **whole class** and returned a number. The 250 is the unfiltered total —
 * it is not a doubled 125, and no fixture here reproduces "double".
 *
 * ⚠️ **This is why DEF-012 did not catch it.** DEF-012 (`6deabdd4f`) made exactly this
 * decision — a refused filter fails the node — but only on the **visual** filter path
 * (`getStorageFilter`'s `simple` branch). The JavaScript branch was untouched. And the defect
 * cannot be seen from the editor at all: with an `editorConnection` present the callback
 * succeeds, the warning appears, and the widening never happens. **Every arm below runs in
 * the cloud-function shape, `context = {}`** — AC3.
 *
 * ## The reverted arm
 *
 * `withReverted` recompiles the node's own source with the fix textually undone — the guard
 * back to unconditional, the capture removed — and requires it from the same directory, so
 * `@noodl/runtime` resolves to the same modules. The two replacements are **asserted to have
 * matched**; if the source moves, this arm fails loudly instead of quietly grading nothing.
 */

import * as fs from 'fs';
import * as path from 'path';

interface RaisedError {
  code: string;
  message: string;
}

/** What `CloudStore.aggregate` was handed, so an arm can read the `where` that was actually sent. */
interface AggregateCall {
  collection: string;
  where: unknown;
  group: unknown;
  success(results: Record<string, unknown>): void;
  error(err: string): void;
}

type Bag = Record<string, (...args: unknown[]) => unknown>;

interface AggregateModuleShape {
  node: {
    outputs: Record<string, { getter?: (this: unknown) => unknown }>;
    prototypeExtensions: Bag;
  };
}

const NODE_SOURCE = path.join(__dirname, '..', 'src', 'nodes', 'data', 'aggregatenode.js');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const CloudStore = require('@noodl/runtime/src/api/cloudstore');

/** The reporter's filter, verbatim in shape: two top-level keys, which the language forbids. */
const TWO_KEY_FILTER = "where({ campaignId: { equalTo: 'c-1' }, status: { equalTo: 'approved' } })\n";

/** The same intent, written the way the translator's own message tells them to write it. */
const AND_FILTER =
  "where({ and: [ { campaignId: { equalTo: 'c-1' } }, { status: { equalTo: 'approved' } } ] })\n";

/**
 * A node built from a given module, in the shape a deployed cloud function has.
 *
 * ⚠️ `context` is `{}` — **no `editorConnection`**. That is the whole point of the file and
 * every arm depends on it; an arm with an editor connection cannot see this defect.
 */
function makeAggregate(mod: AggregateModuleShape, filterScript: string) {
  const signals: string[] = [];
  const raised: RaisedError[] = [];
  const aggregates: AggregateCall[] = [];

  const forScope = CloudStore.forScope;
  CloudStore.forScope = () => ({
    aggregate: (opts: AggregateCall) => aggregates.push(opts)
  });

  const instance: Record<string, unknown> = {
    _internal: {
      name: 'Chunk',
      queryParameters: {},
      aggregates: {},
      storageSettings: {
        storageFilterType: 'json',
        storageJSONFilter: filterScript
      }
    },
    context: {},
    nodeScope: { modelScope: undefined, componentOwner: { name: '/Reports' } },
    sendSignalOnOutput: (name: string) => signals.push(name),
    flagOutputDirty: () => undefined,
    hasOutput: () => false,
    raiseRuntimeError: (code: string, message: string) => raised.push({ code, message })
  };

  for (const name of Object.keys(mod.node.prototypeExtensions)) {
    instance[name] = mod.node.prototypeExtensions[name].bind(instance);
  }

  return {
    instance,
    fetch: () => (instance.fetch as () => void)(),
    signals,
    raised,
    aggregates,
    /** The graph's own reader. Asserting `_internal` instead would grade the wrong field. */
    readErrorPort: () => mod.node.outputs.error.getter.call(instance),
    restore: () => {
      CloudStore.forScope = forScope;
    }
  };
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const FixedModule = require(NODE_SOURCE) as AggregateModuleShape;

/**
 * The node as it was before FLD-008, compiled and required for real.
 *
 * The reverted copy is written beside the original so its own `require` calls resolve
 * identically, and removed again immediately.
 */
function withReverted<T>(body: (mod: AggregateModuleShape) => T): T {
  const original = fs.readFileSync(NODE_SOURCE, 'utf8');

  const CAPTURE = '              _filterFailed = err;\n';
  const GUARD = '              if (_this.context.editorConnection) {';
  expect(original).toContain(CAPTURE);
  expect(original).toContain(GUARD);

  const reverted = original.replace(CAPTURE, '').replace(GUARD, '              if (true) {');

  const revertedPath = path.join(path.dirname(NODE_SOURCE), `aggregatenode.fld008-reverted.${process.pid}.js`);
  fs.writeFileSync(revertedPath, reverted, 'utf8');
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return body(require(revertedPath) as AggregateModuleShape);
  } finally {
    delete require.cache[require.resolve(revertedPath)];
    fs.unlinkSync(revertedPath);
  }
}

describe('FLD-008 — Aggregate Records, in the shape a cloud function has', () => {
  it('AC1: a filter it cannot translate fails the node and issues NO aggregation', () => {
    const arm = makeAggregate(FixedModule, TWO_KEY_FILTER);
    try {
      arm.fetch();

      expect(arm.signals).toContain('failure');
      expect(arm.signals).not.toContain('fetched');
      // The translator's own sentence, naming both offending keys — not a house error string.
      expect(String(arm.readErrorPort())).toBe(
        'A filter must have exactly one key, found 2: campaignId, status. ' +
          'Combine conditions with { and: [ … ] } or { or: [ … ] }.'
      );
      expect(arm.raised.map((r) => r.code)).toEqual(['aggregate-records/aggregate-failed']);
      // 🔴 The half that is the defect: it must not answer. Issue #14's 250 is this call
      // going out with an empty `where`.
      expect(arm.aggregates).toHaveLength(0);
    } finally {
      arm.restore();
    }
  });

  it('AC2: the same filter rewritten with `and:` aggregates, and aggregates FILTERED', () => {
    const arm = makeAggregate(FixedModule, AND_FILTER);
    try {
      arm.fetch();

      // The presence control AC2 exists for: without it, AC1 cannot tell "refuses correctly"
      // from "refuses everything".
      expect(arm.aggregates).toHaveLength(1);
      expect(arm.aggregates[0].where).toEqual({
        $and: [{ campaignId: { $eq: 'c-1' } }, { status: { $eq: 'approved' } }]
      });
      expect(arm.signals).not.toContain('failure');
      expect(arm.readErrorPort()).toBeUndefined();

      arm.aggregates[0].success({ total: 125 });
      expect(arm.signals).toContain('fetched');
    } finally {
      arm.restore();
    }
  });

  it('AC4 (reverted): the node before the fix aggregates the WHOLE class and says nothing', () => {
    withReverted((RevertedModule) => {
      const arm = makeAggregate(RevertedModule, TWO_KEY_FILTER);
      try {
        arm.fetch();

        // 🔴 Issue #14, reproduced: one request, no `where` at all. Whatever that returns is
        // the total over every row in the class, and the graph is told it succeeded.
        expect(arm.aggregates).toHaveLength(1);
        expect(arm.aggregates[0].where).toEqual({});
        expect(arm.signals).not.toContain('failure');
        expect(arm.readErrorPort()).toBeUndefined();
        expect(arm.raised).toHaveLength(0);
      } finally {
        arm.restore();
      }
    });
  });

  it('AC4 (reverted, control): the `and:` rewrite was NEVER broken — the defect is the refusal path', () => {
    withReverted((RevertedModule) => {
      const arm = makeAggregate(RevertedModule, AND_FILTER);
      try {
        arm.fetch();

        // Without this the reverted arm above could be read as "the old node never filtered
        // anything". It filtered fine; it just turned a refusal into an unfiltered answer.
        expect(arm.aggregates).toHaveLength(1);
        expect(arm.aggregates[0].where).toEqual({
          $and: [{ campaignId: { $eq: 'c-1' } }, { status: { $eq: 'approved' } }]
        });
      } finally {
        arm.restore();
      }
    });
  });

  it('AC1 (ordering): a connection that is present and BROKEN still loses nothing', () => {
    // The guard alone would not be enough. The same `TypeError` the missing connection
    // produced can come from a connection that is present and throwing, and then the guard
    // does not fire — so what actually saves the refusal is that it is captured **before**
    // the warning is attempted. This arm grades that ordering; the guard arms above cannot.
    const arm = makeAggregate(FixedModule, TWO_KEY_FILTER);
    // Named aggregates so `fetch`'s editor-only precheck reaches `clearWarning` and the only
    // `sendWarning` in the pass is the filter one — the line under test.
    (arm.instance._internal as Record<string, unknown>).aggregatesList = 'total';
    (arm.instance._internal as Record<string, unknown>).aggregates = { total: { prop: 'amount', op: 'sum' } };
    (arm.instance.context as Record<string, unknown>).editorConnection = {
      sendWarning: () => {
        throw new TypeError('the editor went away mid-warning');
      },
      clearWarning: () => undefined
    };
    try {
      arm.fetch();

      expect(arm.signals).toContain('failure');
      expect(arm.aggregates).toHaveLength(0);
      expect(String(arm.readErrorPort())).toMatch(/exactly one key, found 2/);
    } finally {
      arm.restore();
    }
  });
});

describe('FLD-008 AC5 — Aggregate Records does not read a connected query`s filter', () => {
  /**
   * The setup correction the reporter is owed. *"It ignores the filter conditions"* is also
   * true of a perfectly valid filter set on a **Query Records** node wired into this one:
   * Aggregate Records has its own `Class` and `Filter` and builds its own `where`, and there
   * is no input on it through which another node's query could arrive.
   *
   * Graded on the port list the editor is actually sent, because that is where a person would
   * look for such an input.
   */
  function portsSentToEditor(parameters: Record<string, unknown>) {
    let ports: { name: string; plug?: string; type?: { allowEditOnly?: boolean; name?: string } }[] = [];
    const handlers: Record<string, (arg: unknown) => void> = {};
    const graphModel = {
      getMetaData: () => undefined,
      getNodesWithType: () => [{ id: 'agg-1', parameters, on: () => undefined }],
      on: (event: string, cb: (arg: unknown) => void) => {
        handlers[event] = cb;
      }
    };
    const context = {
      editorConnection: {
        isRunningLocally: () => true,
        sendDynamicPorts: (_id: string, p: typeof ports) => {
          ports = p;
        }
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    (require(NODE_SOURCE) as { setup(c: unknown, g: unknown): void }).setup(context, graphModel);
    handlers['editorImportComplete'](undefined);
    return ports;
  }

  it('offers no input that could carry a query or a collection from another node', () => {
    const ports = portsSentToEditor({ collectionName: 'Chunk', storageFilterType: 'json' });

    // The instrument, first: a port list that came back empty would pass every assertion below.
    expect(ports.length).toBeGreaterThan(0);
    expect(ports.map((p) => p.name)).toContain('collectionName');

    const wireable = ports.filter((p) => p.plug === 'input' && !p.type?.allowEditOnly);

    // `Do` is the only wireable input on a node with no filter variables. Class and Filter are
    // `allowEditOnly` — they cannot take a wire, from a Query Records node or anything else.
    expect(wireable.map((p) => p.name)).toEqual(['storageFetch']);
  });

  it('the filter it uses comes from its OWN parameters — the presence control', () => {
    const arm = makeAggregate(FixedModule, AND_FILTER);
    try {
      arm.fetch();
      // Nothing was wired in; the `where` came entirely from this node's own filter script.
      expect(arm.aggregates[0].where).toEqual({
        $and: [{ campaignId: { $eq: 'c-1' } }, { status: { $eq: 'approved' } }]
      });
      expect(arm.aggregates[0].collection).toBe('Chunk');
    } finally {
      arm.restore();
    }
  });
});
