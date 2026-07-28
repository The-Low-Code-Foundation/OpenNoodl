/**
 * CodeHistoryDropdown Component
 *
 * Shows a list of code snapshots with preview and restore functionality.
 *
 * @module code-editor/CodeHistory
 */

import React, { useEffect, useMemo, useState } from 'react';

import { summariseDiff } from '../utils/diffSummary';
import { CodeHistoryDiffModal } from './CodeHistoryDiffModal';
import css from './CodeHistoryDropdown.module.scss';
import { formatTimestamp } from './formatTimestamp';
import type { CodeHistoryProvider, CodeSnapshot } from './types';

export interface CodeHistoryDropdownProps {
  provider: CodeHistoryProvider;
  currentCode: string;
  onRestore: (snapshot: CodeSnapshot) => void;
  onClose: () => void;
}

export function CodeHistoryDropdown({ provider, currentCode, onRestore, onClose }: CodeHistoryDropdownProps) {
  const [selectedSnapshot, setSelectedSnapshot] = useState<CodeSnapshot | null>(null);
  const [history, setHistory] = useState<CodeSnapshot[]>([]);

  useEffect(() => {
    let cancelled = false;

    Promise.resolve(provider.getHistory())
      .then((snapshots) => {
        if (!cancelled) {
          setHistory(snapshots);
        }
      })
      .catch((error) => {
        console.error('Could not load code history:', error);
        if (!cancelled) {
          setHistory([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [provider]);

  // Newest first, each labelled with how it differs from what is in the editor now.
  const snapshots = useMemo(
    () =>
      history
        .slice()
        .reverse()
        .map((snapshot) => ({
          snapshot,
          summary: summariseDiff(snapshot.code, currentCode)
        })),
    [history, currentCode]
  );

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
          {snapshots.map(({ snapshot, summary }) => (
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
