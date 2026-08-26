/**
 * The access-control model, pure form (BAK-003).
 *
 * Everything in this file is IO-free and side-effect-free: the config schema
 * with its strict validator, principal types, CLP rule evaluation, and the JS
 * twin of the SQL ACL predicate. The service wires these to HTTP and SQLite in
 * ./state.ts; BAK-001's realtime delivery imports `canReadRecord` from here so
 * query filtering and event filtering can never drift apart (the twins are
 * property-tested against each other in tests/security-model.test.ts).
 *
 * The normative document is dev-docs/tasks/phase-22-production-backend/
 * BAK-003-SECURITY-MODEL.md — if code and document disagree, the document wins
 * and the code is the bug.
 *
 * @module nodegx-backend/security/model
 */

import type { RateLimitPolicy } from '../ops/model';

// ============================================================================
// Principals
// ============================================================================

export type Principal =
  /**
   * Master key / admin bearer token. Bypasses CLPs and ACLs.
   *
   * `readonly: true` marks the SECOND admin credential tier (BAK-005): the same
   * total read access, zero write access. It is a property of the credential,
   * not of the route — the dispatcher refuses every state-changing request from
   * a read-only admin before any handler runs, so "look, don't touch" cannot be
   * defeated by finding an un-annotated route.
   */
  | { kind: 'admin'; readonly?: boolean }
  /** Named server-to-server credential; power comes only from its scopes. */
  | { kind: 'apiKey'; name: string; scopes: string[] }
  /** Session-token caller. `roles` are resolved names (no 'role:' prefix). */
  | { kind: 'user'; userId: string; roles: string[] }
  | { kind: 'anonymous' };

/**
 * The principal-key set used in ACL matching — the exact strings that may
 * appear as keys of a record's ACL object. Everyone holds '*'.
 */
export function principalKeys(principal: Principal): string[] {
  if (principal.kind === 'user') {
    return ['*', principal.userId, ...principal.roles.map((r) => `role:${r}`)];
  }
  return ['*'];
}

// ============================================================================
// Rule vocabulary
// ============================================================================

export type ClpOp = 'find' | 'get' | 'create' | 'update' | 'delete';
export const CLP_OPS: ClpOp[] = ['find', 'get', 'create', 'update', 'delete'];

/**
 * A single rule: 'public' | 'authenticated' | 'nobody' | 'role:<name>',
 * or an array of those (OR semantics).
 */
export type RuleValue = string | string[];

const RULE_ATOMS = new Set(['public', 'authenticated', 'nobody']);

/** Validate one rule atom. Returns an error message or null. */
function validateRuleAtom(atom: unknown): string | null {
  if (typeof atom !== 'string') return `rule must be a string, got ${typeof atom}`;
  if (RULE_ATOMS.has(atom)) return null;
  if (atom.startsWith('role:')) {
    return atom.length > 'role:'.length ? null : 'role: rule is missing the role name';
  }
  return `unknown rule value "${atom}" (expected public | authenticated | nobody | role:<name>)`;
}

/**
 * Validate a per-function rate limit (CWF-017). Strict in the same way as every
 * other config shape here: an unknown key is an error, because a budget field
 * that is accepted and ignored reads as a limit that is being applied.
 *
 * `burst: 0` or `ratePerMinute: 0` is the limiter's "unlimited" convention, and
 * saying that explicitly per function is a legitimate thing to write — it is
 * still the class bucket that decides.
 */
export function validateFunctionRateLimit(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return 'must be an object { ratePerMinute, burst }';
  }
  const v = value as Record<string, unknown>;
  for (const key of Object.keys(v)) {
    if (key !== 'ratePerMinute' && key !== 'burst') return `unknown key "${key}" (expected ratePerMinute, burst)`;
  }
  for (const field of ['ratePerMinute', 'burst'] as const) {
    const n = v[field];
    if (n === undefined) return `${field} is required`;
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return `${field} must be a number >= 0`;
  }
  return null;
}

/**
 * CWF-016's per-function idempotency block. Strict like the rate-limit one, plus
 * one extra refusal: `enabled: false` with `requireKey` or `hashBody` set is a
 * setting that says two things at once, and a config that accepts it is a config
 * that will one day be read as if the second thing applied.
 */
