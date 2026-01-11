/**
 * CodeMirror Theme for OpenNoodl
 *
 * Custom theme matching OpenNoodl design tokens and VSCode Dark+ colors.
 * Provides syntax highlighting, UI colors, and visual feedback.
 *
 * @module code-editor
 */

import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';

/**
 * Create the OpenNoodl editor theme
 */
export function createOpenNoodlTheme(): Extension {
  // Editor theme (UI elements)
  const editorTheme = EditorView.theme(
    {
      // Main editor
      '&': {
        backgroundColor: 'var(--theme-color-bg-2)',
        color: 'var(--theme-color-fg-default)',
        fontSize: '13px',
        fontFamily: "var(--theme-font-mono, 'Monaco', 'Menlo', 'Courier New', monospace)",
        lineHeight: '1.6'
      },

      // Content area
      '.cm-content': {
        caretColor: 'var(--theme-color-fg-default)',
        padding: '16px 0'
      },

      // Cursor
      '.cm-cursor, .cm-dropCursor': {
        borderLeftColor: 'var(--theme-color-fg-default)',
        borderLeftWidth: '2px'
      },

      // Selection
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
        backgroundColor: 'rgba(86, 156, 214, 0.3)'
      },

      // Active line
      '.cm-activeLine': {
        backgroundColor: 'rgba(255, 255, 255, 0.05)'
      },

      // Line numbers gutter
      '.cm-gutters': {
        backgroundColor: 'var(--theme-color-bg-3)',
        color: 'var(--theme-color-fg-muted)',
        border: 'none',
        borderRight: '1px solid var(--theme-color-border-default)',
        minWidth: '35px'
      },

      '.cm-gutter': {
        minWidth: '35px'
      },

      '.cm-lineNumbers': {
        minWidth: '35px'
      },

      '.cm-lineNumbers .cm-gutterElement': {
        padding: '0 8px 0 6px',
        textAlign: 'right',
        minWidth: '35px'
      },

      // Active line number
      '.cm-activeLineGutter': {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        color: 'var(--theme-color-fg-default)'
      },

      // Fold gutter
      '.cm-foldGutter': {
        width: '20px',
        padding: '0 4px'
      },

      '.cm-foldGutter .cm-gutterElement': {
        textAlign: 'center',
        cursor: 'pointer'
      },

      '.cm-foldPlaceholder': {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        color: 'var(--theme-color-fg-muted)',
        borderRadius: '3px',
        padding: '0 6px',
        margin: '0 4px'
      },

      // Search panel
      '.cm-panel': {
        backgroundColor: 'var(--theme-color-bg-3)',
        border: '1px solid var(--theme-color-border-default)',
        borderRadius: '4px',
        padding: '8px'
      },

      '.cm-panel.cm-search': {
        padding: '8px 12px'
      },

      '.cm-searchMatch': {
        backgroundColor: 'rgba(255, 215, 0, 0.3)',
        outline: '1px solid rgba(255, 215, 0, 0.5)'
      },

      '.cm-searchMatch-selected': {
        backgroundColor: 'rgba(255, 165, 0, 0.4)',
        outline: '1px solid rgba(255, 165, 0, 0.7)'
      },

      // Highlight selection matches
      '.cm-selectionMatch': {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        outline: '1px solid rgba(255, 255, 255, 0.2)'
      },

      // Matching brackets
      '.cm-matchingBracket': {
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        outline: '1px solid rgba(255, 255, 255, 0.3)',
        borderRadius: '2px'
      },

      '.cm-nonmatchingBracket': {
        backgroundColor: 'rgba(255, 0, 0, 0.2)',
        outline: '1px solid rgba(255, 0, 0, 0.4)'
      },

      // Autocomplete panel
      '.cm-tooltip-autocomplete': {
        backgroundColor: 'var(--theme-color-bg-3)',
        border: '1px solid var(--theme-color-border-default)',
        borderRadius: '6px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        overflow: 'hidden',
        fontFamily: "var(--theme-font-mono, 'Monaco', 'Menlo', 'Courier New', monospace)",
        fontSize: '13px'
      },

      '.cm-tooltip-autocomplete ul': {
        maxHeight: '300px',
        overflowY: 'auto'
      },

      '.cm-tooltip-autocomplete ul li': {
        padding: '6px 12px',
        color: 'var(--theme-color-fg-default)',
        cursor: 'pointer'
      },

      '.cm-tooltip-autocomplete ul li[aria-selected]': {
        backgroundColor: 'var(--theme-color-primary)',
        color: 'white'
      },

      '.cm-completionIcon': {
        width: '1em',
        marginRight: '8px',
        fontSize: '14px',
        lineHeight: '1'
      },

      // Lint markers (errors/warnings)
      '.cm-lintRange-error': {
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='6' height='3'%3E%3Cpath d='m0 3 l3 -3 l3 3' stroke='%23ef4444' fill='none' stroke-width='.7'/%3E%3C/svg%3E\")",
        backgroundRepeat: 'repeat-x',
        backgroundPosition: 'left bottom',
        paddingBottom: '3px'
      },

      '.cm-lintRange-warning': {
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='6' height='3'%3E%3Cpath d='m0 3 l3 -3 l3 3' stroke='%23f59e0b' fill='none' stroke-width='.7'/%3E%3C/svg%3E\")",
        backgroundRepeat: 'repeat-x',
        backgroundPosition: 'left bottom',
        paddingBottom: '3px'
      },

      '.cm-lint-marker-error': {
        content: '●',
        color: '#ef4444'
      },

      '.cm-lint-marker-warning': {
        content: '●',
        color: '#f59e0b'
      },

      // Hover tooltips
      '.cm-tooltip': {
        backgroundColor: 'var(--theme-color-bg-4)',
        border: '1px solid var(--theme-color-border-default)',
        borderRadius: '4px',
        padding: '6px 10px',
        color: 'var(--theme-color-fg-default)',
        fontSize: '12px',
        maxWidth: '400px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
      },

      '.cm-tooltip-lint': {
        fontFamily: "var(--theme-font-mono, 'Monaco', 'Menlo', 'Courier New', monospace)"
      },

      // Placeholder
      '.cm-placeholder': {
        color: 'var(--theme-color-fg-muted)',
        opacity: 0.6
      },

      // Indent guides (will be added via custom extension)
      '.cm-indent-guide': {
        position: 'absolute',
        top: '0',
        bottom: '0',
        width: '1px',
        backgroundColor: 'rgba(255, 255, 255, 0.1)'
      },

      // Scroller
      '.cm-scroller': {
        overflow: 'auto',
        fontFamily: "var(--theme-font-mono, 'Monaco', 'Menlo', 'Courier New', monospace)"
      },

      // Focused state
      '&.cm-focused': {
        outline: 'none'
      }
    },
    { dark: true }
  );

  // Syntax highlighting theme (token colors)
  const syntaxTheme = HighlightStyle.define([
    // Keywords (if, for, function, return, etc.)
    { tag: t.keyword, color: '#569cd6', fontWeight: 'bold' },

    // Control keywords (if, else, switch, case)
    { tag: t.controlKeyword, color: '#c586c0', fontWeight: 'bold' },

    // Definition keywords (function, class, const, let, var)
    { tag: t.definitionKeyword, color: '#569cd6', fontWeight: 'bold' },

    // Module keywords (import, export)
    { tag: t.moduleKeyword, color: '#c586c0', fontWeight: 'bold' },

    // Operator keywords (typeof, instanceof, new, delete)
    { tag: t.operatorKeyword, color: '#569cd6', fontWeight: 'bold' },

    // Comments
    { tag: t.comment, color: '#6a9955', fontStyle: 'italic' },
    { tag: t.lineComment, color: '#6a9955', fontStyle: 'italic' },
    { tag: t.blockComment, color: '#6a9955', fontStyle: 'italic' },

    // Strings
    { tag: t.string, color: '#ce9178' },
    { tag: t.special(t.string), color: '#d16969' },

    // Numbers
    { tag: t.number, color: '#b5cea8' },
    { tag: t.integer, color: '#b5cea8' },
    { tag: t.float, color: '#b5cea8' },

    // Booleans
    { tag: t.bool, color: '#569cd6', fontWeight: 'bold' },

    // Null/Undefined
    { tag: t.null, color: '#569cd6', fontWeight: 'bold' },

    // Variables
    { tag: t.variableName, color: '#9cdcfe' },
    { tag: t.local(t.variableName), color: '#9cdcfe' },
    { tag: t.definition(t.variableName), color: '#9cdcfe' },

    // Functions
    { tag: t.function(t.variableName), color: '#dcdcaa' },
    { tag: t.function(t.propertyName), color: '#dcdcaa' },

    // Properties
    { tag: t.propertyName, color: '#9cdcfe' },
    { tag: t.special(t.propertyName), color: '#4fc1ff' },

    // Operators
    { tag: t.operator, color: '#d4d4d4' },
    { tag: t.arithmeticOperator, color: '#d4d4d4' },
    { tag: t.logicOperator, color: '#d4d4d4' },
    { tag: t.compareOperator, color: '#d4d4d4' },

    // Punctuation
    { tag: t.punctuation, color: '#d4d4d4' },
    { tag: t.separator, color: '#d4d4d4' },
    { tag: t.paren, color: '#ffd700' }, // Gold for ()
    { tag: t.bracket, color: '#87ceeb' }, // Sky blue for []
    { tag: t.brace, color: '#98fb98' }, // Pale green for {}
    { tag: t.squareBracket, color: '#87ceeb' },
    { tag: t.angleBracket, color: '#dda0dd' },

    // Types (for TypeScript/JSDoc)
    { tag: t.typeName, color: '#4ec9b0' },
    { tag: t.className, color: '#4ec9b0' },
    { tag: t.namespace, color: '#4ec9b0' },

    // Special identifiers (self keyword)
    { tag: t.self, color: '#569cd6', fontWeight: 'bold' },

    // Regular expressions
    { tag: t.regexp, color: '#d16969' },

    // Invalid/Error
    { tag: t.invalid, color: '#f44747', textDecoration: 'underline' },

    // Meta
    { tag: t.meta, color: '#808080' },

    // Escape sequences
    { tag: t.escape, color: '#d7ba7d' },

    // Labels
    { tag: t.labelName, color: '#c8c8c8' }
  ]);

  return [editorTheme, syntaxHighlighting(syntaxTheme)];
}
