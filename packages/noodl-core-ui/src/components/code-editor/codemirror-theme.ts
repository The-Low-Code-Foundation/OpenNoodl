/**
 * CodeMirror Theme for NodeGX
 *
 * Every colour resolves from the UIX-001 design tokens via `var()` — UI colours
 * from `--theme-color-*` and syntax colours from `--theme-color-syntax-*` (dark
 * lineage VSCode Dark+, light lineage VSCode Light+, both defined in colors.css).
 * Because the values are CSS variables, the editor flips between light and dark
 * automatically when the ThemeManager changes the root `data-theme` attribute —
 * the theme extension never needs to be re-instantiated (UIX-008).
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
        backgroundColor: 'var(--theme-color-primary-25)'
      },

      // Active line
      '.cm-activeLine': {
        backgroundColor: 'var(--theme-color-bg-hover)'
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
        backgroundColor: 'var(--theme-color-bg-hover)',
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
        backgroundColor: 'var(--theme-color-bg-hover)',
        border: '1px solid var(--theme-color-border-default)',
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
        backgroundColor: 'var(--theme-color-warning-bg)',
        outline: '1px solid var(--theme-color-warning)'
      },

      '.cm-searchMatch-selected': {
        backgroundColor: 'var(--theme-color-primary-25)',
        outline: '1px solid var(--theme-color-primary)'
      },

      // Highlight selection matches
      '.cm-selectionMatch': {
        backgroundColor: 'var(--theme-color-bg-hover)',
        outline: '1px solid var(--theme-color-border-default)'
      },

      // Matching brackets
      '.cm-matchingBracket': {
        backgroundColor: 'var(--theme-color-primary-transparent)',
        outline: '1px solid var(--theme-color-primary)',
        borderRadius: '2px'
      },

      '.cm-nonmatchingBracket': {
        backgroundColor: 'var(--theme-color-danger-bg)',
        outline: '1px solid var(--theme-color-danger)'
      },

      // Autocomplete panel
      '.cm-tooltip-autocomplete': {
        backgroundColor: 'var(--theme-color-bg-3)',
        border: '1px solid var(--theme-color-border-default)',
        borderRadius: '6px',
        boxShadow: 'var(--shadow-md)',
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
        color: 'var(--theme-color-on-primary)'
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
        color: 'var(--theme-color-danger)'
      },

      '.cm-lint-marker-warning': {
        content: '●',
        color: 'var(--theme-color-warning)'
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
        boxShadow: 'var(--shadow-default)'
      },

      '.cm-tooltip-lint': {
        fontFamily: "var(--theme-font-mono, 'Monaco', 'Menlo', 'Courier New', monospace)"
      },

      // Placeholder
      '.cm-placeholder': {
        color: 'var(--theme-color-fg-muted)',
        opacity: 0.6
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

  // Syntax highlighting theme (token colors).
  // Colours resolve from the UIX-001 design tokens (colors.css
  // `--theme-color-syntax-*`, dark + light variants) via `var()`, so the whole
  // theme flips with the app's `data-theme` attribute — no re-instantiation.
  const C = {
    keyword: 'var(--theme-color-syntax-keyword)',
    control: 'var(--theme-color-syntax-control)',
    comment: 'var(--theme-color-syntax-comment)',
    string: 'var(--theme-color-syntax-string)',
    stringSpecial: 'var(--theme-color-syntax-string-special)',
    number: 'var(--theme-color-syntax-number)',
    variable: 'var(--theme-color-syntax-variable)',
    func: 'var(--theme-color-syntax-function)',
    property: 'var(--theme-color-syntax-property)',
    propertySpecial: 'var(--theme-color-syntax-property-special)',
    operator: 'var(--theme-color-syntax-operator)',
    punctuation: 'var(--theme-color-syntax-punctuation)',
    type: 'var(--theme-color-syntax-type)',
    meta: 'var(--theme-color-syntax-meta)',
    escape: 'var(--theme-color-syntax-escape)',
    label: 'var(--theme-color-syntax-label)',
    invalid: 'var(--theme-color-syntax-invalid)',
    paren: 'var(--theme-color-syntax-paren)',
    bracket: 'var(--theme-color-syntax-bracket)',
    brace: 'var(--theme-color-syntax-brace)',
    angle: 'var(--theme-color-syntax-angle)'
  };

  const syntaxTheme = HighlightStyle.define([
    // Keywords (if, for, function, return, etc.)
    { tag: t.keyword, color: C.keyword, fontWeight: 'bold' },

    // Control keywords (if, else, switch, case)
    { tag: t.controlKeyword, color: C.control, fontWeight: 'bold' },

    // Definition keywords (function, class, const, let, var)
    { tag: t.definitionKeyword, color: C.keyword, fontWeight: 'bold' },

    // Module keywords (import, export)
    { tag: t.moduleKeyword, color: C.control, fontWeight: 'bold' },

    // Operator keywords (typeof, instanceof, new, delete)
    { tag: t.operatorKeyword, color: C.keyword, fontWeight: 'bold' },

    // Comments
    { tag: t.comment, color: C.comment, fontStyle: 'italic' },
    { tag: t.lineComment, color: C.comment, fontStyle: 'italic' },
    { tag: t.blockComment, color: C.comment, fontStyle: 'italic' },

    // Strings
    { tag: t.string, color: C.string },
    { tag: t.special(t.string), color: C.stringSpecial },

    // Numbers
    { tag: t.number, color: C.number },
    { tag: t.integer, color: C.number },
    { tag: t.float, color: C.number },

    // Booleans
    { tag: t.bool, color: C.keyword, fontWeight: 'bold' },

    // Null/Undefined
    { tag: t.null, color: C.keyword, fontWeight: 'bold' },

    // Variables
    { tag: t.variableName, color: C.variable },
    { tag: t.local(t.variableName), color: C.variable },
    { tag: t.definition(t.variableName), color: C.variable },

    // Functions
    { tag: t.function(t.variableName), color: C.func },
    { tag: t.function(t.propertyName), color: C.func },

    // Properties
    { tag: t.propertyName, color: C.property },
    { tag: t.special(t.propertyName), color: C.propertySpecial },

    // Operators
    { tag: t.operator, color: C.operator },
    { tag: t.arithmeticOperator, color: C.operator },
    { tag: t.logicOperator, color: C.operator },
    { tag: t.compareOperator, color: C.operator },

    // Punctuation
    { tag: t.punctuation, color: C.punctuation },
    { tag: t.separator, color: C.punctuation },
    { tag: t.paren, color: C.paren }, // Bracket-pair colourization
    { tag: t.bracket, color: C.bracket },
    { tag: t.brace, color: C.brace },
    { tag: t.squareBracket, color: C.bracket },
    { tag: t.angleBracket, color: C.angle },

    // Types (for TypeScript/JSDoc)
    { tag: t.typeName, color: C.type },
    { tag: t.className, color: C.type },
    { tag: t.namespace, color: C.type },

    // Special identifiers (self keyword)
    { tag: t.self, color: C.keyword, fontWeight: 'bold' },

    // Regular expressions
    { tag: t.regexp, color: C.stringSpecial },

    // Invalid/Error
    { tag: t.invalid, color: C.invalid, textDecoration: 'underline' },

    // Meta
    { tag: t.meta, color: C.meta },

    // Escape sequences
    { tag: t.escape, color: C.escape },

    // Labels
    { tag: t.labelName, color: C.label }
  ]);

  return [editorTheme, syntaxHighlighting(syntaxTheme)];
}
