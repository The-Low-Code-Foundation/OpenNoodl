/**
 * NDA-004 §2 — the Array family's three mutators, which had three different wrong answers to
 * one question.
 *
 * The register's ⏳ item 6 grouped six Array nodes and warned that the family "poses exactly"
 * the Object node's question: is the trigger an author `Do`, or a value arriving? For these
 * three it is unambiguously a `Do` — `add`, `remove` and `clear` are `valueChangedToTrue`
 * handlers on ports the editor labels `Do` — so the port is safe. The other three are 🔵 and
 * two of them are pinned at the bottom of this file.
 *
 * What reading them found was not one defect three times:
 *
 * - **Insert Object Into Array** posted `sendWarning` and returned, behind an
 *   `if (this.context.editorConnection)`. Perfect diagnosis on the canvas, total silence in a
 *   deployed app, a cloud function or an export — and no graph surface in *any* of them.
 * - **Remove Object From Array** had two bare `return`s. No warning, no signal, no console
 *   line, nowhere. The only evidence available to an author was that the array had not changed.
 * - **Clear Array** had no guard at all: `collection.set([])` on `undefined` threw a `TypeError`
 *   out of a scheduled callback. Not silence — a crash, from a node whose Array Id had simply
 *   not been filled in.
 *
 * ## The row that matters most
 *
 * Underneath all three sat the phase's worst shape, the one `Set Parent Component Object
 * Properties` was fixed for in the previous batch. `setCollectionID` handed its id straight to
 * `Collection.get`, and `Collection.get(undefined)` is the anonymous tier — a **fresh,
 * differently-named collection on every call**. Feed it a missing id and the node does not end up
 * unbound; it ends up bound to a throwaway. The `=== undefined` guard then passes, the insert
 * lands, and the node emits **`Done`** for a write nothing in the graph could ever read.
 *
 * ## The reachable path is a cleared field, not a quiet wire
 *
 * The first draft of these rows drove `undefined` down a connection, and the discrimination check
 * is what caught it: two rows stayed green with the fix removed. `Node.prototype.sendValue`
 * (`node.ts:635-637`) drops `undefined` before it reaches any receiver, so **no wire can ever
 * deliver it** — the rows were pinning nothing. (`outputproperty.sendValue` does not filter, which
 * is what made this look reachable; the filter is one layer up, in the method `flagOutputDirty`
 * actually calls.)
 *
 * The path that does reach the setter is an author **clearing the Array Id field**:
 * `NodeModel.setParameter(name, undefined)` deletes the parameter, and
 * `_onNodeModelParameterUpdated` queues the port's default, which here is `undefined`
 * (`node.ts:871-882`). That is an ordinary editing action, and it is what the rows drive now.
 *
 * It also settled how the port should read an empty value. `undefined` means one thing only here
 * — the field was cleared — so treating it as the contract's "no opinion" would leave the node
 * writing to an array the author had just removed from it: a stale target instead of a throwaway
 * one, no louder. Both empty values unbind, and the reasoning is in `collection-failure.ts`.
 *
 * ## Limitation: this package cannot drive a parameter edit at all
 *
 * Recorded rather than worked around, because it is not specific to these rows and the next §2
 * batch will hit it. **No node↔node-model event is delivered under the viewer's jest.**
 *
 * `Node.setNodeModel` registers its `parameterUpdated`, `variantUpdated`, `inputPortRemoved` and
 * `outputPortRemoved` listeners *with a ref*, so they land in `EventSender.listenersWithRefs` — a
 * `Map`, which `emit` walks with `for (const [ref, callbacks] of map)`. This package compiles
 * sibling-package sources with `target: "es5"` and no `downlevelIteration`, which turns that into
 * an index loop over `map.length`: `undefined` on a `Map`, so **zero iterations, silently**.
 * Ref-less listeners on the same emitter fire normally, which is why nothing else has noticed.
 *
 * Verified both ways: `emit` delivers to a ref listener under `noodl-runtime`'s jest and does not
 * under this one. This extends the banked pre-ES2015 trap rather than restating it — that trap
 * says the symptom is a loud `TS2802`, and here there is no error at all, because a cross-package
 * source is transpiled with these options but its diagnostics are never surfaced. A dead code
 * path in a test reads as a node that ignored the edit.
 *
 * Rows that need a real parameter edit therefore belong in `noodl-runtime`'s half of the corpus.
 */

