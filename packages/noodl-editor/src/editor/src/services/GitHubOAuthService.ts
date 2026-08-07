/**
 * GitHubOAuthService
 *
 * Manages GitHub authentication via IPC with the main process.
 * The main process runs the OAuth **device flow** and this service coordinates
 * with it, holding the resulting session state in the renderer.
 *
 * F63 replaced the authorization-code flow this used to drive. The old flow
 * needed a client secret, and the secret was a literal in a public repo; the
 * device flow needs only the client id. The visible consequence here: there is
 * no auth URL to open any more. `initiateOAuth` gets back a short **user code**
 * that the person has to type on github.com/login/device — GitHub does not
 * return `verification_uri_complete`, so the code cannot ride in the URL and
 * showing it is mandatory. That is what `oauth-device-code` is for.
 *
 * @module noodl-editor/services
 */

import { shell, ipcRenderer } from 'electron';

import { EventDispatcher } from '../../../shared/utils/EventDispatcher';

export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
  html_url: string;
}

export interface GitHubOrganization {
  id: number;
  login: string;
  avatar_url: string;
  description: string | null;
}

interface GitHubToken {
  access_token: string;
  token_type: string;
  scope: string;
}

interface OAuthCompleteResult {
  token: GitHubToken;
  user: GitHubUser;
  installations: unknown[];
  authMethod: string;
}

interface OAuthErrorResult {
  /** Machine-readable code: `access_denied`, `expired_token`, `network_error`, … */
  error: string;
  message: string;
}

/**
 * What the user has to be shown for a device-flow sign-in to be completable.
 */
export interface GitHubDeviceCode {
  userCode: string;
  verificationUri: string;
  /** Seconds the code stays valid. */
  expiresIn: number;
}

/**
 * Service for managing GitHub OAuth authentication
 *
 * This service coordinates with the main process which handles:
 * - Requesting the device code from GitHub
 * - Polling for the token, and the `slow_down` / `expired_token` /
 *   `access_denied` cases
 *
 * The renderer process handles:
 * - Opening `verification_uri` in the browser and showing the user code
 * - Storing tokens securely
 * - Managing user state
 *
 * Events emitted:
 * - `oauth-started`
 * - `oauth-device-code`   `{ userCode, verificationUri, expiresIn }`
 * - `oauth-success`       `{ user }`
 * - `oauth-error`         `{ error, code }` — `code` distinguishes a refusal
 *                         from a timeout, which is why it is carried separately
 *                         from the sentence
 * - `oauth-cancelled`
 * - `auth-state-changed`  `{ authenticated }`
 */
export class GitHubOAuthService extends EventDispatcher {
  private static _instance: GitHubOAuthService;
  private currentUser: GitHubUser | null = null;
  private accessToken: string | null = null;
  private isAuthenticating: boolean = false;
  private pendingDeviceCode: GitHubDeviceCode | null = null;

  private constructor() {
    super();
    console.log('🔧 [GitHubOAuthService] Constructor called - setting up IPC listeners');
    this.setupIPCListeners();
  }

  static get instance(): GitHubOAuthService {
    if (!GitHubOAuthService._instance) {
      GitHubOAuthService._instance = new GitHubOAuthService();
    }
    return GitHubOAuthService._instance;
  }

  /**
   * Set up IPC listeners for OAuth callbacks from main process
   */
  private setupIPCListeners(): void {
    console.log('🔌 [GitHubOAuthService] Setting up IPC listeners for github-oauth-complete and github-oauth-error');

    // Listen for successful OAuth completion
    ipcRenderer.on('github-oauth-complete', (_event, result: OAuthCompleteResult) => {
      console.log('✅ [GitHubOAuthService] IPC RECEIVED: github-oauth-complete');
      console.log('✅ [GitHubOAuthService] Result:', result);
      this.handleOAuthComplete(result);
    });

    // Listen for OAuth errors
    ipcRenderer.on('github-oauth-error', (_event, error: OAuthErrorResult) => {
      console.error('❌ [GitHubOAuthService] IPC RECEIVED: github-oauth-error');
      console.error('❌ [GitHubOAuthService] Error:', error);
      this.handleOAuthError(error);
    });

    console.log('✅ [GitHubOAuthService] IPC listeners registered');
  }

  /**
   * Handle successful OAuth completion from main process
   */
  private async handleOAuthComplete(result: OAuthCompleteResult): Promise<void> {
    try {
      console.log('🔄 [GitHub OAuth] Processing OAuth result for user:', result.user.login);

      // Store the token
      this.accessToken = result.token.access_token;
      this.currentUser = result.user;

      // Persist token securely
      await this.saveToken(result.token.access_token);

      console.log('✅ [GitHub OAuth] Authentication successful');

      // Notify listeners
      this.isAuthenticating = false;
      this.pendingDeviceCode = null;
      this.notifyListeners('oauth-success', { user: this.currentUser });
      this.notifyListeners('auth-state-changed', { authenticated: true });
    } catch (error) {
      console.error('❌ [GitHub OAuth] Failed to process OAuth result:', error);
      this.handleOAuthError({
        error: 'processing_failed',
        message: error instanceof Error ? error.message : 'Failed to process OAuth result'
      });
    }
  }

  /**
   * Handle OAuth error from main process
   */
  private handleOAuthError(error: OAuthErrorResult): void {
    console.error('❌ [GitHub OAuth] OAuth error:', error.error, error.message);

    this.isAuthenticating = false;
    this.pendingDeviceCode = null;
    this.notifyListeners('oauth-error', { error: error.message, code: error.error });
  }

