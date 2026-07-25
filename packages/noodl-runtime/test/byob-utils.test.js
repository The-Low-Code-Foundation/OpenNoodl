/**
 * byob-utils unit tests (RUN-003).
 *
 * Covers the shared helpers all four byob-* data nodes build on, including the
 * two field-shape contracts (RUN-003's seam bug): the nodes receive the CACHED
 * SchemaField shape from backendServices project metadata (parsed `hidden` /
 * `enumValues`, no `meta`), while the utils historically only understood raw
 * Directus /fields entries (`meta.hidden`, `meta.options.choices`). Both shapes
 * must work.
 */

jest.mock('../noodl-runtime', () => ({
  instance: { getMetaData: jest.fn() }
}));

const NoodlRuntime = require('../noodl-runtime');
const ByobUtils = require('../src/nodes/std-library/data/byob-utils');

describe('byob-utils', () => {
  beforeEach(() => {
    NoodlRuntime.instance.getMetaData.mockReset();
  });

  // ── resolveBackend ─────────────────────────────────────────────────────────

  describe('resolveBackend', () => {
    const metadata = {
      activeBackendId: 'b1',
      backends: [
        {
          id: 'b1',
          type: 'directus',
          url: 'http://localhost:8055',
          auth: { method: 'bearer', publicToken: 'pub-token', adminToken: 'admin-token' },
          endpoints: { list: '/items/{table}' }
        },
        { id: 'b2', type: 'supabase', url: 'https://x.supabase.co', auth: {}, endpoints: {} }
      ]
    };

    it('returns null when no metadata exists', () => {
      NoodlRuntime.instance.getMetaData.mockReturnValue(undefined);
      expect(ByobUtils.resolveBackend('_active_')).toBeNull();
    });

    it('resolves the active backend via the _active_ sentinel', () => {
      NoodlRuntime.instance.getMetaData.mockReturnValue(metadata);
      const resolved = ByobUtils.resolveBackend('_active_');
      expect(resolved.url).toBe('http://localhost:8055');
      expect(resolved.type).toBe('directus');
    });

    it('resolves a backend by explicit id', () => {
      NoodlRuntime.instance.getMetaData.mockReturnValue(metadata);
      expect(ByobUtils.resolveBackend('b2').type).toBe('supabase');
    });

    it('returns null for an unknown id', () => {
      NoodlRuntime.instance.getMetaData.mockReturnValue(metadata);
      expect(ByobUtils.resolveBackend('nope')).toBeNull();
    });

    it('exposes the PUBLIC token only — the admin token must never reach the runtime', () => {
      NoodlRuntime.instance.getMetaData.mockReturnValue(metadata);
      const resolved = ByobUtils.resolveBackend('b1');
      expect(resolved.token).toBe('pub-token');
      expect(JSON.stringify(resolved)).not.toContain('admin-token');
    });
  });

  // ── URL + header building ──────────────────────────────────────────────────

  describe('buildEndpoint / buildUrl / buildHeaders', () => {
    it('routes user collections through items/', () => {
      expect(ByobUtils.buildEndpoint('articles', 'items')).toBe('items/articles');
    });

    it('maps Directus system collections to their bare endpoints in system mode', () => {
      expect(ByobUtils.buildEndpoint('directus_users', 'system')).toBe('users');
      expect(ByobUtils.buildEndpoint('directus_files', 'system')).toBe('files');
    });

    it('falls back to items/ for unknown collections even in system mode', () => {
      expect(ByobUtils.buildEndpoint('not_a_system_table', 'system')).toBe('items/not_a_system_table');
    });

    it('builds a full URL, stripping trailing slashes and appending record ids', () => {
      const backend = { url: 'http://localhost:8055/' };
      expect(ByobUtils.buildUrl(backend, 'articles', 'items')).toBe('http://localhost:8055/items/articles');
      expect(ByobUtils.buildUrl(backend, 'articles', 'items', '42')).toBe('http://localhost:8055/items/articles/42');
    });

    it('returns null without a base url or collection', () => {
      expect(ByobUtils.buildUrl({ url: '' }, 'articles', 'items')).toBeNull();
      expect(ByobUtils.buildUrl({ url: 'http://x' }, '', 'items')).toBeNull();
    });

    it('adds a bearer Authorization header only when a token exists', () => {
      expect(ByobUtils.buildHeaders('tok')).toEqual({
        'Content-Type': 'application/json',
        Authorization: 'Bearer tok'
      });
      expect(ByobUtils.buildHeaders('')).toEqual({ 'Content-Type': 'application/json' });
    });
  });

  // ── system-collection helpers ──────────────────────────────────────────────

  describe('system collections', () => {
    it('detects directus_* names', () => {
      expect(ByobUtils.isSystemCollection('directus_users')).toBe(true);
      expect(ByobUtils.isSystemCollection('articles')).toBe(false);
      expect(ByobUtils.detectApiPathMode('directus_files')).toBe('system');
      expect(ByobUtils.detectApiPathMode('articles')).toBe('items');
    });

    it('filters collections by mode', () => {
      const collections = [{ name: 'articles' }, { name: 'directus_users' }];
      expect(ByobUtils.filterCollectionsByMode(collections, 'items').map((c) => c.name)).toEqual(['articles']);
      expect(ByobUtils.filterCollectionsByMode(collections, 'system').map((c) => c.name)).toEqual(['directus_users']);
      expect(ByobUtils.filterCollectionsByMode(collections, undefined).map((c) => c.name)).toEqual(['articles']);
    });
  });

  // ── normalizeValue ─────────────────────────────────────────────────────────

  describe('normalizeValue', () => {
    it('passes null/undefined through', () => {
      expect(ByobUtils.normalizeValue(null, { type: 'dateTime' })).toBeNull();
      expect(ByobUtils.normalizeValue(undefined, { type: 'dateTime' })).toBeUndefined();
    });

    it('converts Date objects to ISO strings for date-ish fields', () => {
      const d = new Date('2026-07-25T10:00:00.000Z');
      expect(ByobUtils.normalizeValue(d, { type: 'timestamp' })).toBe('2026-07-25T10:00:00.000Z');
    });

    it('keeps already-ISO strings as-is', () => {
      expect(ByobUtils.normalizeValue('2026-07-25T10:00:00.000Z', { type: 'dateTime' })).toBe(
        '2026-07-25T10:00:00.000Z'
      );
    });

    it('leaves non-date fields untouched', () => {
      expect(ByobUtils.normalizeValue('hello', { type: 'string' })).toBe('hello');
      expect(ByobUtils.normalizeValue(5, { type: 'integer' })).toBe(5);
    });
  });

  // ── shouldShowField: both field shapes ─────────────────────────────────────

  describe('shouldShowField', () => {
    it('rejects fields without a name', () => {
      expect(ByobUtils.shouldShowField(null)).toBe(false);
      expect(ByobUtils.shouldShowField({})).toBe(false);
    });

    it('cached SchemaField shape: honours the parsed hidden flag', () => {
      expect(ByobUtils.shouldShowField({ name: 'internal_notes', hidden: true })).toBe(false);
      expect(ByobUtils.shouldShowField({ name: 'title' })).toBe(true);
    });

    it('raw Directus shape: skips meta.hidden and presentation-* interfaces', () => {
      expect(ByobUtils.shouldShowField({ name: 'x', meta: { hidden: true } })).toBe(false);
      expect(ByobUtils.shouldShowField({ name: 'x', meta: { interface: 'presentation-divider' } })).toBe(false);
      expect(ByobUtils.shouldShowField({ name: 'x', meta: { interface: 'input' } })).toBe(true);
    });
  });

  // ── getEnhancedFieldType: both field shapes ────────────────────────────────

  describe('getEnhancedFieldType', () => {
    it('cached SchemaField shape: builds an enum port from enumValues (the shape nodes actually receive)', () => {
      const port = ByobUtils.getEnhancedFieldType({
        name: 'status',
        type: 'string',
        enumValues: ['draft', 'published', 'archived']
      });
      expect(port.type.name).toBe('enum');
      expect(port.type.enums).toEqual([
        { label: 'draft', value: 'draft' },
        { label: 'published', value: 'published' },
        { label: 'archived', value: 'archived' }
      ]);
    });

    it('raw Directus shape: builds an enum port with choice labels preserved', () => {
      const port = ByobUtils.getEnhancedFieldType({
        name: 'status',
        type: 'string',
        meta: {
          interface: 'select-dropdown',
          options: { choices: [{ text: 'Draft', value: 'draft' }] }
        }
      });
      expect(port.type.name).toBe('enum');
      expect(port.type.enums).toEqual([{ label: 'Draft', value: 'draft' }]);
    });

    it('an empty enumValues array does not produce an enum port', () => {
      expect(ByobUtils.getEnhancedFieldType({ name: 'x', type: 'string', enumValues: [] }).type).toBe('string');
    });

    it('maps numeric, boolean and json types', () => {
      expect(ByobUtils.getEnhancedFieldType({ name: 'n', type: 'integer' }).type).toBe('number');
      expect(ByobUtils.getEnhancedFieldType({ name: 'n', type: 'float' }).type).toBe('number');
      expect(ByobUtils.getEnhancedFieldType({ name: 'b', type: 'boolean' }).type).toBe('boolean');
      expect(ByobUtils.getEnhancedFieldType({ name: 'j', type: 'json' }).type).toBe('object');
    });

    it('gives date-ish and uuid types a string port with a format placeholder', () => {
      expect(ByobUtils.getEnhancedFieldType({ name: 't', type: 'timestamp' }).placeholder).toBe(
        'YYYY-MM-DDTHH:mm:ss.sssZ'
      );
      expect(ByobUtils.getEnhancedFieldType({ name: 'd', type: 'date' }).placeholder).toBe('YYYY-MM-DD');
      expect(ByobUtils.getEnhancedFieldType({ name: 'u', type: 'uuid' }).placeholder).toMatch(/^x{8}-/);
    });

    it('falls back to string for unknown types', () => {
      expect(ByobUtils.getEnhancedFieldType({ name: 'x', type: 'geometry' }).type).toBe('string');
    });
  });

  // ── pickTotalCount ──────────────────────────────────────────────────────────

  describe('pickTotalCount', () => {
    it('prefers filter_count over total_count — a filtered list paginates against the filtered total', () => {
      expect(ByobUtils.pickTotalCount({ total_count: 100, filter_count: 7 }, [{}, {}])).toBe(7);
    });

    it('a filter_count of 0 is a real answer, not a missing one', () => {
      expect(ByobUtils.pickTotalCount({ total_count: 100, filter_count: 0 }, [])).toBe(0);
    });

    it('falls back to total_count when no filter_count was returned', () => {
      expect(ByobUtils.pickTotalCount({ total_count: 42 }, [{}])).toBe(42);
    });

    it('falls back to the page length without meta', () => {
      expect(ByobUtils.pickTotalCount(undefined, [{}, {}, {}])).toBe(3);
      expect(ByobUtils.pickTotalCount(null, null)).toBe(0);
    });
  });
});