/* eslint-env jest */

import Collection from '@noodl/runtime/src/collection';
import Model from '@noodl/runtime/src/model';
import type { CollectionLike, NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from '../../../noodl-runtime/test/corpus/graph-harness';

import CollectionModule from '../../src/nodes/std-library/data/collectionnode2';
import CollectionClearModule from '../../src/nodes/std-library/data/collectionnode-clear';
import CollectionInsertModule from '../../src/nodes/std-library/data/collectionnode-insert';
import CollectionNewModule from '../../src/nodes/std-library/data/collectionnode-new';
import CollectionRemoveModule from '../../src/nodes/std-library/data/collectionnode-remove';
import {
  resolveCollectionId,
  setCollectionIdInput,
  type FailableCollectionInstance
} from '../../src/nodes/std-library/data/collection-failure';

/**
 * `Collection.get(name)` is a process-wide registry, so every test needs its own name or the
 * array one row filled is the array the next row asserts is empty.
 */
let arrayCounter = 0;
function freshArrayId(): string {
  return 'corpus-array-' + ++arrayCounter;
}

interface TriggerInstance extends NodeInstance {
  go(): void;
  send(value: unknown): void;
}

/** A `Do` pulse and one settable value output, the corpus's usual pair. */
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

type MutatorKind = 'insert' | 'remove' | 'clear';

const MUTATOR = {
  insert: { type: 'CollectionInsert', doPort: 'add', prefix: 'insert-into-array' },
  remove: { type: 'CollectionRemove', doPort: 'remove', prefix: 'remove-from-array' },
  clear: { type: 'CollectionClear', doPort: 'clear', prefix: 'clear-array' }
} as const;

/**
 * One mutator wired to a Trigger.
 *
 * `arrayId` omitted is the unconfigured node — the `Array Id` input is never set at all.
 * `wireArrayId` instead routes the id through the Trigger's `value` output, which is how a row
 * can deliver `undefined` or `null` on a wire the way a real graph does.
 */
async function mutatorGraph(options: {
  kind: MutatorKind;
  arrayId?: string;
  wireArrayId?: boolean;
}): Promise<CorpusGraph> {
  const spec = MUTATOR[options.kind];
  const connections: Array<Record<string, string>> = [
    { sourceId: 'trigger', sourcePort: 'go', targetId: 'mutator', targetPort: spec.doPort }
  ];
  if (options.wireArrayId) {
    connections.push({ sourceId: 'trigger', sourcePort: 'value', targetId: 'mutator', targetPort: 'collectionId' });
  }
  // Only Insert and Remove have an Object Id port; Clear ignores the connection request.
  if (options.kind !== 'clear') {
    connections.push({ sourceId: 'objectId', sourcePort: 'value', targetId: 'mutator', targetPort: 'modifyId' });
  }

  const graph = await createCorpusGraph({
    modules: [
      TriggerModule,
      CollectionInsertModule as unknown as NodeModule,
      CollectionRemoveModule as unknown as NodeModule,
      CollectionClearModule as unknown as NodeModule
    ],
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            { id: 'trigger', type: 'corpus.Trigger' },
            { id: 'objectId', type: 'corpus.Trigger' },
            {
              id: 'mutator',
              type: spec.type,
              parameters: options.arrayId && !options.wireArrayId ? { collectionId: options.arrayId } : {}
            }
          ],
          connections
        }
      ]
    } as never
  });

  await graph.settle(4);
  return graph;
}

/** Pulse `Do`, optionally with an Object Id on the wire first, and let the graph settle. */
async function pressDo(graph: CorpusGraph, objectId?: string): Promise<void> {
  if (objectId !== undefined) graph.node<TriggerInstance>('objectId').send(objectId);
  graph.node<TriggerInstance>('trigger').go();
  await graph.settle(4);
}

function boundCollection(graph: CorpusGraph): CollectionLike | undefined {
  return graph.node<FailableCollectionInstance>('mutator')._internal.collection;
}


