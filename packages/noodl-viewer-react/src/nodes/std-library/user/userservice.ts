import { EventEmitter } from 'events';
import NoodlRuntime from '@noodl/runtime';
import CloudStore from '@noodl/runtime/src/api/cloudstore';

import guid from '../../../guid';

/**
 * A Parse `_User` record as the backend returns it. Only `objectId` and `sessionToken` are
 * relied on by name; everything else is whatever the project's `_User` schema declares.
 */
export interface ParseUser {
  objectId: string;
  sessionToken?: string;
  username?: string;
  email?: string;
  emailVerified?: boolean;
  createdAt?: string;
  updatedAt?: string;
  [property: string]: unknown;
}

/**
 * The shape every method here takes.
 *
 * `error` receives a message *string*, never an error object. Every method unwraps the
 * backend's `{ error, code }` response and passes `error` on, and the two endpoints that
 * answer with HTML rather than JSON substitute a message of their own. That is why the user
 * nodes can wire it straight to a `string` output port.
 */
export interface UserServiceCallbacks<TSuccess = unknown> {
  success(response?: TSuccess): void;
  error(error?: string): void;
}

/**
 * What a failed request hands back: the backend's JSON body when there was one, or a
 * `{ error, status }` object this file synthesises when there was not.
 */
interface RequestError {
  /** The human-readable message. Every public method forwards exactly this. */
  error?: string;
  /** Parse's error code. `209` is the one that matters here — invalid session token. */
  code?: number;
  /** HTTP status, present only on the synthesised form. */
  status?: number;
  [extra: string]: unknown;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  content?: unknown;
  /** Overrides the session token taken from local storage. */
  sessionToken?: string;
  /**
   * The parsed JSON body, or the raw response text when the endpoint answers with HTML —
   * which two of Parse's do. Deliberately `any`: the callers below both index it as an
   * object and call `indexOf` on it as a string, and no one type covers that honestly.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  success(response?: any): void;
  error(error?: RequestError): void;
}

/** The query parameters BAK-004's sign-in flows come back with. Must match the backend's constants. */
const HANDOFF_PARAM = 'nodegx_auth';
const AUTH_ERROR_PARAM = 'nodegx_auth_error';

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

/**
 * The viewer's user session: log in, sign up, and the current user's record.
 *
 * It talks to Parse's REST API directly rather than through `CloudStore`, because the
 * session endpoints are not object endpoints. `CloudStore` is still used for the two
 * serialisation steps that must match what the rest of the runtime writes.
 *
 * The session lives in `localStorage` under `Parse/<appId>/currentUser`, which is why every
 * method rewrites that key on success and why the constructor validates it on startup —
 * a token that the backend has since invalidated would otherwise look like a live session
 * forever. The `sessionLost` event is how nodes hear that it was not.
 *
 * ## The BAK-004 return leg
 *
 * A provider sign-in leaves the app entirely and comes back to a fresh page load
 * carrying `?nodegx_auth=<one-time code>`. Picking that up is done HERE, in the
 * constructor, rather than by a node, for two reasons: it must happen before the
 * stale-session check below (otherwise a page load with a brand-new sign-in also
 * fires `sessionLost`), and it must happen on every page of the app, whether or
 * not the graph on that page happens to contain a sign-in node.
 *
 * The code is stripped from the URL with `history.replaceState` BEFORE the
 * exchange is attempted, so it never survives into history, a bookmark, or a
 * screenshot — and so a refresh does not retry a code that is already spent.
 */
class UserService {
  /** Set from project metadata at construction; absent when no cloud service is configured. */
  appId: string;
  endpoint: string;
  /** `loggedIn`, `loggedOut`, `sessionGained`, `sessionLost`. */
  events: EventEmitter;
  /** The current user as a `CloudStore` object, or absent when signed out. */
  current: unknown;