export function validateFunctionIdempotency(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return 'must be an object { enabled, requireKey?, hashBody? }';
  }
  const v = value as Record<string, unknown>;
  for (const key of Object.keys(v)) {
    if (key !== 'enabled' && key !== 'requireKey' && key !== 'hashBody') {
      return `unknown key "${key}" (expected enabled, requireKey, hashBody)`;
    }
  }
  if (typeof v.enabled !== 'boolean') return 'enabled is required and must be a boolean';
  for (const field of ['requireKey', 'hashBody'] as const) {
    if (v[field] !== undefined && typeof v[field] !== 'boolean') return `${field} must be a boolean`;
  }
  if (v.enabled === false && (v.requireKey === true || v.hashBody === true)) {
    return 'enabled is false, so requireKey/hashBody would never apply — remove them or enable it';
  }
  return null;
}

export function validateRuleValue(value: unknown): string | null {
  if (Array.isArray(value)) {
    if (value.length === 0) return 'empty rule arrays are not allowed (use "nobody")';
    for (const atom of value) {
      const err = validateRuleAtom(atom);
      if (err) return err;
    }
    return null;
  }
  return validateRuleAtom(value);
}

/**
 * Does a rule grant this principal the operation? Admin/system is decided
 * before rules are consulted (bypass); API-key scope checks likewise — this
 * evaluates rules for users and anonymous callers only.
 */
export function ruleAllows(rule: RuleValue, principal: Principal): boolean {
  const atoms = Array.isArray(rule) ? rule : [rule];
  for (const atom of atoms) {
    if (atom === 'public') return true;
    if (atom === 'nobody') continue;
    if (atom === 'authenticated' && principal.kind === 'user') return true;
    if (atom.startsWith('role:') && principal.kind === 'user') {
      if (principal.roles.includes(atom.slice('role:'.length))) return true;
    }
  }
  return false;
}

// ============================================================================
// Security config (security.json)
// ============================================================================

export interface CollectionRules {
  permissions?: Partial<Record<ClpOp, RuleValue>>;
  creatorOwns?: boolean;
}

export interface FunctionRules {
  call?: RuleValue;
  /** 'system' is the only supported value in v1; 'caller' is defined by the
   * model document but its per-run credential seam is not built yet, so it is
   * REJECTED at load (accepted-and-ignored security config is forbidden). */
  runAs?: 'system';
  /**
   * CWF-017: this function's OWN request budget, on top of the shared
   * `functions` class in ops.json.
   *
   * Deliberately additive rather than a replacement. A per-function number can
   * therefore only ever TIGHTEN: declaring one cannot accidentally hand a
   * function a larger allowance than the class an operator tuned, which is the
   * failure mode a "consult this instead" rule has. To make one function more
   * generous than the rest, raise the class.
   *
   * Absent = unchanged behaviour (the class bucket alone). The shape is ops.json's
   * `RateLimitPolicy` by import rather than by restatement, so there is one
   * token-bucket vocabulary and not a twin of it.
   */
  rateLimit?: RateLimitPolicy;
  /**
   * CWF-018: how long this function may run before the request is abandoned,
   * in milliseconds. Absent = the service default
   * (`DEFAULT_FUNCTION_TIMEOUT_MS`); `0` = **no limit at all**.
   *
   * `timeoutMs` rather than a new word, because the workflow definition already
   * spells the same idea that way at two levels (`timeoutMs` per run,
   * `stepTimeoutMs` per step) and a second vocabulary for "how long may this
   * take" is how a panel ends up showing seconds where the engine reads
   * milliseconds.
   *
   * The explicit `0` matters: a streaming response (CWF-007) legitimately holds
   * its connection open, and the honest way to say so is a declaration on the
   * function, not a default loose enough that nothing is ever bounded.
   */
  timeoutMs?: number;
  /**
   * CWF-016: honour `Idempotency-Key` on this function, so the same delivery
   * twice runs the graph once.
   *
   * **A per-function setting rather than a node**, and the reason is decisive:
   * the correct behaviour is *don't run the graph at all*, and a node inside the
   * graph has, by the time it fires, already run everything upstream of it. (A
   * node that dedupes a SECTION of a graph is a different, additional thing —
   * not a replacement for this.)
   *
   * Absent = off, which is what every function does today.
   */
  idempotency?: FunctionIdempotency;
}

