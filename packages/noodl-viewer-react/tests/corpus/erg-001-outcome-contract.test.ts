/**
 * ERG-001 §1/§2 — the outcome contract, and the Array family as its reference implementation.
 *
 * See `dev-docs/reference/OUTCOME-CONTRACT.md` for the decision and
 * `dev-docs/tasks/phase-35-authoring-ergonomics/ERG-001-S0-MEASUREMENT.md` for the ground these
 * rows were chosen from.
 *
 * Every action ends in **exactly one** of `Done` / `Unchanged` / `Failure`, and every action also
 * emits **`Completed`** afterwards, unconditionally. The Array family is where the contract is
 * built first because it contains the case that raised it: `Array.prototype.add` early-returns
 * when the array already holds the item (`collection.ts:594`), and the node signalled `Done` both
 * times — so "add to cart, then animate the new row" animated a row that did not appear.
 *
 * ## What these rows pin, and what reverting reddens
 *
 * Predicted before running, per the phase's discrimination standard:
 *
 * | Revert | Reddens |
 * |---|---|
 * | the `unchanged` port on Insert | the duplicate rows, not the first-insert rows |
 * | the `completed` emit in `reportOutcome` | every `completed` row in the file, all families at once |
 * | the `done` rename | every row naming `done`; the old `modified` name is asserted *absent* so the rename cannot pass vacuously |
 * | the duplicate guard in `reportOutcome` | only `emits exactly one outcome per invocation` |
 *
 * ## ⚠️ The rename these rows also guard
 *
 * `modified` / `created` / `stored` / `done` were **four internal names for one display name**
 * (§0.2 Result 2). They are unified on `done`. `nda-004-array-mutators.test.ts` asserted
 * `not.toContain('modified')`, which would pass vacuously once the port no longer exists — those
 * rows were renamed in the same commit rather than left to rot into false green.
 */

/* eslint-env jest */

import Collection from '@noodl/runtime/src/collection';
import Model from '@noodl/runtime/src/model';
import type { CollectionLike, NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from '../../../noodl-runtime/test/corpus/graph-harness';

import CollectionClearModule = require('@noodl/runtime/src/nodes/std-library/data/collectionnode-clear');
import CollectionInsertModule = require('@noodl/runtime/src/nodes/std-library/data/collectionnode-insert');
import CollectionNewModule = require('@noodl/runtime/src/nodes/std-library/data/collectionnode-new');
import CollectionRemoveModule = require('@noodl/runtime/src/nodes/std-library/data/collectionnode-remove');
import ComponentObjectModule = require('@noodl/runtime/src/nodes/std-library/componentutils/componentobject');
import SetComponentObjectPropertiesModule = require('@noodl/runtime/src/nodes/std-library/componentutils/setcomponentobjectproperties');
import SetParentComponentObjectPropertiesModule from '../../src/nodes/std-library/componentutils/setparentcomponentobjectproperties';
import { GroupModule } from './visual-container';
import SwitchModule = require('@noodl/runtime/src/nodes/std-library/switch');
import TimerModule from '../../src/nodes/std-library/timer';

/** `Collection.get(name)` is a process-wide registry, so every row needs its own array. */
let arrayCounter = 0;
const freshArrayId = () => 'erg001-array-' + ++arrayCounter;

let objectCounter = 0;
const freshObjectId = () => 'erg001-object-' + ++objectCounter;

interface TriggerInstance extends NodeInstance {
  go(): void;
  send(value: unknown): void;
}

const TriggerModule: NodeModule = {
  node: {
    name: 'corpus.Trigger',
    category: 'Corpus',
    outputs: {
      go: { type: 'signal' },
      value: {
        type: '*',
        getter: function (this: NodeInstance) {
          return this._internal.value;
        }
      }
    },
    methods: {
      go(this: NodeInstance) {
        this.sendSignalOnOutput('go');
      },
      send(this: NodeInstance, value: unknown) {
        this._internal.value = value;
        this.flagOutputDirty('value');
      }
    }
  }
};

const MUTATOR = {
  insert: { type: 'CollectionInsert', doPort: 'add' },
  remove: { type: 'CollectionRemove', doPort: 'remove' },
  clear: { type: 'CollectionClear', doPort: 'clear' },
  new: { type: 'CollectionNew', doPort: 'new' }
} as const;

type MutatorKind = keyof typeof MUTATOR;

async function mutatorGraph(kind: MutatorKind, arrayId: string): Promise<CorpusGraph> {
  const spec = MUTATOR[kind];
  const connections: Array<Record<string, string>> = [
    { sourceId: 'trigger', sourcePort: 'go', targetId: 'mutator', targetPort: spec.doPort }
  ];
  if (kind === 'insert' || kind === 'remove') {
    connections.push({ sourceId: 'objectId', sourcePort: 'value', targetId: 'mutator', targetPort: 'modifyId' });
  }

  const graph = await createCorpusGraph({
    modules: [
      TriggerModule,
      CollectionInsertModule as unknown as NodeModule,
      CollectionRemoveModule as unknown as NodeModule,
      CollectionClearModule as unknown as NodeModule,
      CollectionNewModule as unknown as NodeModule
    ],
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            { id: 'trigger', type: 'corpus.Trigger' },
            { id: 'objectId', type: 'corpus.Trigger' },
            { id: 'mutator', type: spec.type, parameters: { collectionId: arrayId } }
          ],
          connections
        }
      ]
    } as never
  });

  await graph.settle(4);
  return graph;
}

