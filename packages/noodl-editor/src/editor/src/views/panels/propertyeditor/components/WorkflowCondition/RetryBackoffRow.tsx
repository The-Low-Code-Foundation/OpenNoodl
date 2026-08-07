import React from 'react';

import { backoffSummary, type BackoffPolicy } from '@noodl-models/workflow/retryBackoff';

import styles from './WorkflowCondition.module.scss';

/** What the executor falls back to when a param is unset — see `retryBackoff`. */
const DEFAULT_ATTEMPTS = 3;

export interface RetryBackoffRowProps {
  value: unknown;
  onChange: (value: number | undefined) => void;
  /** The sibling backoff params, read off the same node. */
  policy: BackoffPolicy;
  ariaLabel?: string;
}

/**
 * `maxAttempts`, with the delay sequence it implies (CWF-005 S1).
 *
 * Two of Retry's seven knobs lied, and both lies were in the field NAME rather
 * than in the description — which is the whole problem, because a description is
 * read once and a field name is read every time:
 *   - `maxAttempts` counts the FIRST call, so `1` means "no retry" and was
 *     accepted in silence. The label now says "Total attempts (incl. the first)",
 *     served from the catalog, and `1` says out loud what it does.
 *   - the delay sequence was five numbers you had to multiply together. This row
 *     does the arithmetic, which is the fix that stops seven knobs being seven
 *     knobs.
 *
 * It reads its siblings rather than owning them: the other four stay their own
 * rows, because each is individually meaningful. What was missing was anywhere
 * that showed their product.
 *
 * The "1 means no retry" line is a HINT, not an error. `1` is legal, saveable and
 * occasionally meant; what it was not, before this, was visible.
 */
export function RetryBackoffRow({ value, onChange, policy, ariaLabel }: RetryBackoffRowProps) {
  const attempts = typeof value === 'number' ? value : undefined;
  const noRetry = attempts !== undefined && attempts <= 1;

  return (
    <div className={styles.Value}>
      <div className={styles.ValueRow}>
        <input
          className={styles.Input}
          type="number"
          min={1}
          step={1}
          value={attempts === undefined ? '' : String(attempts)}
          placeholder={String(DEFAULT_ATTEMPTS)}
          aria-label={ariaLabel || 'Total attempts'}
          onChange={(e) => {
            const t = e.target.value.trim();
            onChange(t === '' ? undefined : Number(t));
          }}
        />
      </div>

      {noRetry && <div className={styles.Hint}>1 means no retry — the function is called once.</div>}

      <div className={styles.Hint}>{backoffSummary({ ...policy, maxAttempts: value })}</div>
    </div>
  );
}
