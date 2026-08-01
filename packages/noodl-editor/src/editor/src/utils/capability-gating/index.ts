/**
 * Capability gating in the editor — BCN-010, and criterion 3 of the phase.
 *
 * > Anything a chosen backend cannot do is **visible in the editor, with a
 * > sentence saying why** — before it is discovered at runtime.
 *
 * Three surfaces read this module and they must not disagree: the property
 * panel disables a port and puts the sentence under it, the node picker marks a
 * row, and the canvas raises a warning on a placed node. All three go through
 * {@link gateForNode} / {@link gateForPort}, which go through the contract's
 * single `gateFor`.
 *
 * ## ⚠️ What this deliberately does NOT read
 *
 * **`CloudStore._handle()` and `queryutils.backendType()`.**
 *
 * The phase register carries this as an open item: *"`CloudStore._handle()`
 * still answers `nodegx` unconditionally, so the capability gate reads a floor
 * rather than the truth."* That entry is now half stale and half load-bearing,
 * and the distinction decides the design here:
 *
 * - **Half stale.** Since BCN-004 step 5, a `CloudStore` constructed with a
 *   resolved target answers *that* target's type (`cloudstore.js:128-145`). The
 *   unconditional `nodegx` is the **legacy singleton's** branch only.
 * - **Half true, and it is the half that matters.** The singleton is what every
 *   auth and file node still uses, because BCN-009 step 4 found `user.ts`,
 *   `setuserproperties.ts`, `cloudfilenode.ts` and `signfileurl.ts` have no
 *   `backendId` port at all. Those are precisely the nodes this task most needs
 *   to gate — Request Magic Link among them. A gate reading the singleton would
 *   have answered `nodegx` for every one of them, and `nodegx` supports
 *   *everything*, so the gate would have been permanently open and looked as if
 *   it worked.
 *
 * So nothing here reads either. Resolution goes through
 * `api/backends/resolveBackend.pure.ts` — the same pure functions the Record family
 * and the runtime already use — against the project's own metadata. That answers
 * the truth for a node with a `backendId` port *and* for a node without one, and
 * it does not require the singleton to be fixed first.
 *
 * ⚠️ It also means the editor can be **stricter than the runtime**, and in one
 * measured case it is: `realtimeSupportFor('directus')` returns `supported`
 * unconditionally while the descriptor says `conditional`. The editor gates on
 * the descriptor and so shows Subscribe To Changes closed until a probe opens
 * it. Recorded in the BCN-010 notes; the runtime's copy is not this task's.
 *
 * @module capability-gating
 */

import {
  boundCapabilityKeys,
  descriptorFor,
  gateFor,
  nodeCapabilityKey,
  portCapabilityKey,
  type BackendType,
  type CapabilityGate,
  type CapabilityKey
} from '@noodl/backend-contract';
import {
  ACTIVE_BACKEND,
  backendEntries,
  defaultBackendId,
  resolveBackendTarget,
  type BackendMetaDataSources
} from '@noodl/runtime/src/api/backends/resolveBackend.pure';

import { ProjectModel } from '@noodl-models/projectmodel';

import { capabilityProbes } from './probeCache';

/** Which backend a gate is being resolved against. */
export interface GateTarget {
  /** The backend entry's id — `_endpoint_` for the `cloudservices` pointer. */
  backendId?: string;
  type?: BackendType;
  url?: string;
  /** The entry's display name, for a sentence that has to name it. */
  name?: string;
}

/** The two metadata keys resolution reads, off the open project. */
export function projectSources(project?: ProjectModel | null): BackendMetaDataSources {
  const model = project || ProjectModel.instance;
  if (!model || typeof model.getMetaData !== 'function') return {};
  return {
    backendServices: model.getMetaData('backendServices'),
    cloudservices: model.getMetaData('cloudservices')
  };
}

