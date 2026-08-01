/**
 * BCN-004 — `RestDataAdapter`, against an injected fetch.
 *
 * The honest framing, the same one `parse-wire-adapter.test.ts` opens with:
 * **this suite cannot prove the task.** Three real servers disagree with
 * documentation in ways no fake can reproduce, which is why the live driver
 * (`uba-e2e/bcn-004-rest-driver.mjs`) exists and is the deliverable. What these
 * tests pin is the set of things that would be **silent** if they were wrong —
 * each one a plausible wrong value rather than an error:
 *
 * 1. The Directus total comes from `filter_count`, not `total_count`. The
 *    second is the RUN-003 defect and it returns the size of the whole
 *    collection on a filtered query.
 * 2. A PocketBase row offset becomes a **1-based page**, and an offset that is
 *    not a whole number of pages is **refused** rather than rounded — rounding
 *    returns rows 0–9 as if they were rows 5–14.
 * 3. `aggregate` and `distinct` on PocketBase **refuse**. PocketBase answers
 *    200 with un-aggregated rows for every spelling, so nothing downstream can
 *    catch it.
 * 4. A create that comes back with an empty body is an **error**, never a
 *    success with an empty record.
 * 5. `Prefer: return=representation` is sent on a create **and** on a save.
 * 6. A record's identity arrives at the caller as `objectId`.
 */
jest.mock('../../noodl-runtime', () => ({
  instance: { getMetaData: () => undefined }
}));

import { DATA_ADAPTER_METHODS } from '@noodl/backend-contract';
import type { BackendHandle, RelationDescriptor, UploadFileOptions } from '@noodl/backend-contract';

import {
  RestDataAdapter,
  readAggregateValue,
  readGroupMember,
  stripServerOwned,
  type FetchLike
} from '../../src/api/backends/RestDataAdapter';

// ── A fetch that records what it was asked and answers what it was told ────

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

interface Reply {
  status?: number;
  body?: unknown;
  /** Raw text, for the empty-body cases a JSON body cannot express. */
  text?: string;
  headers?: Record<string, string>;
}

/** A JSON body, or the raw string when it is not JSON at all. */
function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

class FakeFetch {
  readonly calls: Call[] = [];
  private replies: Reply[] = [];

  /** Queue the next reply (or replies, in order). */
  reply(...replies: Reply[]): this {
    this.replies.push(...replies);
    return this;
  }

  get last(): Call {
    return this.calls[this.calls.length - 1];
  }

  /** The query string of the nth call, parsed. Repeated keys are kept. */
  params(index = this.calls.length - 1): Array<[string, string]> {
    const query = this.calls[index].url.split('?')[1] ?? '';
    return Array.from(new URLSearchParams(query).entries());
  }

  param(name: string, index = this.calls.length - 1): string | undefined {
    const found = this.params(index).find(([key]) => key === name);
    return found ? found[1] : undefined;
  }

  readonly impl: FetchLike = (url, init) => {
    this.calls.push({
      url,
      method: init?.method ?? 'GET',
      headers: init?.headers ?? {},
      // ⚠️ BCN-007 widened `FetchLike`'s body beyond `string`, and this used to
      // be an unconditional `JSON.parse`. A `FormData` body would have thrown
      // here — which is the *good* failure — but a raw-bytes body would not,
      // and either way the recorded call has to keep the body a test can look
      // inside. So the non-string shapes are kept as-is and asserted on
      // directly (`instanceof FormData`, `body.get('file')`).
      body:
        init?.body === undefined
          ? undefined
          : typeof init.body === 'string'
            ? safeParse(init.body)
            : init.body
    });

    const reply = this.replies.shift() ?? { status: 200, body: {} };
    const text = reply.text !== undefined ? reply.text : reply.body === undefined ? '' : JSON.stringify(reply.body);
    const headers = reply.headers ?? {};

    return Promise.resolve({
      status: reply.status ?? 200,
      headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
      text: () => Promise.resolve(text)
    });
  };
}

const directus: BackendHandle = {
  id: 'd1',
  type: 'directus',
  name: 'Directus',
  url: 'https://directus.example',
  publicToken: 'tok-d'
};
const supabase: BackendHandle = {
  id: 's1',
  type: 'supabase',
  name: 'Supabase',
  url: 'https://project.supabase.co',
  publicToken: 'anon-key'
};
const pocketbase: BackendHandle = {
  id: 'p1',
  type: 'pocketbase',
  name: 'PocketBase',
  url: 'https://pb.example',
  publicToken: 'tok-p'
};

