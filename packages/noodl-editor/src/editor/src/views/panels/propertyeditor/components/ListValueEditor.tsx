import React, { useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, Root } from 'react-dom/client';

import { JSONEditor } from '@noodl-core-ui/components/json-editor';
import {
  decodeForEditor,
  encodeFromEditor,
  optionsListJsonForMode,
  type ListPortType
} from '@noodl-core-ui/components/json-editor/utils/listValueCodec';
import type { EditorMode } from '@noodl-core-ui/components/json-editor/utils/types';

import css from './ListValueEditor.module.scss';

/**
 * ERG-003 — the one editor every list-shaped port opens.
 *
 * `JSONEditor` (visual tree + code, already in core-ui) was used in exactly one
 * place before this: the app-level Variables section. This is the host that
 * makes it the property panel's list editor too, for `array`, `object` and — since §3,
 * 2026-09-04 — `optionslist`. (`stringlist` and `proplist` keep their own row types.)
 *
 * Everything type-specific lives in `listValueCodec`; this file only knows how
 * to put the editor on screen and when it is allowed to write.
 *
 * The commit rule matters more than the chrome: **an edit that cannot be
 * encoded writes nothing.** `JSONEditor`'s Easy mode renders an empty tree over
 * any value it cannot parse, so a popout that wrote through on close would turn
 * one unreadable value into no value at all. Instead the error is shown, Save
 * stays refused, and closing keeps what was there.
 */

export interface ListValueEditorProps {
  portType: ListPortType;
  displayName: string;
  /** The parameter as currently stored. */
  stored: unknown;
  /** Called only with a value that encoded cleanly. */
  onCommit: (value: unknown) => void;
  onRequestClose: () => void;
  disabled?: boolean;
}

export function ListValueEditor({
  portType,
  displayName,
  stored,
  onCommit,
  onRequestClose,
  disabled
}: ListValueEditorProps) {
  const decoded = useMemo(() => decodeForEditor(portType, stored), [portType, stored]);

  const [text, setText] = useState(decoded.json);
  const [error, setError] = useState<string | undefined>(undefined);
  const [saved, setSaved] = useState(false);

  const hint = decoded.unparseable
    ? `This value could not be read as JSON, so it is shown exactly as stored and the visual builder is unavailable. Nothing has been changed.`
    : decoded.recovered
      ? portType === 'optionslist'
        ? `This list was stored in the older format. It is shown as options; saving will store the new form.`
        : `This was stored as a JavaScript literal. It is shown as JSON; saving will store the JSON form.`
      : undefined;

  function commit(): boolean {
    const result = encodeFromEditor(portType, text, stored);
    if (!result.ok) {
      setError(result.error);
      setSaved(false);
      return false;
    }
    setError(undefined);
    onCommit(result.value);
    setSaved(true);
    return true;
  }

  return (
    <div className={css['Root']}>
      <div className={css['Header']}>
        <span className={css['Title']}>{displayName}</span>
        <span className={css['PortType']}>{portType}</span>
      </div>

      {hint && <div className={css['Hint']}>{hint}</div>}

      <JSONEditor
        // Deliberately the decoded text, not `text`: `JSONEditor` keeps its own
        // string state and re-syncs whenever this prop changes, so feeding the
        // draft back in would fight the user's cursor on every keystroke.
        value={decoded.json}
        onChange={(next) => {
          setText(next);
          setError(undefined);
          setSaved(false);
        }}
        // A value we could not parse must not be handed to the visual builder:
        // it would render as empty and one click would replace the original.
        mode={decoded.unparseable ? 'advanced' : undefined}
        defaultMode="easy"
        // 🔴 Easy mode hides a Value that only mirrors its Label; Advanced mode must still show
        // it, or an author who needs "Large" to send `l` has nothing to edit. Richard,
        // 2026-09-06 — see `optionsListJsonForMode`. Only `optionslist` spells itself two ways;
        // every other list port shows one text in both modes, so it passes nothing.
        transformForMode={
          portType === 'optionslist' ? (json: string, mode: EditorMode) => optionsListJsonForMode(json, mode) : undefined
        }
        expectedType={decoded.expectedType}
        disabled={disabled}
        height={340}
      />

      {error && <div className={css['Error']}>{error}</div>}

      <div className={css['Buttons']}>
        {saved && !error && <span className={css['Saved']}>Saved</span>}
        <button
          type="button"
          className={`${css['Button']} ${css['ButtonPrimary']}`}
          disabled={disabled}
          onClick={() => commit()}
        >
          Save
        </button>
        <button type="button" className={css['Button']} onClick={onRequestClose}>
          Close
        </button>
      </div>
    </div>
  );
}

/**
 * Open the list editor as a property-panel popout.
 *
 * `parent` is the `Ports` view, which owns popout lifetime. Returns a disposer
 * the caller runs on close so the React root is never leaked (DEBT-010).
 */
export function openListValueEditor(args: {
  parent: TSFixme;
  anchor: HTMLElement;
  portType: ListPortType;
  displayName: string;
  stored: unknown;
  disabled?: boolean;
  onCommit: (value: unknown) => void;
}) {
  const div = document.createElement('div');
  const root: Root = createRoot(div);

  const close = () => args.parent.hidePopout();

  // Synchronous so showPopout can measure real content (DEBT-010). A React 18
  // root renders on its own schedule, so without this the popout is measured
  // as 0×0 and lands with its top edge at the button's Y — off the bottom of
  // the window for any row in the lower half of the panel (FH-005).
  flushSync(() =>
    root.render(
      React.createElement(ListValueEditor, {
        portType: args.portType,
        displayName: args.displayName,
        stored: args.stored,
        disabled: args.disabled,
        onCommit: args.onCommit,
        onRequestClose: close
      })
    )
  );

  args.parent.showPopout({
    content: { el: div },
    attachTo: args.anchor,
    position: 'right',
    disableDynamicPositioning: true,
    onClose: () => {
      // Deferred: onClose runs inside the React event that closed the popout.
      setTimeout(() => root.unmount(), 0);
    }
  });
}
