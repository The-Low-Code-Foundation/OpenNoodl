/**
 * LauncherFooter - Bottom footer for the launcher dashboard
 *
 * Contains resource links (Documentation, YouTube, Discord)
 *
 * @module noodl-core-ui/preview/launcher
 */

import React from 'react';

import { ExternalLink } from '@noodl-core-ui/components/inputs/ExternalLink';
import { HStack } from '@noodl-core-ui/components/layout/Stack';

import css from './LauncherFooter.module.scss';

export interface LauncherFooterProps {}

export function LauncherFooter({}: LauncherFooterProps) {
  return (
    <div className={css['Root']}>
      <HStack UNSAFE_className={css['Content']} hasSpacing>
        <span className={css['Label']}>Resources:</span>
        <ExternalLink href="https://docs.noodl.net">Documentation</ExternalLink>
        <ExternalLink href="https://youtube.com/@noodlapp">YouTube</ExternalLink>
        <ExternalLink href="https://discord.gg/noodl">Discord</ExternalLink>
      </HStack>
    </div>
  );
}
