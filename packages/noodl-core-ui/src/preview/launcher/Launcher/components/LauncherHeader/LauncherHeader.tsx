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

// PAR-001: on macOS the native traffic lights are inset into the 52px bar
// (trafficLightPosition in main.js); the header reserves a 120px region so the
// wordmark never renders under them. Windows/Linux have no lights to clear.
const IS_MAC = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);

function getAvatarInitials(name?: string | null, login?: string | null): string {
  const source = (name || login || '').trim();
  if (!source) return '';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export interface LauncherHeaderProps {}

export function LauncherHeader({}: LauncherHeaderProps) {
  const {
    activePageId,
    setActivePageId,
    githubUser,
    githubIsAuthenticated,
    githubIsConnecting,
    onGitHubConnect,
    onOpenSettings
  } = useLauncherContext();

  const initials = getAvatarInitials(githubUser?.name, githubUser?.login);

  return (
    <header className={css['Root']}>
      {IS_MAC && <div className={css['Lights']} aria-hidden="true" />}

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

        {/* Theme and the AI provider/key are app-wide, and both were previously
            reachable only from inside an open project. An inline glyph rather
            than the icon font, matching the avatar beside it. */}
        {onOpenSettings && (
          <button
            type="button"
            className={css['SettingsButton']}
            onClick={onOpenSettings}
            title="Settings"
            aria-label="Settings"
            data-test="launcher-settings"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="8" cy="8" r="2.4" />
              <path d="M8 1.6l.9 1.7 1.9-.3.6 1.8 1.8.6-.3 1.9 1.7.9-1.7.9.3 1.9-1.8.6-.6 1.8-1.9-.3-.9 1.7-.9-1.7-1.9.3-.6-1.8-1.8-.6.3-1.9L1.6 8l1.7-.9-.3-1.9 1.8-.6.6-1.8 1.9.3z" />
            </svg>
          </button>
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
