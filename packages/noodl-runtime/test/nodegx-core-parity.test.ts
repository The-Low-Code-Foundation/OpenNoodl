/**
 * EXP-001 parity: the interpreted runtime and `@nodegx/core` run the same scenario, and the two
 * event sequences are compared.
 *
 * This suite lives in `noodl-runtime` rather than in `nodegx-core` for one reason — this is where
 * the interpreter already runs headlessly, with a typed harness for building graphs. Putting it
 * here costs one relative import; putting it the other way round would have meant a second jest
 * configuration able to compile the runtime's mixed `.js`/`.ts` sources, which is infrastructure
 * nobody needs.
 *
 * Every scenario asserts against a clause of `packages/nodegx-core/CONTRACT.md`, and the assertion
 * that matters in each case is `expect(exported).toEqual(interpreted)` — not a hand-written
 * expectation of what the runtime *ought* to do. Where the two genuinely diverge, the divergence is
 * asserted explicitly rather than papered over, because a documented gap that nothing measures is
 * how the phase's honesty claim would quietly become false.
 */

import type { NodeInstance } from '@noodl/types';

import { derived } from '../../nodegx-core/src/derived';
import { signal } from '../../nodegx-core/src/signal';
import { value } from '../../nodegx-core/src/value';
import { createGraph, type TestGraph, type TestNode } from './helpers/node-harness';

// ---------------------------------------------------------------------------
// The interpreted side: source → transform → sink, the smallest graph that has an
// intermediate computation to get wrong.
// ---------------------------------------------------------------------------

interface SourceNodeInstance extends NodeInstance {
  send(payload: unknown): void;
  fire(): void;
}

/** Records what the sink received, in order, over one graph. */
interface Chain {
  graph: TestGraph;
  source: TestNode<SourceNodeInstance>;
  sink: TestNode;
  /** Values delivered to the sink's value input. */
  values: unknown[];
  /** Every event at the sink, values and signals interleaved, for ordering assertions. */
  events: string[];
  /** Drains the frame, the way the viewer's `requestAnimationFrame` loop would. */
  drain(): void;
}

function buildChain(options: { transform?: (input: number) => number } = {}): Chain {
  const values: unknown[] = [];
  const events: string[] = [];
  const transform = options.transform ?? ((n: number) => n);

  const graph = createGraph(
    {
      node: {
        name: 'parity.Source',
        category: 'Test',
        initialize: function (this: NodeInstance) {
          this._internal.payload = undefined;
        },
        outputs: {
          payload: {
            type: '*',
            getter: function (this: NodeInstance) {
              return this._internal.payload;
            }
          },
          onEvent: { type: 'signal' }
        },
        methods: {
          send(this: NodeInstance, payload: unknown) {
            this._internal.payload = payload;
            this.flagOutputDirty('payload');
          },
          fire(this: NodeInstance) {
            this.sendSignalOnOutput('onEvent');
          }
        }
      }
    },
    {
      node: {
        name: 'parity.Transform',
        category: 'Test',
        initialize: function (this: NodeInstance) {
          this._internal.input = 0;
        },
        inputs: {
          input: {
            type: '*',
            set: function (this: NodeInstance, incoming: unknown) {
              this._internal.input = incoming;
              this.flagOutputDirty('output');
            }
          }
        },
        outputs: {
          output: {
            type: '*',
            getter: function (this: NodeInstance) {
              return transform(this._internal.input as number);
            }
          }
        }
      }
    },
    {
      node: {
        name: 'parity.Sink',
        category: 'Test',
        inputs: {
          input: {
            type: '*',
            set: function (this: NodeInstance, incoming: unknown) {
              values.push(incoming);
              events.push(`value:${String(incoming)}`);
            }
          },
          take: {
            valueChangedToTrue: function () {
              events.push('signal');
            }
          }
        }
      }
    }
  );

  const source = graph.make<SourceNodeInstance>('parity.Source', 'source');
  const transformNode = graph.make('parity.Transform', 'transform');
  const sink = graph.make('parity.Sink', 'sink');

  transformNode.connectInput('input', source, 'payload');
  sink.connectInput('input', transformNode, 'output');
  sink.connectInput('take', source, 'onEvent');

  const drain = () => graph.context.updateDirtyNodes();

  // A node's very first update collapses queued values per port (CONTRACT.md C8), which is a
  // startup path rather than the steady state under test. Warm the graph and discard what it saw.
  source.send(0);
  drain();
  values.length = 0;
  events.length = 0;

  return { graph, source, sink, values, events, drain };
}

