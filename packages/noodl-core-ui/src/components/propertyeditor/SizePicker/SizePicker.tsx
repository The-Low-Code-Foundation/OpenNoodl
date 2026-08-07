/**
 * STYLE-004: SizePicker
 *
 * Segmented control for selecting an element size preset (sm / md / lg / xl).
 * Only renders the sizes that are defined in the node's ElementConfig.
 *
 * Usage:
 *   <SizePicker
 *     sizes={['sm', 'md', 'lg', 'xl']}
 *     currentSize="md"
 *     onSizeChange={(size) => applySize(node, nodeType, size)}
 *   />
 */

import React, { useCallback } from 'react';

import css from './SizePicker.module.scss';

export interface SizePickerProps {
  /** Available size names in order (e.g. ['sm', 'md', 'lg', 'xl']). */
  sizes: string[];

  /** Currently active size name. */
  currentSize: string | undefined;

  /** Called when the user picks a different size. */
  onSizeChange: (sizeName: string) => void;

  /** Disable all size buttons. */
  disabled?: boolean;

  /** Optional label. Defaults to 'Size'. */
  label?: string;
}

export function SizePicker({ sizes, currentSize, onSizeChange, disabled = false, label = 'Size' }: SizePickerProps) {
  const handleClick = useCallback(
    (size: string) => {
      if (!disabled && size !== currentSize) {
        onSizeChange(size);
      }
    },
    [currentSize, disabled, onSizeChange]
  );

  return (
    <div className={css['SizePicker']}>
      <span className={css['SizePicker-label']}>{label}</span>
      <div className={css['SizePicker-group']} role="group" aria-label={label}>
        {sizes.map((size) => (
          <button
            key={size}
            type="button"
            className={[css['SizePicker-option'], size === currentSize ? css['SizePicker-option--active'] : '']
              .filter(Boolean)
              .join(' ')}
            onClick={() => handleClick(size)}
            disabled={disabled}
            aria-pressed={size === currentSize}
            title={size.toUpperCase()}
          >
            {size}
          </button>
        ))}
      </div>
    </div>
  );
}
