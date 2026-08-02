/**
 * OBS-002 — the walk engine's acceptance, stated as tests.
 *
 * These run under plain jest with no Electron and no renderer, which is the point: the engine
 * is the part of the feature that must be correct, and the retired lineage panel's bugs were
 * mostly untestable UI-timing races precisely because its algorithm was welded to selection
 * events. Nothing here imports anything but the engine.
 */

import {
  Topology,
  TraceEventLike,
  backwardWalk,
  buildIndex,
  explainTerminus,
  forEachRow,
  forwardWalk,
  labelFor,
  portsToResolve,
  rootEvents
} from '../../src/editor/src/utils/provenance/walkEngine';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function node(id: string, name: string, type: string, component = '/App') {
  return { id, info: { name, type, component } };
}

/** `A.out -> B.in` shorthand, so a fixture graph reads as the wires it is. */
function wire(spec: string) {
  const [from, to] = spec.split('->').map((s) => s.trim());
  const [fromNode, fromPort] = from.split('.');
  const [toNode, toPort] = to.split('.');
  return { from: { node: fromNode, port: fromPort }, to: { node: toNode, port: toPort } };
}

function topology(nodes: Array<ReturnType<typeof node>>, wires: string[]): Topology {
  const map: Topology['nodes'] = {};
  for (const n of nodes) map[n.id] = n.info;
  return { nodes: map, edges: wires.map(wire) };
}

let seq = 0;
function event(spec: string, opts: { cause?: number; value?: string; kind?: 'value' | 'signal'; t?: number } = {}) {
  const edge = wire(spec);
  seq++;
  return {
    seq,
    t: opts.t ?? 1_000 + seq,
    cause: opts.cause ?? 0,
    from: edge.from,
    to: edge.to,
    value: opts.value ?? '"x"',
    kind: opts.kind ?? 'value'
  } as TraceEventLike;
}

beforeEach(() => {
  seq = 0;
});

/** Variable -> String -> Text: the exact three-node chain the old panel produced 40+ rows for. */
const CHAIN = topology(
  [
    node('var', 'cart', 'Variable'),
    node('str', 'Join', 'String Format'),
    node('txt', 'Label', 'Text')
  ],
  ['var.Value -> str.input', 'str.output -> txt.text']
);

// ---------------------------------------------------------------------------

describe('OBS-002 — the walk follows wires, it does not enumerate ports', () => {
  it('resolves a three-node chain in a handful of rows, not forty', () => {
    // The regression guard for the failure recorded in DETERMINISTIC-LINEAGE-SUBSTRATE.md.
    // Every node here also carries unconnected ports in a real project; the engine cannot
    // see them at all, because it is built from edges.
    const index = buildIndex(CHAIN, []);
    const walk = backwardWalk(index, { node: 'txt', port: 'text' });

    expect(walk.rowCount).toBeLessThanOrEqual(6);
    const labels: string[] = [];
    forEachRow(walk.root, (row) => labels.push(labelFor(index, row.ref)));
    expect(labels).toEqual(['Label.text', 'Join.output', 'Join.input', 'cart.Value']);
  });

  it('never emits a row for a port that has no wire', () => {
    // `txt.visible` and `str.unused` are declared nowhere in the edge list. A port model is
    // not needed to exclude them — the absence of a wire already does it.
    const index = buildIndex(CHAIN, []);
    const walk = backwardWalk(index, { node: 'txt', port: 'text' });

    forEachRow(walk.root, (row) => {
      const connected =
        row.ref.port === 'text' ||
        CHAIN.edges.some(
          (e) =>
            (e.from.node === row.ref.node && e.from.port === row.ref.port) ||
            (e.to.node === row.ref.node && e.to.port === row.ref.port)
        );
      expect(connected).toBe(true);
    });
  });
});

