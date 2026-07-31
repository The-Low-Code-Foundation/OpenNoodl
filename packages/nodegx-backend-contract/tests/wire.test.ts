/**
 * The wire profiles, and the two pieces of them that can be wrong without
 * erroring.
 *
 * Every expectation here is pinned to a measurement in
 * `BCN-004-WIRE-FACTS.md`, so a profile edited to disagree with the servers
 * fails here rather than in a user's app. The probe output is the source; these
 * are its assertions in a form CI can run without docker.
 */

import {
  REST_WIRE_PROFILES,
  paginationParams,
  readRecord,
  readRows,
  readTotalCount,
  restWireProfileFor,
  type RestWireProfile
} from '../src/wire';

const directus = REST_WIRE_PROFILES.directus;
const supabase = REST_WIRE_PROFILES.supabase;
const pocketbase = REST_WIRE_PROFILES.pocketbase;

/** A minimal stand-in for the `Headers` shape `readTotalCount` accepts. */
function headers(map: Record<string, string>) {
  return { get: (n: string) => map[n.toLowerCase()] ?? null };
}

describe('which backends have a REST profile', () => {
  it('serves the three REST backends', () => {
    expect(restWireProfileFor('directus')).toBeDefined();
    expect(restWireProfileFor('supabase')).toBeDefined();
    expect(restWireProfileFor('pocketbase')).toBeDefined();
  });

  it('has none for the Parse-wire backends, which ParseWireAdapter already serves', () => {
    // Not an oversight. A second description of a wire that already has a
    // working adapter is the duplication this phase exists to remove.
    expect(restWireProfileFor('nodegx')).toBeUndefined();
    expect(restWireProfileFor('parse')).toBeUndefined();
  });

  it('has none for custom, whose endpoints are the user’s to declare', () => {
    expect(restWireProfileFor('custom')).toBeUndefined();
  });
});

describe('the total count, per the measured wire', () => {
  // The finding. The preset says `meta.total_count`; the server says that number
  // ignores the filter.
  it('Directus reads filter_count, NOT total_count', () => {
    expect(directus.totalCount).toEqual({ kind: 'body-path', path: 'meta.filter_count' });

    const filtered = { data: [{ id: 1 }], meta: { total_count: 3, filter_count: 2 } };
    expect(readTotalCount(directus, filtered, undefined, 1)).toBe(2);
  });

  it('PocketBase reads totalItems, which the server applies the filter to', () => {
    const body = { items: [{ id: 'a' }], page: 1, perPage: 1, totalItems: 2, totalPages: 2 };
    expect(readTotalCount(pocketbase, body, undefined, 1)).toBe(2);
  });

  it('Supabase reads Content-Range, because the total is not in the body', () => {
    expect(readTotalCount(supabase, [{ id: 1 }], headers({ 'content-range': '0-0/1' }), 1)).toBe(1);
  });

  it('Supabase reports undefined — not zero — when the count was not requested', () => {
    // `*` is PostgREST for "you did not send Prefer: count=exact, so I did not
    // count". Reporting 0 here would be a plausible wrong number, which is the
    // failure class this phase keeps finding.
    expect(readTotalCount(supabase, [{ id: 1 }], headers({ 'content-range': '0-0/*' }), 1)).toBeUndefined();
  });

  it('reports undefined when the header is absent altogether', () => {
    expect(readTotalCount(supabase, [], headers({}), 0)).toBeUndefined();
  });

  it('declares the header that has to be sent to get a total at all', () => {
    expect(supabase.countRequestHeaders).toEqual({ Prefer: 'count=exact' });
  });
});

