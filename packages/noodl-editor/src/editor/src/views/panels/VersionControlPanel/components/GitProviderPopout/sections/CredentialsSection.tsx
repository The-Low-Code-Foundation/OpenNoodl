import { useEventListener } from '@noodl-hooks/useEventListener';
import React, { useState, useEffect } from 'react';
import { GitProvider } from '@noodl/git';

import { PrimaryButton } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { TextButton } from '@noodl-core-ui/components/inputs/TextButton';
import { TextInput, TextInputVariant } from '@noodl-core-ui/components/inputs/TextInput';
import { Section, SectionVariant } from '@noodl-core-ui/components/sidebar/Section';
import { Text } from '@noodl-core-ui/components/typography/Text';

import { GitHubOAuthService } from '../../../../../../services/github';

type CredentialsSectionProps = {
  provider: GitProvider;
  username: string;
  password: string;
  onUserNameChanged: (username: string) => void;
  onPasswordChanged: (password: string) => void;
};

export function CredentialsSection({
  provider,
  username,
  password,
  onUserNameChanged,
  onPasswordChanged
}: CredentialsSectionProps) {
  const passwordLabel = provider === 'github' ? 'Personal Access Token' : 'Password';
  const showUsername = provider !== 'github';

  const [hidePassword, setHidePassword] = useState(true);

  // OAuth state management using GitHubOAuthService
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authenticatedUsername, setAuthenticatedUsername] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const oauthService = GitHubOAuthService.instance;

  // Initialize OAuth service on mount
  useEffect(() => {
    if (provider === 'github') {
      console.log('🔧 [CredentialsSection] Initializing GitHubOAuthService...');
      oauthService.initialize().then(() => {
        setIsAuthenticated(oauthService.isAuthenticated());
        const user = oauthService.getCurrentUser();
        setAuthenticatedUsername(user?.login || null);
        console.log('🔧 [CredentialsSection] Auth state:', oauthService.isAuthenticated(), user?.login);
      });
    }
  }, [provider, oauthService]);

  // Listen for auth state changes
  useEventListener(oauthService, 'auth-state-changed', (event: { authenticated: boolean }) => {
    console.log('🔔 [CredentialsSection] Auth state changed:', event.authenticated);
    setIsAuthenticated(event.authenticated);
    if (event.authenticated) {
      const user = oauthService.getCurrentUser();
      setAuthenticatedUsername(user?.login || null);
    } else {
      setAuthenticatedUsername(null);
    }
  });

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);
    setProgressMessage('Opening GitHub in your browser...');

    try {
      await oauthService.initiateOAuth();

      // F63: the code itself is shown by the device-code dialog, which opens
      // itself off the service's event — this line only explains why the panel
      // is sitting still. Repeating the code here would be a second copy to
      // keep in step with a flow this panel does not own.
      setProgressMessage('Enter the code shown to finish signing in…');
    } catch (err) {
      console.error('❌ [CredentialsSection] GitHub sign-in error:', err);
      setError(err instanceof Error ? err.message : 'Authentication failed');
      setProgressMessage('');
      setIsConnecting(false);
    }
  };

  // Listen for auth success to clear connecting state
  useEventListener(oauthService, 'oauth-success', () => {
    setIsConnecting(false);
    setProgressMessage('');
  });

  useEventListener(oauthService, 'oauth-error', (event: { error: string }) => {
    setIsConnecting(false);
    setError(event.error);
    setProgressMessage('');
  });

  // A flow the user cancelled from the dialog must not leave this button stuck
  // reading "Connecting…" forever — cancellation raises no error.
  useEventListener(oauthService, 'oauth-cancelled', () => {
    setIsConnecting(false);
    setProgressMessage('');
  });

  const handleDisconnect = async () => {
    await oauthService.disconnect();
    setError(null);
  };

  return (
    <>
      {/* OAuth Section - GitHub Only */}
      {provider === 'github' && (
        <Section title="GitHub Account (Recommended)" variant={SectionVariant.InModal} hasGutter>
          {isAuthenticated ? (
            // Connected state
            <>
              <Text hasBottomSpacing>
                ✓ Connected as <strong>{authenticatedUsername}</strong>
              </Text>
              <Text hasBottomSpacing>Your GitHub account is connected and will be used for all Git operations.</Text>
              <TextButton label="Disconnect GitHub Account" onClick={handleDisconnect} />
            </>
          ) : (
            // Not connected state
            <>
              <Text hasBottomSpacing>
                Connect your GitHub account for the best experience. This enables advanced features and is more secure
                than Personal Access Tokens.
              </Text>

              {isConnecting && progressMessage && <Text hasBottomSpacing>{progressMessage}</Text>}

              {error && <Text hasBottomSpacing>{error}</Text>}

              <PrimaryButton
                label={isConnecting ? 'Connecting...' : 'Connect GitHub Account'}
                onClick={handleConnect}
                isDisabled={isConnecting}
              />
            </>
          )}
        </Section>
      )}

      {/* PAT Section - Existing, now as fallback for GitHub */}
      <Section
        title={provider === 'github' ? 'Or use Personal Access Token' : getTitle(provider)}
        variant={SectionVariant.InModal}
        hasGutter
      >
        {showUsername && (
          <TextInput
            hasBottomSpacing
            label="Username"
            value={username}
            variant={TextInputVariant.InModal}
            onChange={(ev) => onUserNameChanged(ev.target.value)}
          />
        )}
        <TextInput
          hasBottomSpacing
          label={passwordLabel}
          type={hidePassword ? 'password' : 'text'}
          value={password}
          variant={TextInputVariant.InModal}
          onChange={(ev) => onPasswordChanged(ev.target.value)}
          onFocus={() => setHidePassword(false)}
          onBlur={() => setHidePassword(true)}
        />

        <Text hasBottomSpacing>The credentials are saved encrypted locally per project.</Text>
        {provider === 'github' && !password?.length && (
          <a
            href="https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens"
            target="_blank"
            rel="noreferrer"
          >
            How to create a personal access token
          </a>
        )}
      </Section>
    </>
  );
}

function getTitle(provider: GitProvider) {
  if (provider === 'github') {
    return 'GitHub Credentials';
  }
  return 'Git Credentials';
}