describe('C1/C2 — a value chain delivers every write, in order', () => {
  it('matches for distinct values', () => {
    const chain = buildChain({ transform: (n) => n * 2 });

    for (const n of [1, 2, 3]) {
      chain.source.send(n);
      chain.drain();
    }

    const exported: number[] = [];
    const source = value(0);
    const doubled = derived(() => source.get() * 2);
    doubled.subscribe((n) => exported.push(n));
    doubled.get();

    for (const n of [1, 2, 3]) source.set(n);

    expect(exported).toEqual(chain.values);
    expect(exported).toEqual([2, 4, 6]);
  });

  it('matches for repeated identical values — neither side short-circuits', () => {
    // This is the clause a conventional reactive library would get wrong by default, and the
    // reason `Value.set` has no equality check.
    const chain = buildChain();

    for (const n of [5, 5, 5]) {
      chain.source.send(n);
      chain.drain();
    }

    const exported: number[] = [];
    const source = value(0);
    source.subscribe((n) => exported.push(n));

    for (const n of [5, 5, 5]) source.set(n);

    expect(exported).toEqual(chain.values);
    expect(exported).toEqual([5, 5, 5]);
  });

  it('matches when several values are sent inside one frame', () => {
    const chain = buildChain({ transform: (n) => n * 2 });

    chain.source.send(1);
    chain.source.send(2);
    chain.source.send(3);
    chain.drain();

    const exported: number[] = [];
    const source = value(0);
    const doubled = derived(() => source.get() * 2);
    doubled.subscribe((n) => exported.push(n));
    doubled.get();

    source.set(1);
    source.set(2);
    source.set(3);

    expect(exported).toEqual(chain.values);
  });
});

describe('C4 — every pulse fires, and a value lands before the signal that follows it', () => {
  it('matches for two pulses inside one frame', () => {
    const chain = buildChain();

    chain.source.fire();
    chain.source.fire();
    chain.drain();

    let exportedFires = 0;
    const done = signal();
    done.subscribe(() => exportedFires++);
    done.emit();
    done.emit();

    const interpretedFires = chain.events.filter((e) => e === 'signal').length;

    expect(exportedFires).toBe(interpretedFires);
    expect(exportedFires).toBe(2);
  });

  it('matches for the value-then-signal ordering generated code depends on', () => {
    // The agent-chat example's own Function node documents relying on this:
    // "a value output is queued onto the connected input before the signal that follows it".
    const chain = buildChain();

    chain.source.send(42);
    chain.source.fire();
    chain.drain();

    const exported: string[] = [];
    const payload = value(0);
    const done = signal();
    payload.subscribe((n) => exported.push(`value:${n}`));
    done.subscribe(() => exported.push('signal'));

    payload.set(42);
    done.emit();

    expect(exported).toEqual(chain.events);
    expect(exported).toEqual(['value:42', 'signal']);
  });
});

