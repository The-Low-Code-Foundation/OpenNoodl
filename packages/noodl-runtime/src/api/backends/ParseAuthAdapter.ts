/**
 * `ParseAuthAdapter` — the Parse auth wire, behind `IAuthAdapter`.
 *
 * This is `userservice.ts`'s body, moved and not rewritten, exactly the way
 * BCN-002 moved `CloudStore`'s. Every path, header, payload key and callback
 * order below is what the viewer did before BCN-006, **including the parts that
 * look like mistakes** — the seam is only proven if putting it in changes
 * nothing, and "changes nothing" is only testable if nothing was tidied on the
 * way through.
 *
 * ## What stayed behind in `userservice.ts`
 *
 * The `Model` glue and the singleton, for the same reason `cloudstore.js` kept
 * `_fromJSON`: `getUserModel()` needs `CloudStore._fromJSON`, `current` is a
 * `ModelLike` that eleven nodes read, and dragging the Model classes in behind
 * every backend is what the adapter layer exists to avoid. `UserService` is now
 * resolution + the model, and every one of the ten methods is a one-line
 * forward.
 *
 * ## How the ordering is preserved
 *
 * Each method used to do four things in one place: write storage, rebuild
 * `current`, call `success`, emit. Split across two objects, the order still has
 * to be identical, so the adapter emits `sessionChanged` **synchronously**
 * between the storage write and `success`, and `UserService` rebuilds `current`
 * in that handler. `EventEmitter` dispatch is synchronous, so the observable
 * sequence is byte-for-byte what it was.
 *
 * ## Preserved on purpose
 *
 * - **The session header is set whenever a stored session parses**, even when it
 *   has no `sessionToken` — which sends the literal string `undefined`. BCN-002
 *   preserved and pinned the same thing on the data wire; guarding it is a fix,
 *   and a fix here spends the only signal this task produces.
 * - **`fetchCurrentUser`'s 209 branch clears storage and emits `sessionLost`,
 *   but does *not* announce a session change** — so `UserService.current` stays
 *   pointing at the user who just turned out to be signed out. The `User` node
 *   clears its own model off `sessionLost`, so nothing visible depends on it.
 *   Faithfully preserved; a candidate for its own commit.
 * - **`verifyEmail` and `resetPassword` read their outcome out of an HTML page**,
 *   and both use `if (response.indexOf(…))` where the intended test was
 *   `!== -1`. A found-at-index-0 match reads as false and index -1 reads as
 *   true, so the second branch is effectively always taken. Ported verbatim.
 * - **`signUp` merges `options.properties` into the stored session** but sends
 *   them through the serialiser separately, so what is stored is the
 *   unserialised form. Pre-existing.
 *
 * @module api/backends/ParseAuthAdapter
 */