describe('OBS-002 — layer 1 works on a cold editor', () => {
  it('annotates every hop with a current value when nothing has ever fired', () => {
    const index = buildIndex(CHAIN, [], {
      'txt|text|input': '"Hello"',
      'str|output|output': '"Hello"',
      'str|input|input': '["a"]',
      'var|Value|output': '["a"]'
    });
    const walk = backwardWalk(index, { node: 'txt', port: 'text' });

    const values: string[] = [];
    forEachRow(walk.root, (row) => values.push(row.currentValue as string));
    expect(values).toEqual(['"Hello"', '"Hello"', '["a"]', '["a"]']);
  });

  it('says `unknown` rather than `never fired` when no trace has been loaded', () => {
    // Confidently reporting "never fired" with no trace would be exactly the class of wrong
    // answer that got the last panel retired.
    const index = buildIndex(CHAIN, []);
    const walk = backwardWalk(index, { node: 'txt', port: 'text' });

    forEachRow(walk.root, (row) => expect(row.status).toBe('unknown'));
    expect(walk.mode).toBe('structural');
  });

  it('lists the ports a walk needs values for, before anything has been walked', () => {
    const index = buildIndex(CHAIN, []);
    const refs = portsToResolve(index, { node: 'txt', port: 'text' });
    expect(refs.map((r) => `${r.node}.${r.port} (${r.direction})`).sort()).toEqual([
      'str.input (input)',
      'str.output (output)',
      'txt.text (input)',
      'var.Value (output)'
    ]);
  });
});

describe('OBS-002 — layer 2 puts the boundary where the bug is', () => {
  it('marks the node that was reached and emitted nothing, and stops there', () => {
    // `var.Value` fired into `str.input`. `str.output` never fired. The bug is String Format.
    const index = buildIndex(CHAIN, [event('var.Value -> str.input')]);
    const walk = backwardWalk(index, { node: 'txt', port: 'text' });

    expect(walk.boundary.map((row) => labelFor(index, row.ref))).toEqual(['Join.output']);

    const byLabel: Record<string, string> = {};
    forEachRow(walk.root, (row) => (byLabel[labelFor(index, row.ref)] = row.status));
    expect(byLabel).toEqual({
      'Label.text': 'never-fired',
      'Join.output': 'never-fired',
      'Join.input': 'fired',
      'cart.Value': 'fired'
    });
  });

  it('treats a hop that fired as a leaf, so the walk stops at the frontier', () => {
    const index = buildIndex(CHAIN, [event('var.Value -> str.input')]);
    const walk = backwardWalk(index, { node: 'txt', port: 'text' });

    let fired = 0;
    forEachRow(walk.root, (row) => {
      if (row.status === 'fired' && row.direction === 'output') {
        fired++;
        expect(row.children).toHaveLength(0);
        expect(row.truncated).toBe('fired');
      }
    });
    expect(fired).toBe(1);
  });

  it('follows the cause chain instead of fanning out when the target did receive a value', () => {
    const a = event('var.Value -> str.input');
    const b = event('str.output -> txt.text', { cause: a.seq });
    const index = buildIndex(CHAIN, [a, b]);
    const walk = backwardWalk(index, { node: 'txt', port: 'text' });

    expect(walk.mode).toBe('causal');
    // A chain, not a tree: every row has at most one child.
    forEachRow(walk.root, (row) => expect(row.children.length).toBeLessThanOrEqual(1));
    expect(walk.rowCount).toBe(3);
    // `cause: 0` terminates the chain at a root — a timer, a DOM event, or boot.
    const last = walk.boundary.length ? walk.boundary : [];
    expect(last).toEqual([]);
  });

  it('says so when the causing event has aged out of the ring buffer', () => {
    // A cause pointing at a seq that is no longer held must not render as a complete chain.
    const orphan = { ...event('str.output -> txt.text'), cause: 999 };
    const index = buildIndex(CHAIN, [orphan]);
    const walk = backwardWalk(index, { node: 'txt', port: 'text' });

    const tail = walk.root.children[0];
    expect(tail.truncated).toBe('depth');
  });
});

describe('OBS-002 — aggregation', () => {
  it('renders an edge that fired 100 times as one row carrying the count and the last value', () => {
    const events: TraceEventLike[] = [];
    for (let i = 0; i < 100; i++) events.push(event('var.Value -> str.input', { value: `"row ${i}"` }));
    const index = buildIndex(CHAIN, events);
    const walk = backwardWalk(index, { node: 'txt', port: 'text' });

    const inputRow = walk.root.children[0].children[0];
    expect(labelFor(index, inputRow.ref)).toBe('Join.input');
    expect(inputRow.fireCount).toBe(100);
    expect(inputRow.event?.value).toBe('"row 99"');
    // One row for a hundred firings is the whole point — the wall of rows is what killed the
    // shelved panel.
    expect(walk.rowCount).toBe(4);
  });
});

