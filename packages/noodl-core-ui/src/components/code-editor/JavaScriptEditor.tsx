/**
 * JavaScriptEditor Component
 *
 * A feature-rich JavaScript code editor powered by CodeMirror 6.
 * Includes syntax highlighting, autocompletion, linting, and all IDE features.
 *
 * @module code-editor
 */

import { EditorView } from '@codemirror/view';
import { useDragHandler } from '@noodl-hooks/useDragHandler';
import React, { useState, useEffect, useCallback, useRef } from 'react';

import { ToolbarGrip } from '@noodl-core-ui/components/toolbar/ToolbarGrip';

import { CodeHistoryButton, type CodeSnapshot } from './CodeHistory';
import { createEditorState, createExtensions } from './codemirror-extensions';
import css from './JavaScriptEditor.module.scss';
import { formatJavaScript } from './utils/jsFormatter';
import { validateJavaScript } from './utils/jsValidator';
import { JavaScriptEditorProps } from './utils/types';

/**
 * Main JavaScriptEditor Component
 */
export function JavaScriptEditor({
  value,
  onChange,
  onSave,
  validationType = 'expression',
  disabled = false,
  height,
  width,
  placeholder = '// Enter your JavaScript code here',
  nodeId,
  parameterName
}: JavaScriptEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);

  // Generation counter approach to prevent race conditions
  // Replaces the unreliable isInternalChangeRef + setTimeout pattern
  const changeGenerationRef = useRef(0);
  const lastSyncedGenerationRef = useRef(0);

  // Only store validation state (needed for display outside editor)
  // Don't store localValue - CodeMirror is the single source of truth
  const [validation, setValidation] = useState(validateJavaScript(value || '', validationType));

  // Resize support - convert width/height to numbers
  const initialWidth = typeof width === 'number' ? width : typeof width === 'string' ? parseInt(width, 10) : 800;
  const initialHeight = typeof height === 'number' ? height : typeof height === 'string' ? parseInt(height, 10) : 500;

  const [size, setSize] = useState<{ width: number; height: number }>({
    width: initialWidth,
    height: initialHeight
  });

  const { startDrag } = useDragHandler({
    root: rootRef,
    minHeight: 200,
    minWidth: 400,
    onDrag(contentWidth, contentHeight) {
      setSize({
        width: contentWidth,
        height: contentHeight
      });
    },
    onEndDrag() {
      editorViewRef.current?.focus();
    }
  });

  // Handle text changes from CodeMirror
  const handleChange = useCallback(
    (newValue: string) => {
      // Increment generation counter for every internal change
      // This prevents race conditions with external value syncing
      changeGenerationRef.current++;

      // Validate the new code
      const result = validateJavaScript(newValue, validationType);
      setValidation(result);

      // Propagate changes to parent
      if (onChange) {
        onChange(newValue);
      }

      // No setTimeout needed - generation counter handles sync safely
    },
    [onChange, validationType]
  );

  // Handle format button
  const handleFormat = useCallback(() => {
    if (!editorViewRef.current) return;

    try {
      const currentCode = editorViewRef.current.state.doc.toString();
      const formatted = formatJavaScript(currentCode);

      // Increment generation counter for programmatic changes
      changeGenerationRef.current++;

      // Update CodeMirror with formatted code
      editorViewRef.current.dispatch({
        changes: {
          from: 0,
          to: editorViewRef.current.state.doc.length,
          insert: formatted
        }
      });

      if (onChange) {
        onChange(formatted);
      }

      // No setTimeout needed
    } catch (error) {
      console.error('Format error:', error);
    }
  }, [onChange]);

  // Initialize CodeMirror editor
  useEffect(() => {
    if (!editorContainerRef.current) return;

    // Create extensions
    const extensions = createExtensions({
      validationType,
      placeholder,
      readOnly: disabled,
      onChange: handleChange,
      onSave,
      tabSize: 2
    });

    // Create editor state
    const state = createEditorState(value || '', extensions);

    // Create editor view
    const view = new EditorView({
      state,
      parent: editorContainerRef.current
    });

    editorViewRef.current = view;

    // Cleanup on unmount
    return () => {
      view.destroy();
      editorViewRef.current = null;
    };
    // Only run on mount - we handle updates separately
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update editor when external value changes (but NOT from internal typing)
  useEffect(() => {
    if (!editorViewRef.current) return;

    // Skip if internal changes have happened since last sync
    // This prevents race conditions from auto-complete, fold, etc.
    if (changeGenerationRef.current > lastSyncedGenerationRef.current) {
      return;
    }

    const currentValue = editorViewRef.current.state.doc.toString();

    // Only update if value actually changed from external source
    if (currentValue !== value) {
      // Update synced generation to current
      lastSyncedGenerationRef.current = changeGenerationRef.current;

      // Preserve cursor position during external update
      const currentSelection = editorViewRef.current.state.selection;

      editorViewRef.current.dispatch({
        changes: {
          from: 0,
          to: editorViewRef.current.state.doc.length,
          insert: value || ''
        },
        // Try to preserve selection if it's still valid
        selection: currentSelection.ranges[0].to <= (value || '').length ? currentSelection : undefined
      });

      setValidation(validateJavaScript(value || '', validationType));
    }
  }, [value, validationType]);

  // Update read-only state
  useEffect(() => {
    if (!editorViewRef.current) return;

    editorViewRef.current.dispatch({
      effects: [
        // Note: This requires reconfiguring the editor
        // For now, we handle it on initial mount
      ]
    });
  }, [disabled]);

  // Get validation mode label
  const getModeLabel = () => {
    switch (validationType) {
      case 'expression':
        return 'Expression';
      case 'function':
        return 'Function';
      case 'script':
        return 'Script';
      default:
        return 'JavaScript';
    }
  };

  return (
    <div
      ref={rootRef}
      className={css['Root']}
      style={{
        width: size.width,
        height: size.height,
        minWidth: 400,
        minHeight: 200
      }}
    >
      {/* Toolbar */}
      <div className={css['Toolbar']}>
        <div className={css['ToolbarLeft']}>
          <span className={css['ModeLabel']}>{getModeLabel()}</span>
          {validation.valid ? (
            <span className={css['StatusValid']}>✓ Valid</span>
          ) : (
            <span className={css['StatusInvalid']}>✗ Error</span>
          )}
        </div>
        <div className={css['ToolbarRight']}>
          {/* History button - only show if nodeId and parameterName provided */}
          {nodeId && parameterName && (
            <CodeHistoryButton
              nodeId={nodeId}
              parameterName={parameterName}
              currentCode={editorViewRef.current?.state.doc.toString() || value || ''}
              onRestore={(snapshot: CodeSnapshot) => {
                if (!editorViewRef.current) return;

                // Increment generation counter for restore operation
                changeGenerationRef.current++;

                // Restore code from snapshot
                editorViewRef.current.dispatch({
                  changes: {
                    from: 0,
                    to: editorViewRef.current.state.doc.length,
                    insert: snapshot.code
                  }
                });

                if (onChange) {
                  onChange(snapshot.code);
                }

                // No setTimeout needed

                // Don't auto-save - let user manually save if they want to keep the restored version
                // This prevents creating duplicate snapshots
              }}
            />
          )}
          <button
            onClick={handleFormat}
            disabled={disabled}
            className={css['FormatButton']}
            title="Format code"
            type="button"
          >
            Format
          </button>
          {onSave && (
            <button
              onClick={() => {
                const currentCode = editorViewRef.current?.state.doc.toString() || '';
                onSave(currentCode);
              }}
              disabled={disabled}
              className={css['SaveButton']}
              title="Save (Ctrl+S)"
              type="button"
            >
              Save
            </button>
          )}
        </div>
      </div>

      {/* CodeMirror Editor Container */}
      <div ref={editorContainerRef} className={css['EditorContainer']} />

      {/* Validation Errors */}
      {!validation.valid && (
        <div className={css['ErrorPanel']}>
          <div className={css['ErrorHeader']}>
            <span className={css['ErrorIcon']}>⚠️</span>
            <span className={css['ErrorTitle']}>Syntax Error</span>
          </div>
          <div className={css['ErrorMessage']}>{validation.error}</div>
          {validation.suggestion && (
            <div className={css['ErrorSuggestion']}>
              <strong>💡 Suggestion:</strong> {validation.suggestion}
            </div>
          )}
          {validation.line !== undefined && (
            <div className={css['ErrorLocation']}>
              Line {validation.line}
              {validation.column !== undefined && `, Column ${validation.column}`}
            </div>
          )}
        </div>
      )}

      {/* Footer with resize grip */}
      <div className={css['Footer']}>
        <div className={css['FooterLeft']}></div>
        <div className={css['FooterRight']}>
          <ToolbarGrip onMouseDown={startDrag} />
        </div>
      </div>
    </div>
  );
}
