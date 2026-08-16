/**
 * CN-006 — ✅ **D1's "opens `index.js` in the code editor", built literally.**
 *
 * ## Why this is a document and not a popout
 *
 * The editor already had three ways to show code and none of them could show a
 * *file*. `CodeEditorType` is a `TypeView` bound to `getParameter`/`setParameter`
 * on a node; the two propertyeditor modals are portals over a node's parameter
 * too. All three are anchored to a graph object, and a kit's `index.js` is not
 * one — it is a file the runtime executes, which the author was previously sent
 * to Finder to open in another application.
 *
 * A **document** (`IDocumentProvider`) is the surface with the room: full height,
 * replacing the canvas, returning to it with one control. A popout is a floating
 * anchored box, which is the wrong shape for the file you are meant to *write a
 * node in*.
 *
 * ## The three things that make it a real editor rather than a text box
 *
 * 1. **Dirty state is derived, never stored.** `draft !== null && draft !==
 *    baseline` — the same expression `DocsPanel` uses. A `isDirty` boolean beside
 *    it would be a second opinion that every reload path could falsify.
 * 2. **An external edit never clobbers, in either direction.** The poll follows
 *    the file, but a buffer the author is editing is left alone and *reported*;
 *    and the save is baseline-checked, so it is refused rather than silently
 *    winning. Both halves are needed: guarding only one of them just picks which
 *    side loses.
 * 3. **Cmd-S saves**, because `JavaScriptEditor` already wires it whenever
 *    `onSave` is supplied — nothing here re-implements a keybinding.
 *
 * ⚠️ **The editor is mounted with `value={draft ?? content}`.** `JavaScriptEditor`
 * applies an external `value` change as a *minimal* document patch annotated
 * `externalValueSync`, so a reload does not echo back through `onChange` and
 * costs one undo step rather than replacing the whole buffer.
 *
 * @module noodl-editor/views/documents/CodeFileDocument
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AppRegistry, IDocumentProvider } from '@noodl-models/app_registry';
import { ProjectModel } from '@noodl-models/projectmodel';

import { IconName } from '@noodl-core-ui/components/common/Icon';
import { JavaScriptEditor, setOpenNodeContext } from '@noodl-core-ui/components/code-editor';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { Label } from '@noodl-core-ui/components/typography/Label';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import {
  CODE_FILES_CHANGED,
  CodeFileConflictError,
  ProjectCodeFileModel
} from '../../../models/ProjectFiles/ProjectCodeFileModel';
import { EditorDocumentProvider } from '../EditorDocument';
import css from './CodeFileDocument.module.scss';

const EVENT_GROUP = 'CodeFileDocument';

export interface CodeFileDocumentProps {
  /** Project-relative, forward-slashed — e.g. `noodl_modules/weather-kit/index.js`. */
  path: string;
}

/** The CodeMirror mode for a file, by extension. `script` is the permissive one. */
function validationTypeFor(path: string): 'script' | 'json' | 'css' | 'html' | 'text' {
  const lower = path.toLowerCase();
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.css')) return 'css';
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html';
  if (lower.endsWith('.js') || lower.endsWith('.jsx') || lower.endsWith('.mjs') || lower.endsWith('.cjs')) {
    // 'script' rather than 'function': a kit's index.js is a whole module with
    // its own top-level statements, not the body of a Function node.
    return 'script';
  }
  return 'text';
}

