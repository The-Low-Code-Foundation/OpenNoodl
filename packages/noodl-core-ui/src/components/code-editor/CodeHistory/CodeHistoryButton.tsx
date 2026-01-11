/**
 * CodeHistoryButton Component
 *
 * Displays a history button in the code editor toolbar.
 * Opens a dropdown showing code snapshots with diffs.
 *
 * @module code-editor/CodeHistory
 */

import React, { useState, useRef, useEffect } from 'react';

import css from './CodeHistoryButton.module.scss';
import { CodeHistoryDropdown } from './CodeHistoryDropdown';
import type { CodeSnapshot } from './types';

export interface CodeHistoryButtonProps {
  /** Node ID to fetch history for */
  nodeId: string;
  /** Parameter name (e.g., 'code', 'expression') */
  parameterName: string;
  /** Current code value */
  currentCode: string;
  /** Callback when user wants to restore a snapshot */
  onRestore: (snapshot: CodeSnapshot) => void;
}

/**
 * History button with dropdown
 */
export function CodeHistoryButton({ nodeId, parameterName, currentCode, onRestore }: CodeHistoryButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className={css.Root}>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={css.Button}
        title="View code history"
        type="button"
      >
        <svg className={css.Icon} width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M8 4v4l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className={css.Label}>History</span>
      </button>

      {isOpen && (
        <div ref={dropdownRef} className={css.Dropdown}>
          <CodeHistoryDropdown
            nodeId={nodeId}
            parameterName={parameterName}
            currentCode={currentCode}
            onRestore={(snapshot) => {
              onRestore(snapshot);
              setIsOpen(false);
            }}
            onClose={() => setIsOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
