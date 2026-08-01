/**
 * `RestAuthAdapter` — auth for the REST family, and the first `performRefresh`
 * this product has ever had.
 *
 * BCN-006 step 4. Until this file existed, `TokenLifecycleController` was
 * complete, tested and **inert**: it takes exactly one function from an adapter,
 * `performRefresh`, and no adapter supplied one. Parse's tokens never expire, so
 * the machinery had never refreshed anything. That is why the phase's exit
 * criterion 4 — *"a logged-in user stays logged in across an access-token expiry,
 * on every backend that has one"* — could not be claimed, and it is what this
 * file is for.
 *
 * ## Everything here was measured, except where it says otherwise
 *
 * The wires below were probed against the live rig on 2026-07-31 (Directus 11 on
 * `:8055`, PocketBase 0.30.0 on `:8091`) and the findings are written up in
 * `BCN-006-NOTES.md` §8. That ordering is the phase's rule rather than diligence
 * for its own sake: BCN-002 found all three of Parse's carefully-documented file
 * cells wrong, BCN-003 found four descriptor cells a real server contradicted,
 * and BCN-004 found the presets carrying a known-wrong total.
 *
 * It paid again here. Four things a documentation-first implementation would have
 * got wrong, each of which produces a *silent* failure:
 *
 * 1. **Directus's `expires` is milliseconds of remaining lifetime**, not an
 *    absolute time and not seconds. `AuthSession.expiresAt` documents it as the
 *    backend "stating an expiry"; storing `900000` as `expiresAt` puts the
 *    deadline in January 1970 and refreshes forever.
 * 2. **PocketBase has no refresh token at all.** Its refresh presents the
 *    *access* token. The controller refused to refresh without a `refreshToken`
 *    and would have signed every PocketBase user out at the first scheduled
 *    refresh — see {@link TokenLifecycleControllerOptions.refreshTokenRequired}.
 * 3. **A PocketBase sign-up returns no token**, so `signUp` is two requests, and
 *    the record it does return omits `email` (the collection ships with
 *    `emailVisibility: false`). That is the same defect class as the Parse
 *    `Current.email` one this task fixes.
 * 4. **Directus rotates its refresh token and rejects a replay with 401.**
 *    Measured by using one twice. Single-flight is therefore correctness here and
 *    not an optimisation, exactly as the design doc argued from first principles.
 *
 * ## Supabase is gated, not implemented
 *
 * ⚠️ There is **no Supabase auth service in the rig** — the "Supabase" containers
 * are one Postgres and one PostgREST, and GoTrue (which serves `/auth/v1/*`) is a
 * separate service. Every `/auth/v1/*` path answers **404** there, measured.
 *
 * So Supabase auth is refused with a sentence rather than written from
 * documentation. This is the phase's own law and it is also what BCN-006's
 * success criterion 1 asks for: *"All eleven user nodes work against all five
 * backends, **or are gated with a stated reason**."* An unprobed GoTrue
 * implementation would be the fourth time this phase shipped a documented cell a
 * real server contradicted, and it would do it in the one subsystem where being
 * wrong locks a user out of their own app.
 *
 * @module api/backends/RestAuthAdapter
 */

import type {
  AuthSession,
  AuthUser,
  BackendHandle,
  Capability,
  CapabilityKey,
  FetchCurrentUserOptions,
  IAuthAdapter,
  LogInOptions,
  LogOutOptions,
  RequestMagicLinkOptions,
  RequestPasswordResetOptions,
  ResetPasswordOptions,
  SendEmailVerificationOptions,
  SignInWithProviderOptions,
  SignUpOptions,
  TokenLifecycle,
  VerifyEmailOptions
} from '@noodl/backend-contract';
import { descriptorFor } from '@noodl/backend-contract';

import { AuthEvents } from './AuthEvents';
import type { OAuthReturnState } from './ParseAuthAdapter';
import { SessionStore } from './SessionStore';
import { TokenLifecycleController } from './TokenLifecycle';

export type { OAuthReturnState };

/** The subset of `fetch` this adapter uses. Injected so the suite needs no server. */
export type AuthFetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string }
) => Promise<{
  status: number;
  text(): Promise<string>;
}>;

/** The three REST backends. Supabase is here to be *refused* with a reason. */
export type RestAuthBackendType = 'directus' | 'supabase' | 'pocketbase';

/**
 * One backend's auth surface, as observed.
 *
 * Paths only — the request and response *shapes* are three genuinely different
 * things and live in the `switch` blocks below, the way `RestDataAdapter` keeps
 * its per-type query building. A table wide enough to express "the body is
 * `{identity, password}` unless it is `{email, password}`, and the token is at
 * `data.access_token` unless it is at `token`, and there may not be a refresh
 * token" is a description of three specific servers with extra steps.
 */
export interface RestAuthProfile {
  readonly type: RestAuthBackendType;
  readonly login: string;
  readonly logout?: string;
  readonly signUp?: string;
  readonly me: string;
  readonly refresh?: string;
  readonly requestPasswordReset?: string;
  readonly resetPassword?: string;
  readonly sendEmailVerification?: string;
  readonly verifyEmail?: string;
  readonly magicLink?: string;
  /**
   * **Discovery** — which sign-in methods this instance offers, right now.
   *
   * Step 5's central design decision lives on this one field. See
   * {@link RestAuthAdapter.signInWithProvider}: the provider list is fetched
   * *before* the browser is sent anywhere, because on both of these backends a
   * provider that is not configured is not a redirect that fails politely —
   * Directus answers `GET /auth/login/google` with a **404 `ROUTE_NOT_FOUND`**
   * (measured), and PocketBase answers the exchange with a **403 "The collection
   * is not configured to allow OAuth2 authentication."** (measured). Discovery
   * turns both into a sentence on the node's `error` port instead of a dead end.
   */
  readonly authMethods?: string;
  /**
   * OAuth start, `{provider}` substituted.
   *
   * Absent for PocketBase, and the absence is a wire fact rather than an
   * omission: PocketBase does not *have* a start URL of its own. Its
   * `auth-methods` response hands the client a per-attempt `authURL` pointing at
   * the **provider**, already carrying the PKCE challenge and the state, and
   * ending in a bare `redirect_uri=` for the client to complete. Measured.
   */
  readonly oauthStart?: string;
  /** Where a provider's `code` is exchanged for a session. PocketBase only. */
  readonly oauthExchange?: string;
  /** The primary key, before it is normalised to `objectId`. */
  readonly idField: string;
  /**
   * Does a refresh need a **separate** refresh token?
   *
   * False for PocketBase, which presents the access token. Measured: a
   * `POST …/auth-refresh` with only `Authorization: Bearer <access>` answers 200
   * and a new token.
   */
  readonly refreshNeedsRefreshToken: boolean;
}

/**
 * `{collection}` in a PocketBase path.
 *
 * PocketBase has no fixed users table — any collection of `type: "auth"` can
 * hold accounts, and a project may have several. `users` is the one every
 * PocketBase ships with (`_pb_users_auth_`, measured present in the rig) and is
 * the only sane default; a project that renamed it passes
 * {@link RestAuthAdapterOptions.userCollection}.
 */
export const DEFAULT_POCKETBASE_USER_COLLECTION = 'users';

const DIRECTUS_PROFILE: RestAuthProfile = {
  type: 'directus',
  login: '/auth/login',
  logout: '/auth/logout',
  // 403 FORBIDDEN unless public registration is on — measured, and exactly what
  // the descriptor's `conditional` probe for `auth.signUp` predicts.
  signUp: '/users/register',
  me: '/users/me',
  refresh: '/auth/refresh',
  requestPasswordReset: '/auth/password/request',
  resetPassword: '/auth/password/reset',
  // ⚠️ Directus exposes no client-callable "send me a verification email": the
  // one it has fires during public registration, server-side. Left absent so the
  // method below refuses with a sentence rather than posting to a 404.
  verifyEmail: '/users/register/verify-email',
  authMethods: '/auth',
  oauthStart: '/auth/login/{provider}',
  idField: 'id',
  refreshNeedsRefreshToken: true
};

