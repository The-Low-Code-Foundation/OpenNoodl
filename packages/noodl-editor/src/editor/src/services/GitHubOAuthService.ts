/**
 * GitHubOAuthService
 *
 * Manages GitHub OAuth authentication using PKCE flow.
 * Provides token management and user information retrieval.
 *
 * @module noodl-editor/services
 */

import crypto from 'crypto';
import { shell } from 'electron';

import { EventDispatcher } from '../../../shared/utils/EventDispatcher';

/**
 * IMPORTANT: GitHub App Setup Instructions
 *
 * This service uses PKCE (Proof Key for Code Exchange) combined with a client secret.
 *
 * To set up:
 * 1. Go to https://github.com/settings/apps/new
 * 2. Fill in:
 *    - GitHub App name: "OpenNoodl" (or your choice)
 *    - Homepage URL: https://github.com/The-Low-Code-Foundation/OpenNoodl
 *    - Callback URL: noodl://github-callback
 *    - Check "Request user authorization (OAuth) during installation"
 *    - Uncheck "Webhook > Active"
 *    - Permissions:
 *      * Repository permissions → Contents: Read and write
 *      * Account permissions → Email addresses: Read-only
 * 3. Click "Create GitHub App"
 * 4. Copy the Client ID
 * 5. Generate a Client Secret and copy it
 * 6. Update GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET below
 *
 * Security Note:
 * While storing client secrets in desktop apps is not ideal (they can be extracted),
 * this is GitHub's requirement for token exchange. The PKCE flow still adds security
 * by preventing authorization code interception attacks.
 */
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'Iv23lib1WdrimUdyvZui'; // Replace with your GitHub App Client ID
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '9bd56694d6d300bf86b1999bab523b32654ec375'; // Replace with your GitHub App Client Secret
const GITHUB_REDIRECT_URI = 'noodl://github-callback';
const GITHUB_SCOPES = ['repo', 'read:org', 'read:user'];

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

interface PKCEChallenge {
  verifier: string;
  challenge: string;
  state: string;
}

/**
 * Service for managing GitHub OAuth authentication
 */
export class GitHubOAuthService extends EventDispatcher {
  private static _instance: GitHubOAuthService;
  private currentUser: GitHubUser | null = null;
  private accessToken: string | null = null;
  private pendingPKCE: PKCEChallenge | null = null;

  private constructor() {
    super();
  }

  static get instance(): GitHubOAuthService {
    if (!GitHubOAuthService._instance) {
      GitHubOAuthService._instance = new GitHubOAuthService();
    }
    return GitHubOAuthService._instance;
  }

  /**
   * Generate PKCE challenge for secure OAuth flow
   */
  private generatePKCE(): PKCEChallenge {
    // Generate code verifier (random string)
    const verifier = crypto.randomBytes(32).toString('base64url');

    // Generate code challenge (SHA256 hash of verifier)
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');

    // Generate state for CSRF protection
    const state = crypto.randomBytes(16).toString('hex');

    return { verifier, challenge, state };
  }

  /**
   * Initiate OAuth flow by opening GitHub authorization in browser
   */
  async initiateOAuth(): Promise<void> {
    console.log('🔐 Initiating GitHub OAuth flow');

    // Generate PKCE challenge
    this.pendingPKCE = this.generatePKCE();

    // Build authorization URL
    const params = new URLSearchParams({
      client_id: GITHUB_CLIENT_ID,
      redirect_uri: GITHUB_REDIRECT_URI,
      scope: GITHUB_SCOPES.join(' '),
      state: this.pendingPKCE.state,
      code_challenge: this.pendingPKCE.challenge,
      code_challenge_method: 'S256'
    });

    const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;

    console.log('🌐 Opening GitHub authorization URL:', authUrl);

    // Open in system browser
    await shell.openExternal(authUrl);

    // Notify listeners that OAuth flow started
    this.notifyListeners('oauth-started');
  }

  /**
   * Handle OAuth callback with authorization code
   */
  async handleCallback(code: string, state: string): Promise<void> {
    console.log('🔄 Handling OAuth callback');

    try {
      // Verify state to prevent CSRF
      if (!this.pendingPKCE || state !== this.pendingPKCE.state) {
        throw new Error('Invalid OAuth state - possible CSRF attack');
      }

      // Exchange code for token
      const token = await this.exchangeCodeForToken(code, this.pendingPKCE.verifier);

      // Store token
      this.accessToken = token.access_token;

      // Clear pending PKCE
      this.pendingPKCE = null;

      // Fetch user information
      await this.fetchCurrentUser();

      // Persist token securely
      await this.saveToken(token.access_token);

      console.log('✅ GitHub OAuth successful, user:', this.currentUser?.login);

      // Notify listeners
      this.notifyListeners('oauth-success', { user: this.currentUser });
      this.notifyListeners('auth-state-changed', { authenticated: true });
    } catch (error) {
      console.error('❌ OAuth callback error:', error);
      this.pendingPKCE = null;
      this.notifyListeners('oauth-error', { error: error.message });
      throw error;
    }
  }

  /**
   * Exchange authorization code for access token
   */
  private async exchangeCodeForToken(code: string, verifier: string): Promise<GitHubToken> {
    console.log('🔄 Exchanging code for access token');

    // Exchange authorization code for access token using PKCE + client secret
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        code_verifier: verifier,
        redirect_uri: GITHUB_REDIRECT_URI
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to exchange code for token: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`GitHub OAuth error: ${data.error_description || data.error}`);
    }

    return data;
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
   * Revoke token and disconnect
   */
  async disconnect(): Promise<void> {
    console.log('🔌 Disconnecting GitHub account');

    this.accessToken = null;
    this.currentUser = null;

    // Clear stored token
    await this.clearToken();

    // Notify listeners
    this.notifyListeners('auth-state-changed', { authenticated: false });
    this.notifyListeners('disconnected');
  }

  /**
   * Save token securely using Electron's safeStorage
   */
  private async saveToken(token: string): Promise<void> {
    try {
      const { ipcRenderer } = window.require('electron');
      await ipcRenderer.invoke('github-save-token', token);
    } catch (error) {
      console.error('Failed to save token:', error);
      // Fallback: keep in memory only
    }
  }

  /**
   * Load token from secure storage
   */
  private async loadToken(): Promise<void> {
    try {
      const { ipcRenderer } = window.require('electron');
      const token = await ipcRenderer.invoke('github-load-token');

      if (token) {
        this.accessToken = token;
        // Fetch user info to verify token is still valid
        await this.fetchCurrentUser();
        this.notifyListeners('auth-state-changed', { authenticated: true });
      }
    } catch (error) {
      console.error('Failed to load token:', error);
      // Token may be invalid, clear it
      this.accessToken = null;
      this.currentUser = null;
    }
  }

  /**
   * Clear stored token
   */
  private async clearToken(): Promise<void> {
    try {
      const { ipcRenderer } = window.require('electron');
      await ipcRenderer.invoke('github-clear-token');
    } catch (error) {
      console.error('Failed to clear token:', error);
    }
  }

  /**
   * Initialize service and restore session if available
   */
  async initialize(): Promise<void> {
    console.log('🔧 Initializing GitHubOAuthService');
    await this.loadToken();
  }
}