describe('NDA-004 §2: Insert Object Into Array', () => {
  test('a Do with no array bound fires Failure instead of doing nothing quietly', async () => {
    const graph = await mutatorGraph({ kind: 'insert' });
    await pressDo(graph, 'some-object');

    expect(graph.signalsFor('mutator')).toContain('failure');
    expect(graph.signalsFor('mutator')).not.toContain('modified');
  });

  test('the diagnosis reaches the runtime channel, not just the editor', async () => {
    const graph = await mutatorGraph({ kind: 'insert' });
    await pressDo(graph, 'some-object');

    // This is the whole of criterion 3 for this node. Before the fix the message existed and
    // went only to `editorConnection.sendWarning`, so `graph.errors` — the channel that exists
    // in every runtime — was empty and a deployed app got nothing.
    const raised = graph.errors.filter((e) => e.code === 'insert-into-array/no-array');
    expect(raised.length).toBe(1);
    expect(raised[0].message).toMatch(/no array is bound/);
    expect(raised[0].nodeId).toBe('mutator');
  });

  test('the Error output carries the message, so a graph can show it', async () => {
    const graph = await mutatorGraph({ kind: 'insert' });
    await pressDo(graph, 'some-object');

    // The contract forbids a bare `Failure` signal: "a bare signal reproduces 'no information'
    // one level up".
    expect(graph.node<FailableCollectionInstance>('mutator')._internal.error).toMatch(/no array is bound/);
  });

  test('a Do with an array but no Object Id is a distinct, separately coded failure', async () => {
    const graph = await mutatorGraph({ kind: 'insert', arrayId: freshArrayId() });
    await pressDo(graph);

    expect(graph.signalsFor('mutator')).toContain('failure');
    expect(graph.signalsFor('mutator')).not.toContain('modified');
    expect(graph.errors.map((e) => e.code)).toEqual(['insert-into-array/no-object-id']);
  });

  // ✅ Pinned control. The happy path still works, still says `Done`, still raises nothing —
  // and the object is actually in the array. Without this, every row above is equally
  // consistent with a node that has stopped working.
  test('(pinned control) with both inputs it inserts, reports Done, and raises nothing', async () => {
    const arrayId = freshArrayId();
    const graph = await mutatorGraph({ kind: 'insert', arrayId });
    await pressDo(graph, 'object-a');

    expect(graph.signalsFor('mutator')).toEqual(['modified']);
    expect(graph.signalsFor('mutator')).not.toContain('failure');
    expect(graph.errors).toEqual([]);
    expect(Collection.get(arrayId).size()).toBe(1);
    expect(Collection.get(arrayId).get(0).getId()).toBe('object-a');
  });
});

describe('NDA-004 §2: Remove Object From Array', () => {
  test('a Do with no array bound fires Failure — this one had no diagnosis anywhere at all', async () => {
    const graph = await mutatorGraph({ kind: 'remove' });
    await pressDo(graph, 'some-object');

    expect(graph.signalsFor('mutator')).toContain('failure');
    expect(graph.signalsFor('mutator')).not.toContain('modified');
    expect(graph.errors.map((e) => e.code)).toEqual(['remove-from-array/no-array']);
  });

  test('a Do with no Object Id is coded separately from a missing array', async () => {
    const graph = await mutatorGraph({ kind: 'remove', arrayId: freshArrayId() });
    await pressDo(graph);

    expect(graph.signalsFor('mutator')).toContain('failure');
    expect(graph.errors.map((e) => e.code)).toEqual(['remove-from-array/no-object-id']);
  });

  // ✅ Pinned control.
  test('(pinned control) with both inputs it removes, reports Done, and raises nothing', async () => {
    const arrayId = freshArrayId();
    Collection.get(arrayId).set([Model.get('object-a'), Model.get('object-b')]);

    const graph = await mutatorGraph({ kind: 'remove', arrayId });
    await pressDo(graph, 'object-a');

    expect(graph.signalsFor('mutator')).toEqual(['modified']);
    expect(graph.errors).toEqual([]);
    expect(Collection.get(arrayId).size()).toBe(1);
    expect(Collection.get(arrayId).get(0).getId()).toBe('object-b');
  });
});

/**
 * NDA-012 (Data) — the third silent success, which §2 did not reach.
 *
 * §2 above fixed the two cases the node could already *detect*: no array bound, no Object Id
 * supplied. It left the one an author is most likely to hit — an Object Id that names a record
 * nothing has loaded — because from inside the node it looks indistinguishable from a good one.
 *
 * It is not. `Model.get` mints on read (`model.ts:232`), so an unknown id produces a brand-new
 * object that by construction is not in the array; `Array.prototype.remove` finds
 * `indexOf === -1` and returns silently (`collection.ts:606-614`); and the node then sent `Done`.
 * Measured before the fix: an array of size 1, removing an id never loaded, stays size 1 while
 * the node reports success.
 *
 * That is exactly what `collection-failure.ts`'s own header calls "the one thing the Failure
 * Contract says must never happen" — a completion signal for work that went nowhere. The header
 * guarded it for an unresolved *array* and not for an unresolvable *object*.
 */
