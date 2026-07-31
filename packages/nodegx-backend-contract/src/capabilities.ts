/**
 * The capability descriptor — what each backend can actually do.
 *
 * This is the hard part of BCN-001 and the thing that decides whether merging
 * two node families into one is an improvement or a trade. Five backends that
 * each do ninety per cent of the same thing, differently, with a different ten
 * per cent missing, is precisely the situation where an under-specified
 * capability model produces a merged node family that lies.
 *
 * The rule the whole phase rests on: **anything a chosen backend cannot do is
 * visible in the editor, with a sentence saying why, before it is discovered at
 * runtime.** A descriptor is how that sentence gets written down once instead of
 * being guessed at by each node.
 *
 * @module backend-contract/capabilities
 */

import type { BackendType } from './backends';
import type { TokenLifecycle } from './auth';
import type { FilterOperator } from './filter';

/**
 * The four states.
 *
 * `conditional` is the one that will feel like over-engineering right up until
 * the first support ticket. It is not "we are not sure" — it is "this depends on
 * how *this* instance is configured, and the only way to know is to ask it".
 * Parse LiveQuery is a separate server most Parse deployments do not run;
 * PostgREST aggregates are off unless someone turned them on. Today every one
 * of those is a silent runtime failure. Treating `conditional` as `unsupported`
 * until a probe proves otherwise is what makes the editor's claim safe.
 */
export type CapabilityState = 'supported' | 'unsupported' | 'conditional' | 'degraded';

/**
 * How to settle a `conditional` cell against a live instance.
 *
 * Two rules learned the hard way, both from the BCN-001 probe:
 *
 * 1. **Probe the exact thing.** PostgREST answers embedded-relation counts
 *    (`?select=name,articles(count)`) with aggregates *disabled*. Probing with
 *    that request reports `supported` on an instance that cannot sum anything.
 * 2. **A 200 is not a yes.** PocketBase returns 200 and ordinary un-aggregated
 *    rows for every aggregate spelling there is. `expect` has to describe the
 *    shape of the answer, not just the status.
 */
export interface CapabilityProbe {
  method: 'GET' | 'POST' | 'HEAD';
  /** Path relative to the handle URL. `{collection}` is substituted. */
  path: string;
  /** What a positive answer looks like, in prose, for whoever implements it. */
  expect: string;
}

/**
 * One cell.
 *
 * A discriminated union rather than an optional `reason?`, so that a cell which
 * takes something away from the user cannot be written without saying why. The
 * type system is doing product-review work here, and that is deliberate: the
 * reason strings are the deliverable, not decoration on it.
 */
export type Capability =
  | { state: 'supported'; evidence?: string }
  | { state: 'unsupported'; reason: string; evidence?: string }
  | { state: 'degraded'; reason: string; evidence?: string }
  | { state: 'conditional'; reason: string; probe: CapabilityProbe; evidence?: string };

/**
 * Every key a node can be gated on.
 *
 * Derived from the fourteen data methods, the ten auth methods and the filter
 * operator set — one key per thing a node can attempt, and no key for anything
 * no node consumes. If a backend can do something no node exposes, that is a
 * future node, not a capability.
 */
export type CapabilityKey =
  // Data — one per contract method, plus the two options whose support varies
  // independently of the method that carries them.
  | 'data.query'
  | 'data.count'
  | 'data.distinct'
  | 'data.aggregate'
  | 'data.fetch'
  | 'data.create'
  | 'data.save'
  | 'data.increment'
  | 'data.delete'
  | 'data.acl'
  | 'data.search'
  // Relations. Reading a pointer, filtering by Parse's junction-less relation,
  // and mutating a relation are three different problems on every backend.
  | 'relations.pointerRead'
  | 'relations.relatedTo'
  | 'relations.addRemove'
  // Files.
  | 'files.upload'
  | 'files.sign'
  | 'files.delete'
  | 'files.private'
  | 'files.progress'
  // Auth.
  | 'auth.password'
  | 'auth.signUp'
  | 'auth.signUpProperties'
  | 'auth.emailVerify'
  | 'auth.passwordReset'
  | 'auth.oauth'
  | 'auth.magicLink'
  // Realtime — server-pushed change notification. Not the same thing as the
  // local write events in `events.ts`.
  | 'realtime.subscribe';

export const CAPABILITY_KEYS: readonly CapabilityKey[] = Object.freeze([
  'data.query',
  'data.count',
  'data.distinct',
  'data.aggregate',
  'data.fetch',
  'data.create',
  'data.save',
  'data.increment',
  'data.delete',
  'data.acl',
  'data.search',
  'relations.pointerRead',
  'relations.relatedTo',
  'relations.addRemove',
  'files.upload',
  'files.sign',
  'files.delete',
  'files.private',
  'files.progress',
  'auth.password',
  'auth.signUp',
  'auth.signUpProperties',
  'auth.emailVerify',
  'auth.passwordReset',
  'auth.oauth',
  'auth.magicLink',
  'realtime.subscribe'
]);

/**
 * A backend type's declaration.
 *
 * Attached to the **type**, not the instance. Two Directus servers have the same
 * capabilities in every respect this contract cares about, except the ones
 * marked `conditional` — which is what `conditional` is for.
 */
export interface BackendDescriptor {
  type: BackendType;
  /** How long a login lasts. See `TokenLifecycle` for why this is declared, not discovered. */
  tokenLifecycle: TokenLifecycle;
  /**
   * Whether the user may overwrite these cells themselves, in the Backend
   * Services panel.
   *
   * True for `custom` alone. A user pointing NodeGX at their own API is the one
   * case where we cannot possibly know what the backend can do — and the
   * descriptor being plain data means letting them say so costs almost nothing
   * and needs no plugin API, no versioned interface, and no support tail. They
   * declare "my API understands `_gt` but not `between`", and the editor gates
   * ports exactly as it does for a backend we shipped.
   *
   * The shipped `custom` descriptor is therefore a floor, not a verdict.
   */
  declarable?: boolean;
  capabilities: Readonly<Record<CapabilityKey, Capability>>;
  /** One cell per operator in the neutral vocabulary. */
  filters: Readonly<Record<FilterOperator, Capability>>;
}

/** Convenience: is this cell something a node may attempt right now? */
export function isUsable(capability: Capability): boolean {
  return capability.state === 'supported' || capability.state === 'degraded';
}

/** The sentence to show the user, or undefined when there is nothing to say. */
export function reasonFor(capability: Capability): string | undefined {
  return capability.state === 'supported' ? undefined : capability.reason;
}