  /** Lazily constructed. Reading this is what creates the service. */
  static readonly instance: UserService;
  /**
   * Present so the runtime's own user nodes can ask for a scope-specific service. The
   * cloud runtime gives each request its own; the viewer has only ever had one, so this
   * ignores the scope and returns {@link instance}.
   */
  static forScope: (modelScope: unknown) => UserService;

  /** BAK-004: the state of a sign-in returning from a provider or a magic link. */
  oauthReturn: OAuthReturnState = { inProgress: false };

  constructor() {
    this._initCloudServices();

    this.events = new EventEmitter();
    this.events.setMaxListeners(100000);

    // BAK-004 return leg FIRST: a page load carrying a sign-in code is not a
    // page load with a stale session, and running the check below first would
    // fire `sessionLost` at the exact moment the user successfully signed in.
    if (this._consumeAuthReturn()) return;

    // Check for current user session, and validate if it exists
    const currentUser = this.getUserFromLocalStorage();

    if (currentUser) {
      this.current = this.getUserModel();
      this.fetchCurrentUser({
        success: () => {},
        error: () => {
          // The session is nolonger valid
          delete localStorage['Parse/' + this.appId + '/currentUser'];
          delete this.current;
          this.events.emit('sessionLost');
        }
      });
    }
  }

  getUserFromLocalStorage(): ParseUser | undefined {
    const currentUser = localStorage['Parse/' + this.appId + '/currentUser'];
    if (currentUser) {
      try {
        return JSON.parse(currentUser);
      } catch (e) {
        //do nothing
      }
    }
    return undefined;
  }

  _initCloudServices(): void {
    const cloudServices = NoodlRuntime.instance.getMetaData('cloudservices');

    if (cloudServices) {
      this.appId = cloudServices.appId;
      this.endpoint = cloudServices.endpoint;
    }
  }

  /** Subscribe to `loggedIn` / `loggedOut` / `sessionGained` / `sessionLost`. */
  on(eventName: string, listener: (...args: unknown[]) => void): void {
    this.events.on(eventName, listener);
  }

  off(eventName: string, listener: (...args: unknown[]) => void): void {
    this.events.off(eventName, listener);
  }

  _makeRequest(path: string, options: RequestOptions): void {
    if (!this.endpoint) {
      if (options.error) {
        options.error({ error: 'No active cloud service', status: 0 });
      }
      return;
    }

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

    xhr.open(options.method || 'GET', this.endpoint + path, true);

    xhr.setRequestHeader('X-Parse-Application-Id', this.appId);

    // Installation Id
    let _iid = localStorage['Parse/' + this.appId + '/installationId'];
    if (_iid === undefined) {
      _iid = localStorage['Parse/' + this.appId + '/installationId'] = guid();
    }
    xhr.setRequestHeader('X-Parse-Installation-Id', _iid);

    // Check for current users
    if (options.sessionToken) xhr.setRequestHeader('X-Parse-Session-Token', options.sessionToken);
    else {
      const currentUser = this.getUserFromLocalStorage();
      if (currentUser !== undefined) {
        xhr.setRequestHeader('X-Parse-Session-Token', currentUser.sessionToken);
      }
    }

    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(JSON.stringify(options.content));
  }

  logIn(options: UserServiceCallbacks<ParseUser> & { username: string; password: string }): void {
    this._makeRequest('/login', {
      method: 'POST',
      content: {
        username: options.username,
        password: options.password,
        _method: 'GET'
      },
      success: (response) => {
        // Store current user
        localStorage['Parse/' + this.appId + '/currentUser'] = JSON.stringify(response);
        this.current = this.getUserModel(); // Make sure the user model is updated
        options.success(response);
        this.events.emit('loggedIn');
      },
      error: (e) => {
        options.error(e.error);
      }
    });
  }

  logOut(options: UserServiceCallbacks): void {
    this._makeRequest('/logout', {
      method: 'POST',
      content: {},
      success: () => {
        // Store current user
        delete localStorage['Parse/' + this.appId + '/currentUser'];
        delete this.current;
        options.success();
        this.events.emit('loggedOut');
      },
      error: (e) => {
        options.error(e.error);
      }
    });
  }