describe('NDA-012: Remove Object From Array, an Object Id nothing has loaded', () => {
  test('fires Failure rather than Done for a removal that cannot happen', async () => {
    const arrayId = freshArrayId();
    Collection.get(arrayId).set([Model.get('object-a')]);

    const graph = await mutatorGraph({ kind: 'remove', arrayId });
    // A syntactically fine id that no query, repeater or Object node ever produced.
    await pressDo(graph, 'nda012-never-loaded');

    expect(graph.signalsFor('mutator')).toContain('failure');
    expect(graph.signalsFor('mutator')).not.toContain('modified');
    expect(graph.errors.map((e) => e.code)).toEqual(['remove-from-array/unknown-object-id']);
    // The array is untouched — which was true before the fix too. What changed is that the node
    // now says so.
    expect(Collection.get(arrayId).size()).toBe(1);
  });

  /**
   * ✅ The load-bearing control.
   *
   * `Model.exists` covers the weakly-held anonymous tier as well as the named one
   * (`model.ts:249-253`). A record that exists only because the *array itself* still holds it
   * must not be mistaken for an absent one, or this fix would break the ordinary case of
   * removing a repeater item.
   */
  test('(control) a record reachable only through the array is still removable', async () => {
    const arrayId = freshArrayId();
    const held = Model.get('nda012-held-only-by-the-array');
    Collection.get(arrayId).set([held]);

    const graph = await mutatorGraph({ kind: 'remove', arrayId });
    await pressDo(graph, 'nda012-held-only-by-the-array');

    expect(graph.signalsFor('mutator')).toEqual(['modified']);
    expect(graph.errors).toEqual([]);
    expect(Collection.get(arrayId).size()).toBe(0);
  });

  /**
   * 🔵 Recorded, not fixed: removing a record that exists but is in a *different* array is still
   * reported as `Done`.
   *
   * That one is genuinely ambiguous — an idempotent "make sure this is not in here" is a
   * defensible reading, and unlike the row above the operation is not impossible, merely
   * unnecessary. Pinned so the current behaviour is a decision rather than an accident.
   */
  test('(pinned) a record in a different array is a silent no-op, by current design', async () => {
    const arrayId = freshArrayId();
    const otherId = freshArrayId();
    Collection.get(arrayId).set([Model.get('object-a')]);
    Collection.get(otherId).set([Model.get('nda012-elsewhere')]);

    const graph = await mutatorGraph({ kind: 'remove', arrayId });
    await pressDo(graph, 'nda012-elsewhere');

    expect(graph.signalsFor('mutator')).toEqual(['modified']);
    expect(graph.errors).toEqual([]);
    expect(Collection.get(arrayId).size()).toBe(1);
  });
});

describe('NDA-004 §2: Clear Array', () => {
  test('a Do with no array bound reports Failure rather than throwing a TypeError', async () => {
    const graph = await mutatorGraph({ kind: 'clear' });

    // The assertion is the *absence of a throw* as much as the signal. `collection.set([])` on
    // `undefined` threw out of `scheduleAfterInputsHaveUpdated`, so this line used to reject.
    await expect(pressDo(graph)).resolves.toBeUndefined();

    expect(graph.signalsFor('mutator')).toContain('failure');
    expect(graph.signalsFor('mutator')).not.toContain('modified');
    expect(graph.errors.map((e) => e.code)).toEqual(['clear-array/no-array']);
  });

  // ✅ Pinned control.
  test('(pinned control) with an array bound it empties it, reports Done, and raises nothing', async () => {
    const arrayId = freshArrayId();
    Collection.get(arrayId).set([Model.get('object-a'), Model.get('object-b')]);

    const graph = await mutatorGraph({ kind: 'clear', arrayId });
    await pressDo(graph);

    expect(graph.signalsFor('mutator')).toEqual(['modified']);
    expect(graph.errors).toEqual([]);
    expect(Collection.get(arrayId).size()).toBe(0);
  });
});

