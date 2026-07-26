/**
 * LauncherFooter - Bottom footer for the launcher dashboard
 *
 * Quiet resource links (Documentation, YouTube, Discord) and a right-aligned
 * `NodeGX {version}` wordmark in mono.
 *
 * @module noodl-core-ui/preview/launcher
 */

import React from 'react';

import { ExternalLink } from '@noodl-core-ui/components/inputs/ExternalLink';

import { useLauncherContext } from '../../LauncherContext';
import css from './LauncherFooter.module.scss';

export interface LauncherFooterProps {}

export function LauncherFooter({}: LauncherFooterProps) {
  const { appVersion } = useLauncherContext();

  return (
    <footer className={css['Root']}>
      <ExternalLink href="https://docs.noodl.net">Documentation</ExternalLink>
      <ExternalLink href="https://youtube.com/@noodlapp">YouTube</ExternalLink>
      <ExternalLink href="https://discord.gg/noodl">Discord</ExternalLink>
      <div className={css['Spacer']} />
      <span className={css['Version']}>NodeGX {appVersion || '0.1.0'}</span>
    </footer>
  );
}
