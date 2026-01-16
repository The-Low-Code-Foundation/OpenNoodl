import React from 'react';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { IconButton, IconButtonVariant } from '@noodl-core-ui/components/inputs/IconButton';
import { Tooltip } from '@noodl-core-ui/components/popups/Tooltip';
import { UnsafeStyleProps } from '@noodl-core-ui/types/global';

import css from './ExpressionToggle.module.scss';

export interface ExpressionToggleProps extends UnsafeStyleProps {
  /** Current mode: 'fixed' for static values, 'expression' for dynamic expressions */
  mode: 'fixed' | 'expression';

  /** Whether the port is connected via a cable (disables expression toggle) */
  isConnected?: boolean;

  /** Callback when toggle is clicked */
  onToggle: () => void;

  /** Whether the toggle is disabled */
  isDisabled?: boolean;

  /** Test ID for automation */
  testId?: string;
}

/**
 * ExpressionToggle
 *
 * Toggle button that switches a property between fixed value mode and expression mode.
 * Shows a connection indicator when the port is connected via cable.
 *
 * @example
 * ```tsx
 * <ExpressionToggle
 *   mode="fixed"
 *   onToggle={() => setMode(mode === 'fixed' ? 'expression' : 'fixed')}
 * />
 * ```
 */
export function ExpressionToggle({
  mode,
  isConnected = false,
  onToggle,
  isDisabled = false,
  testId,
  UNSAFE_className,
  UNSAFE_style
}: ExpressionToggleProps) {
  // If connected via cable, show connection indicator instead of toggle
  if (isConnected) {
    return (
      <Tooltip content="Connected via cable">
        <div className={css['ConnectionIndicator']} data-test={testId} style={UNSAFE_style}>
          <Icon icon={IconName.Link} size={IconSize.Tiny} />
        </div>
      </Tooltip>
    );
  }

  const isExpressionMode = mode === 'expression';

  const tooltipContent = isExpressionMode ? 'Switch to fixed value' : 'Switch to expression';

  // When in expression mode, show TextInBox icon (switch to fixed value)
  // When in fixed mode, show "fx" text button (switch to expression)
  if (isExpressionMode) {
    return (
      <Tooltip content={tooltipContent}>
        <div className={css['Root']} style={UNSAFE_style}>
          <IconButton
            icon={IconName.TextInBox}
            size={IconSize.Tiny}
            variant={IconButtonVariant.Default}
            onClick={onToggle}
            isDisabled={isDisabled}
            testId={testId}
            UNSAFE_className={css['ExpressionActive']}
          />
        </div>
      </Tooltip>
    );
  }

  // Fixed mode - show "fx" text button
  return (
    <Tooltip content={tooltipContent}>
      <button
        type="button"
        className={`${css['FxButton']} ${isDisabled ? css['is-disabled'] : ''} ${UNSAFE_className || ''}`}
        style={UNSAFE_style}
        onClick={isDisabled ? undefined : onToggle}
        disabled={isDisabled}
        data-test={testId}
      >
        fx
      </button>
    </Tooltip>
  );
}
