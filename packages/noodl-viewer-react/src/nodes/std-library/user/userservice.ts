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

  constructor() {
    this._initCloudServices();

    this.events = new EventEmitter();
    this.events.setMaxListeners(100000);

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
