/**
 * GitHubConnectButton
 *
 * The titlebar's `Connect GitHub` action — a SECONDARY button (bg-2, border-2)
 * with the 15px GitHub mark, per the launcher mock (PAR-001). Initiates the
 * GitHub OAuth flow.
 */

import React from 'react';

import {
  LauncherButton,
  LauncherButtonVariant
} from '@noodl-core-ui/preview/launcher/Launcher/components/LauncherButton';

export interface GitHubConnectButtonProps {
  onConnect: () => void;
  isConnecting?: boolean;
}

const GitHubMark = (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M8 .6a7.4 7.4 0 0 0-2.34 14.42c.37.07.5-.16.5-.36v-1.25c-2.06.45-2.49-.99-2.49-.99-.34-.86-.82-1.09-.82-1.09-.67-.46.05-.45.05-.45.74.05 1.13.76 1.13.76.66 1.13 1.73.8 2.15.61.07-.48.26-.8.47-.99-1.64-.19-3.37-.82-3.37-3.66 0-.8.29-1.47.76-1.98-.08-.19-.33-.94.07-1.96 0 0 .62-.2 2.03.76a7.07 7.07 0 0 1 3.7 0c1.41-.96 2.03-.76 2.03-.76.4 1.02.15 1.77.07 1.96.47.51.76 1.17.76 1.98 0 2.85-1.73 3.47-3.38 3.65.27.23.5.68.5 1.37v2.04c0 .2.13.43.51.36A7.4 7.4 0 0 0 8 .6Z" />
  </svg>
);

export function GitHubConnectButton({ onConnect, isConnecting = false }: GitHubConnectButtonProps) {
  return (
    <LauncherButton
      label={isConnecting ? 'Connecting…' : 'Connect GitHub'}
      variant={LauncherButtonVariant.Secondary}
      icon={GitHubMark}
      isDisabled={isConnecting}
      onClick={onConnect}
    />
  );
}