async function pressDo(graph: CorpusGraph, objectId?: string): Promise<void> {
  if (objectId !== undefined) graph.node<TriggerInstance>('objectId').send(objectId);
  graph.node<TriggerInstance>('trigger').go();
  await graph.settle(4);
}

/** The signals a node sent, with the lifecycle noise a row never asserts on removed. */
function outcomesOf(graph: CorpusGraph, id: string): string[] {
  return graph.signalsFor(id).filter((s) => s === 'done' || s === 'unchanged' || s === 'failure');
}

// =================================================================================================
// §2 — Insert Object Into Array, the worked example
// =================================================================================================

describe('ERG-001 §2: Insert Object Into Array', () => {
  test('a first insert reports Done, and Completed after it', async () => {
    const arrayId = freshArrayId();
    const graph = await mutatorGraph('insert', arrayId);
    await pressDo(graph, freshObjectId());

    const signals = graph.signalsFor('mutator');
    expect(outcomesOf(graph, 'mutator')).toEqual(['done']);
    expect(signals).toContain('completed');
    // The rename cannot pass vacuously: the old wire name must be gone, not merely unasserted.
    expect(signals).not.toContain('modified');
    expect(Collection.get(arrayId).length).toBe(1);
  });

  test('Completed fires *after* Done, never before the outcome it follows', async () => {
    const graph = await mutatorGraph('insert', freshArrayId());
    await pressDo(graph, freshObjectId());

    const signals = graph.signalsFor('mutator');
    expect(signals.indexOf('completed')).toBeGreaterThan(signals.indexOf('done'));
  });

  test('a duplicate insert reports Unchanged, not Done', async () => {
    const arrayId = freshArrayId();
    const objectId = freshObjectId();
    const graph = await mutatorGraph('insert', arrayId);

    await pressDo(graph, objectId);
    expect(outcomesOf(graph, 'mutator')).toEqual(['done']);

    // The same Object Id a second time. `Array.prototype.add` early-returns on `contains`, so
    // the array is unchanged — and the node used to say `Done` anyway. This is Richard's case.
    await pressDo(graph, objectId);
    expect(outcomesOf(graph, 'mutator')).toEqual(['done', 'unchanged']);
    expect(Collection.get(arrayId).length).toBe(1);
  });

  test('a duplicate insert still emits Completed, so the chain carries on', async () => {
    const objectId = freshObjectId();
    const graph = await mutatorGraph('insert', freshArrayId());

    await pressDo(graph, objectId);
    await pressDo(graph, objectId);

    // Two invocations, two Completeds — this is the whole point of the port. An author who
    // wired Completed rather than Done gets both pulses regardless of the outcome.
    expect(graph.signalsFor('mutator').filter((s) => s === 'completed').length).toBe(2);
  });

  test('Unchanged is not a failure and raises nothing on the error channel', async () => {
    const objectId = freshObjectId();
    const graph = await mutatorGraph('insert', freshArrayId());

    await pressDo(graph, objectId);
    const before = graph.errors.length;
    await pressDo(graph, objectId);

    // "`Unchanged` does not raise; it is not an error" — ERG-001 §1.
    // ⚠️ The positive assertion is load-bearing: without it every clause here is an absence,
    // and the row passed before any of this was built.
    expect(outcomesOf(graph, 'mutator')).toEqual(['done', 'unchanged']);
    expect(graph.errors.length).toBe(before);
    expect(outcomesOf(graph, 'mutator')).not.toContain('failure');
  });

  test('a Failure still reports on the NDA-004 channel, and Completed follows it too', async () => {
    const graph = await mutatorGraph('insert', freshArrayId());
    // No Object Id ever sent: the node's own no-object-id failure path.
    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(4);

    const signals = graph.signalsFor('mutator');
    expect(outcomesOf(graph, 'mutator')).toEqual(['failure']);
    expect(signals).toContain('completed');
    expect(signals.indexOf('completed')).toBeGreaterThan(signals.indexOf('failure'));
    expect(graph.errors.map((e) => e.code)).toContain('insert-into-array/no-object-id');
  });
});

