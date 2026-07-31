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

export interface AuthSession {
  user: AuthUser;
  /** Opaque to callers. Its lifetime is described by `TokenLifecycle`. */
  sessionToken: string;
  /** Present only on `refresh`-lifecycle backends. */
  refreshToken?: string;
  /** Unix ms. Present only on `refresh`-lifecycle backends. */
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

export interface SignInWithProviderOptions extends Callbacks<(session: AuthSession) => void> {
  provider: string;
  /** Where to land after the provider redirects back. */
  redirect?: string;
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
  /** Nominal access-token lifetime in seconds, as the backend ships it. */
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
