/**
 * BCN-004 step 5, end to end: a Record node with a backend selected talks to **that
 * backend**, through the contract.
 *
 * The port tests prove the picker exists and the resolver tests prove what it resolves to.
 * Neither proves the thing the task is actually for — that the request leaves for the right
 * host, in the right shape, through `RestDataAdapter` rather than the Parse wire. So this
 * drives the real node methods against a captured `fetch` and reads the URL and the body.
 *
 * ⚠️ It is still not a live pass. No Directus answered any of this; the *responses* are
 * written here. What it pins is everything on this side of the socket.
 */
const metadata: Record<string, unknown> = {};

jest.mock('../../noodl-runtime', () => ({
  instance: { getMetaData: (key: string) => metadata[key] }
}));

import CloudStore = require('../../src/api/cloudstore');
import NewRecordModule = require('../../src/nodes/std-library/data/newdbmodelpropertiesnode');
import SetRecordModule = require('../../src/nodes/std-library/data/setdbmodelpropertiesnode');
import DeleteRecordModule = require('../../src/nodes/std-library/data/deletedbmodelpropertiesnode');
import DbModelModule = require('../../src/nodes/std-library/data/dbmodelnode2');

const DIRECTUS = {
  id: 'd1',
  name: 'Local Directus',
  type: 'directus',
  url: 'http://localhost:8055',
  auth: { publicToken: 'tok' },
  schema: {
    collections: [
      {
        name: 'articles',
        fields: [
          { name: 'id', type: 'integer', primaryKey: true },
          { name: 'title', type: 'string' },
          { name: 'payload', type: 'json' },
          { name: 'published_at', type: 'dateTime' }
        ]
      }
    ]
  }
};

