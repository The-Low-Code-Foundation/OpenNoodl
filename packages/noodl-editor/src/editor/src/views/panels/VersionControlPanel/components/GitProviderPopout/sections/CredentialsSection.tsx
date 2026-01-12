import React, { useState, useEffect } from 'react';
import { GitProvider } from '@noodl/git';

import { PrimaryButton } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { TextButton } from '@noodl-core-ui/components/inputs/TextButton';
import { TextInput, TextInputVariant } from '@noodl-core-ui/components/inputs/TextInput';
import { Section, SectionVariant } from '@noodl-core-ui/components/sidebar/Section';
import { Text } from '@noodl-core-ui/components/typography/Text';

import { GitHubAuth, type GitHubAuthState } from '../../../../../../services/github';

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

  // OAuth state management
  const [authState, setAuthState] = useState<GitHubAuthState>(GitHubAuth.getAuthState());
  const [isConnecting, setIsConnecting] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Check auth state on mount
  useEffect(() => {
    if (provider === 'github') {
      setAuthState(GitHubAuth.getAuthState());
    }
  }, [provider]);

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);
    setProgressMessage('Initiating GitHub authentication...');

    try {
      await GitHubAuth.startWebOAuthFlow((message) => {
        setProgressMessage(message);
      });

      // Update state after successful auth
      setAuthState(GitHubAuth.getAuthState());
      setProgressMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
      setProgressMessage('');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    GitHubAuth.disconnect();
    setAuthState(GitHubAuth.getAuthState());
    setError(null);
  };

  return (
    <>
      {/* OAuth Section - GitHub Only */}
      {provider === 'github' && (
        <Section title="GitHub Account (Recommended)" variant={SectionVariant.InModal} hasGutter>
          {authState.isAuthenticated ? (
            // Connected state
            <>
              <Text hasBottomSpacing>
                ✓ Connected as <strong>{authState.username}</strong>
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
