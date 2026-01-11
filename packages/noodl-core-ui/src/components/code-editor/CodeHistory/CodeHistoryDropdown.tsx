/**
 * CodeHistoryDropdown Component
 *
 * Shows a list of code snapshots with preview and restore functionality.
 *
 * @module code-editor/CodeHistory
 */

import React, { useState, useMemo } from 'react';

import { computeDiff, getDiffSummary } from '../utils/codeDiff';
import { CodeHistoryDiffModal } from './CodeHistoryDiffModal';
import css from './CodeHistoryDropdown.module.scss';
import type { CodeSnapshot } from './types';

export interface CodeHistoryDropdownProps {
  nodeId: string;
  parameterName: string;
  currentCode: string;
  onRestore: (snapshot: CodeSnapshot) => void;
  onClose: () => void;
}

// Format timestamp to human-readable format
function formatTimestamp(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return 'just now';
  } else if (diffMin < 60) {
    return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  } else if (diffHour < 24) {
    return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;
  } else if (diffDay === 1) {
    return 'yesterday at ' + then.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDay < 7) {
    return `${diffDay} days ago`;
  } else {
    return then.toLocaleDateString() + ' at ' + then.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

export function CodeHistoryDropdown({
  nodeId,
  parameterName,
  currentCode,
  onRestore,
  onClose
}: CodeHistoryDropdownProps) {
  const [selectedSnapshot, setSelectedSnapshot] = useState<CodeSnapshot | null>(null);
  const [history, setHistory] = useState<CodeSnapshot[]>([]);

  // Load history on mount
  React.useEffect(() => {
    // Dynamically import CodeHistoryManager to avoid circular dependencies
    // This allows noodl-core-ui to access noodl-editor functionality
    import('@noodl-models/CodeHistoryManager')
      .then(({ CodeHistoryManager }) => {
        const historyData = CodeHistoryManager.instance.getHistory(nodeId, parameterName);
        setHistory(historyData);
      })
      .catch((error) => {
        console.warn('Could not load CodeHistoryManager:', error);
        setHistory([]);
      });
  }, [nodeId, parameterName]);

  // Compute diffs for all snapshots (newest first)
  const snapshotsWithDiffs = useMemo(() => {
    return history
      .slice() // Don't mutate original
      .reverse() // Newest first
      .map((snapshot) => {
        const diff = computeDiff(snapshot.code, currentCode);
        const summary = getDiffSummary(diff);
        return {
          snapshot,
          diff,
          summary
        };
      });
  }, [history, currentCode]);

  if (history.length === 0) {
    return (
      <div className={css.Root}>
        <div className={css.Header}>
          <h3 className={css.Title}>Code History</h3>
          <button onClick={onClose} className={css.CloseButton} type="button" title="Close">
            ×
          </button>
        </div>
        <div className={css.Empty}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className={css.EmptyIcon}>
            <path
              d="M24 42c9.941 0 18-8.059 18-18S33.941 6 24 6 6 14.059 6 24s8.059 18 18 18z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M24 14v12l6 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <p className={css.EmptyText}>No history yet</p>
          <p className={css.EmptyHint}>Code snapshots are saved automatically when you save changes.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={css.Root}>
        <div className={css.Header}>
          <h3 className={css.Title}>Code History</h3>
          <button onClick={onClose} className={css.CloseButton} type="button" title="Close">
            ×
          </button>
        </div>

        <div className={css.List}>
          {/* Historical snapshots (newest first) */}
          {snapshotsWithDiffs.map(({ snapshot, diff, summary }, index) => (
            <div key={snapshot.timestamp} className={css.Item}>
              <div className={css.ItemHeader}>
                <span className={css.ItemIcon}>•</span>
                <span className={css.ItemTime}>{formatTimestamp(snapshot.timestamp)}</span>
              </div>
              <div className={css.ItemSummary}>{summary.description}</div>
              <div className={css.ItemActions}>
                <button
                  onClick={() => setSelectedSnapshot(snapshot)}
                  className={css.PreviewButton}
                  type="button"
                  title="Preview changes"
                >
                  Preview
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Diff Modal */}
      {selectedSnapshot && (
        <CodeHistoryDiffModal
          oldCode={selectedSnapshot.code}
          newCode={currentCode}
          timestamp={selectedSnapshot.timestamp}
          onRestore={() => {
            onRestore(selectedSnapshot);
            setSelectedSnapshot(null);
          }}
          onClose={() => setSelectedSnapshot(null)}
        />
      )}
    </>
  );
}
