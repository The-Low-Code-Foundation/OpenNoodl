/**
 * CodeHistoryDiffModal Component
 *
 * Shows a side-by-side diff comparison between code versions.
 * This is the KILLER feature - beautiful visual diff with restore confirmation.
 *
 * @module code-editor/CodeHistory
 */

import React, { useMemo } from 'react';

import { computeDiff, getContextualDiff } from '../utils/codeDiff';
import css from './CodeHistoryDiffModal.module.scss';

export interface CodeHistoryDiffModalProps {
  oldCode: string;
  newCode: string;
  timestamp: string;
  onRestore: () => void;
  onClose: () => void;
}

// Format timestamp
function formatTimestamp(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMin = Math.floor(diffMs / 1000 / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 60) {
    return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  } else if (diffHour < 24) {
    return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;
  } else if (diffDay === 1) {
    return 'yesterday';
  } else {
    return `${diffDay} days ago`;
  }
}

export function CodeHistoryDiffModal({ oldCode, newCode, timestamp, onRestore, onClose }: CodeHistoryDiffModalProps) {
  // Compute diff
  const diff = useMemo(() => {
    const fullDiff = computeDiff(oldCode, newCode);
    const contextualLines = getContextualDiff(fullDiff, 3);
    return {
      full: fullDiff,
      lines: contextualLines
    };
  }, [oldCode, newCode]);

  // Split into old and new for side-by-side view
  const sideBySide = useMemo(() => {
    const oldLines: Array<{ content: string; type: string; lineNumber: number }> = [];
    const newLines: Array<{ content: string; type: string; lineNumber: number }> = [];

    diff.lines.forEach((line) => {
      if (line.type === 'unchanged') {
        oldLines.push({ content: line.content, type: 'unchanged', lineNumber: line.lineNumber });
        newLines.push({ content: line.content, type: 'unchanged', lineNumber: line.lineNumber });
      } else if (line.type === 'removed') {
        oldLines.push({ content: line.content, type: 'removed', lineNumber: line.lineNumber });
        newLines.push({ content: '', type: 'empty', lineNumber: line.lineNumber });
      } else if (line.type === 'added') {
        oldLines.push({ content: '', type: 'empty', lineNumber: line.lineNumber });
        newLines.push({ content: line.content, type: 'added', lineNumber: line.lineNumber });
      } else if (line.type === 'modified') {
        oldLines.push({ content: line.oldContent || '', type: 'modified-old', lineNumber: line.lineNumber });
        newLines.push({ content: line.newContent || '', type: 'modified-new', lineNumber: line.lineNumber });
      }
    });

    return { oldLines, newLines };
  }, [diff.lines]);

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
          <div className={css.DiffSide}>
            <div className={css.DiffHeader}>
              <span className={css.DiffLabel}>{formatTimestamp(timestamp)}</span>
              <span className={css.DiffInfo}>
                {diff.full.deletions > 0 && <span className={css.Deletions}>-{diff.full.deletions}</span>}
                {diff.full.modifications > 0 && <span className={css.Modifications}>~{diff.full.modifications}</span>}
              </span>
            </div>
            <div className={css.DiffCode}>
              {sideBySide.oldLines.map((line, index) => (
                <div
                  key={index}
                  className={`${css.DiffLine} ${
                    line.type === 'removed'
                      ? css.DiffLineRemoved
                      : line.type === 'modified-old'
                      ? css.DiffLineModified
                      : line.type === 'empty'
                      ? css.DiffLineEmpty
                      : ''
                  }`}
                >
                  <span className={css.LineNumber}>{line.type !== 'empty' ? line.lineNumber : ''}</span>
                  <span className={css.LineContent}>{line.content || ' '}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={css.DiffSeparator}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 12h14M13 5l7 7-7 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div className={css.DiffSide}>
            <div className={css.DiffHeader}>
              <span className={css.DiffLabel}>Current</span>
              <span className={css.DiffInfo}>
                {diff.full.additions > 0 && <span className={css.Additions}>+{diff.full.additions}</span>}
                {diff.full.modifications > 0 && <span className={css.Modifications}>~{diff.full.modifications}</span>}
              </span>
            </div>
            <div className={css.DiffCode}>
              {sideBySide.newLines.map((line, index) => (
                <div
                  key={index}
                  className={`${css.DiffLine} ${
                    line.type === 'added'
                      ? css.DiffLineAdded
                      : line.type === 'modified-new'
                      ? css.DiffLineModified
                      : line.type === 'empty'
                      ? css.DiffLineEmpty
                      : ''
                  }`}
                >
                  <span className={css.LineNumber}>{line.type !== 'empty' ? line.lineNumber : ''}</span>
                  <span className={css.LineContent}>{line.content || ' '}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={css.Summary}>
          {diff.full.additions > 0 && <span>• {diff.full.additions} line(s) will be removed</span>}
          {diff.full.deletions > 0 && <span>• {diff.full.deletions} line(s) will be added</span>}
          {diff.full.modifications > 0 && <span>• {diff.full.modifications} line(s) will change</span>}
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