// =================================================================================================
// §2 — Remove Object From Array: the third path §0 found, which the spec's note does not cover
// =================================================================================================

describe('ERG-001 §2: Remove Object From Array', () => {
  test('removing a member reports Done', async () => {
    const arrayId = freshArrayId();
    const objectId = freshObjectId();
    const collection = Collection.get(arrayId) as CollectionLike;
    collection.add(Model.get(objectId));

    const graph = await mutatorGraph('remove', arrayId);
    await pressDo(graph, objectId);

    expect(outcomesOf(graph, 'mutator')).toEqual(['done']);
    expect(Collection.get(arrayId).length).toBe(0);
  });

  test('removing a loaded object that is not in this array reports Unchanged, not Done', async () => {
    const arrayId = freshArrayId();
    const memberId = freshObjectId();
    const strangerId = freshObjectId();

    const collection = Collection.get(arrayId) as CollectionLike;
    collection.add(Model.get(memberId));
    // `Model.exists` must be true or the node takes DA-vi's *failure* path instead: an id
    // nothing has loaded is impossible to remove, which is a different verdict on purpose.
    Model.get(strangerId).set('loaded', true);

    const graph = await mutatorGraph('remove', arrayId);
    await pressDo(graph, strangerId);

    // `Array.prototype.remove` is `if (idx !== -1) …` (`collection.ts:611`) — a silent no-op the
    // node reported as `Done`. Redundant, not impossible: `Unchanged`.
    expect(outcomesOf(graph, 'mutator')).toEqual(['unchanged']);
    expect(graph.signalsFor('mutator')).toContain('completed');
    expect(Collection.get(arrayId).length).toBe(1);
  });

  test('an id nothing has loaded is still a Failure, not Unchanged', async () => {
    const graph = await mutatorGraph('remove', freshArrayId());
    await pressDo(graph, 'erg001-never-loaded');

    // DA-vi's verdict stands and this row is what keeps `Unchanged` from swallowing it.
    expect(outcomesOf(graph, 'mutator')).toEqual(['failure']);
    expect(graph.signalsFor('mutator')).toContain('completed');
  });
});

// =================================================================================================
// §2 — Clear Array and Create New Array
// =================================================================================================

describe('ERG-001 §2: Clear Array', () => {
  test('clearing a populated array reports Done', async () => {
    const arrayId = freshArrayId();
    (Collection.get(arrayId) as CollectionLike).add(Model.get(freshObjectId()));

    const graph = await mutatorGraph('clear', arrayId);
    await pressDo(graph);

    expect(outcomesOf(graph, 'mutator')).toEqual(['done']);
    expect(graph.signalsFor('mutator')).toContain('completed');
  });

  test('clearing an already-empty array reports Unchanged', async () => {
    const arrayId = freshArrayId();
    Collection.get(arrayId);

    const graph = await mutatorGraph('clear', arrayId);
    await pressDo(graph);

    // The post-condition already held. Not a failure — the author asked for an empty array and
    // has one — and not a `Done`, which would claim a change no listener will observe.
    expect(outcomesOf(graph, 'mutator')).toEqual(['unchanged']);
    expect(graph.signalsFor('mutator')).toContain('completed');
  });
});

