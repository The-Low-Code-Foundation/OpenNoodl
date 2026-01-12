/**
 * GitHubOAuthCallbackHandler
 *
 * Handles GitHub OAuth callback in Electron main process using custom protocol handler.
 * This enables Web OAuth Flow with organization/repository selection UI.
 *
 * @module noodl-editor/main
 * @since 1.1.0
 */

const crypto = require('crypto');
const { ipcMain, BrowserWindow } = require('electron');

/**
 * GitHub OAuth credentials
 * Uses existing credentials from GitHubOAuthService
 */
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'Iv23lib1WdrimUdyvZui';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '9bd56694d6d300bf86b1999bab523b32654ec375';

/**
 * Custom protocol for OAuth callback
 */
const OAUTH_PROTOCOL = 'noodl';
const OAUTH_CALLBACK_PATH = 'github-callback';

/**
 * Manages GitHub OAuth using custom protocol handler
 */
class GitHubOAuthCallbackHandler {
  constructor() {
    this.pendingAuth = null;
  }

  /**
   * Handle protocol callback from GitHub OAuth
   * Called when user is redirected to noodl://github-callback?code=XXX&state=YYY
   */
  async handleProtocolCallback(url) {
    console.log('🔐 [GitHub OAuth] ========================================');
    console.log('🔐 [GitHub OAuth] PROTOCOL CALLBACK RECEIVED');
    console.log('🔐 [GitHub OAuth] URL:', url);
    console.log('🔐 [GitHub OAuth] ========================================');

    try {
      // Parse the URL
      const parsedUrl = new URL(url);
      const params = parsedUrl.searchParams;

      const code = params.get('code');
      const state = params.get('state');
      const error = params.get('error');
      const error_description = params.get('error_description');

      // Handle OAuth error
      if (error) {
        console.error('[GitHub OAuth] Error from GitHub:', error, error_description);
        this.sendErrorToRenderer(error, error_description);
        return;
      }

      // Validate required parameters
      if (!code || !state) {
        console.error('[GitHub OAuth] Missing code or state in callback');
        this.sendErrorToRenderer('invalid_request', 'Missing authorization code or state');
        return;
      }

      // Validate state (CSRF protection)
      if (!this.validateState(state)) {
        throw new Error('Invalid OAuth state - possible CSRF attack or expired');
      }

      // Exchange code for token
      const token = await this.exchangeCodeForToken(code);

      // Fetch user info
      const user = await this.fetchUserInfo(token.access_token);

      // Fetch installation info (organizations/repos)
      const installations = await this.fetchInstallations(token.access_token);

      // Send result to renderer process
      this.sendSuccessToRenderer({
        token,
        user,
        installations,
        authMethod: 'web_oauth'
      });

      // Clear pending auth
      this.pendingAuth = null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[GitHub OAuth] Callback handling error:', error);
      this.sendErrorToRenderer('token_exchange_failed', errorMessage);
    }
  }

  /**
   * Generate OAuth state for new flow
   */
  generateOAuthState() {
    const state = crypto.randomBytes(32).toString('hex');
    const verifier = crypto.randomBytes(32).toString('base64url');
    const now = Date.now();

    this.pendingAuth = {
      state,
      verifier,
      createdAt: now,
      expiresAt: now + 300000 // 5 minutes
    };

    return this.pendingAuth;
  }

