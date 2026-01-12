# Technical Approach: Web OAuth Flow Implementation

**Document Version:** 1.0  
**Last Updated:** 2026-01-09  
**Status:** Planning Phase

---

## Architecture Overview

### Current Architecture (Device Flow)

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│  OpenNoodl  │────1───>│   Browser   │────2───>│   GitHub    │
│   Editor    │         │             │         │   OAuth     │
└─────────────┘         └─────────────┘         └─────────────┘
       │                                                │
       │                       3. User enters          │
       │                          device code          │
       │                                                │
       └──────────────────4. Poll for token────────────┘
```

**Limitations:**

- No org/repo selection UI
- Polling is inefficient
- Cannot handle organization permissions properly

### Target Architecture (Web OAuth Flow)

```
┌─────────────┐    1. Auth URL     ┌─────────────┐    2. Navigate   ┌─────────────┐
│  OpenNoodl  │──────with state───>│   Browser   │───────────────>│   GitHub    │
│   Editor    │                     │             │                 │   OAuth     │
└─────────────┘                     └─────────────┘                 └─────────────┘
       │                                   │                                │
       │                                   │     3. User selects           │
       │                                   │        orgs/repos             │
       │                                   │                                │
       │                                   │<─────4. Redirect with code─────┘
       │                                   │
       │<───────5. HTTP callback──────────┘
       │          (localhost:PORT)
       │
       └────────────6. Exchange code for token──────────┐
                                                          │
       ┌──────────7. Store token + metadata──────────────┘
       │
       └────────────8. Update UI with orgs
```

---

## Component Design

### 1. OAuth Callback Handler (Electron Main Process)

**Location:** `packages/noodl-editor/src/main/github-oauth-handler.ts`

**Responsibilities:**

- Create temporary HTTP server on localhost
- Handle OAuth callback requests
- Validate state parameter (CSRF protection)
- Exchange authorization code for access token
- Store installation metadata
- Notify renderer process of completion

**Key Functions:**

```typescript
class GitHubOAuthCallbackHandler {
  private server: http.Server | null = null;
  private port: number = 3000;
  private pendingAuth: Map<string, OAuthPendingAuth> = new Map();

  /**
   * Start HTTP server to handle OAuth callbacks
   * Tries multiple ports if first is busy
   */
  async startCallbackServer(): Promise<number>;

  /**
   * Handle incoming callback request
   * Validates state and exchanges code for token
   */
  private async handleCallback(req: http.IncomingMessage, res: http.ServerResponse): Promise<void>;

  /**
   * Exchange authorization code for access token
   * Makes POST request to GitHub token endpoint
   */
  private async exchangeCodeForToken(code: string): Promise<GitHubToken>;

  /**
   * Stop callback server
   * Called after successful auth or timeout
   */
  async stopCallbackServer(): Promise<void>;
}
```

**Server Lifecycle:**

1. Started when user clicks "Connect GitHub"
2. Listens on `http://localhost:PORT/github/callback`
3. Handles single callback request
4. Automatically stops after success or 5-minute timeout

**Port Selection Strategy:**

```typescript
const PORTS_TO_TRY = [3000, 3001, 3002, 3003, 3004];

for (const port of PORTS_TO_TRY) {
  try {
    await server.listen(port);
    return port; // Success
  } catch (error) {
    if (error.code === 'EADDRINUSE') {
      continue; // Try next port
    }
    throw error; // Other error
  }
}

throw new Error('No available ports for OAuth callback');
```

---

### 2. Web OAuth Flow (GitHubAuth Service)

**Location:** `packages/noodl-editor/src/editor/src/services/github/GitHubAuth.ts`

**New Methods:**

```typescript
export class GitHubAuth {
  /**
   * Start Web OAuth flow
   * Generates authorization URL and opens browser
   */
  static async startWebOAuthFlow(onProgress?: (message: string) => void): Promise<GitHubWebAuthResult> {
    // 1. Start callback server
    const port = await this.startCallbackServer();

    // 2. Generate OAuth state
    const state = this.generateOAuthState();

    // 3. Build authorization URL
    const authUrl = this.buildAuthorizationUrl(state, port);

    // 4. Open browser
    shell.openExternal(authUrl);

    // 5. Wait for callback
    return this.waitForCallback(state);
  }

  /**
   * Generate secure random state for CSRF protection
   */
  private static generateOAuthState(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Build GitHub authorization URL
   */
  private static buildAuthorizationUrl(state: string, port: number): string {
    const params = new URLSearchParams({
      client_id: GITHUB_CLIENT_ID,
      redirect_uri: `http://127.0.0.1:${port}/github/callback`,
      scope: REQUIRED_SCOPES.join(' '),
      state: state,
      allow_signup: 'true'
    });

    return `https://github.com/login/oauth/authorize?${params}`;
  }

  /**
   * Wait for OAuth callback with timeout
   */
  private static async waitForCallback(
    state: string,
    timeoutMs: number = 300000 // 5 minutes
  ): Promise<GitHubWebAuthResult> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('OAuth flow timed out'));
      }, timeoutMs);

      // Listen for IPC message from main process
      ipcRenderer.once('github-oauth-complete', (event, result) => {
        clearTimeout(timeout);
        resolve(result);
      });

      ipcRenderer.once('github-oauth-error', (event, error) => {
        clearTimeout(timeout);
        reject(new Error(error.message));
      });
    });
  }
}
```

---

### 3. Installation Metadata Storage

**Location:** `packages/noodl-editor/src/editor/src/services/github/GitHubTokenStore.ts`

**Enhanced Storage Schema:**

```typescript
interface StoredGitHubAuth {
  token: GitHubToken;
  user: GitHubUser;
  storedAt: string;
  // NEW: Installation metadata
  installations?: GitHubInstallation[];
  authMethod: 'device_flow' | 'web_oauth';
}

