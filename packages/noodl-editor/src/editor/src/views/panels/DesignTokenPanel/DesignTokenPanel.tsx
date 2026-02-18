/**
 * STYLE-001: Enhanced Design Token Panel
 *
 * Replaces the basic experimental panel with a proper collapsible category system.
 * Shows all Tailwind-inspired design tokens grouped by category (Colors, Spacing, etc.)
 * with visual previews and support for editing token values.
 */

import React from 'react';

import { Tabs, TabsVariant } from '@noodl-core-ui/components/layout/Tabs';
import { BasePanel } from '@noodl-core-ui/components/sidebar/BasePanel';

import { ColorsTab } from './components/ColorsTab';
import { DesignTokensTab } from './components/DesignTokensTab';

export function DesignTokenPanel() {
  return (
    <BasePanel title="Design Tokens">
      <Tabs
        variant={TabsVariant.Sidebar}
        tabs={[
          {
            label: 'Tokens',
            content: <DesignTokensTab />
          },
          {
            label: 'Colors',
            content: <ColorsTab />
          }
        ]}
      />
    </BasePanel>
  );
}
