/**
 * RUN-003 slice 5: unit tests for the ByobFilterBuilder's pure logic —
 * the connected-value port-name contract and the Directus filter conversion
 * it feeds. The runtime side of the same contract (parseFilterForConnectedPorts,
 * filter-value resolution) is covered in noodl-runtime/test/byob-utils.test.js;
 * the port names generated here MUST keep the `filter_` prefix that
 * byob-query-data.js uses to recognise its dynamic inputs.
 */

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
        { id: 'c1', field: 'status', operator: '_eq', value: 'published' },
        { id: 'c2', field: 'rating', operator: '_gt', value: '2' }
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
      conditions: [{ id: 'c1', field: 'author.name', operator: '_eq', value: 'Ada' }]
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
          operator: '_gt',
          value: '',
          valueSource: 'connected',
          valuePortName: 'filter_rating_c1'
        }
      ]
    };
    expect(toDirectusFilter(filter)).toEqual({ rating: { _gt: '' } });
  });
});
