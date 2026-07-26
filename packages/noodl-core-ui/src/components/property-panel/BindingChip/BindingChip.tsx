import React from 'react';

import css from './BindingChip.module.scss';

export interface BindingChipProps {
  /**
   * The connection source, e.g. "CallCF · Result". Rendered in a mono face.
   * When omitted the chip reads a generic "Connected".
   */
  source?: string;
  /** Optional click-to-navigate handler (read-only affordance if omitted). */
  onClick?: () => void;
}

/**
 * Shown in place of a dead disabled input when a property's value comes from a
 * connection. Accent-soft chip naming the source (mock: "Bound to CallCF · Result").
 */
export function BindingChip({ source, onClick }: BindingChipProps) {
  const isInteractive = Boolean(onClick);

  return (
    <span
      className={css['Root']}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        isInteractive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M6.5 9.5 9.5 6.5M5 11a2.5 2.5 0 0 1 0-3.5l1.7-1.7M11 5a2.5 2.5 0 0 1 0 3.5l-1.7 1.7" transform="rotate(45 8 8)" />
      </svg>
      {source ? (
        <span className={css['Text']}>
          Bound to <code>{source}</code>
        </span>
      ) : (
        <span className={css['Text']}>Connected</span>
      )}
    </span>
  );
}