describe('ERG-001 §2: Create New Array', () => {
  test('reports Done and Completed, and keeps no Failure port it cannot use', async () => {
    const graph = await mutatorGraph('new', freshArrayId());
    await pressDo(graph);

    expect(outcomesOf(graph, 'mutator')).toEqual(['done']);
    expect(graph.signalsFor('mutator')).toContain('completed');
    // "A node that cannot fail gets no `Failure` port" — the contract's own exemption, and the
    // mistake this phase made once already and corrected.
    expect(graph.node('mutator').hasOutput('failure')).toBe(false);
    expect(graph.signalsFor('mutator')).not.toContain('created');
  });
});

// =================================================================================================
// §4 — the Component Object writers, the viewer half of the `stored` -> `done` rename
// =================================================================================================

/**
 * `/root` → `/Inner`, so the parent variant has an ancestor to walk to (or not).
 *
 * `owners` names the components that get a Component Object node. Pass `[]` and the parent
 * variant has nothing to write to, which is the NDA-004 §2 failure path — kept here because
 * §4's addition is precisely that **`Completed` now follows that failure too**, and a row that
 * only exercised the happy path could not see it.
 */
async function componentObjectGraph(owners: string[]): Promise<CorpusGraph> {
  const objectNodeFor = (component: string) =>
    owners.indexOf(component) !== -1
      ? [{ id: component + '-object', type: 'net.noodl.ComponentObject', parameters: { properties: 'title' } }]
      : [];

  const graph = await createCorpusGraph({
    modules: [
      GroupModule,
      TriggerModule,
      ComponentObjectModule as unknown as NodeModule,
      SetComponentObjectPropertiesModule,
      SetParentComponentObjectPropertiesModule
    ],
    rootComponent: '/root',
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            { id: 'root-group', type: 'Group', children: [{ id: 'inner-instance', type: '/Inner' }] },
            ...objectNodeFor('/root')
          ]
        },
        {
          name: '/Inner',
          nodes: [
            { id: 'trigger', type: 'corpus.Trigger' },
            { id: 'own-object', type: 'net.noodl.ComponentObject', parameters: { properties: 'title' } },
            { id: 'self', type: 'net.noodl.SetComponentObjectProperties', parameters: { properties: 'title' } },
            {
              id: 'parent',
              type: 'net.noodl.SetParentComponentObjectProperties',
              parameters: { properties: 'title' }
            }
          ],
          connections: [
            { sourceId: 'trigger', sourcePort: 'value', targetId: 'self', targetPort: 'prop-title' },
            { sourceId: 'trigger', sourcePort: 'go', targetId: 'self', targetPort: 'store' },
            { sourceId: 'trigger', sourcePort: 'value', targetId: 'parent', targetPort: 'prop-title' },
            { sourceId: 'trigger', sourcePort: 'go', targetId: 'parent', targetPort: 'store' }
          ]
        }
      ]
    } as never
  });

  await graph.settle(4);
  return graph;
}

async function pressStore(graph: CorpusGraph, value: unknown): Promise<void> {
  const trigger = graph.node<TriggerInstance>('trigger');
  trigger.send(value);
  trigger.go();
  await graph.settle(4);
}

describe('ERG-001 §4: Set Component Object Properties (self variant)', () => {
  test('reports Done on the contract wire name, then Completed', async () => {
    const graph = await componentObjectGraph(['/root']);
    await pressStore(graph, 'hello');

    const signals = graph.signalsFor('self');
    expect(outcomesOf(graph, 'self')).toEqual(['done']);
    expect(signals.indexOf('completed')).toBeGreaterThan(signals.indexOf('done'));
    // The rename cannot pass vacuously.
    expect(signals).not.toContain('stored');
    expect(graph.node('self').hasOutput('stored')).toBe(false);
  });

  test('still has no Failure port, because it cannot miss its own record', async () => {
    const graph = await componentObjectGraph([]);

    // NDA-004's 🔵 verdict, and the row that stops a mechanical sweep "finishing the family
    // off". `Completed` is the one port with no exemption; `Failure` is not that port.
    expect(graph.node('self').hasOutput('failure')).toBe(false);
    expect(graph.node('self').hasOutput('unchanged')).toBe(false);
    expect(graph.node('self').hasOutput('completed')).toBe(true);
  });
});