  /**
   * Start the device flow.
   *
   * Resolves once there is a code to show — the wait for the user happens in
   * the main process, and its outcome arrives as `oauth-success` or
   * `oauth-error`. Callers must not treat this resolving as "signed in".
   */
  async initiateOAuth(): Promise<GitHubDeviceCode | null> {
    if (this.isAuthenticating) {
      console.warn('[GitHub OAuth] Sign-in already in progress');
      // Re-announced rather than ignored: the second caller is usually a
      // different panel, and it needs the code as much as the first one.
      if (this.pendingDeviceCode) {
        this.notifyListeners('oauth-device-code', this.pendingDeviceCode);
      }
      return this.pendingDeviceCode;
    }

    console.log('🔐 [GitHub OAuth] Starting device flow');
    this.isAuthenticating = true;

    try {
      const result = await ipcRenderer.invoke('github-oauth-start');

      if (!result.success) {
        throw new Error(result.error || 'Failed to start GitHub sign-in');
      }

      const device: GitHubDeviceCode = {
        userCode: result.userCode,
        verificationUri: result.verificationUri,
        expiresIn: result.expiresIn
      };
      this.pendingDeviceCode = device;

      // Announced BEFORE the browser opens: `openExternal` can take a second or
      // two to resolve on a cold browser, and the code has to already be on
      // screen when the user's attention moves to the tab that just opened.
      this.notifyListeners('oauth-started');
      this.notifyListeners('oauth-device-code', device);

      // Best-effort. A browser that refuses to open is not a failed sign-in —
      // the dialog shows the URL, so the user can still get there by hand.
      shell.openExternal(device.verificationUri).catch((err) => {
        console.warn('[GitHub OAuth] Could not open the browser:', err);
      });

      return device;
    } catch (error) {
      console.error('❌ [GitHub OAuth] Failed to start sign-in:', error);
      this.isAuthenticating = false;
      this.pendingDeviceCode = null;
      this.notifyListeners('oauth-error', {
        error: error instanceof Error ? error.message : 'Failed to start GitHub sign-in',
        code: 'start_failed'
      });
      throw error;
    }
  }

  /**
   * The code the user still has to enter, if a flow is running.
   */
  getPendingDeviceCode(): GitHubDeviceCode | null {
    return this.pendingDeviceCode;
  }

  /**
   * Cancel any pending sign-in
   */
  async cancelOAuth(): Promise<void> {
    if (this.isAuthenticating) {
      console.log('🚫 [GitHub OAuth] Cancelling sign-in');
      await ipcRenderer.invoke('github-oauth-stop');
      this.isAuthenticating = false;
      this.pendingDeviceCode = null;
      this.notifyListeners('oauth-cancelled');
    }
  }

  /**
   * Get organizations for current user
   */
  async getOrganizations(): Promise<GitHubOrganization[]> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch('https://api.github.com/user/orgs', {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch organizations: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Get current access token
   */
  async getToken(): Promise<string | null> {
    if (!this.accessToken) {
      // Try to load from storage
      await this.loadToken();
    }
    return this.accessToken;
  }

  /**
   * Get current authenticated user
   */
  getCurrentUser(): GitHubUser | null {
    return this.currentUser;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.accessToken !== null && this.currentUser !== null;
  }

  /**
   * Check if OAuth flow is in progress
   */
  isOAuthInProgress(): boolean {
    return this.isAuthenticating;
  }

  /**
   * Revoke token and disconnect
   */
  async disconnect(): Promise<void> {
    console.log('🔌 [GitHub OAuth] Disconnecting GitHub account');

    this.accessToken = null;
    this.currentUser = null;

    // Clear stored token
    await this.clearToken();

    // Notify listeners
    this.notifyListeners('auth-state-changed', { authenticated: false });
    this.notifyListeners('disconnected');
  }

  /**
   * Save token securely using Electron's safeStorage via IPC
   */
  private async saveToken(token: string): Promise<void> {
    try {
      await ipcRenderer.invoke('github-save-token', token);
      console.log('💾 [GitHub OAuth] Token saved');
    } catch (error) {
      console.error('❌ [GitHub OAuth] Failed to save token:', error);
      // Token is still in memory, just not persisted
    }
  }

  /**
   * Load token from secure storage
   */
  private async loadToken(): Promise<void> {
    try {
      const token = await ipcRenderer.invoke('github-load-token');

      if (token) {
        console.log('🔑 [GitHub OAuth] Token loaded from storage, verifying...');
        this.accessToken = token;

        // Fetch user info to verify token is still valid
        await this.fetchCurrentUser();
        this.notifyListeners('auth-state-changed', { authenticated: true });
        console.log('✅ [GitHub OAuth] Token verified, user:', this.currentUser?.login);
      }
    } catch (error) {
      console.error('❌ [GitHub OAuth] Failed to load/verify token:', error);
      // Token may be invalid, clear it
      this.accessToken = null;
      this.currentUser = null;
      await this.clearToken();
    }
  }

  /**
   * Fetch current user information from GitHub API
   */
  private async fetchCurrentUser(): Promise<void> {
    if (!this.accessToken) {
      throw new Error('No access token available');
    }

    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch user info: ${response.status}`);
    }

    this.currentUser = await response.json();
  }

  /**
   * Clear stored token
   */
  private async clearToken(): Promise<void> {
    try {
      await ipcRenderer.invoke('github-clear-token');
    } catch (error) {
      console.error('❌ [GitHub OAuth] Failed to clear token:', error);
    }
  }

  /**
   * Initialize service and restore session if available
   */
  async initialize(): Promise<void> {
    console.log('🔧 [GitHub OAuth] Initializing GitHubOAuthService');
    await this.loadToken();
  }
}