// ── connected filter-value ports (byob-query-data) ────────────────────────────

describe('byob-query-data parseFilterForConnectedPorts', () => {
  const { parseFilterForConnectedPorts } = require('../src/nodes/std-library/data/byob-query-data');

  it('returns no ports for an empty or non-JSON filter', () => {
    expect(parseFilterForConnectedPorts('')).toEqual([]);
    expect(parseFilterForConnectedPorts('   ')).toEqual([]);
    expect(parseFilterForConnectedPorts('not json')).toEqual([]);
  });

  it('ignores raw Directus-format filters (no builder conditions array)', () => {
    expect(parseFilterForConnectedPorts(JSON.stringify({ status: { _eq: 'published' } }))).toEqual([]);
  });

  it('finds connected conditions, including in nested groups, and skips static ones', () => {
    const filter = {
      id: 'root',
      type: 'and',
      conditions: [
        { id: 'c1', field: 'status', operator: '_eq', value: 'published' }, // static
        {
          id: 'c2',
          field: 'rating',
          operator: '_gt',
          value: '',
          valueSource: 'connected',
          valuePortName: 'filter_rating_c2'
        },
        {
          id: 'g1',
          type: 'or',
          conditions: [
            {
              id: 'c3',
              field: 'author.name',
              operator: '_eq',
              value: '',
              valueSource: 'connected',
              valuePortName: 'filter_author_name_c3'
            }
          ]
        }
      ]
    };

    const ports = parseFilterForConnectedPorts(JSON.stringify(filter));
    expect(ports).toEqual([
      { portName: 'filter_rating_c2', field: 'rating', operator: '_gt', conditionId: 'c2' },
      { portName: 'filter_author_name_c3', field: 'author.name', operator: '_eq', conditionId: 'c3' }
    ]);
  });

  it('a connected condition without a port name yields no port', () => {
    const filter = {
      id: 'root',
      type: 'and',
      conditions: [{ id: 'c1', field: 'x', operator: '_eq', value: '', valueSource: 'connected' }]
    };
    expect(parseFilterForConnectedPorts(JSON.stringify(filter))).toEqual([]);
  });
});
