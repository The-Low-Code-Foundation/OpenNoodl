/**
 * NDA-012 (Cloud Services) / NDA-004 §2 — Aggregate Records reports its failures.
 *
 * Two defects in one four-line helper, and both are shapes this phase had already fixed
 * elsewhere:
 *
 *   1. `setError` wrote `_internal.err` while the `error` output's getter reads
 *      `_internal.error`. PLAT-003 NOTES §23.4 found that in the deprecated
 *      `dbcollectionnode` and §27.3 found it again in `dbcollectionnode2`; this was the third
 *      live instance. From the graph, an aggregation that failed pulsed `Failure` and left
 *      `Error` blank forever.
 *   2. Nothing was raised on the runtime error channel, so there was no diagnosis in any
 *      runtime — B-iv's condition, in the one package NDA-004 §2's twenty-two-helper sweep did
 *      not open.
 *
 * The rows drive the node's own `prototypeExtensions` rather than standing a cloud runtime up:
 * what is under test is this helper's decision-making, and `flagOutputDirty` /
 * `sendSignalOnOutput` / `raiseRuntimeError` are the whole of its collaboration with the
 * runtime.
 *
 * ⚠️ Row 1 asserts through the **output getter**, not through `_internal`. Reading the field
 * directly would pass with the defect restored, because the defect is precisely that the
 * writer and the reader named different fields — an assertion on either one alone cannot see
 * a mismatch between them.
 */

interface RaisedError {
  code: string;
  message: string;
  detail?: unknown;
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const AggregateModule = require('../src/nodes/data/aggregatenode');

type Bag = Record<string, (...args: unknown[]) => unknown>;

/** The node definition, with just enough shape to reach its ports and methods. */
const AggregateNode = AggregateModule.node as {
  outputs: Record<string, { getter?: (this: unknown) => unknown }>;
  inputs: Record<string, { description?: string }>;
  prototypeExtensions: Bag;
};

function makeAggregate() {
  const signals: string[] = [];
  const dirtied: string[] = [];
  const raised: RaisedError[] = [];

  const instance: Record<string, unknown> = {
    _internal: {} as Record<string, unknown>,
    sendSignalOnOutput: (name: string) => signals.push(name),
    flagOutputDirty: (name: string) => dirtied.push(name),
    raiseRuntimeError: (code: string, message: string, detail?: unknown) => raised.push({ code, message, detail })
  };

  for (const name of Object.keys(AggregateNode.prototypeExtensions)) {
    instance[name] = AggregateNode.prototypeExtensions[name].bind(instance);
  }

  /** What the graph sees on the `Error` port — the only reader that matters here. */
  const readErrorPort = () => AggregateNode.outputs.error.getter.call(instance);

  return { instance, signals, dirtied, raised, readErrorPort };
}

describe('NDA-012 Cloud Services — Aggregate Records failure reporting', () => {
  it('C1: the message reaches the Error port, not a field nothing reads', () => {
    const { instance, readErrorPort } = makeAggregate();

    (instance.setError as (err: string) => void)('Failed to aggregate.');

    expect(readErrorPort()).toBe('Failed to aggregate.');
  });

  it('C2: the Error port is flagged so a connected node is told, and Failure pulses', () => {
    const { instance, signals, dirtied } = makeAggregate();

    (instance.setError as (err: string) => void)('Failed to aggregate.');

    expect(dirtied).toContain('error');
    expect(signals).toContain('failure');
    // Harness fact 1: `sendSignalOnOutput` on a name the node lacks only logs, so the signal
    // arriving proves nothing about the port existing. Assert the declaration too.
    expect(Object.keys(AggregateNode.outputs)).toContain('failure');
  });

  it('C3: the failure is raised on the runtime error channel, so it is diagnosable when deployed', () => {
    const { instance, raised } = makeAggregate();

    (instance.setError as (err: string) => void)('Failed to aggregate.');

    expect(raised).toHaveLength(1);
    expect(raised[0].code).toBe('aggregate-records/aggregate-failed');
    expect(raised[0].message).toBe('Failed to aggregate.');
  });

  it('C4 (control): a node that has not failed reports nothing on either surface', () => {
    const { signals, raised, readErrorPort } = makeAggregate();

    // The control that makes C1 mean something: the port is empty *because nothing failed*,
    // not because the message never arrives. Without it C1 would still pass against a getter
    // that returned a constant.
    expect(readErrorPort()).toBeUndefined();
    expect(signals).toHaveLength(0);
    expect(raised).toHaveLength(0);
  });

  it('C6 (DEF-012): a filter that cannot be translated fails the node instead of aggregating unfiltered', () => {
    const { instance, signals, raised, readErrorPort } = makeAggregate();
    const internal = instance._internal as Record<string, unknown>;
    instance.context = {}; // no editorConnection — the deployed backend's shape
    internal.name = 'Chunk';
    internal.storageSettings = {};
    internal.queryParameters = { x: 'some-id' };
    // `points to` with no cached schema is the known-firing translation failure
    // (the same one SB-011 measured widening a Query Records node). Before this
    // guard the throw escaped `fetch` and the node neither aggregated nor
    // failed; the sibling defect in Query Records aggregated EVERY row.
    internal.visualFilter = { combinator: 'and', rules: [{ property: 'owner', operator: 'points to', input: 'x' }] };

    (instance.fetch as () => void)();

    expect(signals).toContain('failure');
    expect(raised).toHaveLength(1);
    expect(String(readErrorPort())).toMatch(/schema/);
  });

  it('C5: NDA-005 — the static ports carry descriptions', () => {
    expect(AggregateNode.inputs.aggregates.description).toBeTruthy();
    for (const name of Object.keys(AggregateNode.outputs)) {
      expect(AggregateNode.outputs[name]).toHaveProperty('description');
    }
  });
});