import type {
  AuthSession,
  BackendHandle,
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

import { AuthEvents } from './AuthEvents';
import { SessionStore, parseInstallationIdKey, parseSessionStore } from './SessionStore';
import { TokenLifecycleController } from './TokenLifecycle';

const guid = require('../../guid');

/** The query parameters BAK-004's sign-in flows come back with. Must match the backend's constants. */
const HANDOFF_PARAM = 'nodegx_auth';
const AUTH_ERROR_PARAM = 'nodegx_auth_error';

/**
 * What a failed request hands back: the backend's JSON body when there was one,
 * or a `{error, status}` object this file synthesises when there was not.
 */
export interface AuthRequestError {
  /** The human-readable message. Every public method forwards exactly this. */
  error?: string;
  /** Parse's error code. `209` is the one that matters here — invalid session token. */
  code?: number;
  /** HTTP status, present only on the synthesised form. */
  status?: number;
  [extra: string]: unknown;
}

export interface AuthRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  content?: unknown;
  /** Overrides the session token taken from the store. */
  sessionToken?: string;
  /**
   * The parsed JSON body, or the raw response text when the endpoint answers
   * with HTML — which two of Parse's do. Deliberately `any`: the callers below
   * both index it as an object and call `indexOf` on it as a string, and no one
   * type covers that honestly.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  success(response?: any): void;
  error(error?: AuthRequestError): void;
}

/**
 * The outcome of a provider / magic-link return, as the Sign In With node reads it.
 *
 * `inProgress` is the window between "this page load carries a sign-in code" and
 * "the exchange finished" — a node that mounts during it must show a spinner
 * rather than a failure.
 */
export interface OAuthReturnState {
  inProgress: boolean;
  /** Set once the exchange resolves. */
  succeeded?: boolean;
  error?: string;
  /** `created` | `signed-in` | `linked` | `linked-credentials-revoked`. */
  outcome?: string;
  /** A message worth showing the user — set when the linking rule revoked an old password. */
  notice?: string;
}

export interface ParseAuthAdapterOptions {
  /**
   * Turn user-profile fields into Parse wire JSON.
   *
   * Injected for the same reason `ParseWireAdapter`'s is: the conversion needs
   * the Noodl `Model` and `Collection` classes and the project's schema cache.
   */
  serializeObject: (data: Record<string, unknown>, collection: string) => Record<string, unknown>;
  /**
   * Overridable for tests, and for the day a backend keeps its session
   * somewhere other than `localStorage`.
   *
   * The default is `parseSessionStore`, which is **shared with the data wire**.
   * That is deliberate: BCN-006's traps list says that until `ParseWireAdapter`
   * and this class read the same thing, they are two opinions about who is
   * logged in.
   */
  createStore?: (appId: string | undefined) => SessionStore;
  /**
   * Declared per backend by BCN-001's descriptor. `eternal` for Parse and the
   * built-in backend, which is why nothing below ever schedules anything.
   */
  lifecycle?: TokenLifecycle;
}

export class ParseAuthAdapter extends AuthEvents implements IAuthAdapter {
  /** BAK-004: the state of a sign-in returning from a provider or a magic link. */
  oauthReturn: OAuthReturnState = { inProgress: false };

  private readonly serializeObject: ParseAuthAdapterOptions['serializeObject'];
  private readonly createStore: (appId: string | undefined) => SessionStore;
  private readonly lifecycle: TokenLifecycle;

  /**
   * One store and one controller per backend, keyed by application id.
   *
   * Per handle rather than per adapter because the contract's whole point is
   * that a project may have more than one backend, and two backends have two
   * sessions — the phase decided explicitly that they are never shared.
   */
  private readonly stores = new Map<string, SessionStore>();
  private readonly controllers = new Map<string, TokenLifecycleController>();

  constructor(options: ParseAuthAdapterOptions) {
    super();
    this.serializeObject = options.serializeObject;
    this.createStore = options.createStore || parseSessionStore;
    this.lifecycle = options.lifecycle || { kind: 'eternal' };
  }

  // ── Session storage ──────────────────────────────────────────────────────

  sessionStore(handle: BackendHandle): SessionStore {
    const appId = handle.publicToken;
    const cacheKey = String(appId);
    let store = this.stores.get(cacheKey);
    if (store === undefined) {
      store = this.createStore(appId);
      this.stores.set(cacheKey, store);
    }
    return store;
  }

  /**
   * The lifecycle controller for this backend.
   *
   * On Parse this is an `eternal` controller: it arms no timer, subscribes to no
   * storage events, and its gate is a synchronous pass-through. It is on the
   * request path anyway, so that BCN-004 adds a `performRefresh` rather than a
   * call site.
   */
  lifecycleController(handle: BackendHandle): TokenLifecycleController {
    const cacheKey = String(handle.publicToken);
    let controller = this.controllers.get(cacheKey);
    if (controller === undefined) {
      controller = new TokenLifecycleController({
        lifecycle: this.lifecycle,
        store: this.sessionStore(handle),
        onSessionLost: (reason) => {
          // The controller has already cleared the store; this is the
          // announcement, which is deliberately two events: `sessionChanged` is
          // the bookkeeping `UserService` needs, `sessionLost` is the port a
          // builder wired.
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

  /** The stored session, or `undefined`. Not a contract method. */
  getCurrentUser(handle: BackendHandle): AuthSession | undefined {
    return this.sessionStore(handle).read();
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

  // ── The wire ─────────────────────────────────────────────────────────────

  /**
   * The Parse auth seam. Moved from `userservice.ts:198` with one substitution:
   * `this.endpoint`/`this.appId` became `handle.url`/`handle.publicToken`.
   *
   * It is deliberately *not* `ParseWireAdapter._makeRequest`. The two differ in
   * three ways that all matter: this one sends `X-Parse-Installation-Id`, never
   * sends a master key, and hands its error callback Parse's `code` (the `209`
   * the session check turns on). Merging them would be a rewrite in a task
   * whose value is that nothing was rewritten.
   */
  _makeRequest(handle: BackendHandle, path: string, options: AuthRequestOptions): void {
    if (!handle.url) {
      if (options.error) {
        options.error({ error: 'No active cloud service', status: 0 });
      }
      return;
    }

    const store = this.sessionStore(handle);

    // The request gate. On an `eternal` lifecycle this calls back synchronously
    // and the whole function is what it always was; the branch exists so BCN-004
    // inherits a queueing request path rather than writing one.
    this.lifecycleController(handle).withSession((session) => {
      const xhr = new XMLHttpRequest();

      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          let json;
          try {
            json = JSON.parse(xhr.response);
          } catch (e) {
            // Not JSON. Leave `json` undefined and fall through to the raw response text.
          }

          if (xhr.status === 200 || xhr.status === 201) {
            options.success(json || xhr.response);
          } else options.error(json || { error: xhr.responseText, status: xhr.status });
        }
      };

      xhr.open(options.method || 'GET', handle.url + path, true);

      xhr.setRequestHeader('X-Parse-Application-Id', handle.publicToken);

      // Installation Id
      const iidKey = parseInstallationIdKey(handle.publicToken);
      let _iid = store.readKey(iidKey);
      if (_iid === undefined) {
        _iid = guid();
        store.writeKey(iidKey, _iid);
      }
      xhr.setRequestHeader('X-Parse-Installation-Id', _iid);

      // Check for current users
      if (options.sessionToken) xhr.setRequestHeader('X-Parse-Session-Token', options.sessionToken);
      else if (session !== undefined) {
        // Set even when the stored session has no token — see the module note.
        xhr.setRequestHeader('X-Parse-Session-Token', session.sessionToken);
      }

      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(JSON.stringify(options.content));
    });
  }

  // ── The ten ──────────────────────────────────────────────────────────────

  logIn(handle: BackendHandle, options: LogInOptions): void {
    this._makeRequest(handle, '/login', {
      method: 'POST',
      content: {
        username: options.username,
        password: options.password,
        _method: 'GET'
      },
      success: (response) => {
        this.setSession(handle, response);
        options.success(response);
        this.emitAuthEvent('loggedIn', response);
      },
      error: (e) => {
        options.error(e.error);
      }
    });
  }

  logOut(handle: BackendHandle, options: LogOutOptions): void {
    this._makeRequest(handle, '/logout', {
      method: 'POST',
      content: {},
      success: () => {
        this.clearSession(handle);
        options.success();
        this.emitAuthEvent('loggedOut');
      },
      error: (e) => {
        options.error(e.error);
      }
    });
  }

  signUp(handle: BackendHandle, options: SignUpOptions): void {
    //make a shallow copy to feed through the serialiser, which will modify the object
    const additionalUserProps = options.properties ? this.serializeObject({ ...options.properties }, '_User') : {};

    this._makeRequest(handle, '/users', {
      method: 'POST',
      content: Object.assign({}, additionalUserProps, {
        username: options.username,
        password: options.password,
        email: options.email
      }),
      success: (response) => {
        const _cu = Object.assign(response, { username: options.username }, options.properties);
        this.setSession(handle, _cu);
        options.success(response);
        this.emitAuthEvent('loggedIn', _cu);
      },
      error: (e) => {
        options.error(e.error);
      }
    });
  }

  fetchCurrentUser(handle: BackendHandle, options: FetchCurrentUserOptions): void {
    this._makeRequest(handle, '/users/me', {
      method: 'GET',
      sessionToken: options.sessionToken,
      success: (response) => {
        this.setSession(handle, response);
        this.emitAuthEvent('sessionGained', response);
        options.success(response);
      },
      error: (e) => {
        // 209 is Parse's "invalid session token".
        if (e.code === 209) {
          // Storage is cleared but no `sessionChanged` is announced, so
          // `UserService.current` keeps pointing at the user who has just turned
          // out to be signed out. Preserved from `userservice.ts:369`; see the
          // module note.
          this.sessionStore(handle).clear();
          this.emitAuthEvent('sessionLost');
        }
        options.error(e.error);
      }
    });
  }

  verifyEmail(handle: BackendHandle, options: VerifyEmailOptions): void {
    this._makeRequest(
      handle,
      '/apps/' + handle.publicToken + '/verify_email?username=' + options.username + '&token=' + options.token,
      {
        method: 'GET',
        // This endpoint answers with an HTML page rather than JSON, so the outcome has to be
        // read out of the page's text.
        success: (response: string) => {
          if (response.indexOf('Successfully verified your email') !== -1) {
            options.success();
          } else if (response.indexOf('Invalid Verification Link')) {
            options.error('Invalid verification token');
          } else {
            options.error('Failed to verify email');
          }
        },
        error: (e) => {
          options.error(e.error);
        }
      }
    );
  }

  sendEmailVerification(handle: BackendHandle, options: SendEmailVerificationOptions): void {
    this._makeRequest(handle, '/verificationEmailRequest', {
      method: 'POST',
      content: { email: options.email },
      success: () => {
        options.success();
      },
      error: (e) => {
        options.error(e.error);
      }
    });
  }

  resetPassword(handle: BackendHandle, options: ResetPasswordOptions): void {
    this._makeRequest(handle, '/apps/' + handle.publicToken + '/request_password_reset', {
      method: 'POST',
      content: {
        username: options.username,
        token: options.token,
        new_password: options.newPassword
      },
      success: (response: string) => {
        if (
          response.indexOf('Password successfully reset') !== -1 ||
          response.indexOf('Successfully updated your password') !== -1
        ) {
          options.success();
        } else if (response.indexOf('Invalid Link')) {
          options.error('Invalid verification token');
        } else {
          options.error('Failed to verify email');
        }
      },
      error: (e) => {
        options.error(e.error);
      }
    });
  }

  requestPasswordReset(handle: BackendHandle, options: RequestPasswordResetOptions): void {
    this._makeRequest(handle, '/requestPasswordReset', {
      method: 'POST',
      content: { email: options.email },
      success: () => {
        options.success();
      },
      error: (e) => {
        options.error(e.error);
      }
    });
  }

  /**
   * Send the browser to a provider. This NAVIGATES AWAY: nothing after it runs,
   * and the result arrives on a later page load through {@link consumeAuthReturn}.
   *
   * `redirect` defaults to the current page (minus any leftover sign-in
   * parameters), so the user comes back where they were. The backend refuses
   * any target that is neither same-origin nor on its `redirectAllowList` — if
   * sign-in dead-ends with "origin not allowed", that list is the fix.
   */
  signInWithProvider(handle: BackendHandle, options: SignInWithProviderOptions): void {
    if (!handle.url) {
      if (options.error) options.error('No active cloud service');
      return;
    }
    if (!options.provider) {
      if (options.error) options.error('Sign In With: no provider was set.');
      return;
    }
    const redirect = options.redirect || this._currentUrlWithoutAuthParams();
    const url =
      `${handle.url}/oauth/${encodeURIComponent(options.provider)}/start` +
      `?redirect=${encodeURIComponent(redirect)}`;
    window.location.href = url;
  }

  /**
   * Ask the backend to email a one-click sign-in link.
   *
   * Succeeds identically for a known and an unknown address — the endpoint is
   * anonymous and anti-enumerating by design, so "success" here means "the
   * request was accepted", never "an account exists". The node's help text says
   * so, because a UI that claims "check your inbox" only for real accounts
   * re-creates the oracle the endpoint removed.
   */
  requestMagicLink(handle: BackendHandle, options: RequestMagicLinkOptions): void {
    this._makeRequest(handle, '/auth/magic-link', {
      method: 'POST',
      content: { email: options.email, redirect: options.redirect || this._currentUrlWithoutAuthParams() },
      success: () => options.success(),
      error: (e) => options.error(e.error)
    });
  }

  // ── Not contract, and deliberately so ────────────────────────────────────

  /**
   * Write user-profile fields onto the signed-in user.
   *
   * Not one of the ten. It is the `Set User Properties` node's whole
   * implementation, and BCN-006's Desired State §3 makes it schema-driven across
   * five backends — which is step 6, not this pass. It moves with the wire
   * because leaving it behind would have left a second `_makeRequest` in
   * `userservice.ts`, and the entire claim of this move is that there is one.
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
    const _cu = this.getCurrentUser(handle);
    if (_cu !== undefined) {
      //make a shallow copy to feed through the serialiser, which will modify the object
      const propsToSave = this.serializeObject({ ...options.properties }, '_User');

      const _content: Record<string, unknown> = Object.assign(
        {},
        { email: options.email, username: options.username },
        propsToSave
      );

      delete _content.emailVerified; // Remove props you cannot set
      delete _content.createdAt;
      delete _content.updatedAt;
      //delete _content.username;

      this._makeRequest(handle, '/users/' + _cu.objectId, {
        method: 'PUT',
        content: _content,
        success: (response) => {
          Object.assign(_cu, _content);
          this.setSession(handle, _cu);
          options.success(response);
        },
        error: (e) => {
          options.error(e.error);
        }
      });
    }
  }

  /** The sign-in methods this backend offers — for rendering a set of buttons. */
  listAuthProviders(
    handle: BackendHandle,
    options: {
      success(response?: { providers: { id: string; displayName: string }[]; magicLink: { enabled: boolean } }): void;
      error(error?: string): void;
    }
  ): void {
    this._makeRequest(handle, '/auth/providers', {
      method: 'GET',
      success: (response) => options.success(response),
      error: (e) => options.error(e.error)
    });
  }

  // ── BAK-004 — the provider return leg ────────────────────────────────────

  /**
   * Look for a sign-in result in the current URL and act on it.
   *
   * Returns true when this page load IS a sign-in return, so the caller can skip
   * its ordinary stale-session validation.
   *
   * **Per backend, not contract.** BCN-006 step 5 is four different redirect
   * shapes — Parse `authData`, Directus SSO, Supabase, PocketBase
   * `auth-with-oauth2` — and this is the first of the four. What they have in
   * common is only the *outcome*: a session, established. That is where the
   * contract's surface is, and it is `signInWithProvider` plus a `loggedIn`.
   */
  consumeAuthReturn(handle: BackendHandle): boolean {
    if (typeof window === 'undefined' || !window.location) return false;

    let params: URLSearchParams;
    try {
      params = new URLSearchParams(window.location.search);
    } catch (e) {
      return false;
    }
    const code = params.get(HANDOFF_PARAM);
    const error = params.get(AUTH_ERROR_PARAM);
    if (!code && !error) return false;

    // Strip BEFORE doing anything else. A one-time code left in the address bar
    // survives into history and into anything the user copies; a refresh would
    // also re-attempt a code that is already spent, producing a spurious
    // failure on a sign-in that actually worked.
    params.delete(HANDOFF_PARAM);
    params.delete(AUTH_ERROR_PARAM);
    this._stripAuthParamsFromUrl(params);

    if (error) {
      this.oauthReturn = { inProgress: false, succeeded: false, error };
      // Deferred so a listener attached during this same tick still hears it.
      setTimeout(() => this.emitAuthEvent('oauthReturn', this.oauthReturn), 0);
      return true;
    }

    this.oauthReturn = { inProgress: true };
    this._makeRequest(handle, '/oauth/exchange', {
      method: 'POST',
      content: { code },
      success: (response) => {
        this.setSession(handle, response);
        this.oauthReturn = {
          inProgress: false,
          succeeded: true,
          outcome: response.authOutcome,
          notice: response.authNotice || undefined
        };
        this.emitAuthEvent('oauthReturn', this.oauthReturn);
        this.emitAuthEvent('loggedIn', response);
      },
      error: (e) => {
        this.oauthReturn = {
          inProgress: false,
          succeeded: false,
          error: (e && e.error) || 'Sign-in could not be completed.'
        };
        this.emitAuthEvent('oauthReturn', this.oauthReturn);
      }
    });
    return true;
  }

  /** Rewrite the address bar without the sign-in parameters, keeping everything else. */
  _stripAuthParamsFromUrl(remaining: URLSearchParams): void {
    if (!window.history || typeof window.history.replaceState !== 'function') return;
    const query = remaining.toString();
    const cleaned = window.location.pathname + (query ? `?${query}` : '') + window.location.hash;
    try {
      window.history.replaceState(window.history.state, '', cleaned);
    } catch (e) {
      // A sandboxed iframe can refuse replaceState. Not fatal: the exchange
      // still runs, the code is still single-use, and the only cost is an ugly
      // URL — so this must not abort the sign-in.
    }
  }

  _currentUrlWithoutAuthParams(): string {
    const url = new URL(window.location.href);
    url.searchParams.delete(HANDOFF_PARAM);
    url.searchParams.delete(AUTH_ERROR_PARAM);
    return url.toString();
  }
}