/** Let the adapter's promise chain settle. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

function make(fake: FakeFetch, options: Record<string, unknown> = {}) {
  return new RestDataAdapter(Object.assign({ fetchImpl: fake.impl }, options));
}

// ── The contract's shape ───────────────────────────────────────────────────

describe('the contract', () => {
  it('implements exactly the fourteen data methods', () => {
    const adapter = make(new FakeFetch());
    for (const method of DATA_ADAPTER_METHODS) {
      expect(typeof (adapter as unknown as Record<string, unknown>)[method]).toBe('function');
    }
  });

  it('refuses a backend it does not serve, rather than building a Directus URL for it', async () => {
    const fake = new FakeFetch();
    const error = jest.fn();
    make(fake).query({ ...directus, type: 'parse' }, { collection: 'a', success: jest.fn(), error });
    await settle();
    expect(fake.calls).toHaveLength(0);
    expect(error.mock.calls[0][0]).toMatch(/not served by the REST adapter/);
  });
});

// ── Directus ───────────────────────────────────────────────────────────────

describe('directus', () => {
  it('sends a translated filter, and asks for the counts', async () => {
    const fake = new FakeFetch().reply({ body: { meta: { total_count: 5, filter_count: 3 }, data: [{ id: 1, name: 'Ada' }] } });
    const success = jest.fn();

    make(fake).query(directus, {
      collection: 'people',
      where: { tag: { equalTo: 'x' } },
      count: true,
      limit: 2,
      success,
      error: jest.fn()
    });
    await settle();

    expect(fake.last.url).toContain('https://directus.example/items/people?');
    expect(JSON.parse(fake.param('filter')!)).toEqual({ tag: { _eq: 'x' } });
    expect(fake.param('meta')).toBe('total_count,filter_count');
    expect(fake.param('limit')).toBe('2');
    expect(fake.last.headers.Authorization).toBe('Bearer tok-d');
    expect(success).toHaveBeenCalledWith([{ objectId: 1, name: 'Ada' }], 3);
  });

  it('⚠️ takes the total from filter_count, not total_count', async () => {
    // The RUN-003 defect, and the preset still points at the other field. Three
    // of five rows match; `total_count` would say five.
    const fake = new FakeFetch().reply({ body: { meta: { total_count: 5, filter_count: 3 }, data: [] } });
    const success = jest.fn();

    make(fake).query(directus, { collection: 'people', count: true, success, error: jest.fn() });
    await settle();

    expect(success.mock.calls[0][1]).toBe(3);
    expect(success.mock.calls[0][1]).not.toBe(5);
  });

  it('does not report a total that was not asked for', async () => {
    const fake = new FakeFetch().reply({ body: { meta: { filter_count: 3 }, data: [] } });
    const success = jest.fn();
    make(fake).query(directus, { collection: 'people', success, error: jest.fn() });
    await settle();
    expect(success.mock.calls[0][1]).toBeUndefined();
    expect(fake.param('meta')).toBeUndefined();
  });

  it('expands included relations into the fields parameter', async () => {
    const fake = new FakeFetch().reply({ body: { data: [] } });
    make(fake).query(directus, { collection: 'articles', include: ['author'], success: jest.fn(), error: jest.fn() });
    await settle();
    expect(fake.param('fields')).toBe('*,author.*');
  });

  it('counts with limit=0', async () => {
    const fake = new FakeFetch().reply({ body: { meta: { filter_count: 3 }, data: [] } });
    const success = jest.fn();
    make(fake).count(directus, { collection: 'people', where: { tag: { equalTo: 'x' } }, success, error: jest.fn() });
    await settle();
    expect(fake.param('limit')).toBe('0');
    expect(success).toHaveBeenCalledWith(3);
  });

  it('reads distinct values out of a groupBy', async () => {
    const fake = new FakeFetch().reply({ body: { data: [{ tag: 'x' }, { tag: 'y' }] } });
    const success = jest.fn();
    make(fake).distinct(directus, { collection: 'people', property: 'tag', success, error: jest.fn() });
    await settle();
    expect(fake.param('groupBy')).toBe('tag');
    expect(success).toHaveBeenCalledWith(['x', 'y']);
  });

  it('reads both aggregate response shapes', async () => {
    // Measured: `aggregate[count]=*` answers flat, `aggregate[max]=rating`
    // answers nested under the field name.
    const fake = new FakeFetch().reply({ body: { data: [{ count: 5, max: { rating: 9 } }] } });
    const success = jest.fn();
    make(fake).aggregate(directus, {
      collection: 'people',
      group: { total: { count: '*' }, best: { max: 'rating' } },
      success,
      error: jest.fn()
    });
    await settle();
    expect(fake.param('aggregate[count]')).toBe('*');
    expect(fake.param('aggregate[max]')).toBe('rating');
    expect(success).toHaveBeenCalledWith({ total: 5, best: 9 });
  });

  it('increments by reading and writing back, because Directus has no atomic one', async () => {
    const fake = new FakeFetch()
      .reply({ body: { data: { id: 7, rating: 5 } } })
      .reply({ body: { data: { id: 7, rating: 8 } } });
    const success = jest.fn();

    make(fake).increment(directus, {
      collection: 'people',
      objectId: '7',
      properties: { rating: 3 },
      success,
      error: jest.fn()
    });
    await settle();
    await settle();

    expect(fake.calls).toHaveLength(2);
    expect(fake.calls[1].method).toBe('PATCH');
    expect(fake.calls[1].body).toEqual({ rating: 8 });
    expect(success).toHaveBeenCalledWith({ objectId: 7, rating: 8 });
  });

  it('accepts a 204 with no body as a successful delete', async () => {
    const fake = new FakeFetch().reply({ status: 204, text: '' });
    const success = jest.fn();
    const error = jest.fn();
    make(fake).delete(directus, { collection: 'people', objectId: '7', success, error });
    await settle();
    expect(fake.last.method).toBe('DELETE');
    expect(success).toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('turns the Directus error envelope into a sentence', async () => {
    const fake = new FakeFetch().reply({
      status: 403,
      body: { errors: [{ message: "You don't have permission to access collection \"nope\".", extensions: { code: 'FORBIDDEN' } }] }
    });
    const error = jest.fn();
    make(fake).query(directus, { collection: 'nope', success: jest.fn(), error });
    await settle();
    expect(error.mock.calls[0][0]).toMatch(/don't have permission/);
  });
});

// ── Supabase / PostgREST ───────────────────────────────────────────────────

describe('supabase', () => {
  it('sends the filter as query parameters, with the anon key in both places', async () => {
    const fake = new FakeFetch().reply({ body: [{ id: 1, title: 'Ada' }] });
    const success = jest.fn();

    make(fake).query(supabase, {
      collection: 'articles',
      where: { status: { equalTo: 'published' } },
      success,
      error: jest.fn()
    });
    await settle();

    expect(fake.last.url).toContain('/rest/v1/articles?');
    expect(fake.param('status')).toBe('eq.published');
    expect(fake.last.headers.Authorization).toBe('Bearer anon-key');
    expect(fake.last.headers.apikey).toBe('anon-key');
    expect(success).toHaveBeenCalledWith([{ objectId: 1, title: 'Ada' }], undefined);
  });

  it('⚠️ asks for the count with a Prefer header and reads it from Content-Range', async () => {
    const fake = new FakeFetch().reply({ body: [], headers: { 'content-range': '0-0/3' } });
    const success = jest.fn();
    make(fake).query(supabase, { collection: 'articles', count: true, success, error: jest.fn() });
    await settle();
    expect(fake.last.headers.Prefer).toBe('count=exact');
    expect(success.mock.calls[0][1]).toBe(3);
  });

  it('⚠️ reports "did not count" as an error, not as zero', async () => {
    // `*` is PostgREST for "you did not ask, so I did not count".
    const fake = new FakeFetch().reply({ body: [], headers: { 'content-range': '0-0/*' } });
    const success = jest.fn();
    const error = jest.fn();
    make(fake).count(supabase, { collection: 'articles', success, error });
    await settle();
    expect(success).not.toHaveBeenCalled();
    expect(error.mock.calls[0][0]).toMatch(/did not report a total/);
  });

  it('adds !inner embeds for a filter on a related field', async () => {
    const fake = new FakeFetch().reply({ body: [] });
    make(fake).query(supabase, {
      collection: 'articles',
      where: { 'author.name': { equalTo: 'Ada' } },
      success: jest.fn(),
      error: jest.fn()
    });
    await settle();
    expect(fake.param('select')).toBe('*,author!inner(*)');
    expect(fake.param('author.name')).toBe('eq.Ada');
  });

  it('converts sort into PostgREST order', async () => {
    const fake = new FakeFetch().reply({ body: [] });
    make(fake).query(supabase, { collection: 'articles', sort: ['-rating', 'title'], success: jest.fn(), error: jest.fn() });
    await settle();
    expect(fake.param('order')).toBe('rating.desc,title.asc');
  });

  it('⚠️ sends Prefer: return=representation on a create and unwraps the array of one', async () => {
    const fake = new FakeFetch().reply({ status: 201, body: [{ id: 4, title: 'New' }] });
    const success = jest.fn();
    make(fake).create(supabase, { collection: 'articles', data: { title: 'New' }, success, error: jest.fn() });
    await settle();
    expect(fake.last.headers.Prefer).toBe('return=representation');
    expect(success).toHaveBeenCalledWith({ objectId: 4, title: 'New' });
  });

  it('⚠️ an empty create body is an error, never an empty success', async () => {
    // A 201 with no body is what PostgREST answers without the Prefer header.
    // Calling `success(undefined)` here is the silent failure the whole profile
    // exists to prevent.
    const fake = new FakeFetch().reply({ status: 201, text: '' });
    const success = jest.fn();
    const error = jest.fn();
    make(fake).create(supabase, { collection: 'articles', data: { title: 'New' }, success, error });
    await settle();
    expect(success).not.toHaveBeenCalled();
    expect(error.mock.calls[0][0]).toMatch(/returned nothing to identify it/);
  });

  it('⚠️ sends the same Prefer header on a save, which the profile only names for create', async () => {
    const fake = new FakeFetch().reply({ body: [{ id: 4, title: 'Edited' }] });
    const success = jest.fn();
    make(fake).save(supabase, { collection: 'articles', objectId: '4', data: { title: 'Edited' }, success, error: jest.fn() });
    await settle();
    expect(fake.last.method).toBe('PATCH');
    expect(fake.last.headers.Prefer).toBe('return=representation');
    expect(fake.last.url).toContain('id=eq.4');
    expect(success).toHaveBeenCalledWith({ objectId: 4, title: 'Edited' });
  });

  it('addresses one record by a primary-key filter, because the path has no {id}', async () => {
    const fake = new FakeFetch().reply({ body: [{ id: 4, title: 'One' }] });
    const success = jest.fn();
    make(fake).fetch(supabase, { collection: 'articles', objectId: '4', success, error: jest.fn() });
    await settle();
    expect(fake.param('id')).toBe('eq.4');
    expect(success).toHaveBeenCalledWith({ objectId: 4, title: 'One' });
  });

  it('refuses aggregate until a probe settles the conditional cell', async () => {
    const fake = new FakeFetch();
    const error = jest.fn();
    make(fake).aggregate(supabase, { collection: 'articles', group: { n: { count: '*' } }, success: jest.fn(), error });
    await settle();
    expect(fake.calls).toHaveLength(0);
    expect(error.mock.calls[0][0]).toMatch(/switched on for your Supabase project/);
  });

  it('aggregates with aliased selects once the cell is probed', async () => {
    const fake = new FakeFetch().reply({ body: [{ n: 7, total: 25 }] });
    const success = jest.fn();
    make(fake, { probedCapabilities: ['data.aggregate'] }).aggregate(supabase, {
      collection: 'articles',
      group: { n: { count: '*' }, total: { sum: 'rating' } },
      success,
      error: jest.fn()
    });
    await settle();
    expect(fake.param('select')).toBe('n:count(),total:rating.sum()');
    expect(success).toHaveBeenCalledWith({ n: 7, total: 25 });
  });

  it('refuses distinct with the descriptor sentence', async () => {
    const fake = new FakeFetch();
    const error = jest.fn();
    make(fake).distinct(supabase, { collection: 'articles', property: 'status', success: jest.fn(), error });
    await settle();
    expect(fake.calls).toHaveLength(0);
    expect(error.mock.calls[0][0]).toMatch(/no way to list the distinct values/);
  });

  it('turns the PostgREST error envelope into a sentence, hint included', async () => {
    const fake = new FakeFetch().reply({
      status: 400,
      body: { code: '42703', details: null, hint: 'Perhaps you meant "title"', message: 'column articles.nosuch does not exist' }
    });
    const error = jest.fn();
    make(fake).query(supabase, { collection: 'articles', success: jest.fn(), error });
    await settle();
    expect(error.mock.calls[0][0]).toBe('column articles.nosuch does not exist (Perhaps you meant "title")');
  });
});

// ── PocketBase ─────────────────────────────────────────────────────────────

describe('pocketbase', () => {
  it('binds the filter expression and reads the filter-aware total', async () => {
    const fake = new FakeFetch().reply({
      body: { items: [{ id: 'abc', name: 'Ada' }], page: 1, perPage: 2, totalItems: 3, totalPages: 2 }
    });
    const success = jest.fn();

    make(fake).query(pocketbase, {
      collection: 'people',
      where: { tag: { equalTo: 'x' } },
      count: true,
      limit: 2,
      success,
      error: jest.fn()
    });
    await settle();

    expect(fake.last.url).toContain('/api/collections/people/records?');
    expect(fake.param('filter')).toBe('tag = "x"');
    expect(fake.param('perPage')).toBe('2');
    expect(success).toHaveBeenCalledWith([{ objectId: 'abc', name: 'Ada' }], 3);
  });

  it('⚠️ turns a row offset into a 1-based page', async () => {
    // `skip=20, limit=10` is page 3, not page 20 and not offset 20. The preset
    // calls this parameter `offsetParam`, which invites passing `skip` straight
    // through — correct-looking on page one and wrong on every page after it.
    const fake = new FakeFetch().reply({ body: { items: [], totalItems: 0 } });
    make(fake).query(pocketbase, { collection: 'people', limit: 10, skip: 20, success: jest.fn(), error: jest.fn() });
    await settle();
    expect(fake.param('page')).toBe('3');
    expect(fake.param('perPage')).toBe('10');
  });

  it('⚠️ refuses an offset that is not a whole number of pages, rather than rounding', async () => {
    // Rounding would return rows 0–9 as if they were rows 5–14: right count,
    // right shape, wrong rows, no error.
    const fake = new FakeFetch();
    const error = jest.fn();
    make(fake).query(pocketbase, { collection: 'people', limit: 10, skip: 5, success: jest.fn(), error });
    await settle();
    expect(fake.calls).toHaveLength(0);
    expect(error.mock.calls[0][0]).toMatch(/cannot start at row 5/);
  });

  it('does not turn a skip into a page when there is no page size', async () => {
    const fake = new FakeFetch();
    const error = jest.fn();
    make(fake).query(pocketbase, { collection: 'people', skip: 5, success: jest.fn(), error });
    await settle();
    expect(fake.calls).toHaveLength(0);
    expect(error).toHaveBeenCalled();
  });

  it('offset-based backends take the skip unchanged', async () => {
    const fake = new FakeFetch().reply({ body: { data: [] } }, { body: [] });
    const adapter = make(fake);
    adapter.query(directus, { collection: 'people', limit: 10, skip: 5, success: jest.fn(), error: jest.fn() });
    await settle();
    expect(fake.param('offset')).toBe('5');

    adapter.query(supabase, { collection: 'people', limit: 10, skip: 5, success: jest.fn(), error: jest.fn() });
    await settle();
    expect(fake.param('offset')).toBe('5');
  });

  it('⚠️ refuses aggregate — PocketBase answers 200 with un-aggregated rows', async () => {
    // The single strongest argument for the capability model in the phase:
    // there is nothing downstream that could catch this.
    const fake = new FakeFetch();
    const error = jest.fn();
    make(fake).aggregate(pocketbase, { collection: 'people', group: { n: { count: '*' } }, success: jest.fn(), error });
    await settle();
    expect(fake.calls).toHaveLength(0);
    expect(error.mock.calls[0][0]).toMatch(/can't total or average records on the server/);
  });

  it('⚠️ a probe cannot un-refuse an unsupported cell', async () => {
    // `conditional` is settleable; `unsupported` is not. Passing the key must
    // not open the door.
    const fake = new FakeFetch();
    const error = jest.fn();
    make(fake, { probedCapabilities: ['data.aggregate'] }).aggregate(pocketbase, {
      collection: 'people',
      group: { n: { count: '*' } },
      success: jest.fn(),
      error
    });
    await settle();
    expect(fake.calls).toHaveLength(0);
    expect(error).toHaveBeenCalled();
  });

  it('refuses distinct, which PocketBase answers by returning every row', async () => {
    const fake = new FakeFetch();
    const error = jest.fn();
    make(fake).distinct(pocketbase, { collection: 'people', property: 'tag', success: jest.fn(), error });
    await settle();
    expect(fake.calls).toHaveLength(0);
    expect(error.mock.calls[0][0]).toMatch(/can't list the distinct values/);
  });

  it('increments atomically with the +/- field modifier', async () => {
    const fake = new FakeFetch().reply({ body: { id: 'abc', rating: 8 } });
    const success = jest.fn();
    make(fake).increment(pocketbase, {
      collection: 'people',
      objectId: 'abc',
      properties: { rating: 3 },
      success,
      error: jest.fn()
    });
    await settle();
    expect(fake.calls).toHaveLength(1);
    expect(fake.last.body).toEqual({ 'rating+': 3 });
    expect(success).toHaveBeenCalledWith({ objectId: 'abc', rating: 8 });
  });

  it('reads a single record from the top level, not from items', async () => {
    // The profile splits `dataPath` from `recordDataPath` for exactly this:
    // deriving one from the other made `create` return undefined on PocketBase.
    const fake = new FakeFetch().reply({ body: { id: 'abc', name: 'Ada' } });
    const success = jest.fn();
    make(fake).fetch(pocketbase, { collection: 'people', objectId: 'abc', success, error: jest.fn() });
    await settle();
    expect(success).toHaveBeenCalledWith({ objectId: 'abc', name: 'Ada' });
  });

  it('strips the collection metadata PocketBase puts on every record before saving', async () => {
    const fake = new FakeFetch().reply({ body: { id: 'abc', name: 'Edited' } });
    make(fake).save(pocketbase, {
      collection: 'people',
      objectId: 'abc',
      data: { id: 'abc', objectId: 'abc', collectionId: 'pbc_1', collectionName: 'people', name: 'Edited' },
      success: jest.fn(),
      error: jest.fn()
    });
    await settle();
    expect(fake.last.body).toEqual({ name: 'Edited' });
  });

  it('turns the PocketBase error envelope into a sentence', async () => {
    const fake = new FakeFetch().reply({ status: 404, body: { data: {}, message: "The requested resource wasn't found.", status: 404 } });
    const error = jest.fn();
    make(fake).delete(pocketbase, { collection: 'people', objectId: 'nope', success: jest.fn(), error });
    await settle();
    expect(error.mock.calls[0][0]).toBe("The requested resource wasn't found.");
  });
});

// ── Refusals that are somebody else's task ─────────────────────────────────

describe('what this adapter does not do', () => {
  it('still reports file errors as a FileError envelope, not a bare string', async () => {
    // BCN-002's correction: the three file callbacks take `{error, status}`
    // where the eleven data ones take a string, and two node call sites read
    // `.error`. BCN-007 implemented these methods; the envelope must survive.
    // `{name: 'a.png'}` is exactly what the contract's `file` type permits and
    // it has no bytes — so this also pins the guard that catches it *before*
    // anything is sent. Uploading a `{}` body would be a 200 storing nothing.
    const error = jest.fn();
    make(new FakeFetch()).uploadFile(supabase, { file: { name: 'a.png' }, success: jest.fn(), error });
    expect(typeof error.mock.calls[0][0]).toBe('object');
    expect(error.mock.calls[0][0].error).toMatch(/is not a file/);
  });

  it('refuses a whole-record search on the two backends that have no parameter for it', async () => {
    for (const handle of [supabase, pocketbase]) {
      const fake = new FakeFetch();
      const error = jest.fn();
      make(fake).query(handle, { collection: 'a', search: 'ada', success: jest.fn(), error });
      await settle();
      expect(fake.calls).toHaveLength(0);
      expect(error).toHaveBeenCalled();
    }
  });

  it('passes a search through on Directus, which has one', async () => {
    const fake = new FakeFetch().reply({ body: { data: [] } });
    make(fake).query(directus, { collection: 'a', search: 'ada', success: jest.fn(), error: jest.fn() });
    await settle();
    expect(fake.param('search')).toBe('ada');
  });

  it('lets a filter the backend cannot express fail, rather than dropping the condition', async () => {
    // The data-exposure bug BCN-003 exists to close: a dropped condition widens
    // the query, so a filter meant to show one user their own records returns
    // everybody's.
    const fake = new FakeFetch();
    const error = jest.fn();
    make(fake).query(directus, {
      collection: 'a',
      where: { name: { matchesRegex: '^A' } },
      success: jest.fn(),
      error
    });
    await settle();
    expect(fake.calls).toHaveLength(0);
    expect(error.mock.calls[0][0]).toMatch(/regular expressions/);
  });
});

// ── The free functions ─────────────────────────────────────────────────────

describe('helpers', () => {
  it('reads the flat and the nested Directus aggregate shapes', () => {
    expect(readAggregateValue({ count: 5 }, 'count', '*')).toBe(5);
    expect(readAggregateValue({ count: { id: 5 } }, 'count', 'id')).toBe(5);
    expect(readAggregateValue({ max: { rating: 9 } }, 'max', 'rating')).toBe(9);
  });

  it('refuses a group member it cannot express instead of ignoring it', () => {
    expect(() => readGroupMember({ distinct: 'tag' }, 'tags')).toThrow(/Distinct/);
    expect(() => readGroupMember({}, 'nothing')).toThrow(/count, sum, avg, min or max/);
    expect(readGroupMember({ sum: 'rating' }, 'total')).toEqual({ fn: 'sum', field: 'rating' });
  });

  it('always strips both spellings of the identity', () => {
    const profile = { type: 'directus', idField: 'id' } as never;
    expect(stripServerOwned(profile, { id: 1, objectId: 1, name: 'Ada', date_created: 'x' })).toEqual({ name: 'Ada' });
  });
});

// ── Relations — BCN-005 ────────────────────────────────────────────────────

/**
 * Every descriptor below is what {@link relationsFromDirectus} and friends
 * produce from the **real** metadata (see `relations.test.ts` for the verbatim
 * fixtures). The adapter is not tested against invented shapes: the point of
 * these cases is the request it builds, and a made-up descriptor would test the
 * author's memory of the wire rather than the wire.
 */
