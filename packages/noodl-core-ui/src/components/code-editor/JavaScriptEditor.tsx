/**
 * JavaScriptEditor Component
 *
 * A feature-rich JavaScript code editor powered by CodeMirror 6.
 * Includes syntax highlighting, autocompletion, linting, and all IDE features.
 *
 * @module code-editor
 */

import { indentRange } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { useDragHandler } from '@noodl-hooks/useDragHandler';
import React, { useState, useEffect, useCallback, useRef } from 'react';

import { ToolbarGrip } from '@noodl-core-ui/components/toolbar/ToolbarGrip';

import { CodeHistoryButton, type CodeSnapshot } from './CodeHistory';
import {
  createEditorState,
  createExtensions,
  externalValueSync,
  readOnlyCompartment,
  readOnlyExtensions
} from './codemirror-extensions';
import css from './JavaScriptEditor.module.scss';
import { isSameValidation, validateJavaScript } from './utils/jsValidator';
import { isPixelSize, parseSizeProp, type CssSize } from './utils/size';
import { firstErrorPosition } from './utils/syntaxDiagnostics';
import { minimalChange } from './utils/textChange';
import { JavaScriptEditorProps, ValidationType } from './utils/types';

/** Shared with {@link useDragHandler} below — the editor cannot usefully go smaller. */
const MIN_WIDTH = 400;
const MIN_HEIGHT = 200;

const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 500;

/**
 * Main JavaScriptEditor Component
 */
