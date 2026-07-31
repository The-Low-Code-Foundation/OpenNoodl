/**
 * BCN-002 — the Parse wire behind `IDataAdapter`, with nothing observable changed.
 *
 * The honest framing first: **this suite cannot prove the task's headline
 * claim.** "No behaviour change" is a statement about signal ordering and port
 * timing in twenty-five nodes, and only the live pass reaches that. What these
 * tests do is pin the four things a unit test *can* pin, each chosen because
 * getting it wrong during the move would be silent:
 *
 * 1. The adapter implements exactly the contract's fourteen methods — no more,
 *    which is how a helper accidentally becomes public API.
 * 2. The browser path never sends a master key. `_noodl_cloudservices` is a
 *    cloud-runtime global and the guard that keeps it that way is one `typeof`.
 * 3. The `{_method: 'GET'}` POST tunnel still carries the query body. It looks
 *    like cruft; "simplifying" it truncates large filters at the URL length
 *    limit with no error.
 * 4. A record's identity arrives at the caller under the contract's name.
 *
 * The wire-level file tests (`cloudstore-files.test.ts`) are deliberately
 * **unchanged** by this task and still pass against the moved wire, which is
 * evidence of a different kind and worth more than anything written here.
 */
jest.mock('../../noodl-runtime', () => ({
  instance: { getMetaData: () => undefined }
}));

import { DATA_ADAPTER_METHODS } from '@noodl/backend-contract';
import type { BackendHandle } from '@noodl/backend-contract';

import { ParseWireAdapter } from '../../src/api/backends/ParseWireAdapter';
import { normalizeRecordIdentities, normalizeRecordIdentity } from '../../src/api/backends/recordIdentity';

import CloudStore = require('../../src/api/cloudstore');

const handle: BackendHandle = {
  id: '_active_',
  type: 'nodegx',
  name: 'Built-in',
  url: 'https://backend.example',
  publicToken: 'app-id-123'
};

class FakeXHR {
  static instances: FakeXHR[] = [];
  onreadystatechange: (() => void) | null = null;
  readyState = 0;
  status = 0;
  response = '';
  responseText = '';
  opened = '';
  headers: Record<string, string> = {};
  sentBody: unknown;
  upload: { onprogress?: (pe: unknown) => void } = {};

  constructor() {
    FakeXHR.instances.push(this);
  }
  open(method: string, url: string) {
    this.opened = `${method} ${url}`;
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name.toLowerCase()] = value;
  }
  send(body?: unknown) {
    this.sentBody = body;
  }
  /** Drive completion the way a real XHR would. */
  complete(status: number, body: unknown) {
    this.status = status;
    this.response = JSON.stringify(body);
    this.readyState = 4;
    this.onreadystatechange && this.onreadystatechange();
  }
}

function makeAdapter(serverVersionMajor?: number) {
  return new ParseWireAdapter({
    serializeObject: (data) => data,
    getServerVersionMajor: () => serverVersionMajor
  });
}

describe('BCN-002 — the contract surface', () => {
  test('the adapter implements exactly the contract’s fourteen methods', () => {
    const adapter = makeAdapter();

    for (const method of DATA_ADAPTER_METHODS) {
      expect(typeof adapter[method]).toBe('function');
    }
    expect(DATA_ADAPTER_METHODS).toHaveLength(14);
  });

  test('and adds no thirteenth public data method by accident', () => {
    // Everything on the prototype that is not the contract, the event surface,
    // the constructor, or the wire seam itself. A new name showing up here is a
    // helper that has quietly become API.
    const known = new Set<string>([
      ...DATA_ADAPTER_METHODS,
      'constructor',
      'on',
      'off',
      'emitAdapterEvent',
      '_makeRequest',
      'normalize',
      'normalizeAll',
      // Not contract, and named here so it stays a deliberate exception rather
      // than the first of several. BCN-006 takes it.
      'currentUserId'
    ]);

    const own = Object.getOwnPropertyNames(ParseWireAdapter.prototype).filter((n) => !known.has(n));
    expect(own).toEqual([]);
  });
});