export function CodeFileDocument({ path }: CodeFileDocumentProps) {
  const files = useMemo(() => ProjectCodeFileModel.forProject(ProjectModel.instance), []);

  const [content, setContent] = useState<string | undefined>(undefined);
  const [baseline, setBaseline] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; isError?: boolean } | null>(null);
  const [missing, setMissing] = useState(false);

  const dirty = draft !== null && draft !== baseline;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  const close = useCallback(() => AppRegistry.instance.openDocument(EditorDocumentProvider.ID), []);

  const reload = useCallback(async () => {
    if (!files) return;
    const text = await files.read(path);
    setMissing(text === undefined);
    setContent(text ?? '');
    setBaseline(text ?? null);
    setDraft(null);
    setNotice(null);
  }, [files, path]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /*
   * CN-019 — this document is not a node, so it must not leave one standing.
   *
   * `openNode` is module-level state in `noodl-core-ui` whose only producer is
   * the property panel's `CodeEditorType`, and whose contract calls a slot left
   * behind by a closed editor *"a live wrong answer, not an empty one"*. That
   * warning is about the next popout; a file is the same hazard with nothing to
   * correct it, because nothing here ever writes the slot and so nothing here
   * ever notices it is wrong.
   *
   * ⚠️ This is belt and braces, and deliberately so. `subject="file"` below is
   * the fix — the port bar never reads the slot for a file, whatever is in it.
   * What clearing adds is the **lint** pass, which guards on `openNode != null`
   * (`portDiagnostics.ts:634-641`) and would otherwise dress a kit module's
   * `no-undef` up as advice about whichever node was last open.
   *
   * ⚠️ It clears rather than saves and restores: a document replaces the canvas,
   * so any popout that was open is behind a full-screen surface the author has
   * navigated away from, and `CodeEditorType#dispose` will clear the slot again
   * on its way out regardless.
   */
  useEffect(() => {
    setOpenNodeContext(null);
  }, [path]);

  /*
   * The poll runs only while this document is mounted, and the file is dropped
   * from the watch set on the way out. The model watches *opened* files rather
   * than sweeping the project, so leaving a closed file in the cache would mean
   * re-reading it every two seconds for the rest of the session.
   */
  useEffect(() => {
    if (!files) return;
    files.startWatching();
    return () => {
      files.forget(path);
      files.stopWatching();
    };
  }, [files, path]);

  useEffect(() => {
    if (!files) return;
    const onChanged = ({ paths }: { paths: string[] }) => {
      if (!paths.includes(path)) return;
      // The model refreshed its cache before notifying, so this is the new bytes
      // without a second read of the same file.
      const text = files.cached(path);
      setMissing(text === undefined);

      if (dirtyRef.current) {
        // ⚠️ The buffer is NOT replaced. Silently discarding the author's
        // unsaved work is the failure this whole model exists to prevent; the
        // save below will refuse until they act, which is the honest outcome.
        setNotice({
          text:
            `${path} changed on disk while you were editing. Your unsaved text is still here; ` +
            'saving will be refused until you discard it or re-apply your change.'
        });
        return;
      }
      setContent(text ?? '');
      setBaseline(text ?? null);
      setDraft(null);
    };
    files.on(CODE_FILES_CHANGED, onChanged, EVENT_GROUP + ':changed');
    return () => {
      files.off(EVENT_GROUP + ':changed');
    };
  }, [files, path]);

  const save = useCallback(
    async (value?: string) => {
      const next = value ?? draft;
      if (!files || next === null || next === undefined) return;
      try {
        await files.write(path, next, { baseline });
        setBaseline(next);
        setContent(next);
        setDraft(null);
        setMissing(false);
        setNotice(null);
      } catch (error) {
        setNotice({
          text: error instanceof CodeFileConflictError ? error.message : String(error),
          isError: true
        });
      }
    },
    [files, draft, baseline, path]
  );

  if (!files) {
    return (
      <div className={css.Root}>
        <div className={css.Topbar}>
          <Label hasLeftSpacing>Code</Label>
        </div>
        <div className={css.Notice}>No project is open.</div>
      </div>
    );
  }

  return (
    <div className={css.Root}>
      <div className={css.Topbar}>
        <Label hasLeftSpacing>{path.slice(path.lastIndexOf('/') + 1)}</Label>
        <div className={css.Identity}>
          <Text textType={TextType.Shy}>
            {path}
            {dirty ? ' — unsaved' : ''}
          </Text>
        </div>
        <div className={css.Actions}>
          <PrimaryButton
            label={dirty ? 'Save' : 'Saved'}
            icon={IconName.Check}
            size={PrimaryButtonSize.Small}
            variant={PrimaryButtonVariant.MutedOnLowBg}
            isDisabled={!dirty}
            onClick={() => void save()}
            testId="code-file-save"
          />
          <PrimaryButton
            label="Close"
            icon={IconName.ArrowLineLeft}
            size={PrimaryButtonSize.Small}
            variant={PrimaryButtonVariant.MutedOnLowBg}
            onClick={close}
            testId="code-file-close"
          />
        </div>
      </div>

      {missing && (
        <div className={css.Notice} data-test="code-file-missing">
          {path} does not exist on disk. Saving will create it.
        </div>
      )}

      {notice && (
        <div
          className={`${css.Notice} ${notice.isError ? css.NoticeError : ''}`}
          data-test="code-file-notice"
        >
          <span>{notice.text}</span>
          <span className={css.NoticeSpacer} />
          <PrimaryButton
            label="Discard mine and reload"
            size={PrimaryButtonSize.Small}
            variant={PrimaryButtonVariant.MutedOnLowBg}
            onClick={() => void reload()}
            testId="code-file-discard"
          />
        </div>
      )}

      <div className={css.Surface} data-test="code-file-surface">
        <JavaScriptEditor
          value={draft ?? content ?? ''}
          onChange={setDraft}
          onSave={(value) => void save(value)}
          validationType={validationTypeFor(path)}
          // CN-019. The mode above is a parser choice; this is what the editor is
          // actually holding. Riding both on `validationType` is what told the
          // author of a kit's `index.js` to "Type `Inputs.`" and called the file
          // a SCRIPT — a node type, in a file that has no node.
          subject="file"
          width="100%"
          height="100%"
        />
      </div>
    </div>
  );
}

export class CodeFileDocumentProvider implements IDocumentProvider {
  public static ID = 'CodeFileDocumentProvider';

  getComponent() {
    return CodeFileDocument;
  }
}

/** Open a project file in the editor's code surface. */
export function openCodeFile(relPath: string): void {
  AppRegistry.instance.openDocument(CodeFileDocumentProvider.ID, { path: relPath });
}
