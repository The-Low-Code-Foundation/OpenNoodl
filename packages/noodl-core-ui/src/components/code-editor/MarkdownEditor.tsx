/**
 * MarkdownEditor — a plain CodeMirror 6 surface for markdown source.
 *
 * AIX-009's Docs panel renders project docs with {@link Markdown} by default
 * and toggles to this for editing. Deliberately much smaller than
 * {@link JavaScriptEditor}: no resize grip, no format button, no linting, no
 * completion. These are files on disk in git and VS Code exists — the panel
 * earns its place as the surface where AI-proposed doc diffs are reviewed, not
 * as a text editor.
 *
 * Externally-driven value changes (the file changed on disk) are applied to the
 * document without destroying the view, so the cursor and scroll position
 * survive a refresh; a change the user is typing is never round-tripped back
 * over their cursor, because `value` only differs when it came from outside.
 *
 * @module code-editor
 */

import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, placeholder as placeholderExtension } from '@codemirror/view';
import React, { useEffect, useRef } from 'react';

import { createOpenNoodlTheme } from './codemirror-theme';
import { markdownExtensions } from './markdown-language';

export interface MarkdownEditorProps {
  value: string;
  onChange?: (value: string) => void;
  /** Cmd/Ctrl+S inside the editor. */
  onSave?: (value: string) => void;
  isReadOnly?: boolean;
  placeholder?: string;
  /** CSS height for the editor container. Defaults to 100%. */
  height?: string;
}

export function MarkdownEditor({
  value,
  onChange,
  onSave,
  isReadOnly = false,
  placeholder = 'Write in markdown…',
  height = '100%'
}: MarkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  // Latest handlers, read through refs so changing them never rebuilds the view
  // (which would drop the user's cursor mid-sentence).
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  onChangeRef.current = onChange;
  onSaveRef.current = onSave;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          ...markdownExtensions(),
          createOpenNoodlTheme(),
          history(),
          keymap.of([
            ...defaultKeymap,
            ...historyKeymap,
            indentWithTab,
            {
              key: 'Mod-s',
              preventDefault: true,
              run: (target) => {
                onSaveRef.current?.(target.state.doc.toString());
                return true;
              }
            }
          ]),
          placeholderExtension(placeholder),
          EditorView.lineWrapping,
          EditorView.editable.of(!isReadOnly),
          EditorState.readOnly.of(isReadOnly),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current?.(update.state.doc.toString());
          })
        ]
      }),
      parent: container
    });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Rebuilt only for things that change the editor's nature, never for value.
  }, [isReadOnly, placeholder]);

  // An external change (disk, or an accepted proposal) is applied as a
  // transaction rather than by recreating the view.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
  }, [value]);

  return <div ref={containerRef} style={{ height, overflow: 'auto' }} />;
}