const POCKETBASE_PROFILE: RestAuthProfile = {
  type: 'pocketbase',
  login: '/api/collections/{collection}/auth-with-password',
  // No logout endpoint: PocketBase sessions are the JWT, and signing out is
  // dropping it. Absent rather than pointed at something that would 404.
  signUp: '/api/collections/{collection}/records',
  // ⚠️ `auth-refresh` IS "who am I" on PocketBase — it answers `{record, token}`
  // for the bearer it was given. There is no `/me`.
  me: '/api/collections/{collection}/auth-refresh',
  refresh: '/api/collections/{collection}/auth-refresh',
  requestPasswordReset: '/api/collections/{collection}/request-password-reset',
  resetPassword: '/api/collections/{collection}/confirm-password-reset',
  sendEmailVerification: '/api/collections/{collection}/request-verification',
  verifyEmail: '/api/collections/{collection}/confirm-verification',
  authMethods: '/api/collections/{collection}/auth-methods',
  // No `oauthStart`. See {@link RestAuthProfile.oauthStart} — PocketBase's start
  // URL is minted per attempt by `auth-methods` and points at the provider, not
  // at PocketBase.
  oauthExchange: '/api/collections/{collection}/auth-with-oauth2',
  idField: 'id',
  refreshNeedsRefreshToken: false
};

/**
 * Supabase has **no profile**, and the absence is the point.
 *
 * `restAuthProfileFor` answering `undefined` is what routes every Supabase auth
 * call into {@link RestAuthAdapter.refuse} with the sentence a builder reads. A
 * profile written from GoTrue's documentation would look like support.
 */
const PROFILES: Readonly<Record<string, RestAuthProfile | undefined>> = Object.freeze({
  directus: DIRECTUS_PROFILE,
  pocketbase: POCKETBASE_PROFILE
});

export function restAuthProfileFor(type: string): RestAuthProfile | undefined {
  return PROFILES[type];
}

/**
 * The fields on a REST user record that the **server** owns.
 *
 * Exported because two places have to agree about it and disagreeing is a silent
 * failure in the direction builders hate most: {@link RestAuthAdapter.setUserProperties}
 * strips them from the body it sends, and `user-ports.ts` refuses to *offer* an
 * input port for any of them. Before this list was shared, the second half did
 * not exist — so a `Set User Properties` node on PocketBase offered a `verified`
 * port that looked like every other port, accepted a value, and threw it away.
 *
 * "Server-owned" here means one of three things, all of which end the same way:
 * the backend rejects the write (`id`), the backend ignores it (`created`), or
 * the *client* must not be the thing that decides it (`verified`,
 * `emailVerified`).
 */
export const REST_USER_READONLY_FIELDS: readonly string[] = Object.freeze([
  'objectId',
  'id',
  'emailVerified',
  'verified',
  'createdAt',
  'updatedAt',
  'created',
  'updated',
  'collectionId',
  'collectionName',
  'expand',
  'password',
  'passwordConfirm',
  'tokenKey',
  'sessionToken',
  'refreshToken',
  'expiresAt'
]);

/**
 * Why Supabase is refused. One sentence, and it names what is missing rather
 * than apologising.
 */
export const SUPABASE_AUTH_UNSUPPORTED =
  'NodeGX cannot sign users in to Supabase yet. Supabase authentication is served by a separate ' +
  'service (GoTrue) that has never been tested against, so it is switched off rather than shipped ' +
  'untested. Supabase data nodes work normally.';

// ── OAuth types and readers — step 5 ────────────────────────────────────────

/**
 * A provider sign-in that has left the page and not come back yet.
 *
 * Written to storage before the navigation and read on the next page load. Small
 * on purpose: everything in it is needed to *finish* the exchange, and nothing in
 * it is a credential — `codeVerifier` is a one-attempt PKCE secret that is
 * worthless without the code, and the code arrives in the URL.
 */
export interface PendingOAuthFlow {
  provider: string;
  codeVerifier?: string;
  state?: string;
  redirectURL: string;
  startedAt: number;
}

/**
 * One provider, as PocketBase's `auth-methods` describes it.
 *
 * ⚠️ Note what is **per attempt** rather than per provider: `state`,
 * `codeVerifier`, `codeChallenge` and the `authURL` that carries the challenge
 * are all minted freshly by every call to `auth-methods`. Caching this object and
 * reusing it for a second sign-in produces a code the exchange rejects.
 */
export interface PocketbaseProviderEntry {
  name?: string;
  displayName?: string;
  state?: string;
  authURL?: string;
  /** The 0.22-era spelling, still present in 0.30 alongside `authURL`. Measured. */
  authUrl?: string;
  codeVerifier?: string;
  codeChallenge?: string;
}

export interface AuthProviderEntry {
  id: string;
  displayName: string;
  /** PocketBase only — the per-attempt start URL, PKCE verifier and state. */
  raw?: PocketbaseProviderEntry;
}

/** What a backend says it offers, in the shape `Sign In With` renders buttons from. */
export interface AuthMethods {
  providers: AuthProviderEntry[];
  /**
   * A **link** that signs you in by being clicked.
   *
   * False for both REST backends, and PocketBase's `otp` is deliberately not
   * folded into it: an emailed one-time *password* is a second field for the user
   * to type, not a link, and a `Request Magic Link` node that reported success
   * for it would send a user looking for a link that is not coming.
   */
  magicLink: { enabled: boolean };
  /** PocketBase's emailed one-time password, reported separately for that reason. */
  otp?: { enabled: boolean };
}

/**
 * `auth-methods` / `GET /auth`, normalised.
 *
 * PocketBase's half is measured. ⚠️ **Directus's half is not** — `GET /auth`
 * answers `{"data":[]}` on the rig and no SSO provider could be configured
 * without restarting a shared container, so both spellings Directus has shipped
 * are accepted and neither has been seen populated.
 */
export function readAuthMethods(profile: RestAuthProfile, body: unknown): AuthMethods {
  const envelope = (body || {}) as Record<string, unknown>;

  if (profile.type === 'pocketbase') {
    const oauth2 = (envelope.oauth2 || {}) as { enabled?: boolean; providers?: PocketbaseProviderEntry[] };
    const otp = (envelope.otp || {}) as { enabled?: boolean };
    const providers = oauth2.enabled === true && Array.isArray(oauth2.providers) ? oauth2.providers : [];

    return {
      providers: providers
        .filter((entry) => entry && typeof entry.name === 'string')
        .map((entry) => ({
          id: entry.name as string,
          displayName: entry.displayName || (entry.name as string),
          // `authUrl` is the older spelling and the rig sends both. Preferring
          // `authURL` and falling back costs one `||`.
          raw: Object.assign({}, entry, { authURL: entry.authURL || entry.authUrl })
        })),
      magicLink: { enabled: false },
      otp: { enabled: otp.enabled === true }
    };
  }

  // Directus. `{data: [...]}`, whose entries have been bare strings in some
  // versions and `{name, driver, label}` in others.
  const data = Array.isArray(envelope.data) ? envelope.data : [];
  return {
    providers: data
      .map((entry) => {
        if (typeof entry === 'string') return { id: entry, displayName: entry };
        const record = (entry || {}) as { name?: string; label?: string; driver?: string };
        if (!record.name) return undefined;
        return { id: record.name, displayName: record.label || record.name };
      })
      .filter((entry): entry is AuthProviderEntry => entry !== undefined),
    magicLink: { enabled: false }
  };
}

/** PocketBase's own word for "this sign-in created the account". Measured. */
export function readIsNew(body: unknown): boolean {
  const meta = ((body || {}) as { meta?: { isNew?: unknown } }).meta;
  return !!meta && meta.isNew === true;
}