/**
 * Resolve the backend a node is bound to.
 *
 * `backendId` is the node's own `backendId` parameter when it has one. `undefined`
 * and `'_active_'` both mean "the project's backend", which is what every node
 * without the port gets — and is the correct answer for them rather than a
 * fallback, since that is exactly what `CloudStore`'s singleton resolves to once
 * BCN-009 step 2's convergence is honoured.
 */
export function resolveGateTarget(backendId?: string, project?: ProjectModel | null): GateTarget {
  const sources = projectSources(project);
  const wanted = !backendId || backendId === ACTIVE_BACKEND ? defaultBackendId(sources) : backendId;
  const target = resolveBackendTarget(wanted, sources);

  if (!target) {
    // A node pointed at a backend the project no longer has. Not gated on a
    // guess: `gateFor(undefined, …)` is open, and the missing backend is a
    // different complaint with a different owner.
    return {};
  }

  return {
    backendId: target.entry.id,
    type: target.handle.type,
    url: target.handle.url,
    name: target.entry.name || target.entry.id
  };
}

/** Every backend the open project can reach — for a caller listing them. */
export function projectBackends(project?: ProjectModel | null) {
  return backendEntries(projectSources(project));
}

/**
 * The gate for a node type as a whole, or `undefined` when it binds nothing.
 *
 * `undefined` and "supported" are different answers and callers depend on it:
 * a node with no binding is not decorated at all, while a node whose binding
 * happens to be supported on this backend is also not decorated — but the second
 * one becomes decorated the moment the backend changes, and the first never does.
 */
export function gateForNode(typeName: string, target: GateTarget): CapabilityGate | undefined {
  const key = nodeCapabilityKey(typeName);
  if (!key) return undefined;
  return gateWith(key, target);
}

/** The gate for one input port, or `undefined` when it binds nothing. */
export function gateForPort(typeName: string, portName: string, target: GateTarget): CapabilityGate | undefined {
  const key = portCapabilityKey(typeName, portName);
  if (!key) return undefined;
  return gateWith(key, target);
}

/** Resolve one key against a target, folding in whatever probes have settled. */
export function gateWith(key: CapabilityKey, target: GateTarget): CapabilityGate {
  const gate = gateFor(target.type, key, {
    probes: target.backendId ? capabilityProbes().results(target.backendId) : undefined
  });

  // An unprobed conditional is the one state that is *worth asking about*. Kick
  // the probe off here rather than in each view, so the three surfaces cannot
  // disagree about when a question gets asked; the cache coalesces and the
  // change listener repaints.
  if (gate.isUnprobed && target.backendId && target.type && target.url) {
    void capabilityProbes().ensure(target.backendId, target.type, target.url, key);
  }

  return gate;
}

/**
 * A one-line sentence naming the backend, for a surface with no room for prose.
 *
 * The reason strings are written without a subject — "Directus has no
 * magic-link login" already names it, but "Totals and averages have to be
 * switched on for your Supabase project" does not always. The backend's own
 * display name is prefixed only where the reason does not already carry it, so
 * the common case reads as one sentence rather than as a label plus a sentence.
 */
export function gateSentence(gate: CapabilityGate, target: GateTarget): string | undefined {
  if (!gate.reason) return undefined;
  const name = target.name;
  if (!name || gate.reason.toLowerCase().includes(name.toLowerCase())) return gate.reason;
  return `${name}: ${gate.reason}`;
}

/**
 * Settle every conditional cell any node binds, for one backend.
 *
 * Called when a backend connects or reconnects. Doing it up front rather than
 * lazily is what makes the panel's first paint correct instead of correct one
 * repaint later.
 */
export function warmProbes(target: GateTarget): void {
  if (!target.backendId || !target.type || !target.url) return;
  const descriptor = descriptorFor(target.type);
  if (!descriptor) return;
  void capabilityProbes().ensureAll(target.backendId, target.type, target.url, boundCapabilityKeys());
}

/** Forget what was learned about a backend. Called on reconnect. */
export function invalidateProbes(backendId: string): void {
  capabilityProbes().invalidate(backendId);
}

export { capabilityProbes } from './probeCache';
