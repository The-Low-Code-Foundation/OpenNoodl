import React, { useState, useEffect, useCallback, useRef } from 'react';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { Tooltip } from '@noodl-core-ui/components/popups/Tooltip';
import { UnsafeStyleProps } from '@noodl-core-ui/types/global';

import css from './ExpressionInput.module.scss';

export interface ExpressionInputProps extends UnsafeStyleProps {
  /** The expression string */
  expression: string;

  /** Callback when expression changes (debounced) */
  onChange: (expression: string) => void;

  /** Callback when input loses focus */
  onBlur?: () => void;

  /** Whether the expression has an error */
  hasError?: boolean;

  /** Error message to show in tooltip */
  errorMessage?: string;

  /** Placeholder text */
  placeholder?: string;

  /** Test ID for automation */
  testId?: string;

  /** Debounce delay in milliseconds */
  debounceMs?: number;
}

/**
 * ExpressionInput
 *
 * A specialized input field for entering JavaScript expressions.
 * Features monospace font, "fx" badge, and error indication.
 *
 * @example
 * ```tsx
 * <ExpressionInput
 *   expression="Variables.x * 2"
 *   onChange={(expr) => updateExpression(expr)}
 *   hasError={false}
 * />
 * ```
 */
export function ExpressionInput({
  expression,
  onChange,
  onBlur,
  hasError = false,
  errorMessage,
  placeholder = 'Enter expression...',
  testId,
  debounceMs = 300,
  UNSAFE_className,
  UNSAFE_style
}: ExpressionInputProps) {
  const [localValue, setLocalValue] = useState(expression);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Update local value when prop changes
  useEffect(() => {
    setLocalValue(expression);
  }, [expression]);

  // Debounced onChange handler
  const debouncedOnChange = useCallback(
    (value: string) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        onChange(value);
      }, debounceMs);
    },
    [onChange, debounceMs]
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    debouncedOnChange(newValue);
  };

  const handleBlur = () => {
    // Cancel debounce and apply immediately on blur
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (localValue !== expression) {
      onChange(localValue);
    }
    onBlur?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // Apply immediately on Enter
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      onChange(localValue);
      e.currentTarget.blur();
    }
  };

  return (
    <div
      className={`${css['Root']} ${hasError ? css['HasError'] : ''} ${UNSAFE_className || ''}`}
      style={UNSAFE_style}
      data-test={testId}
    >
      <span className={css['Badge']}>fx</span>
      <input
        type="text"
        className={css['Input']}
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
      />
      {hasError && errorMessage && (
        <Tooltip content={errorMessage}>
          <div className={css['ErrorIndicator']}>
            <Icon icon={IconName.WarningCircle} size={IconSize.Tiny} />
          </div>
        </Tooltip>
      )}
    </div>
  );
}
