import type { ModelLike } from '@noodl/types';

import { EventEmitter } from 'events';
import NoodlRuntime from '@noodl/runtime';
import { ParseAuthAdapter } from '@noodl/runtime/src/api/backends/ParseAuthAdapter';
import type { OAuthReturnState } from '@noodl/runtime/src/api/backends/ParseAuthAdapter';
import { RestAuthAdapter } from '@noodl/runtime/src/api/backends/RestAuthAdapter';
import { ACTIVE_BACKEND, resolveBackendFromRuntime } from '@noodl/runtime/src/api/backends/resolveBackend';
import type { BackendHandle, IAuthAdapter } from '@noodl/backend-contract';
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
 *    is what produces one. With no `backendId` that is "whatever `cloudservices` metadata
 *    says", which is the singleton the viewer has always had; with one it is whichever
 *    backend the `User` / `Set User Properties` node's `Backend` input names (BCN-009 step 4).
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

  /**
   * The ten methods, and the session — on the **Parse wire**.
   *
   * Still called `adapter` and still a `ParseAuthAdapter`, because that is what
   * every existing project resolves to and because tests and callers read it by
   * name. {@link restAdapter} is the second one; {@link _adapter} picks.
   */
  readonly adapter: ParseAuthAdapter;

  /**
   * Auth for Directus and PocketBase — BCN-006 step 4.
   *
   * Lazily constructed, so a project that never touches a REST backend never
   * builds one, and nothing about the Parse path changes for it.
   */
  private restAdapter?: RestAuthAdapter;

  constructor() {
    this._initCloudServices();

    this.events = new EventEmitter();
    this.events.setMaxListeners(100000);

    this.adapter = new ParseAuthAdapter({
      // The module-scope serialiser, exactly as before — `_User` properties have
      // always been serialised against the process-wide Model store.
      serializeObject: (data, collectionName) => CloudStore._serializeObject(data, collectionName)
    });

    this._bridge(this.adapter);

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
          this.adapter.sessionStore(this._defaultHandle()).clear();
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
   *
   * ## The BYOB fallback — BCN-006 step 4
   *
   * The `cloudservices` answer is returned **unchanged whenever the project has an
   * endpoint**, which is every project that works today, so nothing about the
   * Parse path moves. Only when there is no endpoint at all does this fall through
   * to `backendServices`, and that case is the user-facing headline BCN-006's
   * Current State names: *"A project on Directus today has data nodes and no
   * login."*
   *
   * Falling back cannot regress anything, and the reason is worth stating rather
   * than assuming: with no endpoint, `url` is `undefined`, and every method on the
   * Parse adapter answers `"No active cloud service"` before touching the network.
   * There is no behaviour there to preserve.
   *
   * ## The backend picker — BCN-009 step 4
   *
   * `backendId` names a backend explicitly, and it is the `User` and
   * `Set User Properties` nodes' `Backend` input. An id that is absent or
   * `_active_` means what it has always meant and resolves exactly as it did
   * before — the endpoint when the project has one — so **no existing project
   * moves**, which is the same no-silent-migration rule `resolveBackend`'s own
   * docblock settled for the Record family.
   *
   * An id the project no longer has resolves to `undefined`, and that is
   * reported rather than fallen back from: a node pointed at a backend that is
   * gone must fail with a sentence, not quietly sign somebody in somewhere else.
   */
  _handle(backendId?: string): BackendHandle | undefined {
    if (backendId && backendId !== ACTIVE_BACKEND) {
      const named = resolveBackendFromRuntime(backendId);
      return named ? named.handle : undefined;
    }
    if (!this.endpoint) {
      const resolved = resolveBackendFromRuntime(ACTIVE_BACKEND);
      if (resolved) return resolved.handle;
    }
    return {
      id: '_active_',
      type: 'nodegx',
      name: 'Built-in',
      url: this.endpoint,
      publicToken: this.appId
    };
  }

  /**
   * The default handle, never `undefined`.
   *
   * `_handle()` grew a failure case when it grew a parameter, and most call sites
   * inside this class pass no id and cannot fail. Rather than sprinkle
   * non-null assertions, the no-argument path has its own name.
   */
  private _defaultHandle(): BackendHandle {
    return this._handle() as BackendHandle;
  }

  /** What a node pointed at a backend that no longer exists is told. */
  private _unknownBackend(backendId: string): string {
    return `The backend this node is set to ("${backendId}") is not configured in this project.`;
  }

  /**
   * Which adapter serves this backend.
   *
   * The three REST types go to `RestAuthAdapter`; **everything else stays on the
   * Parse wire**, including an unrecorded type. That floor is the one
   * `resolveBackend.isParseWireType` already established for the data path, and it
   * is what makes this change unable to move an existing project: `_handle()`
   * answers `nodegx` for every project that has an endpoint.
   */
  private _adapter(handle: BackendHandle): IAuthAdapter {
    if (handle.type === 'directus' || handle.type === 'supabase' || handle.type === 'pocketbase') {
      if (this.restAdapter === undefined) {
        this.restAdapter = new RestAuthAdapter();
        // The same bridge, so `current` and the four node-facing events behave
        // identically whichever backend produced them. This is the whole payoff
        // of putting the event vocabulary on the contract instead of in here.
        this._bridge(this.restAdapter);
      }
      return this.restAdapter;
    }
    return this.adapter;
  }

  /** The adapter serving the currently resolved backend. */
  private _active(backendId?: string): { handle: BackendHandle; adapter: IAuthAdapter } | undefined {
    const handle = this._handle(backendId);
    if (!handle) return undefined;
    return { handle, adapter: this._adapter(handle) };
  }

  /**
   * `_active`, or a failure reported on the caller's own `error` callback.
   *
   * One place, because there are eleven call sites and each one deciding for
   * itself what "the backend is gone" looks like is how a family ends up with
   * eleven different messages for one condition.
   */
  private _resolved(
    backendId: string | undefined,
    error: ((message?: string) => void) | undefined
  ): { handle: BackendHandle; adapter: IAuthAdapter } | undefined {
    const active = this._active(backendId);
    if (!active && error) error(this._unknownBackend(backendId as string));
    return active;
  }

  /**
   * Keep `current` and the node-facing events in step with an adapter.
   *
   * `sessionChanged` is bookkeeping — it is what keeps `current` in step, and it
   * is raised *synchronously* between the storage write and `success` so the
   * observable order is unchanged. The four below are the events nodes have always
   * subscribed to, re-raised with no payload because that is how they were raised
   * before.
   */
  private _bridge(adapter: ParseAuthAdapter | RestAuthAdapter): void {
    adapter.on('sessionChanged', () => {
      if (adapter.getCurrentUser(this._defaultHandle()) === undefined) delete this.current;
      else this.current = this.getUserModel();
    });
    adapter.on('loggedIn', () => this.events.emit('loggedIn'));
    adapter.on('loggedOut', () => this.events.emit('loggedOut'));
    adapter.on('sessionGained', () => this.events.emit('sessionGained'));
    adapter.on('sessionLost', () => this.events.emit('sessionLost'));

    // The provider return leg — BAK-004's for the Parse wire, BCN-006 step 5's
    // for PocketBase. Bridged **here** rather than beside the Parse adapter's
    // construction, which is where it used to be: once a second adapter raises
    // it, a one-off subscription is a subscription the `Sign In With` node stops
    // hearing on exactly the backend the sign-in came back from.
    //
    // ⚠️ `events` (the emitter) rather than `on` (the typed `AuthEventType`
    // surface), because `oauthReturn` is deliberately not one of the five —
    // `AuthEvents`' own docblock explains why: it is per-backend by nature.
    adapter.events.on('oauthReturn', (state: unknown) => this.events.emit('oauthReturn', state));
  }

  /**
   * BAK-004: the state of a sign-in returning from a provider or a magic link.
   *
   * Whichever adapter has one. At most one can — a page load carries either
   * `?nodegx_auth=` or `?code=` with a parked REST flow, never both — so the
   * order below is a tie-break that never fires rather than a precedence rule.
   */
  get oauthReturn(): OAuthReturnState {
    if (this.adapter.oauthReturn && this.adapter.oauthReturn.inProgress) return this.adapter.oauthReturn;
    if (this.adapter.oauthReturn && this.adapter.oauthReturn.succeeded !== undefined) return this.adapter.oauthReturn;
    if (this.restAdapter && this.restAdapter.oauthReturn) return this.restAdapter.oauthReturn;
    return this.adapter.oauthReturn;
  }

  getUserFromLocalStorage(): ParseUser | undefined {
    const active = this._active();
    if (!active) return undefined;
    return (active.adapter as ParseAuthAdapter | RestAuthAdapter).getCurrentUser(active.handle) as
      | ParseUser
      | undefined;
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
    this.adapter._makeRequest(this._defaultHandle(), path, options);
  }

  // ── The ten, each binding the resolved handle ────────────────────────────

  logIn(options: UserServiceCallbacks<ParseUser> & BackendChoice & { username: string; password: string }): void {
    const active = this._resolved(options.backendId, options.error);
    if (active) active.adapter.logIn(active.handle, options);
  }

  logOut(options: UserServiceCallbacks & BackendChoice): void {
    const active = this._resolved(options.backendId, options.error);
    if (active) active.adapter.logOut(active.handle, options);
  }

  signUp(
    options: UserServiceCallbacks<ParseUser> &
      BackendChoice & {
        username: string;
        password: string;
        email?: string;
        /** Extra `_User` columns, as the Sign Up node's `prop-…` inputs collected them. */
        properties?: Record<string, unknown>;
      }
  ): void {
    const active = this._resolved(options.backendId, options.error);
    if (active) active.adapter.signUp(active.handle, options);
  }

  fetchCurrentUser(options: UserServiceCallbacks<ParseUser> & BackendChoice & { sessionToken?: string }): void {
    const active = this._resolved(options.backendId, options.error);
    if (active) active.adapter.fetchCurrentUser(active.handle, options);
  }

  verifyEmail(options: UserServiceCallbacks & BackendChoice & { username: string; token: string }): void {
    const active = this._resolved(options.backendId, options.error);
    if (active) active.adapter.verifyEmail(active.handle, options);
  }

  sendEmailVerification(options: UserServiceCallbacks & BackendChoice & { email: string }): void {
    const active = this._resolved(options.backendId, options.error);
    if (active) active.adapter.sendEmailVerification(active.handle, options);
  }

  resetPassword(
    options: UserServiceCallbacks & BackendChoice & { username: string; token: string; newPassword: string }
  ): void {
    const active = this._resolved(options.backendId, options.error);
    if (active) active.adapter.resetPassword(active.handle, options);
  }

  requestPasswordReset(options: UserServiceCallbacks & BackendChoice & { email: string }): void {
    const active = this._resolved(options.backendId, options.error);
    if (active) active.adapter.requestPasswordReset(active.handle, options);
  }

  signInWithProvider(
    options: BackendChoice & { provider: string; redirect?: string; error?(message: string): void }
  ): void {
    const active = this._resolved(options.backendId, options.error);
    if (active) active.adapter.signInWithProvider(active.handle, options);
  }

  requestMagicLink(options: UserServiceCallbacks & BackendChoice & { email: string; redirect?: string }): void {
    const active = this._resolved(options.backendId, options.error);
    if (active) active.adapter.requestMagicLink(active.handle, options);
  }

  // ── Not contract, and forwarded for the same reason ──────────────────────

  setUserProperties(
    options: UserServiceCallbacks<ParseUser> &
      BackendChoice & {
        username?: string;
        email?: string;
        properties?: Record<string, unknown>;
      }
  ): void {
    const active = this._resolved(options.backendId, options.error);
    if (!active) return;
    (active.adapter as ParseAuthAdapter | RestAuthAdapter).setUserProperties(active.handle, options);
  }

  /** The sign-in methods this backend offers — for rendering a set of buttons. */
  listAuthProviders(
    options: UserServiceCallbacks<{ providers: { id: string; displayName: string }[]; magicLink: { enabled: boolean } }> &
      BackendChoice
  ): void {
    const active = this._resolved(options.backendId, options.error);
    if (!active) return;
    (active.adapter as ParseAuthAdapter | RestAuthAdapter).listAuthProviders(active.handle, options);
  }

  /**
   * Pick up a provider sign-in that this page load is the return leg of.
   *
   * ⚠️ **Both adapters are asked, and the Parse one is asked first.** A project
   * whose default backend is a REST one can still have a Parse-wire session
   * returning — the parameter names differ (`?nodegx_auth=` versus `?code=`), so
   * the two cannot be confused, and asking only the *active* adapter would drop
   * a return that arrived on a page where the picker happened to resolve
   * elsewhere. The REST adapter refuses in one line when no flow was parked for
   * that backend, so the extra ask costs nothing.
   */
  _consumeAuthReturn(): boolean {
    if (this.adapter.consumeAuthReturn(this._defaultHandle())) return true;

    const active = this._active();
    if (active && active.adapter !== this.adapter) {
      return (active.adapter as RestAuthAdapter).consumeAuthReturn(active.handle);
    }
    return false;
  }

  // ── The Model glue, which is why this class still exists ─────────────────

  getCurrentUser(): ParseUser | undefined {
    return this.getUserFromLocalStorage();
  }

  getUserModel(): ModelLike | undefined {
    return this.currentFor(undefined);
  }

  /**
   * The signed-in user of **one named backend**, as a `Model` — BCN-009 step 4.
   *
   * `current` remains the default backend's user, because that is what it has
   * always been and what every node that does not set a `Backend` input reads.
   * A `User` node with the picker set reads this instead.
   *
   * ⚠️ The class name handed to `_fromJSON` stays `_User` for every backend, and
   * that is deliberate rather than overlooked. It is the *Model store's* key, not
   * a wire path — nothing is fetched with it — and changing it per backend would
   * split one identity across two stores so that a Directus user and a
   * `Set User Properties` write on the same account stopped seeing each other.
   */
  currentFor(backendId: string | undefined): ModelLike | undefined {
    const active = this._active(backendId);
    if (!active) return undefined;

    const stored = (active.adapter as ParseAuthAdapter | RestAuthAdapter).getCurrentUser(active.handle) as
      | ParseUser
      | undefined;
    if (stored === undefined) return undefined;

    // A shallow copy: `getCurrentUser` hands back the parsed session, and
    // deleting off it in place would strip the token from the object the caller
    // may still be holding. The original did this against a fresh parse every
    // time, so the copy is what preserves the behaviour rather than changing it.
    const user: ParseUser = Object.assign({}, stored);
    delete user.sessionToken;
    delete user.refreshToken;
    delete user.expiresAt;
    delete user.ACL;
    delete user.className;
    delete user.__type;
    return CloudStore._fromJSON(user, '_User');
  }
}

/**
 * The `Backend` input, as every method here now accepts it.
 *
 * Optional everywhere, and absent means exactly what it meant before this
 * existed. That is the whole safety argument for the change: nine of the eleven
 * user nodes never pass one, so nine of the eleven resolve the way they always
 * did.
 */
export interface BackendChoice {
  backendId?: string;
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
