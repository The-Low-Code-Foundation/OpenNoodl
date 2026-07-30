/**
 * NDA-012 — the citations for the five-small-categories batch: Component Utilities,
 * Utilities, CustomCode, Animation and Cloud.
 *
 * Most of those worksheets are answerable from the source. These are the claims that are not,
 * and the phase's rule is that an uncited ⚠️ is a suspicion.
 *
 * ## 1. `Date To String`'s `Invalid Date` signal had never fired — **FIXED**
 *
 * `_format`'s catch called `flagOutputDirty('onError')`, which PLAT-003 NOTES §25 recorded as
 * a curiosity kept verbatim. It is not a curiosity. `flagOutputDirty` is
 * `sendValue(name, output.value)` (`node.ts:647-650`) and a signal output's `value` is
 * `undefined`, so receivers got a *value* of `undefined` on a signal input rather than the
 * pulse `sendPulse` delivers. The node's only failure surface was inert since it was written.
 *
 * ## 2. `Component Object` read a hyphenated property from the wrong key — **FIXED**
 *
 * `registerOutputIfNeeded` took the **last** `-` segment of the port name while
 * `registerInputIfNeeded` stripped the `value-` prefix. With a property called `first-name`
 * the input wrote `first-name` into the record and the output read `name`: one node, one
 * property, a writer and a reader on two different keys.
 *
 * ## 3. `Function` was mute when its script would not compile — **FIXED**
 *
 * NDA-004 §3 gave the node `Success`/`Failure`/`Error` for a script that *throws* and left the
 * script that does not *parse* exactly as it was — swallowed into a `console.log`, `Run`
 * returning without a sound. The Expression node had the identical defect and NDA-004 fixed it
 * there (`expression.ts:189-196`); these are the library's two script hosts and had no reason
 * to differ.
 *
 * ## 4. A running timer outlived the node that owned it — **FIXED, four sites, one shape**
 *
 * `TimerScheduler` keeps a running timer in `runningTimers` until something stops it, and
 * deleting a node does not. `Delay` has had a delete listener since it was written
 * (`timer.ts:38-40`); `Animate To Value`, `Transition`, `States` and `Animation` never got
 * one, so a node deleted mid-animation kept being ticked every frame — flagging outputs dirty
 * on a dead node and holding the instance reachable through the scheduler. Counted once with
 * four sites, per NDA-012's shared-helper rule.
 *
 * ## 5. The `setup` harness is shared now
 *
 * The Component Utilities rows below are the first users of
 * [`setup-harness.ts`](./setup-harness.ts), which replaces the three hand-rolled copies that
 * NDA-009, NDA-010 and NDA-012's Navigation file each grew. Six of Navigation's fifteen
 * defects lived in editor-time `setup` code, so this is where the next ones are.
 */

/* eslint-env jest */

import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph, type CorpusNode } from './graph-harness';
import { driveSetup } from './setup-harness';

import DateToStringNode = require('../../src/nodes/std-library/datetostring');
import SimpleJavascriptNode = require('../../src/nodes/std-library/simplejavascript');

import ComponentObjectModule from '../../../noodl-viewer-react/src/nodes/std-library/componentutils/componentobject';
import AnimateToValueModule from '../../../noodl-viewer-react/src/nodes/std-library/animate-to-value';
import StatesModule from '../../../noodl-viewer-react/src/nodes/std-library/states';

/** Feeds one value at one port of the node under test, the way a connection would. */
const TriggerModule: NodeModule = {
  node: {
    name: 'corpus.Trigger',
    category: 'Corpus',
    outputs: {
      value: {
        type: '*',
        getter: function (this: NodeInstance) {
          return this._internal.value;
        }
      },
      go: { type: 'signal' }
    },
    methods: {
      send(this: NodeInstance, value: unknown) {
        this._internal.value = value;
        this.flagOutputDirty('value');
      },
      go(this: NodeInstance) {
        this.sendSignalOnOutput('go');
      }
    }
  }
};

interface TriggerInstance extends NodeInstance {
  send(value: unknown): void;
  go(): void;
}

/** Counts signals arriving on a wire, which is the only way to see a *pulse* rather than a value. */
const WatcherModule: NodeModule = {
  node: {
    name: 'corpus.Watcher',
    category: 'Corpus',
    initialize(this: NodeInstance) {
      this._internal.pulses = 0;
      this._internal.values = [];
    },
    inputs: {
      pulse: {
        type: 'signal',
        valueChangedToTrue(this: NodeInstance) {
          (this._internal.pulses as number)++;
        }
      },
      value: {
        type: '*',
        set(this: NodeInstance, value: unknown) {
          (this._internal.values as unknown[]).push(value);
        }
      }
    }
  }
};

interface WatcherInstance extends NodeInstance {
  _internal: { pulses: number; values: unknown[] };
}

/* ------------------------------------------------------------------ *
 * 1. Date To String — the Invalid Date signal
 * ------------------------------------------------------------------ */

