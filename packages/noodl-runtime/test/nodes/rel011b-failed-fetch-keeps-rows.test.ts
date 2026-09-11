/**
 * REL-011b AC2 — **a failed fetch must not delete the rows it already delivered.**
 *
 * ## What was measured, and on what
 *
 * The site-builder template's published site, driven in headless Chrome on
 * 2026-09-03 (`sbr005-sections.look.ts`, AC3's failure arm). With its backend up
 * the page held **82 elements, 6 sections, 3 images and 2 buttons**. Within one
 * round trip of `service.stop()` it held **38, 0, 0 and 0** — every section gone,
 * the page's own chrome still there — and the console carried two
 * `DbCollection2 (/Pages/Site): Failed to fetch. [query-records/query-failed]`
 * lines and nothing else.
 *
 * 🔴 **The page was intact at the moment before the stop.** That reading is what
 * makes this a product finding rather than a harness one: the same probe ran on
 * the fresh load, after the fields were filled and after the viewport resize, and
 * answered 82/6/3/2 every time.
 *
 * ## The mechanism
 *
 * `fetch()` mints an empty `Collection` at the top and fills it only in the
 * `success` branch. The `error` branch published **that empty collection**, so a
 * query that merely failed to answer looked exactly like a table that had been
 * emptied: `items` went to `[]`, `isEmpty` to true, and every `For Each` fed by
 * it redrew zero rows, unmounting every wrapper below.
 *
 * SBR-011 gives three of that template's queries a realtime subscription, and a
 * dropped stream re-runs the query — so on a published site **any** backend
 * restart or network blip empties every visitor's page until they reload it.
 *
 * ## Why the fix is shaped the way it is
 *
 * `fetch()` has three failure exits. The unconfigured-backend one and the
 * bad-filter one both `setError` and return, leaving the collection alone; only
 * the fetch-error callback overwrote it. The fix aligns the third with the other
 * two, and deliberately leaves the **first** failure alone: with nothing bound
 * yet, the empty collection is still published, so a query that has never
 * succeeded reports `[]` / `isEmpty: true` / `count: 0` exactly as it always did.
 *
 * ⚠️ This does **not** make a refusal legible. P77 D4 — *"a refused query and an
 * empty collection are the same screen"* — is a separate row with a separate fix
 * (wiring the `failure` signal and `error` string this node already offers). This
 * one stops the failure destroying good data on its way to being illegible.
 */

jest.mock('../../noodl-runtime', () => ({
  instance: { getMetaData: () => undefined }
}));

import type { NodeModule } from '@noodl/types';

const NodeDefinition = require('../../src/nodedefinition');

import CloudStore = require('../../src/api/cloudstore');
import Model = require('../../src/model');
import QueryRecords = require('../../src/nodes/std-library/data/dbcollectionnode2');

interface QueryRecordsNode {
  _internal: Record<string, unknown>;
  setCollectionName(name: string): void;
  getOutput(name: string): { value: unknown };
  fetch(): void;
}

interface ScopeStub {
  modelScope: Record<string, unknown>;
  deleteNode(): void;
}

/**
 * A REAL `Model.Scope`, not a bare object.
 *
 * ⚠️ `CloudStore._fromJSON` calls `(modelScope || Model).get(objectId)` to mint
 * each row, so a plain `{}` makes every *successful* fetch throw — which would
 * leave this file able to grade only the failure it was written about, with no
 * presence control beside it.
 */
function makeModelScope(): Record<string, unknown> {
  return new (Model as unknown as { Scope: new () => Record<string, unknown> }).Scope();
}

/** Whatever `query` was handed, so a test can answer it late and twice. */
type QueryCall = {
  success(results: Record<string, unknown>[], count?: number): void;
  error(err: string): void;
};