const RELATIONS: Record<string, RelationDescriptor[]> = {
  directus: [
    {
      collection: 'articles',
      field: 'tags',
      target: 'tags',
      cardinality: 'many',
      readPath: 'tags.tag_id',
      readUnwrapKey: 'tag_id',
      write: { kind: 'junction', collection: 'articles_tags', sourceField: 'article_id', targetField: 'tag_id', idempotent: false }
    },
    {
      collection: 'articles',
      field: 'author',
      target: 'authors',
      cardinality: 'one',
      write: { kind: 'foreignKey', field: 'author', on: 'source' }
    },
    {
      collection: 'authors',
      field: 'articles',
      target: 'articles',
      cardinality: 'many',
      write: { kind: 'foreignKey', field: 'author', on: 'target' }
    }
  ],
  supabase: [
    {
      collection: 'articles',
      field: 'tags',
      target: 'tags',
      cardinality: 'many',
      write: { kind: 'junction', collection: 'articles_tags', sourceField: 'article_id', targetField: 'tag_id', idempotent: true }
    },
    {
      collection: 'articles',
      field: 'author_id',
      target: 'authors',
      cardinality: 'one',
      write: { kind: 'foreignKey', field: 'author_id', on: 'source' }
    }
  ],
  pocketbase: [
    {
      collection: 'articles',
      field: 'tags',
      target: 'tags',
      cardinality: 'many',
      write: { kind: 'arrayField', field: 'tags', setSemantics: true }
    }
  ]
};

