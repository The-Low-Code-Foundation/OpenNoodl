import type { ModelLike } from '@noodl/types';

import { EventEmitter } from 'events';
import NoodlRuntime from '@noodl/runtime';
import { ParseAuthAdapter } from '@noodl/runtime/src/api/backends/ParseAuthAdapter';
import type { OAuthReturnState } from '@noodl/runtime/src/api/backends/ParseAuthAdapter';
import type { BackendHandle } from '@noodl/backend-contract';
import CloudStore from '@noodl/runtime/src/api/cloudstore';

export type { OAuthReturnState };

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
 * The viewer's user session: log in, sign up, and the current user's record.
 *
 * **The wire moved out.** BCN-006 put the ten auth methods behind `IAuthAdapter` as
 * [`ParseAuthAdapter`](../../../../../noodl-runtime/src/api/backends/ParseAuthAdapter.ts),
 * the way BCN-002 moved `CloudStore`'s fourteen. What is left here is the two jobs that
 * are not the wire's:
 *
 * 1. **Resolution.** Every adapter method takes a resolved `BackendHandle`; {@link _handle}
 *    is what produces one. Today that is "whatever `cloudservices` metadata says", which is
 *    the singleton the viewer has always had.
 * 2. **The `Model` glue.** `current` is a `ModelLike` that eleven nodes read, and building
 *    it needs `CloudStore._fromJSON`. Dragging the Model classes in behind every backend is
 *    exactly what the adapter layer exists to avoid.
 *
 * The class keeps its old *shape* deliberately — `logIn(options)`, not
 * `logIn(handle, options)` — so no node call site changed. Nothing about "no observable
 * behaviour change" would be provable if the callers moved at the same time as the
 * implementation.
 *
 * ## How the ordering survived the split
 *
 * Each method used to do four things in one place: write the session, rebuild `current`,
 * call `success`, emit. The adapter now raises `sessionChanged` synchronously between the
 * write and `success`, and the bridge below rebuilds `current` in that handler — so the
 * observable sequence is what it was, because `EventEmitter` dispatch is synchronous.
 *
 * ## The BAK-004 return leg
 *
 * A provider sign-in leaves the app entirely and comes back to a fresh page load
 * carrying `?nodegx_auth=<one-time code>`. Picking that up is done HERE, in the
 * constructor, rather than by a node, for two reasons: it must happen before the
 * stale-session check below (otherwise a page load with a brand-new sign-in also
 * fires `sessionLost`), and it must happen on every page of the app, whether or
 * not the graph on that page happens to contain a sign-in node. The URL handling
 * itself is the adapter's, because four backends have four redirect shapes.
 */
class UserService {
  /** Set from project metadata at construction; absent when no cloud service is configured. */
  appId: string;
  endpoint: string;
  /** `loggedIn`, `loggedOut`, `sessionGained`, `sessionLost`, `oauthReturn`. */
  events: EventEmitter;
  /**
   * The current user as a `CloudStore` object, or absent when signed out.
   *
   * `ModelLike` rather than `unknown` since PLAT-006: `getUserModel` returns whatever
   * `CloudStore._fromJSON` produced, and that function now declares its return type.
   * The cloud runtime's Request node reads `.getId()` off this.
   */
  current?: ModelLike;

  /** Lazily constructed. Reading this is what creates the service. */
  static readonly instance: UserService;
  /**
   * Present so the runtime's own user nodes can ask for a scope-specific service. The
   * cloud runtime gives each request its own; the viewer has only ever had one, so this
   * ignores the scope and returns {@link instance}.
   */
  static forScope: (modelScope: unknown) => UserService;

  /** The ten methods, and the session. */
  readonly adapter: ParseAuthAdapter;

