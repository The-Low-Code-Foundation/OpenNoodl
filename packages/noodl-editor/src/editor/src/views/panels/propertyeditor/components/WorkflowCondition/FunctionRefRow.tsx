/**
 * The `ref` row: which cloud function this step calls, and whether it is there
 * (WFA-006 §2, §3).
 *
 * The card can only carry a few words, and a dialog only appears when you ask
 * for it. This row is where the whole answer lives, on selection, with no
 * interaction: what the step points at, which of the four states it is in, and
 * the one or two things worth doing about it.
 *
 * THE NAME IS STILL FREE TEXT, and deliberately — WFA-005 made the same call for
 * a trigger's target. A function that has not been written yet is a legitimate
 * thing to name, and refusing it would make the editor unable to express a
 * workflow you are part-way through building. What changed is that a name which
 * resolves to nothing is now *flagged* rather than silently accepted, and the
 * names that do exist are one click away — which is also what makes §7's
 * decision liveable: after a rename, retargeting is picking the new name from a
 * list.
 *
 * @module views/panels/propertyeditor/components/WorkflowCondition/FunctionRefRow
 */

import React, { useCallback, useState } from 'react';

import type { RefResolution } from '@noodl-models/workflow/functionRefResolution';

import styles from './WorkflowCondition.module.scss';

export interface FunctionRefRowProps {
  value: string;
  onChange: (value: string) => void;
  resolution: RefResolution | null;
  /** Names that exist — in this project, and on this backend. */
  suggestions: { name: string; where: string }[];
  /** Open the function's graph. Absent when there is nothing to open. */
  onOpen?: () => void;
  /** Push the project's functions to this backend. Absent unless that would help. */
  onDeploy?: () => void;
  ariaLabel?: string;
}

export function FunctionRefRow({
  value,
  onChange,
  resolution,
  suggestions,
  onOpen,
  onDeploy,
  ariaLabel
}: FunctionRefRowProps) {
  const [draft, setDraft] = useState(value);
  const [deploying, setDeploying] = useState(false);

  // The parameter is the source of truth; the draft only exists between
  // keystrokes. A rename elsewhere must be able to overwrite what is shown.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(value);
  }

  const commit = useCallback(() => {
    if (draft !== value) onChange(draft);
  }, [draft, onChange, value]);

  const deploy = useCallback(async () => {
    if (!onDeploy) return;
    setDeploying(true);
    try {
      await onDeploy();
    } finally {
      setDeploying(false);
    }
  }, [onDeploy]);

  // Only an actually-broken step is painted in the danger token — phase 23's
  // law. "Deployed but not in this project" and "could not be asked" are stated
  // in the quiet token, because neither is an error.
  const isBroken = resolution?.state === 'unresolved' || resolution?.state === 'unnamed';

  return (
    <div className={styles.Value}>
      <div className={styles.ValueRow}>
        <input
          className={styles.Input}
          value={draft}
          aria-label={ariaLabel || 'Function'}
          data-test="workflow-step-ref"
          placeholder="cloud function name"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
      </div>

      {resolution && (
        <div
          className={isBroken ? styles.Error : styles.Hint}
          data-test="workflow-step-ref-state"
          data-state={resolution.state}
        >
          {resolution.message}
        </div>
      )}

      {(onOpen || onDeploy) && (
        <div className={styles.RootActions}>
          {onOpen && (
            <button type="button" className={styles.SmallButton} onClick={onOpen} data-test="workflow-step-ref-open">
              Open graph
            </button>
          )}
          {onDeploy && (
            <button
              type="button"
              className={styles.SmallButton}
              onClick={deploy}
              disabled={deploying}
              data-test="workflow-step-ref-deploy"
            >
              {deploying ? 'Deploying…' : 'Deploy it'}
            </button>
          )}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className={styles.PathHelpers}>
          {suggestions.map((s) => (
            <button
              key={`${s.where}:${s.name}`}
              type="button"
              className={styles.Chip}
              title={s.where}
              onClick={() => {
                setDraft(s.name);
                onChange(s.name);
              }}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
