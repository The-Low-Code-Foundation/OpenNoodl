/**
 * `IAuthAdapter` — the ten auth methods, and the token lifecycle that is not
 * a method.
 *
 * Transcribed from `noodl-viewer-react/src/nodes/std-library/user/userservice.ts`.
 * All ten are confirmed present at the lines named in BCN-001's prose contract.
 *
 * @module backend-contract/auth
 */

import type { BackendHandle } from './backends';
import type { Callbacks } from './data';

/** The signed-in user, as the User nodes consume it. */
export interface AuthUser {
  objectId?: string;
  username?: string;
  email?: string;
  emailVerified?: boolean;
  [property: string]: unknown;
}

/**
 * A signed-in session: the user's own fields, **flat**, with the tokens beside
 * them.
 *
 * ⚠️ **Corrected in BCN-006.** BCN-001 shaped this as an envelope,
 * `{user, sessionToken}`, and putting the first auth adapter behind the contract
 * is what showed that nothing produces or consumes that. Parse answers `/login`,
 * `/users` and `/users/me` with the user record and `sessionToken` *in* it;
 * `userservice.ts` stores that object verbatim under one key; `login.ts`,
 * `signup.ts`, `users.ts` and the `User` node all read user fields straight off
 * what `success` hands them. An envelope would have required changing every one
 * of those call sites in the one task whose safety argument is that none of them
 * move.
 *
 * It is also the right shape for the other four backends rather than a
 * concession to this one. Directus and Supabase answer with
 * `{access_token, refresh_token, user}`; their adapters flatten *towards* this,
 * which is the same direction `recordIdentity.ts` normalises records — the
 * Parse-family name wins, the better implementation comes from wherever it is
 * better.
 */
export interface AuthSession extends AuthUser {
  /**
   * Opaque to callers. Its lifetime is described by `TokenLifecycle`.
   *
   * Optional because a stored session can lack one — Parse's own storage has
   * always been able to hold a user object with no token, and BCN-002 pinned
   * that the wire sends the literal string `undefined` when it does.
   */
  sessionToken?: string;
  /** Present only on `refresh`-lifecycle backends. */
  refreshToken?: string;
  /**
   * Unix ms at which `sessionToken` stops being accepted.
   *
   * The **token is the authority**: when the backend states an expiry
   * (Directus's `expires`, Supabase's `expires_at`, a JWT `exp`) that is what
   * belongs here. `RefreshTokenLifecycle.accessTtlSeconds` is a fallback for
   * backends that state nothing, never an override — every one of these
   * backends lets an administrator change the TTL, so a declared value that won
   * would be wrong on exactly the instances configured deliberately.
   */
  expiresAt?: number;
}

export interface LogInOptions extends Callbacks<(session: AuthSession) => void> {
  username: string;
  password: string;
}

export type LogOutOptions = Callbacks<() => void>;

export interface SignUpOptions extends Callbacks<(session: AuthSession) => void> {
  username: string;
  password: string;
  email?: string;
  /**
   * Arbitrary user-profile fields, written alongside the credentials.
   *
   * Parse takes them in the same call because the user *is* a record in a
   * collection. Directus and Supabase split credentials from profile across two
   * tables, so their adapters must fan out — which means a signup can now half
   * succeed, leaving an account with no profile. That is why
   * `auth.signUpProperties` is its own capability key with a `degraded` state
   * rather than being assumed to work everywhere.
   */
  properties?: Record<string, unknown>;
}

export interface FetchCurrentUserOptions extends Callbacks<(user: AuthUser) => void> {
  sessionToken?: string;
}

export interface VerifyEmailOptions extends Callbacks<() => void> {
  username: string;
  token: string;
}

export interface SendEmailVerificationOptions extends Callbacks<() => void> {
  email: string;
}

export interface ResetPasswordOptions extends Callbacks<() => void> {
  username: string;
  token: string;
  newPassword: string;
}

export interface RequestPasswordResetOptions extends Callbacks<() => void> {
  email: string;
}

/**
 * ⚠️ **Corrected in BCN-006 — this one does not take `Callbacks`.**
 *
 * `signInWithProvider` *navigates the browser away*. Nothing after it runs, and
 * the result arrives on a later page load through the adapter's return leg. So
 * `success` is never called on a redirect-based provider, and requiring it —
 * which `Callbacks` does — would have made every call site declare a callback
 * that cannot fire. `signinwith.ts` passes only `error`, and passes it for the
 * two things that *can* fail before the navigation: no configured backend, and
 * no provider set.
 *
 * `success` stays declared, optional, because a backend that signs in through a
 * popup or a token exchange rather than a top-level redirect can honour it.
 */
export interface SignInWithProviderOptions {
  provider: string;
  /** Where to land after the provider redirects back. */
  redirect?: string;
  /** Never called when the sign-in is a top-level redirect. */
  success?: (session: AuthSession) => void;
  error?: (err?: string) => void;
}

export interface RequestMagicLinkOptions extends Callbacks<() => void> {
  email: string;
  redirect?: string;
}

export interface IAuthAdapter {
  logIn(handle: BackendHandle, options: LogInOptions): void;
  logOut(handle: BackendHandle, options: LogOutOptions): void;
  signUp(handle: BackendHandle, options: SignUpOptions): void;
  fetchCurrentUser(handle: BackendHandle, options: FetchCurrentUserOptions): void;
  verifyEmail(handle: BackendHandle, options: VerifyEmailOptions): void;
  sendEmailVerification(handle: BackendHandle, options: SendEmailVerificationOptions): void;
  resetPassword(handle: BackendHandle, options: ResetPasswordOptions): void;
  requestPasswordReset(handle: BackendHandle, options: RequestPasswordResetOptions): void;
  signInWithProvider(handle: BackendHandle, options: SignInWithProviderOptions): void;
  requestMagicLink(handle: BackendHandle, options: RequestMagicLinkOptions): void;
}

