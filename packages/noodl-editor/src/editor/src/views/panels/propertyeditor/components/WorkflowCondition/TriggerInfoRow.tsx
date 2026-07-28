import React, { useCallback, useState } from 'react';

import styles from './WorkflowCondition.module.scss';

export interface TriggerInfoRowProps {
  value: string;
  /** Offer a copy button. The webhook URL is the reason this exists. */
  copyable?: boolean;
  ariaLabel?: string;
}

/**
 * One read-only fact about a trigger (WFA-005).
 *
 * A trigger is a backend object drawn on the canvas as an entry node, so its
 * rows read rather than write — see `WorkflowTriggerInfoType` for why. The copy
 * button is the point of the webhook row: `POST /hooks/<backendId>/<slug>` is
 * the single most-wanted string in this feature, and today it is assembled by
 * hand out of two panels.
 */
export function TriggerInfoRow({ value, copyable, ariaLabel }: TriggerInfoRowProps) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [value]);

  return (
    <div className={styles.TriggerInfo}>
      <span className={styles.TriggerInfoValue} aria-label={ariaLabel} title={value}>
        {value}
      </span>
      {copyable && (
        <button type="button" className={styles.TriggerInfoCopy} onClick={copy} aria-label={`Copy ${ariaLabel || 'value'}`}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      )}
    </div>
  );
}
