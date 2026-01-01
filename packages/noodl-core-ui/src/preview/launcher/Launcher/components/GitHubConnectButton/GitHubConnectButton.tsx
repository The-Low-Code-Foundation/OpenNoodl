/**
 * GitHubConnectButton
 *
 * Button component for initiating GitHub OAuth flow
 */

import React from 'react';

import { PrimaryButton } from '@noodl-core-ui/components/inputs/PrimaryButton';

import css from './GitHubConnectButton.module.scss';

export interface GitHubConnectButtonProps {
  onConnect: () => void;
  isConnecting?: boolean;
}

export function GitHubConnectButton({ onConnect, isConnecting = false }: GitHubConnectButtonProps) {
  return (
    <div className={css.Root}>
      <PrimaryButton
        label={isConnecting ? 'Connecting...' : 'Connect with GitHub'}
        onClick={onConnect}
        isDisabled={isConnecting}
      />
      <p className={css.Description}>Connect to access your repositories and enable version control features.</p>
    </div>
  );
}
