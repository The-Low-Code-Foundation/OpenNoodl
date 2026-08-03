/**
 * LauncherPage - main-column page scaffold (PAR-001)
 *
 * Mock anatomy: padding 28px 32px 20px; head row = sentence-case Bricolage h1
 * (600/24px, letter-spacing -.015em) + spacer + action slot, margin-bottom 20.
 *
 * @module noodl-core-ui/preview/launcher
 */

import React from 'react';

import css from './LauncherPage.module.scss';

export interface LauncherPageProps {
  title: string;
  children?: React.JSX.Element | React.JSX.Element[];
  headerSlot?: React.JSX.Element | React.JSX.Element[];
}

export function LauncherPage({ title, children, headerSlot }: LauncherPageProps) {
  return (
    <div className={css['Root']}>
      <div className={css['HeadRow']}>
        <h1 className={css['Title']}>{title}</h1>
        <div className={css['Spacer']} />
        {headerSlot && <div className={css['Actions']}>{headerSlot}</div>}
      </div>
      {children}
    </div>
  );
}
