/**
 * CodeMirror Extensions Configuration
 *
 * Configures all CodeMirror extensions and features including:
 * - Language support (JavaScript)
 * - Autocompletion
 * - Search/replace
 * - Code folding
 * - Linting
 * - Custom keybindings
 * - Bracket colorization
 * - Indent guides
 * - And more...
 *
 * @module code-editor
 */

import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab, redo, undo, toggleComment } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import {
  bracketMatching,
  foldGutter,
  foldKeymap,
  indentOnInput,
  syntaxHighlighting,
  defaultHighlightStyle
} from '@codemirror/language';
import { lintGutter, linter, type Diagnostic } from '@codemirror/lint';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { EditorSelection, EditorState, Extension, StateEffect, StateField, type Range } from '@codemirror/state';
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
  ViewPlugin,
  ViewUpdate,
  Decoration,
  DecorationSet
} from '@codemirror/view';

import { createOpenNoodlTheme } from './codemirror-theme';
import { noodlCompletionSource } from './noodl-completions';
import { validateJavaScript } from './utils/jsValidator';

/**
 * Options for creating CodeMirror extensions
 */
export interface ExtensionOptions {
  /** Validation type (expression, function, script) */
  validationType?: 'expression' | 'function' | 'script';
  /** Placeholder text */
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
 * Indent guides extension
 * Draws vertical lines to show indentation levels
 */
function indentGuides(): Extension {
  const indentGuideDeco = Decoration.line({
    attributes: { class: 'cm-indent-guide' }
  });

  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = this.buildDecorations(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = this.buildDecorations(update.view);
        }
      }

      buildDecorations(view: EditorView): DecorationSet {
        const decorations: Range<Decoration>[] = [];
        const tabSize = view.state.tabSize;

        for (const { from, to } of view.visibleRanges) {
          for (let pos = from; pos <= to; ) {
            const line = view.state.doc.lineAt(pos);
            const text = line.text;

            // Count leading spaces/tabs
            let indent = 0;
            for (let i = 0; i < text.length; i++) {
              if (text[i] === ' ') indent++;
              else if (text[i] === '\t') indent += tabSize;
              else break;
            }

            // Add decoration if line has indentation
            if (indent > 0) {
              decorations.push(indentGuideDeco.range(line.from));
            }

            pos = line.to + 1;
          }
        }

        return Decoration.set(decorations);
      }
    },
    {
      decorations: (v) => v.decorations
    }
  );
}

/**
 * Custom Enter key handler for better brace/bracket handling
 */
function handleEnterKey(view: EditorView): boolean {
  const { state } = view;
  const { selection } = state;

  // Only handle if single cursor
  if (selection.ranges.length !== 1) {
    return false;
  }

  const range = selection.main;
  if (!range.empty) {
    return false; // Has selection, use default behavior
  }

  const pos = range.from;
  const line = state.doc.lineAt(pos);
  const before = state.sliceDoc(line.from, pos);

  // Check if cursor is between matching brackets/braces
  const beforeChar = state.sliceDoc(Math.max(0, pos - 1), pos);
  const afterChar = state.sliceDoc(pos, Math.min(state.doc.length, pos + 1));

  const matchingPairs: Record<string, string> = {
    '{': '}',
    '[': ']',
    '(': ')'
  };

  // If between matching pair (e.g., {|})
  if (matchingPairs[beforeChar] === afterChar) {
    // Calculate indentation
    const indent = before.match(/^\s*/)?.[0] || '';
    const indentSize = state.tabSize;
    const newIndent = indent + ' '.repeat(indentSize);

    // Insert newline with indentation, then another newline with original indentation
    view.dispatch({
      changes: {
        from: pos,
        to: pos,
        insert: '\n' + newIndent + '\n' + indent
      },
      selection: { anchor: pos + 1 + newIndent.length }
    });

    return true; // Handled
  }

  // Default behavior
  return false;
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
 */
function customKeybindings(options: ExtensionOptions) {
  return keymap.of([
    // Custom Enter key handler (before default keymap)
    {
      key: 'Enter',
      run: handleEnterKey
    },

    // Standard keymaps
    // REMOVED: closeBracketsKeymap (was intercepting closing brackets)
    ...defaultKeymap,
    ...searchKeymap,
    ...historyKeymap,
    ...foldKeymap,
    ...completionKeymap,

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
      : []),

    // Undo/Redo (ensure they work)
    {
      key: 'Mod-z',
      run: undo
    },
    {
      key: 'Mod-Shift-z',
      run: redo
    },
    {
      key: 'Mod-y',
      mac: 'Mod-Shift-z',
      run: redo
    }
  ]);
}