describe('ERG-001 §4: Set Parent Component Object Properties', () => {
  test('a real ancestor reports Done on the contract wire name, then Completed', async () => {
    const graph = await componentObjectGraph(['/root']);
    await pressStore(graph, 'hello');

    const signals = graph.signalsFor('parent');
    expect(outcomesOf(graph, 'parent')).toEqual(['done']);
    expect(signals.indexOf('completed')).toBeGreaterThan(signals.indexOf('done'));
    expect(signals).not.toContain('stored');
  });

  test('⚠️ no ancestor to write to still reports Failure — and now Completed follows it', async () => {
    const graph = await componentObjectGraph([]);
    await pressStore(graph, 'hello');

    const signals = graph.signalsFor('parent');
    expect(outcomesOf(graph, 'parent')).toEqual(['failure']);
    // The half §4 adds. Before this the chain died here for an author who wanted to carry on
    // regardless, and this is the node that used to report *success* for the same write.
    expect(signals).toContain('completed');
    expect(signals.indexOf('completed')).toBeGreaterThan(signals.indexOf('failure'));
    expect(graph.errors.map((e) => e.code)).toContain('set-parent-component-object-properties/no-ancestor');
  });
});

// =================================================================================================
// §4 — §0.3's Unchanged register, the two entries that live in this package
// =================================================================================================

/**
 * `Counter` and `Undo / Redo` are pinned in
 * `packages/noodl-runtime/test/corpus/erg-001-unchanged-register.test.ts`; `Switch` and `Timer`
 * are here because that is where they live. Same register, same shape: a legitimate no-op that
 * emitted **nothing**, so it was a dead chain as well as a missing outcome.
 */
async function actionGraph(
  module: NodeModule,
  type: string,
  port: string,
  parameters: Record<string, unknown> = {}
): Promise<CorpusGraph> {
  const graph = await createCorpusGraph({
    modules: [TriggerModule, module],
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            { id: 'trigger', type: 'corpus.Trigger' },
            { id: 'target', type, parameters }
          ],
          connections: [{ sourceId: 'trigger', sourcePort: 'go', targetId: 'target', targetPort: port }]
        }
      ]
    } as never
  });

  await graph.settle(4);
  return graph;
}

describe('ERG-001 §4: Switch already in that state', () => {
  test('On when already on reports Unchanged, where it used to report nothing at all', async () => {
    const graph = await actionGraph(SwitchModule as unknown as NodeModule, 'Switch', 'on');

    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(3);
    expect(outcomesOf(graph, 'target')).toEqual(['done']);

    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(3);

    // `switch.ts:35-37` was a bare `return`, and none of `Switched`, `Switched To On` or
    // `Switched To Off` fires either — all three are about a *change*. So an idempotent `On`,
    // which is the common case, stopped the chain dead.
    expect(outcomesOf(graph, 'target')).toEqual(['done', 'unchanged']);
    expect(graph.signalsFor('target').filter((s) => s === 'completed').length).toBe(2);
    expect(graph.errors).toEqual([]);
  });

  test('(control) a real flip still fires Switched and reports Done', async () => {
    const graph = await actionGraph(SwitchModule as unknown as NodeModule, 'Switch', 'on');

    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(3);

    expect(outcomesOf(graph, 'target')).toEqual(['done']);
    expect(graph.signalsFor('target')).toContain('switched');
    expect(graph.signalsFor('target')).toContain('switchedToOn');
  });

  test('Flip cannot no-op, so it always reports Done', async () => {
    const graph = await actionGraph(SwitchModule as unknown as NodeModule, 'Switch', 'flip');

    for (let i = 0; i < 3; i++) {
      graph.node<TriggerInstance>('trigger').go();
      await graph.settle(3);
    }

    // The three actions share one body; this is what stops that sharing from giving `Flip` an
    // `Unchanged` it can never legitimately report.
    expect(outcomesOf(graph, 'target')).toEqual(['done', 'done', 'done']);
  });
});

