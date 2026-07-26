/**
 * LauncherHeader - Top title-bar for the launcher dashboard
 *
 * NodeGX wordmark (coral brand dot — its only sanctioned appearance), the primary
 * tab navigation with an accent underline, a secondary Connect-GitHub button, and
 * the user avatar. Replaces the old logo + "Noodl 2.9.3" version string.
 *
 * @module noodl-core-ui/preview/launcher
 */

import classNames from 'classnames';
import React from 'react';

import { useLauncherContext, LauncherPageId } from '../../LauncherContext';
import { GitHubConnectButton } from '../GitHubConnectButton';
import css from './LauncherHeader.module.scss';

interface HeaderTab {
  id: LauncherPageId;
  label: string;
}

// Tab order follows the mock: Projects, Learn, Templates, GitHub.
const HEADER_TABS: HeaderTab[] = [
  { id: 'projects', label: 'Projects' },
  { id: 'learn', label: 'Learn' },
  { id: 'templates', label: 'Templates' },
  { id: 'github', label: 'GitHub' }
];

function getAvatarInitials(name?: string | null, login?: string | null): string {
  const source = (name || login || '').trim();
  if (!source) return '';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export interface LauncherHeaderProps {}

export function LauncherHeader({}: LauncherHeaderProps) {
  const { activePageId, setActivePageId, githubUser, githubIsAuthenticated, githubIsConnecting, onGitHubConnect } =
    useLauncherContext();

  const initials = getAvatarInitials(githubUser?.name, githubUser?.login);

  return (
    <header className={css['Root']}>
      <div className={css['Wordmark']}>
        <span className={css['BrandDot']} aria-hidden="true" />
        NodeGX
      </div>

      <nav className={css['Tabs']} aria-label="Launcher sections">
        {HEADER_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={css['Tab']}
            aria-current={activePageId === tab.id ? 'page' : undefined}
            onClick={() => setActivePageId(tab.id)}
            data-test={`launcher-tab-${tab.id}`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className={css['Spacer']} />

      <div className={css['Actions']}>
        {!githubIsAuthenticated && onGitHubConnect && (
          <GitHubConnectButton onConnect={onGitHubConnect} isConnecting={githubIsConnecting} />
        )}

        <div
          className={classNames(css['Avatar'], !initials && css['is-anonymous'])}
          title={githubUser?.name || githubUser?.login || 'Not signed in'}
          aria-hidden="true"
        >
          {initials || (
            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="8" cy="5.5" r="2.6" />
              <path d="M2.8 13.4c0-2.6 2.3-4.2 5.2-4.2s5.2 1.6 5.2 4.2" />
            </svg>
          )}
        </div>
      </div>
    </header>
  );
}
