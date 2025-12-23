/**
 * FolderItem
 *
 * Renders a folder row with expand/collapse caret and nesting.
 */

import classNames from 'classnames';
import React, { useCallback, useRef, useState } from 'react';

import { Icon, IconName } from '@noodl-core-ui/components/common/Icon';

import PopupLayer from '../../../popuplayer';
import css from '../ComponentsPanel.module.scss';
import { FolderItemData, TreeNode } from '../types';
import { RenameInput } from './RenameInput';

interface FolderItemProps {
  folder: FolderItemData;
  level: number;
  isExpanded: boolean;
  isSelected: boolean;
  onCaretClick: () => void;
  onClick: () => void;
  children?: React.ReactNode;
  onDelete?: (node: TreeNode) => void;
  onRename?: (node: TreeNode) => void;
  onDragStart?: (node: TreeNode, element: HTMLElement) => void;
  onDrop?: (node: TreeNode) => void;
  canAcceptDrop?: (node: TreeNode) => boolean;
  onDoubleClick?: (node: TreeNode) => void;
  isRenaming?: boolean;
  renameValue?: string;
  onRenameChange?: (value: string) => void;
  onRenameConfirm?: () => void;
  onRenameCancel?: () => void;
}

export function FolderItem({
  folder,
  level,
  isExpanded,
  isSelected,
  onCaretClick,
  onClick,
  children,
  onDelete,
  onRename,
  onDragStart,
  onDrop,
  canAcceptDrop,
  onDoubleClick,
  isRenaming,
  renameValue,
  onRenameChange,
  onRenameConfirm,
  onRenameCancel
}: FolderItemProps) {
  const indent = level * 12;
  const itemRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const [isDropTarget, setIsDropTarget] = useState(false);

  // Drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragStartPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragStartPos.current || !onDragStart) return;

      // Check if mouse moved enough to start drag (5px threshold)
      const dx = e.clientX - dragStartPos.current.x;
      const dy = e.clientY - dragStartPos.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 5 && itemRef.current) {
        const node: TreeNode = { type: 'folder', data: folder };
        onDragStart(node, itemRef.current);
        dragStartPos.current = null;
      }
    },
    [folder, onDragStart]
  );

  const handleMouseUp = useCallback(() => {
    dragStartPos.current = null;
  }, []);

  // Drop handlers
  const handleMouseEnter = useCallback(() => {
    if (PopupLayer.instance.isDragging() && canAcceptDrop) {
      const node: TreeNode = { type: 'folder', data: folder };
      if (canAcceptDrop(node)) {
        setIsDropTarget(true);
        PopupLayer.instance.indicateDropType('move');
      }
    }
  }, [folder, canAcceptDrop]);

  const handleMouseLeave = useCallback(() => {
    setIsDropTarget(false);
    if (PopupLayer.instance.isDragging()) {
      PopupLayer.instance.indicateDropType('none');
    }
  }, []);

  const handleDrop = useCallback(() => {
    if (isDropTarget && onDrop) {
      const node: TreeNode = { type: 'folder', data: folder };
      onDrop(node);
      setIsDropTarget(false);
    }
  }, [isDropTarget, folder, onDrop]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const node: TreeNode = { type: 'folder', data: folder };

      const items = [
        {
          label: 'Rename',
          onClick: () => onRename?.(node)
        },
        { type: 'divider' as const },
        {
          label: 'Delete',
          onClick: () => onDelete?.(node)
        }
      ];

      const menu = new PopupLayer.PopupMenu({ items });

      PopupLayer.instance.showPopup({
        content: menu,
        attachTo: e.currentTarget as HTMLElement,
        position: { x: e.clientX, y: e.clientY }
      });
    },
    [folder, onRename, onDelete]
  );

  const handleDoubleClick = useCallback(() => {
    if (onDoubleClick) {
      const node: TreeNode = { type: 'folder', data: folder };
      onDoubleClick(node);
    }
  }, [folder, onDoubleClick]);

  // Show rename input if in rename mode
  if (isRenaming && renameValue !== undefined && onRenameChange && onRenameConfirm && onRenameCancel) {
    return (
      <RenameInput
        value={renameValue}
        onChange={onRenameChange}
        onConfirm={onRenameConfirm}
        onCancel={onRenameCancel}
        level={level}
      />
    );
  }

  return (
    <>
      <div
        ref={itemRef}
        className={classNames(css['TreeItem'], {
          [css['Selected']]: isSelected,
          [css['DropTarget']]: isDropTarget
        })}
        style={{ paddingLeft: `${indent + 10}px` }}
        onContextMenu={handleContextMenu}
        onDoubleClick={handleDoubleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onDrop={handleDrop}
      >
        <div
          className={classNames(css['Caret'], {
            [css['Expanded']]: isExpanded
          })}
          onClick={(e) => {
            e.stopPropagation();
            onCaretClick();
          }}
        >
          ▶
        </div>
        <div className={css['ItemContent']} onClick={onClick}>
          <div className={css['Icon']}>
            <Icon icon={folder.isComponentFolder ? IconName.ComponentWithChildren : IconName.FolderClosed} />
          </div>
          <div className={css['Label']}>{folder.name}</div>
        </div>
      </div>
      {children}
    </>
  );
}