describe('pagination', () => {
  it('passes a row offset straight through on an offset wire', () => {
    expect(paginationParams(directus, 10, 20)).toEqual({
      params: { limit: '10', offset: '20' },
      inexact: false
    });
  });

  it('omits offset entirely when there is none', () => {
    // `offset=0` is noise on every request in the product.
    expect(paginationParams(directus, 10, 0)).toEqual({ params: { limit: '10' }, inexact: false });
  });

  // The second finding. The preset calls PocketBase's `page` an `offsetParam`,
  // which invites passing `skip` through unchanged.
  it('converts a row offset to a 1-based page on PocketBase', () => {
    expect(paginationParams(pocketbase, 10, 0)).toEqual({ params: { perPage: '10' }, inexact: false });
    expect(paginationParams(pocketbase, 10, 10)).toEqual({
      params: { perPage: '10', page: '2' },
      inexact: false
    });
    expect(paginationParams(pocketbase, 10, 90)).toEqual({
      params: { perPage: '10', page: '10' },
      inexact: false
    });
  });

  it('does NOT send skip as the page number', () => {
    // What the preset's naming invites: skip=10 becoming page=10, i.e. rows
    // 90-99 instead of rows 10-19. Measured on the real server.
    const { params } = paginationParams(pocketbase, 10, 10);
    expect(params.page).not.toBe('10');
    expect(params.page).toBe('2');
  });

  it('reports inexact when a row offset is not a whole number of pages', () => {
    // A page wire cannot express skip=5, limit=10. Rounding to page 1 silently
    // would return rows 0-9 as though they were rows 5-14.
    expect(paginationParams(pocketbase, 10, 5)).toEqual({
      params: { perPage: '10', page: '1' },
      inexact: true
    });
  });

  it('reports inexact rather than inventing a page when there is no page size', () => {
    expect(paginationParams(pocketbase, undefined, 30)).toEqual({ params: {}, inexact: true });
  });

  it('records that PocketBase pages start at 1', () => {
    // page=0 clamps to page 1 on the real server, so an off-by-one here is
    // invisible on the first page and wrong on every later one.
    expect(pocketbase.pagination).toMatchObject({ kind: 'page', firstPage: 1 });
  });
});

describe('reading rows out of a response', () => {
  it('Directus rows live under data', () => {
    expect(readRows(directus, { data: [{ id: 1 }, { id: 2 }], meta: {} })).toHaveLength(2);
  });

  it('PocketBase rows live under items', () => {
    expect(readRows(pocketbase, { items: [{ id: 'a' }], totalItems: 1 })).toHaveLength(1);
  });

  it('Supabase returns a bare array, so there is no path to follow', () => {
    expect(supabase.dataPath).toBe('');
    expect(readRows(supabase, [{ id: 1 }, { id: 2 }])).toHaveLength(2);
  });

  it('yields an empty array when the shape is not what the profile expects', () => {
    // A 200 with an unexpected body is a real thing; the caller's error channel
    // is a better place to notice it than a TypeError in here.
    expect(readRows(directus, { unexpected: true })).toEqual([]);
    expect(readRows(supabase, { not: 'an array' })).toEqual([]);
  });
});

describe('reading the single record a create hands back', () => {
  it('Directus wraps it in data', () => {
    expect(readRecord(directus, { data: { id: 4, name: 'Ada' } })).toEqual({ id: 4, name: 'Ada' });
  });

  it('PocketBase returns it at the top level', () => {
    expect(readRecord(pocketbase, { id: 'abc', name: 'Ada' })).toEqual({ id: 'abc', name: 'Ada' });
  });

  it('Supabase returns an array of one, which is unwrapped', () => {
    expect(readRecord(supabase, [{ id: 4, title: 'x' }])).toEqual({ id: 4, title: 'x' });
  });

  // ⚠️ The third finding, and the one that fails silently on a success status.
  it('reports undefined for the empty body a Supabase create answers without Prefer', () => {
    // Measured: POST /articles -> 201 with an empty body unless
    // `Prefer: return=representation` is sent. `create`s success callback takes
    // an AdapterRecord, so mistaking this for a record hands a node nothing and
    // reports no error.
    expect(readRecord(supabase, '')).toBeUndefined();
    expect(readRecord(supabase, null)).toBeUndefined();
    expect(readRecord(supabase, [])).toBeUndefined();
  });

  it('declares the header that makes a Supabase create return its row', () => {
    expect(supabase.createRequestHeaders).toEqual({ Prefer: 'return=representation' });
    expect(supabase.createResponse).toEqual({ kind: 'array-of-one' });
  });
});

describe('the profiles agree with what the probe recorded', () => {
  const cases: Array<[string, RestWireProfile, { list: string; auth: string; id: string }]> = [
    ['directus', directus, { list: '/items/{collection}', auth: 'bearer', id: 'id' }],
    ['supabase', supabase, { list: '/rest/v1/{collection}', auth: 'bearer', id: 'id' }],
    [
      'pocketbase',
      pocketbase,
      { list: '/api/collections/{collection}/records', auth: 'bearer', id: 'id' }
    ]
  ];

  it.each(cases)('%s', (_name, profile, expected) => {
    expect(profile.listPath).toBe(expected.list);
    expect(profile.auth).toBe(expected.auth);
    expect(profile.idField).toBe(expected.id);
  });

  it('sends the Supabase anon key as apikey as well as a bearer', () => {
    expect(supabase.tokenHeaders).toEqual(['apikey']);
  });
});
