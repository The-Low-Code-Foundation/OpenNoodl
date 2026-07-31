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
