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

// Tab order follows the mock, minus Learn.
//
// POL-002: the lesson content predates every project-format change since
// LEARN-001, so the tab led to a catalogue of lessons that no longer play.
// Removed rather than feature-flagged — a flag implies someone will flip it,
// and what the lessons need is the rebuild a later learn phase owns, not a
// switch. `LearningCenter` and the whole lesson pipeline are left in place and
// compiling (the same convention `router.setup.ts` uses for the shelved
// Topology and retired Data Lineage panels); only this entry is gone.
//
// The `Learning` entry is *not* that tab coming back. It is page id
// `'learning'` — UNI-007 / D5's installed-lessons section, which used to sit
// above the project grid and now has its own tab so the launcher opens on your
// projects (Richard, 2026-08-17). `'learn'` is still unreachable.
const HEADER_TABS: HeaderTab[] = [
  { id: 'projects', label: 'Projects' },
  // UNI-011 / D21 — second, not last. Richard's framing on 2026-08-19 was that the community
  // should be visible from the launcher *without going looking for it*; a tab in fourth place
  // beside GitHub is a tab nobody clicks. Projects stays first because it stays the default.
  { id: 'community', label: 'Community' },
  { id: 'learning', label: 'Learning' },
  { id: 'templates', label: 'Templates' },
  { id: 'github', label: 'GitHub' }
];

// PAR-001: on macOS the native traffic lights are inset into the 52px bar
// (trafficLightPosition in main.js); the header reserves a 120px region so the
// wordmark never renders under them. Windows/Linux have no lights to clear.
//
// The other half of that: the window is `frame: false` on every platform, and
// only macOS keeps native buttons (via `titleBarStyle: 'hidden'`). So on
// Windows and Linux the launcher had no minimise/maximise/close at all — the
// editor's `TitleBar` draws them for the in-project chrome, but `BaseWindow`
// wraps `EditorPage` only. These render at the trailing edge, in the platform's
// own order, and are the mirror of the reserved `Lights` region above.
//
// A function rather than a module constant so both branches can actually be
// observed: a constant is frozen at import and the Windows/Linux rendering is
// then unreachable from a Mac, which is how it stayed missing. Exported for the
// same reason `shouldWriteDeepLinkUrl` is — noodl-core-ui has no test runner, so
// the editor's Jasmine suite covers it.
export function isMacPlatform(): boolean {
  return typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
}

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
    onOpenSettings,
    onMinimizeWindow,
    onMaximizeWindow,
    onCloseWindow
  } = useLauncherContext();

  const initials = getAvatarInitials(githubUser?.name, githubUser?.login);

  const isMac = isMacPlatform();

  // All three or none: a close button with no handler is worse than no close
  // button, because the window would then have no way to be shut from its own
  // chrome. Storybook supplies none, so the group is simply absent there.
  const hasWindowControls = Boolean(onMinimizeWindow && onMaximizeWindow && onCloseWindow);

  return (
    <header className={css['Root']}>
      {isMac && <div className={css['Lights']} aria-hidden="true" />}

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

      {!isMac && hasWindowControls && (
        <div className={css['WindowControls']}>
          <button
            type="button"
            className={css['WindowControl']}
            onClick={onMinimizeWindow}
            title="Minimize"
            aria-label="Minimize"
            data-test="launcher-window-minimize"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <path d="M0 5h10" />
            </svg>
          </button>

          <button
            type="button"
            className={css['WindowControl']}
            onClick={onMaximizeWindow}
            title="Maximize"
            aria-label="Maximize"
            data-test="launcher-window-maximize"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <rect x="0.5" y="0.5" width="9" height="9" />
            </svg>
          </button>

          <button
            type="button"
            className={classNames(css['WindowControl'], css['is-close'])}
            onClick={onCloseWindow}
            title="Close"
            aria-label="Close"
            data-test="launcher-window-close"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <path d="M0 0l10 10M10 0L0 10" />
            </svg>
          </button>
        </div>
      )}
    </header>
  );
}
