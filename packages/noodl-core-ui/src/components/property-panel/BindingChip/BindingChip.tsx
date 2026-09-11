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
 * FB-018 scope 2 — the precedence rule, in the one place it bites.
 *
 * A test user wired a number into Width, typed a width by hand, watched the typed
 * value render, and then watched it revert on refresh. He was reading the system
 * correctly: parameters are queued at node creation and connections attach after
 * (`nodescope.ts`), pushing only once the source output is no longer `undefined`
 * (`node.ts`) — so a typed value really is live until the source next fires.
 *
 * 🔴 THE SECOND SENTENCE IS WORDED TO STAY TRUE IN BOTH STATES, and that is not a
 * stylistic choice. "The connection wins" is FALSE for a source that never fires —
 * which is exactly the state the user was looking at when he got confused, so the
 * obvious wording would have been wrong precisely when it was read. "used only
 * while the connection hasn't sent anything" is true before the first push and
 * after it.
 *
 * It lives on the chip rather than at the call sites so that no row can render a
 * chip without it: the five row classes that already chipped inherit this sentence
 * without being touched, and the rows FB-018 adds cannot forget it.
 */
export function bindingTooltip(source?: string): string {
  const driver = source ? `by ${source}` : 'by a connection';
  return (
    `This input is driven ${driver}. ` +
    `The value you typed is used only while the connection hasn't sent anything.`
  );
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
      title={bindingTooltip(source)}
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