interface GitHubInstallation {
  id: number;
  account: {
    login: string;
    type: 'User' | 'Organization';
    avatar_url: string;
  };
  repository_selection: 'all' | 'selected';
  repositories?: GitHubRepository[];
  created_at: string;
  updated_at: string;
}
```

**New Methods:**

```typescript
export class GitHubTokenStore {
  /**
   * Save token with installation metadata
   */
  static saveTokenWithInstallations(token: GitHubToken, user: GitHubUser, installations: GitHubInstallation[]): void {
    const auth: StoredGitHubAuth = {
      token,
      user,
      storedAt: new Date().toISOString(),
      installations,
      authMethod: 'web_oauth'
    };

    store.set(STORAGE_KEY, auth);
  }

  /**
   * Get installation metadata
   */
  static getInstallations(): GitHubInstallation[] | null {
    const auth = this.getToken();
    return auth?.installations || null;
  }

  /**
   * Check if token has access to specific org
   */
  static hasOrganizationAccess(orgName: string): boolean {
    const installations = this.getInstallations();
    if (!installations) return false;

    return installations.some(
      (inst) => inst.account.login.toLowerCase() === orgName.toLowerCase() && inst.account.type === 'Organization'
    );
  }
}
```

---

### 4. UI Updates

**Location:** `packages/noodl-editor/src/editor/src/views/panels/VersionControlPanel/components/GitProviderPopout/sections/CredentialsSection.tsx`

**Component Updates:**

```tsx
export function CredentialsSection() {
  const [authState, setAuthState] = useState<GitHubAuthState | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      await GitHubAuth.startWebOAuthFlow((message) => {
        // Show progress
        console.log('[OAuth]', message);
      });

      // Refresh auth state
      const newState = GitHubAuth.getAuthState();
      setAuthState(newState);

      // Show success message
      ToastLayer.showSuccess('Successfully connected to GitHub!');
    } catch (err) {
      setError(err.message);
      ToastLayer.showError(`Failed to connect: ${err.message}`);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className={css.credentials}>
      {!authState.isAuthenticated ? (
        <PrimaryButton onClick={handleConnect} disabled={isConnecting}>
          {isConnecting ? 'Connecting...' : 'Connect GitHub Account'}
        </PrimaryButton>
      ) : (
        <GitHubConnectionStatus
          user={authState.username}
          installations={authState.installations}
          onDisconnect={handleDisconnect}
        />
      )}
    </div>
  );
}
```

**New Component: GitHubConnectionStatus**

```tsx
interface GitHubConnectionStatusProps {
  user: string;
  installations?: GitHubInstallation[];
  onDisconnect: () => void;
}

