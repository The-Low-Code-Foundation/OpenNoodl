/**
 * BCN-004 step 6: a Query Records node with an **empty** sort must not crash when a
 * record is created elsewhere.
 *
 * `_addModelAtCorrectIndex` guarded its sort with `sort !== undefined` and then read
 * `sort[0][0]`. An empty array passes that guard, so `sort[0]` is `undefined` and the
 * read throws. It is reachable from an ordinary configuration:
 *
 *   - the **Javascript** filter path initialises its sort to `[]` and only fills it if
 *     the user's script calls `sort(...)` — most do not;
 *   - **Use limit** is on;
 *   - a record is created or saved on the same backend and matches the query.
 *
 * The third condition is what makes it more than a cosmetic throw. That code runs
 * inside the store's `create`/`save` event emit, and the adapter raises that event
 * **inside the originating node's success callback** — so the exception escaped
 * through Create New Record's `success`, which therefore never reached
 * `sendSignalOnOutput('created')`. A create that had already been written to the
 * backend reported nothing at all.
 *
 * Found by the live node driver (`bcn-004-node-driver.ts`), which is the first thing
 * to put a create and a limited query against one backend in one graph. Pinned here
 * so it does not need a rig to stay fixed.
 */
jest.mock('../../noodl-runtime', () => ({
  instance: { getMetaData: () => undefined }
}));

import NodeContext = require('../../src/nodecontext');
import NodeDefinition = require('../../src/nodedefinition');
import Model = require('../../src/model');
import DbCollectionModule = require('../../src/nodes/std-library/data/dbcollectionnode2');

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

function makeNode(currentQuery: Any) {
  const context: Any = new NodeContext();
  context.editorConnection = {
    isRunningLocally: () => true,
    isConnected: () => false,
    sendDynamicPorts: () => {},
    sendWarning: () => {},
    clearWarning: () => {}
  };
  context.nodeRegister.register(NodeDefinition.defineNode((DbCollectionModule as Any).node));

  const nodeScope: Any = {
    modelScope: undefined,
    context,
    nodeRegister: context.nodeRegister,
    componentOwner: { name: 'Test' }
  };
  const node: Any = context.nodeRegister.createNode('DbCollection2', 'q1', nodeScope);

  const Collection = require('../../src/collection');
  const collection = Collection.get();
  // Two rows already in the collection, and a limit of 2 — so one more arriving
  // trips the "don't exceed limit" branch, which is where the read lives.
  collection.set([Model.get('a'), Model.get('b')]);

  node._internal.name = 'articles';
  node._internal.collection = collection;
  node._internal.currentQuery = currentQuery;

  return node;
}

/** Fire the store's `create` notification the way `AdapterEvents` does. */
function notifyCreate(node: Any, objectId: string) {
  const model = Model.get(objectId);
  model.set('title', 'new row');
  node._internal.cloudStoreEvents({ type: 'create', collection: 'articles', object: { objectId } });
  return model;
}

describe('Query Records survives a create notification with an empty sort', () => {
  test('an empty sort array does not throw where an absent sort does not', () => {
    // `where: {}` matches everything, so the new record is added and the limit trips.
    const node = makeNode({ where: {}, sort: [], limit: 2 });

    expect(() => notifyCreate(node, 'c')).not.toThrow();
  });

  test('an empty sort is treated as no sort — the row is appended and the first is dropped', () => {
    const node = makeNode({ where: {}, sort: [], limit: 2 });
    notifyCreate(node, 'c');

    // Unsorted + over limit drops from the front, exactly as `sort: undefined` does.
    const ids = node._internal.collection.items.map((m: Any) => m.getId());
    expect(ids).toEqual(['b', 'c']);
  });

  test('an absent sort behaves identically — the two cases agree', () => {
    const node = makeNode({ where: {}, sort: undefined, limit: 2 });
    notifyCreate(node, 'c');

    const ids = node._internal.collection.items.map((m: Any) => m.getId());
    expect(ids).toEqual(['b', 'c']);
  });

  test('a descending sort still drops from the END, as the leading "-" says', () => {
    // The behaviour the original `sort[0][0]` expressed, kept deliberately.
    const node = makeNode({ where: {}, sort: ['-title'], limit: 2 });

    expect(() => notifyCreate(node, 'c')).not.toThrow();
    expect(node._internal.collection.size()).toBe(2);
  });

  test('a descending sort given as a bare string is read the same way', () => {
    // `getStorageFilter` types its sort `string | string[]`, and `sort[0][0]` happened
    // to read both correctly — `'-title'[0][0]` is `'-'`. Preserved on purpose.
    const node = makeNode({ where: {}, sort: '-title', limit: 2 });

    expect(() => notifyCreate(node, 'c')).not.toThrow();
    expect(node._internal.collection.size()).toBe(2);
  });

  test('no limit means no trimming, so an empty sort cannot reach the read at all', () => {
    const node = makeNode({ where: {}, sort: [], limit: undefined });
    notifyCreate(node, 'c');

    expect(node._internal.collection.size()).toBe(3);
  });
});
