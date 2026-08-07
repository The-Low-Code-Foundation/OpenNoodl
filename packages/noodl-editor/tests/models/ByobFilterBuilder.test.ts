/**
 * RUN-003 slice 5: unit tests for the ByobFilterBuilder's pure logic —
 * the connected-value port-name contract and the Directus filter conversion
 * it feeds. The runtime side of the same contract (parseFilterForConnectedPorts,
 * filter-value resolution) is covered in noodl-runtime/test/byob-utils.test.js;
 * the port names generated here MUST keep the `filter_` prefix that
 * byob-query-data.js uses to recognise its dynamic inputs.
 *
 * ⚠️ **BCN-003 re-targeted the builder at the neutral vocabulary**, so the
 * conditions below spell their operators `equalTo` / `greaterThan` rather than
 * `_eq` / `_gt`. The *output* is unchanged — that is the point, and the
 * migration's acceptance test in `@noodl/backend-contract` pins it for a filter
 * saved by the old builder. Storing Directus's own operator names in project
 * data is what made every saved BYOB filter a Directus filter regardless of
 * which backend the node pointed at.
 */

import { migrateSavedFilter, type SavedFilterGroup } from '@noodl/backend-contract/translators';

import { toDirectusFilter } from '../../src/editor/src/views/panels/propertyeditor/components/ByobFilterBuilder/converter';
import { getOperatorsForType } from '../../src/editor/src/views/panels/propertyeditor/components/ByobFilterBuilder/operators';
import {
  isParseSchema,
  parseSchemaToCollection
} from '../../src/editor/src/views/panels/propertyeditor/components/ByobFilterBuilder/parseSchema';
import {
  FilterGroup,
  generateFilterPortName
} from '../../src/editor/src/views/panels/propertyeditor/components/ByobFilterBuilder/types';

describe('ByobFilterBuilder connected-value port names', () => {
  it('keeps the filter_ prefix the runtime keys on', () => {
    expect(generateFilterPortName({ id: 'abc123', field: 'status' })).toBe('filter_status_abc123');
  });

  it('slugifies relation paths so dots never reach a port name', () => {
    expect(generateFilterPortName({ id: 'x1', field: 'author.name' })).toBe('filter_author_name_x1');
  });

  it('falls back to a stable name when no field is chosen yet', () => {
    expect(generateFilterPortName({ id: 'x2', field: '' })).toBe('filter_value_x2');
  });

  it('takes the prefix from the node, because the three that own a filter disagree', () => {
    // BCN-003b: this builder now renders for the Parse family too, and those
    // nodes key their dynamic inputs on `qp-` and `fp-`. The `filter_` default
    // above is still what BYOB Query Data gets, and RUN-003's slice-5 test at
    // the top of this block is what says so.
    expect(generateFilterPortName({ id: 'abc123', field: 'status' }, 'qp-')).toBe('qp-status_abc123');
    expect(generateFilterPortName({ id: 'abc123', field: 'status' }, 'fp-')).toBe('fp-status_abc123');
  });
});

describe('the Parse schema, in the shape the one builder reads', () => {
  const schema = {
    properties: {
      name: { type: 'String' },
      age: { type: 'Number' },
      active: { type: 'Boolean' },
      born: { type: 'Date' },
      team: { type: 'Pointer', targetClass: 'Team' },
      avatar: { type: 'File' },
      at: { type: 'GeoPoint' },
      members: { type: 'Relation', targetClass: 'Person' }
    },
    relations: { Team: [{ property: 'members' }] }
  };

  it('keeps only the property types a filter can ask a question about', () => {
    // The four it drops are the four `QueryEditor` dropped, and the reason is
    // this phase's rule about capability: what cannot be expressed must be
    // visibly absent rather than offered and silently ineffective.
    expect(parseSchemaToCollection(schema, 'Person')?.fields).toEqual([
      { name: 'name', type: 'string' },
      { name: 'age', type: 'float' },
      { name: 'active', type: 'boolean' },
      { name: 'born', type: 'datetime' },
      { name: 'team', type: 'pointer', relatedCollection: 'Team' }
    ]);
  });

  it('reads relations the other way round from the column of the same name', () => {
    // A `Relation` *column* on Person is dropped above. `relations` is the
    // opposite direction — collections holding a relation that points AT
    // Person — and is what the "related to" rule offers.
    expect(parseSchemaToCollection(schema, 'Person')?.relations).toEqual([
      { className: 'Team', properties: ['members'] }
    ]);
  });

  it('tells the two schema shapes apart', () => {
    expect(isParseSchema(schema)).toBe(true);
    expect(isParseSchema({ collection: 'articles', fields: [{ name: 'title', type: 'string' }] })).toBe(false);
    expect(isParseSchema(null)).toBe(false);
  });
});

