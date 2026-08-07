/**
 * GeneratedCodeModal
 *
 * A read-only modal for viewing generated code from Logic Builder.
 * Uses the CodeMirror-based JavaScriptEditor in read-only mode.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

import { JavaScriptEditor } from '@noodl-core-ui/components/code-editor';
import { IconName } from '@noodl-core-ui/components/common/Icon';
import { PrimaryButton, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';

import css from './GeneratedCodeModal.module.scss';

export interface GeneratedCodeModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** The node name for display */
  nodeName: string;
  /** The generated code to display */
  code: string;
  /** Called when modal is closed */
  onClose: () => void;
}

/**
 * Read-only modal for viewing generated JavaScript code
 */
export function GeneratedCodeModal({ isOpen, nodeName, code, onClose }: GeneratedCodeModalProps) {
  const codeRef = useRef<string>(code);

  // Keep code ref updated
  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Handle copy to clipboard
  const handleCopy = useCallback(() => {
    if (codeRef.current) {
      navigator.clipboard.writeText(codeRef.current).then(
        () => {
          console.log('[GeneratedCodeModal] Code copied to clipboard');
        },
        (err) => {
          console.error('[GeneratedCodeModal] Failed to copy code:', err);
        }
      );
    }
  }, []);

  if (!isOpen) return null;

  const displayCode =
    code || '// No code generated yet.\n// Add some blocks in the Logic Builder and close the editor.';

  // Render into portal to escape any z-index issues
  return ReactDOM.createPortal(
    <div className={css['Overlay']} onClick={onClose}>
      <div className={css['Modal']} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={css['Header']}>
          <span className={css['Title']}>Generated Code: {nodeName}</span>
          <span className={css['ReadOnlyBadge']}>Read-Only</span>
        </div>

        {/* Info */}
        <div className={css['InfoBar']}>
          <span className={css['InfoText']}>
            This is the JavaScript generated from your logic blocks. You can copy it but not edit it directly.
          </span>
        </div>

        {/* Body with editor */}
        <div className={css['Body']}>
          <div className={css['EditorWrapper']}>
            <JavaScriptEditor
              value={displayCode}
              onChange={() => {}} // No-op since read-only
              validationType="script"
              height={400}
              width={700}
              disabled={true}
            />
          </div>
        </div>

        {/* Footer with buttons */}
        <div className={css['Footer']}>
          <PrimaryButton
            label="Copy Code"
            variant={PrimaryButtonVariant.Muted}
            icon={IconName.Copy}
            onClick={handleCopy}
            isDisabled={!code}
          />
          <PrimaryButton label="Close" variant={PrimaryButtonVariant.Cta} onClick={onClose} />
        </div>
      </div>
    </div>,
    document.body
  );
}