/**
 * CWF-016's per-function shape. Three fields because there are three separate
 * questions, and the validator refuses the combinations that mean nothing.
 */
export interface FunctionIdempotency {
  /** Honour the header at all. */
  enabled: boolean;
  /**
   * Refuse a call that arrives WITHOUT a key (400), instead of running it
   * unprotected.
   *
   * Off by default because a function is usually reached by more than its
   * webhook — the app calls it too, and those calls have no key and no reason to
   * have one. On is for the function whose only caller is a provider, where an
   * unkeyed delivery is a misconfiguration you want to hear about rather than a
   * duplicate you find out about later.
   */
  requireKey?: boolean;
  /**
   * Fold a hash of the request body into the identity, so the same key with a
   * different body is a different request.
   *
   * **Off by default, deliberately.** A body hash makes a provider retry whose
   * payload carries a changed timestamp look like a brand-new request — which is
   * the failure people actually hit, and it defeats the whole feature silently.
   * Turn it on when the caller reuses keys carelessly and you would rather run
   * twice than answer the wrong body.
   *
   * ⚠️ The hash is over the re-serialised JSON, so two bodies that differ only
   * in key ORDER hash differently. Every implementation of this has that limit;
   * it is stated rather than hidden.
   */
  hashBody?: boolean;
}

export interface FileRules {
  upload: RuleValue;
  read: RuleValue;
  delete: RuleValue;
}

export interface SecurityConfig {
  version: 1;
  /**
   * Relax the DATA and function gates while bound to loopback — hitting your own
   * collections without a token, which is the whole point of it. Physically
   * cannot deploy: a non-loopback bind with devOpen refuses to start (state.ts
   * interlock).
   *
   * ⚠️ It used to relax every gate INCLUDING admin, and FH-024 is what that
   * cost: with CORS defaulting to `*`, any web page open on the developer's
   * machine could read and write this backend's admin API over 127.0.0.1.
   * Loopback is not a boundary against a browser.
   */
  devOpen: boolean;
  defaults: { permissions: Record<ClpOp, RuleValue>; creatorOwns: boolean };
  collections: Record<string, CollectionRules>;
  functions: Record<string, FunctionRules>;
  files: FileRules;
  signup: RuleValue;
}

/** The default posture: authenticated CRUD, creator-owns, dev-open. */
export function defaultSecurityConfig(): SecurityConfig {
  return {
    version: 1,
    devOpen: true,
    defaults: {
      permissions: {
        find: 'authenticated',
        get: 'authenticated',
        create: 'authenticated',
        update: 'authenticated',
        delete: 'authenticated'
      },
      creatorOwns: true
    },
    collections: {},
    functions: {},
    files: { upload: 'authenticated', read: 'public', delete: 'nobody' },
    signup: 'public'
  };
}

/**
 * Strict validation: unknown keys anywhere are errors, not warnings — a typo'd
 * security rule that silently no-ops is a breach with a delay timer. Returns
 * a list of error strings; empty = valid.
 */