describe('NDA-004 §2: an unresolved Array Id must not be answered with a throwaway array', () => {
  // The premise of the whole fix, pinned so a change to `Collection.get` cannot quietly
  // invalidate it. Two calls, two different arrays, neither reachable by name.
  test('Collection.get(undefined) really does mint a fresh anonymous array every call', () => {
    const first = Collection.get(undefined);
    const second = Collection.get(undefined);

    expect(first).toBeDefined();
    expect(first.getId()).not.toBe(second.getId());
    expect(first).not.toBe(second);
  });

  test('resolveCollectionId refuses to resolve undefined, and resolves a name as before', () => {
    const arrayId = freshArrayId();

    expect(resolveCollectionId(undefined)).toBeUndefined();
    expect(resolveCollectionId(arrayId)).toBe(Collection.get(arrayId));
  });

  test('a node whose Array Id was never set holds no collection at all', async () => {
    const graph = await mutatorGraph({ kind: 'insert' });
    await pressDo(graph, 'object-a');

    // The identity witness for the unconfigured case. "Failure fired" alone is also consistent
    // with the node being unbound for some unrelated reason; "the node holds no collection" is
    // what says no throwaway was minted behind it.
    expect(boundCollection(graph)).toBeUndefined();
  });

  /**
   * The cleared-field case, driven at the setter.
   *
   * It should be driven through the node model — `setParameter(name, undefined)` is literally
   * what the editor does — and it cannot be, in *this* package. See the limitation note in the
   * file header: ref-registered `EventSender` listeners never fire under the viewer's ts-jest, so
   * a parameter edit reaches nothing. `setCollectionIdInput` is the whole of the node's response
   * to that edit, so calling it directly tests the same decision; what is lost is the evidence
   * that the runtime delivers the edit, and that is a runtime-package concern, not this node's.
   */
  test('a cleared Array Id field unbinds — it does not silently rebind to a throwaway', async () => {
    const arrayId = freshArrayId();
    const graph = await mutatorGraph({ kind: 'insert', arrayId });
    const mutator = graph.node<FailableCollectionInstance>('mutator');

    expect(boundCollection(graph)).toBe(Collection.get(arrayId));

    // `node.ts:871-882` queues the port default when a parameter is deleted, and `Array Id` has
    // no default, so this is the value that arrives.
    setCollectionIdInput.call(mutator, undefined);

    await pressDo(graph, 'object-a');

    // Three assertions, because the old behaviour satisfied the naive one: `Collection.get(
    // undefined)` returned a real collection, so the node stayed "bound", the insert "worked",
    // and `Done` fired — the array the author had named just never changed.
    expect(boundCollection(graph)).toBeUndefined();
    expect(graph.signalsFor('mutator')).not.toContain('modified');
    expect(graph.errors.map((e) => e.code)).toEqual(['insert-into-array/no-array']);
    expect(Collection.get(arrayId).size()).toBe(0);
  });

  // ✅ Pinned control for the row above: the same setter with a real id binds and the Do lands,
  // so "unbound" is about the empty value and not about the call being inert.
  test('(pinned control) the same setter with a real id binds, and the Do lands there', async () => {
    const arrayId = freshArrayId();
    const graph = await mutatorGraph({ kind: 'insert' });

    setCollectionIdInput.call(graph.node<FailableCollectionInstance>('mutator'), arrayId);

    await pressDo(graph, 'object-a');

    expect(boundCollection(graph)).toBe(Collection.get(arrayId));
    expect(graph.signalsFor('mutator')).toEqual(['modified']);
    expect(Collection.get(arrayId).size()).toBe(1);
  });

  test('undefined cannot reach this setter over a connection at all — the premise, pinned', async () => {
    const arrayId = freshArrayId();
    const graph = await mutatorGraph({ kind: 'insert', wireArrayId: true });

    graph.node<TriggerInstance>('trigger').send(arrayId);
    await graph.settle(4);
    graph.node<TriggerInstance>('trigger').send(undefined);
    await graph.settle(4);

    // `Node.prototype.sendValue` drops `undefined` at the sender, so the binding survives an
    // upstream going quiet whatever this setter does with `undefined`. That is the fact that
    // makes "cleared field" the only meaning `undefined` can carry here, so it is the fact the
    // port's design rests on — if it ever changes, this row is where it surfaces.
    expect(boundCollection(graph)).toBe(Collection.get(arrayId));
  });

  test('null arriving at an Array Id is an explicit clear, and the next Do fails', async () => {
    const arrayId = freshArrayId();
    const graph = await mutatorGraph({ kind: 'insert', wireArrayId: true });

    graph.node<TriggerInstance>('trigger').send(arrayId);
    await graph.settle(4);
    graph.node<TriggerInstance>('trigger').send(null);
    await graph.settle(4);

    await pressDo(graph, 'object-a');

    expect(boundCollection(graph)).toBeUndefined();
    expect(graph.errors.map((e) => e.code)).toEqual(['insert-into-array/no-array']);
    expect(Collection.get(arrayId).size()).toBe(0);
  });

  test('setCollectionIdInput accepts a Collection where an id is expected, as the family always has', () => {
    const arrayId = freshArrayId();
    const collection = Collection.get(arrayId);
    const held: Array<CollectionLike | undefined> = [];
    const fake = { setCollection: (c: CollectionLike | undefined) => held.push(c) };

    setCollectionIdInput.call(fake as never, collection);

    expect(held).toEqual([collection]);
  });
});

