/**
 * Backend resolution — the pure half. BCN-010 split this out of
 * `resolveBackend.ts`; the rules are unchanged and there is still exactly one
 * copy of them.
 *
 * ## Why the split exists, and it is not tidiness
 *
 * `resolveBackend.ts` ends with two functions that read the running
 * `NoodlRuntime` singleton, through a `require` that is deliberately lazy so
 * that translating a filter never constructs a singleton. **Webpack resolves a
 * `require` statically whatever scope it is in**, so any consumer that imports
 * that module pulls `noodl-runtime.ts` — and therefore every node in the
 * standard library — into its bundle.
 *
 * That is invisible inside the runtime's own bundle and fatal outside it. The
 * editor's capability gating needs `defaultBackendId` and `resolveBackendTarget`
 * and nothing else; importing them from `resolveBackend.ts` failed the editor's
 * test build with **183 TypeScript errors**, none of them in any file this task
 * wrote — `stream-buffer.ts` uses `import =`/`export =`, which the editor's
 * ESM-targeting loader refuses. It is the PLAT-003 slice 13 shape exactly:
 * *"moving a `.js` file to `.ts` makes every consumer compile it."*
 *
 * So the pure rules live here, `resolveBackend.ts` re-exports every one of them
 * unchanged — its three importers (`cloudstore.js`, `dbcollectionnode2.ts`,
 * `userservice.ts`) did not move — and a consumer outside the runtime imports
 * this file directly.
 *
 * @module noodl-runtime
 */

/* The original module docblock, unchanged: */
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

import type { BackendHandle, BackendType, RelationDescriptor } from '@noodl/backend-contract';

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
  /**
   * The relations the editor's schema sync recorded, or `undefined` on a project synced
   * before it did. Admin-only on every REST backend, so this is the only way a running
   * app can have them at all — see `schema-types.d.ts`.
   */
  relations?: RelationDescriptor[];
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
    // ⚠️ The app id used to win whenever there was one, so the Backend dropdown read
    // `backend_ms94j6xso72rl` beside "Rig Directus". An app id is *identity*, not a name.
    // BCN-009 step 2 made the same judgement in the editor's `endpointDisplayName`; this is
    // the runtime's copy of the label and the two now agree.
    //
    // A **label**, not an id — `ENDPOINT_BACKEND_ID` is what a saved node parameter holds —
    // so no stored value changes and no picker selection breaks.
    //
    // The strings are unchanged: "Built-in" is Richard's answer to open question 1 ("says
    // least, ages best"). Only which value *wins* changes — the name, not the app id.
    name: type === 'nodegx' ? 'Built-in' : 'Parse Server',
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

  // BCN-009 step 2 landed the editor half: a converged project records **one** selection in
  // `activeBackendId`, and it may name the endpoint. Honour it — without this the panel's
  // badge moves and the record nodes do not, which is the split this phase exists to end.
  //
  // ⚠️ Gated on the version, and the gate is the whole safety of this branch. Legacy and
  // converged metadata are byte-identical in the one case that matters — an endpoint plus
  // `activeBackendId: 'backend_x'` — and the two readings are opposite. Ungated, this line
  // moves every Record node in every project saved before the convergence onto whichever
  // REST backend happened to be added last. That is BCN-004 §2.1's exact disaster.
  if (isConvergedSelection(sources)) {
    const converged = sources.backendServices?.activeBackendId;
    if (converged && entries.some((entry) => entry.id === converged)) return converged;
  }

  const endpoint = endpointBackendEntry(sources.cloudservices);
  if (endpoint) return endpoint.id;

  const active = sources.backendServices?.activeBackendId;
  if (active && entries.some((entry) => entry.id === active)) return active;

  if (entries.length === 1) return entries[0].id;
  return active;
}

/**
 * Has the editor converged this project's two selections into one?
 *
 * Read through a named predicate rather than inline, because **three** call sites have to
 * agree about it — this module's `defaultBackendId`, `byob-utils.ts`'s resolution, and the
 * BYOB port context's backend count. A project where two of the three agree resolves one
 * family of nodes differently from another, which is the defect, not a smaller version of it.
 */
export function isConvergedSelection(sources: BackendMetaDataSources): boolean {
  return (sources.backendServices?.version ?? 1) >= 2;
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
    collections: entry.schema?.collections || [],
    relations: entry.schema?.relations
  };
}

/**
 * Does this target carry relation descriptors the editor actually stored?
 *
 * ⚠️ **`.length`, not just presence, and that is the whole point of the function.** Three
 * states have to stay distinct:
 *
 * - `undefined` — the project was synced before the editor stored relations, or never
 *   synced. Use the derived subset.
 * - `[]` — synced, and this backend genuinely describes no relations. **Also use the
 *   derived subset**, because an empty stored array must not silence a fallback that might
 *   still find something; a `custom` backend is the case that makes this real.
 * - non-empty — the authoritative descriptors. Use them.
 *
 * Named and exported rather than inlined at the one call site because the distinction is
 * invisible at a glance and a mutation proved nothing else covered it: rewriting the
 * condition to a bare `target.relations &&` left every suite green.
 */
export function hasStoredRelations(target: ResolvedBackendTarget | undefined): boolean {
  return !!(target && target.relations && target.relations.length > 0);
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