/** The current page, minus the parameters a provider return leaves behind. */
function currentUrlWithoutOAuthParams(): string {
  const url = new URL(window.location.href);
  url.searchParams.delete('code');
  url.searchParams.delete('state');
  url.searchParams.delete('error');
  url.searchParams.delete('error_description');
  return url.toString();
}

/** Rewrite the address bar without the sign-in parameters, keeping everything else. */
function stripQueryParams(remaining: URLSearchParams): void {
  if (!window.history || typeof window.history.replaceState !== 'function') return;
  const query = remaining.toString();
  const cleaned = window.location.pathname + (query ? `?${query}` : '') + window.location.hash;
  try {
    window.history.replaceState(window.history.state, '', cleaned);
  } catch (e) {
    // A sandboxed iframe can refuse `replaceState`. Not fatal — the exchange
    // still runs and the code is still single-use; the only cost is an ugly URL.
    // The same tolerance `ParseAuthAdapter._stripAuthParamsFromUrl` has, for the
    // same reason: this must never abort a sign-in.
  }
}

/** A backend this adapter does not serve at all. */
function notServed(type: string): string {
  return (
    `The "${type}" backend is not served by the REST auth adapter. ` +
    'Directus and PocketBase are; the Parse-wire backends use ParseAuthAdapter.'
  );
}

// ── Reading a token's expiry ────────────────────────────────────────────────

/**
 * The `exp` claim out of a JWT, as unix **milliseconds**.
 *
 * Both of these backends hand out JWTs and the claim is the authority the design
 * doc's §2 asks for: *"the token is the authority; the declared TTL is a
 * fallback"*. Reading it beats trusting a declared TTL for a measured reason —
 * PocketBase's descriptor declares 1 209 600 s (14 days) and the rig's tokens
 * carry `exp - now = 604 800` s (7 days). The declaration is not wrong so much as
 * it is a different instance's configuration, which is the whole argument for
 * preferring the token.
 *
 * No verification and no dependency: this reads a public claim to decide *when to
 * refresh*. Nothing is authorised on the strength of it — the backend validates
 * its own signature on every request, and a forged `exp` could only make us
 * refresh at the wrong moment.
 */
export function jwtExpiryMs(token: string | undefined): number | undefined {
  if (!token || typeof token !== 'string') return undefined;
  const parts = token.split('.');
  if (parts.length < 2) return undefined;
  try {
    // base64url → base64. `atob` exists in every browser and in Node ≥16.
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = typeof atob === 'function' ? atob(padded) : Buffer.from(padded, 'base64').toString('binary');
    const claims = JSON.parse(json) as { exp?: unknown };
    if (typeof claims.exp !== 'number' || !isFinite(claims.exp)) return undefined;
    return claims.exp * 1000;
  } catch (e) {
    return undefined;
  }
}

// ── Errors ──────────────────────────────────────────────────────────────────

/**
 * A sentence out of whatever the backend sent.
 *
 * Both envelopes measured live: Directus `{errors:[{message, extensions:{code}}]}`
 * ("Invalid user credentials." on a bad password *and* on a spent refresh token),
 * PocketBase `{status, message, data}` ("Failed to authenticate.").
 *
 * Deliberately a near-twin of `RestDataAdapter`'s rather than a shared helper:
 * that one lives in a file another worker owns, and importing across two adapters
 * to save eight lines would couple two independently-evolving error surfaces.
 */
export function authErrorMessage(status: number, body: unknown, text: string): string {
  const envelope = body as Record<string, unknown> | undefined;

  if (envelope && Array.isArray(envelope.errors) && envelope.errors.length > 0) {
    const first = envelope.errors[0] as Record<string, unknown>;
    if (typeof first?.message === 'string') return first.message;
  }
  if (envelope && typeof envelope.message === 'string' && envelope.message.length > 0) {
    return envelope.message;
  }
  if (text && text.length > 0 && text.length < 400) return `HTTP ${status}: ${text}`;
  return `HTTP ${status}`;
}

/** What a failed request hands the caller, and what the lifecycle classifies. */
export interface AuthWireError {
  error: string;
  /** 0 when the request never arrived. `classifyRefreshFailure` turns on this. */
  status: number;
}

export interface RestAuthAdapterOptions {
  fetchImpl?: AuthFetchLike;
  /** Overridable so a test can hand in a plain object for storage. */
  createStore?: (handle: BackendHandle) => SessionStore;
  /** PocketBase only. See {@link DEFAULT_POCKETBASE_USER_COLLECTION}. */
  userCollection?: string;
  /**
   * `conditional` capability cells a live probe has settled affirmatively.
   *
   * The contract's rule is that `conditional` counts as unsupported until proven,
   * which is right and is load-bearing here: Directus public registration is off
   * by default (measured 403) and PocketBase falls back to *logging* mail rather
   * than erroring when SMTP is unset, so a verification flow reports success
   * having sent nothing.
   */
  probedCapabilities?: readonly CapabilityKey[];
  /**
   * Overrides the descriptor's lifecycle. For `custom`, and for tests that want
   * a two-second token.
   */
  lifecycle?: TokenLifecycle;
  now?: () => number;
  /**
   * Is there a browser tab that outlives a request?
   *
   * Defaults to the controller's own `isBrowserTab`, which is the SSR and
   * cloud-runtime guard: a server render has a `localStorage` **mock** installed
   * by RUN-002's harness, so "is there storage" concludes "browser" and would arm
   * a fifteen-minute timer holding a refresh token once per render, in a
   * long-lived Node process.
   *
   * Injectable because the unit suite runs under `testEnvironment: 'node'`, where
   * that guard is correctly false and would switch off the very paths under test.
   */
  isBrowserTab?: () => boolean;
}

/**
 * Auth for Directus and PocketBase, and an honest refusal for Supabase.
 *
 * Shares `AuthEvents` with `ParseAuthAdapter`, so the five session events a
 * builder already wires — `loggedIn`, `loggedOut`, `sessionGained`,
 * `sessionLost`, `sessionChanged` — mean the same thing here. That is the point
 * of putting them on the contract rather than in `userservice.ts`.
 */
export class RestAuthAdapter extends AuthEvents implements IAuthAdapter {
  private readonly fetchImpl: AuthFetchLike;
  private readonly createStore: (handle: BackendHandle) => SessionStore;
  private readonly userCollection: string;
  private readonly probedCapabilities: readonly CapabilityKey[];
  private readonly lifecycleOverride?: TokenLifecycle;
  private readonly now: () => number;
  private readonly isBrowserTabImpl?: () => boolean;

  private readonly stores = new Map<string, SessionStore>();
  private readonly controllers = new Map<string, TokenLifecycleController>();

  constructor(options: RestAuthAdapterOptions = {}) {
    super();
    this.fetchImpl = options.fetchImpl ?? ((url, init) => fetch(url, init) as unknown as ReturnType<AuthFetchLike>);
    this.userCollection = options.userCollection ?? DEFAULT_POCKETBASE_USER_COLLECTION;
    this.probedCapabilities = options.probedCapabilities ?? [];
    this.lifecycleOverride = options.lifecycle;
    this.now = options.now ?? Date.now;
    this.isBrowserTabImpl = options.isBrowserTab;
    this.createStore =
      options.createStore ??
      ((handle) =>
        new SessionStore({
          // Per backend **id**, not per type. Two Directus backends in one
          // project are two accounts, and the phase decided sessions are never
          // shared — `NodeGX/<id>/session` keeps them apart with no chance of
          // colliding with the Parse family's `Parse/<appId>/currentUser`.
          key: restSessionKey(handle)
        }));
  }

  // ── Resolution, storage, lifecycle ───────────────────────────────────────

