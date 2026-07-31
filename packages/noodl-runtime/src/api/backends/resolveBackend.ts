/**
 * Backend resolution, generalised — BCN-004 implementation step 3.
 *
 * `BackendHandle`'s own docblock names the problem this module closes:
 *
 * > Two resolution paths exist in the code today and they disagree. `CloudStore`
 * > reads a singleton and has exactly one implicit backend. `byob-utils.ts`'s
 * > `resolveBackend` reads `backendServices` project metadata, understands an
 * > `_active_` sentinel, and supports several backends at once.
 *
 * There is one path now. It answers a {@link BackendHandle} for either kind, so an
 * adapter never has to know which mechanism configured the backend it was handed.
 *
 * ## ⚠️ A project has *two* "active" backends, and that is not a mistake here
 *
 * The editor's own `backendList.ts` says it out loud:
 *
 * > two entries can be active at once today, and that is not a bug in this function:
 * > `cloudservices` binds the record/auth/file nodes while `backendServices.activeBackendId`
 * > binds the BYOB nodes.
 *
 * So "the active backend" is ambiguous until BCN-009 step 2 converges the storage. Until
 * then {@link resolveBackendTarget} resolves `_active_` to **the backend the caller is
 * bound to today** — the `cloudservices` endpoint when the project has one — and the
 * picker is how a record node is pointed somewhere else. Resolving `_active_` to
 * `backendServices.activeBackendId` instead would silently move every record node in
 * every existing project onto whichever REST backend happened to be added last.
 *
 * @module api/backends/resolveBackend
 */

import type { BackendHandle, BackendType } from '@noodl/backend-contract';

import type { BackendServiceEntry, BackendServicesMetaData, SchemaCollection } from '../../nodes/std-library/data/schema-types';

/** The picker's "whatever the project is pointed at" value. */
export const ACTIVE_BACKEND = '_active_';

/**
 * The id of the synthetic entry standing for the project's `cloudservices` pointer.
 *
 * It needs one because that backend is *not* in `backendServices.backends` — it is a
 * different metadata key with no id of its own (`backendList.ts`: "the `endpoint` entry
 * has no id of its own"). Without a stable id the picker could list it but never save a
 * selection of it.
 */
export const ENDPOINT_BACKEND_ID = '_endpoint_';

/** The project's `cloudservices` metadata, as much of it as resolution reads. */
export interface CloudServicesMetaData {
  endpoint?: string;
  appId?: string;
  /** WF-007 writes `'nodegx' | 'external'` here; older projects write nothing. */
  type?: string;
}

/** Everything resolution reads, passed in so the function is pure and testable. */
export interface BackendMetaDataSources {
  backendServices?: BackendServicesMetaData;
  cloudservices?: CloudServicesMetaData;
}

/** A backend, resolved, with the extras the node layer needs beyond the handle. */
export interface ResolvedBackendTarget {
  handle: BackendHandle;
  /** The `backendServices` entry, or the synthetic endpoint entry. */
  entry: BackendServiceEntry;
  /** Does this backend speak the Parse wire (and so want `ParseWireAdapter`)? */
  isParseWire: boolean;
  /** The cached schema, empty when the backend has never been introspected. */
  collections: SchemaCollection[];
}

/** The two backend types served by `ParseWireAdapter`. */
export const PARSE_WIRE_TYPES: readonly BackendType[] = ['nodegx', 'parse'];

export function isParseWireType(type: string | undefined): boolean {
  return type === undefined || PARSE_WIRE_TYPES.includes(type as BackendType);
}

/**
 * Which contract type a `cloudservices` pointer describes.
 *
 * ⚠️ **This deliberately disagrees with the editor's `endpointBackendType`**, which reads
 * a *missing* type as `parse`. The runtime's own `CloudStore._handle()` has always
 * answered `nodegx` for the same metadata, and `queryutils.backendType()` reads that
 * answer to decide which capability table greys out the visual filter builder's
 * operators. Flipping the untyped case to `parse` here would narrow the operator list in
 * every project saved before WF-007 started writing the field — a visible regression, for
 * a guess. So: honour the type when it is recorded, and keep `nodegx` as the floor when
 * it is not, exactly as the runtime already did.
 */
export function endpointBackendType(cloudServicesType: string | undefined): BackendType {
  return cloudServicesType === 'external' || cloudServicesType === 'parse' ? 'parse' : 'nodegx';
}

