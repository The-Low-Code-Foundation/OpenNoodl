import React, { useRef, useState } from 'react';

import { PanelHeader } from '@noodl-core-ui/components/sidebar/PanelHeader';

import PopupLayer from '../../popuplayer';

export interface ComponentPortItem {
  type: 'port' | 'group';
  label: string;
  port?: TSFixme;
}

export interface ComponentPortsViewProps {
  title: string;
  items: ComponentPortItem[];
  canArrangeInGroups: boolean;

  onRenamePort: (item: ComponentPortItem, newName: string) => void;
  onDeletePort: (item: ComponentPortItem) => void;
  onRenameGroup: (item: ComponentPortItem, newName: string) => void;
  onDeleteGroup: (item: ComponentPortItem) => void;
  onAddPort: (anchor: HTMLElement) => void;
  onAddGroup: (anchor: HTMLElement) => void;
  /** Drop `source` on `target` and rearrange */
  onDrop: (target: ComponentPortItem, source: ComponentPortItem) => void;
}

/** The drop indicator sits above or below the row depending on drag direction */
type DropSide = 'top' | 'bottom' | null;

/**
 * Shared behaviour of a port row and a group row: the label doubles as the drag
 * handle and the drop target, and starts an inline rename when clicked.
 */
function useRowInteraction(item: ComponentPortItem, items: ComponentPortItem[]) {
  const [dropSide, setDropSide] = useState<DropSide>(null);
  const mouseDownOnItem = useRef(false);

  return {
    dropSide,
    handlers: {
      onMouseDown: () => {
        mouseDownOnItem.current = true;
      },
      onMouseMove: () => {
        if (!mouseDownOnItem.current) return;
        mouseDownOnItem.current = false;
        PopupLayer.instance.startDragging({ label: item.label, item });
      },
      onMouseOver: () => {
        if (!PopupLayer.instance.isDragging()) return;

        const dragItem = PopupLayer.instance.dragItem;
        const sourceIdx = items.indexOf(dragItem.item);
        const targetIdx = items.indexOf(item);

        setDropSide(targetIdx < sourceIdx ? 'top' : 'bottom');
        PopupLayer.instance.indicateDropType('move');
      },
      onMouseOut: () => {
        setDropSide(null);
        PopupLayer.instance.indicateDropType('none');
      },
      onMouseUp: (onDropped: (source: ComponentPortItem) => void) => {
        mouseDownOnItem.current = false;
        setDropSide(null);

        const dragItem = PopupLayer.instance.dragItem;
        if (!dragItem) return;

        onDropped(dragItem.item);
        PopupLayer.instance.dragCompleted();
      }
    }
  };
}

function DropIndicator({ side, top }: { side: DropSide; top?: number }) {
  if (!side) return null;

  return (
    <div
      className="drop-indicator"
      style={{
        position: 'absolute',
        width: '100%',
        height: 3,
        backgroundColor: '#6c6c6c',
        pointerEvents: 'none',
        top: side === 'top' ? top ?? 0 : undefined,
        bottom: side === 'bottom' ? 0 : undefined
      }}
    />
  );
}

function NameEditInput({ value, onCommit }: { value: string; onCommit: (newName: string) => void }) {
  const committed = useRef(false);

  function commit(newValue: string) {
    // The legacy view unbound blur/keypress after renaming so it could not run twice
    if (committed.current) return;
    committed.current = true;
    onCommit(newValue);
  }

  return (
    <div className="name-edit-container">
      <input
        type="text"
        className="sidebar-panel-dark-input name-edit"
        autoFocus
        defaultValue={value}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit(e.currentTarget.value);
        }}
      />
    </div>
  );
}

