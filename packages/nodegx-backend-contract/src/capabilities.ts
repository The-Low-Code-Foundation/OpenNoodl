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
  /**
   * Which transport settles this one. BCN-010.
   *
   * `expect` is prose — deliberately, because "probe the exact thing" is
   * per-capability knowledge that no generic interpreter can recover from a
   * status code. But a runner still has to know whether to open a socket or
   * make a request before it can read the prose, and three of the conditional
   * cells (`realtime.subscribe` on Directus, Parse and Supabase) are settled
   * only by a 101 upgrade that `method`/`path` alone do not describe.
   *
   * Absent means `'http'`, which is what every other probe is.
   */
  kind?: 'http' | 'websocket';
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

// ─────────────────────────────────────────────────────────────────────────────
// BCN-010 — resolving a cell into something a view can render
// ─────────────────────────────────────────────────────────────────────────────

/** What a probe learned about one `conditional` cell on one instance. */
export interface ProbeOutcome {
  verdict: 'supported' | 'unsupported';
  /** `Date.now()` when it was learned. Positives expire; see {@link resolveGate}. */
  at: number;
  /** Optional detail for the reason line — what the instance actually answered. */
  detail?: string;
}

/** Probe outcomes for one backend instance, keyed by capability. */
export type ProbeResults = Readonly<Partial<Record<CapabilityKey, ProbeOutcome>>>;

/**
 * How long a **positive** probe result may be believed, in milliseconds.
 *
 * The asymmetry is the whole point and it is the spec's trap written as a
 * number: *"a Directus instance with WebSockets switched off after the probe
 * will claim realtime works"*. A stale positive is a claim we cannot back; a
 * stale negative merely under-promises. So positives expire and negatives do
 * not — **prefer a fast negative over a cached positive.**
 *
 * Five minutes rather than a session: long enough that the panel is not
 * re-probing on every repaint, short enough that a builder who turns
 * WebSockets on and comes back does not have to restart the editor.
 */
export const POSITIVE_PROBE_TTL_MS = 5 * 60 * 1000;

/**
 * One cell, resolved against an instance — the shape every view renders from.
 *
 * `declared` and `effective` are separate because they answer different
 * questions. `declared` is what the descriptor says about the *type*; the panel
 * uses it to explain that a cell is conditional at all. `effective` is what the
 * user may do *right now* and is the only thing a disabled state should be
 * computed from.
 */
export interface CapabilityGate {
  /** What the descriptor says about the backend type. */
  declared: CapabilityState;
  /** What this instance can do right now. `conditional` never survives to here. */
  effective: 'supported' | 'unsupported' | 'degraded';
  /** May a node attempt this right now? True for `supported` and `degraded`. */
  isUsable: boolean;
  /**
   * The sentence to put on screen.
   *
   * **Guaranteed present whenever `isUsable` is false, and whenever `effective`
   * is `degraded`.** That guarantee is the task: a disabled port with no reason
   * converts "this backend cannot do that" into "this is broken", and it is
   * pinned by a test over every cell of every descriptor rather than by review.
   */
  reason?: string;
  /** True when `declared === 'conditional'` and no usable probe result is in hand. */
  isUnprobed: boolean;
  /** The probe that would settle it, when there is one still to run. */
  probe?: CapabilityProbe;
}

/** Options for {@link resolveGate}. */
export interface GateOptions {
  /** What a probe has learned about this instance, if anything. */
  probes?: ProbeResults;
  /** Injected clock, so the expiry rule is testable without waiting. */
  now?: number;
  /** Override for {@link POSITIVE_PROBE_TTL_MS}. */
  positiveTtlMs?: number;
}

/**
 * Resolve one capability cell into a {@link CapabilityGate}.
 *
 * The `conditional` rule is the descriptor's own, quoted from this module's
 * header: *"Treating `conditional` as `unsupported` until a probe proves
 * otherwise is what makes the editor's claim safe."* So an unprobed conditional
 * is **not usable**, and it carries the cell's reason — which is written for
 * exactly this reading ("Live updates need WebSockets enabled on your Directus
 * instance. They are off by default.").
 *
 * @param capability the descriptor cell
 * @param key which cell it is, so a probe result can be looked up
 */
export function resolveGate(capability: Capability, key: CapabilityKey, options: GateOptions = {}): CapabilityGate {
  if (capability.state === 'supported') {
    return { declared: 'supported', effective: 'supported', isUsable: true, isUnprobed: false };
  }

  if (capability.state === 'degraded') {
    return {
      declared: 'degraded',
      effective: 'degraded',
      isUsable: true,
      reason: capability.reason,
      isUnprobed: false
    };
  }

  if (capability.state === 'unsupported') {
    return {
      declared: 'unsupported',
      effective: 'unsupported',
      isUsable: false,
      reason: capability.reason,
      isUnprobed: false
    };
  }

  // `conditional`.
  const outcome = usableOutcome(options.probes?.[key], options);

  if (outcome?.verdict === 'supported') {
    return { declared: 'conditional', effective: 'supported', isUsable: true, isUnprobed: false };
  }

  if (outcome?.verdict === 'unsupported') {
    return {
      declared: 'conditional',
      effective: 'unsupported',
      isUsable: false,
      // The probe's own detail leads when there is one — "your instance answered
      // X" is a better sentence than "instances may or may not" once we asked —
      // but the declared reason is always there behind it, so the guarantee that
      // a disabled gate carries a reason never depends on a probe writing prose.
      reason: outcome.detail ? `${capability.reason} (${outcome.detail})` : capability.reason,
      isUnprobed: false,
      probe: capability.probe
    };
  }

  return {
    declared: 'conditional',
    effective: 'unsupported',
    isUsable: false,
    reason: capability.reason,
    isUnprobed: true,
    probe: capability.probe
  };
}

/**
 * A probe outcome, or `undefined` if it may no longer be believed.
 *
 * Only positives expire. See {@link POSITIVE_PROBE_TTL_MS}.
 */
function usableOutcome(outcome: ProbeOutcome | undefined, options: GateOptions): ProbeOutcome | undefined {
  if (!outcome) return undefined;
  if (outcome.verdict === 'unsupported') return outcome;

  const ttl = options.positiveTtlMs ?? POSITIVE_PROBE_TTL_MS;
  const now = options.now ?? Date.now();
  return now - outcome.at <= ttl ? outcome : undefined;
}