describe('C6 — a diamond is never observed half-updated', () => {
  it('matches: the sink sees one consistent pair, not an intermediate', () => {
    const seen: string[] = [];

    const graph = createGraph(
      {
        node: {
          name: 'parity.Root',
          category: 'Test',
          initialize: function (this: NodeInstance) {
            this._internal.n = 1;
          },
          outputs: {
            n: {
              type: 'number',
              getter: function (this: NodeInstance) {
                return this._internal.n;
              }
            }
          },
          methods: {
            send(this: NodeInstance, n: number) {
              this._internal.n = n;
              this.flagOutputDirty('n');
            }
          }
        }
      },
      {
        node: {
          name: 'parity.Scale',
          category: 'Test',
          initialize: function (this: NodeInstance) {
            this._internal.n = 0;
            this._internal.factor = 1;
          },
          inputs: {
            n: {
              type: 'number',
              set: function (this: NodeInstance, n: number) {
                this._internal.n = n;
                this.flagOutputDirty('out');
              }
            },
            factor: {
              type: 'number',
              set: function (this: NodeInstance, factor: number) {
                this._internal.factor = factor;
              }
            }
          },
          outputs: {
            out: {
              type: 'number',
              getter: function (this: NodeInstance) {
                return (this._internal.n as number) * (this._internal.factor as number);
              }
            }
          }
        }
      },
      {
        node: {
          name: 'parity.Join',
          category: 'Test',
          initialize: function (this: NodeInstance) {
            this._internal.left = 0;
            this._internal.right = 0;
          },
          inputs: {
            left: {
              type: 'number',
              set: function (this: NodeInstance, n: number) {
                this._internal.left = n;
                this.scheduleAfterInputsHaveUpdated(function (this: NodeInstance) {
                  seen.push(`${this._internal.left}/${this._internal.right}`);
                });
              }
            },
            right: {
              type: 'number',
              set: function (this: NodeInstance, n: number) {
                this._internal.right = n;
              }
            }
          }
        }
      }
    );

    const root = graph.make<SourceNodeInstance & { send(n: number): void }>('parity.Root', 'root');
    const doubler = graph.make('parity.Scale', 'doubler');
    const tripler = graph.make('parity.Scale', 'tripler');
    const join = graph.make('parity.Join', 'join');

    doubler.setInputValue('factor', 2);
    tripler.setInputValue('factor', 3);
    doubler.connectInput('n', root, 'n');
    tripler.connectInput('n', root, 'n');
    join.connectInput('left', doubler, 'out');
    join.connectInput('right', tripler, 'out');

    graph.context.updateDirtyNodes();
    seen.length = 0;

    root.send(5);
    graph.context.updateDirtyNodes();

    const exported: string[] = [];
    const source = value(1);
    const left = derived(() => source.get() * 2);
    const right = derived(() => source.get() * 3);
    const joined = derived(() => `${left.get()}/${right.get()}`);
    joined.subscribe((v) => exported.push(v));
    joined.get();

    source.set(5);

    expect(exported).toEqual(seen);
    expect(exported).toEqual(['10/15']);
  });
});

describe('C7 — the documented divergence, measured rather than assumed', () => {
  it('agrees when one value per source arrives per turn', () => {
    const chain = buildChain({ transform: (n) => n + 1 });

    chain.source.send(10);
    chain.drain();
    chain.source.send(20);
    chain.drain();

    const exported: number[] = [];
    const source = value(0);
    const plusOne = derived(() => source.get() + 1);
    plusOne.subscribe((n) => exported.push(n));
    plusOne.get();

    source.set(10);
    source.set(20);

    expect(exported).toEqual(chain.values);
  });

  it('records what the interpreter does with a burst, so a future change to either side is visible', () => {
    // The interpreter queues per port and drains one entry per port per pass; the library delivers
    // synchronously. For a single-source chain the observable sequence is the same, which is what
    // this asserts. The gap CONTRACT.md C7 describes needs *two* sources feeding one node inside one
    // frame to appear, and EXP-003's harness on real projects is where that gets quantified — this
    // test exists so the single-source case cannot silently regress in the meantime.
    const chain = buildChain({ transform: (n) => n * 10 });

    for (const n of [1, 2, 3, 4, 5]) chain.source.send(n);
    chain.drain();

    const exported: number[] = [];
    const source = value(0);
    const scaled = derived(() => source.get() * 10);
    scaled.subscribe((n) => exported.push(n));
    scaled.get();

    for (const n of [1, 2, 3, 4, 5]) source.set(n);

    expect(exported).toEqual(chain.values);
    expect(chain.values).toEqual([10, 20, 30, 40, 50]);
  });
});
