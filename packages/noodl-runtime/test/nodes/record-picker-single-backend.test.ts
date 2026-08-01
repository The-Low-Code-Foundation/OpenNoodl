/**
 * BCN-004 step 6: the `hideWhenSingleBackend` branch, on the project shapes that
 * actually occur.
 *
 * ⚠️ **This branch is the one that can silently move every Record node in a project**,
 * and until now nothing had exercised it against realistic metadata. `schema-ports`'
 * own test asserts `backendPickerPorts(single, {hideWhenSingleBackend: true}) === []`
 * — true, and it says nothing about the question that matters, which is *what counts
 * as one backend*.
 *
 * The near-miss BCN-004 step 5 recorded: a project with the built-in backend plus one
 * Directus has **two** backends, but they live in two different metadata keys —
 * `cloudservices` binds the Record family, `backendServices.activeBackendId` binds the
 * BYOB nodes. A count taken over `backendServices.backends` alone reports **one**,
 * hides the picker, and leaves every Record node resolving `_active_`. If `_active_`
 * then resolved to the BYOB active backend, every Record node in that project would
 * quietly start reading and writing Directus.
 *
 * So the three shapes below are the test. Each pairs the picker's visibility with what
 * `_active_` resolves to, because either one alone is only half the claim.
 */

import {
  backendEntries,
  defaultBackendId,
  ENDPOINT_BACKEND_ID,
  resolveBackendTarget
} from '../../src/api/backends/resolveBackend';
import { recordBackendPickerPorts, metaDataSources } from '../../src/nodes/std-library/data/record-ports';
import { recordSchemaContext } from '../../src/nodes/std-library/data/record-ports';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

const DIRECTUS_ENTRY = {
  id: 'd1',
  name: 'Local Directus',
  type: 'directus',
  url: 'http://localhost:8055',
  schema: { collections: [] }
};

/** The smallest graph model `recordSchemaContext` accepts. */
function graphModelFor(metadata: Record<string, unknown>) {
  return {
    getMetaData: (key: string) => metadata[key],
    getNodesWithType: () => [],
    on: () => undefined,
    off: () => undefined
  } as unknown as Any;
}

function pickerPortsFor(metadata: Record<string, unknown>) {
  const ctx = recordSchemaContext(graphModelFor(metadata), {});
  return recordBackendPickerPorts(ctx);
}

/** The project shapes, named the way a user would describe them. */
const ONLY_BUILT_IN = {
  cloudservices: { endpoint: 'http://localhost:8577', appId: 'my-app', type: 'nodegx' }
};

const BUILT_IN_PLUS_DIRECTUS = {
  cloudservices: { endpoint: 'http://localhost:8577', appId: 'my-app', type: 'nodegx' },
  backendServices: { activeBackendId: 'd1', backends: [DIRECTUS_ENTRY] }
};

const ONLY_DIRECTUS = {
  backendServices: { activeBackendId: 'd1', backends: [DIRECTUS_ENTRY] }
};

const NOTHING_CONFIGURED = {};

describe('a project with only the built-in backend', () => {
  test('counts as one backend and hides the picker', () => {
    expect(backendEntries(metaDataSources(graphModelFor(ONLY_BUILT_IN)))).toHaveLength(1);
    expect(pickerPortsFor(ONLY_BUILT_IN)).toEqual([]);
  });

  test("and '_active_' still resolves to the built-in backend, not to nothing", () => {
    // Hiding the picker is only safe because there is exactly one answer and this is it.
    expect(defaultBackendId(metaDataSources(graphModelFor(ONLY_BUILT_IN)))).toBe(ENDPOINT_BACKEND_ID);
    const target = resolveBackendTarget(undefined, metaDataSources(graphModelFor(ONLY_BUILT_IN)));
    expect(target?.entry.id).toBe(ENDPOINT_BACKEND_ID);
    expect(target?.isParseWire).toBe(true);
  });
});

describe('a project with only one external backend', () => {
  test('counts as one backend and hides the picker', () => {
    expect(backendEntries(metaDataSources(graphModelFor(ONLY_DIRECTUS)))).toHaveLength(1);
    expect(pickerPortsFor(ONLY_DIRECTUS)).toEqual([]);
  });

  test("and '_active_' resolves to it", () => {
    const target = resolveBackendTarget(undefined, metaDataSources(graphModelFor(ONLY_DIRECTUS)));
    expect(target?.entry.id).toBe('d1');
    expect(target?.isParseWire).toBe(false);
  });
});

describe('the near-miss: built-in PLUS one external backend', () => {
  test('counts as TWO backends, so the picker is SHOWN', () => {
    // The whole point. A count over `backendServices.backends` alone says one.
    expect(backendEntries(metaDataSources(graphModelFor(BUILT_IN_PLUS_DIRECTUS)))).toHaveLength(2);

    const ports = pickerPortsFor(BUILT_IN_PLUS_DIRECTUS);
    expect(ports).toHaveLength(1);
    expect(ports[0].name).toBe('backendId');
  });

  test('the picker offers Active Backend, the built-in one, and the external one', () => {
    const ports = pickerPortsFor(BUILT_IN_PLUS_DIRECTUS);
    const values = ((ports[0].type as Any).enums as Array<{ value: string }>).map((e) => e.value);

    expect(values).toEqual(['_active_', ENDPOINT_BACKEND_ID, 'd1']);
  });

  test("⚠️ '_active_' resolves to the BUILT-IN backend, not to activeBackendId", () => {
    // `backendServices.activeBackendId` is 'd1' here. Resolving `_active_` to it would
    // move every Record node in every existing project onto whichever REST backend was
    // added last — the silent-migration defect this ordering exists to prevent.
    const target = resolveBackendTarget('_active_', metaDataSources(graphModelFor(BUILT_IN_PLUS_DIRECTUS)));
    expect(target?.entry.id).toBe(ENDPOINT_BACKEND_ID);
  });

  test('and the external backend is still reachable by naming it', () => {
    const target = resolveBackendTarget('d1', metaDataSources(graphModelFor(BUILT_IN_PLUS_DIRECTUS)));
    expect(target?.entry.id).toBe('d1');
    expect(target?.handle.url).toBe('http://localhost:8055');
  });
});

describe('a project with nothing configured', () => {
  test('has no backends, so the picker is hidden', () => {
    expect(backendEntries(metaDataSources(graphModelFor(NOTHING_CONFIGURED)))).toHaveLength(0);
    expect(pickerPortsFor(NOTHING_CONFIGURED)).toEqual([]);
  });

  test("and '_active_' resolves to nothing rather than inventing a backend", () => {
    expect(defaultBackendId(metaDataSources(graphModelFor(NOTHING_CONFIGURED)))).toBeUndefined();
    expect(resolveBackendTarget(undefined, metaDataSources(graphModelFor(NOTHING_CONFIGURED)))).toBeUndefined();
  });
});