function createStubContext() {
  return {
    hasFatalError: false,
    scheduleUpdate() {},
    scheduleAfterUpdate() {},
    scheduleAfterInputsHaveUpdated(cb: () => void) {
      cb();
    },
    connectionSentValue() {},
    nodeIsDirty() {},
    connectionSentSignal() {},
    editorConnection: undefined,
    modelScope: undefined
  };
}

function createScope(): ScopeStub {
  return { modelScope: makeModelScope(), deleteNode() {} };
}

function createNode(scope: ScopeStub): QueryRecordsNode {
  const definition = NodeDefinition.defineNode((QueryRecords as NodeModule).node);
  return definition(createStubContext(), 'rel011b-query-records', scope);
}

/**
 * The store this node will resolve to, with its `query` replaced by a recorder.
 *
 * ⚠️ `forBackend` falls through to `forScope` when the runtime has no backend
 * metadata — which is what the module mock above arranges — so this is the same
 * object the node reaches, not a parallel one.
 */
function storeFor(scope: ScopeStub): { calls: QueryCall[] } {
  const store = (
    CloudStore as unknown as { forScope(s: unknown): { query(opts: QueryCall): void } }
  ).forScope(scope.modelScope);
  const calls: QueryCall[] = [];
  store.query = (opts: QueryCall) => {
    calls.push(opts);
  };
  return { calls };
}

/** A node pointed at a collection, with its store's queries recorded. */
function armed() {
  const scope = createScope();
  const store = storeFor(scope);
  const node = createNode(scope);
  // ⚠️ The prototype extension, not `setInputValue('collectionName', …)`:
  // `collectionName` is a **dynamic** port registered from the editor's class
  // list, so on a bare node the input does not exist and the value is dropped
  // with a console line and no error.
  node.setCollectionName('Section');
  return { node, store };
}

const ROWS = [
  { objectId: 'sec-1', kind: 'hero' },
  { objectId: 'sec-2', kind: 'gallery' },
  { objectId: 'sec-3', kind: 'contact' }
];

describe('Query Records — a failed fetch keeps the rows it already delivered', () => {
  it('delivers the rows on a successful fetch — the presence control', () => {
    const { node, store } = armed();

    node.fetch();
    expect(store.calls.length).toBe(1);
    store.calls[0].success(ROWS);

    expect(node.getOutput('count').value).toBe(3);
    expect(node.getOutput('isEmpty').value).toBe(false);
  });

  it('🔴 keeps those rows when the NEXT fetch fails', () => {
    const { node, store } = armed();

    node.fetch();
    store.calls[0].success(ROWS);

    // The re-run a dropped realtime stream causes, against a backend that is gone.
    node.fetch();
    store.calls[1].error('Failed to fetch.');

    expect(`after a failed re-fetch — count: ${node.getOutput('count').value}, ` +
      `isEmpty: ${node.getOutput('isEmpty').value}`).toBe(
      'after a failed re-fetch — count: 3, isEmpty: false'
    );
  });

  it('still reports the failure — keeping the rows must not hide the error', () => {
    const { node, store } = armed();

    node.fetch();
    store.calls[0].success(ROWS);
    node.fetch();
    store.calls[1].error('Failed to fetch.');

    expect(node.getOutput('error').value).toBe('Failed to fetch.');
  });

  it('a FIRST fetch that fails still reports empty — the unchanged half', () => {
    const { node, store } = armed();

    node.fetch();
    store.calls[0].error('Failed to fetch.');

    expect(`first fetch failed — count: ${node.getOutput('count').value}, ` +
      `isEmpty: ${node.getOutput('isEmpty').value}`).toBe(
      'first fetch failed — count: 0, isEmpty: true'
    );
  });

  it('a successful re-fetch still REPLACES the rows — the fix is not a freeze', () => {
    const { node, store } = armed();

    node.fetch();
    store.calls[0].success(ROWS);

    node.fetch();
    store.calls[1].success([{ objectId: 'sec-9', kind: 'richText' }]);

    expect(node.getOutput('count').value).toBe(1);
  });
});
