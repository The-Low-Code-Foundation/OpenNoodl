/**
 * One list, from three storage mechanisms.
 *
 * BCN-009 step 3 asks for one list and one card shape. The obstacle is not the
 * rendering — it is that a project's backend binding lives in three different
 * places depending on which kind it is, and step 2 (converging them) is a
 * separate piece of work that reaches into the runtime's resolver and the
 * exporter's injection. See `BackendPreset.configuredBy` for the three.
 *
 * This module is the seam that lets the panel be one list *before* the storage
 * converges: it projects all three sources into one shape, decides which of them
 * the project's nodes are actually talking to, and answers what each entry can
 * do. When step 2 lands, `buildBackendList` reads one metadata key instead of
 * three sources and nothing above it changes.
 *
 * @module BackendServices/backendList
 */

import { descriptorFor, isUsable, type BackendType } from '@noodl/backend-contract';

import { BackendPreset, getPreset } from './presets';
import { BackendSecurityDisclosure, securityFor } from './security';
import { BackendConfig } from './types';

/**
 * Which mechanism this entry came out of.
 *
 * Deliberately the same three as `BackendConfigurationRoute`, named for the
 * thing rather than for the route, because this is what the user is looking at
 * and that is what writes it.
 */
export type BackendListEntryKind =
  /** A `nodegx-backend` this editor starts and stops. */
  | 'managed'
  /** The project's `cloudservices` pointer — a deployed built-in, or a Parse server. */
  | 'endpoint'
  /** A `BackendConfig` in `backendServices` metadata. */
  | 'external';

export interface BackendListEntry {
  /** Stable React key, unique across the three sources. */
  key: string;
  kind: BackendListEntryKind;
  type: BackendType;
  name: string;
  /** The second identity line: what it is, and where. */
  detail: string;
  /**
   * Is this the backend the project's nodes are talking to?
   *
   * Note that two entries can be active at once today, and that is not a bug in
   * this function: `cloudservices` binds the record/auth/file nodes while
   * `backendServices.activeBackendId` binds the BYOB nodes. Saying so is better
   * than picking one and being wrong — and it is the clearest single argument
   * for step 2.
   */
  isActive: boolean;
  preset: BackendPreset;
  security: BackendSecurityDisclosure;
  /** Present for `managed` and `external`; the `endpoint` entry has no id of its own. */
  backendId?: string;
}

export interface BackendListSources {
  /** Local `nodegx-backend` processes, from `useLocalBackends`. */
  managed: readonly { id: string; name: string; port: number; running: boolean }[];
  /** The project's `cloudservices` metadata, if anything is configured. */
  endpoint?: { endpoint?: string; appId?: string; type?: string };
  /** `backendServices` metadata. */
  external: readonly BackendConfig[];
  /** `backendServices.activeBackendId`. */
  activeExternalId?: string;
}

/**
 * Which contract backend type a `cloudservices` pointer describes.
 *
 * WF-007 stores `type: 'nodegx' | 'external'` on that metadata, where `external`
 * means "a Parse-compatible server that is not ours". The contract's word for
 * that is `parse`, and the mapping is one line — but it is the *only* line, so
 * it lives here rather than being spelled out at each call site.
 *
 * An endpoint with no recorded type is read as `parse` rather than `nodegx`,
 * because the capability descriptor for `parse` is the narrower of the two:
 * guessing wide would offer aggregate on a server that answers it with
 * "master key is required".
 */
export function endpointBackendType(cloudServicesType: string | undefined): BackendType {
  return cloudServicesType === 'nodegx' ? 'nodegx' : 'parse';
}

/**
 * Every backend this project can see, in one list, in one order.
 *
 * Order is deliberate and not alphabetical: the backend the project is talking
 * to comes first, because in a panel that can hold several of these the one that
 * answers "where is my data" should not need to be found.
 */