/**
 * Run one scheduler frame.
 *
 * ⚠️ Needed, and the reason is a real property of this runtime rather than a test artefact:
 * `Timer.start()` only *queues* into `newTimers`, and `_isRunning` is set to `true` inside
 * `runTimers` (`timerscheduler.ts:181`). The corpus harness drives graph updates, not animation
 * frames, so without this a started timer never becomes a running one and the node's `Start`
 * guard — which reads `_isRunning` — would answer "not running" for a timer it had just
 * started. Driving the real scheduler is the honest way to reach the state under test; setting
 * `_isRunning` by hand would be asserting against a fake.
 */
function runTimerFrame(graph: CorpusGraph, atMs: number): void {
  (graph.context as unknown as { timerScheduler: { runTimers(t: number): void } }).timerScheduler.runTimers(atMs);
}

describe('ERG-001 §4: Timer Start on a running timer', () => {
  test('Start while one is already running reports Unchanged', async () => {
    // ⚠️ The duration is load-bearing. `Duration` defaults to 0, and a zero-length countdown
    // has already finished by the time the second `Start` arrives — so the node correctly
    // reports `done` twice and the row would be measuring the default, not the no-op.
    const graph = await actionGraph(TimerModule as unknown as NodeModule, 'Timer', 'start', { duration: 60000 });

    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(3);
    expect(outcomesOf(graph, 'target')).toEqual(['done']);

    // One frame, so the queued timer actually becomes a running one.
    runTimerFrame(graph, 0);

    // `timer.ts:53-55` is `if (_isRunning === false) start()` — the else was a silent nothing,
    // and `Started` does not re-fire for a countdown already under way.
    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(3);

    expect(outcomesOf(graph, 'target')).toEqual(['done', 'unchanged']);
    expect(graph.signalsFor('target').filter((s) => s === 'completed').length).toBe(2);
  });

  test('(control) Restart cannot no-op and reports Done every time', async () => {
    const graph = await actionGraph(TimerModule as unknown as NodeModule, 'Timer', 'restart', { duration: 60000 });

    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(3);
    runTimerFrame(graph, 0);
    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(3);

    // The difference between Start and Restart *is* this, and it is why only one gets
    // `Unchanged`. Without this row, "Timer always says Unchanged on the second press" passes.
    expect(outcomesOf(graph, 'target')).toEqual(['done', 'done']);
  });

  test('Stop with nothing running reports Unchanged', async () => {
    const graph = await actionGraph(TimerModule as unknown as NodeModule, 'Timer', 'stop', { duration: 60000 });

    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(3);

    expect(outcomesOf(graph, 'target')).toEqual(['unchanged']);
    expect(graph.signalsFor('target')).toContain('completed');
  });
});

// =================================================================================================
// §1 — the helper's own guarantees
// =================================================================================================

describe('ERG-001 §1: the outcome helper', () => {
  test('emits exactly one outcome per invocation, and catches a second', async () => {
    const graph = await mutatorGraph('insert', freshArrayId());
    const node = graph.node('mutator') as NodeInstance & {
      beginOutcome(): object;
      reportOutcome(token: object, outcome: string, options?: unknown): void;
    };

    const token = node.beginOutcome();
    node.reportOutcome(token, 'done');
    node.reportOutcome(token, 'failure', { code: 'x/y', message: 'second outcome' });
    await graph.settle(2);

    // "a second call for the same invocation is a defect the helper can catch, and should"
    expect(outcomesOf(graph, 'mutator')).toEqual(['done']);
    expect(graph.errors.map((e) => e.code)).toContain('outcome/duplicate');
    // And the caught duplicate must not mint a second Completed either.
    expect(graph.signalsFor('mutator').filter((s) => s === 'completed').length).toBe(1);
  });

  test('a fresh invocation is not blocked by the previous one', async () => {
    const objectId = freshObjectId();
    const graph = await mutatorGraph('insert', freshArrayId());

    await pressDo(graph, objectId);
    await pressDo(graph, objectId);
    await pressDo(graph, objectId);

    // NV-iii: `Close Popup` and `Pop Component Stack` latch their first result and report it
    // for ever. Outcome state is per-invocation, and three pulses give three outcomes.
    expect(outcomesOf(graph, 'mutator')).toEqual(['done', 'unchanged', 'unchanged']);
    expect(graph.signalsFor('mutator').filter((s) => s === 'completed').length).toBe(3);
  });
});
