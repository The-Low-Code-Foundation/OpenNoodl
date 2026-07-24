import React, { useEffect, useRef, useState } from 'react';

export interface ColorPickerFieldsProps {
  /** '#RRGGBB', already upper-cased */
  hex: string;
  /** '' when fully opaque, otherwise '42%' */
  opacity: string;
  /** Bumped by the owner on every re-render so the fields re-sync even when
   *  the committed value did not change (the legacy view re-set `.val()`
   *  unconditionally, which is what re-formats an invalid entry). */
  revision: number;

  onHexCommit: (value: string) => void;
  onOpacityCommit: (value: string) => void;
}

/**
 * The hex + opacity row underneath the colour wheel in the colour picker popout.
 * Commits on blur and on Enter, and only when the value actually changed —
 * the legacy `change` event semantics, which keeps a plain open/close of the
 * popout out of the undo queue.
 */
export function ColorPickerFields({ hex, opacity, revision, onHexCommit, onOpacityCommit }: ColorPickerFieldsProps) {
  const [hexDraft, setHexDraft] = useState(hex);
  const [opacityDraft, setOpacityDraft] = useState(opacity);

  const committedHex = useRef(hex);
  const committedOpacity = useRef(opacity);

  useEffect(() => {
    setHexDraft(hex);
    setOpacityDraft(opacity);
    committedHex.current = hex;
    committedOpacity.current = opacity;
  }, [hex, opacity, revision]);

  function commit(value: string, committed: React.MutableRefObject<string>, onCommit: (value: string) => void) {
    if (value === committed.current) return;
    committed.current = value;
    onCommit(value);
  }

  function onKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    committed: React.MutableRefObject<string>,
    onCommit: (value: string) => void
  ) {
    if (e.key !== 'Enter') return;
    commit(e.currentTarget.value, committed, onCommit);
    e.currentTarget.blur();
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', color: '#F8F8F8', marginTop: 16 }}>
      Hex
      <div style={{ display: 'flex', marginLeft: 8, height: 35 }}>
        <div style={{ height: '100%', flexGrow: 1 }}>
          <input
            type="text"
            className="sidebar-panel-dark-input"
            style={{ width: '100%', height: '100%' }}
            value={hexDraft}
            onChange={(e) => setHexDraft(e.target.value)}
            onClick={(e) => e.currentTarget.select()}
            onBlur={(e) => commit(e.target.value, committedHex, onHexCommit)}
            onKeyDown={(e) => onKeyDown(e, committedHex, onHexCommit)}
          />
        </div>
        <input
          type="text"
          placeholder="100%"
          className="sidebar-panel-dark-input"
          style={{ width: 50, height: '100%' }}
          value={opacityDraft}
          onChange={(e) => setOpacityDraft(e.target.value)}
          onClick={(e) => e.currentTarget.select()}
          onBlur={(e) => commit(e.target.value, committedOpacity, onOpacityCommit)}
          onKeyDown={(e) => onKeyDown(e, committedOpacity, onOpacityCommit)}
        />
      </div>
    </div>
  );
}
