import React, { useEffect, useRef, useState } from 'react';

export interface StringListInputProps {
  items: string[];
  isDefault: boolean;

  /** Open the add-entry popup anchored to the + button */
  onAddClick: (anchor: HTMLElement) => void;
  onRename: (oldName: string, newName: string) => void;
  onDelete: (name: string) => void;
}

function StringListItem({
  name,
  isDefault,
  onRename,
  onDelete
}: {
  name: string;
  isDefault: boolean;
  onRename: (oldName: string, newName: string) => void;
  onDelete: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commitRename() {
    setEditing(false);
    if (text !== name) {
      onRename(name, text);
    }
  }

  return (
    <div className="sidebar-panel-item component-ports-item">
      {editing ? (
        <div className="name-edit-container">
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
            className={'component-ports-label' + (isDefault ? ' stringlist-default-label' : '')}
            onClick={(e) => {
              setText(name);
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
                setText(name);
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
 * The string-list property row: a list of entries with inline rename, delete
 * and an add button. Reuses the legacy sidebar-panel/component-ports CSS.
 */
export function StringListInput({ items, isDefault, onAddClick, onRename, onDelete }: StringListInputProps) {
  return (
    <div style={{ position: 'relative' }}>
      <div className="items">
        {items.map((name, i) => (
          <StringListItem
            key={name + ':' + i}
            name={name}
            isDefault={isDefault}
            onRename={onRename}
            onDelete={onDelete}
          />
        ))}
      </div>

      <div className="sidebar-panel-edit-bar stringlist-add-button-container">
        <button
          type="button"
          className="sidebar-panel-edit-button"
          onClick={(e) => {
            onAddClick(e.currentTarget);
            e.stopPropagation();
          }}
        >
          <i className="fa fa-plus" />
        </button>
      </div>
    </div>
  );
}
