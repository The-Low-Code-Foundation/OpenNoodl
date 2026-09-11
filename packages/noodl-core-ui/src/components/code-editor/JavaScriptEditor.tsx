/**
 * JavaScriptEditor Component
 *
 * A feature-rich JavaScript code editor powered by CodeMirror 6.
 * Includes syntax highlighting, autocompletion, linting, and all IDE features.
 *
 * @module code-editor
 */

import { indentRange } from '@codemirror/language';
import { openLintPanel } from '@codemirror/lint';
import { EditorView } from '@codemirror/view';
import { useDragHandler } from '@noodl-hooks/useDragHandler';
import React, { useState, useEffect, useCallback, useRef } from 'react';

import { ToolbarGrip } from '@noodl-core-ui/components/toolbar/ToolbarGrip';

import { getCodeAuthoringContext, subscribeToOpenNode } from './authoringContext';
import { CodeHistoryButton, type CodeSnapshot } from './CodeHistory';
import {
  createEditorState,
  createExtensions,
  externalValueSync,
  readOnlyCompartment,
  readOnlyExtensions,
  type DiagnosticSummary
} from './codemirror-extensions';
import css from './JavaScriptEditor.module.scss';
import { modeHasDeclaredPorts } from './utils/declaredPorts';
import { defaultPlaceholder, isValidatedType, modeLabel } from './utils/modes';
import {
  isDismissed,
  portBarMessage,
  portBarState,
  recordSuccess,
  setDismissed,
  shouldRecordSuccess,
  shouldShowBar
} from './utils/portBar';
import { requestRelint } from './utils/relint';
import { setRuntimeDiagnostic } from './utils/runtimeDiagnostic';
import { isPixelSize, parseSizeProp, type CssSize } from './utils/size';
import { minimalChange } from './utils/textChange';
import { JavaScriptEditorProps } from './utils/types';

