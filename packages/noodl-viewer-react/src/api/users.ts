import UserService from '../nodes/std-library/user/userservice';

export interface LogInOptions {
  username: string;
  password: string;
}

export interface SignUpOptions extends LogInOptions {
  email?: string;
  properties?: Record<string, unknown>;
}

/**
 * `Noodl.Users.Current` — a *single shared object*, not a fresh one per read.
 *
 * The `Current` getter below copies the live user's fields onto this one instance
 * every time it is read, so two reads return the same reference. `save()` depends
 * on that: it reads back `Properties.data`, which the getter has just pointed at
 * the real user model.
 */
export interface CurrentUser {
  logOut(): Promise<void>;
  save(): Promise<void>;
  fetch(): Promise<void>;
  email?: string;
  username?: string;
  id?: string;
  emailVerified?: boolean;
  /** The underlying user Model — `save()` reads its `data` back. */
  Properties?: any;
}

export interface UsersApi {
  logIn(options: LogInOptions): Promise<void>;
  signUp(options: SignUpOptions): Promise<void>;
  become(sessionToken: string): Promise<void>;
  on(event: string, cb: (...args: any[]) => void): void;
  off(event: string, cb: (...args: any[]) => void): void;
  /** Undefined when nobody is signed in. */
  readonly Current?: CurrentUser;
}

const users = {
  async logIn(options: LogInOptions): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      UserService.instance.logIn({
        username: options.username,
        password: options.password,
        success: () => {
          resolve();
        },
        error: (e) => {
          reject(e);
        }
      });
    });
  },

  async signUp(options: SignUpOptions): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      UserService.instance.signUp({
        username: options.username,
        password: options.password,
        email: options.email,
        properties: options.properties,
        success: () => {
          resolve();
        },
        error: (e) => {
          reject(e);
        }
      });
    });
  },

  async become(sessionToken: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      UserService.instance.fetchCurrentUser({
        sessionToken,
        success: () => {
          resolve();
        },
        error: (e) => {
          reject(e);
        }
      });
    });
  },

  // Deprecated, use cloud functions instead. `requestPasswordReset`,
  // `resetPassword`, `sendEmailVerification` and `verifyEmail` were commented out
  // here long before this conversion; the corresponding nodes still exist.

  on(event: string, cb: (...args: any[]) => void): void {
    UserService.instance.on(event, cb);
  },

  off(event: string, cb: (...args: any[]) => void): void {
    UserService.instance.off(event, cb);
  }
};

const _currentUser: CurrentUser = {
  async logOut(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      UserService.instance.logOut({
        success: () => {
          resolve();
        },
        error: (e) => {
          reject(e);
        }
      });
    });
  },

  async save(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const props = Object.assign({}, _currentUser.Properties.data);

      UserService.instance.setUserProperties({
        properties: props,
        success: () => {
          resolve();
        },
        error: (e) => {
          reject(e);
        }
      });
    });
  },

  async fetch(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      UserService.instance.fetchCurrentUser({
        success: () => {
          resolve();
        },
        error: (e) => {
          reject(e);
        }
      });
    });
  }
};

Object.defineProperty(users, 'Current', {
  get: function () {
    const _user = UserService.instance.current as any;
    if (_user === undefined) return;
    else {
      _currentUser.email = _user.email;
      _currentUser.username = _user.username;
      _currentUser.id = _user.id;
      _currentUser.emailVerified = _user.emailVerified;
      _currentUser.Properties = _user;
      return _currentUser;
    }
  }
});

export default users as UsersApi;