export function validateSecurityConfig(raw: unknown): string[] {
  const errors: string[] = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return ['security config must be a JSON object'];
  }
  const cfg = raw as Record<string, unknown>;

  const TOP_KEYS = new Set(['version', 'devOpen', 'defaults', 'collections', 'functions', 'files', 'signup']);
  for (const key of Object.keys(cfg)) {
    if (!TOP_KEYS.has(key)) errors.push(`unknown top-level key "${key}"`);
  }

  if (cfg.version !== 1) errors.push(`unsupported version ${JSON.stringify(cfg.version)} (expected 1)`);
  if (typeof cfg.devOpen !== 'boolean') errors.push('devOpen must be a boolean');

  // defaults
  const defaults = cfg.defaults as Record<string, unknown> | undefined;
  if (!defaults || typeof defaults !== 'object') {
    errors.push('defaults must be an object');
  } else {
    for (const key of Object.keys(defaults)) {
      if (key !== 'permissions' && key !== 'creatorOwns') errors.push(`unknown defaults key "${key}"`);
    }
    const perms = defaults.permissions as Record<string, unknown> | undefined;
    if (!perms || typeof perms !== 'object') {
      errors.push('defaults.permissions must be an object');
    } else {
      for (const op of CLP_OPS) {
        if (perms[op] === undefined) {
          errors.push(`defaults.permissions.${op} is required`);
        } else {
          const err = validateRuleValue(perms[op]);
          if (err) errors.push(`defaults.permissions.${op}: ${err}`);
        }
      }
      for (const key of Object.keys(perms)) {
        if (!CLP_OPS.includes(key as ClpOp)) errors.push(`unknown operation "${key}" in defaults.permissions`);
      }
    }
    if (typeof defaults.creatorOwns !== 'boolean') errors.push('defaults.creatorOwns must be a boolean');
  }

  // collections
  const collections = cfg.collections as Record<string, unknown> | undefined;
  if (!collections || typeof collections !== 'object') {
    errors.push('collections must be an object');
  } else {
    for (const [name, entry] of Object.entries(collections)) {
      if (name.startsWith('_')) {
        errors.push(`collections.${name}: system collections have a fixed posture and cannot carry CLP entries`);
        continue;
      }
      if (!entry || typeof entry !== 'object') {
        errors.push(`collections.${name} must be an object`);
        continue;
      }
      const e = entry as Record<string, unknown>;
      for (const key of Object.keys(e)) {
        if (key !== 'permissions' && key !== 'creatorOwns') errors.push(`unknown key "${key}" in collections.${name}`);
      }
      if (e.permissions !== undefined) {
        if (!e.permissions || typeof e.permissions !== 'object') {
          errors.push(`collections.${name}.permissions must be an object`);
        } else {
          for (const [op, rule] of Object.entries(e.permissions as Record<string, unknown>)) {
            if (!CLP_OPS.includes(op as ClpOp)) {
              errors.push(`unknown operation "${op}" in collections.${name}.permissions`);
            } else {
              const err = validateRuleValue(rule);
              if (err) errors.push(`collections.${name}.permissions.${op}: ${err}`);
            }
          }
        }
      }
      if (e.creatorOwns !== undefined && typeof e.creatorOwns !== 'boolean') {
        errors.push(`collections.${name}.creatorOwns must be a boolean`);
      }
    }
  }

  // functions
  const functions = cfg.functions as Record<string, unknown> | undefined;
  if (!functions || typeof functions !== 'object') {
    errors.push('functions must be an object');
  } else {
    for (const [name, entry] of Object.entries(functions)) {
      if (!entry || typeof entry !== 'object') {
        errors.push(`functions.${name} must be an object`);
        continue;
      }
      const e = entry as Record<string, unknown>;
      for (const key of Object.keys(e)) {
        if (
          key !== 'call' &&
          key !== 'runAs' &&
          key !== 'rateLimit' &&
          key !== 'timeoutMs' &&
          key !== 'idempotency'
        ) {
          errors.push(`unknown key "${key}" in functions.${name}`);
        }
      }
      if (e.call !== undefined) {
        const err = validateRuleValue(e.call);
        if (err) errors.push(`functions.${name}.call: ${err}`);
      }
      if (e.rateLimit !== undefined) {
        const err = validateFunctionRateLimit(e.rateLimit);
        if (err) errors.push(`functions.${name}.rateLimit: ${err}`);
      }
      if (
        e.timeoutMs !== undefined &&
        (typeof e.timeoutMs !== 'number' || !Number.isFinite(e.timeoutMs) || e.timeoutMs < 0)
      ) {
        errors.push(`functions.${name}.timeoutMs must be a number >= 0 (0 = no limit)`);
      }
      if (e.idempotency !== undefined) {
        const err = validateFunctionIdempotency(e.idempotency);
        if (err) errors.push(`functions.${name}.idempotency: ${err}`);
      }
      if (e.runAs !== undefined && e.runAs !== 'system') {
        errors.push(
          e.runAs === 'caller'
            ? `functions.${name}.runAs: "caller" is defined by the model but not yet supported by this build — ` +
              `refusing to accept a security setting that would not be enforced`
            : `functions.${name}.runAs: unknown value ${JSON.stringify(e.runAs)}`
        );
      }
    }
  }

  // files
  const files = cfg.files as Record<string, unknown> | undefined;
  if (!files || typeof files !== 'object') {
    errors.push('files must be an object');
  } else {
    for (const key of Object.keys(files)) {
      if (key !== 'upload' && key !== 'read' && key !== 'delete') errors.push(`unknown key "${key}" in files`);
    }
    for (const op of ['upload', 'read', 'delete'] as const) {
      if (files[op] === undefined) {
        errors.push(`files.${op} is required`);
      } else {
        const err = validateRuleValue(files[op]);
        if (err) errors.push(`files.${op}: ${err}`);
      }
    }
  }

  // signup
  if (cfg.signup === undefined) {
    errors.push('signup is required');
  } else {
    const err = validateRuleValue(cfg.signup);
    if (err) errors.push(`signup: ${err}`);
  }

  return errors;
}