function withRelations(fake: FakeFetch) {
  return make(fake, { relationsFor: (handle: BackendHandle) => RELATIONS[handle.type] });
}

const relationCall = (overrides: Record<string, unknown> = {}) =>
  Object.assign(
    { collection: 'articles', objectId: '1', key: 'tags', targetObjectId: '7', targetCollection: 'tags' },
    overrides
  );

describe('relations', () => {
  it('⚠️ refuses a relation the synced schema does not describe, rather than guessing a junction name', async () => {
    // Relation metadata is admin-only: Directus answers GET /relations 403 and
    // PocketBase answers GET /api/collections 401 without one. So a runtime
    // cannot look one up, and the only alternative to refusing is inventing a
    // table name and writing to it.
    for (const handle of [directus, supabase, pocketbase]) {
      const fake = new FakeFetch();
      const error = jest.fn();
      make(fake).addRelation(handle, { ...relationCall(), success: jest.fn(), error });
      await settle();
      expect(fake.calls).toHaveLength(0);
      expect(error.mock.calls[0][0]).toMatch(/does not know how "tags" relates/);
      expect(error.mock.calls[0][0]).toMatch(/Refresh the backend schema/);
    }
  });

  it('refuses a Parse-style relation handed to the wrong adapter, and says it is a wiring mistake', async () => {
    const fake = new FakeFetch();
    const error = jest.fn();
    make(fake, {
      relationsFor: () => [
        { collection: 'articles', field: 'tags', target: 'tags', cardinality: 'many' as const, write: { kind: 'op' as const } }
      ]
    }).addRelation(directus, { ...relationCall(), success: jest.fn(), error });
    await settle();
    expect(fake.calls).toHaveLength(0);
    expect(error.mock.calls[0][0]).toMatch(/wiring mistake/);
  });

  describe('pocketbase — the field operators', () => {
    it('adds with `tags+` in ONE request', async () => {
      const fake = new FakeFetch().reply({ body: { id: '1', tags: ['7'] } });
      const success = jest.fn();
      withRelations(fake).addRelation(pocketbase, { ...relationCall(), success, error: jest.fn() });
      await settle();

      expect(fake.calls).toHaveLength(1);
      expect(fake.last.method).toBe('PATCH');
      expect(fake.last.url).toContain('/api/collections/articles/records/1');
      expect(fake.last.body).toEqual({ 'tags+': '7' });
      expect(success).toHaveBeenCalledWith({ objectId: '1', tags: ['7'] });
    });

    it('removes with `tags-`', async () => {
      const fake = new FakeFetch().reply({ body: { id: '1', tags: [] } });
      withRelations(fake).removeRelation(pocketbase, { ...relationCall(), success: jest.fn(), error: jest.fn() });
      await settle();
      expect(fake.last.body).toEqual({ 'tags-': '7' });
    });

    it('⚠️ does not read first — the spec’s lost-update premise is stale', async () => {
      // `+`/`-` are applied server-side and are set-shaped, measured live. A
      // read-modify-write here would be two requests and a race for nothing.
      const fake = new FakeFetch().reply({ body: { id: '1', tags: ['7'] } });
      withRelations(fake).addRelation(pocketbase, { ...relationCall(), success: jest.fn(), error: jest.fn() });
      await settle();
      expect(fake.calls.map((call) => call.method)).toEqual(['PATCH']);
    });

    it('errors rather than succeeding empty when the PATCH comes back with no record', async () => {
      const fake = new FakeFetch().reply({ status: 204, text: '' });
      const error = jest.fn();
      withRelations(fake).addRelation(pocketbase, { ...relationCall(), success: jest.fn(), error });
      await settle();
      expect(error.mock.calls[0][0]).toMatch(/returned nothing back/);
    });
  });

  describe('supabase — the junction, upserted', () => {
    it('adds with ONE POST carrying resolution=merge-duplicates', async () => {
      // The pair is the primary key there, so a duplicate is a 409 and the
      // upsert is what makes the add idempotent. Both measured.
      const fake = new FakeFetch().reply({ status: 201, body: [{ article_id: 1, tag_id: 7 }] });
      const success = jest.fn();
      withRelations(fake).addRelation(supabase, { ...relationCall(), success, error: jest.fn() });
      await settle();

      expect(fake.calls).toHaveLength(1);
      expect(fake.last.method).toBe('POST');
      expect(fake.last.url).toContain('/rest/v1/articles_tags');
      expect(fake.last.body).toEqual({ article_id: '1', tag_id: '7' });
      expect(fake.last.headers.Prefer).toContain('resolution=merge-duplicates');
      // The junction row is NOT the record the caller asked about: both relation
      // nodes copy every key of this onto their Model, so handing back
      // `article_id`/`tag_id` would write them onto the user's record.
      expect(success).toHaveBeenCalledWith({ objectId: '1' });
    });

    it('removes by predicate, in one request', async () => {
      const fake = new FakeFetch().reply({ status: 200, body: [{ article_id: 1, tag_id: 7 }] });
      withRelations(fake).removeRelation(supabase, { ...relationCall(), success: jest.fn(), error: jest.fn() });
      await settle();

      expect(fake.calls).toHaveLength(1);
      expect(fake.last.method).toBe('DELETE');
      expect(fake.params()).toEqual([
        ['article_id', 'eq.1'],
        ['tag_id', 'eq.7']
      ]);
    });

    it('writes the foreign key for a to-one, and nulls it to remove', async () => {
      const fake = new FakeFetch().reply({ body: [{ id: 1, author_id: 7 }] }, { body: [{ id: 1, author_id: null }] });
      const adapter = withRelations(fake);
      adapter.addRelation(supabase, { ...relationCall({ key: 'author_id' }), success: jest.fn(), error: jest.fn() });
      await settle();
      expect(fake.last.method).toBe('PATCH');
      expect(fake.last.body).toEqual({ author_id: '7' });

      adapter.removeRelation(supabase, { ...relationCall({ key: 'author_id' }), success: jest.fn(), error: jest.fn() });
      await settle();
      expect(fake.last.body).toEqual({ author_id: null });
    });
  });

  describe('directus — the junction that permits duplicates', () => {
    it('⚠️ reads before it writes, so adding twice does not store the pair twice', async () => {
      const fake = new FakeFetch()
        .reply({ body: { data: [] } })
        .reply({ body: { data: { id: 9, article_id: 1, tag_id: 7 } } });
      const success = jest.fn();
      withRelations(fake).addRelation(directus, { ...relationCall(), success, error: jest.fn() });
      await settle();
      await settle();

      expect(fake.calls.map((call) => call.method)).toEqual(['GET', 'POST']);
      expect(JSON.parse(fake.param('filter', 0)!)).toEqual({ article_id: { _eq: '1' }, tag_id: { _eq: '7' } });
      expect(fake.calls[1].body).toEqual({ article_id: '1', tag_id: '7' });
      expect(success).toHaveBeenCalledWith({ objectId: '1' });
    });

    it('succeeds WITHOUT writing when the pair is already there', async () => {
      const fake = new FakeFetch().reply({ body: { data: [{ id: 9, article_id: 1, tag_id: 7 }] } });
      const success = jest.fn();
      withRelations(fake).addRelation(directus, { ...relationCall(), success, error: jest.fn() });
      await settle();
      await settle();

      expect(fake.calls.map((call) => call.method)).toEqual(['GET']);
      expect(success).toHaveBeenCalledWith({ objectId: '1' });
    });

    it('does not send merge-duplicates to a backend where it means nothing', async () => {
      const fake = new FakeFetch().reply({ body: { data: [] } }).reply({ body: { data: { id: 9 } } });
      withRelations(fake).addRelation(directus, { ...relationCall(), success: jest.fn(), error: jest.fn() });
      await settle();
      await settle();
      expect(fake.calls[1].headers.Prefer).toBeUndefined();
    });

    it('⚠️ deletes EVERY row for the pair, not the first one', async () => {
      // A junction that permits duplicates may hold two. Deleting one and
      // reporting success would leave the relation in place.
      const fake = new FakeFetch()
        .reply({ body: { data: [{ id: 9 }, { id: 10 }] } })
        .reply({ status: 204, text: '' })
        .reply({ status: 204, text: '' });
      const success = jest.fn();
      withRelations(fake).removeRelation(directus, { ...relationCall(), success, error: jest.fn() });
      await settle();
      await settle();

      expect(fake.calls.map((call) => call.method)).toEqual(['GET', 'DELETE', 'DELETE']);
      expect(fake.calls[1].url).toContain('/items/articles_tags/9');
      expect(fake.calls[2].url).toContain('/items/articles_tags/10');
      expect(success).toHaveBeenCalledTimes(1);
    });

    it('reports success when there was nothing to remove, because the wire cannot say otherwise', async () => {
      // Directus answers 204 for a junction row that never existed (measured),
      // so "was not there" is not a distinction this adapter can make.
      const fake = new FakeFetch().reply({ body: { data: [] } });
      const success = jest.fn();
      const error = jest.fn();
      withRelations(fake).removeRelation(directus, { ...relationCall(), success, error });
      await settle();
      expect(fake.calls.map((call) => call.method)).toEqual(['GET']);
      expect(success).toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    });

    it('puts the foreign key on the TARGET for a one-to-many', async () => {
      // Relating an article to an author writes the ARTICLE's `author` column.
      // `on: 'source'` would write into the authors table and answer 200.
      const fake = new FakeFetch().reply({ body: { data: { id: 7, author: 1 } } });
      withRelations(fake).addRelation(directus, {
        ...relationCall({ collection: 'authors', key: 'articles', objectId: '1', targetObjectId: '7' }),
        success: jest.fn(),
        error: jest.fn()
      });
      await settle();
      expect(fake.last.url).toContain('/items/articles/7');
      expect(fake.last.body).toEqual({ author: '1' });
    });
  });

  describe('reading a relation back', () => {
    it('⚠️ asks Directus for TWO hops on an M2M, because one returns junction rows', async () => {
      const fake = new FakeFetch().reply({ body: { data: [{ id: 1, tags: [{ tag_id: { id: 7, label: 'algebra' } }] }] } });
      const success = jest.fn();
      withRelations(fake).query(directus, { collection: 'articles', include: ['tags'], success, error: jest.fn() });
      await settle();

      expect(fake.param('fields')).toBe('*,tags.tag_id.*');
      // …and the nesting is undone, so a node sees the same shape it would on
      // any other backend.
      expect(success.mock.calls[0][0]).toEqual([{ objectId: 1, tags: [{ id: 7, label: 'algebra' }] }]);
    });

    it('still asks for one hop on a to-one', async () => {
      const fake = new FakeFetch().reply({ body: { data: [] } });
      withRelations(fake).query(directus, { collection: 'articles', include: ['author'], success: jest.fn(), error: jest.fn() });
      await settle();
      expect(fake.param('fields')).toBe('*,author.*');
    });

    it('⚠️ aliases a PostgREST embed, or the record nests under the TABLE name', async () => {
      const fake = new FakeFetch().reply({ body: [{ id: 1, author_id: { id: 7 } }] });
      withRelations(fake).query(supabase, {
        collection: 'articles',
        include: ['author_id'],
        success: jest.fn(),
        error: jest.fn()
      });
      await settle();
      expect(fake.param('select')).toBe('*,author_id:authors(*)');
    });

    it('⚠️ hoists PocketBase’s `expand`, which leaves the field holding the id', async () => {
      // Found by the first live run. PocketBase does not nest the related record
      // onto the field — `author` stays a 15-character id and the record arrives
      // under a sibling `expand`. The contract promises one shape.
      const fake = new FakeFetch().reply({
        body: {
          items: [{ id: '1', author: 'aaa', expand: { author: { id: 'aaa', city: 'London' } } }]
        }
      });
      const success = jest.fn();
      withRelations(fake).query(pocketbase, {
        collection: 'articles',
        include: ['author'],
        success,
        error: jest.fn()
      });
      await settle();
      expect(fake.param('expand')).toBe('author');
      expect(success.mock.calls[0][0][0].author).toEqual({ id: 'aaa', city: 'London' });
    });

    it('⚠️ sends a Directus M2M FILTER through the junction, or it is a 403', async () => {
      // The second thing the live run found, and the same two-hop fact as the
      // read: `{"tags":{"label":…}}` answers 403 "no permission to access field
      // label in collection articles_tags" — indistinguishable from a real
      // permission failure. The adapter merges the descriptor's `readPath` into
      // the schema the translator sees, so no caller has to know.
      const fake = new FakeFetch().reply({ body: { data: [] } });
      withRelations(fake).query(directus, {
        collection: 'articles',
        where: { 'tags.label': { equalTo: 'algebra' } },
        success: jest.fn(),
        error: jest.fn()
      });
      await settle();
      expect(JSON.parse(fake.param('filter')!)).toEqual({ tags: { tag_id: { label: { _eq: 'algebra' } } } });
    });

    it('⚠️ quantifies a PocketBase to-many filter from the descriptor, with no schemaFor at all', async () => {
      // `tags.label = "x"` means *every* related record matches, and returns
      // nothing on a record with two tags. The cardinality comes from the
      // relation descriptor, so an adapter built without `schemaFor` is still
      // right — which is what the live pass runs.
      const fake = new FakeFetch().reply({ body: { items: [] } });
      withRelations(fake).query(pocketbase, {
        collection: 'articles',
        where: { 'tags.label': { equalTo: 'algebra' } },
        success: jest.fn(),
        error: jest.fn()
      });
      await settle();
      expect(fake.param('filter')).toBe('tags.label ?= "algebra"');
    });

    it('passes an include through unchanged when the descriptor knows nothing about it', async () => {
      // The pre-BCN-005 behaviour, which is right whenever the caller named the
      // table or the FK column — both measured working.
      const fake = new FakeFetch().reply({ body: [{ id: 1 }] });
      make(fake).query(supabase, { collection: 'articles', include: ['authors'], success: jest.fn(), error: jest.fn() });
      await settle();
      expect(fake.param('select')).toBe('*,authors(*)');
    });

    it('unwraps the junction nesting on a single fetch too', async () => {
      const fake = new FakeFetch().reply({ body: { data: { id: 1, tags: [{ tag_id: { id: 7 } }] } } });
      const success = jest.fn();
      withRelations(fake).fetch(directus, { collection: 'articles', objectId: '1', include: ['tags'], success, error: jest.fn() });
      await settle();
      expect(fake.param('fields')).toBe('*,tags.tag_id.*');
      expect(success.mock.calls[0][0]).toEqual({ objectId: 1, tags: [{ id: 7 }] });
    });
  });

  it('accepts the deprecated targetClass spelling as well as targetCollection', async () => {
    const fake = new FakeFetch().reply({ body: { id: '1', tags: ['7'] } });
    withRelations(fake).addRelation(pocketbase, {
      collection: 'articles',
      objectId: '1',
      key: 'tags',
      targetObjectId: '7',
      targetClass: 'tags',
      success: jest.fn(),
      error: jest.fn()
    });
    await settle();
    expect(fake.last.body).toEqual({ 'tags+': '7' });
  });

  it('tells the Query Records nodes the record changed', async () => {
    const fake = new FakeFetch().reply({ body: { id: '1', tags: ['7'] } });
    const adapter = withRelations(fake);
    const seen: unknown[] = [];
    adapter.on('save', (event: unknown) => seen.push(event));
    adapter.addRelation(pocketbase, { ...relationCall(), success: jest.fn(), error: jest.fn() });
    await settle();
    expect(seen).toHaveLength(1);
  });
});

