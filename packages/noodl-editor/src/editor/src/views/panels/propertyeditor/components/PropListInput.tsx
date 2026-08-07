import React, { useEffect, useRef, useState } from 'react';

import PopupLayer from '../../../popuplayer';

import css from './ListInputRow.module.scss';

export interface PropListItem {
  id: string;
  label: string;
}

export interface PropListInputProps {
  items: PropListItem[];
  isDefault: boolean;

  /** Row views (raw elements or jQuery-wrapped) belonging to an item */
  childElsForItem: (id: string) => TSFixme[];

  /**
   * Add an entry by name. Returns an error message when rejected, which is
   * shown beside the field so the name can be corrected rather than lost.
   */
  onAdd: (name: string) => string | undefined;
  /**
   * Ports declaring `autoName` (Create Record / Update Record `accessControl`)
   * never ask for a name — the + button mints "Rule 1", "Rule 2", … When this is
   * set the inline name field is not shown at all.
   */
  onAutoAdd?: () => void;
  /** Open the shared JSON editor on this list. */
  onOpenCode: (anchor: HTMLElement) => void;
  onRename: (oldName: string, newName: string) => void;
  onDelete: (id: string) => void;
  onReorder: (source: PropListItem, target: PropListItem, below: boolean) => void;
}

function PropListRow({
  item,
  isDefault,
  childEls,
  onRename,
  onDelete,
  onReorder
}: {
  item: PropListItem;
  isDefault: boolean;
  childEls: TSFixme[];
  onRename: (oldName: string, newName: string) => void;
  onDelete: (id: string) => void;
  onReorder: (source: PropListItem, target: PropListItem, below: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.label);
  const inputRef = useRef<HTMLInputElement>(null);
  const propsRef = useRef<HTMLDivElement>(null);
  const aboveRef = useRef<HTMLDivElement>(null);
  const belowRef = useRef<HTMLDivElement>(null);
  const armedForDrag = useRef(false);

  useEffect(() => {
    // Host the item's property row views (built outside React)
    const container = propsRef.current;
    if (!container) return;
    childEls.forEach((el) => {
      el && container.appendChild(el);
    });
  }, [childEls]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commitRename() {
    setEditing(false);
    if (text !== item.label) {
      onRename(item.label, text);
    }
  }

  function hideIndicators() {
    if (aboveRef.current) aboveRef.current.style.display = 'none';
    if (belowRef.current) belowRef.current.style.display = 'none';
  }

  return (
    <div
      className="proplist-item drop-target"
      onMouseMove={(e) => {
        if (armedForDrag.current) {
          PopupLayer.instance.startDragging({ label: item.label, item });
          armedForDrag.current = false;
        }

        if (PopupLayer.instance.isDragging()) {
          const dragItem = PopupLayer.instance.dragItem;
          if (dragItem.item === item) {
            PopupLayer.instance.indicateDropType('none');
          } else {
            const rect = e.currentTarget.getBoundingClientRect();
            const below = e.clientY - rect.top > rect.height / 2;
            if (aboveRef.current) aboveRef.current.style.display = below ? 'none' : '';
            if (belowRef.current) belowRef.current.style.display = below ? '' : 'none';
            PopupLayer.instance.indicateDropType('move');
          }
        }
      }}
      onMouseOut={() => {
        hideIndicators();
        if (PopupLayer.instance.isDragging()) {
          PopupLayer.instance.indicateDropType('none');
        }
      }}
      onMouseUp={(e) => {
        armedForDrag.current = false;
        const dragItem = PopupLayer.instance.dragItem;
        if (dragItem && dragItem.item !== item) {
          const rect = e.currentTarget.getBoundingClientRect();
          onReorder(dragItem.item, item, e.clientY - rect.top > rect.height / 2);
          PopupLayer.instance.dragCompleted();
        }
        hideIndicators();
      }}
    >
      <div
        ref={aboveRef}
        className="drop-above-indicator"
        style={{
          display: 'none',
          position: 'absolute',
          top: -1,
          width: '100%',
          height: 2,
          backgroundColor: '#6c6c6c',
          pointerEvents: 'none'
        }}
      />
      <div
        ref={belowRef}
        className="drop-below-indicator"
        style={{
          display: 'none',
          position: 'absolute',
          bottom: -1,
          width: '100%',
          height: 2,
          backgroundColor: '#6c6c6c',
          pointerEvents: 'none'
        }}
      />

      <div className="header proplist-header">
        {editing ? (
          <div style={{ height: 35, position: 'relative' }}>
            <input
              ref={inputRef}
              type="text"
              className="sidebar-panel-dark-input name-edit"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onBlur={() => commitRename()}
              onKeyDown={(e) => e.key === 'Enter' && commitRename()}
            />
          </div>
        ) : (
          <>
            <span
              className={'drag-handle component-ports-label' + (isDefault ? ' stringlist-default-label' : '')}
              onMouseDown={() => {
                armedForDrag.current = true;
              }}
              onMouseUp={() => {
                armedForDrag.current = false;
              }}
              onClick={(e) => {
                setText(item.label);
                setEditing(true);
                e.stopPropagation();
              }}
            >
              {item.label}
            </span>

            <div className="sidebar-panel-edit-bar">
              <button
                type="button"
                className="sidebar-panel-edit-button"
                onClick={(e) => {
                  setText(item.label);
                  setEditing(true);
                  e.stopPropagation();
                }}
              >
                <i className="fa fa-pencil-square-o" />
              </button>

              {!isDefault && (
                <button
                  type="button"
                  className="sidebar-panel-edit-button"
                  onClick={(e) => {
                    onDelete(item.id);
                    e.stopPropagation();
                  }}
                >
                  <i className="fa fa-trash-o" />
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <div className="props" ref={propsRef} />
    </div>
  );
}

/**
 * A single-line name field for adding an entry.
 *
 * ERG-003 §3: adding used to open `PopupLayer.StringInputPopup`, the eight-row
 * textarea placeholdered `// Add your comment here...` that is shared with the
 * canvas comment editor. It asked for one short identifier with a code editor.
 * This is the same inline control renaming already used.
 */
function AddNameField({ onCommit, onCancel }: { onCommit: (value: string) => void; onCancel: () => void }) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <input
      ref={inputRef}
      type="text"
      className="sidebar-panel-dark-input name-edit"
      placeholder="Entry name"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onCommit(text)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onCommit(text);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
      }}
    />
  );
}

/**
 * The prop-list property row: reorderable named entries whose child property
 * rows are hosted inside each item. Reuses the legacy proplist CSS.
 *
 * ERG-003 keeps this as the visual builder rather than replacing it with the
 * JSON editor, because each entry hosts its own child property rows — a Function
 * node's per-input "Type" dropdown is a child port keyed by the entry's `id`
 * (`parentItemId`). A plain JSON list cannot show those, so `{ }` opens the
 * shared editor *alongside* this rather than instead of it.
 */
export function PropListInput({
  items,
  isDefault,
  childElsForItem,
  onAdd,
  onAutoAdd,
  onOpenCode,
  onRename,
  onDelete,
  onReorder
}: PropListInputProps) {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', right: 5, top: -30, display: 'flex', gap: 2 }}>
        <button
          type="button"
          className="components-panel-edit-button"
          title="Edit as JSON"
          onClick={(e) => {
            onOpenCode(e.currentTarget);
            e.stopPropagation();
          }}
        >
          <i className="fa fa-code" />
        </button>

        <button
          type="button"
          className="components-panel-edit-button"
          title="Add entry"
          onClick={(e) => {
            setError(undefined);
            if (onAutoAdd) onAutoAdd();
            else setAdding(true);
            e.stopPropagation();
          }}
        >
          <i className="fa fa-plus" />
        </button>
      </div>

      <div className="items">
        {items.map((item) => (
          <PropListRow
            key={item.id}
            item={item}
            isDefault={isDefault}
            childEls={childElsForItem(item.id)}
            onRename={onRename}
            onDelete={onDelete}
            onReorder={onReorder}
          />
        ))}

        {adding && (
          <div className="proplist-item">
            <div className="header proplist-header">
              <div style={{ height: 35, position: 'relative' }}>
                <AddNameField
                  onCommit={(value) => {
                    if (value.trim() === '') {
                      setAdding(false);
                      setError(undefined);
                      return;
                    }
                    const message = onAdd(value);
                    setError(message);
                    if (!message) setAdding(false);
                  }}
                  onCancel={() => {
                    setAdding(false);
                    setError(undefined);
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {error && <div className={css['InlineError']}>{error}</div>}
    </div>
  );
}