  signUp(
    options: UserServiceCallbacks<ParseUser> & {
      username: string;
      password: string;
      email?: string;
      /** Extra `_User` columns, as the Sign Up node's `prop-…` inputs collected them. */
      properties?: Record<string, unknown>;
    }
  ): void {
    //make a shallow copy to feed through CloudStore._serializeObject, which will modify the object
    const additionalUserProps = options.properties
      ? CloudStore._serializeObject({ ...options.properties }, '_User')
      : {};

    this._makeRequest('/users', {
      method: 'POST',
      content: Object.assign({}, additionalUserProps, {
        username: options.username,
        password: options.password,
        email: options.email
      }),
      success: (response) => {
        // Store current user
        const _cu = Object.assign(response, { username: options.username }, options.properties);
        localStorage['Parse/' + this.appId + '/currentUser'] = JSON.stringify(_cu);
        this.current = this.getUserModel(); // Make sure the user model is updated
        options.success(response);
        this.events.emit('loggedIn');
      },
      error: (e) => {
        options.error(e.error);
      }
    });
  }

  setUserProperties(
    options: UserServiceCallbacks<ParseUser> & {
      username?: string;
      email?: string;
      properties?: Record<string, unknown>;
    }
  ): void {
    const _cu = this.getCurrentUser();
    if (_cu !== undefined) {
      //make a shallow copy to feed through CloudStore._serializeObject, which will modify the object
      const propsToSave = CloudStore._serializeObject({ ...options.properties }, '_User');

      const _content = Object.assign({}, { email: options.email, username: options.username }, propsToSave);

      delete _content.emailVerified; // Remove props you cannot set
      delete _content.createdAt;
      delete _content.updatedAt;
      //delete _content.username;

      this._makeRequest('/users/' + _cu.objectId, {
        method: 'PUT',
        content: _content,
        success: (response) => {
          // Store current user
          Object.assign(_cu, _content);
          localStorage['Parse/' + this.appId + '/currentUser'] = JSON.stringify(_cu);
          this.current = this.getUserModel(); // Make sure the user model is updated
          options.success(response);
        },
        error: (e) => {
          options.error(e.error);
        }
      });
    }
  }

  fetchCurrentUser(options: UserServiceCallbacks<ParseUser> & { sessionToken?: string }): void {
    this._makeRequest('/users/me', {
      method: 'GET',
      sessionToken: options.sessionToken,
      success: (response) => {
        // Store current user
        localStorage['Parse/' + this.appId + '/currentUser'] = JSON.stringify(response);
        this.current = this.getUserModel(); // Make sure the user model is updated
        this.events.emit('sessionGained');
        options.success(response);
      },
      error: (e) => {
        // 209 is Parse's "invalid session token".
        if (e.code === 209) {
          delete localStorage['Parse/' + this.appId + '/currentUser'];
          this.events.emit('sessionLost');
        }
        options.error(e.error);
      }
    });
  }

