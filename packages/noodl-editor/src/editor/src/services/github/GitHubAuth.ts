/**
 * GitHubAuth
 *
 * Handles GitHub OAuth authentication using the Device Flow (F63).
 * The device flow authenticates with the client id alone — there is no client
 * secret to ship, which is why it replaced the authorization-code flow.
 *
 * @module services/github
 * @since 1.1.0
 */

import { ipcRenderer, shell } from 'electron';

import { GitHubTokenStore } from './GitHubTokenStore';
import type {
  GitHubAuthState,
  GitHubDeviceCode,
  GitHubToken,
  GitHubAuthError,
  GitHubUser,
  GitHubInstallation
} from './GitHubTypes';

/*
 * The requested scopes (`repo`, `read:org`, `read:user`, `user:email`) are NOT
 * declared here. They used to be, as a `REQUIRED_SCOPES` constant this file
 * never read — the real list was, and still is, in the main process, which is
 * the only side that talks to GitHub. A second copy that nothing consumes is a
 * list that drifts. See `src/main/src/github-device-flow.js`.
 */

/**
 * GitHubAuth
 *
 * Manages GitHub OAuth authentication using the Device Flow.
 * Provides methods to authenticate, check status, and disconnect.
 */
export class GitHubAuth {
  /**
   * Run the GitHub OAuth **device flow** to completion.
   *
   * F63: this used to be `startWebOAuthFlow` and used to `shell.openExternal`
   * an authorization URL that the main process built from a hardcoded client
   * secret. There is no auth URL any more — `github-oauth-start` now answers
   * with a short user code and `https://github.com/login/device`, and the user
   * has to type the one into the other. ⚠️ Anything calling this must surface
   * `onDeviceCode`; a caller that only reports progress leaves the user staring
   * at a browser page asking for a code nothing ever showed them.
   *
   * @param onProgress - Callback for progress updates
   * @param onDeviceCode - Receives the code the user must enter
   * @returns Promise that resolves when authentication completes
   *
   * @throws {GitHubAuthError} If the flow fails, is denied, or expires
   */
  static async startDeviceFlow(
    onProgress?: (message: string) => void,
    onDeviceCode?: (device: GitHubDeviceCode) => void
  ): Promise<void> {
    try {
      onProgress?.('Starting GitHub authentication...');

      // Request the device code from the main process
      const result = await ipcRenderer.invoke('github-oauth-start');

      if (!result.success) {
        throw new Error(result.error || 'Failed to start GitHub sign-in');
      }

      const device: GitHubDeviceCode = {
        device_code: '',
        user_code: result.userCode,
        verification_uri: result.verificationUri,
        expires_in: result.expiresIn,
        interval: result.interval
      };

      onDeviceCode?.(device);
      onProgress?.(`Enter the code ${device.user_code} at ${device.verification_uri}`);

      shell.openExternal(device.verification_uri);

      // Wait for the outcome of the poll, which runs in the main process
      return new Promise((resolve, reject) => {
        // ⚠️ Was a flat 5 minutes, which is *shorter* than the 15-minute life of
        // a GitHub device code: it would have given up on a user who was still
        // typing, while the main process kept polling behind it. The main
        // process owns the deadline now (it sends `expired_token`); this is
        // only a backstop for a main process that went silent, so it is the
        // code's own lifetime plus a minute.
        const timeoutMs = ((device.expires_in || 900) + 60) * 1000;
        const timeout = setTimeout(() => {
          cleanup();
          reject(new Error('Authentication timed out'));
        }, timeoutMs);

        const handleSuccess = async (_event: Electron.IpcRendererEvent, data: any) => {
          console.log('🎉 [GitHub Auth] ========================================');
          console.log('🎉 [GitHub Auth] IPC EVENT RECEIVED: github-oauth-complete');
          console.log('🎉 [GitHub Auth] Data:', data);
          console.log('🎉 [GitHub Auth] ========================================');
          cleanup();

          try {
            onProgress?.('Authentication successful, fetching details...');

            // Save token and user info
            const token: GitHubToken = {
              access_token: data.token.access_token,
              token_type: data.token.token_type,
              scope: data.token.scope
            };

            const installations = data.installations as GitHubInstallation[];

            GitHubTokenStore.saveToken(token, data.user.login, data.user.email, installations);

            onProgress?.(`Successfully authenticated as ${data.user.login}`);
            resolve();
          } catch (error) {
            reject(error);
          }
        };

        const handleError = (_event: Electron.IpcRendererEvent, data: any) => {
          cleanup();
          // The code is carried through, not flattened into prose: a caller has
          // to be able to tell `access_denied` from `expired_token`.
          const error: GitHubAuthError = new Error(data.message || 'Authentication failed');
          error.code = data.error;
          reject(error);
        };

        const cleanup = () => {
          clearTimeout(timeout);
          ipcRenderer.removeListener('github-oauth-complete', handleSuccess);
          ipcRenderer.removeListener('github-oauth-error', handleError);
        };

        ipcRenderer.once('github-oauth-complete', handleSuccess);
        ipcRenderer.once('github-oauth-error', handleError);
      });
    } catch (error) {
      const authError: GitHubAuthError = new Error(
        `GitHub authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      authError.code = error instanceof Error && 'code' in error ? (error as { code?: string }).code : undefined;

      console.error('[GitHub] Authentication error:', authError);
      throw authError;
    }
  }

  /**
   * @deprecated F63 — there is no web OAuth flow any more; this runs the device
   * flow. Kept only so an out-of-tree caller does not break silently.
   */
  static async startWebOAuthFlow(onProgress?: (message: string) => void): Promise<void> {
    return this.startDeviceFlow(onProgress);
  }

  /**
   * Fetch user information from GitHub API
   *
   * @param token - Access token
   * @returns User information
   *
   * @throws {Error} If API request fails
   */
  private static async fetchUserInfo(token: string): Promise<GitHubUser> {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch user info: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get current authentication state
   *
   * @returns Current auth state
   *
   * @example
   * ```typescript
   * const state = GitHubAuth.getAuthState();
   * if (state.isAuthenticated) {
   *   console.log('Connected as:', state.username);
   * }
   * ```
   */
  static getAuthState(): GitHubAuthState {
    const storedAuth = GitHubTokenStore.getToken();

    if (!storedAuth) {
      return {
        isAuthenticated: false
      };
    }

    // Check if token is expired
    if (GitHubTokenStore.isTokenExpired()) {
      console.warn('[GitHub] Token is expired');
      return {
        isAuthenticated: false
      };
    }

    return {
      isAuthenticated: true,
      username: storedAuth.user.login,
      email: storedAuth.user.email || undefined,
      token: storedAuth.token,
      authenticatedAt: storedAuth.storedAt
    };
  }

  /**
   * Check if user is currently authenticated
   *
   * @returns True if authenticated and token is valid
   */
  static isAuthenticated(): boolean {
    return this.getAuthState().isAuthenticated;
  }

  /**
   * Get the username of authenticated user
   *
   * @returns Username or null if not authenticated
   */
  static getUsername(): string | null {
    return this.getAuthState().username || null;
  }

  /**
   * Get current access token
   *
   * @returns Access token or null if not authenticated
   */
  static getAccessToken(): string | null {
    const state = this.getAuthState();
    return state.token?.access_token || null;
  }

  /**
   * Disconnect from GitHub
   *
   * Clears stored authentication data. User will need to re-authenticate.
   *
   * @example
   * ```typescript
   * GitHubAuth.disconnect();
   * console.log('Disconnected from GitHub');
   * ```
   */
  static disconnect(): void {
    GitHubTokenStore.clearToken();
    console.log('[GitHub] User disconnected');
  }

  /**
   * Validate current token by making a test API call
   *
   * @returns True if token is valid, false otherwise
   */
  static async validateToken(): Promise<boolean> {
    const token = this.getAccessToken();
    if (!token) {
      return false;
    }

    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json'
        }
      });

      return response.ok;
    } catch (error) {
      console.error('[GitHub] Token validation failed:', error);
      return false;
    }
  }

  /**
   * Refresh user information from GitHub
   *
   * Useful for updating cached user data
   *
   * @returns Updated auth state
   * @throws {Error} If not authenticated or refresh fails
   */
  static async refreshUserInfo(): Promise<GitHubAuthState> {
    const token = this.getAccessToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const user = await this.fetchUserInfo(token);

    // Update stored auth with new user info
    const storedAuth = GitHubTokenStore.getToken();
    if (storedAuth) {
      GitHubTokenStore.saveToken(storedAuth.token, user.login, user.email);
    }

    return this.getAuthState();
  }
}
