/**
 * `CloudStore.forBackend` — the router the six Record nodes resolve through (BCN-004
 * step 5).
 *
 * The load-bearing claim is the boring one: **for every project that exists today this is a
 * no-op.** Nothing has a `Backend` input set, nothing has `backendServices` metadata, and
 * the store the Record nodes get back has to be the exact same object `forScope` returned
 * before — not an equivalent one, because `dbcollectionnode2` subscribes to save/create/
 * delete notifications on the store it queries through, and two stores for one backend
 * would mean a record created by one node never reaching the query node watching for it.
 */
const metadata: Record<string, unknown> = {};

jest.mock('../../noodl-runtime', () => ({
  instance: { getMetaData: (key: string) => metadata[key] }
}));

import CloudStore = require('../../src/api/cloudstore');

const DIRECTUS = {
  id: 'd1',
  name: 'Local Directus',
  type: 'directus',
  url: 'http://localhost:8055',
  schema: { collections: [{ name: 'articles', fields: [{ name: 'payload', type: 'json' }] }] }
};

function setMetadata(next: Record<string, unknown>) {
  for (const key of Object.keys(metadata)) delete metadata[key];
  Object.assign(metadata, next);
  CloudStore.invalidateBackends();
}

afterEach(() => setMetadata({}));

describe('a project with nothing configured', () => {
  it('gets the legacy store back, by identity', () => {
    setMetadata({});
    expect(CloudStore.forBackend(undefined, undefined)).toBe(CloudStore.instance);
    expect(CloudStore.forBackend(undefined, '_active_')).toBe(CloudStore.instance);
  });

  it('gets nothing for a backend it does not have, so the node can say so', () => {
    setMetadata({});
    expect(CloudStore.forBackend(undefined, 'd1')).toBeUndefined();
  });
});

describe('a project whose only backend is the cloudservices endpoint', () => {
  beforeEach(() => setMetadata({ cloudservices: { endpoint: 'http://localhost:8577', appId: 'app' } }));

  it('⚠️ resolves `_active_` back to the legacy singleton, by identity', () => {
    expect(CloudStore.forBackend(undefined, '_active_')).toBe(CloudStore.instance);
  });

  it('resolves the endpoint by name to the same store — one backend, one store', () => {
    expect(CloudStore.forBackend(undefined, '_endpoint_')).toBe(CloudStore.instance);
  });

  it('still speaks the Parse wire, and says so', () => {
    expect(CloudStore.instance.usesNeutralFilter).toBe(false);
    expect(CloudStore.instance.backendType()).toBe('nodegx');
  });
});

describe('a project with a REST backend selected', () => {
  beforeEach(() =>
    setMetadata({
      cloudservices: { endpoint: 'http://localhost:8577', appId: 'app' },
      backendServices: { activeBackendId: 'd1', backends: [DIRECTUS] }
    })
  );

  it('gets a different store, bound to that backend’s handle', () => {
    const store = CloudStore.forBackend(undefined, 'd1');

    expect(store).not.toBe(CloudStore.instance);
    expect(store.backendType()).toBe('directus');
    expect(store._handle()).toMatchObject({ id: 'd1', type: 'directus', url: 'http://localhost:8055' });
  });

  it('wants a NEUTRAL filter — the adapter runs the dialect translator itself', () => {
    expect(CloudStore.forBackend(undefined, 'd1').usesNeutralFilter).toBe(true);
  });

  it('is cached, so the store a node subscribes to is the store it queries through', () => {
    expect(CloudStore.forBackend(undefined, 'd1')).toBe(CloudStore.forBackend(undefined, 'd1'));
  });

  it('⚠️ still resolves `_active_` to the endpoint, not to the BYOB active backend', () => {
    expect(CloudStore.forBackend(undefined, '_active_')).toBe(CloudStore.instance);
  });

  it('refreshes a live store’s handle when the metadata changes under it', () => {
    const store = CloudStore.forBackend(undefined, 'd1');
    Object.assign(metadata, {
      backendServices: {
        activeBackendId: 'd1',
        backends: [Object.assign({}, DIRECTUS, { url: 'http://elsewhere:8055' })]
      }
    });

    expect(CloudStore.forBackend(undefined, 'd1')).toBe(store);
    expect(store._handle().url).toBe('http://elsewhere:8055');
  });

  it('passes the serializeObject hook, which is what stops a json column double-encoding', () => {
    const store = CloudStore.forBackend(undefined, 'd1');
    // Reaching into the adapter is the only way to observe the hook without a server, and
    // the hook's absence is the defect `RestDataAdapter`'s own notes flag.
    const serialize = (store._adapter as unknown as { serializeObject: (d: unknown, c: string) => unknown })
      .serializeObject;

    expect(serialize({ payload: '{"a":1}' }, 'articles')).toEqual({ payload: { a: 1 } });
  });
});

describe('two model scopes', () => {
  beforeEach(() =>
    setMetadata({ backendServices: { activeBackendId: 'd1', backends: [DIRECTUS] } })
  );

  it('get one store each, because a scope is a separate record store', () => {
    const a = { _cloudStoresByBackend: undefined } as unknown as Parameters<typeof CloudStore.forBackend>[0];
    const b = { _cloudStoresByBackend: undefined } as unknown as Parameters<typeof CloudStore.forBackend>[0];

    expect(CloudStore.forBackend(a, 'd1')).toBe(CloudStore.forBackend(a, 'd1'));
    expect(CloudStore.forBackend(a, 'd1')).not.toBe(CloudStore.forBackend(b, 'd1'));
  });
});