describe('NDA-012 — Utilities: Date To String reports an invalid date', () => {
  /**
   * `Invalid Date` is wired to a watcher's *signal* input, deliberately. Asserting on the
   * node's own `sendSignalOnOutput` log would pass for the old code too if the old code had
   * called it; what distinguishes the defect is whether a receiver saw a **pulse**, and only a
   * wire can answer that.
   */
  async function graphWithDate(): Promise<CorpusGraph> {
    return createCorpusGraph({
      modules: [TriggerModule, WatcherModule, DateToStringNode as unknown as NodeModule],
      rootComponent: '/root',
      data: {
        components: [
          {
            name: '/root',
            nodes: [
              { id: 'trigger', type: 'corpus.Trigger' },
              { id: 'd2s', type: 'Date To String' },
              { id: 'watcher', type: 'corpus.Watcher' }
            ],
            connections: [
              { sourceId: 'trigger', sourcePort: 'value', targetId: 'd2s', targetPort: 'input' },
              { sourceId: 'd2s', sourcePort: 'onError', targetId: 'watcher', targetPort: 'pulse' }
            ]
          }
        ]
      } as never
    });
  }

  it('delivers Invalid Date as a pulse when the date cannot be formatted', async () => {
    const graph = await graphWithDate();
    // `null` is a value a connection genuinely delivers — the Empty-Value Contract's "clears"
    // case — and `getDate()` on it throws, which is the branch under test.
    graph.node<TriggerInstance>('trigger').send(null);
    await graph.settle(3);

    expect(graph.node<WatcherInstance>('watcher')._internal.pulses).toBe(1);
  });

  it('blanks Date String rather than emitting half a formatted date', async () => {
    const graph = await graphWithDate();
    graph.node<TriggerInstance>('trigger').send(null);
    await graph.settle(3);

    expect(graph.node('d2s').getOutput('currentValue').value).toBe('');
  });

  /**
   * The control. Without it the row above would pass for a node that pulsed `Invalid Date` on
   * every set, which is the obvious wrong fix.
   */
  it('does not pulse Invalid Date for a date it can format', async () => {
    const graph = await graphWithDate();
    graph.node<TriggerInstance>('trigger').send(new Date(2026, 6, 30));
    await graph.settle(3);

    expect(graph.node<WatcherInstance>('watcher')._internal.pulses).toBe(0);
    expect(graph.node('d2s').getOutput('currentValue').value).toBe('2026-07-30');
  });
});

/* ------------------------------------------------------------------ *
 * 2. Function — a script that will not compile
 * ------------------------------------------------------------------ */

