/**
 * CodeHistoryDiffModal Component
 *
 * Shows a side-by-side diff between a snapshot and the code in the editor now,
 * with a restore confirmation.
 *
 * The diff is rendered by {@link CodeDiffView} — the same `@codemirror/merge` view
 * the component-diff document and the AI doc review use. CED-001 (A5) retired the
 * hand-rolled LCS that used to sit alongside it.
 *
 * @module code-editor/CodeHistory
 */

import React, { useMemo } from 'react';

import { CodeDiffView } from '../CodeDiffView';
import { summariseDiff } from '../utils/diffSummary';
import css from './CodeHistoryDiffModal.module.scss';
import { formatTimestamp } from './formatTimestamp';

export interface CodeHistoryDiffModalProps {
  oldCode: string;
  newCode: string;
  timestamp: string;
  onRestore: () => void;
  onClose: () => void;
}

export function CodeHistoryDiffModal({ oldCode, newCode, timestamp, onRestore, onClose }: CodeHistoryDiffModalProps) {
  const summary = useMemo(() => summariseDiff(oldCode, newCode), [oldCode, newCode]);

  return (
    <div className={css.Overlay} onClick={onClose}>
      <div className={css.Modal} onClick={(e) => e.stopPropagation()}>
        <div className={css.Header}>
          <h2 className={css.Title}>Restore code from {formatTimestamp(timestamp)}?</h2>
          <button onClick={onClose} className={css.CloseButton} type="button" title="Close">
            ×
          </button>
        </div>

        <div className={css.DiffContainer}>
          <CodeDiffView original={oldCode} modified={newCode} height="100%" />
        </div>

        {/* Restoring runs the diff backwards: what the snapshot lacks gets removed. */}
        <div className={css.Summary}>
          {summary.added > 0 && <span className={css.Deletions}>• {summary.added} line(s) will be removed</span>}
          {summary.removed > 0 && <span className={css.Additions}>• {summary.removed} line(s) will be added</span>}
          {summary.added === 0 && summary.removed === 0 && <span>• This snapshot matches the current code</span>}
        </div>

        <div className={css.Footer}>
          <button onClick={onClose} className={css.CancelButton} type="button">
            Cancel
          </button>
          <button onClick={onRestore} className={css.RestoreButton} type="button">
            Restore Code
          </button>
        </div>
      </div>
    </div>
  );
}
