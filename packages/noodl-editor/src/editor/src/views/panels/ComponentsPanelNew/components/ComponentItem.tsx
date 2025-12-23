/**
 * ComponentItem
 *
 * Renders a single component row with appropriate icon.
 */

import classNames from 'classnames';
import React, { useCallback, useRef } from 'react';

import { Icon, IconName } from '@noodl-core-ui/components/common/Icon';

import PopupLayer from '../../../popuplayer';
import css from '../ComponentsPanel.module.scss';
import { ComponentItemData, TreeNode } from '../types';
import { RenameInput } from './RenameInput';

interface ComponentItemProps {
  component: ComponentItemData;
  level: number;
  isSelected: boolean;
  onClick: () => void;
  onMakeHome?: (node: TreeNode) => void;
  onDelete?: (node: TreeNode) => void;
  onDuplicate?: (node: TreeNode) => void;
  onRename?: (node: TreeNode) => void;
  onOpen?: (node: TreeNode) => void;
  onDragStart?: (node: TreeNode, element: HTMLElement) => void;
  onDoubleClick?: (node: TreeNode) => void;
  isRenaming?: boolean;
  renameValue?: string;
  onRenameChange?: (value: string) => void;
  onRenameConfirm?: () => void;
  onRenameCancel?: () => void;
}

export function ComponentItem({
  component,
  level,
  isSelected,
  onClick,
  onMakeHome,
  onDelete,
  onDuplicate,
  onRename,
  onOpen,
  onDragStart,
  onDoubleClick,
  isRenaming,
  renameValue,
  onRenameChange,
  onRenameConfirm,
  onRenameCancel
}: ComponentItemProps) {
  const indent = level * 12;
  const itemRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);

  // Determine icon based on component type
  let icon = IconName.Component;
  if (component.isRoot) {
    icon = IconName.Home;
  } else if (component.isPage) {
    icon = IconName.PageRouter;
  } else if (component.isCloudFunction) {
    icon = IconName.CloudFunction;
  } else if (component.isVisual) {
    icon = IconName.UI;
  }

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
        const node: TreeNode = { type: 'component', data: component };
        onDragStart(node, itemRef.current);
        dragStartPos.current = null;
      }
    },
    [component, onDragStart]
  );

  const handleMouseUp = useCallback(() => {
    dragStartPos.current = null;
  }, []);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const node: TreeNode = { type: 'component', data: component };

      const items = [
        {
          label: 'Open',
          onClick: () => onOpen?.(node)
        },
        { type: 'divider' as const },
        {
          label: 'Make Home',
          disabled: component.isRoot,
          onClick: () => onMakeHome?.(node)
        },
        { type: 'divider' as const },
        {
          label: 'Rename',
          onClick: () => onRename?.(node)
        },
        {
          label: 'Duplicate',
          onClick: () => onDuplicate?.(node)
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
    [component, onOpen, onMakeHome, onRename, onDuplicate, onDelete]
  );

  const handleDoubleClick = useCallback(() => {
    if (onDoubleClick) {
      const node: TreeNode = { type: 'component', data: component };
      onDoubleClick(node);
    }
  }, [component, onDoubleClick]);

  // Show rename input if in rename mode
  if (isRenaming && renameValue !== undefined && onRenameChange && onRenameConfirm && onRenameCancel) {
    console.log('🔍 ComponentItem rendering RenameInput', {
      component: component.localName,
      renameValue,
      hasOnRenameConfirm: !!onRenameConfirm,
      hasOnRenameCancel: !!onRenameCancel,
      onRenameConfirm: onRenameConfirm
    });
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
    <div
      ref={itemRef}
      className={classNames(css['TreeItem'], {
        [css['Selected']]: isSelected
      })}
      style={{ paddingLeft: `${indent + 23}px` }}
      onClick={onClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <div className={css['ItemContent']}>
        <div className={css['Icon']}>
          <Icon icon={icon} />
        </div>
        <div className={css['Label']}>{component.localName}</div>
        {component.hasWarnings && <div className={css['Warning']}>!</div>}
      </div>
    </div>
  );
}