function PortRow({
  item,
  items,
  onRename,
  onDelete,
  onDrop
}: {
  item: ComponentPortItem;
  items: ComponentPortItem[];
  onRename: (item: ComponentPortItem, newName: string) => void;
  onDelete: (item: ComponentPortItem) => void;
  onDrop: (target: ComponentPortItem, source: ComponentPortItem) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const { dropSide, handlers } = useRowInteraction(item, items);

  function rename(newName: string) {
    setIsEditing(false);
    if (newName !== item.label) onRename(item, newName);
  }

  return (
    <div className="component-ports-item sidebar-panel-item">
      {isEditing ? (
        <NameEditInput value={item.label} onCommit={rename} />
      ) : (
        <>
          <span
            className="drop-target drag-handle component-ports-label"
            onClick={(e) => {
              setIsEditing(true);
              e.stopPropagation();
            }}
            onMouseDown={handlers.onMouseDown}
            onMouseMove={handlers.onMouseMove}
            onMouseOver={handlers.onMouseOver}
            onMouseOut={handlers.onMouseOut}
            onMouseUp={() => handlers.onMouseUp((source) => onDrop(item, source))}
          >
            {item.label}
          </span>

          <div className="sidebar-panel-edit-bar">
            <button
              type="button"
              className="sidebar-panel-edit-button"
              onClick={(e) => {
                setIsEditing(true);
                e.stopPropagation();
              }}
            >
              <i className="fa fa-pencil-square-o" />
            </button>

            <button
              type="button"
              className="sidebar-panel-edit-button"
              onClick={(e) => {
                onDelete(item);
                e.stopPropagation();
              }}
            >
              <i className="fa fa-trash-o" />
            </button>
          </div>
        </>
      )}

      <DropIndicator side={dropSide} />
    </div>
  );
}

function GroupRow({
  item,
  items,
  onRename,
  onDelete,
  onDrop
}: {
  item: ComponentPortItem;
  items: ComponentPortItem[];
  onRename: (item: ComponentPortItem, newName: string) => void;
  onDelete: (item: ComponentPortItem) => void;
  onDrop: (target: ComponentPortItem, source: ComponentPortItem) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const { dropSide, handlers } = useRowInteraction(item, items);

  function rename(newName: string) {
    setIsEditing(false);
    if (newName !== item.label) onRename(item, newName);
  }

  return (
    <div className="component-ports-group-item sidebar-panel-item">
      <div style={{ position: 'relative', top: 15, height: 35 }}>
        {isEditing ? (
          <NameEditInput value={item.label} onCommit={rename} />
        ) : (
          <>
            <span
              className="drop-target drag-handle component-ports-group-label"
              onMouseDown={handlers.onMouseDown}
              onMouseMove={handlers.onMouseMove}
              onMouseOver={handlers.onMouseOver}
              onMouseOut={handlers.onMouseOut}
              onMouseUp={() => handlers.onMouseUp((source) => onDrop(item, source))}
            >
              {item.label}
            </span>

            <div className="sidebar-panel-edit-bar">
              <button
                type="button"
                className="component-ports-group-button sidebar-panel-edit-button"
                onClick={(e) => {
                  setIsEditing(true);
                  e.stopPropagation();
                }}
              >
                <i className="fa fa-pencil-square-o" />
              </button>

              <button
                type="button"
                className="component-ports-group-button sidebar-panel-edit-button"
                onClick={(e) => {
                  onDelete(item);
                  e.stopPropagation();
                }}
              >
                <i className="fa fa-trash-o" />
              </button>
            </div>
          </>
        )}
      </div>

      <DropIndicator side={dropSide} />
    </div>
  );
}

/** The component ports ("Inputs"/"Outputs") sidebar panel. */
export function ComponentPortsView({
  title,
  items,
  canArrangeInGroups,
  onRenamePort,
  onDeletePort,
  onRenameGroup,
  onDeleteGroup,
  onAddPort,
  onAddGroup,
  onDrop
}: ComponentPortsViewProps) {
  return (
    <>
      {/* PNL-005: the shared `PanelHeader`, not the legacy 33px
          `.sidebar-panel-header` with its 12px capitalised label — this panel
          ("Ports", registered as `PortEditor`) was missing from the spec's list
          of fourteen but wore a fifteenth kind of header.

          `PanelHeader` directly rather than `BasePanel`: the panel is mounted
          through a `Frame` into its own React root (`createRoot` in
          componentports.tsx), so `BasePanel`'s flex chain and its mode-slot
          context — which does not cross a root boundary — would buy nothing
          here. Same bar; no mode controls, as today. */}
      <PanelHeader title={title} />

      <div style={{ overflowY: 'auto' }}>
        <div className="ports">
          {items.map((item, index) =>
            item.type === 'group' ? (
              <GroupRow
                key={'group:' + index + ':' + item.label}
                item={item}
                items={items}
                onRename={onRenameGroup}
                onDelete={onDeleteGroup}
                onDrop={onDrop}
              />
            ) : (
              <PortRow
                key={'port:' + index + ':' + item.label}
                item={item}
                items={items}
                onRename={onRenamePort}
                onDelete={onDeletePort}
                onDrop={onDrop}
              />
            )
          )}
        </div>
      </div>

      <div className="sidebar-panel-footer-placeholder" />

      <div className="sidebar-panel-footer">
        <button
          type="button"
          className="sidebar-panel-footer-button"
          onClick={(e) => {
            onAddPort(e.currentTarget);
            e.stopPropagation();
          }}
        >
          <i className="fa fa-plus" />
          <span>Port</span>
        </button>

        {canArrangeInGroups && (
          <button
            type="button"
            className="add-group-button sidebar-panel-footer-button"
            onClick={(e) => {
              onAddGroup(e.currentTarget);
              e.stopPropagation();
            }}
          >
            <i className="fa fa-plus" />
            <span>Group</span>
          </button>
        )}
      </div>
    </>
  );
}