// ── Files — BCN-007 steps 2–5 ──────────────────────────────────────────────
//
// The same honest framing this file opens with: **these cannot prove the task.**
// The live driver (`uba-e2e/bcn-007-file-driver.ts`) is the deliverable and it
// runs against four real servers. What is pinned here is the set of things that
// would be **silent** if they were wrong — each a plausible wrong value rather
// than an error:
//
//  1. An upload body is sent RAW. `JSON.stringify` of a Blob is `{}`, which
//     every one of these backends stores and answers 200 for.
//  2. A multipart request does NOT carry `Content-Type: application/json`.
//     `fetch` only picks a boundary when the header is absent.
//  3. Directus's handle is `id`, not `filename_disk`. Both look like a filename.
//  4. A Directus `FileRef.url` carries NO credential. The alternative persists
//     the caller's session token into the user's database.
//  5. A missing target REFUSES. A half-built one composes `.../undefined/...`,
//     which is a well-formed request addressing nothing.
//  6. `signFileUrl` reports `token` on two backends and `signed` on one. A
//     uniform `signed` would tell an author a Directus link is shareable.

/**
 * `UploadFileOptions` as a caller really builds it: `file` is typed
 * `{name, type?}` on the contract — the structural subset the Parse wire needed
 * — but what every caller passes is a real `File`, which has bytes.
 */