describe('OBS-002 — scale comes from topology, not filtering', () => {
  /** A four-hop chain into a repeater, buried in 300 unrelated nodes that fire continuously. */
  function busyProject() {
    const nodes = [
      node('btn', 'Add To Cart', 'Button'),
      node('setitem', 'Set Cart Item', 'Set Variable'),
      node('push', 'Array Push', 'Array Push'),
      node('cart', 'cart', 'Variable'),
      node('rep', 'Cart Rows', 'Repeater')
    ];
    const wires = [
      'btn.click -> setitem.Do',
      'setitem.Done -> push.Do',
      'push.Items -> cart.Value',
      'cart.Value -> rep.Items'
    ];
    for (let i = 0; i < 300; i++) {
      nodes.push(node(`noise${i}`, `Noise ${i}`, 'Timer', '/Noise'));
      if (i > 0) wires.push(`noise${i - 1}.tick -> noise${i}.start`);
    }
    return topology(nodes, wires);
  }

  it('resolves the add-to-cart symptom in under ten rows on a 300-node project', () => {
    const top = busyProject();
    const events: TraceEventLike[] = [];
    // The whole app is busy: 299 unrelated edges fire, repeatedly.
    for (let round = 0; round < 3; round++) {
      for (let i = 1; i < 300; i++) events.push(event(`noise${i - 1}.tick -> noise${i}.start`));
    }
    // The real interaction reached Array Push and stopped there.
    const click = event('btn.click -> setitem.Do', { kind: 'signal' });
    events.push(click);
    events.push(event('setitem.Done -> push.Do', { cause: click.seq, kind: 'signal' }));

    const index = buildIndex(top, events);
    const walk = backwardWalk(index, { node: 'rep', port: 'Items' });

    expect(walk.rowCount).toBeLessThanOrEqual(10);
    expect(walk.boundary.map((row) => labelFor(index, row.ref))).toEqual(['Array Push.Items']);

    // Not one of the 300 noisy nodes appears, though they produced ~900 of the ~902 events.
    forEachRow(walk.root, (row) => expect(row.ref.node.startsWith('noise')).toBe(false));
  });
});

describe('OBS-002 — component boundaries read as one path', () => {
  it('crosses three components without the caller navigating anything', () => {
    const top = topology(
      [
        node('src', 'Source', 'Variable', '/Data'),
        node('outA', 'Value', 'Component Outputs', '/Data'),
        node('inB', 'Value', 'Component Inputs', '/Middle'),
        node('outB', 'Result', 'Component Outputs', '/Middle'),
        node('inC', 'Result', 'Component Inputs', '/View'),
        node('label', 'Label', 'Text', '/View')
      ],
      [
        'src.Value -> outA.Value',
        'outA.Value -> inB.Value',
        'inB.Value -> outB.Result',
        'outB.Result -> inC.Result',
        'inC.Result -> label.text'
      ]
    );
    const index = buildIndex(top, []);
    const walk = backwardWalk(index, { node: 'label', port: 'text' });

    const components: string[] = [];
    forEachRow(walk.root, (row) => {
      const c = index.topology.nodes[row.ref.node].component;
      if (components[components.length - 1] !== c) components.push(c);
    });
    expect(components).toEqual(['/View', '/Middle', '/Data']);
  });
});