  verifyEmail(options: UserServiceCallbacks & { username: string; token: string }): void {
    this._makeRequest(
      '/apps/' + this.appId + '/verify_email?username=' + options.username + '&token=' + options.token,
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

  sendEmailVerification(options: UserServiceCallbacks & { email: string }): void {
    this._makeRequest('/verificationEmailRequest', {
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

  resetPassword(options: UserServiceCallbacks & { username: string; token: string; newPassword: string }): void {
    this._makeRequest('/apps/' + this.appId + '/request_password_reset', {
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

  requestPasswordReset(options: UserServiceCallbacks & { email: string }): void {
    this._makeRequest('/requestPasswordReset', {
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

  // ==========================================================================
  // BAK-004 — OAuth / passwordless sign-in
  // ==========================================================================

  /**
   * Look for a sign-in result in the current URL and act on it.
   *
   * Returns true when this page load IS a sign-in return, so the constructor
   * can skip its ordinary stale-session validation.
   */
  _consumeAuthReturn(): boolean {
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
      setTimeout(() => this.events.emit('oauthReturn', this.oauthReturn), 0);
      return true;
    }

    this.oauthReturn = { inProgress: true };
    this._makeRequest('/oauth/exchange', {
      method: 'POST',
      content: { code },
      success: (response) => {
        localStorage['Parse/' + this.appId + '/currentUser'] = JSON.stringify(response);
        this.current = this.getUserModel();
        this.oauthReturn = {
          inProgress: false,
          succeeded: true,
          outcome: response.authOutcome,
          notice: response.authNotice || undefined
        };
        this.events.emit('oauthReturn', this.oauthReturn);
        this.events.emit('loggedIn');
      },
      error: (e) => {
        this.oauthReturn = {
          inProgress: false,
          succeeded: false,
          error: (e && e.error) || 'Sign-in could not be completed.'
        };
        this.events.emit('oauthReturn', this.oauthReturn);
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

  /**
   * Send the browser to a provider. This NAVIGATES AWAY: nothing after it runs,
   * and the result arrives on a later page load through `_consumeAuthReturn`.
   *
   * `redirect` defaults to the current page (minus any leftover sign-in
   * parameters), so the user comes back where they were. The backend refuses
   * any target that is neither same-origin nor on its `redirectAllowList` — if
   * sign-in dead-ends with "origin not allowed", that list is the fix.
   */
  signInWithProvider(options: { provider: string; redirect?: string; error?(message: string): void }): void {
    if (!this.endpoint) {
      if (options.error) options.error('No active cloud service');
      return;
    }
    if (!options.provider) {
      if (options.error) options.error('Sign In With: no provider was set.');
      return;
    }
    const redirect = options.redirect || this._currentUrlWithoutAuthParams();
    const url =
      `${this.endpoint}/oauth/${encodeURIComponent(options.provider)}/start` +
      `?redirect=${encodeURIComponent(redirect)}`;
    window.location.href = url;
  }

  _currentUrlWithoutAuthParams(): string {
    const url = new URL(window.location.href);
    url.searchParams.delete(HANDOFF_PARAM);
    url.searchParams.delete(AUTH_ERROR_PARAM);
    return url.toString();
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
  requestMagicLink(options: UserServiceCallbacks & { email: string; redirect?: string }): void {
    this._makeRequest('/auth/magic-link', {
      method: 'POST',
      content: { email: options.email, redirect: options.redirect || this._currentUrlWithoutAuthParams() },
      success: () => options.success(),
      error: (e) => options.error(e.error)
    });
  }

  /** The sign-in methods this backend offers — for rendering a set of buttons. */
  listAuthProviders(
    options: UserServiceCallbacks<{ providers: { id: string; displayName: string }[]; magicLink: { enabled: boolean } }>
  ): void {
    this._makeRequest('/auth/providers', {
      method: 'GET',
      success: (response) => options.success(response),
      error: (e) => options.error(e.error)
    });
  }

  getCurrentUser(): ParseUser | undefined {
    const _cu = localStorage['Parse/' + this.appId + '/currentUser'];
    if (_cu !== undefined) return JSON.parse(_cu);
  }

  getUserModel(): unknown {
    const _cu = this.getCurrentUser();
    if (_cu !== undefined) {
      delete _cu.sessionToken;
      delete _cu.ACL;
      delete _cu.className;
      delete _cu.__type;
      return CloudStore._fromJSON(_cu, '_User');
    }
  }
}

UserService.forScope = () => {
  // On the viewer, always return main scope
  return UserService.instance;
};

let _instance: UserService;
Object.defineProperty(UserService, 'instance', {
  get: function () {
    if (_instance === undefined) _instance = new UserService();
    return _instance;
  }
});

NoodlRuntime.Services.UserService = UserService;

export default UserService;
