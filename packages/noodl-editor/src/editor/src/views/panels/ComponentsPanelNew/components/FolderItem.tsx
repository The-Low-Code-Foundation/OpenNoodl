/**
 * FolderItem
 *
 * Renders a folder row with caret and folder icon.
 */

import classNames from 'classnames';
import React, { useCallback, useRef, useState } from 'react';

import { Icon, IconName } from '@noodl-core-ui/components/common/Icon';
import { MenuDialogWidth } from '@noodl-core-ui/components/popups/MenuDialog';

import { showContextMenuInPopup } from '../../../ShowContextMenuInPopup';
import css from '../ComponentsPanel.module.scss';
import { ComponentTemplates } from '../ComponentTemplates';
import { FolderItemData, Sheet, TreeNode } from '../types';
import { RenameInput } from './RenameInput';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PopupLayer = require('@noodl-views/popuplayer').default;

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
  onAddComponent?: (template: TSFixme, parentPath?: string) => void;
  onAddFolder?: (parentPath?: string) => void;
  isRenaming?: boolean;
  renameValue?: string;
  onRenameChange?: (value: string) => void;
  onRenameConfirm?: () => void;
  onRenameCancel?: () => void;
  // Sheet management
  sheets?: Sheet[];
  onMoveToSheet?: (componentPath: string, sheet: Sheet) => void;
  // Component-folder actions (same as ComponentItem)
  onOpen?: (node: TreeNode) => void;
  onMakeHome?: (node: TreeNode) => void;
  onDuplicate?: (node: TreeNode) => void;
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
  onAddComponent,
  onAddFolder,
  isRenaming,
  renameValue,
  onRenameChange,
  onRenameConfirm,
  onRenameCancel,
  sheets,
  onMoveToSheet,
  onOpen,
  onMakeHome,
  onDuplicate
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

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      dragStartPos.current = null;

      // If this folder is a valid drop target, execute the drop
      if (isDropTarget && onDrop) {
        e.stopPropagation(); // Prevent bubble to Tree (for root drop fallback)

        // End drag IMMEDIATELY at event handler level (before action chain)
        // This matches the working root drop pattern
        PopupLayer.instance.dragCompleted();

        const node: TreeNode = { type: 'folder', data: folder };
        onDrop(node);
        setIsDropTarget(false);
      }
    },
    [isDropTarget, folder, onDrop]
  );

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

      // Clear drag state to prevent phantom drags after menu closes
      dragStartPos.current = null;

      const node: TreeNode = { type: 'folder', data: folder };

      // Parent path for new items in this folder
      const parentPath = folder.path === '/' ? '/' : folder.path + '/';

      const items: TSFixme[] = [];

      // Add "Create" menu items if handlers are provided
      if (onAddComponent && onAddFolder) {
        // Get templates for browser runtime (default)
        const templates = ComponentTemplates.instance.getTemplates({
          forRuntimeType: 'browser'
        });

        // Add template creation items
        templates.forEach((template) => {
          items.push({
            icon: template.icon,
            label: `Create ${template.label}`,
            onClick: () => onAddComponent(template, parentPath)
          });
        });

        // Add folder creation
        items.push('divider');
        items.push({
          icon: IconName.FolderClosed,
          label: 'Create Folder',
          onClick: () => onAddFolder(parentPath)
        });

        items.push('divider');
      }

      // For component-folders, add component-specific actions (Open, Make Home, Duplicate)
      if (folder.isComponentFolder && folder.component) {
        items.push({
          label: 'Open',
          onClick: () => onOpen?.(node)
        });
        items.push('divider');

        // Only show "Make Home" for pages or visual components (not logic/cloud functions)
        if (folder.isPage || folder.isVisual) {
          items.push({
            label: 'Make Home',
            disabled: folder.isRoot,
            onClick: () => onMakeHome?.(node)
          });
          items.push('divider');
        }
      }

      // Add rename (available for all folders)
      items.push({
        label: 'Rename',
        onClick: () => onRename?.(node)
      });

      // Add duplicate for component-folders
      if (folder.isComponentFolder && folder.component) {
        items.push({
          label: 'Duplicate',
          onClick: () => onDuplicate?.(node)
        });
      }

      // Add "Move to" option for any folder that has a path and sheets are available
      // Works for both component-folders and regular folders
      if (folder.path && sheets && sheets.length > 0 && onMoveToSheet) {
        items.push('divider');

        // Use component.name for component-folders, folder.path for regular folders
        const folderPath = folder.isComponentFolder && folder.component ? folder.component.name : folder.path;

        // "Move to" opens a separate popup with sheet options
        items.push({
          label: 'Move to...',
          icon: IconName.FolderClosed,
          onClick: () => {
            // Determine which sheet this folder is currently in
            const currentSheetFolder = sheets.find(
              (s) => !s.isDefault && folderPath.startsWith('/' + s.folderName + '/')
            );
            const isInDefaultSheet = !currentSheetFolder;

            // Create sheet selection menu items
            const sheetItems: TSFixme[] = sheets.map((sheet) => {
              const isCurrentSheet = sheet.isDefault
                ? isInDefaultSheet
                : sheet.folderName === currentSheetFolder?.folderName;

              return {
                label: sheet.name + (isCurrentSheet ? ' (current)' : ''),
                icon: sheet.isDefault ? IconName.Component : IconName.FolderClosed,
                isDisabled: isCurrentSheet,
                isHighlighted: isCurrentSheet,
                onClick: () => {
                  if (!isCurrentSheet) {
                    onMoveToSheet(folderPath, sheet);
                  }
                }
              };
            });

            // Show the sheet selection popup
            showContextMenuInPopup({
              items: sheetItems,
              width: MenuDialogWidth.Default
            });
          }
        });
      }

      items.push('divider');
      items.push({
        label: 'Delete',
        onClick: () => onDelete?.(node)
      });

      showContextMenuInPopup({
        items,
        width: MenuDialogWidth.Default
      });
    },
    [folder, onRename, onDelete, onAddComponent, onAddFolder, sheets, onMoveToSheet, onOpen, onMakeHome, onDuplicate]
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