describe('NDA-012 — CustomCode: Function reports a script it cannot compile', () => {
  async function graphWithScript(functionScript: string | undefined): Promise<CorpusGraph> {
    const graph = await createCorpusGraph({
      modules: [TriggerModule, SimpleJavascriptNode as unknown as NodeModule],
      rootComponent: '/root',
      data: {
        components: [
          {
            name: '/root',
            nodes: [
              { id: 'trigger', type: 'corpus.Trigger' },
              {
                id: 'fn',
                type: 'JavaScriptFunction',
                parameters: functionScript === undefined ? {} : { functionScript }
              }
            ],
            connections: [{ sourceId: 'trigger', sourcePort: 'go', targetId: 'fn', targetPort: 'run' }]
          }
        ]
      } as never
    });
    await graph.settle(3);
    return graph;
  }

  it('fires Failure when Run is pressed on a script with a syntax error', async () => {
    const graph = await graphWithScript('this is not javascript {');
    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(3);

    expect(graph.signalsFor('fn')).toContain('failure');
  });

  it('names the syntax error on Error rather than sending a bare Failure', async () => {
    const graph = await graphWithScript('this is not javascript {');
    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(3);

    expect(String(graph.node('fn').getOutput('error').value || '')).not.toBe('');
    expect(graph.errors.map((e) => e.code)).toContain('function/script-not-compiled');
  });

  it('stays silent for a node with no script at all', async () => {
    const graph = await graphWithScript(undefined);
    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(3);

    expect(graph.signalsFor('fn')).not.toContain('failure');
  });

  /**
   * The control that stops the rows above from passing for the wrong reason: a script that
   * *does* compile must still reach `Success`, i.e. the new early return has not swallowed the
   * happy path.
   */
  it('still runs a script that compiles', async () => {
    const graph = await graphWithScript('Outputs.answer = 42;');
    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(4);

    expect(graph.signalsFor('fn')).toContain('success');
    expect(graph.signalsFor('fn')).not.toContain('failure');
  });

  it('raises a repeated syntax error once, not once per Run', async () => {
    const graph = await graphWithScript('this is not javascript {');
    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(3);
    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(3);

    expect(graph.errors.filter((e) => e.code === 'function/script-not-compiled')).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ *
 * 3. Component Object — a hyphenated property name
 * ------------------------------------------------------------------ */

describe('NDA-012 — Component Utilities: Component Object and a hyphenated property', () => {
  /**
   * The port names come from `updatePorts` rather than being hard-coded here, so if the
   * `value-`/`changed-` convention ever moves this fails loudly instead of testing a scheme
   * nothing uses. First user of the shared `setup` harness.
   */
  it('publishes value- and changed- ports named after the property', () => {
    const setup = driveSetup({
      module: ComponentObjectModule,
      type: 'net.noodl.ComponentObject',
      nodes: [{ id: 'co-1', parameters: { properties: 'first-name' } }]
    });

    expect(setup.portNames()).toEqual(expect.arrayContaining(['value-first-name', 'changed-first-name']));
  });

  async function graphWithProperty(property: string): Promise<CorpusGraph> {
    const graph = await createCorpusGraph({
      modules: [TriggerModule, WatcherModule, ComponentObjectModule as unknown as NodeModule],
      rootComponent: '/root',
      data: {
        components: [
          {
            name: '/root',
            nodes: [
              { id: 'trigger', type: 'corpus.Trigger' },
              { id: 'co', type: 'net.noodl.ComponentObject', parameters: { properties: property } },
              { id: 'watcher', type: 'corpus.Watcher' }
            ],
            connections: [
              { sourceId: 'trigger', sourcePort: 'value', targetId: 'co', targetPort: 'value-' + property },
              { sourceId: 'co', sourcePort: 'value-' + property, targetId: 'watcher', targetPort: 'value' }
            ]
          }
        ]
      } as never
    });
    await graph.settle(3);
    return graph;
  }

  it('reads back what it wrote for a property whose name contains a hyphen', async () => {
    const graph = await graphWithProperty('first-name');
    graph.node<TriggerInstance>('trigger').send('Ada');
    await graph.settle(4);

    expect(graph.node('co').getOutput('value-first-name').value).toBe('Ada');
  });

  /**
   * The control. A property without a hyphen behaved correctly before the fix — for those the
   * last `-` segment *is* the whole name — which is exactly why this survived since the node
   * was written. Restore `name.split('-')` and only the row above reddens.
   */
  it('still reads back a property with no hyphen in it', async () => {
    const graph = await graphWithProperty('title');
    graph.node<TriggerInstance>('trigger').send('Lovelace');
    await graph.settle(4);

    expect(graph.node('co').getOutput('value-title').value).toBe('Lovelace');
  });
});

/* ------------------------------------------------------------------ *
 * 4. Animation — a deleted node stops its timer
 * ------------------------------------------------------------------ */

describe('NDA-012 — Animation: a deleted node stops its timer', () => {
  /** Timers the scheduler is still holding, queued or running. */
  function pendingTimers(graph: CorpusGraph): number {
    const scheduler = graph.context.timerScheduler as unknown as {
      newTimers: unknown[];
      runningTimers: unknown[];
    };
    return scheduler.newTimers.length + scheduler.runningTimers.length;
  }

  async function graphWith(type: string, parameters: Record<string, unknown>): Promise<CorpusGraph> {
    const graph = await createCorpusGraph({
      modules: [TriggerModule, AnimateToValueModule as unknown as NodeModule, StatesModule as unknown as NodeModule],
      rootComponent: '/root',
      data: {
        components: [
          {
            name: '/root',
            nodes: [
              { id: 'trigger', type: 'corpus.Trigger' },
              { id: 'anim', type, parameters }
            ],
            connections: [{ sourceId: 'trigger', sourcePort: 'value', targetId: 'anim', targetPort: 'targetValue' }]
          }
        ]
      } as never
    });
    await graph.settle(2);
    return graph;
  }

  it('Animate To Value leaves no timer behind when it is deleted mid-animation', async () => {
    const graph = await graphWith('net.noodl.animatetovalue', {});

    // The first value is adopted rather than animated to; the second starts the timer.
    graph.node<TriggerInstance>('trigger').send(0);
    await graph.settle(2);
    graph.node<TriggerInstance>('trigger').send(100);
    await graph.settle(1);

    expect(pendingTimers(graph)).toBe(1);

    (graph.node('anim') as CorpusNode)._onNodeDeleted();

    expect(pendingTimers(graph)).toBe(0);
  });

  /**
   * Not part of the leak, but the crash sitting next to it: the `values` setter called
   * `value.split` unguarded where its sibling `states` has always had a falsy check, so
   * emptying the Values list threw out of an input setter.
   */
  it('States survives its Values list being emptied', async () => {
    const graph = await createCorpusGraph({
      modules: [StatesModule as unknown as NodeModule],
      rootComponent: '/root',
      data: {
        components: [
          {
            name: '/root',
            nodes: [{ id: 'states', type: 'States', parameters: { states: 'a,b', values: 'x,y' } }]
          }
        ]
      } as never
    });
    await graph.settle(2);

    expect(() => graph.node('states').setInputValue('values', undefined)).not.toThrow();
  });
});
