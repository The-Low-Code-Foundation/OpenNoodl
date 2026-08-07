/**
 * BCN-009 step 2's runtime half — the three follow-ups its §8 specified and left unwritten.
 *
 * The editor now converges a project's two selections into one: `backendServices` grows a
 * `version: 2` marker and `activeBackendId` becomes the project's single answer, which may
 * hold the literal `'_endpoint_'`. Merged in `23179bf2`. Until the runtime honours that, the
 * panel's badge moves and the record nodes do not — so BCN-009's own criterion, *"a deployed
 * app resolves its backend from the unified metadata"*, was unmet.
 *
 * ## ⚠️ Why almost every test here is about the version gate
 *
 * Legacy and converged metadata are **byte-identical** in the one case that matters: an
 * endpoint plus `activeBackendId: 'backend_x'`. The two readings are opposite —
 *
 *   - legacy: record/auth/file nodes use the endpoint, BYOB nodes use `backend_x`;
 *   - converged: *everything* uses `backend_x`.
 *
 * So the gate is not defensive tidiness, it is the only thing distinguishing them. Applied
 * ungated, honouring `activeBackendId` moves every Record node in every project saved before
 * the convergence onto whichever REST backend happened to be added last — BCN-004 §2.1's
 * exact disaster, silently, on open.
 *
 * The legacy cases below are therefore the load-bearing half of this file, not the controls.
 */

import {
  defaultBackendId,
  endpointBackendEntry,
  isConvergedSelection,
  resolveBackendTarget,
  ENDPOINT_BACKEND_ID
} from '../../src/api/backends/resolveBackend';

const ENDPOINT = { endpoint: 'http://localhost:8577', appId: 'backend_ms94j6xso72rl', type: 'nodegx' };

const DIRECTUS = {
  id: 'backend_directus',
  name: 'Rig Directus',
  type: 'directus',
  url: 'http://localhost:8055'
};

/** The exact shape that is ambiguous without a version: an endpoint AND a named active. */
const legacy = {
  cloudservices: ENDPOINT,
  backendServices: { activeBackendId: DIRECTUS.id, backends: [DIRECTUS] }
};

/** The same bytes, plus the marker. */
const converged = {
  cloudservices: ENDPOINT,
  backendServices: { version: 2, activeBackendId: DIRECTUS.id, backends: [DIRECTUS] }
};

/** Converged, with the project pointed back at the built-in backend. */
const convergedOnEndpoint = {
  cloudservices: ENDPOINT,
  backendServices: { version: 2, activeBackendId: ENDPOINT_BACKEND_ID, backends: [DIRECTUS] }
};

describe('the version gate', () => {
  test('absent means legacy', () => {
    expect(isConvergedSelection(legacy)).toBe(false);
    expect(isConvergedSelection({ backendServices: { version: 1, backends: [] } })).toBe(false);
  });

  test('2 or higher means converged, so a later version is not read as legacy', () => {
    expect(isConvergedSelection(converged)).toBe(true);
    expect(isConvergedSelection({ backendServices: { version: 3, backends: [] } })).toBe(true);
  });
});

describe('⚠️ a LEGACY project resolves exactly as it did before', () => {
  test('the endpoint still wins, even though activeBackendId names Directus', () => {
    // The disaster case. Anything but `_endpoint_` here means every Record node in every
    // pre-convergence project has just moved to Directus.
    expect(defaultBackendId(legacy)).toBe(ENDPOINT_BACKEND_ID);
  });

  test("and '_active_' resolves to the endpoint, not to the BYOB active backend", () => {
    const target = resolveBackendTarget('_active_', legacy);

    expect(target?.entry.id).toBe(ENDPOINT_BACKEND_ID);
    expect(target?.handle.url).toBe(ENDPOINT.endpoint);
    expect(target?.isParseWire).toBe(true);
  });

  test('a project with no endpoint still falls back to activeBackendId', () => {
    expect(defaultBackendId({ backendServices: { activeBackendId: DIRECTUS.id, backends: [DIRECTUS] } })).toBe(
      DIRECTUS.id
    );
  });

  test('a single configured backend is still the default with nothing recorded', () => {
    expect(defaultBackendId({ backendServices: { backends: [DIRECTUS] } })).toBe(DIRECTUS.id);
  });
});

describe('a CONVERGED project honours its one selection', () => {
  test('activeBackendId wins over the endpoint — the badge and the nodes now agree', () => {
    expect(defaultBackendId(converged)).toBe(DIRECTUS.id);
  });

  test("'_active_' resolves to the named backend, with its URL", () => {
    const target = resolveBackendTarget('_active_', converged);

    expect(target?.entry.id).toBe(DIRECTUS.id);
    expect(target?.handle.url).toBe(DIRECTUS.url);
    expect(target?.isParseWire).toBe(false);
  });

  test('and it can point back at the endpoint by naming it', () => {
    expect(defaultBackendId(convergedOnEndpoint)).toBe(ENDPOINT_BACKEND_ID);

    const target = resolveBackendTarget('_active_', convergedOnEndpoint);
    expect(target?.handle.url).toBe(ENDPOINT.endpoint);
    expect(target?.isParseWire).toBe(true);
  });

  test('a selection naming a backend that no longer exists falls through rather than inventing one', () => {
    // Deleting the active backend must not resolve to "some other backend" silently.
    const stale = {
      cloudservices: ENDPOINT,
      backendServices: { version: 2, activeBackendId: 'deleted_backend', backends: [DIRECTUS] }
    };

    expect(defaultBackendId(stale)).toBe(ENDPOINT_BACKEND_ID);
  });

  test('an explicit node parameter still beats the project selection', () => {
    // The per-node picker has to keep working: a node pointed at Directus stays there even
    // when the project is pointed at the endpoint.
    const target = resolveBackendTarget(DIRECTUS.id, convergedOnEndpoint);

    expect(target?.entry.id).toBe(DIRECTUS.id);
  });

  test("a saved '_endpoint_' node parameter still resolves — the id survived the convergence", () => {
    // BCN-009 step 2's central promise: no saved node parameter changes value.
    for (const sources of [legacy, converged, convergedOnEndpoint]) {
      expect(resolveBackendTarget(ENDPOINT_BACKEND_ID, sources)?.handle.url).toBe(ENDPOINT.endpoint);
    }
  });
});

describe('the endpoint entry is labelled with a name, not an app id', () => {
  test('the built-in backend reads as a name', () => {
    // It used to read `backend_ms94j6xso72rl` in the Backend dropdown, beside "Rig Directus".
    // "Built-in" is Richard's answer to open question 1 — the string is unchanged, only
    // which value wins.
    expect(endpointBackendEntry(ENDPOINT)?.name).toBe('Built-in');
  });

  test('an external Parse Server reads as one too', () => {
    expect(endpointBackendEntry({ ...ENDPOINT, type: 'external' })?.name).toBe('Parse Server');
  });

  test('⚠️ but the ID is untouched, so no saved picker value breaks', () => {
    expect(endpointBackendEntry(ENDPOINT)?.id).toBe(ENDPOINT_BACKEND_ID);
    expect(ENDPOINT_BACKEND_ID).toBe('_endpoint_');
  });

  test('the app id is still reachable — it moved off the label, it was not dropped', () => {
    expect(endpointBackendEntry(ENDPOINT)?.auth?.publicToken).toBe(ENDPOINT.appId);
  });

  test('a project with no endpoint configured yields no entry at all', () => {
    expect(endpointBackendEntry(undefined)).toBeUndefined();
    expect(endpointBackendEntry({ appId: 'x' })).toBeUndefined();
  });
});
