/**
 * Templates View - Project template browser
 *
 * Displays available project templates for quick starts
 *
 * @module noodl-core-ui/preview/launcher
 */

import React from 'react';

import { Box } from '@noodl-core-ui/components/layout/Box';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';
import { Title, TitleSize } from '@noodl-core-ui/components/typography/Title';

export interface TemplatesViewProps {}

export function Templates({}: TemplatesViewProps) {
  return (
    <Box hasXSpacing hasYSpacing>
      <Box hasBottomSpacing>
        <Title size={TitleSize.Large}>Templates</Title>
      </Box>
      <div style={{ color: 'var(--theme-color-fg-default-shy)' }}>
        Project templates will be displayed here. This feature is coming soon!
      </div>
    </Box>
  );
}