function uploadArgs(extra: Partial<UploadFileOptions> = {}): UploadFileOptions {
  const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }) as Blob & { name?: string };
  blob.name = 'photo.png';
  return Object.assign(
    {
      file: blob as unknown as { name: string; type?: string },
      success: jest.fn(),
      error: jest.fn()
    },
    extra
  );
}

describe('files — the wire', () => {
  it('sends a Directus upload as multipart, with no JSON content type', async () => {
    const fake = new FakeFetch().reply({ body: { data: { id: 'uuid-1', filename_download: 'photo.png', type: 'image/png', filesize: 70 } } });
    const success = jest.fn();
    make(fake).uploadFile(directus, uploadArgs({ success, error: jest.fn() }));
    await settle();

    expect(fake.last.url).toBe('https://directus.example/files');
    expect(fake.last.method).toBe('POST');
    // ⚠️ Not `undefined` — ABSENT. A header set to undefined is still a header
    // on some fetch implementations.
    expect('Content-Type' in fake.last.headers).toBe(false);
    expect(fake.last.headers.Authorization).toBe('Bearer tok-d');
    // The body must be the FormData itself, never a stringified anything.
    expect(fake.last.body).toBeInstanceOf(FormData);
    expect((fake.last.body as FormData).get('file')).toBeInstanceOf(Blob);
  });

  it("normalises Directus's field names, and uses `id` as the handle rather than filename_disk", async () => {
    const fake = new FakeFetch().reply({
      body: {
        data: {
          id: 'uuid-1',
          filename_disk: 'uuid-1.png',
          filename_download: 'my photo.png',
          type: 'image/png',
          filesize: 70
        }
      }
    });
    const success = jest.fn();
    make(fake).uploadFile(directus, uploadArgs({ success, error: jest.fn() }));
    await settle();

    expect(success).toHaveBeenCalledWith({
      name: 'uuid-1',
      url: 'https://directus.example/assets/uuid-1',
      id: 'uuid-1',
      filename: 'my photo.png',
      contentType: 'image/png',
      size: 70
    });
  });

  it('never puts a credential in a Directus FileRef.url — that URL gets persisted into a record', async () => {
    const fake = new FakeFetch().reply({ body: { data: { id: 'uuid-1' } } });
    const success = jest.fn();
    make(fake).uploadFile({ ...directus, sessionToken: 'live-session-jwt' }, uploadArgs({ success, error: jest.fn() }));
    await settle();
    expect(success.mock.calls[0][0].url).toBe('https://directus.example/assets/uuid-1');
    expect(success.mock.calls[0][0].url).not.toContain('live-session-jwt');
  });

  it('sends a Supabase upload as raw bytes to the Storage mount, not to PostgREST', async () => {
    const fake = new FakeFetch().reply({ body: { Key: 'avatars/me.png', Id: 'obj-1' } });
    const success = jest.fn();
    make(fake).uploadFile(
      supabase,
      uploadArgs({
        target: { kind: 'bucket', bucket: 'avatars', path: 'me.png' },
        success,
        error: jest.fn()
      })
    );
    await settle();

    expect(fake.last.url).toBe('https://project.supabase.co/storage/v1/object/avatars/me.png');
    expect(fake.last.headers['Content-Type']).toBe('image/png');
    expect(fake.last.body).toBeInstanceOf(Blob);
    // ⚠️ `{Key, Id}` and nothing else — measured. No contentType, no size, and
    // they must be ABSENT rather than defaulted: a size of 0 and "we were not
    // told" are different facts.
    expect(success).toHaveBeenCalledWith({
      name: 'avatars/me.png',
      url: 'https://project.supabase.co/storage/v1/object/public/avatars/me.png',
      id: 'obj-1',
      target: { kind: 'bucket', bucket: 'avatars', path: 'me.png' }
    });
  });

  it('refuses a Supabase upload with no bucket rather than composing a path with `undefined` in it', async () => {
    const fake = new FakeFetch();
    const error = jest.fn();
    make(fake).uploadFile(supabase, uploadArgs({ success: jest.fn(), error }));
    await settle();
    expect(fake.calls).toHaveLength(0);
    expect(error.mock.calls[0][0].error).toMatch(/Storage bucket/);
  });

  it('creates a PocketBase record when no record id is given, and patches one when it is', async () => {
    const created = new FakeFetch().reply({ body: { id: 'rec1', collectionName: 'docs', attachment: 'photo_abc.png' } });
    const success = jest.fn();
    make(created).uploadFile(
      pocketbase,
      uploadArgs({ target: { kind: 'record', collection: 'docs', field: 'attachment' }, success, error: jest.fn() })
    );
    await settle();
    expect(created.last.method).toBe('POST');
    expect(created.last.url).toBe('https://pb.example/api/collections/docs/records');
    expect(success).toHaveBeenCalledWith({
      name: 'photo_abc.png',
      url: 'https://pb.example/api/files/docs/rec1/photo_abc.png',
      target: { kind: 'record', collection: 'docs', recordId: 'rec1', field: 'attachment' }
    });

    const patched = new FakeFetch().reply({ body: { id: 'rec1', attachment: 'photo_abc.png' } });
    make(patched).uploadFile(
      pocketbase,
      uploadArgs({
        target: { kind: 'record', collection: 'docs', field: 'attachment', recordId: 'rec1' },
        success: jest.fn(),
        error: jest.fn()
      })
    );
    await settle();
    expect(patched.last.method).toBe('PATCH');
    expect(patched.last.url).toBe('https://pb.example/api/collections/docs/records/rec1');
  });

  it('reports a PocketBase field that names no file as an error, not as a success with an undefined url', async () => {
    // ⚠️ The plausible-wrong-value case: a 200 whose body simply has no such
    // field. Left alone, `FileRef.url` reads ".../undefined" and `CloudFile`
    // hands an <img> a link to nothing.
    const fake = new FakeFetch().reply({ body: { id: 'rec1', title: 'no file here' } });
    const error = jest.fn();
    const success = jest.fn();
    make(fake).uploadFile(
      pocketbase,
      uploadArgs({ target: { kind: 'record', collection: 'docs', field: 'attachment' }, success, error })
    );
    await settle();
    expect(success).not.toHaveBeenCalled();
    expect(error.mock.calls[0][0].error).toMatch(/does not name a file/);
  });
});