// ============================================================================
// CLP resolution
// ============================================================================

/** System collections are never reachable through the data routes. */
export function isSystemCollection(collection: string): boolean {
  return collection.startsWith('_');
}

/**
 * The effective rule for an operation on a collection: the collection's own
 * entry per key it names, falling through to defaults. System collections have
 * a fixed 'nobody' posture regardless of config.
 */
export function effectiveRule(config: SecurityConfig, collection: string, op: ClpOp): RuleValue {
  if (isSystemCollection(collection)) return 'nobody';
  const entry = config.collections[collection];
  const rule = entry && entry.permissions && entry.permissions[op];
  return rule !== undefined ? rule : config.defaults.permissions[op];
}

export function effectiveCreatorOwns(config: SecurityConfig, collection: string): boolean {
  if (isSystemCollection(collection)) return false;
  const entry = config.collections[collection];
  return entry && entry.creatorOwns !== undefined ? entry.creatorOwns : config.defaults.creatorOwns;
}

export interface AccessDecision {
  allowed: boolean;
  /** The rule that decided, for check/debug surfaces. */
  rule: RuleValue;
  reason: string;
}

/** API-key scope check for data operations. */
function keyAllowsData(scopes: string[], op: ClpOp): boolean {
  const needs = op === 'find' || op === 'get' ? 'read' : 'write';
  return scopes.includes('classes:*') || scopes.includes(`classes:${needs}`);
}

/** API-key scope check for function calls. */
export function keyAllowsFunction(scopes: string[], functionName: string): boolean {
  return scopes.includes('functions:*') || scopes.includes(`functions:${functionName}`);
}

/**
 * Validate an API-key scope list. The vocabulary is deliberately coarse in v1
 * (model doc §6); strings are namespaced so finer grains can arrive without
 * breaking these. Returns an error message or null.
 */
export function validateScopes(scopes: unknown): string | null {
  if (!Array.isArray(scopes) || scopes.length === 0) return 'scopes must be a non-empty array of strings';
  for (const scope of scopes) {
    if (typeof scope !== 'string') return 'scopes must be strings';
    const ok =
      scope === 'classes:*' ||
      scope === 'classes:read' ||
      scope === 'classes:write' ||
      scope === 'functions:*' ||
      (scope.startsWith('functions:') && scope.length > 'functions:'.length);
    if (!ok) {
      return `unknown scope "${scope}" (expected classes:read | classes:write | classes:* | functions:<name> | functions:*)`;
    }
  }
  return null;
}

/**
 * Collection-level decision (evaluation-order step 3 for data routes).
 * Row-level ACLs are a separate, subsequent concern.
 */
