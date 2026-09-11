/**
 * FLD-008 / issue #14, the half that was **not** reported — **Query Records had the same
 * hole, and it widens further.**
 *
 * The reporter measured Aggregate Records. The identical four lines are in Query Records'
 * `getStorageFilter`: a JavaScript filter that `convertFilterOp` refuses is reported by
 * calling `context.editorConnection.sendWarning(…)` and nothing else. Outside the editor
 * `editorConnection` is undefined, so that line threw a `TypeError`, the throw unwound into
 * `catch (e) { console.log(…) }`, `_filter` was never assigned, and the node queried with
 * `where: {}`.
 *
 * 🔴 **On this node the consequence is worse than a wrong number.** An aggregation that
 * widens returns a total that is too large. A *query* that widens returns **every row in the
 * collection** — to a `For Each`, to a page, to whoever is looking at it. That is the same
 * widening `wire.ts` §166 names, arriving by a second route, and it is why FLD-008's scope
 * says "do both nodes. One is not a fix."
 *
 * ⚠️ Every arm runs with `editorConnection: undefined` — the published-app and cloud-function
 * shape. With an editor connection the callback succeeds, the warning appears, and none of
 * this happens; that is exactly why it survived DEF-012's sweep of the visual-filter path.
 */

jest.mock('../../noodl-runtime', () => ({
  instance: { getMetaData: () => undefined }
}));

import * as fs from 'fs';
import * as path from 'path';

import type { NodeModule } from '@noodl/types';

const NodeDefinition = require('../../src/nodedefinition');

import CloudStore = require('../../src/api/cloudstore');
import Model = require('../../src/model');

const NODE_SOURCE = path.join(__dirname, '..', '..', 'src', 'nodes', 'std-library', 'data', 'dbcollectionnode2.ts');

/** The reporter's shape: two top-level keys, which the filter language forbids. */
const TWO_KEY_FILTER = "where({ campaignId: { equalTo: 'c-1' }, status: { equalTo: 'approved' } })\n";

/** The rewrite the translator's own message tells them to use. */
const AND_FILTER =
  "where({ and: [ { campaignId: { equalTo: 'c-1' } }, { status: { equalTo: 'approved' } } ] })\n";

interface QueryCall {
  where: unknown;
  success(results: Record<string, unknown>[], count?: number): void;
  error(err: string): void;
}

interface QueryRecordsNode {
  _internal: Record<string, unknown>;
  setCollectionName(name: string): void;
  getOutput(name: string): { value: unknown };
  fetch(): void;
}

function makeModelScope(): Record<string, unknown> {
  // A real `Model.Scope`: `CloudStore._fromJSON` mints rows through it, so a bare `{}` would
  // make every *successful* fetch throw and leave this file unable to grade its own control.
  return new (Model as unknown as { Scope: new () => Record<string, unknown> }).Scope();
}

/** A node in the shape a published app has — 🔴 `editorConnection: undefined`. */
function armed(mod: unknown, filterScript: string) {
  const scope = { modelScope: makeModelScope(), deleteNode() {} };

  const store = (
    CloudStore as unknown as { forScope(s: unknown): { query(opts: QueryCall): void } }
  ).forScope(scope.modelScope);
  const calls: QueryCall[] = [];
  store.query = (opts: QueryCall) => {
    calls.push(opts);
  };

  const context = {
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

  const definition = NodeDefinition.defineNode((mod as NodeModule).node);
  const node: QueryRecordsNode = definition(context, 'fld008-query-records', scope);
  // A dynamic port on a bare node, so the prototype extension rather than `setInputValue`.
  node.setCollectionName('Chunk');
  node._internal.storageSettings = {
    storageFilterType: 'json',
    storageJSONFilter: filterScript
  };

  return { node, calls };
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const FixedModule = require('../../src/nodes/std-library/data/dbcollectionnode2');

/**
 * The node as it was before FLD-008, compiled and required for real — the fix textually
 * undone, beside the original so its own imports resolve identically. Both replacements are
 * **asserted to have matched**: if the source moves, this arm fails loudly rather than
 * quietly grading a file that no longer contains the defect it claims to restore.
 */
function withReverted<T>(body: (mod: unknown) => T): T {
  const original = fs.readFileSync(NODE_SOURCE, 'utf8');

  const CAPTURE = '              _filterFailed = err;\n';
  const GUARD = '              if (_this.context.editorConnection) {';
  expect(original).toContain(CAPTURE);
  expect(original).toContain(GUARD);

  const reverted = original.replace(CAPTURE, '').replace(GUARD, '              if (true) {');
  const revertedPath = path.join(path.dirname(NODE_SOURCE), `dbcollectionnode2.fld008-reverted.${process.pid}.ts`);
  fs.writeFileSync(revertedPath, reverted, 'utf8');
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return body(require(revertedPath));
  } finally {
    delete require.cache[require.resolve(revertedPath)];
    fs.unlinkSync(revertedPath);
  }
}

const REFUSAL =
  'A filter must have exactly one key, found 2: campaignId, status. ' +
  'Combine conditions with { and: [ … ] } or { or: [ … ] }.';

describe('FLD-008 — Query Records, outside the editor', () => {
  it('AC1/AC4: a filter it cannot translate fails the node and issues NO query', () => {
    const { node, calls } = armed(FixedModule, TWO_KEY_FILTER);

    node.fetch();

    expect(node.getOutput('error').value).toBe(REFUSAL);
    // 🔴 The half that is the defect: no request goes out at all. A query that went out with
    // an empty `where` would hand back the whole collection and report success.
    expect(calls).toHaveLength(0);
  });

  it('AC2/AC4: the same filter rewritten with `and:` queries, and queries FILTERED', () => {
    const { node, calls } = armed(FixedModule, AND_FILTER);

    node.fetch();

    // The presence control: without it the arm above cannot tell "refuses correctly" from
    // "refuses everything".
    expect(calls).toHaveLength(1);
    expect(calls[0].where).toEqual({
      $and: [{ campaignId: { $eq: 'c-1' } }, { status: { $eq: 'approved' } }]
    });
    expect(node.getOutput('error').value).toBeUndefined();

    calls[0].success([{ objectId: 'r-1' }, { objectId: 'r-2' }]);
    expect(node.getOutput('count').value).toBe(2);
  });

  it('AC4 (reverted): the node before the fix queries the WHOLE collection and says nothing', () => {
    withReverted((RevertedModule) => {
      const { node, calls } = armed(RevertedModule, TWO_KEY_FILTER);

      node.fetch();

      // 🔴 One request, no `where`. Everything in the class, delivered as a success.
      expect(calls).toHaveLength(1);
      expect(calls[0].where).toEqual({});
      expect(node.getOutput('error').value).toBeUndefined();

      calls[0].success([{ objectId: 'r-1' }, { objectId: 'r-2' }, { objectId: 'r-3' }]);
      expect(
        `reverted, two-key filter — count: ${node.getOutput('count').value}, ` +
          `error: ${String(node.getOutput('error').value)}`
      ).toBe('reverted, two-key filter — count: 3, error: undefined');
    });
  });

  it('AC4 (reverted, control): the `and:` rewrite was never broken', () => {
    withReverted((RevertedModule) => {
      const { node, calls } = armed(RevertedModule, AND_FILTER);

      node.fetch();

      // Without this the arm above reads as "the old node never filtered anything". It did;
      // it turned a *refusal* into an unfiltered answer.
      expect(calls).toHaveLength(1);
      expect(calls[0].where).toEqual({
        $and: [{ campaignId: { $eq: 'c-1' } }, { status: { $eq: 'approved' } }]
      });
      void node;
    });
  });
});
