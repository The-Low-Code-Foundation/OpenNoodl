import classNames from 'classnames';
import React from 'react';

import css from './NodePickerFooter.module.scss';

export interface KbdProps {
  children: React.ReactNode;
  UNSAFE_className?: string;
}

/** A key cap. Shared by the footer hints and the "esc to close" affordance. */
export function Kbd({ children, UNSAFE_className }: KbdProps) {
  return <span className={classNames(css['Kbd'], UNSAFE_className)}>{children}</span>;
}

export interface NodePickerFooterProps {
  /** Shortcut hints, left aligned. */
  hints?: { keys: string[]; label: string }[];
  /** Right-aligned status line describing what the results currently are. */
  status?: string;
}

/**
 * The persistent hint bar (UIX-013).
 *
 * The picker is keyboard-first, so it says so — permanently, rather than
 * expecting the shortcut to be discovered. Hints are only listed for shortcuts
 * that actually do something: "⌥⏎ insert & connect" is in the mock, but the
 * picker is never told which port a connection would come from (no call site
 * passes one), so the hint is not shown. See UIX-013-NOTES.
 */
export function NodePickerFooter({ hints = [], status }: NodePickerFooterProps) {
  return (
    <div className={css['Root']}>
      {hints.map((hint) => (
        <span key={hint.label} className={css['Hint']}>
          {hint.keys.map((key) => (
            <Kbd key={key}>{key}</Kbd>
          ))}
          {hint.label}
        </span>
      ))}

      <span className={css['Spacer']} />

      {Boolean(status) && <span className={css['Hint']}>{status}</span>}
    </div>
  );
}
