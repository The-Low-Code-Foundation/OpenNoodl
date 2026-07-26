/**
 * Templates View - Project template browser
 *
 * Displays available project templates for quick starts
 *
 * @module noodl-core-ui/preview/launcher
 */

import React from 'react';

import { LauncherPage } from '@noodl-core-ui/preview/launcher/Launcher/components/LauncherPage';

export interface TemplatesViewProps {}

export function Templates({}: TemplatesViewProps) {
  return (
    <LauncherPage title="Templates">
      <div style={{ color: 'var(--theme-color-fg-muted)', fontSize: 13 }}>
        Project templates will be displayed here. This feature is coming soon!
      </div>
    </LauncherPage>
  );
}