describe('files — signing, and the difference the node has to show', () => {
  it('reports a Directus link as `token`, with the session\'s own expiry', async () => {
    // A JWT whose exp is 900s ahead — the shape Directus mints, measured.
    const exp = Math.floor(Date.now() / 1000) + 900;
    const jwt = ['e30', Buffer.from(JSON.stringify({ exp })).toString('base64url'), 'sig'].join('.');
    const success = jest.fn();
    make(new FakeFetch()).signFileUrl({ ...directus, sessionToken: jwt }, { name: 'uuid-1', success, error: jest.fn() });
    await settle();

    const result = success.mock.calls[0][0];
    expect(result.kind).toBe('token');
    expect(result.url).toBe(`https://directus.example/assets/uuid-1?access_token=${encodeURIComponent(jwt)}`);
    expect(result.expiresAt).toBe(new Date(exp * 1000).toISOString());
  });

  it('reports a Supabase link as `signed`, and makes the RELATIVE signedURL absolute', async () => {
    // ⚠️ Measured: `signedURL` comes back as `/object/sign/…`. Handed to an
    // <img src> as-is it resolves against the APP's origin and 404s there,
    // which reads to a user as a broken file rather than a wrong URL.
    const fake = new FakeFetch().reply({ body: { signedURL: '/object/sign/avatars/me.png?token=abc' } });
    const success = jest.fn();
    make(fake).signFileUrl(supabase, {
      name: 'avatars/me.png',
      target: { kind: 'bucket', bucket: 'avatars', path: 'me.png' },
      success,
      error: jest.fn()
    });
    await settle();

    expect(fake.last.url).toBe('https://project.supabase.co/storage/v1/object/sign/avatars/me.png');
    expect(fake.last.body).toEqual({ expiresIn: 300 });
    expect(success.mock.calls[0][0]).toEqual({
      url: 'https://project.supabase.co/storage/v1/object/sign/avatars/me.png?token=abc',
      kind: 'signed'
    });
  });

  it('reports a PocketBase link as `token`, from POST /api/files/token', async () => {
    const fake = new FakeFetch().reply({ body: { token: 'file-token' } });
    const success = jest.fn();
    make(fake).signFileUrl(pocketbase, {
      name: 'photo_abc.png',
      target: { kind: 'record', collection: 'docs', recordId: 'rec1', field: 'attachment' },
      success,
      error: jest.fn()
    });
    await settle();

    expect(fake.last.url).toBe('https://pb.example/api/files/token');
    expect(success.mock.calls[0][0]).toEqual({
      url: 'https://pb.example/api/files/docs/rec1/photo_abc.png?token=file-token',
      kind: 'token'
    });
  });

  it('does not claim an expiry for a token that has none', async () => {
    // A Directus STATIC token is not a JWT and never expires. `expiresAt` must
    // be absent rather than a fabricated moment — "no expiry we can see" and
    // "expires now" would otherwise render the same.
    const success = jest.fn();
    make(new FakeFetch()).signFileUrl({ ...directus, sessionToken: 'a-static-token' }, { name: 'x', success, error: jest.fn() });
    await settle();
    expect(success.mock.calls[0][0]).toEqual({
      url: 'https://directus.example/assets/x?access_token=a-static-token',
      kind: 'token'
    });
  });
});