describe('BCN-002 — the traps the move had to preserve', () => {
  beforeEach(() => {
    FakeXHR.instances = [];
    (globalThis as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = FakeXHR;
    (globalThis as unknown as { localStorage: unknown }).localStorage = {};
    (globalThis as unknown as { File: unknown }).File = class {};
  });

  afterEach(() => {
    delete (globalThis as unknown as { XMLHttpRequest?: unknown }).XMLHttpRequest;
    delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
    delete (globalThis as unknown as { File?: unknown }).File;
  });

  test('the browser path never sends a master key', () => {
    // The whole reason this is a test and not a comment: `_noodl_cloudservices`
    // is absent in a browser, and a shared adapter that dropped the `typeof`
    // guard would put a master key in a request from a user’s machine.
    expect(typeof (globalThis as Record<string, unknown>)._noodl_cloudservices).toBe('undefined');

    makeAdapter().query(handle, {
      collection: 'Posts',
      success: () => undefined,
      error: () => undefined
    });

    const xhr = FakeXHR.instances[0];
    expect(xhr.headers['x-parse-master-key']).toBeUndefined();
    expect(xhr.headers['x-parse-application-id']).toBe('app-id-123');
  });

  test('query still tunnels through POST so the filter travels in the body', () => {
    const where = { and: [{ title: { equalTo: 'x' } }] };

    makeAdapter().query(handle, {
      collection: 'Posts',
      where,
      limit: 10,
      include: ['author', 'tags'],
      success: () => undefined,
      error: () => undefined
    });

    const xhr = FakeXHR.instances[0];
    expect(xhr.opened).toBe('POST https://backend.example/classes/Posts');

    const body = JSON.parse(xhr.sentBody as string);
    expect(body._method).toBe('GET');
    expect(body.where).toEqual(where);
    // Array list options are joined on the wire, and both forms are accepted.
    expect(body.include).toBe('author,tags');
  });

  test('a session token on the handle wins over the stored one', () => {
    (globalThis as unknown as { localStorage: Record<string, string> }).localStorage = {
      'Parse/app-id-123/currentUser': JSON.stringify({ sessionToken: 'from-storage' })
    };

    makeAdapter().count(handle, { collection: 'Posts', success: () => undefined, error: () => undefined });
    expect(FakeXHR.instances[0].headers['x-parse-session-token']).toBe('from-storage');

    FakeXHR.instances = [];
    makeAdapter().count(
      { ...handle, sessionToken: 'from-handle' },
      { collection: 'Posts', success: () => undefined, error: () => undefined }
    );
    expect(FakeXHR.instances[0].headers['x-parse-session-token']).toBe('from-handle');
  });

  test('aggregate keeps the Parse-server-version fork inside the Parse adapter', () => {
    makeAdapter(5).aggregate(handle, {
      collection: 'Posts',
      group: { total: { sum: 'views' } },
      success: () => undefined,
      error: () => undefined
    });
    expect(FakeXHR.instances[0].opened).toContain('?$group=');
    expect(FakeXHR.instances[0].opened).toContain('"_id":null');

    FakeXHR.instances = [];
    makeAdapter(4).aggregate(handle, {
      collection: 'Posts',
      group: { total: { sum: 'views' } },
      success: () => undefined,
      error: () => undefined
    });
    // Below 5 the parameter loses its `$` and the grouping key is `objectId`.
    const opened = FakeXHR.instances[0].opened;
    expect(opened).toContain('?group=');
    expect(opened).not.toContain('$group');
    expect(opened).toContain('"objectId":null');
  });
});

describe('BCN-002 — the cloud-runtime branch, and the header that said "undefined"', () => {
  const realFetch = (globalThis as unknown as { fetch?: unknown }).fetch;
  let captured: { headers?: Record<string, string> } | undefined;

  beforeEach(() => {
    captured = undefined;
    (globalThis as unknown as { _noodl_cloud_runtime_version: string })._noodl_cloud_runtime_version = '1';
    (globalThis as unknown as { fetch: unknown }).fetch = (_url: string, init: { headers?: Record<string, string> }) => {
      captured = init;
      return Promise.resolve({ status: 200, json: () => Promise.resolve({ results: [] }) });
    };
  });

  afterEach(() => {
    delete (globalThis as unknown as { _noodl_cloud_runtime_version?: string })._noodl_cloud_runtime_version;
    (globalThis as unknown as { fetch?: unknown }).fetch = realFetch;
  });

  test('no master key means no master-key header — not one reading "undefined"', async () => {
    // The defect this pins is not hypothetical and not cosmetic. `JSON.stringify`
    // drops an `undefined` property, but `new Headers({...})` keeps it as the
    // four-letter string, so a cloud runtime with no baked credentials sent
    // `X-Parse-Master-Key: undefined` on every request — and `nodegx-backend`
    // counts each as a failed credential attempt and locks the caller out for
    // 300 seconds. Pre-existing in `cloudstore.js`; found by BCN-002's live
    // pass on its first run, because every unit suite takes the XHR branch and
    // upstream Parse ignores a master key it does not recognise.
    await new Promise<void>((resolve) => {
      makeAdapter().query(handle, { collection: 'Posts', success: () => resolve(), error: () => resolve() });
    });

    expect(captured?.headers).toBeDefined();
    expect('X-Parse-Master-Key' in captured!.headers!).toBe(false);
    // And the constructed Headers agrees — which is the layer that differed.
    expect([...new Headers(captured!.headers!).keys()]).not.toContain('x-parse-master-key');
    expect(captured!.headers!['X-Parse-Application-Id']).toBe('app-id-123');
  });
});

describe('BCN-002 — record identity at the boundary', () => {
  beforeEach(() => {
    FakeXHR.instances = [];
    (globalThis as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = FakeXHR;
    (globalThis as unknown as { localStorage: unknown }).localStorage = {};
    (globalThis as unknown as { File: unknown }).File = class {};
  });

  afterEach(() => {
    delete (globalThis as unknown as { XMLHttpRequest?: unknown }).XMLHttpRequest;
    delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
    delete (globalThis as unknown as { File?: unknown }).File;
  });

  test('a caller reads a Parse record’s id under the contract’s name', () => {
    const seen: unknown[] = [];

    makeAdapter().fetch(handle, {
      collection: 'Posts',
      objectId: 'abc123',
      success: (record) => seen.push(record),
      error: () => undefined
    });

    FakeXHR.instances[0].complete(200, { objectId: 'abc123', title: 'Hello' });

    expect(seen).toEqual([{ objectId: 'abc123', title: 'Hello' }]);
  });

  test('the Parse wire pays nothing for the normalisation — same reference out', () => {
    const record = { objectId: 'abc123', title: 'Hello' };
    expect(normalizeRecordIdentity(record, 'objectId')).toBe(record);

    const page = [record];
    expect(normalizeRecordIdentities(page, 'objectId')).toBe(page);
  });

  test('a backend whose wire says `id` gets renamed, and the wire name is removed', () => {
    // The direction BCN-004’s REST adapters need. Proving it here means the
    // second adapter inherits a tested helper rather than writing its own.
    const normalized = normalizeRecordIdentity({ id: 42, title: 'Hello' }, 'id');

    expect(normalized).toEqual({ objectId: 42, title: 'Hello' });
    expect('id' in normalized).toBe(false);
  });

  test('a record with no identity at all is left alone rather than given an undefined one', () => {
    const record = { title: 'Hello' };
    expect(normalizeRecordIdentity(record, 'id')).toBe(record);
  });
});

describe('BCN-002 — CloudStore is a shim, not a second implementation', () => {
  test('every contract method forwards to the adapter with the resolved handle', () => {
    const store = CloudStore.instance;
    const calls: { method: string; handle: BackendHandle }[] = [];

    for (const method of DATA_ADAPTER_METHODS) {
      store._adapter[method] = (h: BackendHandle) => calls.push({ method, handle: h });
    }

    for (const method of DATA_ADAPTER_METHODS) {
      store[method]({ collection: 'Posts', success: () => undefined, error: () => undefined });
    }

    expect(calls.map((c) => c.method)).toEqual([...DATA_ADAPTER_METHODS]);
    // Metadata is mocked away, so the resolved handle is the empty-config one a
    // project without cloud services produces. What matters is that a handle
    // arrives at all, on every method, rather than the adapter reaching for a
    // singleton of its own.
    for (const call of calls) {
      expect(call.handle.id).toBe('_active_');
      expect(call.handle.type).toBe('nodegx');
    }
  });

  test('the shim exposes the adapter’s emitter under the name the wild reads', () => {
    expect(CloudStore.instance.events).toBe(CloudStore.instance._adapter.events);
  });
});
