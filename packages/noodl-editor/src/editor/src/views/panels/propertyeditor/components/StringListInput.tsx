import React, { useEffect, useRef, useState } from 'react';

import { BindingChip } from '@noodl-core-ui/components/property-panel/BindingChip/BindingChip';

import css from './ListInputRow.module.scss';

export interface StringListInputProps {
  items: string[];
  isDefault: boolean;

  /** Add a new entry. Returns an error message when the name was rejected. */
  onAdd: (name: string) => string | undefined;
  onRename: (oldName: string, newName: string) => string | undefined;
  onDelete: (name: string) => void;
  /** Open the shared JSON editor on this list. */
  onOpenCode: (anchor: HTMLElement) => void;

  isConnected?: boolean;
  connectionLabel?: string;
  onConnectionClick?: () => void;
}

/**
 * A single-line name field.
 *
 * ERG-003 §3: the add flow used to open `PopupLayer.StringInputPopup` — an
 * eight-row textarea with a line-number gutter placeholdered
 * `// Add your comment here...`, because that popup is shared with the canvas
 * comment editor. It was asking for one short identifier with a code editor.
 * Adding is now the same inline field renaming already used, so no list input
 * reaches that popup at all. The popup itself is untouched; its other four call
 * sites (component ports, comments, component templates) still want it.
 */
function NameField({
  initialValue,
  placeholder,
  onCommit,
  onCancel
}: {
  initialValue: string;
  placeholder?: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <input
      ref={inputRef}
      type="text"
      className="sidebar-panel-dark-input name-edit"
      placeholder={placeholder}
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

function StringListItem({
  name,
  isDefault,
  onRename,
  onDelete
}: {
  name: string;
  isDefault: boolean;
  onRename: (oldName: string, newName: string) => string | undefined;
  onDelete: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="sidebar-panel-item component-ports-item">
      {editing ? (
        <div className="name-edit-container">
          <NameField
            initialValue={name}
            onCommit={(next) => {
              setEditing(false);
              if (next !== name) onRename(name, next);
            }}
            onCancel={() => setEditing(false)}
          />
        </div>
      ) : (
        <>
          <span
            className={'component-ports-label' + (isDefault ? ' stringlist-default-label' : '')}
            onClick={(e) => {
              setEditing(true);
              e.stopPropagation();
            }}
          >
            {name}
          </span>

          <div className="sidebar-panel-edit-bar">
            <button
              type="button"
              className="sidebar-panel-edit-button"
              onClick={(e) => {
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
                  onDelete(name);
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
  );
}

/**
 * The string-list property row: the visual builder half of ERG-003's one editor.
 * `{ }` opens the same `JSONEditor` on the same list, so an author can switch
 * between building it and writing it.
 */
export function StringListInput({
  items,
  isDefault,
  onAdd,
  onRename,
  onDelete,
  onOpenCode,
  isConnected,
  connectionLabel,
  onConnectionClick
}: StringListInputProps) {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  // A connected port is driven by the wire; offering its stale local list to be
  // edited says the opposite of what the runtime is doing (criterion 5).
  if (isConnected) {
    return (
      <div style={{ position: 'relative' }}>
        <BindingChip source={connectionLabel} onClick={onConnectionClick} />
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <div className="items">
        {items.map((name, i) => (
          <StringListItem
            key={name + ':' + i}
            name={name}
            isDefault={isDefault}
            onRename={(oldName, newName) => {
              const message = onRename(oldName, newName);
              setError(message);
              return message;
            }}
            onDelete={onDelete}
          />
        ))}

        {adding && (
          <div className="sidebar-panel-item component-ports-item">
            <div className="name-edit-container">
              <NameField
                initialValue=""
                placeholder="Entry name"
                onCommit={(value) => {
                  if (value.trim() === '') {
                    setAdding(false);
                    setError(undefined);
                    return;
                  }
                  const message = onAdd(value);
                  setError(message);
                  // Keep the field open on rejection so the name can be corrected.
                  if (!message) setAdding(false);
                }}
                onCancel={() => {
                  setAdding(false);
                  setError(undefined);
                }}
              />
            </div>
          </div>
        )}
      </div>

      {error && <div className={css['InlineError']}>{error}</div>}

      <div className="sidebar-panel-edit-bar stringlist-add-button-container">
        <button
          type="button"
          className="sidebar-panel-edit-button"
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
          className="sidebar-panel-edit-button"
          title="Add entry"
          onClick={(e) => {
            setError(undefined);
            setAdding(true);
            e.stopPropagation();
          }}
        >
          <i className="fa fa-plus" />
        </button>
      </div>
    </div>
  );
}
