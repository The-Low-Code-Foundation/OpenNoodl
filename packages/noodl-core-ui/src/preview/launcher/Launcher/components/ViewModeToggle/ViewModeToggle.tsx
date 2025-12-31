import React from 'react';

import { IconName } from '@noodl-core-ui/components/common/Icon';
import { IconButton, IconButtonState } from '@noodl-core-ui/components/inputs/IconButton';
import { HStack } from '@noodl-core-ui/components/layout/Stack';
import { Tooltip } from '@noodl-core-ui/components/popups/Tooltip';

import css from './ViewModeToggle.module.scss';

/**
 * View modes for displaying projects
 */
export enum ViewMode {
  /** Compact list/table view */
  List = 'list',
  /** Visual grid/card view */
  Grid = 'grid'
}

export interface ViewModeToggleProps {
  /** Currently active view mode */
  mode: ViewMode;
  /** Callback when view mode changes */
  onChange: (mode: ViewMode) => void;
}

/**
 * ViewModeToggle
 *
 * Toggle button for switching between list and grid view modes.
 * Shows visual icons for each mode with tooltips.
 */
export function ViewModeToggle({ mode, onChange }: ViewModeToggleProps) {
  return (
    <HStack hasSpacing={1} UNSAFE_className={css.Root}>
      <Tooltip content="List view" showAfterMs={200}>
        <IconButton
          icon={IconName.VerticalSplit}
          state={mode === ViewMode.List ? IconButtonState.Active : IconButtonState.Default}
          onClick={() => onChange(ViewMode.List)}
          UNSAFE_className={css.Button}
        />
      </Tooltip>

      <Tooltip content="Grid view" showAfterMs={200}>
        <IconButton
          icon={IconName.Cards}
          state={mode === ViewMode.Grid ? IconButtonState.Active : IconButtonState.Default}
          onClick={() => onChange(ViewMode.Grid)}
          UNSAFE_className={css.Button}
        />
      </Tooltip>
    </HStack>
  );
}
