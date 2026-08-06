/**
 * The two declared `default`s in the Array family, and what actually happens when an author
 * never touches the field the editor is showing them.
 *
 * ⚠️ **A declared `default:` never runs its setter.** `initializeDefaultValues` writes
 * `input.default` straight into `node._inputValues` and returns
 * (`nodedefinition.ts:161-179`, called from the constructor at `:481`); the setter is only
 * ever reached from `setInputValue`. So any state a setter would have established does not
 * exist until something *sends* the port a value. CWF-008 filed both nodes below under that
 * mechanism. Measured here, one is and one is not:
 *
 *  - **Array Map** was the real one. `mapScript`'s default is a template the editor renders
 *    into the Script field, the setter is what compiles it, and nothing called the setter —
 *    so `mapFunc` stayed `undefined` and every run failed with
 *    `'The map script could not be compiled: unknown error'` ("unknown" because nothing had
 *    failed to compile; nothing had compiled at all).
 *  - **Array Filter** was not. Its `enabled: true` default is equally inert, but
 *    `initialize` sets `this._internal.enabled = true` independently, so the state exists
 *    anyway and a hand-authored filter filters. The specs below pin that line down, because
 *    it is the only thing standing between this node and the defect its twin had.
 */

import Collection = require('../../src/collection');
import Model = require('../../src/model');
import type { CollectionLike, ModelLike } from '@noodl/types';

import { createNode } from '../helpers/node-harness';

import FilterModule = require('../../src/nodes/std-library/data/filtercollectionnode');
import MapModule = require('../../src/nodes/std-library/data/mapcollectionnode');

/** A source array, built the way `Array.prototype.set` builds one from plain JSON. */
function records(...data: Record<string, unknown>[]): CollectionLike {
  return Collection.create(data.map((d) => Model.create(d)));
}

/** The `Items` output as a plain array of records. */
function items(out: unknown): ModelLike[] {
  return out ? ((out as CollectionLike).items as ModelLike[]) : [];
}

/**
 * Array Map builds its output records through `(this.nodeScope.modelScope || Model)` (CWF-008),
 * so it needs a scope the way every real graph gives it one. `modelScope: undefined` is the
 * browser's shape — the cloud runtime is the only place a scope object appears there.
 */
function makeMapNode() {
  const map = createNode(MapModule, 'Map Collection');
  (map.node as unknown as { nodeScope: Record<string, unknown> }).nodeScope = {
    modelScope: undefined,
    componentOwner: { name: '/Test' }
  };
  return map;
}

/**
 * Drives a node the way a saved project does — parameters queued, then one update pass —
 * rather than by calling setters directly.
 */
function send(node: ReturnType<typeof createNode>['node'], values: Record<string, unknown>) {
  for (const name of Object.keys(values)) {
    node.registerInputIfNeeded(name);
    node.queueInput(name, values[name]);
  }
  node.update();
}

describe('Array Map — the declared Script default', () => {
  it('runs the template the editor shows when the author has not touched the Script', () => {
    const map = makeMapNode();

    send(map.node, { items: records({ name: 'ann' }, { name: 'bob' }) });

    // The template declares no mappings, so each output record is empty — but there IS one
    // per source record, the node did not fail, and `Changed` announced the result.
    expect(map.signals).not.toContain('failure');
    expect(map.out('error')).toBeUndefined();
    expect(items(map.out('items')).length).toBe(2);
    expect(map.out('count')).toBe(2);
    expect(map.signals).toContain('modified');
  });

  it('settles a Refresh with Done rather than Failure on an untouched Script', () => {
    const map = makeMapNode();

    send(map.node, { items: records({ name: 'ann' }) });
    map.pulse('refresh');
    map.node.update();

    expect(map.signals).toContain('done');
    expect(map.signals).not.toContain('failure');
  });

  it('an authored Script replaces the default', () => {
    const map = makeMapNode();

    send(map.node, {
      mapScript: "map({ who: 'name', shout: function (o) { return o.get('name').toUpperCase(); } })",
      items: records({ name: 'ann' }, { name: 'bob' })
    });

    const mapped = items(map.out('items'));
    expect(mapped.map((m) => m.get('who'))).toEqual(['ann', 'bob']);
    expect(mapped.map((m) => m.get('shout'))).toEqual(['ANN', 'BOB']);
    expect(map.signals).not.toContain('failure');
  });

  it('still refuses, and says why, when an authored Script will not compile', () => {
    const map = makeMapNode();

    send(map.node, { mapScript: 'map({', items: records({ name: 'ann' }) });

    expect(map.signals).toContain('failure');
    // The point of the fix: a real diagnosis, never the "unknown error" that meant
    // "nothing has ever been compiled".
    expect(String(map.out('error'))).toContain('could not be compiled');
    expect(String(map.out('error'))).not.toContain('unknown error');
  });

  it('keeps the template as the port default, so the editor still shows it', () => {
    const map = makeMapNode();
    expect(String(map.metadata.inputs.mapScript.default)).toContain('map({');
  });
});

describe('Array Filter — the declared Enabled default', () => {
  it('filters a hand-authored filter, because initialize establishes Enabled itself', () => {
    const filter = createNode(FilterModule, 'Filter Collection');

    send(filter.node, {
      filterFilter: 'name',
      'filterFilterOp-name': 'eq',
      'filterFilterValue-name': 'ann',
      items: records({ name: 'ann' }, { name: 'bob' }, { name: 'cid' })
    });

    expect(items(filter.out('items')).map((m) => m.get('name'))).toEqual(['ann']);
    expect(filter.out('count')).toBe(1);
  });

  it('passes everything through only when Enabled is explicitly false', () => {
    const filter = createNode(FilterModule, 'Filter Collection');

    send(filter.node, {
      enabled: false,
      filterFilter: 'name',
      'filterFilterOp-name': 'eq',
      'filterFilterValue-name': 'ann',
      items: records({ name: 'ann' }, { name: 'bob' })
    });

    expect(filter.out('count')).toBe(2);
  });

  it('keeps Enabled true as the port default, so the editor still shows it ticked', () => {
    const filter = createNode(FilterModule, 'Filter Collection');
    expect(filter.metadata.inputs.enabled.default).toBe(true);
  });
});