describe('files — deletion', () => {
  it('deletes a Directus file by id', async () => {
    const fake = new FakeFetch().reply({ status: 204, text: '' });
    const success = jest.fn();
    make(fake).deleteFile(directus, { file: { name: 'uuid-1' }, success, error: jest.fn() });
    await settle();
    expect(fake.last.method).toBe('DELETE');
    expect(fake.last.url).toBe('https://directus.example/files/uuid-1');
    expect(success).toHaveBeenCalled();
  });

  it('clears the PocketBase field rather than deleting anything', async () => {
    const fake = new FakeFetch().reply({ body: { id: 'rec1', attachment: '' } });
    make(fake).deleteFile(pocketbase, {
      file: { name: 'photo_abc.png' },
      target: { kind: 'record', collection: 'docs', recordId: 'rec1', field: 'attachment' },
      success: jest.fn(),
      error: jest.fn()
    });
    await settle();
    expect(fake.last.method).toBe('PATCH');
    expect(fake.last.url).toBe('https://pb.example/api/collections/docs/records/rec1');
    expect(fake.last.body).toEqual({ attachment: null });
  });

  it('refuses a PocketBase delete with no record id — there is nothing to patch', async () => {
    const fake = new FakeFetch();
    const error = jest.fn();
    make(fake).deleteFile(pocketbase, {
      file: { name: 'photo_abc.png' },
      target: { kind: 'record', collection: 'docs', field: 'attachment' },
      success: jest.fn(),
      error
    });
    await settle();
    expect(fake.calls).toHaveLength(0);
    // ⚠️ NOT the upload sentence. Delete File has no Collection or Field input,
    // so "set Collection and Field on the node" would name ports that are not
    // there. The message has to name the real cause: a file read back off a
    // saved record lost its location, because `_serializeObject` persists a
    // File as `{__type, url, name}`.
    expect(error.mock.calls[0][0].error).toMatch(/came from a saved record/);
    expect(error.mock.calls[0][0].error).not.toMatch(/Set Collection and Field/);
  });
});

// ── Directus system collections — BCN-010's precondition ───────────────────

describe('directus system collections', () => {
  it('sends a query on directus_users to /users, not /items/directus_users', async () => {
    // ⚠️ `/items/directus_users` answers 403 "You don't have permission to
    // access this" — WITH AN ADMIN TOKEN. A user whose permissions are fine
    // would read that message and go looking in the wrong place.
    const fake = new FakeFetch().reply({ body: { data: [{ id: 'u1', email: 'a@b.c' }], meta: { filter_count: 1 } } });
    make(fake).query(directus, { collection: 'directus_users', success: jest.fn(), error: jest.fn() });
    await settle();
    expect(fake.last.url.split('?')[0]).toBe('https://directus.example/users');
  });

  it('keeps the {id} suffix on a single-record path', async () => {
    const fake = new FakeFetch().reply({ body: { data: { id: 'u1' } } });
    make(fake).fetch(directus, { collection: 'directus_users', objectId: 'u1', success: jest.fn(), error: jest.fn() });
    await settle();
    expect(fake.last.url.split('?')[0]).toBe('https://directus.example/users/u1');
  });

  it('leaves ordinary collections alone', async () => {
    const fake = new FakeFetch().reply({ body: { data: [], meta: { filter_count: 0 } } });
    make(fake).query(directus, { collection: 'articles', success: jest.fn(), error: jest.fn() });
    await settle();
    expect(fake.last.url.split('?')[0]).toBe('https://directus.example/items/articles');
  });

  it('does NOT rewrite a PocketBase collection that happens to be called directus_users', async () => {
    // The rewrite is keyed on the `/items/` template rather than on the name,
    // so a user free to name a PocketBase collection anything is not caught by
    // a Directus convention.
    const fake = new FakeFetch().reply({ body: { items: [], totalItems: 0 } });
    make(fake).query(pocketbase, { collection: 'directus_users', success: jest.fn(), error: jest.fn() });
    await settle();
    expect(fake.last.url.split('?')[0]).toBe('https://pb.example/api/collections/directus_users/records');
  });

  it('falls back to /items for a directus_ collection with no mapped endpoint', async () => {
    // Deliberate: inventing `/somethingnew` by stripping the prefix would
    // answer 404, which reads as "this collection does not exist".
    const fake = new FakeFetch().reply({ body: { data: [], meta: { filter_count: 0 } } });
    make(fake).query(directus, { collection: 'directus_somethingnew', success: jest.fn(), error: jest.fn() });
    await settle();
    expect(fake.last.url.split('?')[0]).toBe('https://directus.example/items/directus_somethingnew');
  });
});
