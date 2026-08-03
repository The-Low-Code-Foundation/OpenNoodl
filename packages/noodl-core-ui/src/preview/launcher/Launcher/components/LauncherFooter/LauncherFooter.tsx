/**
 * LauncherFooter - Bottom footer for the launcher dashboard
 *
 * Quiet resource links (Documentation, YouTube, Discord) as PLAIN text links —
 * the mock carries no external-link icons (PAR-001) — and a right-aligned
 * `NodeGX {version}` wordmark in mono.
 *
 * @module noodl-core-ui/preview/launcher
 */

import React from 'react';

import { platform } from '@noodl/platform';

import { EXTERNAL_LINKS } from '@noodl-core-ui/constants/externalLinks';

import { useLauncherContext } from '../../LauncherContext';
import css from './LauncherFooter.module.scss';

export interface LauncherFooterProps {}

function FooterLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      className={css['Link']}
      href={href}
      onClick={(e) => {
        e.preventDefault();
        platform.openExternal(href);
      }}
    >
      {children}
    </a>
  );
}

export function LauncherFooter({}: LauncherFooterProps) {
  const { appVersion } = useLauncherContext();

  return (
    <footer className={css['Root']}>
      <FooterLink href={EXTERNAL_LINKS.docs}>Documentation</FooterLink>
      <FooterLink href={EXTERNAL_LINKS.youtube}>YouTube</FooterLink>
      <FooterLink href={EXTERNAL_LINKS.discord}>Discord</FooterLink>
      <div className={css['Spacer']} />
      <span className={css['Version']}>NodeGX {appVersion || '0.1.0'}</span>
    </footer>
  );
}