export function checkClp(config: SecurityConfig, principal: Principal, collection: string, op: ClpOp): AccessDecision {
  const rule = effectiveRule(config, collection, op);
  if (principal.kind === 'admin') {
    return { allowed: true, rule, reason: 'admin credential bypasses collection permissions' };
  }
  if (principal.kind === 'apiKey') {
    return keyAllowsData(principal.scopes, op)
      ? { allowed: true, rule, reason: `API key scope covers classes ${op}` }
      : { allowed: false, rule, reason: `API key "${principal.name}" has no scope covering classes ${op}` };
  }
  return ruleAllows(rule, principal)
    ? { allowed: true, rule, reason: `rule ${JSON.stringify(rule)} grants ${op} to ${principal.kind}` }
    : { allowed: false, rule, reason: `rule ${JSON.stringify(rule)} denies ${op} to ${principal.kind}` };
}

// ============================================================================
// Function access (CWF-017)
// ============================================================================

/** Where a function's effective `call` rule came from. */
export type FunctionRuleSource =
  /** `security.json` names this function: the config rule wins. */
  | 'configured'
  /** Nothing is configured, so the graph's Request node decides. */
  | 'graph';

export interface FunctionRuleResolution {
  rule: RuleValue;
  source: FunctionRuleSource;
  /** The Request node's `Allow Unauthenticated` port, as the graph declares it. */
  allowNoAuth: boolean;
}

/**
 * The effective `call` rule for a function — THE resolver, called by the
 * dispatcher's gate, by the admin dry run, and by the panel's read.
 *
 * It exists because those three had the same six lines written out three times,
 * and a permission model with three copies of its own fallback is a model that
 * will eventually show an operator one answer while enforcing another. CWF-017's
 * whole premise is a panel that shows the EFFECTIVE rule, which is only worth
 * anything if the panel and the gate compute it with the same function.
 *
 * The precedence, stated once: **a config entry wins; otherwise the graph's
 * `Allow Unauthenticated` decides** (ticked = `public`, unticked = `authenticated`).
 * That is the behaviour this build already had; naming it changes nothing about
 * what an undeclared function does.
 */
export function effectiveFunctionRule(
  config: SecurityConfig,
  functionName: string,
  allowNoAuth: boolean
): FunctionRuleResolution {
  const configured = config.functions[functionName];
  if (configured && configured.call !== undefined) {
    return { rule: configured.call, source: 'configured', allowNoAuth };
  }
  return { rule: allowNoAuth ? 'public' : 'authenticated', source: 'graph', allowNoAuth };
}

// ----------------------------------------------------------------------------
// SB-016 — the endpoints nobody declared
// ----------------------------------------------------------------------------

/** One deployed endpoint, as far as this module needs to know about it. */
export interface DeployedFunction {
  name: string;
  /** The graph's `Allow Unauthenticated` port. */
  allowNoAuth: boolean;
}

/** An endpoint whose rule comes from the graph port because no config entry names it. */
export interface UnresolvedFunction extends DeployedFunction {
  /** What the graph port resolves to, and therefore what a deploy would enforce. */
  rule: RuleValue;
}

/**
 * SB-016 — every deployed endpoint whose `call` rule resolves **only** from the
 * graph's `Allow Unauthenticated` port.
 *
 * ## Why this predicate and not the narrower one
 *
 * SB-016 §4 left the predicate open between this — *resolves from the graph
 * port at all* — and a narrower *resolves to `authenticated` from the port*,
 * on the strength of a claim that the narrow one "refuses exactly the two that
 * are wrong" on the Site Builder template. 🔴 **Measured, it does not.** Site
 * Builder's four endpoints are `submitContactForm` (ticked → `public`, wanted
 * `public`), `claimSite` (unticked → `authenticated`, wanted `authenticated`),
 * and `publishPage`/`duplicatePage` (unticked → `authenticated`, wanted
 * `role:admin`). The narrow predicate refuses **three** of the four — the two
 * that are wrong *and* `claimSite`, which is right. No deploy-time predicate can
 * separate them, because the thing that distinguishes `claimSite` from
 * `publishPage` is an intention neither the port nor the config records.
 *
 * With discrimination off the table, the choice is between *declare every
 * endpoint* and *declare every endpoint except the ones open to the world*, and
 * that is not close. Ticking `Allow Unauthenticated` is an affirmative act, but
 * it is an act performed on a canvas, possibly by somebody else, possibly a year
 * ago — and its consequence is the only endpoints an anonymous stranger can
 * reach at all. An interlock that waves those through is silent about precisely
 * the surface it exists to protect.
 *
 * So the refusal does not say *this is wrong*. It says **you have not said**,
 * and after it is satisfied `security.json` describes every endpoint the backend
 * serves — which is the property the panel, the audit trail and the next
 * deployer all read it for.
 *
 * ⚠️ A configured entry for a function that is NOT deployed is drift in the
 * other direction, and is deliberately not this function's business: it grants
 * nothing, `GET /admin/permissions/functions` already reports it, and refusing a
 * deploy over a stale rule would punish the safe half of the same mistake.
 */