/**
 * Create a linter from our validation function
 */
function createLinter(validationType: 'expression' | 'function' | 'script') {
  return linter((view) => {
    const code = view.state.doc.toString();
    const validation = validateJavaScript(code, validationType);

    if (validation.valid) {
      return [];
    }

    const diagnostics: Diagnostic[] = [];

    // Calculate position from line/column
    let from = 0;
    let to = code.length;

    if (validation.line !== undefined) {
      const lines = code.split('\n');
      const lineIndex = validation.line - 1;

      if (lineIndex >= 0 && lineIndex < lines.length) {
        // Calculate character position of the line
        from = lines.slice(0, lineIndex).reduce((sum, line) => sum + line.length + 1, 0);

        if (validation.column !== undefined) {
          from += validation.column;
          to = from + 1; // Highlight just one character
        } else {
          to = from + lines[lineIndex].length;
        }
      }
    }

    diagnostics.push({
      from: Math.max(0, from),
      to: Math.min(code.length, to),
      severity: 'error',
      message: validation.error || 'Syntax error'
    });

    return diagnostics;
  });
}

/**
 * Create all CodeMirror extensions
 */
export function createExtensions(options: ExtensionOptions = {}): Extension[] {
  const {
    validationType = 'expression',
    placeholder = '// Enter your JavaScript code here',
    readOnly = false,
    onChange,
    tabSize = 2
  } = options;

  // Adding extensions back one by one to find the culprit
  const extensions: Extension[] = [
    // 1. Language support
    javascript(),

    // 2. Theme
    createOpenNoodlTheme(),

    // 3. Custom keybindings with Enter handler
    customKeybindings(options),

    // 4. Essential UI
    lineNumbers(),
    history(),

    // 5. Visual enhancements (Group 1 - SAFE ✅)
    highlightActiveLineGutter(),
    highlightActiveLine(),
    drawSelection(),
    dropCursor(),
    rectangularSelection(),

    // 6. Bracket & selection features (Group 2 - SAFE ✅)
    bracketMatching(),
    highlightSelectionMatches(),
    placeholderExtension(placeholder),
    EditorView.lineWrapping,

    // 7. Complex features (tested safe)
    foldGutter({
      openText: '▼',
      closedText: '▶'
    }),
    autocompletion({
      activateOnTyping: true,
      maxRenderedOptions: 10,
      defaultKeymap: true,
      override: [noodlCompletionSource]
    }),

    // 8. Tab size
    EditorState.tabSize.of(tabSize),

    // 9. Read-only mode
    EditorView.editable.of(!readOnly),
    EditorState.readOnly.of(readOnly),

    // 10. onChange handler
    ...(onChange
      ? [
          EditorView.updateListener.of((update: ViewUpdate) => {
            if (update.docChanged) {
              onChange(update.state.doc.toString());
            }
          })
        ]
      : [])

    // ALL EXTENSIONS NOW ENABLED (except closeBrackets/indentOnInput)
    // closeBrackets() - PERMANENTLY DISABLED (conflicted with custom Enter handler)
    // closeBracketsKeymap - PERMANENTLY REMOVED (intercepted closing brackets)
    // indentOnInput() - PERMANENTLY DISABLED (not needed with our custom handler)
  ];

  return extensions;
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
