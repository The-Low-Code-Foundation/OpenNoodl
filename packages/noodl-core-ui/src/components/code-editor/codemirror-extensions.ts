/**
 * CodeMirror Extensions Configuration
 *
 * Configures all CodeMirror extensions and features including:
 * - Language support (JavaScript / JSON)
 * - Autocompletion (the language's own, plus Noodl's globals)
 * - Search/replace
 * - Code folding
 * - Linting from the parse tree
 * - Custom keybindings
 *
 * CED-001 (A1–A3) removed a layer of hand-rolled replacements for behaviour
 * CodeMirror already ships. When adding something here, check the library first.
 *
 * @module code-editor
 */

import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab, toggleComment } from '@codemirror/commands';
import { javascript, javascriptLanguage } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { bracketMatching, foldGutter, foldKeymap, indentOnInput } from '@codemirror/language';
import { lintGutter, linter, lintKeymap } from '@codemirror/lint';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { Compartment, EditorSelection, EditorState, Extension } from '@codemirror/state';
import {
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  placeholder as placeholderExtension,
  rectangularSelection,
  ViewUpdate
} from '@codemirror/view';

import { createOpenNoodlTheme } from './codemirror-theme';
import { noodlCompletionSource } from './noodl-completions';
import { isExternalValueSync } from './utils/externalValueSync';
import { defaultPlaceholder } from './utils/modes';
import { syntaxDiagnostics } from './utils/syntaxDiagnostics';
import { ValidationType } from './utils/types';

export { externalValueSync, isExternalValueSync } from './utils/externalValueSync';

/**
 * Options for creating CodeMirror extensions
 */
export interface ExtensionOptions {
  /** What is being edited — picks the language, the linter and the toolbar label. */
  validationType?: ValidationType;
  /** Placeholder text. Omit it and the mode's own suggestion is used. */
  placeholder?: string;
  /** Is editor read-only? */
  readOnly?: boolean;
  /** onChange callback */
  onChange?: (value: string) => void;
  /** onSave callback (Cmd+S) */
  onSave?: (value: string) => void;
  /** Tab size (default: 2) */
  tabSize?: number;
}

/**
 * Holds the read-only configuration so `disabled` can be toggled on a live editor
 * rather than only at mount.
 */
export const readOnlyCompartment = new Compartment();

/** The pair of extensions that make an editor read-only. */
export function readOnlyExtensions(readOnly: boolean): Extension {
  return [EditorView.editable.of(!readOnly), EditorState.readOnly.of(readOnly)];
}

/**
 * Move line up command (Alt+↑)
 */
function moveLineUp(view: EditorView): boolean {
  const { state } = view;
  const changes = state.changeByRange((range) => {
    const line = state.doc.lineAt(range.from);
    if (line.number === 1) return { range }; // Can't move first line up

    const prevLine = state.doc.line(line.number - 1);
    const lineText = state.doc.sliceString(line.from, line.to);
    const prevLineText = state.doc.sliceString(prevLine.from, prevLine.to);

    return {
      changes: [
        { from: prevLine.from, to: prevLine.to, insert: lineText },
        { from: line.from, to: line.to, insert: prevLineText }
      ],
      range: EditorSelection.range(prevLine.from, prevLine.from + lineText.length)
    };
  });

  view.dispatch(changes);
  return true;
}

/**
 * Move line down command (Alt+↓)
 */
function moveLineDown(view: EditorView): boolean {
  const { state } = view;
  const changes = state.changeByRange((range) => {
    const line = state.doc.lineAt(range.from);
    if (line.number === state.doc.lines) return { range }; // Can't move last line down

    const nextLine = state.doc.line(line.number + 1);
    const lineText = state.doc.sliceString(line.from, line.to);
    const nextLineText = state.doc.sliceString(nextLine.from, nextLine.to);

    return {
      changes: [
        { from: line.from, to: line.to, insert: nextLineText },
        { from: nextLine.from, to: nextLine.to, insert: lineText }
      ],
      range: EditorSelection.range(nextLine.from, nextLine.from + lineText.length)
    };
  });

  view.dispatch(changes);
  return true;
}

/**
 * Create custom keybindings
 *
 * `closeBracketsKeymap` comes first so typing a closing bracket over an
 * auto-inserted one types through it instead of duplicating it.
 */