  sessionStore(handle: BackendHandle): SessionStore {
    const cacheKey = String(handle.id) + '|' + String(handle.url);
    let store = this.stores.get(cacheKey);
    if (store === undefined) {
      store = this.createStore(handle);
      this.stores.set(cacheKey, store);
    }
    return store;
  }

  /** The stored session, or `undefined`. Not a contract method. */
  getCurrentUser(handle: BackendHandle): AuthSession | undefined {
    return this.sessionStore(handle).read();
  }

  private lifecycleFor(handle: BackendHandle): TokenLifecycle {
    if (this.lifecycleOverride) return this.lifecycleOverride;
    try {
      return descriptorFor(handle.type).tokenLifecycle;
    } catch (e) {
      // An unknown type has no descriptor. `eternal` schedules nothing, which is
      // the only safe answer: arming a refresh against a backend we cannot
      // describe produces background 404s forever.
      return { kind: 'eternal' };
    }
  }

  /**
   * The lifecycle controller for this backend — **with a `performRefresh`**.
   *
   * This is the whole of step 4. Everything the controller does was built and
   * tested in steps 1–3 and did nothing, because it takes one function and
   * nothing supplied it.
   */
  lifecycleController(handle: BackendHandle): TokenLifecycleController {
    const cacheKey = String(handle.id) + '|' + String(handle.url);
    let controller = this.controllers.get(cacheKey);
    if (controller === undefined) {
      const profile = restAuthProfileFor(handle.type);
      controller = new TokenLifecycleController({
        lifecycle: this.lifecycleFor(handle),
        store: this.sessionStore(handle),
        now: this.now,
        isBrowserTab: this.isBrowserTabImpl,
        // PocketBase refreshes with the access token. Without this the
        // controller's own "this sign-in cannot be renewed" guard would sign
        // every PocketBase user out at the first scheduled refresh.
        refreshTokenRequired: profile ? profile.refreshNeedsRefreshToken : true,
        performRefresh: profile && profile.refresh ? (session) => this.performRefresh(handle, profile, session) : undefined,
        onSessionLost: (reason) => {
          this.emitAuthEvent('sessionChanged', undefined);
          this.emitAuthEvent('sessionLost', reason);
        },
        onSessionClearedElsewhere: () => {
          this.emitAuthEvent('sessionChanged', undefined);
          this.emitAuthEvent('loggedOut');
        }
      });
      controller.start();
      this.controllers.set(cacheKey, controller);
    }
    return controller;
  }

  /** Release timers and storage listeners. For tests and for a torn-down runtime. */
  dispose(): void {
    // `forEach`, not `for…of` over `.values()`. The viewer's ts-jest program
    // targets pre-ES2015 (PLAT-003's recorded trap), and a Map iterator there is
    // a `TS2802` that fails the *consumer's* suite rather than this package's —
    // so the runtime typecheck stays green and the viewer's does not.
    this.controllers.forEach((controller) => controller.stop());
    this.controllers.clear();
  }

  private setSession(handle: BackendHandle, session: AuthSession): void {
    this.sessionStore(handle).write(session);
    this.lifecycleController(handle).sessionChanged();
    this.emitAuthEvent('sessionChanged', session);
  }

  private clearSession(handle: BackendHandle): void {
    this.sessionStore(handle).clear();
    this.lifecycleController(handle).sessionChanged();
    this.emitAuthEvent('sessionChanged', undefined);
  }

  // ── Gating ───────────────────────────────────────────────────────────────

  private capability(handle: BackendHandle, key: CapabilityKey): Capability | undefined {
    try {
      return descriptorFor(handle.type).capabilities[key];
    } catch (e) {
      return undefined;
    }
  }

  private allows(handle: BackendHandle, key: CapabilityKey): boolean {
    const capability = this.capability(handle, key);
    if (!capability) return false;
    if (capability.state === 'supported' || capability.state === 'degraded') return true;
    if (capability.state === 'conditional') return this.probedCapabilities.includes(key);
    return false;
  }

  /**
   * Resolve the profile and the capability, or refuse with a sentence.
   *
   * Every method starts here, and the sentence is the *descriptor's* rather than
   * this file's opinion — which is what makes the message a user reads at runtime
   * the same message the editor greys a port out with. BCN-010 gates on the same
   * cells.
   */
  /**
   * The half of {@link begin} that is not the capability table: which backend,
   * is it served here, and is there a URL.
   *
   * Split out for the OAuth pair, and the reason is a decision rather than a
   * refactor. `auth.oauth` is `conditional` on both backends, so routing it
   * through `begin` would refuse every provider sign-in unless something had
   * already probed and passed `probedCapabilities` — and nothing does. But the
   * discovery call {@link signInWithProvider} makes **is** that probe: it asks
   * the instance which providers it has, and refuses with the answer. Gating on
   * a descriptor cell first would refuse before asking, using a weaker source of
   * truth than the one a request away.
   */
  private resolveProfile(handle: BackendHandle, error: (message?: string) => void): RestAuthProfile | undefined {
    if (handle.type === 'supabase') {
      error(SUPABASE_AUTH_UNSUPPORTED);
      return undefined;
    }

    const profile = restAuthProfileFor(handle.type);
    if (!profile) {
      error(notServed(handle.type));
      return undefined;
    }

    if (!handle.url) {
      error('No backend URL is configured.');
      return undefined;
    }

    return profile;
  }

  private begin(
    handle: BackendHandle,
    key: CapabilityKey,
    error: (message?: string) => void
  ): RestAuthProfile | undefined {
    const profile = this.resolveProfile(handle, error);
    if (!profile) return undefined;

    const capability = this.capability(handle, key);
    if (this.allows(handle, key)) return profile;

    error(
      (capability && capability.state !== 'supported' ? capability.reason : undefined) ||
        `${handle.name || handle.type} does not support ${key}.`
    );
    return undefined;
  }

  // ── The wire ─────────────────────────────────────────────────────────────

  private path(profile: RestAuthProfile, template: string, substitutions?: Record<string, string>): string {
    let path = template.replace('{collection}', encodeURIComponent(this.userCollection));
    for (const [name, value] of Object.entries(substitutions || {})) {
      path = path.replace('{' + name + '}', encodeURIComponent(value));
    }
    return path;
  }

  private url(handle: BackendHandle, path: string): string {
    return (handle.url || '').replace(/\/$/, '') + path;
  }