function GitHubConnectionStatus({ user, installations, onDisconnect }: GitHubConnectionStatusProps) {
  const organizationCount = installations?.filter((i) => i.account.type === 'Organization').length || 0;

  return (
    <div className={css.connectionStatus}>
      <div className={css.connectedUser}>
        <Icon name="check-circle" color="success" />
        <span>Connected as {user}</span>
      </div>

      {installations && installations.length > 0 && (
        <div className={css.installations}>
          <h4>Access granted to:</h4>
          <ul>
            {installations.map((inst) => (
              <li key={inst.id}>
                <span>{inst.account.login}</span>
                {inst.repository_selection === 'selected' && inst.repositories && (
                  <span className={css.repoCount}>({inst.repositories.length} repos)</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <TextButton onClick={onDisconnect} variant="danger">
        Disconnect GitHub
      </TextButton>
    </div>
  );
}
```

---

## Security Implementation

### CSRF Protection (OAuth State Parameter)

**Implementation:**

```typescript
// Generate cryptographically secure random state
const state = crypto.randomBytes(32).toString('hex'); // 64-character hex string

// Store state temporarily (in-memory, expires after 5 minutes)
const pendingAuth = {
  state,
  timestamp: Date.now(),
  expiresAt: Date.now() + 300000 // 5 minutes
};

// Validate on callback
if (receivedState !== pendingAuth.state) {
  throw new Error('Invalid OAuth state - possible CSRF attack');
}

if (Date.now() > pendingAuth.expiresAt) {
  throw new Error('OAuth state expired - please try again');
}
```

### Client Secret Handling

**DO NOT store in code or config files!**

**Recommended Approach:**

```typescript
// Use Electron's safeStorage for production
import { safeStorage } from 'electron';

// Development: environment variable
const clientSecret =
  process.env.GITHUB_CLIENT_SECRET || // Development
  safeStorage.decryptString(storedEncryptedSecret); // Production

// Never expose to renderer process
// Main process only
```

### Token Storage Encryption

**Already implemented in GitHubTokenStore:**

```typescript
const store = new Store({
  encryptionKey: 'opennoodl-github-credentials',
  name: 'github-auth'
});
```

---

## Error Handling

### Error Categories

**1. User-Cancelled:**

```typescript
// User closes browser or denies permission
if (callbackError?.error === 'access_denied') {
  showMessage('GitHub connection cancelled');
  // Don't show error - user intentionally cancelled
}
```

**2. Network Errors:**

```typescript
// Timeout, connection refused, DNS failure
catch (error) {
  if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
    showError('Network error - check your internet connection');
  }
}
```

**3. Invalid State/CSRF:**

```typescript
// State mismatch indicates potential attack
if (receivedState !== expected State) {
  console.error('[Security] OAuth state mismatch - possible CSRF');
  showError('Security error - please try again');
  // Log security event
}
```

**4. Port Conflicts:**

```typescript
// All callback ports in use
if (noPortsAvailable) {
  showError('Could not start OAuth server. Please close some applications and try again.', {
    details: 'Ports 3000-3004 are all in use'
  });
}
```

---

## Performance Considerations

### Callback Server Lifecycle

- **Start:** Only when user clicks "Connect" (not on app startup)
- **Duration:** Active only during OAuth flow (max 5 minutes)
- **Resources:** Minimal - single HTTP server, no persistent connections
- **Cleanup:** Automatic shutdown after success or timeout

### Token Refresh

**Current Implementation:** Tokens don't expire (personal access tokens)

**Future Enhancement** (if using GitHub Apps with installation tokens):

```typescript
// Installation tokens expire after 1 hour
if (isTokenExpired(token)) {
  const newToken = await refreshInstallationToken(installationId);
  GitHubTokenStore.saveToken(newToken, user);
}
```

---

## Testing Strategy

### Unit Tests

```typescript
describe('GitHubOAuthCallbackHandler', () => {
  it('starts server on available port', async () => {
    const handler = new GitHubOAuthCallbackHandler();
    const port = await handler.startCallbackServer();
    expect(port).toBeGreaterThanOrEqual(3000);
    await handler.stopCallbackServer();
  });

  it('validates OAuth state correctly', () => {
    const expectedState = 'abc123';
    expect(() => handler.validateState('wrong', expectedState)).toThrow('Invalid OAuth state');
    expect(() => handler.validateState('abc123', expectedState)).not.toThrow();
  });

  it('handles expired state', () => {
    const expiredAuth = {
      state: 'abc123',
      expiresAt: Date.now() - 1000 // Expired
    };
    expect(() => handler.validateState('abc123', expiredAuth)).toThrow('expired');
  });
});
```

### Integration Tests

```typescript
describe('Web OAuth Flow', () => {
  it('completes full OAuth cycle', async () => {
    // Mock GitHub API responses
    nock('https://github.com').post('/login/oauth/access_token').reply(200, {
      access_token: 'test_token',
      token_type: 'bearer',
      scope: 'repo,user:email'
    });

    const result = await GitHubAuth.startWebOAuthFlow();
    expect(result.token).toBe('test_token');
  });
});
```

---

## Migration Path

### Detect Auth Method

```typescript
const authState = GitHubAuth.getAuthState();

if (authState.authMethod === 'device_flow') {
  // Show upgrade prompt
  showUpgradeModal({
    title: 'Upgrade GitHub Connection',
    message:
      'Connect to organization repositories with our improved OAuth flow.\n\nYour current connection will continue to work, but we recommend upgrading for better organization support.',
    primaryAction: {
      label: 'Upgrade Now',
      onClick: async () => {
        await GitHubAuth.startWebOAuthFlow();
      }
    },
    secondaryAction: {
      label: 'Maybe Later',
      onClick: () => {
        // Dismiss
      }
    }
  });
}
```

---

## Deployment Checklist

Before releasing Web OAuth Flow:

- [ ] GitHub App callback URL configured in settings
- [ ] Client secret securely stored (not in code)
- [ ] Callback server tested on all platforms (macOS, Windows, Linux)
- [ ] Port conflict handling tested
- [ ] OAuth state validation tested
- [ ] Installation metadata storage tested
- [ ] UI shows connected organizations correctly
- [ ] Disconnect flow clears all data
- [ ] Error messages are user-friendly
- [ ] Documentation updated
- [ ] Migration path from Device Flow tested

---

**Next:** See [IMPLEMENTATION-STEPS.md](./IMPLEMENTATION-STEPS.md) for detailed step-by-step guide.