function customKeybindings(options: ExtensionOptions) {
  return keymap.of([
    ...closeBracketsKeymap,
    ...defaultKeymap,
    ...searchKeymap,
    ...historyKeymap,
    ...foldKeymap,
    ...completionKeymap,
    ...lintKeymap,

    // Tab key for indentation (not focus change)
    indentWithTab,

    // Comment toggle (Cmd+/)
    {
      key: 'Mod-/',
      run: toggleComment
    },

    // Move lines up/down (Alt+↑/↓)
    {
      key: 'Alt-ArrowUp',
      run: moveLineUp
    },
    {
      key: 'Alt-ArrowDown',
      run: moveLineDown
    },

    // Save (Cmd+S)
    ...(options.onSave
      ? [
          {
            key: 'Mod-s',
            preventDefault: true,
            run: (view: EditorView) => {
              options.onSave?.(view.state.doc.toString());
              return true;
            }
          }
        ]
      : [])
  ]);
}

/**
 * Language support, plus the completion sources that belong to it.
 *
 * The Noodl source is registered *alongside* the language's own rather than through
 * `autocompletion({ override })`, which replaces every other source — that one word
 * was costing local variables, keywords and snippets (CED-001, A2).
 */
function languageSupport(validationType: ValidationType): Extension {
  if (validationType === 'json') {
    // Noodl globals are not in scope inside a JSON document.
    return json();
  }

  // CSS, HTML and free text get no language at all rather than JavaScript's.
  // `@codemirror/lang-css` and `-html` are not dependencies of this package, and
  // plain text is the honest fallback: JS highlighting over a stylesheet colours
  // `background-color` as three tokens and offers Noodl completions that mean
  // nothing there. It also keeps `syntaxDiagnostics` quiet, which is the point —
  // valid CSS used to be underlined as a JavaScript syntax error.
  if (validationType === 'text' || validationType === 'css' || validationType === 'html') {
    return [];
  }

  return [javascript(), javascriptLanguage.data.of({ autocomplete: noodlCompletionSource })];
}

/**
 * Create all CodeMirror extensions
 */
export function createExtensions(options: ExtensionOptions = {}): Extension[] {
  const { validationType = 'expression', readOnly = false, onChange, tabSize = 2 } = options;
  const placeholder = options.placeholder ?? defaultPlaceholder(validationType);

  return [
    // 1. Language support and its completions
    languageSupport(validationType),

    // 2. Theme
    createOpenNoodlTheme(),

    // 3. Keybindings
    customKeybindings(options),

    // 4. Essential UI
    lineNumbers(),
    history(),

    // 5. Visual enhancements
    highlightActiveLineGutter(),
    highlightActiveLine(),
    drawSelection(),
    dropCursor(),
    rectangularSelection(),

    // 6. Bracket & selection features
    closeBrackets(),
    bracketMatching(),
    indentOnInput(),
    highlightSelectionMatches(),
    placeholderExtension(placeholder),
    EditorView.lineWrapping,

    // 7. Folding, completion and diagnostics
    foldGutter({
      openText: '▼',
      closedText: '▶'
    }),
    autocompletion({
      activateOnTyping: true,
      maxRenderedOptions: 10,
      defaultKeymap: true
    }),
    linter((view) => syntaxDiagnostics(view.state)),
    lintGutter(),

    // 8. Tab size
    EditorState.tabSize.of(tabSize),

    // 9. Read-only mode — reconfigurable, see readOnlyCompartment
    readOnlyCompartment.of(readOnlyExtensions(readOnly)),

    // 10. onChange handler
    ...(onChange
      ? [
          EditorView.updateListener.of((update: ViewUpdate) => {
            if (!update.docChanged) {
              return;
            }

            // Our own echo of the `value` prop — the consumer already has this text.
            if (isExternalValueSync(update.transactions)) {
              return;
            }

            onChange(update.state.doc.toString());
          })
        ]
      : [])
  ];
}

/**
 * Helper to create a basic CodeMirror state
 */
export function createEditorState(initialValue: string, extensions: Extension[]): EditorState {
  return EditorState.create({
    doc: initialValue,
    extensions
  });
}