describe('OBS-002 — the forward walk and filter-by-cause', () => {
  const FANOUT = topology(
    [node('btn', 'Add To Cart', 'Button'), node('a', 'A', 'Set Variable'), node('b', 'B', 'Array Push'), node('c', 'C', 'Text')],
    ['btn.click -> a.Do', 'a.Done -> b.Do', 'b.Items -> c.text']
  );

  it('lists only root events, so a firehose becomes a handful of interactions', () => {
    const click = event('btn.click -> a.Do', { kind: 'signal' });
    const step = event('a.Done -> b.Do', { cause: click.seq, kind: 'signal' });
    const noise = event('b.Items -> c.text');
    const index = buildIndex(FANOUT, [click, step, noise]);

    const roots = rootEvents(index);
    expect(roots).toHaveLength(2);
    expect(roots[0].size).toBe(2);
  });

  it('collapses the whole trace to one chain in a single click', () => {
    const click = event('btn.click -> a.Do', { kind: 'signal' });
    const step = event('a.Done -> b.Do', { cause: click.seq, kind: 'signal' });
    const unrelated: TraceEventLike[] = [];
    for (let i = 0; i < 500; i++) unrelated.push(event('b.Items -> c.text'));

    const index = buildIndex(FANOUT, [click, step, ...unrelated]);
    const walk = forwardWalk(index, click);

    expect(walk.rowCount).toBe(2);
    expect(walk.boundary.map((row) => labelFor(index, row.ref))).toEqual(['B.Do']);
  });

  it('says why the terminus is suspicious by checking it against the topology', () => {
    const click = event('btn.click -> a.Do', { kind: 'signal' });
    const step = event('a.Done -> b.Do', { cause: click.seq, kind: 'signal' });
    const index = buildIndex(FANOUT, [click, step]);
    const walk = forwardWalk(index, click);

    expect(explainTerminus(index, walk.boundary[0])).toBe(
      'B fired. Its `Items` output has 1 connection. None of them carried a value.'
    );
  });
});

describe('OBS-002 — the walk terminates on hostile graphs', () => {
  it('does not loop forever on a feedback cycle', () => {
    const top = topology([node('a', 'A', 'X'), node('b', 'B', 'X')], ['a.out -> b.in', 'b.out -> a.in']);
    const index = buildIndex(top, []);
    const walk = backwardWalk(index, { node: 'b', port: 'in' });

    expect(walk.rowCount).toBeLessThan(20);
    let cycles = 0;
    forEachRow(walk.root, (row) => {
      if (row.truncated === 'cycle') cycles++;
    });
    expect(cycles).toBeGreaterThan(0);
  });

  it('caps a long chain by depth rather than by luck', () => {
    const nodes = [];
    const wires = [];
    for (let i = 0; i < 200; i++) {
      nodes.push(node(`n${i}`, `N${i}`, 'X'));
      if (i > 0) wires.push(`n${i - 1}.out -> n${i}.in`);
    }
    const index = buildIndex(topology(nodes, wires), []);
    const walk = backwardWalk(index, { node: 'n199', port: 'in' }, { maxDepth: 6 });

    expect(walk.rowCount).toBeLessThanOrEqual(8);
    let truncated = false;
    forEachRow(walk.root, (row) => {
      if (row.truncated === 'depth') truncated = true;
    });
    expect(truncated).toBe(true);
  });

  it('renders an event whose node left the dictionary rather than dropping the row', () => {
    // A live trace outlives a graph edit. The row is still a real thing that fired.
    const index = buildIndex({ nodes: {}, edges: CHAIN.edges }, [event('var.Value -> str.input')]);
    const walk = backwardWalk(index, { node: 'txt', port: 'text' });
    expect(labelFor(index, walk.root.ref)).toBe('txt.text');
  });
});

describe('OBS-002 — recording with nothing captured is an answer, not an absence', () => {
  it('reports every hop as never-fired when a recording produced no events at all', () => {
    // ⚠️ The case the feature exists for: press Record, reproduce the bug, and nothing fires.
    // Inferring "is there a trace?" from the event count reports this run as `unknown` — "we
    // know nothing" — when in fact we know the most important thing there is to know.
    const index = buildIndex(CHAIN, [], {}, { recording: true });
    const walk = backwardWalk(index, { node: 'txt', port: 'text' });

    forEachRow(walk.root, (row) => expect(row.status).toBe('never-fired'));
    expect(walk.boundary.map((row) => labelFor(index, row.ref))).toEqual(['cart.Value']);
  });

  it('still says unknown when no recording was made', () => {
    const index = buildIndex(CHAIN, [], {}, { recording: false });
    const walk = backwardWalk(index, { node: 'txt', port: 'text' });
    forEachRow(walk.root, (row) => expect(row.status).toBe('unknown'));
    expect(walk.boundary).toEqual([]);
  });
});