/**
 * The `cloudservices` pointer as a backend entry, so one list can hold both kinds.
 *
 * `undefined` when the project has no endpoint configured at all — which is the state a
 * brand-new project is in, and the state in which `backendServices.activeBackendId` is
 * the only sensible answer for `_active_`.
 */
export function endpointBackendEntry(cloudservices: CloudServicesMetaData | undefined): BackendServiceEntry | undefined {
  if (!cloudservices || !cloudservices.endpoint) return undefined;

  const type = endpointBackendType(cloudservices.type);
  return {
    id: ENDPOINT_BACKEND_ID,
    name: cloudservices.appId || (type === 'nodegx' ? 'Built-in' : 'Parse Server'),
    type,
    url: cloudservices.endpoint,
    auth: { publicToken: cloudservices.appId }
  };
}

/**
 * Every backend the project can reach, endpoint first.
 *
 * Endpoint first because it is the one the Record family is bound to today, and the
 * picker lists them in this order — the backend answering "where is my data" should not
 * have to be found.
 */
export function backendEntries(sources: BackendMetaDataSources): BackendServiceEntry[] {
  const endpoint = endpointBackendEntry(sources.cloudservices);
  const external = sources.backendServices?.backends || [];
  return endpoint ? [endpoint].concat(external) : external.slice();
}

/**
 * The id `_active_` means for this project.
 *
 * The order is the no-regression order (see the module docblock): the endpoint the
 * Record family already talks to, then the BYOB active backend, then — the
 * **single-backend default** the spec asks for — the only backend there is.
 */
export function defaultBackendId(sources: BackendMetaDataSources): string | undefined {
  const entries = backendEntries(sources);
  if (entries.length === 0) return undefined;

  const endpoint = endpointBackendEntry(sources.cloudservices);
  if (endpoint) return endpoint.id;

  const active = sources.backendServices?.activeBackendId;
  if (active && entries.some((entry) => entry.id === active)) return active;

  if (entries.length === 1) return entries[0].id;
  return active;
}

/**
 * Resolve a picker value into a backend, or `undefined` if it names nothing.
 *
 * `undefined` and `'_active_'` are the same request: whichever backend
 * {@link defaultBackendId} names. An id that no longer exists resolves to `undefined`
 * rather than silently falling back to the active one — a node pointed at a backend the
 * project no longer has should fail with a sentence, not quietly write somewhere else.
 */
export function resolveBackendTarget(
  backendId: string | undefined,
  sources: BackendMetaDataSources
): ResolvedBackendTarget | undefined {
  const wanted = !backendId || backendId === ACTIVE_BACKEND ? defaultBackendId(sources) : backendId;
  if (!wanted) return undefined;

  const entry = backendEntries(sources).find((candidate) => candidate.id === wanted);
  if (!entry) return undefined;

  return {
    handle: handleFor(entry),
    entry,
    isParseWire: isParseWireType(entry.type),
    collections: entry.schema?.collections || []
  };
}

/** One `backendServices` entry as the handle every contract method takes. */
export function handleFor(entry: BackendServiceEntry): BackendHandle {
  return {
    id: entry.id,
    type: (entry.type || 'nodegx') as BackendType,
    name: entry.name || entry.id,
    url: entry.url,
    publicToken: entry.auth?.publicToken as string | undefined,
    sessionToken: entry.auth?.sessionToken as string | undefined
  };
}

/**
 * Read the metadata off the running runtime.
 *
 * Separated from the pure functions above so every rule is unit-testable without a
 * `NoodlRuntime` singleton, and required lazily for the reason `queryutils.ts` records:
 * translating a filter (or resolving a backend) must never be the thing that constructs
 * a singleton or throws for want of ambient state.
 */
export function runtimeMetaDataSources(): BackendMetaDataSources {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const NoodlRuntime = require('../../../noodl-runtime');
    const instance = NoodlRuntime && NoodlRuntime.instance;
    if (!instance) return {};
    return {
      backendServices: instance.getMetaData('backendServices'),
      cloudservices: instance.getMetaData('cloudservices')
    };
  } catch (e) {
    return {};
  }
}

/** {@link resolveBackendTarget} against the running runtime's metadata. */
export function resolveBackendFromRuntime(backendId: string | undefined): ResolvedBackendTarget | undefined {
  return resolveBackendTarget(backendId, runtimeMetaDataSources());
}