describe('NDA-004 §2: the ports exist, which signalsFor cannot tell you', () => {
  /**
   * These three rows look redundant beside the `toContain('failure')` assertions above and are
   * not, which is worth knowing about because the same gap runs through the rest of the corpus.
   *
   * `graph.signalsFor` is a wrapper the harness installs over `sendSignalOnOutput`, and it
   * records the port name **before** delegating. `Node.sendSignalOnOutput` on a name the node
   * does not have only `console.log`s and returns. So deleting the `failure` output entirely
   * leaves every `toContain('failure')` row green — verified by doing it. Nothing in this file
   * failed, and the ports were gone.
   *
   * `hasOutput` is the assertion that actually holds the graph surface in place, and it is the
   * mirror image of the two 🔵 rows below: same call, opposite expectation.
   */
  test.each([
    ['insert', 'CollectionInsert'],
    ['remove', 'CollectionRemove'],
    ['clear', 'CollectionClear']
  ] as Array<[MutatorKind, string]>)('%s declares Failure and Error outputs', async (kind) => {
    const graph = await mutatorGraph({ kind });
    const mutator = graph.node('mutator');

    expect(mutator.hasOutput('failure')).toBe(true);
    expect(mutator.hasOutput('error')).toBe(true);
    // The completion signal is still there beside them — a node that reports only failure is
    // half a fix.
    expect(mutator.hasOutput('modified')).toBe(true);
  });
});

describe('NDA-004 §2: the two Array nodes that correctly have no Failure port', () => {
  /**
   * Both rows pin an **absence**, which the Failure Contract is explicit about: "a node that
   * *cannot* fail gets no `Failure` output — a vestigial port implies a failure mode that does
   * not exist". A later mechanical sweep finishing the family off is the regression they exist
   * to catch, exactly as for `Set Component Object Properties` in the previous batch.
   */
  async function familyGraph(): Promise<CorpusGraph> {
    return createCorpusGraph({
      modules: [CollectionNewModule as unknown as NodeModule, CollectionModule as unknown as NodeModule],
      data: {
        components: [
          {
            name: '/root',
            nodes: [
              { id: 'create', type: 'CollectionNew' },
              { id: 'array', type: 'Collection2' }
            ]
          }
        ]
      } as never
    });
  }

  test('Create New Array has none: it builds its own array and cannot fail to find one', async () => {
    const graph = await familyGraph();
    const create = graph.node('create');

    expect(create.hasOutput('created')).toBe(true);
    expect(create.hasOutput('failure')).toBe(false);
    expect(create.hasOutput('error')).toBe(false);
  });

  test('Array has none: its Id input is a value arriving, not a Do — the Object node trap', async () => {
    const graph = await familyGraph();
    const array = graph.node('array');

    // `collectionId`'s setter runs on *every* value that reaches it, including on the boot path
    // before an upstream has produced an id. A `Failure` here would fire on the happy path,
    // which the contract names as worse than having no port — the reasoning that made the
    // Object node 🔵 in batch 2, and the reason this node is not in the batch above.
    expect(array.hasOutput('changed')).toBe(true);
    expect(array.hasOutput('failure')).toBe(false);
    expect(array.hasOutput('error')).toBe(false);
  });
});