  /**
   * Validate OAuth state from callback
   */
  validateState(receivedState) {
    if (!this.pendingAuth) {
      console.error('[GitHub OAuth] No pending auth state');
      return false;
    }

    if (receivedState !== this.pendingAuth.state) {
      console.error('[GitHub OAuth] State mismatch');
      return false;
    }

    if (Date.now() > this.pendingAuth.expiresAt) {
      console.error('[GitHub OAuth] State expired');
      return false;
    }

    return true;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code) {
    console.log('[GitHub OAuth] Exchanging code for access token');

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
        redirect_uri: `${OAUTH_PROTOCOL}://${OAUTH_CALLBACK_PATH}`
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`GitHub OAuth error: ${data.error_description || data.error}`);
    }

    return data;
  }

  /**
   * Fetch user information from GitHub
   */
  async fetchUserInfo(token) {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch user info: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Fetch installation information (orgs/repos user granted access to)
   */
  async fetchInstallations(token) {
    try {
      // Fetch user installations
      const response = await fetch('https://api.github.com/user/installations', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        console.warn('[GitHub OAuth] Failed to fetch installations:', response.status);
        return [];
      }

      const data = await response.json();
      return data.installations || [];
    } catch (error) {
      console.warn('[GitHub OAuth] Error fetching installations:', error);
      return [];
    }
  }

  /**
   * Send success to renderer process
   */
  sendSuccessToRenderer(result) {
    console.log('📤 [GitHub OAuth] ========================================');
    console.log('📤 [GitHub OAuth] SENDING IPC EVENT: github-oauth-complete');
    console.log('📤 [GitHub OAuth] User:', result.user.login);
    console.log('📤 [GitHub OAuth] Installations:', result.installations.length);
    console.log('📤 [GitHub OAuth] ========================================');

    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      windows[0].webContents.send('github-oauth-complete', result);
      console.log('✅ [GitHub OAuth] IPC event sent to renderer');
    } else {
      console.error('❌ [GitHub OAuth] No windows available to send IPC event!');
    }
  }

  /**
   * Send error to renderer process
   */
  sendErrorToRenderer(error, description) {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      windows[0].webContents.send('github-oauth-error', {
        error,
        message: description || error
      });
    }
  }

  /**
   * Get authorization URL for OAuth flow
   */
  getAuthorizationUrl(state) {
    const params = new URLSearchParams({
      client_id: GITHUB_CLIENT_ID,
      redirect_uri: `${OAUTH_PROTOCOL}://${OAUTH_CALLBACK_PATH}`,
      scope: 'repo read:org read:user user:email',
      state,
      allow_signup: 'true'
    });

    return `https://github.com/login/oauth/authorize?${params}`;
  }

  /**
   * Cancel pending OAuth flow
   */
  cancelPendingAuth() {
    this.pendingAuth = null;
    console.log('[GitHub OAuth] Pending auth cancelled');
  }
}

// Singleton instance
let handlerInstance = null;

/**
 * Initialize GitHub OAuth IPC handlers and protocol handler
 */
function initializeGitHubOAuthHandlers(app) {
  handlerInstance = new GitHubOAuthCallbackHandler();

  // Register custom protocol handler
  if (!app.isDefaultProtocolClient(OAUTH_PROTOCOL)) {
    app.setAsDefaultProtocolClient(OAUTH_PROTOCOL);
    console.log(`[GitHub OAuth] Registered ${OAUTH_PROTOCOL}:// protocol handler`);
  }

  // Handle protocol callback on macOS/Linux
  app.on('open-url', (event, url) => {
    event.preventDefault();
    if (url.startsWith(`${OAUTH_PROTOCOL}://${OAUTH_CALLBACK_PATH}`)) {
      handlerInstance.handleProtocolCallback(url);
    }
  });

  // Handle protocol callback on Windows (second instance)
  app.on('second-instance', (event, commandLine) => {
    // Find the protocol URL in command line args
    const protocolUrl = commandLine.find((arg) => arg.startsWith(`${OAUTH_PROTOCOL}://`));
    if (protocolUrl && protocolUrl.includes(OAUTH_CALLBACK_PATH)) {
      handlerInstance.handleProtocolCallback(protocolUrl);
    }

    // Focus the main window
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      if (windows[0].isMinimized()) windows[0].restore();
      windows[0].focus();
    }
  });

  // Handle start OAuth flow request from renderer
  ipcMain.handle('github-oauth-start', async () => {
    try {
      const authState = handlerInstance.generateOAuthState();
      const authUrl = handlerInstance.getAuthorizationUrl(authState.state);

      return { success: true, authUrl };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  });

  // Handle stop OAuth flow request from renderer
  ipcMain.handle('github-oauth-stop', async () => {
    handlerInstance.cancelPendingAuth();
    return { success: true };
  });

  console.log('[GitHub OAuth] IPC handlers and protocol handler initialized');
}

module.exports = {
  GitHubOAuthCallbackHandler,
  initializeGitHubOAuthHandlers,
  OAUTH_PROTOCOL
};