export const AUTH_ADAPTER_METHODS = Object.freeze([
  'logIn',
  'logOut',
  'signUp',
  'fetchCurrentUser',
  'verifyEmail',
  'sendEmailVerification',
  'resetPassword',
  'requestPasswordReset',
  'signInWithProvider',
  'requestMagicLink'
] as const) satisfies readonly (keyof IAuthAdapter)[];

// ── The session event surface ───────────────────────────────────────────────

/**
 * What an auth adapter announces about the session, in the vocabulary the
 * `User` node has always had.
 *
 * These four names are not new. `userservice.ts` has emitted them since long
 * before this contract, and `user.ts` wires three of them to real output ports
 * (`loggedIn`, `loggedOut`, `sessionLost`). They are written down here so that
 * five adapters announce the *same* four things rather than each inventing a
 * vocabulary, and so BCN-006's refresh machinery has a name for the one event
 * it needs to raise — a failed refresh is a `sessionLost`, which is a port a
 * builder can already wire.
 *
 * `sessionChanged` is the fifth and is the only one that is new. It is the
 * *storage* fact, not a user-facing event: "what is written under this
 * backend's session key is now this". `UserService` listens to it to keep its
 * `current` model in step, which is what lets the ten methods move into an
 * adapter without changing the order in which anything observable happens.
 */
export type AuthEventType =
  /** A password/OAuth sign-in completed. */
  | 'loggedIn'
  /** An explicit sign-out completed. */
  | 'loggedOut'
  /** A stored session was checked against the backend and is alive. */
  | 'sessionGained'
  /**
   * A session ended without the user asking: the backend rejected it, or a
   * refresh could not be completed before the access token expired.
   *
   * **A successful silent refresh raises nothing.** `sessionGained` is what
   * graphs wire re-fetches to, and firing it every access-token lifetime would
   * turn a project into one that re-queries its backend on a timer forever.
   */
  | 'sessionLost'
  /** The stored session changed. Bookkeeping, not a user-facing event. */
  | 'sessionChanged';

export type AuthEventHandler = (session?: AuthSession) => void;

export interface IAuthEvents {
  on(event: AuthEventType, handler: AuthEventHandler, context?: unknown): void;
  off(event: AuthEventType, handler?: AuthEventHandler, context?: unknown): void;
}

export const AUTH_EVENTS = Object.freeze([
  'loggedIn',
  'loggedOut',
  'sessionGained',
  'sessionLost',
  'sessionChanged'
] as const) satisfies readonly AuthEventType[];

// ── The eleventh member, which is not a method ──────────────────────────────

/**
 * How long a session lasts, declared per backend.
 *
 * There is no `refresh` method in the ten above, and its absence is not an
 * oversight — **Parse session tokens never expire.** The interface was
 * extracted from a codebase that has only ever spoken to Parse, so it has no
 * vocabulary for a token that dies. Every other backend issues a short-lived
 * access token with a refresh token beside it.
 *
 * This declaration exists in BCN-001 rather than being discovered in BCN-006
 * for one reason: BCN-006 is the only task in phase 34 with no precedent
 * anywhere in this repo. Refresh scheduling, single-flight (so ten simultaneous
 * requests do not trigger ten refreshes), and cross-tab coordination are new
 * machinery. Declaring the lifecycle here means that machinery gets built
 * **once**, driven by data, instead of three times inside three adapters that
 * will drift.
 */
export type TokenLifecycle = EternalTokenLifecycle | RefreshTokenLifecycle;

/** Parse and the built-in backend. The token is valid until logout. */
export interface EternalTokenLifecycle {
  kind: 'eternal';
}

/** Directus, Supabase, PocketBase. */
export interface RefreshTokenLifecycle {
  kind: 'refresh';
  /**
   * Nominal access-token lifetime in seconds, as the backend ships it.
   *
   * A **fallback**, used only when a session carries no `expiresAt` of its own.
   * See {@link AuthSession.expiresAt}.
   */
  accessTtlSeconds: number;
  /** Path, relative to the handle's URL. */
  refreshEndpoint: string;
  /**
   * Refresh this many seconds before expiry rather than on the 401.
   *
   * Reacting to a 401 means at least one user-visible request has already
   * failed, and on a slow connection the refresh itself may not land before the
   * retry. A margin turns a class of intermittent logout bugs into nothing.
   */
  refreshBeforeExpirySeconds: number;
}

/**
 * A lifecycle does not have to come from a descriptor.
 *
 * Richard's 2026-07-31 answer to "is `custom` really data-only?" made `custom` a
 * **declared** backend: the user fills in the capability table themselves in the
 * Backend Services panel, and the token lifecycle is part of what they declare.
 * The shape is the same either way — this is data, and the machinery that acts
 * on it neither knows nor cares which form filled it in.
 *
 * What differs is **trust**. A descriptor lifecycle was written against a
 * backend somebody probed; a declared one was typed into a form. So a declared
 * lifecycle is validated before it is armed, and an invalid one degrades to
 * `eternal` rather than refusing to connect — the rule `customDescriptor`
 * already states for its own default, because a refresh loop against an endpoint
 * that may not exist produces background 404s on every custom backend that never
 * needed one. The validator is
 * `noodl-runtime/src/api/backends/TokenLifecycle.ts::validateTokenLifecycle`;
 * it lives there rather than here because this package is types and frozen data.
 */
export type DeclaredTokenLifecycle = TokenLifecycle;
