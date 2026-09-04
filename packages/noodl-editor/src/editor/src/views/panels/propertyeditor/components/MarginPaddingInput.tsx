import React, { useEffect, useRef, useState } from 'react';

import { Icon, IconName } from '@noodl-core-ui/components/common/Icon';

// REL-014 — the parse, the display text and the side split all live in
// `marginPaddingEdit` rather than here, because this file imports `common/Icon`
// and is therefore unreachable from the plain-Node runner. Re-exported so the
// existing importers of these names do not have to move.
import {
  MarginPaddingParam,
  MarginPaddingSide,
  MarginPaddingValue,
  commitMarginPaddingEdit,
  editTextOf,
  isZeroValue,
  labelTextOf,
  readMarginPaddingEdit,
  scrubStartOf,
  sideOf,
  unitOf
} from './marginPaddingEdit';

export { sideOf };
export type { MarginPaddingParam, MarginPaddingSide, MarginPaddingValue };

export interface MarginPaddingInputProps {
  /**
   * comp ('margin-top', 'padding-left', ...) → explicit value or undefined.
   *
   * REL-014: a value may be a `var(--token)` string. `TextInputConfig` stamps four
   * of them onto every new Text Input, so this is the ordinary case rather than
   * the exotic one.
   */
  values: Record<string, MarginPaddingParam | undefined>;
  defaults: Record<string, MarginPaddingParam>;
  /** POL-012 — per side, whether editing one field writes all four. */
  linked: Record<MarginPaddingSide, boolean>;
  onToggleLink: (side: MarginPaddingSide) => void;

  onUpdate: (
    comp: string,
    value: MarginPaddingParam | undefined,
    opts?: { drag?: boolean; oldValue?: MarginPaddingParam }
  ) => void;
  /** All four sides of one group, as one undo step. */
  onUpdateAll: (
    side: MarginPaddingSide,
    value: MarginPaddingParam | undefined,
    opts?: { drag?: boolean; oldValues?: Record<string, MarginPaddingParam | undefined> }
  ) => void;
  onReset: () => void;
}

const UNITS = ['px', '%'];

const LABEL_POSITIONS: Record<string, React.CSSProperties> = {
  'margin-top': { left: '50%', transform: 'translateX(-50%)', top: 10 },
  'margin-bottom': { left: '50%', transform: 'translateX(-50%)', bottom: 10 },
  'margin-left': { top: '50%', transform: 'translate(-50%,-50%)', left: 32 },
  'margin-right': { top: '50%', transform: 'translate(50%,-50%)', right: 32 },
  'padding-top': { left: '50%', transform: 'translateX(-50%)', top: 46 },
  'padding-bottom': { left: '50%', transform: 'translateX(-50%)', bottom: 46 },
  'padding-left': { top: '50%', transform: 'translate(-50%,-50%)', left: 90 },
  'padding-right': { top: '50%', transform: 'translate(50%,-50%)', right: 90 }
};

const EDITBOX_WIDTH = 110;
const EDITBOX_HEIGHT = 35;

/**
 * POL-012 — the per-group lock.
 *
 * Beside its group's own tag rather than in a toolbar, because the widget shows
 * two independent groups in one 150px box and a control that is not visibly
 * *inside* the margin ring or the padding block would not say which it locks.
 */
function LinkToggle({
  side,
  linked,
  onToggle,
  style
}: {
  side: MarginPaddingSide;
  linked: boolean;
  onToggle: (side: MarginPaddingSide) => void;
  style: React.CSSProperties;
}) {
  return (
    <span
      role="button"
      tabIndex={0}
      aria-pressed={linked}
      aria-label={`Set all four ${side} values together`}
      title={linked ? `All four ${side} values change together` : `Set all four ${side} values together`}
      data-test={`marginpadding-link-${side}`}
      className={'marginpadding-link' + (linked ? ' is-linked' : '')}
      style={{ position: 'absolute', ...style }}
      onClick={(e) => {
        e.stopPropagation();
        onToggle(side);
      }}
    >
      <Icon icon={IconName.Link} UNSAFE_style={{ width: 12, height: 12 }} />
    </span>
  );
}

/**
 * The margin/padding box widget: eight value labels that support drag to
 * adjust and click to open an inline edit box. Reuses the legacy
 * marginpadding-* CSS.
 */