export function buildBackendList(sources: BackendListSources): BackendListEntry[] {
  const entries: BackendListEntry[] = [];

  for (const backend of sources.managed) {
    entries.push({
      key: `managed:${backend.id}`,
      kind: 'managed',
      type: 'nodegx',
      name: backend.name,
      detail: backend.running ? `Built-in • Port ${backend.port}` : 'Built-in • Stopped',
      // A managed backend is what the project is talking to when it wrote the
      // endpoint; matching on the endpoint rather than on "is running" avoids
      // calling a second, unrelated backend active just because it is up.
      isActive: Boolean(sources.endpoint?.endpoint?.includes(`:${backend.port}`)),
      preset: getPreset('nodegx'),
      security: securityFor('nodegx'),
      backendId: backend.id
    });
  }

  if (sources.endpoint?.endpoint) {
    const type = endpointBackendType(sources.endpoint.type);
    entries.push({
      key: 'endpoint',
      kind: 'endpoint',
      type,
      name: sources.endpoint.appId || sources.endpoint.endpoint,
      detail: `${getPreset(type).displayName} • ${sources.endpoint.endpoint}`,
      isActive: true,
      preset: getPreset(type),
      security: securityFor(type)
    });
  }

  for (const backend of sources.external) {
    entries.push({
      key: `external:${backend.id}`,
      kind: 'external',
      type: backend.type,
      name: backend.name,
      detail: `${getPreset(backend.type).displayName} • ${backend.url}`,
      isActive: backend.id === sources.activeExternalId,
      preset: getPreset(backend.type),
      security: securityFor(backend.type),
      backendId: backend.id
    });
  }

  return entries.sort((a, b) => Number(b.isActive) - Number(a.isActive));
}

// ============================================================================
// What an entry can do from here
// ============================================================================

export interface SurfaceAvailability {
  isAvailable: boolean;
  /** Present whenever it is not, because a disabled button with no sentence teaches nothing. */
  reason?: string;
}

/** The four contract operations a record grid needs before it can be offered. */
const BROWSE_OPERATIONS = ['data.query', 'data.create', 'data.save', 'data.delete'] as const;

/**
 * Whether the Data Browser can be opened for this entry.
 *
 * ⚠️ **The spec's premise here is ahead of the code, and the honest answer is
 * narrower than "any backend whose adapter supports the browse operations".**
 *
 * The Data Browser does not speak HTTP at all. Every one of its calls is an
 * Electron IPC invoke — `backend:getSchema`, `backend:queryRecords`,
 * `backend:saveRecord` — answered in the main process by the manager that owns
 * the `nodegx-backend` child processes. There is no URL in it to repoint. So
 * generalising it needs *two* things that do not exist yet: BCN-004's REST
 * adapter, and a main-process route that hands an arbitrary backend handle to an
 * adapter instead of to a local process id. Reaching for the URL directly, which
 * is the shortcut available today, would re-create exactly the coupling this
 * phase is removing — the spec's own trap says so.
 *
 * What is implementable now, and what this does, is the phase's actual rule:
 * **anything a chosen backend cannot do is visible in the editor, with a
 * sentence saying why, before it is discovered at runtime.** Two gates, in this
 * order:
 *
 * 1. the capability descriptor — if the backend cannot do the four record
 *    operations, the answer is no and the reason is the descriptor's own; then
 * 2. the transport — if it can, but nothing in the editor can reach it yet, say
 *    that instead of showing a button that does nothing.
 *
 * When BCN-004 and the main-process route land, gate 2 loses cases and gate 1
 * stays exactly as it is.
 */
export function dataBrowserAvailability(type: BackendType, kind: BackendListEntryKind): SurfaceAvailability {
  const descriptor = descriptorFor(type);

  for (const key of BROWSE_OPERATIONS) {
    const capability = descriptor.capabilities[key];
    if (!isUsable(capability)) {
      return {
        isAvailable: false,
        reason: capability.state === 'supported' ? undefined : capability.reason
      };
    }
  }

  if (kind !== 'managed') {
    return {
      isAvailable: false,
      reason: `Records on ${getPreset(type).displayName} are edited in its own admin, not from here. The editor can open the record grid for a backend it runs on this computer.`
    };
  }

  return { isAvailable: true };
}