describe('the operator dropdown, gated by the backend that will answer it', () => {
  it('does not offer what the backend declares it cannot express', () => {
    const offered = getOperatorsForType('string', {
      matchesRegex: { state: 'unsupported', reason: 'Directus answers a regex on a string column with a 400.' }
    }).map((op) => op.key);
    expect(offered).not.toContain('matchesRegex');
    expect(offered).toContain('contains');
  });

  it("carries a degraded cell's own sentence, rather than writing a second one", () => {
    // BCN-003 put the operator declaration in the capability descriptor so the
    // sentence thrown at runtime and the one shown here are the same string.
    // Two hand-written explanations of one fact drift.
    const reason = 'Wildcards in your text are matched as wildcards.';
    const contains = getOperatorsForType('string', { contains: { state: 'degraded', reason } }).find(
      (op) => op.key === 'contains'
    );
    expect(contains?.caveat).toBe(reason);
  });

  it('offers everything when nothing has been declared, which is the safe floor', () => {
    // Silence in the table is not a refusal. Gating on absence could hide an
    // operator the backend can actually answer — the harmful direction.
    expect(getOperatorsForType('string').length).toBe(getOperatorsForType('string', {}).length);
  });

  it('offers a Pointer column the one question it has', () => {
    expect(getOperatorsForType('pointer').map((op) => op.key)).toEqual(['pointsTo', 'notExists', 'exists']);
  });
});

describe('ByobFilterBuilder Directus conversion', () => {
  it('converts a two-condition AND group', () => {
    const filter: FilterGroup = {
      id: 'root',
      type: 'and',
      conditions: [
        { id: 'c1', field: 'status', operator: 'equalTo', value: 'published' },
        { id: 'c2', field: 'rating', operator: 'greaterThan', value: '2' }
      ]
    };
    expect(toDirectusFilter(filter)).toEqual({
      _and: [{ status: { _eq: 'published' } }, { rating: { _gt: '2' } }]
    });
  });

  it('builds nested objects for relation paths', () => {
    const filter: FilterGroup = {
      id: 'root',
      type: 'and',
      conditions: [{ id: 'c1', field: 'author.name', operator: 'equalTo', value: 'Ada' }]
    };
    expect(toDirectusFilter(filter)).toEqual({ author: { name: { _eq: 'Ada' } } });
  });

  it('a connected condition converts like a static one — the runtime substitutes the port value before conversion', () => {
    const filter: FilterGroup = {
      id: 'root',
      type: 'and',
      conditions: [
        {
          id: 'c1',
          field: 'rating',
          operator: 'greaterThan',
          value: '',
          valueSource: 'connected',
          valuePortName: 'filter_rating_c1'
        }
      ]
    };
    expect(toDirectusFilter(filter)).toEqual({ rating: { _gt: '' } });
  });
});

describe('ByobFilterBuilder saved-filter migration', () => {
  it('reads a filter saved before BCN-003 and emits the payload it always emitted', () => {
    // "Migrate rather than break" is only true if a filter the old builder
    // saved, migrated and re-translated, asks the backend for the same thing.
    const savedByTheOldBuilder = {
      id: 'root',
      type: 'and' as const,
      conditions: [
        { id: 'c1', field: 'status', operator: '_eq', value: 'published' },
        { id: 'c2', field: 'author.name', operator: '_contains', value: 'Ada' },
        // `_null` is nullary where the neutral `exists` is boolean-valued, so
        // the migration writes a value as well as renaming the key. A rename
        // alone would have inverted the meaning of this condition.
        { id: 'c3', field: 'archived', operator: '_null', value: true }
      ]
    };

    const migrated = migrateSavedFilter(savedByTheOldBuilder as SavedFilterGroup);
    expect(toDirectusFilter(migrated as unknown as FilterGroup)).toEqual({
      _and: [{ status: { _eq: 'published' } }, { author: { name: { _contains: 'Ada' } } }, { archived: { _null: true } }]
    });
  });
});