export function unresolvedFunctionRules(
  config: SecurityConfig,
  deployed: DeployedFunction[]
): UnresolvedFunction[] {
  const unresolved: UnresolvedFunction[] = [];
  for (const fn of deployed) {
    const resolved = effectiveFunctionRule(config, fn.name, fn.allowNoAuth);
    if (resolved.source !== 'graph') continue;
    unresolved.push({ name: fn.name, allowNoAuth: fn.allowNoAuth, rule: resolved.rule });
  }
  return unresolved.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The `functions` block that makes the endpoints above resolved, written out so
 * it can be pasted into `security.json` unmodified.
 *
 * 🔴 **Every rule is the one the backend is enforcing right now**, so pasting it
 * and restarting changes nothing about who can call what. That is the point: the
 * refusal is asking for a *decision to be recorded*, not for behaviour to change,
 * and a deployer under time pressure needs the zero-risk answer to be the one in
 * front of them. Tightening `publishPage` to `role:admin` is the next thing they
 * should do and the message says so, but it is a second step they take with their
 * eyes open rather than a change this refusal smuggles in.
 *
 * ⚠️ It is emitted **merged with whatever `functions` entries already exist**,
 * because a deployer with three declared endpoints and one undeclared one who
 * pastes a one-key block over the top has just undeclared the other three.
 */
export function proposedFunctionsBlock(config: SecurityConfig, unresolved: UnresolvedFunction[]): string {
  const merged: Record<string, unknown> = JSON.parse(JSON.stringify(config.functions || {}));
  for (const fn of unresolved) {
    const existing = (merged[fn.name] as Record<string, unknown> | undefined) || {};
    merged[fn.name] = { ...existing, call: fn.rule };
  }
  const ordered: Record<string, unknown> = {};
  for (const key of Object.keys(merged).sort()) ordered[key] = merged[key];
  return JSON.stringify({ functions: ordered }, null, 2);
}

export interface FunctionAccessDecision extends AccessDecision {
  source: FunctionRuleSource | 'credential';
}

/**
 * Can this principal call this function? Mirrors `checkClp`'s shape: admin
 * bypasses, an API key answers from its scopes, everyone else meets the
 * effective rule.
 */
export function checkFunctionCall(
  config: SecurityConfig,
  principal: Principal,
  functionName: string,
  allowNoAuth: boolean
): FunctionAccessDecision {
  const resolved = effectiveFunctionRule(config, functionName, allowNoAuth);
  if (principal.kind === 'admin') {
    return { allowed: true, rule: resolved.rule, reason: 'admin credential bypasses function rules', source: 'credential' };
  }
  if (principal.kind === 'apiKey') {
    const allowed = keyAllowsFunction(principal.scopes, functionName);
    return {
      allowed,
      rule: resolved.rule,
      reason: allowed
        ? `API key "${principal.name}" has a scope covering "${functionName}"`
        : `API key "${principal.name}" has no scope covering "${functionName}"`,
      source: 'credential'
    };
  }
  const allowed = ruleAllows(resolved.rule, principal);
  return {
    allowed,
    rule: resolved.rule,
    reason: `rule ${JSON.stringify(resolved.rule)} ${allowed ? 'grants' : 'denies'} calling "${functionName}" to ${principal.kind}` +
      (resolved.source === 'graph' ? " (from the graph's Allow Unauthenticated port)" : ''),
    source: resolved.source
  };
}

/**
 * This function's own rate-limit budget, or undefined when it only meets the
 * shared `functions` class. A zeroed policy is normalised to undefined: the
 * limiter reads `burst <= 0` as unlimited, so keeping it would mean carrying a
 * bucket that can never refuse.
 */
export function functionRateLimit(config: SecurityConfig, functionName: string): RateLimitPolicy | undefined {
  const entry = config.functions[functionName];
  const policy = entry && entry.rateLimit;
  if (!policy || policy.burst <= 0 || policy.ratePerMinute <= 0) return undefined;
  return policy;
}

/**
 * This function's DECLARED execution timeout, or undefined when it has none and
 * the service default applies (CWF-018).
 *
 * Deliberately not resolved to a number here: `undefined` ("nobody said") and
 * `0` ("explicitly unbounded") are different answers, and collapsing them would
 * make an opted-out streaming function indistinguishable from an ordinary one.
 * The default itself lives with the thing that enforces it — `WorkflowRunner` —
 * so there is exactly one number to change.
 */
export function functionTimeoutMs(config: SecurityConfig, functionName: string): number | undefined {
  const entry = config.functions[functionName];
  return entry && typeof entry.timeoutMs === 'number' ? entry.timeoutMs : undefined;
}

/**
 * This function's idempotency setting, or undefined when it has none (CWF-016).
 *
 * A block with `enabled: false` normalises to undefined for the same reason
 * `functionRateLimit` normalises a zeroed policy: the dispatcher should have one
 * question to ask ("is there a policy?") rather than two.
 */
export function functionIdempotency(
  config: SecurityConfig,
  functionName: string
): FunctionIdempotency | undefined {
  const entry = config.functions[functionName];
  const policy = entry && entry.idempotency;
  if (!policy || !policy.enabled) return undefined;
  return policy;
}

// ============================================================================
// Row-level ACL — the JS twin of QueryBuilder.buildAclPredicate
// ============================================================================

export interface AclEntry {
  read?: boolean;
  write?: boolean;
}

/**
 * Can this principal read/write this record? Mirrors the SQL predicate
 * exactly: NULL/absent ACL = public; otherwise any principal key with the
 * access flag true. Admin bypasses. API keys follow their data scopes.
 *
 * This is the function BAK-001's realtime delivery must call per event per
 * subscriber; it is property-tested against the SQL form so they cannot drift.
 */
export function canAccessRecord(
  principal: Principal,
  record: { ACL?: unknown } | null | undefined,
  access: 'read' | 'write'
): boolean {
  if (principal.kind === 'admin') return true;
  if (principal.kind === 'apiKey') {
    return keyAllowsData(principal.scopes, access === 'read' ? 'find' : 'update');
  }
  const acl = record ? (record.ACL as Record<string, AclEntry> | null | undefined) : null;
  if (acl === null || acl === undefined) return true;
  if (typeof acl !== 'object') return true; // unparsable ACL: treat as absent (matches SQL json_each on non-JSON)
  const keys = principalKeys(principal);
  for (const key of keys) {
    const entry = acl[key];
    if (entry && entry[access] === true) return true;
  }
  return false;
}

export function canReadRecord(principal: Principal, record: { ACL?: unknown } | null | undefined): boolean {
  return canAccessRecord(principal, record, 'read');
}

// ============================================================================
// ACL body validation (client-supplied ACLs on create/save)
// ============================================================================

/**
 * Validate a client-supplied ACL object (Parse shape). Returns an error
 * message or null. Accepts only { key: { read?: bool, write?: bool } }.
 */
export function validateAclShape(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object' || Array.isArray(value)) return 'ACL must be an object';
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!key) return 'ACL keys must be non-empty strings';
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return `ACL entry for "${key}" must be an object`;
    }
    for (const [flag, flagValue] of Object.entries(entry as Record<string, unknown>)) {
      if (flag !== 'read' && flag !== 'write') return `ACL entry for "${key}" has unknown flag "${flag}"`;
      if (typeof flagValue !== 'boolean') return `ACL flag ${key}.${flag} must be a boolean`;
    }
  }
  return null;
}