  constructor() {
    this._initCloudServices();

    this.events = new EventEmitter();
    this.events.setMaxListeners(100000);

    this.adapter = new ParseAuthAdapter({
      // The module-scope serialiser, exactly as before — `_User` properties have
      // always been serialised against the process-wide Model store.
      serializeObject: (data, collectionName) => CloudStore._serializeObject(data, collectionName)
    });

    // The bridge. `sessionChanged` is bookkeeping — it is what keeps `current` in
    // step — and the four below are the events nodes have always subscribed to,
    // re-raised with no payload because that is how they were raised before.
    this.adapter.on('sessionChanged', () => {
      if (this.adapter.getCurrentUser(this._handle()) === undefined) delete this.current;
      else this.current = this.getUserModel();
    });
    this.adapter.on('loggedIn', () => this.events.emit('loggedIn'));
    this.adapter.on('loggedOut', () => this.events.emit('loggedOut'));
    this.adapter.on('sessionGained', () => this.events.emit('sessionGained'));
    this.adapter.on('sessionLost', () => this.events.emit('sessionLost'));
    this.adapter.events.on('oauthReturn', (state: unknown) => this.events.emit('oauthReturn', state));

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
          // The session is nolonger valid.
          //
          // On a Parse `209` the adapter has already cleared the session and
          // emitted `sessionLost`, so this fires it a second time. Pre-existing
          // and preserved: `user.ts` handles the event idempotently, and
          // "fix the double emit" is a behaviour change that would spend the
          // only signal this move produces.
          this.adapter.sessionStore(this._handle()).clear();
          delete this.current;
          this.events.emit('sessionLost');
        }
      });
    }
  }

  /**
   * The resolved backend the adapter is handed, built fresh on every call.
   *
   * Fresh because `_initCloudServices()` can re-run and a captured handle would go
   * stale the moment it did. `type: 'nodegx'` is an assumption and is marked as one,
   * for the same reason `cloudstore.js::_handle` marks it: this class cannot tell our
   * backend from an upstream Parse Server, which is exactly why BCN-001 gave them
   * separate descriptor columns.
   */
  _handle(): BackendHandle {
    return {
      id: '_active_',
      type: 'nodegx',
      name: 'Built-in',
      url: this.endpoint,
      publicToken: this.appId
    };
  }

  /** BAK-004: the state of a sign-in returning from a provider or a magic link. */
  get oauthReturn(): OAuthReturnState {
    return this.adapter.oauthReturn;
  }

  getUserFromLocalStorage(): ParseUser | undefined {
    return this.adapter.getCurrentUser(this._handle()) as ParseUser | undefined;
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

  /** Kept so the handle-binding is the only difference from the old signature. */
  _makeRequest(path: string, options: Parameters<ParseAuthAdapter['_makeRequest']>[2]): void {
    this.adapter._makeRequest(this._handle(), path, options);
  }

  // ── The ten, each binding the resolved handle ────────────────────────────

  logIn(options: UserServiceCallbacks<ParseUser> & { username: string; password: string }): void {
    this.adapter.logIn(this._handle(), options);
  }

  logOut(options: UserServiceCallbacks): void {
    this.adapter.logOut(this._handle(), options);
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
    this.adapter.signUp(this._handle(), options);
  }

  fetchCurrentUser(options: UserServiceCallbacks<ParseUser> & { sessionToken?: string }): void {
    this.adapter.fetchCurrentUser(this._handle(), options);
  }

  verifyEmail(options: UserServiceCallbacks & { username: string; token: string }): void {
    this.adapter.verifyEmail(this._handle(), options);
  }

  sendEmailVerification(options: UserServiceCallbacks & { email: string }): void {
    this.adapter.sendEmailVerification(this._handle(), options);
  }

  resetPassword(options: UserServiceCallbacks & { username: string; token: string; newPassword: string }): void {
    this.adapter.resetPassword(this._handle(), options);
  }

  requestPasswordReset(options: UserServiceCallbacks & { email: string }): void {
    this.adapter.requestPasswordReset(this._handle(), options);
  }

  signInWithProvider(options: { provider: string; redirect?: string; error?(message: string): void }): void {
    this.adapter.signInWithProvider(this._handle(), options);
  }

  requestMagicLink(options: UserServiceCallbacks & { email: string; redirect?: string }): void {
    this.adapter.requestMagicLink(this._handle(), options);
  }

  // ── Not contract, and forwarded for the same reason ──────────────────────

  setUserProperties(
    options: UserServiceCallbacks<ParseUser> & {
      username?: string;
      email?: string;
      properties?: Record<string, unknown>;
    }
  ): void {
    this.adapter.setUserProperties(this._handle(), options);
  }

  /** The sign-in methods this backend offers — for rendering a set of buttons. */
  listAuthProviders(
    options: UserServiceCallbacks<{ providers: { id: string; displayName: string }[]; magicLink: { enabled: boolean } }>
  ): void {
    this.adapter.listAuthProviders(this._handle(), options);
  }

  _consumeAuthReturn(): boolean {
    return this.adapter.consumeAuthReturn(this._handle());
  }

  // ── The Model glue, which is why this class still exists ─────────────────

  getCurrentUser(): ParseUser | undefined {
    return this.getUserFromLocalStorage();
  }

  getUserModel(): ModelLike | undefined {
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
