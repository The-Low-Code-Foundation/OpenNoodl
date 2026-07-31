/**
 * BCN-009 step 2 — one storage for "which backend is this project's".
 *
 * The rules this suite pins are the ones that break projects silently if they
 * are wrong, so each spec is named for the harm rather than for the function:
 *
 * - a saved `_endpoint_` picker value must still resolve after the convergence;
 * - a legacy project must resolve exactly what it resolved before;
 * - the migration must never move a node's backend as a side effect of a save;
 * - a newly added backend must not take a project's data with it.
 *
 * Jasmine, not Jest: this suite runs as a webpack bundle inside a real Electron
 * renderer (see `tests/index.ts`), and an `import … from '@jest/globals'` throws
 * at module load and takes the whole run down with it.
 */

import {
  ACTIVE_BACKEND,
  BACKEND_SELECTION_VERSION,
  BackendSelectionSources,
  ENDPOINT_BACKEND_ID,
  canConvergeSilently,
  describeSelectionConflict,
  isConverged,
  namesABackend,
  resolveActiveBackendId,
  selectionAfterDelete,
  selectionAfterEndpointRemoved,
  selectionConflict,
  shouldActivateOnCreate
} from '../../src/editor/src/models/BackendServices/activeBackend';

function sources(overrides: Partial<BackendSelectionSources> = {}): BackendSelectionSources {
  return { backendIds: [], hasEndpoint: false, ...overrides };
}

/** Everything a project saved before BCN-009 step 2 can look like. */
const legacy = {
  /** A brand-new project. */
  empty: sources(),
  /** The commonest shape by far: a built-in backend and nothing else. */
  endpointOnly: sources({ hasEndpoint: true }),
  /** BYOB only — no `cloudservices` was ever written. */
  byobOnly: sources({ backendIds: ['b1'], storedActiveBackendId: 'b1' }),
  /** ⚠️ Two active backends. The state this task exists to end. */
  both: sources({ hasEndpoint: true, backendIds: ['b1'], storedActiveBackendId: 'b1' }),
  /** An endpoint plus BYOB backends with nothing recorded as active. */
  endpointAndUnclaimedByob: sources({ hasEndpoint: true, backendIds: ['b1', 'b2'] })
};

describe('BCN-009 step 2 — the `_endpoint_` id survives', () => {
  it('is the runtime\'s id, unchanged', () => {
    // ⚠️ Not a style preference. A node's Backend parameter can hold this string,
    // saved by a build before this change, and the runtime synthesises the entry
    // it names from `cloudservices`. Changing the value here would break every
    // one of those parameters silently. The canonical declaration is
    // `ENDPOINT_BACKEND_ID` in noodl-runtime's `api/backends/resolveBackend.ts`.
    expect(ENDPOINT_BACKEND_ID).toBe('_endpoint_');
    expect(ACTIVE_BACKEND).toBe('_active_');
  });

  it('names a backend whenever the project has an endpoint, and nothing when it does not', () => {
    expect(namesABackend(ENDPOINT_BACKEND_ID, legacy.endpointOnly)).toBe(true);
    expect(namesABackend(ENDPOINT_BACKEND_ID, legacy.byobOnly)).toBe(false);
  });

  it('is storable as the project\'s selection — which is the whole of the migration', () => {
    // The convergence adopts the runtime's synthetic id rather than replacing it,
    // so a project that selects its endpoint records the same string a node
    // records. No re-keying, no lookup table, nothing to get wrong later.
    const converged = sources({
      version: BACKEND_SELECTION_VERSION,
      hasEndpoint: true,
      backendIds: ['b1'],
      storedActiveBackendId: ENDPOINT_BACKEND_ID
    });
    expect(resolveActiveBackendId(converged)).toBe(ENDPOINT_BACKEND_ID);
  });
});

describe('BCN-009 step 2 — a legacy project resolves what it always did', () => {
  it('reads unversioned metadata as legacy', () => {
    expect(isConverged(legacy.both)).toBe(false);
    expect(isConverged(sources({ version: 1 }))).toBe(false);
    expect(isConverged(sources({ version: BACKEND_SELECTION_VERSION }))).toBe(true);
  });

  // ⚠️ This is a transcription of the runtime's `defaultBackendId`, and the specs
  // below are the same cases its own suite pins. If these two ever disagree the
  // editor draws a badge on a card the runtime is not using.
  it('resolves nothing for an empty project', () => {
    expect(resolveActiveBackendId(legacy.empty)).toBe(undefined);
  });

  it('resolves the endpoint when there is one — the record, auth and file nodes\' backend', () => {
    expect(resolveActiveBackendId(legacy.endpointOnly)).toBe(ENDPOINT_BACKEND_ID);
    expect(resolveActiveBackendId(legacy.endpointAndUnclaimedByob)).toBe(ENDPOINT_BACKEND_ID);
  });

  it('resolves the recorded BYOB backend when there is no endpoint', () => {
    expect(resolveActiveBackendId(legacy.byobOnly)).toBe('b1');
  });

  it('resolves the only backend there is, unrecorded', () => {
    expect(resolveActiveBackendId(sources({ backendIds: ['solo'] }))).toBe('solo');
  });

  it('prefers the endpoint over a recorded BYOB backend, because that is what the nodes use', () => {
    // The dangerous direction, and the one BCN-004 §2.1 found: answering `b1`
    // here would move every Record node in the project onto Directus.
    expect(resolveActiveBackendId(legacy.both)).toBe(ENDPOINT_BACKEND_ID);
  });
});

