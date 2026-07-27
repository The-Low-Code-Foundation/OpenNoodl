/**
 * AIX-008 — request routing. These are the exact shapes the data nodes emit:
 * a Parse query is a POST carrying `_method: 'GET'`, BYOB reads
 * `{data, meta}`, and a client with no endpoint configured produces literally
 * `undefined/classes/Books`. The routing must recognise all three.
 */

import { respond, type SandboxResponse } from '../src/sandbox/responder';
import { SandboxStore } from '../src/sandbox/store';
import type { SandboxDataset } from '../src/sandbox/types';

/** The responder's bodies are shape-free by design; each spec names the shape it asserts. */
type Row = Record<string, unknown>;
interface QueryBody {
  results: Row[];
  count?: number;
}
interface ItemsBody {
  data: Row[];
  meta: { total_count: number };
}

function body<T>(answer: SandboxResponse | null | undefined): T {
  return answer?.body as T;
}

function store() {
  const dataset: SandboxDataset = {
    classes: {
      Books: {
        fields: ['title'],
        records: [
          { objectId: 'a', id: 'a', title: 'Piranesi' },
          { objectId: 'b', id: 'b', title: 'Solaris' }
        ]
      }
    },
    user: { objectId: 'sandbox-user', id: 'sandbox-user', username: 'sample.user@example.com' }
  };
  return new SandboxStore(dataset);
}

describe('AIX-008 sandbox responder', () => {
  it('answers a Parse query tunnelled through POST', () => {
    const answer = respond(
      { method: 'POST', url: 'https://backend.example/classes/Books', body: { _method: 'GET', limit: 10 } },
      store()
    );
    expect(answer?.status).toBe(200);
    expect(body<QueryBody>(answer).results.length).toBe(2);
  });

  it('routes on the path, so an unconfigured endpoint still resolves', () => {
    // `this.endpoint + path` with no endpoint is what CloudStore actually sends.
    const answer = respond({ method: 'POST', url: 'undefined/classes/Books', body: { _method: 'GET' } }, store());
    expect(body<QueryBody>(answer).results.length).toBe(2);
  });

  it('distinguishes a create from a query on the same path', () => {
    const s = store();
    const answer = respond({ method: 'POST', url: '/classes/Books', body: { title: 'New' } }, s);
    expect(answer?.status).toBe(201);
    expect(s.query('Books').count).toBe(3);
  });

  it('fetches, updates and deletes one record', () => {
    const s = store();
    expect(body<Row>(respond({ method: 'GET', url: '/classes/Books/a' }, s)).title).toBe('Piranesi');

    respond({ method: 'PUT', url: '/classes/Books/a', body: { title: 'Renamed' } }, s);
    expect(s.get('Books', 'a')?.title).toBe('Renamed');

    respond({ method: 'DELETE', url: '/classes/Books/a' }, s);
    expect(s.get('Books', 'a')).toBeUndefined();
  });

  it('applies Parse increment operators against the stored value', () => {
    const s = store();
    s.update('Books', 'a', { views: 5 });
    respond({ method: 'PUT', url: '/classes/Books/a', body: { views: { __op: 'Increment', amount: 3 } } }, s);
    expect(s.get('Books', 'a')?.views).toBe(8);
  });

  it('counts through the query string form', () => {
    const answer = respond({ method: 'GET', url: '/classes/Books?limit=0&count=1' }, store());
    expect(body<QueryBody>(answer).count).toBe(2);
  });

  it('signs any credentials in, keeping the username the user typed', () => {
    const s = store();
    const answer = respond({ method: 'POST', url: '/login', body: { username: 'me@here', password: 'x' } }, s);
    expect(body<Row>(answer).sessionToken).toBeTruthy();
    expect(body<Row>(answer).username).toBe('me@here');
    expect(body<Row>(respond({ method: 'GET', url: '/users/me' }, s)).username).toBe('me@here');
  });

  it('answers BYOB reads in the Directus shape', () => {
    const answer = respond({ method: 'GET', url: 'https://cms.example/items/Books?limit=1' }, store());
    expect(body<ItemsBody>(answer).data.length).toBe(1);
    expect(body<ItemsBody>(answer).meta.total_count).toBe(2);
  });

  it('answers a cloud function rather than failing the graph', () => {
    const answer = respond({ method: 'POST', url: '/functions/sendEmail', body: {} }, store());
    expect(answer?.status).toBe(200);
    expect(body<Row>(answer).result).toEqual({});
  });

  it('answers an unknown third-party endpoint locally — nothing leaves the machine', () => {
    const answer = respond({ method: 'GET', url: 'https://api.stripe.com/v1/charges' }, store());
    expect(answer?.status).toBe(200);
  });

  it('lets the viewer own assets through untouched', () => {
    expect(respond({ method: 'GET', url: '/noodl_modules/thing/index.js' }, store())).toBeNull();
    expect(respond({ method: 'GET', url: 'http://localhost:8574/static/main.css' }, store())).toBeNull();
  });
});
