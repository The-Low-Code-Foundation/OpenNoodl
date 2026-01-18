/**
 * GitHubOAuthService
 *
 * Manages GitHub OAuth authentication via IPC with the main process.
 * The main process handles the OAuth flow and protocol callbacks,
 * this service coordinates with it and manages state in the renderer.
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
  error: string;
  message: string;
}

/**
 * Service for managing GitHub OAuth authentication
 *
 * This service coordinates with the main process which handles:
 * - State generation and validation
 * - Protocol callback handling (noodl://github-callback)
 * - Token exchange with GitHub
 *
 * The renderer process handles:
 * - Opening the auth URL in the browser
 * - Storing tokens securely
 * - Managing user state
 */
export class GitHubOAuthService extends EventDispatcher {
  private static _instance: GitHubOAuthService;
  private currentUser: GitHubUser | null = null;
  private accessToken: string | null = null;
  private isAuthenticating: boolean = false;

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
    this.notifyListeners('oauth-error', { error: error.message });
  }

  /**
   * Initiate OAuth flow by requesting auth URL from main process
   * and opening it in the system browser
   */
  async initiateOAuth(): Promise<void> {
    if (this.isAuthenticating) {
      console.warn('[GitHub OAuth] OAuth flow already in progress');
      return;
    }

    console.log('🔐 [GitHub OAuth] Initiating OAuth flow');
    this.isAuthenticating = true;

    try {
      // Request auth URL from main process
      // Main process generates the state and stores it for validation
      const result = await ipcRenderer.invoke('github-oauth-start');

      if (!result.success) {
        throw new Error(result.error || 'Failed to start OAuth flow');
      }

      console.log('🌐 [GitHub OAuth] Opening auth URL in browser');

      // Open the auth URL in the system browser
      await shell.openExternal(result.authUrl);

      // Notify listeners that OAuth flow started
      this.notifyListeners('oauth-started');

      // The main process will handle the callback and send us the result
      // via 'github-oauth-complete' or 'github-oauth-error' IPC events
    } catch (error) {
      console.error('❌ [GitHub OAuth] Failed to initiate OAuth:', error);
      this.isAuthenticating = false;
      this.notifyListeners('oauth-error', {
        error: error instanceof Error ? error.message : 'Failed to start OAuth'
      });
      throw error;
    }
  }

  /**
   * Cancel any pending OAuth flow
   */
  async cancelOAuth(): Promise<void> {
    if (this.isAuthenticating) {
      console.log('🚫 [GitHub OAuth] Cancelling OAuth flow');
      await ipcRenderer.invoke('github-oauth-stop');
      this.isAuthenticating = false;
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