describe('BCN-009 step 2 — the converged reading', () => {
  it('honours a recorded selection over the endpoint', () => {
    const converged = sources({
      version: BACKEND_SELECTION_VERSION,
      hasEndpoint: true,
      backendIds: ['b1'],
      storedActiveBackendId: 'b1'
    });
    // Identical bytes to `legacy.both` apart from `version`, and the opposite
    // answer. That is why there is a version marker at all.
    expect(resolveActiveBackendId(converged)).toBe('b1');
    expect(resolveActiveBackendId({ ...converged, version: undefined })).toBe(ENDPOINT_BACKEND_ID);
  });

  it('falls back rather than resolving nothing when the recorded selection names nothing', () => {
    // A merge, or a delete in another checkout, can leave a dangling id. The
    // project still has a backend and refusing to name it helps nobody.
    const dangling = sources({
      version: BACKEND_SELECTION_VERSION,
      hasEndpoint: true,
      backendIds: [],
      storedActiveBackendId: 'deleted'
    });
    expect(resolveActiveBackendId(dangling)).toBe(ENDPOINT_BACKEND_ID);
  });
});

describe('BCN-009 step 2 — the migration writes only what is already true', () => {
  it('converges every legacy shape that has one active backend', () => {
    expect(canConvergeSilently(legacy.empty)).toBe(true);
    expect(canConvergeSilently(legacy.endpointOnly)).toBe(true);
    expect(canConvergeSilently(legacy.byobOnly)).toBe(true);
    expect(canConvergeSilently(legacy.endpointAndUnclaimedByob)).toBe(true);
  });

  it('⚠️ refuses the one shape with two, and names the second backend', () => {
    // Either value written as *the* selection silently repoints a family of
    // nodes: the endpoint moves every BYOB node, the BYOB backend moves every
    // Record, auth and file node. So the metadata stays legacy and the panel
    // says so, with a one-click resolution.
    expect(canConvergeSilently(legacy.both)).toBe(false);
    expect(selectionConflict(legacy.both)).toBe('b1');
  });

  it('reports no conflict once converged, whatever is recorded', () => {
    expect(selectionConflict({ ...legacy.both, version: BACKEND_SELECTION_VERSION })).toBe(undefined);
  });

  it('reports no conflict when the selection already names the endpoint', () => {
    expect(selectionConflict({ ...legacy.both, storedActiveBackendId: ENDPOINT_BACKEND_ID })).toBe(undefined);
  });

  it('is idempotent — converging a converged project changes nothing', () => {
    const once = sources({
      version: BACKEND_SELECTION_VERSION,
      hasEndpoint: true,
      storedActiveBackendId: ENDPOINT_BACKEND_ID
    });
    expect(resolveActiveBackendId(once)).toBe(resolveActiveBackendId({ ...once }));
    expect(canConvergeSilently(once)).toBe(true);
  });

  it('names both backends in the conflict sentence, and does not threaten', () => {
    const note = describeSelectionConflict('Built-in backend', 'Rig Directus');
    expect(note.includes('Built-in backend')).toBe(true);
    expect(note.includes('Rig Directus')).toBe(true);
    // Phase law: red means danger, and nothing here is broken.
    expect(note.toLowerCase().includes('warning')).toBe(false);
    expect(note.includes('!')).toBe(false);
  });
});

describe('BCN-009 step 2 — a new backend does not take the project with it', () => {
  it('⚠️ does not activate into a project that already has a backend', () => {
    // Live-QA 3.3: creating "Rig Directus" in a project with a built-in backend
    // made Directus ACTIVE immediately, with no switch dialog — the change that
    // takes a project from publishing nothing to publishing a token, made
    // silently. The old rule was `backends.length === 1`, which counted the
    // `backendServices` list without reference to the endpoint.
    expect(shouldActivateOnCreate(legacy.endpointOnly)).toBe(false);
    expect(shouldActivateOnCreate(legacy.byobOnly)).toBe(false);
    expect(shouldActivateOnCreate(legacy.both)).toBe(false);
  });

  it('activates into an empty project, where there is nothing to compare', () => {
    expect(shouldActivateOnCreate(legacy.empty)).toBe(true);
  });
});

describe('BCN-009 step 2 — the selection when the list shrinks', () => {
  it('leaves the selection alone when something else was deleted', () => {
    expect(selectionAfterDelete('b2', 'b1', sources({ backendIds: ['b1'] }))).toBe('b1');
  });

  it('prefers the endpoint over an arbitrary survivor', () => {
    // Picking the first remaining REST backend would repoint every Record, auth
    // and file node to satisfy a list order.
    const remaining = sources({ hasEndpoint: true, backendIds: ['b2'] });
    expect(selectionAfterDelete('b1', 'b1', remaining)).toBe(ENDPOINT_BACKEND_ID);
  });

  it('falls back to a survivor when there is no endpoint', () => {
    expect(selectionAfterDelete('b1', 'b1', sources({ backendIds: ['b2'] }))).toBe('b2');
    expect(selectionAfterDelete('b1', 'b1', sources())).toBe(undefined);
  });

  it('re-points a selection that named an endpoint the user just disconnected', () => {
    expect(selectionAfterEndpointRemoved(ENDPOINT_BACKEND_ID, ['b1'])).toBe('b1');
    expect(selectionAfterEndpointRemoved(ENDPOINT_BACKEND_ID, [])).toBe(undefined);
    expect(selectionAfterEndpointRemoved('b1', ['b1'])).toBe('b1');
  });
});
