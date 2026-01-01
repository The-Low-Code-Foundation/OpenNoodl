/**
 * LauncherHeader - Top header for the launcher dashboard
 *
 * Contains logo, version info, and utility actions
 *
 * @module noodl-core-ui/preview/launcher
 */

import React from 'react';

import { IconName } from '@noodl-core-ui/components/common/Icon';
import { Logo } from '@noodl-core-ui/components/common/Logo';
import { TextButton, TextButtonSize } from '@noodl-core-ui/components/inputs/TextButton';
import { DialogRenderDirection } from '@noodl-core-ui/components/layout/BaseDialog';
import { HStack } from '@noodl-core-ui/components/layout/Stack';
import { ContextMenu } from '@noodl-core-ui/components/popups/ContextMenu';
import { TextType } from '@noodl-core-ui/components/typography/Text';
import { Title, TitleSize, TitleVariant } from '@noodl-core-ui/components/typography/Title';

import { useLauncherContext } from '../../LauncherContext';
import { GitHubConnectButton } from '../GitHubConnectButton';
import css from './LauncherHeader.module.scss';

const VERSION_NUMBER = '2.9.3';

export interface LauncherHeaderProps {}

export function LauncherHeader({}: LauncherHeaderProps) {
  const { useMockData, setUseMockData, hasRealProjects, githubIsAuthenticated, githubIsConnecting, onGitHubConnect } =
    useLauncherContext();

  const handleToggleDataSource = () => {
    setUseMockData(!useMockData);
    console.info(`Data source switched to: ${!useMockData ? 'Mock' : 'Real'}`);
  };

  return (
    <div className={css['Root']}>
      <HStack UNSAFE_className={css['Content']}>
        <Logo />
        <div className={css['VersionInfo']}>
          <Title variant={TitleVariant.Highlighted} size={TitleSize.Large}>
            Noodl {VERSION_NUMBER}
          </Title>
        </div>
        <div className={css['Actions']}>
          {/* GitHub OAuth Button - Show when not authenticated */}
          {!githubIsAuthenticated && onGitHubConnect && (
            <GitHubConnectButton onConnect={onGitHubConnect} isConnecting={githubIsConnecting} />
          )}

          {hasRealProjects && (
            <div className={css['DataSourceToggle']}>
              <TextButton
                label={useMockData ? 'Mock Data' : 'Real Data'}
                icon={useMockData ? IconName.CloudData : IconName.Check}
                variant={useMockData ? TextType.Shy : TextType.Proud}
                size={TextButtonSize.Small}
                onClick={handleToggleDataSource}
                testId="data-source-toggle"
              />
            </div>
          )}
          <ContextMenu
            menuItems={[{ label: 'Check for updates', onClick: () => alert('FIXME: check updates') }]}
            renderDirection={DialogRenderDirection.Horizontal}
          />
        </div>
      </HStack>
    </div>
  );
}
