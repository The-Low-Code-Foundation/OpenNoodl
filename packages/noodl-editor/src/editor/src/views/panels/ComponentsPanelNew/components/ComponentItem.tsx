/**
 * ComponentItem
 *
 * Renders a single component row with appropriate icon.
 */

import classNames from 'classnames';
import React, { useCallback, useRef, useState } from 'react';

import { Icon, IconName } from '@noodl-core-ui/components/common/Icon';
import { MenuDialogWidth } from '@noodl-core-ui/components/popups/MenuDialog';

import { showContextMenuInPopup } from '../../../ShowContextMenuInPopup';
import css from '../ComponentsPanel.module.scss';
import { ComponentTemplates } from '../ComponentTemplates';
import { ComponentItemData, Sheet, TreeNode } from '../types';
import { RenameInput } from './RenameInput';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PopupLayer = require('@noodl-views/popuplayer');

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
  onMoveToSheet
}: ComponentItemProps) {
  const indent = level * 12;
  const itemRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const [isDropTarget, setIsDropTarget] = useState(false);

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

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      dragStartPos.current = null;

      // If this item is a valid drop target, execute the drop
      if (isDropTarget && onDrop) {
        e.stopPropagation(); // Prevent bubble to Tree (for root drop fallback)

        // End drag IMMEDIATELY at event handler level (before action chain)
        // This matches the working root drop pattern
        PopupLayer.instance.dragCompleted();

        const node: TreeNode = { type: 'component', data: component };
        onDrop(node);
        setIsDropTarget(false);
      }
    },
    [isDropTarget, component, onDrop]
  );

  // Drop handlers
  const handleMouseEnter = useCallback(() => {
    if (PopupLayer.instance.isDragging() && canAcceptDrop) {
      const node: TreeNode = { type: 'component', data: component };
      if (canAcceptDrop(node)) {
        setIsDropTarget(true);
        PopupLayer.instance.indicateDropType('move');
      }
    }
  }, [component, canAcceptDrop]);

  const handleMouseLeave = useCallback(() => {
    setIsDropTarget(false);
    if (PopupLayer.instance.isDragging()) {
      PopupLayer.instance.indicateDropType('none');
    }
  }, []);

  const handleDrop = useCallback(() => {
    if (isDropTarget && onDrop) {
      const node: TreeNode = { type: 'component', data: component };
      onDrop(node);
      setIsDropTarget(false);
    }
  }, [isDropTarget, component, onDrop]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Clear drag state to prevent phantom drags after menu closes
      dragStartPos.current = null;

      const node: TreeNode = { type: 'component', data: component };

      // Calculate parent path for new components (nested inside this component)
      // Use the component's full path + "/" to nest inside it
      const parentPath = component.path + '/';

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

      // Add existing menu items
      items.push({
        label: 'Open',
        onClick: () => onOpen?.(node)
      });
      items.push('divider');

      // Only show "Make Home" for pages or visual components (not logic/cloud functions)
      if (component.isPage || component.isVisual) {
        items.push({
          label: 'Make Home',
          disabled: component.isRoot,
          onClick: () => onMakeHome?.(node)
        });
        items.push('divider');
      }
      items.push({
        label: 'Rename',
        onClick: () => onRename?.(node)
      });
      items.push({
        label: 'Duplicate',
        onClick: () => onDuplicate?.(node)
      });

      // Add "Move to" option if sheets are available
      if (sheets && sheets.length > 0 && onMoveToSheet) {
        items.push('divider');

        // "Move to" opens a separate popup with sheet options
        items.push({
          label: 'Move to...',
          icon: IconName.FolderClosed,
          onClick: () => {
            // Determine which sheet this component is currently in
            const currentSheetFolder = sheets.find(
              (s) => !s.isDefault && component.path.startsWith('/' + s.folderName + '/')
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
                    onMoveToSheet(component.name, sheet);
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
    [component, onOpen, onMakeHome, onRename, onDuplicate, onDelete, onAddComponent, onAddFolder, sheets, onMoveToSheet]
  );

  const handleDoubleClick = useCallback(() => {
    if (onDoubleClick) {
      const node: TreeNode = { type: 'component', data: component };
      onDoubleClick(node);
    }
  }, [component, onDoubleClick]);

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
    <div
      ref={itemRef}
      className={classNames(css['TreeItem'], {
        [css['Selected']]: isSelected,
        [css['DropTarget']]: isDropTarget
      })}
      style={{ paddingLeft: `${indent + 23}px` }}
      onClick={onClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onDrop={handleDrop}
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
