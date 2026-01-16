/**
 * ExpressionEditorModal
 *
 * A modal dialog for editing expressions in a full-featured code editor.
 * Uses the new CodeMirror-based JavaScriptEditor component.
 */

import React, { useState, useCallback, useEffect } from 'react';
import ReactDOM from 'react-dom';

import { JavaScriptEditor } from '@noodl-core-ui/components/code-editor';
import { PrimaryButton, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { Text } from '@noodl-core-ui/components/typography/Text';

import css from './ExpressionEditorModal.module.scss';

export interface ExpressionEditorModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** The property name being edited */
  propertyName: string;
  /** The initial expression value */
  expression: string;
  /** Called when expression is applied */
  onApply: (expression: string) => void;
  /** Called when modal is closed/cancelled */
  onClose: () => void;
}

/**
 * Modal for editing expressions in a larger code editor
 */
export function ExpressionEditorModal({
  isOpen,
  propertyName,
  expression,
  onApply,
  onClose
}: ExpressionEditorModalProps) {
  const [localExpression, setLocalExpression] = useState(expression);

  // Reset local expression when modal opens with new value
  useEffect(() => {
    if (isOpen) {
      setLocalExpression(expression);
    }
  }, [isOpen, expression]);

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

  const handleApply = useCallback(() => {
    onApply(localExpression);
    onClose();
  }, [localExpression, onApply, onClose]);

  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  // Handle Ctrl+Enter to apply
  const handleSave = useCallback(
    (code: string) => {
      onApply(code);
      onClose();
    },
    [onApply, onClose]
  );

  if (!isOpen) return null;

  // Render into portal to escape any z-index issues
  return ReactDOM.createPortal(
    <div className={css['Overlay']} onClick={handleCancel}>
      <div className={css['Modal']} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={css['Header']}>
          <span className={css['Title']}>Edit Expression: {propertyName}</span>
        </div>

        {/* Body with editor */}
        <div className={css['Body']}>
          <div className={css['HelpText']}>
            <Text>
              Available: <code>Noodl.Variables.x</code>, <code>Noodl.Objects.id.prop</code>,{' '}
              <code>Noodl.Arrays.id</code>, and Math functions like <code>min()</code>, <code>max()</code>,{' '}
              <code>round()</code>
            </Text>
          </div>
          <div className={css['EditorWrapper']}>
            <JavaScriptEditor
              value={localExpression}
              onChange={setLocalExpression}
              onSave={handleSave}
              validationType="expression"
              height={300}
              width="100%"
              placeholder="// Enter your expression here, e.g. Noodl.Variables.count * 2"
            />
          </div>
        </div>

        {/* Footer with buttons */}
        <div className={css['Footer']}>
          <PrimaryButton label="Cancel" variant={PrimaryButtonVariant.Ghost} onClick={handleCancel} />
          <PrimaryButton label="Apply" variant={PrimaryButtonVariant.Cta} onClick={handleApply} />
        </div>
      </div>
    </div>,
    document.body
  );
}