interface Captured {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

let captured: Captured[] = [];
let respondWith: { status: number; body: unknown } = { status: 200, body: { data: {} } };

/**
 * The Parse wire's browser transport, recorded into the same list.
 *
 * `ParseWireAdapter` uses XHR in a browser and `fetch` in the cloud runtime; the REST
 * adapter has only `fetch`. Standing both up is what lets one assertion say "this request
 * went to the Directus host" and the next say "this one went to the Parse endpoint".
 */
function installXhr() {
  class FakeXHR {
    onreadystatechange: (() => void) | null = null;
    readyState = 0;
    status = 0;
    response = '';
    responseText = '';
    private request: Captured = { url: '', method: '', headers: {}, body: undefined };

    open(method: string, url: string) {
      this.request.method = method;
      this.request.url = url;
    }
    setRequestHeader(name: string, value: string) {
      this.request.headers[name] = value;
    }
    send(body?: string) {
      this.request.body = body === undefined ? undefined : JSON.parse(body);
      captured.push(this.request);

      this.readyState = 4;
      this.status = respondWith.status;
      this.response = respondWith.body === undefined ? '' : JSON.stringify(respondWith.body);
      this.responseText = this.response;
      // Asynchronously, like the real one, so `await settle()` is what waits for it.
      setTimeout(() => this.onreadystatechange && this.onreadystatechange(), 0);
    }
  }

  (globalThis as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = FakeXHR;
  (globalThis as unknown as { localStorage: unknown }).localStorage = {};
}

function installFetch() {
  (globalThis as unknown as { fetch: unknown }).fetch = (url: string, init: Record<string, unknown>) => {
    captured.push({
      url,
      method: (init?.method as string) || 'GET',
      headers: (init?.headers as Record<string, string>) || {},
      body: init?.body === undefined ? undefined : JSON.parse(init.body as string)
    });
    return Promise.resolve({
      status: respondWith.status,
      headers: { get: () => null },
      text: () => Promise.resolve(respondWith.body === undefined ? '' : JSON.stringify(respondWith.body))
    });
  };
}

/** A `this` the mixin-built node methods can run on. */
function makeInstance(module: { node?: { methods?: Record<string, unknown> } }, internal: Record<string, unknown>) {
  const instance: Record<string, unknown> = {
    _internal: internal,
    id: 'n1',
    signals: [] as string[],
    errors: [] as string[],
    nodeScope: { modelScope: undefined, componentOwner: { name: 'Test' } },
    context: { editorConnection: undefined },
    flagOutputDirty() {
      /* the outputs are not what this test reads */
    },
    sendSignalOnOutput(name: string) {
      (instance.signals as string[]).push(name);
    },
    raiseRuntimeError(code: string, message: string) {
      (instance.errors as string[]).push(message);
    },
    scheduleAfterInputsHaveUpdated(cb: () => void) {
      cb();
    },
    isInputConnected: () => false,
    hasOutput: () => false,
    _getACL: () => undefined
  };

  const methods = (module.node?.methods || {}) as Record<string, (...args: unknown[]) => unknown>;
  for (const key of Object.keys(methods)) {
    instance[key] = methods[key].bind(instance);
  }
  return instance;
}

/** The adapter is promise-driven; let the microtask queue drain. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  captured = [];
  respondWith = { status: 200, body: { data: {} } };
  installFetch();
  installXhr();
  for (const key of Object.keys(metadata)) delete metadata[key];
  Object.assign(metadata, {
    cloudservices: { endpoint: 'http://localhost:8577', appId: 'app' },
    backendServices: { activeBackendId: 'd1', backends: [DIRECTUS] }
  });
  CloudStore.invalidateBackends();
});

afterEach(() => {
  delete (globalThis as unknown as { fetch?: unknown }).fetch;
  delete (globalThis as unknown as { XMLHttpRequest?: unknown }).XMLHttpRequest;
  delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
});

describe('Create New Record against a Directus backend', () => {
  it('POSTs to that backend, with the token and the normalised body', async () => {
    respondWith = { status: 200, body: { data: { id: 7, title: 'Ada' } } };

    const instance = makeInstance(NewRecordModule, {
      backendId: 'd1',
      collectionId: 'articles',
      inputValues: {
        title: 'Ada',
        // ⚠️ The object-typed port hands over the *text* the author typed. Without the
        // `serializeObject` hook this reaches the column as the string `{"a":1}`.
        payload: '{"a":1}',
        published_at: new Date('2026-07-31T00:00:00.000Z')
      }
    });

    (instance.storageInsert as () => void)();
    await settle();

    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe('POST');
    expect(captured[0].url).toBe('http://localhost:8055/items/articles');
    expect(captured[0].headers.Authorization).toBe('Bearer tok');
    expect(captured[0].body).toEqual({
      title: 'Ada',
      payload: { a: 1 },
      published_at: '2026-07-31T00:00:00.000Z'
    });
    expect(instance.signals).toEqual(['created']);
  });

  it('⚠️ goes to the Parse endpoint instead when nothing is selected', async () => {
    // The no-regression floor: an unset picker is `_active_`, and `_active_` is the
    // backend the Record family has always talked to.
    respondWith = { status: 201, body: { objectId: 'abc', createdAt: '2026-07-31T00:00:00.000Z' } };

    const instance = makeInstance(NewRecordModule, {
      collectionId: 'Article',
      inputValues: { title: 'Ada' }
    });

    (instance.storageInsert as () => void)();
    await settle();

    expect(captured).toHaveLength(1);
    expect(captured[0].url).toBe('http://localhost:8577/classes/Article');
    expect(captured[0].headers['X-Parse-Application-Id']).toBe('app');
  });

  it('reports a backend the project does not have rather than writing somewhere else', async () => {
    const instance = makeInstance(NewRecordModule, {
      backendId: 'deleted-backend',
      collectionId: 'articles',
      inputValues: { title: 'Ada' }
    });

    (instance.storageInsert as () => void)();
    await settle();

    expect(captured).toEqual([]);
    expect(instance.errors[0]).toContain('deleted-backend');
    expect(instance.signals).toEqual(['failure']);
  });
});

describe('Set Record Properties against a Directus backend', () => {
  it('PATCHes the addressed record on that backend', async () => {
    respondWith = { status: 200, body: { data: { id: 7, title: 'Grace' } } };

    const model = {
      getId: () => '7',
      data: { title: 'Grace' },
      set() {
        /* the model is not what this test reads */
      }
    };
    const instance = makeInstance(SetRecordModule, {
      backendId: 'd1',
      collectionId: 'articles',
      model,
      inputValues: { title: 'Grace' }
    });

    (instance.scheduleSave as () => void)();
    await settle();

    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe('PATCH');
    expect(captured[0].url).toBe('http://localhost:8055/items/articles/7');
    expect(captured[0].body).toEqual({ title: 'Grace' });
    expect(instance.signals).toEqual(['stored']);
  });
});

describe('Delete Record against a Directus backend', () => {
  it('DELETEs on that backend, and keeps its documented ModelScope defect', async () => {
    respondWith = { status: 204, body: undefined };

    const notified: string[] = [];
    const instance = makeInstance(DeleteRecordModule, {
      backendId: 'd1',
      collectionId: 'articles',
      model: { getId: () => '7', notify: (what: string) => notified.push(what) }
    });

    (instance.storageDelete as () => void)();
    await settle();

    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe('DELETE');
    expect(captured[0].url).toBe('http://localhost:8055/items/articles/7');
    expect(notified).toEqual(['delete']);
    expect(instance.signals).toEqual(['deleted']);
  });
});

describe('Record (read) against a Directus backend', () => {
  it('GETs the addressed record on that backend', async () => {
    respondWith = { status: 200, body: { data: { id: 7, title: 'Ada' } } };

    const instance = makeInstance(DbModelModule, {
      backendId: 'd1',
      collectionId: 'articles',
      modelId: '7',
      inputValues: {}
    });

    (instance.scheduleFetch as () => void)();
    await settle();

    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe('GET');
    expect(captured[0].url).toBe('http://localhost:8055/items/articles/7');
    expect(instance.signals).toEqual(['fetched']);
  });
});