export function JavaScriptEditor({
  value,
  onChange,
  onSave,
  onClose,
  validationType = 'expression',
  disabled = false,
  height,
  width,
  placeholder = '// Enter your JavaScript code here',
  historyProvider
}: JavaScriptEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);

  // CodeMirror owns the document; this is only the verdict shown in the toolbar and
  // the panel below it.
  const [validation, setValidation] = useState(() => validateJavaScript(value || '', validationType));

  const applyValidation = useCallback((code: string, type: ValidationType) => {
    setValidation((current) => {
      let next = validateJavaScript(code, type);

      // Neither `new Function` nor most of `JSON.parse`'s errors carry a position, so
      // the panel used to say only *what* was wrong. The parse tree always knows where.
      const view = editorViewRef.current;
      if (!next.valid && next.line === undefined && view) {
        const position = firstErrorPosition(view.state);
        if (position) {
          next = { ...next, ...position };
        }
      }

      return isSameValidation(current, next) ? current : next;
    });
  }, []);

  // A number or px string is resizable; every other CSS length passes straight through
  // (CED-001, A6 — `parseInt('100%')` used to yield a 100px editor, clamped up to 400).
  const [size, setSize] = useState<{ width: CssSize; height: CssSize }>(() => ({
    width: parseSizeProp(width, DEFAULT_WIDTH),
    height: parseSizeProp(height, DEFAULT_HEIGHT)
  }));

  const { startDrag } = useDragHandler({
    root: rootRef,
    minHeight: MIN_HEIGHT,
    minWidth: MIN_WIDTH,
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
      applyValidation(newValue, validationType);
      onChange?.(newValue);
    },
    [applyValidation, onChange, validationType]
  );

  /**
   * Re-indent the document from the language's own indentation rules.
   *
   * This used to run a hand-rolled character loop that did not know about `//`
   * comments, regex literals or `${}` in template literals, and put a newline after
   * every semicolon — which turned `for (let i = 0; i < n; i++)` into three broken
   * lines. `indentRange` only ever rewrites leading whitespace, using the same syntax
   * tree the editor highlights from, so it cannot corrupt code (CED-001, A4).
   *
   * It also returns a minimal change set, so Cmd-Z steps back over the indent alone.
   */
  const handleFormat = useCallback(() => {
    const view = editorViewRef.current;
    if (!view) return;

    const changes = indentRange(view.state, 0, view.state.doc.length);
    if (changes.empty) return;

    view.dispatch({ changes });
    view.focus();
  }, []);

  // The extensions are built once, so the callbacks they close over have to be read
  // through a ref — otherwise a consumer that passes a fresh `onChange`/`onSave` each
  // render keeps talking to the one from mount.
  const handleChangeRef = useRef(handleChange);
  const onSaveRef = useRef(onSave);
  useEffect(() => {
    handleChangeRef.current = handleChange;
    onSaveRef.current = onSave;
  });

  // Initialize CodeMirror editor
  useEffect(() => {
    if (!editorContainerRef.current) return;

    const view = new EditorView({
      state: createEditorState(
        value || '',
        createExtensions({
          validationType,
          placeholder,
          readOnly: disabled,
          onChange: (newValue) => handleChangeRef.current(newValue),
          onSave: onSave ? (newValue) => onSaveRef.current?.(newValue) : undefined,
          tabSize: 2
        })
      ),
      parent: editorContainerRef.current
    });

    editorViewRef.current = view;

    return () => {
      view.destroy();
      editorViewRef.current = null;
    };
    // Mounted once. `value` and `disabled` are kept in step by the effects below;
    // the rest are fixed for the lifetime of an editor instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push an externally-supplied value into the document.
  //
  // The dispatch is annotated so the update listener does not report it straight back
  // to the consumer, and is a minimal change rather than a whole-document replace, so
  // it costs one undo step instead of erasing the history (CED-001, A7/A8).
  useEffect(() => {
    const view = editorViewRef.current;
    if (!view) return;

    const next = value || '';
    const change = minimalChange(view.state.doc.toString(), next);
    if (!change) return;

    view.dispatch({
      changes: change,
      annotations: externalValueSync.of(true)
    });

    applyValidation(next, validationType);
  }, [applyValidation, value, validationType]);

  // Keep the verdict in step when only the mode changes.
  useEffect(() => {
    const view = editorViewRef.current;
    applyValidation(view ? view.state.doc.toString() : value || '', validationType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validationType]);

  // Toggle read-only on the live editor.
  useEffect(() => {
    const view = editorViewRef.current;
    if (!view) return;

    view.dispatch({
      effects: readOnlyCompartment.reconfigure(readOnlyExtensions(disabled))
    });
  }, [disabled]);

  const readCurrentCode = useCallback(
    () => editorViewRef.current?.state.doc.toString() ?? value ?? '',
    [value]
  );

  const handleRestore = useCallback((snapshot: CodeSnapshot) => {
    const view = editorViewRef.current;
    if (!view) return;

    const change = minimalChange(view.state.doc.toString(), snapshot.code);
    if (!change) return;

    // Deliberately un-annotated: restoring is a real edit, and the consumer needs to
    // hear about it. Not auto-saved either — the person still chooses to keep it.
    view.dispatch({ changes: change, scrollIntoView: true });
    view.focus();
  }, []);

  // Get validation mode label
  const getModeLabel = () => {
    switch (validationType) {
      case 'expression':
        return 'Expression';
      case 'function':
        return 'Function';
      case 'script':
        return 'Script';
      case 'json':
        return 'JSON';
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
        // A pixel floor only makes sense for a pixel size; imposing 400px on a '100%'
        // editor inside a narrow modal just overflows it.
        ...(isPixelSize(size.width) ? { minWidth: MIN_WIDTH } : null),
        ...(isPixelSize(size.height) ? { minHeight: MIN_HEIGHT } : null)
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
          {/* History button — only shown when the consumer supplies a provider */}
          {historyProvider && (
            <CodeHistoryButton provider={historyProvider} getCurrentCode={readCurrentCode} onRestore={handleRestore} />
          )}
          <button
            onClick={handleFormat}
            disabled={disabled}
            className={css['FormatButton']}
            title="Re-indent using the language's indentation rules"
            type="button"
          >
            Format
          </button>
          {onSave && (
            <button
              onClick={() => onSave(readCurrentCode())}
              disabled={disabled}
              className={css['SaveButton']}
              title="Save (Ctrl+S)"
              type="button"
            >
              Save
            </button>
          )}
          {onClose && (
            <button
              onClick={() => {
                // Save before closing if onSave is available
                onSave?.(readCurrentCode());
                onClose();
              }}
              className={css['CloseButton']}
              title="Save and Close (Escape)"
              type="button"
            >
              Close
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
