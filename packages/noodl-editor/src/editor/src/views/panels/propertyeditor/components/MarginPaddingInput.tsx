import React, { useEffect, useRef, useState } from 'react';

export interface MarginPaddingValue {
  value: number;
  unit: string;
}

export interface MarginPaddingInputProps {
  /** comp ('margin-top', 'padding-left', ...) → explicit value or undefined */
  values: Record<string, MarginPaddingValue | undefined>;
  defaults: Record<string, MarginPaddingValue>;

  onUpdate: (
    comp: string,
    value: MarginPaddingValue | undefined,
    opts?: { drag?: boolean; oldValue?: MarginPaddingValue }
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
 * The margin/padding box widget: eight value labels that support drag to
 * adjust and click to open an inline edit box. Reuses the legacy
 * marginpadding-* CSS.
 */
export function MarginPaddingInput({ values, defaults, onUpdate, onReset }: MarginPaddingInputProps) {
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
      onUpdate(drag.comp, { value: v, unit: drag.startValue.unit }, { drag: true });
    }

    function onMouseUp(e: MouseEvent) {
      const drag = dragState.current;
      if (!drag) return;

      if (drag.moved) {
        onUpdate(drag.comp, values[drag.comp], { oldValue: drag.startValue });
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

    const v = values[comp] || defaults[comp];
    setEditText(values[comp] !== undefined ? String(values[comp].value) : '');
    setEditUnit(v.unit);
    setEditPos({ x, y });
    setUnitDropdownOpen(false);
    setEditComp(comp);
  }

  function commitEdit(text: string, unit: string) {
    if (!editComp) return;
    const parsed = parseFloat(text);
    onUpdate(editComp, isNaN(parsed) ? undefined : { value: parsed, unit });
  }

  return (
    <div ref={rootRef} style={{ position: 'relative', height: 150 }}>
      {/* Outer dashed margin ring */}
      <div className="marginpadding-outer" style={{ position: 'absolute', inset: 2 }} />
      <span className="marginpadding-tag" style={{ position: 'absolute', top: 8, left: 10 }}>
        Margin
      </span>

      {/* Inner padding box */}
      <div
        className="marginpadding-border"
        style={{ position: 'absolute', top: 39, left: 60, right: 60, bottom: 39 }}
      />
      <span className="marginpadding-tag" style={{ position: 'absolute', top: 45, left: 66 }}>
        Padding
      </span>

      {Object.keys(LABEL_POSITIONS)
        .filter((comp) => defaults[comp] !== undefined)
        .map((comp) => {
          const v = values[comp] || defaults[comp];
          // No more "- px" wireframe placeholder: show the numeric value (zeros
          // read muted), and only surface a non-px unit inline.
          const num = v.value === undefined ? '0' : v.value;
          const text = v.unit && v.unit !== 'px' ? `${num}${v.unit}` : `${num}`;
          return (
            <div
              key={comp}
              className={'marginpadding-label drag-handle' + (values[comp] !== undefined ? ' changed' : '')}
              style={{ position: 'absolute', ...LABEL_POSITIONS[comp] }}
              onMouseDown={(e) => {
                const start = values[comp] || defaults[comp];
                dragState.current = {
                  comp,
                  startX: e.pageX,
                  startY: e.pageY,
                  startValue: { value: start.value || 0, unit: start.unit },
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
                placeholder={values[editComp] === undefined ? String(defaults[editComp]?.value ?? '') : undefined}
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
        <span className="property-changed-dot" title="Reset to default" onClick={() => onReset()} />
      )}
    </div>
  );
}
