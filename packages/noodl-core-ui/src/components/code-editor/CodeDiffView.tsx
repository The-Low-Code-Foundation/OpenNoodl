/**
 * CodeDiffView Component
 *
 * A read-only side-by-side code diff powered by CodeMirror 6's MergeView.
 * Shares the OpenNoodl editor theme + JavaScript highlighting with
 * {@link JavaScriptEditor}, so diffs look like the rest of the editor.
 *
 * Replaces the former Monaco `createDiffEditor` used by CodeDiffDialog
 * (DEBT-013 — the last Monaco consumers).
 *
 * @module code-editor
 */

import { javascript } from '@codemirror/lang-javascript';
import { syntaxHighlighting, defaultHighlightStyle, foldGutter, bracketMatching } from '@codemirror/language';
import { MergeView } from '@codemirror/merge';
import { EditorState, Extension } from '@codemirror/state';
import { EditorView, lineNumbers, highlightActiveLineGutter } from '@codemirror/view';
import React, { useEffect, useRef } from 'react';

import { createOpenNoodlTheme } from './codemirror-theme';

export interface CodeDiffViewProps {
  /** The "before" side. Always shown. */
  original: string;
  /** The "after" side. When omitted, a single read-only view is shown instead of a diff. */
  modified?: string;
  /** Container height (CSS value). Defaults to 100%. */
  height?: string;
}

/**
 * Read-only extensions shared by both the single-side and merge views.
 * Deliberately excludes editing affordances (autocomplete, linting, save
 * handlers) that {@link JavaScriptEditor} adds — this is a viewer, not an editor.
 */
function readOnlyExtensions(): Extension[] {
  return [
    javascript(),
    createOpenNoodlTheme(),
    syntaxHighlighting(defaultHighlightStyle),
    lineNumbers(),
    highlightActiveLineGutter(),
    foldGutter(),
    bracketMatching(),
    EditorView.lineWrapping,
    EditorView.editable.of(false),
    EditorState.readOnly.of(true)
  ];
}

export function CodeDiffView({ original, modified, height = '100%' }: CodeDiffViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    // Single-side (pure add or pure delete) — no diff to compute, just show the content.
    if (modified === undefined || modified === null || original === undefined || original === null) {
      const view = new EditorView({
        state: EditorState.create({
          doc: modified ?? original ?? '',
          extensions: readOnlyExtensions()
        }),
        parent: container
      });

      return () => view.destroy();
    }

    // Two-sided — CodeMirror MergeView renders the side-by-side diff with change gutters.
    const merge = new MergeView({
      a: {
        doc: original,
        extensions: readOnlyExtensions()
      },
      b: {
        doc: modified,
        extensions: readOnlyExtensions()
      },
      parent: container,
      collapseUnchanged: { margin: 3, minSize: 4 },
      highlightChanges: true,
      gutter: true
    });

    return () => merge.destroy();
  }, [original, modified]);

  return <div ref={containerRef} className="cm-diff-view" style={{ height, overflow: 'auto' }} />;
}