/** "1 error" / "2 errors" — a count with a noun, not a bare glyph. */
function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

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
  subject = 'node',
  disabled = false,
  height,
  width,
  placeholder,
  historyProvider,
  runtimeDiagnostic
}: JavaScriptEditorProps) {
  // Mode-specific, because the editor is not always holding JavaScript.
  const resolvedPlaceholder = placeholder ?? defaultPlaceholder(validationType);
  const rootRef = useRef<HTMLDivElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);

  // CodeMirror owns both the document and the verdict. This is an echo of the lint
  // state for the toolbar, not a second opinion about the same text — the editor
  // used to run `new Function()` synchronously on every keystroke and could
  // therefore say "✗ Error" over text with no squiggle in it, or the reverse
  // (FH-017 slice 2).
  const [problems, setProblems] = useState<DiagnosticSummary>({ errors: 0, warnings: 0 });

  // FUN-006. The bar reads the *document*, which the `value` prop does not track
  // once the user starts typing — `onChange` reports upward but nothing comes
  // back down. So the text is mirrored here, from both the user's edits and the
  // external-sync effect below.
  const [documentText, setDocumentText] = useState(value || '');

  // §2's `?`: an explicit request overrides both dismissal and retirement,
  // because a user asking for the help is a user who wants it.
  const [barForced, setBarForced] = useState(false);
  const [barDismissed, setBarDismissed] = useState(() => isDismissed());

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
      setDocumentText(newValue);
      onChange?.(newValue);
    },
    [onChange]
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
          // CN-019. Fixed for the lifetime of an editor instance, like
          // `validationType` beside it — a document does not become a node.
          subject,
          placeholder: resolvedPlaceholder,
          readOnly: disabled,
          onChange: (newValue) => handleChangeRef.current(newValue),
          onSave: onSave ? (newValue) => onSaveRef.current?.(newValue) : undefined,
          onDiagnostics: setProblems,
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
    // FUN-006's bar reads this even when the text arrived from outside.
    setDocumentText(next);

    const change = minimalChange(view.state.doc.toString(), next);
    if (!change) return;

    view.dispatch({
      changes: change,
      annotations: externalValueSync.of(true)
    });

    // No re-validation here: the linter is an extension of this editor and runs
    // itself on any document change, whoever caused it.
  }, [value]);

  // FUN-007 §2. Push the last run's error into the gutter.
  //
  // ⚠️ This runs *after* the `value` effect above on any render that changes
  // both, which is the order it has to be: the field drops itself on
  // `docChanged`, so a diagnostic dispatched before the text landed would be
  // cleared by its own document update. Ordering by effect declaration is
  // load-bearing here rather than incidental.
  useEffect(() => {
    const view = editorViewRef.current;
    if (!view) return;

    setRuntimeDiagnostic(view, runtimeDiagnostic ?? null);
  }, [runtimeDiagnostic]);

  // FIX-016 §2 follow-up. The open node's declared ports can change under a
  // sitting editor — the Type dropdown that message 5 tells the author to use is
  // in the property panel *behind* this popout, and using it used to leave the
  // message standing.
  //
  // Two consumers, and they need different waking:
  //
  // - the **port bar** is computed during render, so it needs a re-render, which
  //   is what the counter is for. Nothing reads its value; `useState` is being
  //   used as "render again", and the alternative — mirroring the ports into
  //   state — would be a second copy of something the registry already holds.
  // - the **diagnostics** live in CodeMirror, which re-lints on document changes
  //   only. `requestRelint` is the whole of `utils/relint.ts`.
  const [, bumpPortRevision] = useState(0);
  useEffect(
    () =>
      subscribeToOpenNode(() => {
        bumpPortRevision((revision) => revision + 1);

        const view = editorViewRef.current;
        if (view) requestRelint(view);
      }),
    []
  );

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

  // Whether a verdict is ours to give at all. CSS/HTML/text have no validator,
  // and an unearned "✓ Valid" is as misleading as the "✗ Error" they used to get.
  const showsVerdict = isValidatedType(validationType);

  /**
   * Show every problem, not the first one.
   *
   * CodeMirror ships a diagnostics panel that lists them all, and its keybinding
   * (`Mod-Shift-M`) has been in our keymap since CED-001 — with no button, no
   * label and nothing in the UI that says so, it had zero callers. The verdict
   * is that button now (FH-017 slice 3).
   *
   * Focus is left where `openLintPanel` puts it — on the panel's list. Pulling
   * it back to the document (which this used to do) is what made the panel
   * open in its *unfocused* selected state, and it also disabled the arrow
   * keys, which are how you step through the diagnostics and move the cursor
   * to each one.
   */
  const showProblems = useCallback(() => {
    const view = editorViewRef.current;
    if (!view) return;

    openLintPanel(view);
  }, []);

  /**
   * FUN-006. What is true of this node and this document right now.
   *
   * Recomputed per render rather than held: it is a pure function of text the
   * component already has, and a second copy of that text is a second thing that
   * can be stale.
   *
   * CN-019 — `subject` is what decides whether there is a node to speak about at
   * all; see `utils/portBar.ts` for why the ambient `openNode` cannot answer
   * that question in either direction. `'file'` is silent, so the `?` restore
   * button below is not offered either: there is no hidden hint to bring back.
   */
  const barState = portBarState(validationType, getCodeAuthoringContext().openNode, documentText, subject);

  // ⚠️ §2's auto-retire counts "**wrote** a working output", not "opened the
  // editor". Opening it fifty times without succeeding is exactly when the bar
  // should keep appearing, so a counter on opens would retire it fastest for the
  // person it exists for.
  //
  // ⚠️ Which is why it counts the **transition**, not the state. Recording
  // whenever the bar is silent would also count *opening a node that already
  // worked* — so a new user opening three Function nodes in an example project
  // would retire the bar without ever having written an output, which is the
  // same defect wearing a different hat. Only not-silent → silent is someone
  // succeeding in front of us. Keyed by node id inside `recordSuccess`, so one
  // node edited repeatedly still counts once.
  const previousBarKind = useRef(barState.kind);
  useEffect(() => {
    const previous = previousBarKind.current;
    previousBarKind.current = barState.kind;

    if (!shouldRecordSuccess(previous, barState.kind)) return;
    if (!modeHasDeclaredPorts(validationType)) return;

    recordSuccess(getCodeAuthoringContext().openNode?.nodeId);
  }, [barState.kind, validationType]);

  const barMessage = portBarMessage(barState);

  // ⚠️ The second clause looks redundant against `shouldShowBar`, which already
  // reads the persisted flag. It is not: `setDismissed` swallows a storage
  // failure (a full or blocked `localStorage` is not worth an exception over a
  // hint bar), so on a browser where the write silently fails `isDismissed()`
  // keeps answering `false` and the ✕ would do nothing at all. The React state
  // is what makes dismissal work for the session regardless.
  const showBar = shouldShowBar(barState, barForced) && !(barDismissed && !barForced);

  const dismissBar = useCallback(() => {
    setDismissed(true);
    setBarDismissed(true);
    setBarForced(false);
  }, []);

  const restoreBar = useCallback(() => {
    setDismissed(false);
    setBarDismissed(false);
    setBarForced(true);
  }, []);

  const problemCount = problems.errors + problems.warnings;
  const verdictLabel =
    problems.errors > 0
      ? `✗ ${plural(problems.errors, 'error')}`
      : problems.warnings > 0
        ? `⚠ ${plural(problems.warnings, 'warning')}`
        : '✓ Valid';

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
          <span className={css['ModeLabel']}>{modeLabel(validationType, subject)}</span>
          {showsVerdict &&
            (problemCount > 0 ? (
              <button
                type="button"
                onClick={showProblems}
                className={problems.errors > 0 ? css['StatusInvalid'] : css['StatusWarning']}
                title="Show all problems (Ctrl+Shift+M)"
              >
                {verdictLabel}
              </button>
            ) : (
              <span className={css['StatusValid']}>{verdictLabel}</span>
            ))}
        </div>
        <div className={css['ToolbarRight']}>
          {/*
            FUN-006 §2 — dismissal is not a one-way door. Shown only when the bar
            has something to say and is not currently saying it, so it is not a
            permanent extra control in a dense toolbar.
          */}
          {barMessage !== null && !showBar && (
            <button
              type="button"
              onClick={restoreBar}
              className={css['HintButton']}
              title="Show the port hint again"
              aria-label="Show the port hint again"
            >
              ?
            </button>
          )}
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

      {/*
        FUN-006 — the bar. Between the toolbar and the editor, in *our* DOM
        rather than CodeMirror's: a `baseTheme` hardcodes colours our tokens
        never reach, which is how the lint panel shipped at 1.36:1 (F23).
      */}
      {showBar && barMessage !== null && (
        <div className={css['PortHint']} role="status">
          <span className={css['PortHintText']}>{barMessage}</span>
          <button
            type="button"
            onClick={dismissBar}
            className={css['PortHintDismiss']}
            title="Hide this hint"
            aria-label="Hide this hint"
          >
            ✕
          </button>
        </div>
      )}

      {/*
        CodeMirror Editor Container.

        No error panel underneath it: the one that used to live here rendered a
        single error, because `new Function` throws on the first one it meets and
        never gets to the second. CodeMirror's own diagnostics panel opens inside
        this container, lists all of them, and moves the cursor to the one you
        pick — see `showProblems`.
      */}
      <div ref={editorContainerRef} className={css['EditorContainer']} />

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
