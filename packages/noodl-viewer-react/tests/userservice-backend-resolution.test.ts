/**
 * BCN-006 step 4 — which backend `UserService` signs in to, and with which adapter.
 *
 * This is the seam that makes auth reachable on a REST backend at all, and it is
 * the one part of step 4 the live pass could **not** exercise: a browser run needs
 * a project configured one way or the other, and the property that matters is the
 * *branch between them*.
 *
 * The risk being covered is a regression, not a feature. `_handle()` has always
 * answered "the `cloudservices` endpoint, type `nodegx`", and every existing
 * project depends on that. If the BYOB fallback below ever fires for a project
 * that has an endpoint, every user of that app is signed out and signed in
 * somewhere else — silently, because both paths "work".
 */

import NoodlRuntime from '@noodl/runtime';
import { ParseAuthAdapter } from '@noodl/runtime/src/api/backends/ParseAuthAdapter';
import { RestAuthAdapter } from '@noodl/runtime/src/api/backends/RestAuthAdapter';

import UserService from '../src/nodes/std-library/user/userservice';

type MetaData = Record<string, unknown>;

/**
 * Point the runtime singleton at a project shape, for one test.
 *
 * `NoodlRuntime.instance` is an assignable static rather than a getter — it is
 * set by the constructor — and there is no runtime in a unit test at all, so this
 * substitutes one. Same approach as `cloudfunction2.test.ts`.
 */
function withMetaData(meta: MetaData, run: (service: UserService) => void) {
  const holder = NoodlRuntime as unknown as { instance?: unknown };
  const original = holder.instance;
  holder.instance = { getMetaData: (key: string) => meta[key] };
  try {
    // A fresh instance rather than the singleton: `_initCloudServices` reads the
    // metadata in the constructor, and the singleton has already read someone
    // else's.
    run(new (UserService as unknown as new () => UserService)());
  } finally {
    holder.instance = original;
  }
}

const DIRECTUS_ENTRY = {
  id: 'backend_directus_1',
  name: 'Rig Directus',
  type: 'directus',
  url: 'http://localhost:8055'
};

describe('which backend the user nodes sign in to', () => {
  test('a project with a cloudservices endpoint is unchanged — endpoint, type nodegx', () => {
    withMetaData(
      {
        cloudservices: { endpoint: 'http://localhost:8579', appId: 'app-1', type: 'nodegx' },
        // ⚠️ Present *and* active. This is the case that must not move: BCN-009
        // step 2 converged the selection onto `activeBackendId`, and a project
        // that has picked a REST backend for its Record nodes has NOT thereby
        // asked for its users to live somewhere else.
        backendServices: { backends: [DIRECTUS_ENTRY], activeBackendId: DIRECTUS_ENTRY.id, version: 2 }
      },
      (service) => {
        const handle = service._handle();
        expect(handle.type).toBe('nodegx');
        expect(handle.url).toBe('http://localhost:8579');
        expect(handle.publicToken).toBe('app-1');
      }
    );
  });

  test('a project with no endpoint at all falls back to its BYOB backend', () => {
    // BCN-006's Current State names this as the user-facing headline: "A project
    // on Directus today has data nodes and no login."
    withMetaData(
      {
        cloudservices: undefined,
        backendServices: { backends: [DIRECTUS_ENTRY], activeBackendId: DIRECTUS_ENTRY.id, version: 2 }
      },
      (service) => {
        const handle = service._handle();
        expect(handle.type).toBe('directus');
        expect(handle.url).toBe('http://localhost:8055');
      }
    );
  });

  test('a project with nothing configured still answers the old shape, not a throw', () => {
    // The pre-existing behaviour for a brand-new project: every method answers
    // "No active cloud service" before touching the network. There is no
    // behaviour here to preserve, but there is a shape.
    withMetaData({}, (service) => {
      const handle = service._handle();
      expect(handle.type).toBe('nodegx');
      expect(handle.url).toBeUndefined();
    });
  });
});

describe('which adapter serves it', () => {
  function adapterFor(meta: MetaData) {
    let picked: unknown;
    withMetaData(meta, (service) => {
      // `_adapter` is private in TypeScript, which is a compile-time claim only.
      picked = (service as unknown as { _adapter(h: unknown): unknown })._adapter(service._handle());
    });
    return picked;
  }

  test('the Parse wire serves an endpoint project', () => {
    expect(
      adapterFor({ cloudservices: { endpoint: 'http://localhost:8579', appId: 'a', type: 'nodegx' } })
    ).toBeInstanceOf(ParseAuthAdapter);
  });

  test('the REST adapter serves Directus, Supabase and PocketBase', () => {
    for (const type of ['directus', 'supabase', 'pocketbase']) {
      const adapter = adapterFor({
        backendServices: { backends: [{ ...DIRECTUS_ENTRY, type }], activeBackendId: DIRECTUS_ENTRY.id, version: 2 }
      });
      expect(adapter).toBeInstanceOf(RestAuthAdapter);
    }
  });

  test('an unrecognised type stays on the Parse wire rather than erroring', () => {
    // The same floor `resolveBackend.isParseWireType` established for the data
    // path. A backend type this build does not know about must degrade to the
    // behaviour it had, not to no behaviour.
    expect(
      adapterFor({
        backendServices: {
          backends: [{ ...DIRECTUS_ENTRY, type: 'something-new' }],
          activeBackendId: DIRECTUS_ENTRY.id,
          version: 2
        }
      })
    ).toBeInstanceOf(ParseAuthAdapter);
  });
});