  /**
   * One request, one callback.
   *
   * **Any 2xx succeeds, and an empty body is a success with no body.** Both
   * widenings are measured and both matter: Directus answers `/auth/logout` and
   * `/auth/password/request` with **204 and nothing**, and PocketBase answers
   * `request-verification` and `request-password-reset` the same way. The Parse
   * wire's `200 || 201` test would read every one of those as a failure.
   */
  private request(
    handle: BackendHandle,
    init: { method?: string; path: string; token?: string; body?: unknown },
    callbacks: { ok: (body: unknown) => void; fail: (error: AuthWireError) => void }
  ): void {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (init.token) headers.Authorization = `Bearer ${init.token}`;

    this.fetchImpl(this.url(handle, init.path), {
      method: init.method || 'GET',
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body)
    })
      .then((response) =>
        response.text().then((text) => {
          let body: unknown;
          try {
            body = text === '' ? undefined : JSON.parse(text);
          } catch (e) {
            body = undefined;
          }

          if (response.status >= 200 && response.status < 300) callbacks.ok(body);
          else callbacks.fail({ error: authErrorMessage(response.status, body, text), status: response.status });
        })
      )
      .catch((e: unknown) => {
        // ⚠️ Status **0**, and it is load-bearing. `classifyRefreshFailure` reads
        // 4xx as "the backend rejected this session" and everything else as "the
        // request did not arrive". A network failure reported as a 401 would sign
        // out every user whose wifi dropped — the exact case the design's §4
        // margin exists to absorb.
        callbacks.fail({ error: e instanceof Error ? e.message : String(e), status: 0 });
      });
  }

  /** A request carrying the signed-in user's token, through the lifecycle gate. */
  private authed(
    handle: BackendHandle,
    init: { method?: string; path: string; body?: unknown },
    callbacks: { ok: (body: unknown) => void; fail: (error: AuthWireError) => void }
  ): void {
    this.lifecycleController(handle).withSession((session, error) => {
      if (error) {
        callbacks.fail({ error, status: 401 });
        return;
      }
      this.request(handle, { ...init, token: session?.sessionToken }, callbacks);
    });
  }

  // ── Reading a session off a response ─────────────────────────────────────

  /**
   * Flatten a login/refresh response into the contract's `AuthSession`.
   *
   * `AuthSession` is the user's fields **flat**, with the tokens beside them —
   * BCN-006 corrected it from an envelope for the Parse wire's sake, and its
   * doc comment predicted this: *"Directus and Supabase answer
   * `{access_token, refresh_token, user}` and their adapters flatten towards
   * this"*. They do, and the prediction held.
   */
  private readSession(profile: RestAuthProfile, body: unknown, previous?: AuthSession): AuthSession | undefined {
    const envelope = (body || {}) as Record<string, unknown>;

    switch (profile.type) {
      case 'directus': {
        const data = (envelope.data || envelope) as Record<string, unknown>;
        const token = data.access_token as string | undefined;
        if (!token) return undefined;
        const session: AuthSession = Object.assign({}, previous, {
          sessionToken: token,
          refreshToken: (data.refresh_token as string | undefined) ?? previous?.refreshToken,
          expiresAt: this.directusExpiry(token, data.expires)
        });
        // Directus's login answers tokens only — no user record. The caller
        // fetches `/users/me` afterwards, which is why `previous` is merged
        // rather than replaced.
        return session;
      }

      case 'pocketbase': {
        const token = envelope.token as string | undefined;
        if (!token) return undefined;
        const record = (envelope.record || {}) as Record<string, unknown>;
        return Object.assign({}, previous, this.normalizeUser(profile, record), {
          sessionToken: token,
          // No refresh token exists. Recorded as an absence rather than left to
          // be inferred from `undefined`.
          expiresAt: jwtExpiryMs(token)
        });
      }

      default:
        return undefined;
    }
  }

  /**
   * ⚠️ **`expires` is milliseconds of remaining lifetime**, measured.
   *
   * `POST /auth/login` answers `{"expires":900000,…}` and the access token's own
   * `exp` claim is `now + 900` seconds. So it is a *duration*, in ms — not the
   * absolute timestamp `AuthSession.expiresAt` holds, and not seconds.
   *
   * Treating it as an absolute time puts the deadline at 1970-01-01T00:15:00Z,
   * every request sees an expired token, and the app refreshes in a loop while
   * appearing to work. Treating it as seconds gives a deadline 250 hours out and
   * the session dies with no refresh ever attempted. Both are silent.
   *
   * The JWT claim wins where it parses, per the design's §2 "the token is the
   * authority"; `expires` is the fallback and the declared TTL the last resort.
   */
  private directusExpiry(token: string, expires: unknown): number | undefined {
    const fromToken = jwtExpiryMs(token);
    if (fromToken !== undefined) return fromToken;
    if (typeof expires === 'number' && isFinite(expires) && expires > 0) return this.now() + expires;
    return undefined;
  }

  /**
   * One backend's user record as `AuthUser` — **step 6's normalisation**.
   *
   * `id` becomes `objectId`, in the same direction and for the same reason
   * `recordIdentity.ts` normalises records: the Parse-family name wins because
   * eleven nodes and `CloudStore._fromJSON` read it, and the better
   * implementation comes from wherever it is better. The rest of the record is
   * carried through untouched, which is what makes `Set User Properties`
   * schema-driven without per-backend node code.
   *
   * `emailVerified` is the interesting cell:
   *
   * - **PocketBase** has a real boolean, `verified`. It maps.
   * - **Directus has no such field at all.** It has `status`
   *   (`active`/`invited`/`draft`/`suspended`/`archived`), which is an account
   *   state and not an assertion about the address — an admin-created active user
   *   may never have seen an email. Mapping `status === 'active'` to
   *   `emailVerified` would answer a question Directus was not asked, so this
   *   leaves it **absent** and the descriptor's `auth.emailVerify` cell carries
   *   the sentence.
   */
  private normalizeUser(profile: RestAuthProfile, record: Record<string, unknown>): AuthUser {
    const user: AuthUser = Object.assign({}, record);

    const id = record[profile.idField];
    if (id !== undefined && id !== null) user.objectId = String(id);
    if (profile.idField !== 'objectId') delete user[profile.idField];

    if (profile.type === 'pocketbase' && 'verified' in record) {
      user.emailVerified = record.verified === true;
    }

    // Never let a password hash or a TFA secret into browser storage, whatever
    // the backend chose to send. Directus answers `/users/me` with
    // `password: "**********"` and `tfa_secret: null` — harmless as they stand,
    // and not values that belong in `localStorage` under any circumstances.
    delete user.password;
    delete user.tfa_secret;

    return user;
  }

  private readUser(profile: RestAuthProfile, body: unknown): AuthUser {
    const envelope = (body || {}) as Record<string, unknown>;
    switch (profile.type) {
      case 'directus':
        return this.normalizeUser(profile, (envelope.data || envelope) as Record<string, unknown>);
      case 'pocketbase':
        return this.normalizeUser(profile, (envelope.record || envelope) as Record<string, unknown>);
      default:
        return {};
    }
  }

  // ── performRefresh — the point of step 4 ─────────────────────────────────

  /**
   * Ask the backend for a new token. **The only thing the controller needs.**
   *
   * Rejects with `{error, status}` so `classifyRefreshFailure` can tell a
   * rejected session from a request that never arrived. Measured on both
   * backends: a spent or garbage Directus refresh token is `401`, a garbage
   * PocketBase bearer is `401`, and an unreachable host arrives here as status
   * `0` — a rejection ends the session, a `0` is retried with backoff.
   */
  private performRefresh(handle: BackendHandle, profile: RestAuthProfile, session: AuthSession): Promise<AuthSession> {
    return new Promise<AuthSession>((resolve, reject) => {
      const path = this.path(profile, profile.refresh as string);

      const init =
        profile.type === 'directus'
          ? // `mode: 'json'` is **explicit, not required** — and the distinction was
            // measured rather than assumed. This comment first claimed it was
            // required, on the documentation-shaped reasoning that Directus would
            // otherwise set the new refresh token as an httpOnly cookie and leave
            // the body without one. Mutation-testing the live driver disproved it:
            // omitting `mode` on Directus 11 returns
            // `{expires, refresh_token, access_token}` and sets no cookie, exactly
            // as `mode: 'json'` does — the default already is json, and
            // `mode: 'cookie'` is in fact a 400 when the token comes in the body.
            //
            // Kept anyway, because "the default happens to be what we want" is a
            // weaker guarantee than saying which one we want, and the cookie shape
            // would break the lifecycle silently one token lifetime later. But it
            // is belt-and-braces, and a reader should not be told a default is a
            // requirement.
            { method: 'POST', path, body: { refresh_token: session.refreshToken, mode: 'json' } }
          : { method: 'POST', path, token: session.sessionToken, body: {} };

      this.request(handle, init, {
        ok: (body) => {
          const refreshed = this.readSession(profile, body, session);
          if (!refreshed || !refreshed.sessionToken) {
            // A 2xx carrying no token. Fatal, because retrying cannot help and
            // pretending it worked leaves a session that is already dead.
            reject({ error: 'The backend did not return a new session token.', fatal: true });
            return;
          }
          resolve(refreshed);
        },
        fail: (error) => reject(error)
      });
    });
  }

  // ── The ten ──────────────────────────────────────────────────────────────

  logIn(handle: BackendHandle, options: LogInOptions): void {
    const profile = this.begin(handle, 'auth.password', options.error);
    if (!profile) return;

    const body =
      profile.type === 'directus'
        ? // ⚠️ Directus logs in with `email`, and the contract's field is called
          // `username`. Not a rename for tidiness: `directus_users` has no
          // username column at all, so the Log In node's "username" input IS the
          // email address on this backend. The node's help text should say so.
          { email: options.username, password: options.password }
        : // PocketBase calls it `identity` and accepts either the email or a
          // username field, per the collection's `identityFields` (measured:
          // `["email"]` on a stock users collection).
          { identity: options.username, password: options.password };

    this.request(
      handle,
      { method: 'POST', path: this.path(profile, profile.login), body },
      {
        ok: (response) => {
          const session = this.readSession(profile, response, undefined);
          if (!session) {
            options.error('Sign-in did not return a session.');
            return;
          }
          this.setSession(handle, session);

          if (profile.type === 'directus') {
            // Directus's login answers tokens with no user record, so the
            // signed-in user is not known until `/users/me`. `loggedIn` fires
            // only once the session is complete: a graph that reads
            // `Current.email` in its `loggedIn` handler is the ordinary case,
            // and firing early would hand it an empty user.
            this.fetchUserInto(handle, profile, session, (completed) => {
              options.success(completed);
              this.emitAuthEvent('loggedIn', completed);
            }, options.error);
            return;
          }

          options.success(session);
          this.emitAuthEvent('loggedIn', session);
        },
        fail: (error) => options.error(error.error)
      }
    );
  }

  /** `/users/me` merged into the stored session, then handed on. */
  private fetchUserInto(
    handle: BackendHandle,
    profile: RestAuthProfile,
    session: AuthSession,
    done: (session: AuthSession) => void,
    fail: (error?: string) => void
  ): void {
    this.request(
      handle,
      { method: 'GET', path: this.path(profile, profile.me), token: session.sessionToken },
      {
        ok: (body) => {
          const merged = Object.assign({}, session, this.readUser(profile, body));
          this.setSession(handle, merged);
          done(merged);
        },
        fail: (error) => fail(error.error)
      }
    );
  }

  logOut(handle: BackendHandle, options: LogOutOptions): void {
    const profile = restAuthProfileFor(handle.type);
    const session = this.getCurrentUser(handle);

    /**
     * The local session goes **whatever the backend says**.
     *
     * A logout that fails because the backend is unreachable, and leaves the app
     * believing it is signed in, is the worst of both: the user pressed the
     * button and nothing happened. Directus's own behaviour makes this
     * unavoidable rather than merely preferable — measured, `POST /auth/logout`
     * answers 204 and the **access token still works afterwards**, because it
     * revokes the refresh token (the session) and not the JWT. So the client
     * dropping its copy is what a logout actually is on this wire.
     */
    const finish = () => {
      this.clearSession(handle);
      options.success();
      this.emitAuthEvent('loggedOut');
    };

    if (!profile || !profile.logout || !handle.url || !session) {
      finish();
      return;
    }

    this.request(
      handle,
      {
        method: 'POST',
        path: this.path(profile, profile.logout),
        token: session.sessionToken,
        body: profile.type === 'directus' ? { refresh_token: session.refreshToken, mode: 'json' } : {}
      },
      { ok: finish, fail: finish }
    );
  }

  signUp(handle: BackendHandle, options: SignUpOptions): void {
    const profile = this.begin(handle, 'auth.signUp', options.error);
    if (!profile || !profile.signUp) return;

    if (profile.type === 'directus') {
      // ⚠️ Directus's registration answers **204 with no body and no session**.
      // It does not sign the new user in, so this logs in afterwards — otherwise
      // `signUp` would resolve with nobody signed in, which is not what any of
      // the eleven nodes or `Noodl.Users.signUp` mean by success.
      this.request(
        handle,
        {
          method: 'POST',
          path: this.path(profile, profile.signUp),
          body: Object.assign({}, options.properties, {
            email: options.email || options.username,
            password: options.password
          })
        },
        {
          ok: () => this.logIn(handle, { username: options.username, password: options.password, success: options.success, error: options.error }),
          fail: (error) => options.error(error.error)
        }
      );
      return;
    }

    // PocketBase. ⚠️ Creating the record answers **200 and no token**, and the
    // record it returns omits `email` because the shipped users collection has
    // `emailVisibility: false` — so reading the new user off this response gives
    // a user with no address. Measured, and it is the same defect class as the
    // Parse `Current.email` gap this task fixes. Logging in afterwards is both
    // how a session is obtained and how the email is learned.
    this.request(
      handle,
      {
        method: 'POST',
        path: this.path(profile, profile.signUp),
        body: Object.assign({}, options.properties, {
          email: options.email || options.username,
          password: options.password,
          passwordConfirm: options.password
        })
      },
      {
        ok: () =>
          this.logIn(handle, {
            username: options.email || options.username,
            password: options.password,
            success: options.success,
            error: options.error
          }),
        fail: (error) => options.error(error.error)
      }
    );
  }

  fetchCurrentUser(handle: BackendHandle, options: FetchCurrentUserOptions): void {
    const profile = restAuthProfileFor(handle.type);
    if (!profile) {
      options.error(handle.type === 'supabase' ? SUPABASE_AUTH_UNSUPPORTED : notServed(handle.type));
      return;
    }

    const stored = this.getCurrentUser(handle);
    const token = options.sessionToken || stored?.sessionToken;
    if (!token) {
      options.error('Nobody is signed in.');
      return;
    }

    const method = profile.type === 'pocketbase' ? 'POST' : 'GET';
    this.request(
      handle,
      { method, path: this.path(profile, profile.me), token, body: method === 'POST' ? {} : undefined },
      {
        ok: (body) => {
          // PocketBase's `auth-refresh` doubles as "who am I" and answers with a
          // *new* token, so a `become(token)` on it legitimately replaces the
          // session rather than only describing it.
          const session =
            this.readSession(profile, body, Object.assign({}, stored, { sessionToken: token })) ??
            Object.assign({}, stored, this.readUser(profile, body), { sessionToken: token });

          this.setSession(handle, session);
          this.emitAuthEvent('sessionGained', session);
          options.success(session);
        },
        fail: (error) => {
          // 401/403 is the backend saying this session is over — the REST family's
          // equivalent of Parse's code 209, and handled the same way: clear
          // storage and say the session was lost. A 5xx or a network failure is
          // NOT: a stored session must survive a backend restart.
          if (error.status === 401 || error.status === 403) {
            this.sessionStore(handle).clear();
            this.emitAuthEvent('sessionLost', error.error);
          }
          options.error(error.error);
        }
      }
    );
  }

  verifyEmail(handle: BackendHandle, options: VerifyEmailOptions): void {
    const profile = this.begin(handle, 'auth.emailVerify', options.error);
    if (!profile) return;
    if (!profile.verifyEmail) {
      options.error(`${handle.name || handle.type} has no way to confirm an email address from an app.`);
      return;
    }

    const init =
      profile.type === 'directus'
        ? { method: 'GET' as const, path: `${this.path(profile, profile.verifyEmail)}?token=${encodeURIComponent(options.token)}` }
        : { method: 'POST' as const, path: this.path(profile, profile.verifyEmail), body: { token: options.token } };

    this.request(handle, init, {
      ok: () => options.success(),
      fail: (error) => options.error(error.error)
    });
  }

  sendEmailVerification(handle: BackendHandle, options: SendEmailVerificationOptions): void {
    const profile = this.begin(handle, 'auth.emailVerify', options.error);
    if (!profile) return;
    if (!profile.sendEmailVerification) {
      // Directus. Its verification email is sent by the registration flow
      // server-side and there is no client-callable "send it again".
      options.error(
        `${handle.name || handle.type} cannot re-send a verification email from an app. ` +
          'Re-send it from your Directus admin instead.'
      );
      return;
    }

    this.request(
      handle,
      { method: 'POST', path: this.path(profile, profile.sendEmailVerification), body: { email: options.email } },
      { ok: () => options.success(), fail: (error) => options.error(error.error) }
    );
  }

  requestPasswordReset(handle: BackendHandle, options: RequestPasswordResetOptions): void {
    const profile = this.begin(handle, 'auth.passwordReset', options.error);
    if (!profile || !profile.requestPasswordReset) return;

    this.request(
      handle,
      { method: 'POST', path: this.path(profile, profile.requestPasswordReset), body: { email: options.email } },
      { ok: () => options.success(), fail: (error) => options.error(error.error) }
    );
  }

  resetPassword(handle: BackendHandle, options: ResetPasswordOptions): void {
    const profile = this.begin(handle, 'auth.passwordReset', options.error);
    if (!profile || !profile.resetPassword) return;

    const body =
      profile.type === 'directus'
        ? { token: options.token, password: options.newPassword }
        : { token: options.token, password: options.newPassword, passwordConfirm: options.newPassword };

    this.request(
      handle,
      { method: 'POST', path: this.path(profile, profile.resetPassword), body },
      { ok: () => options.success(), fail: (error) => options.error(error.error) }
    );
  }

  // ── OAuth — step 5 ───────────────────────────────────────────────────────

  /**
   * Where a half-finished provider sign-in is parked while the browser is away.
   *
   * Beside the session, in the same storage, for the reason the return leg needs
   * it at all: the code comes back on a **fresh page load**, in a new JavaScript
   * context, and PocketBase's exchange requires the `codeVerifier` that was
   * minted before the redirect. Nothing in memory survives that.
   */
  private pendingKey(handle: BackendHandle): string {
    return restSessionKey(handle) + '.oauth-pending';
  }

  private readPending(handle: BackendHandle): PendingOAuthFlow | undefined {
    const raw = this.sessionStore(handle).readKey(this.pendingKey(handle));
    if (raw === undefined) return undefined;
    try {
      const parsed = JSON.parse(raw) as PendingOAuthFlow;
      return parsed && typeof parsed.provider === 'string' ? parsed : undefined;
    } catch (e) {
      return undefined;
    }
  }

  private clearPending(handle: BackendHandle): void {
    const store = this.sessionStore(handle);
    // `writeKey`/`readKey` have no delete twin and this is the only caller that
    // wants one; an empty string reads back as "no pending flow" through
    // `readPending`'s JSON guard, which is enough and keeps `SessionStore`'s
    // surface where BCN-006 step 1 put it.
    store.writeKey(this.pendingKey(handle), '');
  }

  /**
   * The sign-in methods this backend offers **right now**, asked of the backend.
   *
   * Not read from the descriptor, and that is the point. `auth.oauth` is
   * `conditional` for both of these backends because whether a provider exists
   * is an instance's configuration, not a product's capability — and the
   * contract's rule is that `conditional` counts as unsupported *until probed*.
   * This is the probe. It is also what a builder needs in order to render a row
   * of buttons that matches what the backend will actually accept.
   *
   * Both shapes measured on 2026-08-01:
   *
   * - PocketBase `GET …/auth-methods` → `{password:{…}, oauth2:{enabled, providers:[{name, displayName, state, authURL, codeVerifier, …}]}, otp:{enabled}}`
   * - Directus `GET /auth` → `{data:[], disableDefault:false}` on an instance with
   *   no SSO configured. ⚠️ **The shape of a populated entry is NOT measured** —
   *   the rig has no Directus SSO provider and configuring one needs a container
   *   restart. Both spellings Directus has used (a bare string, and
   *   `{name, driver, label}`) are read; see BCN-006-NOTES-STEP5-6.
   */
  listAuthProviders(
    handle: BackendHandle,
    options: {
      success(response?: { providers: { id: string; displayName: string }[]; magicLink: { enabled: boolean } }): void;
      error(error?: string): void;
    }
  ): void {
    const profile = this.resolveProfile(handle, options.error);
    if (!profile || !profile.authMethods) {
      if (profile) options.error(`${handle.name || handle.type} does not publish a list of sign-in providers.`);
      return;
    }

    this.request(
      handle,
      { method: 'GET', path: this.path(profile, profile.authMethods) },
      {
        ok: (body) => options.success(readAuthMethods(profile, body)),
        fail: (error) => options.error(error.error)
      }
    );
  }

  /**
   * Send the browser to a provider. **This navigates away** — nothing after it
   * runs, and the result arrives on a later page load through
   * {@link consumeAuthReturn}.
   *
   * ## Discovery first, always
   *
   * The one design decision in step 5, and it came from measurement rather than
   * taste. A provider that is not configured fails *late and badly* on both
   * backends:
   *
   * - **Directus**: `GET /auth/login/google` on an instance with no Google
   *   provider is a **404 `ROUTE_NOT_FOUND`** — the route does not exist. A
   *   top-level navigation to it lands the user on Directus's error JSON, off
   *   your app, with no way back.
   * - **PocketBase**: the exchange answers **403 "The collection is not
   *   configured to allow OAuth2 authentication."** — which the user only ever
   *   sees *after* a round trip through a provider.
   *
   * So this asks the backend what it offers, and only navigates once the answer
   * names the provider. The cost is one request before the redirect; what it buys
   * is that `Sign In With` fails on its own `error` port, on the builder's own
   * page, which is BCN-006's "nothing is silently missing" promise in the one
   * place it is most visible.
   *
   * ## Directus is refused, and the reason is not "not done yet"
   *
   * Directus SSO returns its refresh token as an **httpOnly cookie** and nothing
   * in the URL. There is no mode that answers with tokens in the response the way
   * `/auth/login` does. Consuming it therefore needs a cookie-carried session —
   * `credentials: 'include'` on every request and a `mode: 'cookie'` refresh —
   * which is a second session model beside {@link SessionStore}, not a fifth
   * redirect shape. That is a design decision with a blast radius past this task,
   * and it could not have been probed anyway: the rig has no Directus SSO
   * provider and configuring one needs environment variables and a restart of a
   * container three other workers were using.
   */
  signInWithProvider(handle: BackendHandle, options: SignInWithProviderOptions): void {
    const fail = (message: string) => {
      if (options.error) options.error(message);
    };

    const profile = this.resolveProfile(handle, fail);
    if (!profile) return;

    if (!options.provider) {
      fail('Sign In With: no provider was set.');
      return;
    }

    if (!profile.oauthExchange) {
      fail(
        `NodeGX cannot complete a ${handle.name || handle.type} single sign-on yet. ` +
          'Directus returns the session as a browser cookie rather than in the response, which needs a ' +
          'different kind of session than NodeGX stores. Use email and password on this backend.'
      );
      return;
    }

    if (typeof window === 'undefined' || !window.location) {
      // A server render, or the cloud runtime. There is no browser to navigate.
      fail('Signing in with a provider needs a browser.');
      return;
    }

    const redirect = options.redirect || currentUrlWithoutOAuthParams();

    this.listAuthProviders(handle, {
      success: (methods) => {
        const providers = methods?.providers || [];
        const match = providers.find((entry) => entry.id === options.provider);
        if (!match) {
          fail(
            providers.length === 0
              ? `${handle.name || handle.type} has no sign-in providers configured. ` +
                  'Add one in its admin panel first.'
              : `"${options.provider}" is not one of the sign-in providers ${handle.name || handle.type} offers ` +
                  `(${providers.map((entry) => entry.id).join(', ')}).`
          );
          return;
        }

        const raw = (match as { raw?: PocketbaseProviderEntry }).raw;
        if (!raw || !raw.authURL) {
          fail(`${handle.name || handle.type} did not return a sign-in URL for "${options.provider}".`);
          return;
        }

        // ⚠️ `authURL` arrives **ending in a bare `redirect_uri=`** — measured.
        // The client appends its own, encoded. Appending an unencoded URL, or
        // assuming the parameter was already complete, both produce a provider
        // error page rather than anything this code could report.
        const target = raw.authURL + encodeURIComponent(redirect);

        // Parked BEFORE the navigation, because after it nothing here runs.
        const pending: PendingOAuthFlow = {
          provider: options.provider,
          codeVerifier: raw.codeVerifier,
          state: raw.state,
          redirectURL: redirect,
          startedAt: this.now()
        };
        this.sessionStore(handle).writeKey(this.pendingKey(handle), JSON.stringify(pending));

        window.location.href = target;
      },
      error: (message) => fail(message || 'Could not ask the backend which sign-in providers it offers.')
    });
  }

  /** BCN-006 step 5: the state of a provider sign-in coming back. */
  oauthReturn: OAuthReturnState = { inProgress: false };

  /**
   * Look for a provider result in the current URL and act on it.
   *
   * Returns true when this page load **is** a sign-in return, so `UserService`
   * can skip its ordinary stale-session validation — a page load carrying a
   * brand-new sign-in is not a page load with a dead session, and checking first
   * would fire `sessionLost` at the moment the user succeeded.
   *
   * ## Why a stored flow, and not just `?code=`
   *
   * `code` and `state` are the most generic query parameters in the world. A
   * marketing link, a coupon field, another library's callback — any of them
   * would otherwise be mistaken for a sign-in return and consumed. So the
   * trigger is **a parked flow for this backend**, and the URL is only read once
   * one exists.
   *
   * `state` is then compared, which is what it is for. A mismatch is refused
   * rather than exchanged: it means the code in this URL was not minted by the
   * attempt this browser started.
   */
  consumeAuthReturn(handle: BackendHandle): boolean {
    if (typeof window === 'undefined' || !window.location) return false;

    const profile = restAuthProfileFor(handle.type);
    if (!profile || !profile.oauthExchange) return false;

    const pending = this.readPending(handle);
    if (!pending) return false;

    let params: URLSearchParams;
    try {
      params = new URLSearchParams(window.location.search);
    } catch (e) {
      return false;
    }

    const code = params.get('code');
    const state = params.get('state');
    const providerError = params.get('error_description') || params.get('error');
    if (!code && !providerError) return false;

    // Strip and forget BEFORE anything else, for the reason BAK-004's own return
    // leg gives: a one-time code left in the address bar survives into history
    // and into anything the user copies, and a refresh re-attempts a code that is
    // already spent — producing a failure on a sign-in that actually worked.
    params.delete('code');
    params.delete('state');
    params.delete('error');
    params.delete('error_description');
    stripQueryParams(params);
    this.clearPending(handle);

    if (providerError) {
      this.oauthReturn = { inProgress: false, succeeded: false, error: providerError };
      // Deferred so a `Sign In With` node that subscribes during this same tick
      // still hears it.
      setTimeout(() => this.emitAuthEvent('oauthReturn', this.oauthReturn), 0);
      return true;
    }

    if (pending.state && state !== pending.state) {
      this.oauthReturn = {
        inProgress: false,
        succeeded: false,
        error: 'This sign-in could not be verified as the one you started. Please try again.'
      };
      setTimeout(() => this.emitAuthEvent('oauthReturn', this.oauthReturn), 0);
      return true;
    }

    this.oauthReturn = { inProgress: true };
    this.request(
      handle,
      {
        method: 'POST',
        path: this.path(profile, profile.oauthExchange),
        body: {
          provider: pending.provider,
          code,
          codeVerifier: pending.codeVerifier,
          redirectURL: pending.redirectURL
        }
      },
      {
        ok: (body) => {
          const session = this.readSession(profile, body, undefined);
          if (!session) {
            this.oauthReturn = { inProgress: false, succeeded: false, error: 'Sign-in did not return a session.' };
            this.emitAuthEvent('oauthReturn', this.oauthReturn);
            return;
          }
          this.setSession(handle, session);
          this.oauthReturn = {
            inProgress: false,
            succeeded: true,
            // ⚠️ `meta.isNew` is PocketBase's own word for "this sign-in created
            // the account", measured. Mapped onto the `outcome` vocabulary
            // BAK-004 already gave the `Sign In With` node so one graph reads the
            // same values whichever backend produced them.
            outcome: readIsNew(body) ? 'created' : 'signed-in'
          };
          this.emitAuthEvent('oauthReturn', this.oauthReturn);
          this.emitAuthEvent('loggedIn', session);
        },
        fail: (error) => {
          this.oauthReturn = {
            inProgress: false,
            succeeded: false,
            error: error.error || 'Sign-in could not be completed.'
          };
          this.emitAuthEvent('oauthReturn', this.oauthReturn);
        }
      }
    );
    return true;
  }

  requestMagicLink(handle: BackendHandle, options: RequestMagicLinkOptions): void {
    const profile = this.begin(handle, 'auth.magicLink', options.error);
    if (!profile || !profile.magicLink) {
      // `begin` has already refused with the descriptor's own sentence —
      // "Directus has no magic-link login. Use email and password, or an OAuth
      // provider." — which is the phase's central promise in one line.
      if (profile) options.error(`${handle.name || handle.type} has no magic-link login.`);
      return;
    }
  }

  // ── Not contract ─────────────────────────────────────────────────────────

  /**
   * Write profile fields onto the signed-in user.
   *
   * The `Set User Properties` node's whole implementation, and it needs no
   * per-backend field list because {@link normalizeUser} already put the identity
   * under `objectId`: the address is `objectId`, the body is whatever the project
   * put on the user. That is Desired State §3's "schema-driven dynamic ports"
   * holding for these two backends without either node knowing which backend it
   * is talking to.
   */
  setUserProperties(
    handle: BackendHandle,
    options: {
      username?: string;
      email?: string;
      properties?: Record<string, unknown>;
      success(response?: unknown): void;
      error(error?: string): void;
    }
  ): void {
    const profile = restAuthProfileFor(handle.type);
    if (!profile) {
      options.error(handle.type === 'supabase' ? SUPABASE_AUTH_UNSUPPORTED : notServed(handle.type));
      return;
    }

    const current = this.getCurrentUser(handle);
    if (!current || !current.objectId) {
      options.error('Nobody is signed in.');
      return;
    }

    const content: Record<string, unknown> = Object.assign({}, options.properties);
    if (options.email !== undefined) content.email = options.email;

    // Server-owned and read-only, on both. Sending them back is at best
    // redundant and at worst a 400 that looks like the write failed.
    //
    // Shared with the port generator so a port is never *offered* for something
    // this loop then throws away — see {@link REST_USER_READONLY_FIELDS}.
    for (const field of REST_USER_READONLY_FIELDS) {
      delete content[field];
    }

    const path =
      profile.type === 'directus'
        ? `/users/${encodeURIComponent(current.objectId)}`
        : `${this.path(profile, '/api/collections/{collection}/records')}/${encodeURIComponent(current.objectId)}`;

    this.authed(
      handle,
      { method: 'PATCH', path, body: content },
      {
        ok: (body) => {
          const merged = Object.assign({}, current, this.readUser(profile, body), content);
          this.setSession(handle, merged);
          options.success(body);
        },
        fail: (error) => options.error(error.error)
      }
    );
  }
}

/**
 * Where a REST backend's session lives.
 *
 * Keyed on the backend **id** so two Directus backends in one project are two
 * accounts, per the phase's "two backends have two sessions" decision, and
 * prefixed `NodeGX/` so it can never collide with `Parse/<appId>/currentUser` —
 * which is unchangeable, because it is what every deployed app has already
 * written into its users' browsers.
 */
export function restSessionKey(handle: BackendHandle): string {
  return 'NodeGX/' + (handle.id || handle.type) + '/session';
}