export function MarginPaddingInput({
  values,
  defaults,
  linked,
  onToggleLink,
  onUpdate,
  onUpdateAll,
  onReset
}: MarginPaddingInputProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  const [editComp, setEditComp] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editUnit, setEditUnit] = useState('px');
  const [editPos, setEditPos] = useState({ x: 15, y: 15 });
  const [unitDropdownOpen, setUnitDropdownOpen] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  const dragState = useRef<{
    comp: string;
    startX: number;
    startY: number;
    startValue: MarginPaddingValue;
    /** Every side's value before the drag, for the one undo step at the end. */
    startValues: Record<string, MarginPaddingParam | undefined>;
    linked: boolean;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);

  const isDefault = Object.keys(defaults).every((comp) => values[comp] === undefined);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      const drag = dragState.current;
      if (!drag) return;

      const dx = e.pageX - drag.startX;
      const dy = drag.startY - e.pageY;
      if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;

      const v = Math.round(drag.startValue.value + (dx + dy) * 0.33);
      const next = { value: v, unit: drag.startValue.unit };
      if (drag.linked) onUpdateAll(sideOf(drag.comp), next, { drag: true });
      else onUpdate(drag.comp, next, { drag: true });
    }

    function onMouseUp(e: MouseEvent) {
      const drag = dragState.current;
      if (!drag) return;

      if (drag.moved) {
        // ⚠️ The old values are the ones captured on mousedown, not whatever is
        // in the model now: the drag has been writing continuously *without*
        // undo, so by this point the model already holds the dragged value and
        // an undo built from it would restore the drag rather than reverse it.
        if (drag.linked) {
          onUpdateAll(sideOf(drag.comp), values[drag.comp], { oldValues: drag.startValues });
        } else {
          onUpdate(drag.comp, values[drag.comp], { oldValue: drag.startValue });
        }
        suppressClick.current = true;
        e.stopPropagation();
      }
      dragState.current = null;
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  });

  useEffect(() => {
    if (editComp) editInputRef.current?.focus();
  }, [editComp]);

  function openEditBox(comp: string, labelEl: HTMLElement) {
    const root = rootRef.current;
    if (!root) return;

    const labelRect = labelEl.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();

    let x = labelRect.left + labelRect.width / 2 - rootRect.left - EDITBOX_WIDTH / 2;
    const y = labelRect.top + labelRect.height / 2 - rootRect.top - EDITBOX_HEIGHT / 2;

    if (x + EDITBOX_WIDTH + 2 > rootRect.width) x = rootRect.width - EDITBOX_WIDTH - 2;
    if (x < 0) x = 2;

    const v = values[comp] !== undefined ? values[comp] : defaults[comp];
    // REL-014 — a token seeds the box **in full** (`var(--space-2)`, not the
    // `--space-2` the label shows), so committing it back unchanged stores the
    // same string. This used to be `String(values[comp].value)`, which for a
    // token is the literal text `undefined`.
    setEditText(editTextOf(values[comp]));
    setEditUnit(unitOf(v, 'px'));
    setEditPos({ x, y });
    setUnitDropdownOpen(false);
    setEditComp(comp);
  }

  /**
   * 🔴 REL-014. This was `parseFloat(text)` → `isNaN ? undefined`, and `undefined`
   * is the value that CLEARS a parameter — so a token, which `parseFloat` cannot
   * read, was deleted by any edit that touched the field, and could not be typed
   * back. The decision now lives in `commitMarginPaddingEdit`, which this file
   * cannot grade and that module can; `onRefuse` is the visible half of AC4 — the
   * typed text snapped back to what survived, synchronously, because nothing was
   * written and so nothing upstream will re-seed the box.
   */
  function commitEdit(text: string, unit: string) {
    if (!editComp) return;

    commitMarginPaddingEdit({
      comp: editComp,
      text,
      unit,
      values,
      linked,
      onUpdate: (comp, value) => onUpdate(comp, value),
      onUpdateAll: (side, value) => onUpdateAll(side, value),
      onRefuse: setEditText
    });
  }

  /**
   * What a label should show right now.
   *
   * While a linked field is being typed into, its siblings preview the text
   * being typed — "when linked, all four fields update as you type". This is
   * *display only*: nothing is written until the edit is committed, which is
   * what keeps the whole gesture one undo step rather than one per keystroke.
   */
  function displayedValue(comp: string): MarginPaddingParam | undefined {
    const own = values[comp] !== undefined ? values[comp] : defaults[comp];
    if (!editComp) return own;
    // ⚠️ Includes the field being edited. Excluding it left three siblings
    // reading 16 and the one under the cursor reading 0 — measured — which is
    // the opposite of the reassurance the preview exists to give. The edit box
    // usually covers that label, so the wrong value was there and invisible
    // until something read the DOM.
    if (!linked[sideOf(editComp)] || sideOf(comp) !== sideOf(editComp)) return own;
    // REL-014 — the preview is read through the same function the commit is, so
    // a token being typed previews as that token on its three siblings rather
    // than as their old numbers. Anything that would be refused previews as
    // `own`: the preview must never show a value the commit will not store.
    const edit = readMarginPaddingEdit(editText, editUnit);
    return edit.kind === 'number' || edit.kind === 'token' ? edit.value : own;
  }

  return (
    <div ref={rootRef} style={{ position: 'relative', height: 150 }}>
      {/* Outer dashed margin ring */}
      <div className="marginpadding-outer" style={{ position: 'absolute', inset: 2 }} />
      <span className="marginpadding-tag" style={{ position: 'absolute', top: 8, left: 10 }}>
        Margin
      </span>
      {/* ⚠️ Top-**right** of each region, not beside its tag. Beside the tag
          overlapped it ("MARGIN⛓", "PADDIN⛓") and, for padding, sat on the
          padding-top field as well: both tags are wider than they look because
          they are uppercase with letter-spacing, and the top field is centred.
          The right corner is empty in both regions — the left/right value
          fields are vertically centred and the top one is horizontally. */}
      <LinkToggle side="margin" linked={linked.margin} onToggle={onToggleLink} style={{ top: 5, right: 8 }} />

      {/* Inner padding box */}
      <div
        className="marginpadding-border"
        style={{ position: 'absolute', top: 39, left: 60, right: 60, bottom: 39 }}
      />
      <span className="marginpadding-tag" style={{ position: 'absolute', top: 45, left: 66 }}>
        Padding
      </span>
      {/* The inner box is inset 60px each side, so `right: 66` puts this just
          inside its top-right corner. */}
      <LinkToggle side="padding" linked={linked.padding} onToggle={onToggleLink} style={{ top: 42, right: 66 }} />

      {Object.keys(LABEL_POSITIONS)
        .filter((comp) => defaults[comp] !== undefined)
        .map((comp) => {
          const v = displayedValue(comp);
          // REL-014: a token shows its name (`--space-2`) rather than the `0` a
          // raw string used to produce here — see `labelTextOf` for why the name
          // and not the whole `var(...)`.
          const text = labelTextOf(v);
          const isToken = typeof v === 'string';
          // PAR-002 (mock): zero values read muted; the padding boxes sit on
          // bg-1 inside the solid inner block.
          const classes =
            'marginpadding-label drag-handle' +
            (values[comp] !== undefined ? ' changed' : '') +
            (isZeroValue(v) ? ' zero' : '') +
            (comp.startsWith('padding') ? ' inner-box' : '');
          return (
            <div
              key={comp}
              className={classes}
              // The full token, since the label is deliberately the short name.
              title={isToken ? (v as string) : undefined}
              // The eight labels are otherwise identical to anything outside
              // React — same class, position-only difference — so naming them
              // is what lets a live check say "the padding sides" rather than
              // "the third and fifth divs".
              data-comp={comp}
              style={{ position: 'absolute', ...LABEL_POSITIONS[comp] }}
              onMouseDown={(e) => {
                dragState.current = {
                  comp,
                  startX: e.pageX,
                  startY: e.pageY,
                  // ⚠️ REL-014 — a drag still replaces a token with a number, which
                  // is the one remaining gesture that removes one without saying so.
                  // What changed is that it no longer starts from `0` with no unit:
                  // see `scrubStartOf`.
                  startValue: scrubStartOf(values[comp], defaults[comp], UNITS[0]),
                  startValues: { ...values },
                  linked: linked[sideOf(comp)],
                  moved: false
                };
              }}
              onClick={(e) => {
                // A completed drag commits on mouseup; don't also open the edit box
                if (suppressClick.current) {
                  suppressClick.current = false;
                  return;
                }
                openEditBox(comp, e.currentTarget);
              }}
            >
              {text}
            </div>
          );
        })}

      {editComp && (
        <div
          style={{ position: 'absolute', inset: 0 }}
          onClick={() => {
            setEditComp(null);
          }}
        >
          <div className="marginpadding-dim" style={{ position: 'absolute', inset: 0 }} />

          <div
            className="marginpadding-editbox"
            style={{
              position: 'absolute',
              top: editPos.y,
              left: editPos.x,
              width: EDITBOX_WIDTH,
              height: EDITBOX_HEIGHT
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="property-value" style={{ left: 0, top: 1, bottom: 1, right: 36 }}>
              <input
                ref={editInputRef}
                type="text"
                className="sidebar-panel-dark-input"
                style={{ position: 'absolute', width: '100%', height: '100%' }}
                value={editText}
                placeholder={values[editComp] === undefined ? editTextOf(defaults[editComp]) : undefined}
                onChange={(e) => setEditText(e.target.value)}
                onBlur={() => commitEdit(editText, editUnit)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    commitEdit(editText, editUnit);
                    setEditComp(null);
                  }
                }}
              />
            </div>

            <div
              className="sidebar-panel-dark-input property-number-units"
              style={{ position: 'absolute', right: 1, width: 33, top: 1, bottom: 1, padding: 0 }}
              tabIndex={1}
              onClick={(e) => {
                setUnitDropdownOpen(!unitDropdownOpen);
                e.stopPropagation();
              }}
            >
              <span style={{ lineHeight: '35px' }}>{editUnit}</span>
              {unitDropdownOpen && (
                <div style={{ position: 'absolute', top: 35, left: 0, width: '100%' }} className="property-input-dropdown">
                  {UNITS.map((unit) => (
                    <div
                      key={unit}
                      className="property-number-unit-enum"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => {
                        setEditUnit(unit);
                        setUnitDropdownOpen(false);
                        commitEdit(editText, unit);
                        e.stopPropagation();
                      }}
                    >
                      {unit}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!isDefault && (
        <span className="property-changed-dot" title="Reset to default" onClick={() => onReset()}>
          <Icon icon={IconName.Reset} UNSAFE_style={{ width: 16, height: 16 }} />
        </span>
      )}
    </div>
  );
}
