/**
 * FolderItem
 *
 * Renders a folder row with caret and folder icon.
 */

import classNames from 'classnames';
import React, { useCallback, useRef, useState } from 'react';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { MenuDialogWidth } from '@noodl-core-ui/components/popups/MenuDialog';

import { showContextMenuInPopup } from '../../../ShowContextMenuInPopup';
import { iconForKind, labelForKind } from '../componentKind';
import css from '../ComponentsPanel.module.scss';
import { buildCreateMenuItems, createMenuTitle } from '../createMenu';
import { CLOUD_SHEET, FolderItemData, Sheet, TreeNode } from '../types';
import { RenameInput } from './RenameInput';
import { WarningDot } from './WarningDot';

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
  /** Switch to the Cloud Functions sheet, offered from the create menu's disabled row. */
  onGoToCloudSheet?: () => void;
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
  /** PNL-006: kept only as ancestry for a filter match — rendered dimmed. */
  isDimmed?: boolean;
  /** WFA-001: which runtime the create menu authors for — see `ComponentTree`. */
  runtimeType?: 'browser' | 'cloud';
  /** SPR-005: the sheet in force, by display name — the create menu says where a new thing lands. */
  sheetName?: string;
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
  onGoToCloudSheet,
  isRenaming,
  renameValue,
  onRenameChange,
  onRenameConfirm,
  onRenameCancel,
  sheets,
  onMoveToSheet,
  onOpen,
  onMakeHome,
  onDuplicate,
  isDimmed,
  runtimeType = 'browser',
  sheetName
}: FolderItemProps) {
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
        // WFA-001: a folder's create menu authors for the sheet's runtime, and
        // declares itself a folder context so `parentTypes` is honoured.
        // SPR-005: built by the shared builder, which is what puts the
        // filtered-out cloud template back as a disabled row with its reason.
        items.push(
          ...buildCreateMenuItems(
            { forParentType: 'folder', runtimeType, sheetName, parentPath },
            { onAddComponent, onAddFolder, onGoToCloudSheet }
          )
        );

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
            // SPR-005: `isDisabled` is the key `MenuDialog` reads; `disabled`
            // was inert, so "Make Home" has been offered on the home component.
            label: 'Make Home',
            isDisabled: folder.isRoot,
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
      // WFA-001: the cloud sheet is a runtime boundary, not a destination — see
      // the same guard in `ComponentItem`.
      const movableSheets = (sheets || []).filter((s) => !s.isCloud);
      const folderPath = folder.isComponentFolder && folder.component ? folder.component.name : folder.path;
      if (folder.path && !folderPath.startsWith(CLOUD_SHEET.pathPrefix) && movableSheets.length > 0 && onMoveToSheet) {
        items.push('divider');

        // "Move to" opens a separate popup with sheet options
        items.push({
          label: 'Move to...',
          icon: IconName.FolderClosed,
          onClick: () => {
            // Determine which sheet this folder is currently in
            const currentSheetFolder = movableSheets.find(
              (s) => !s.isDefault && folderPath.startsWith('/' + s.folderName + '/')
            );
            const isInDefaultSheet = !currentSheetFolder;

            // Create sheet selection menu items
            const sheetItems: TSFixme[] = movableSheets.map((sheet) => {
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
        // SPR-005: the destination, said before the click rather than after it.
        title: onAddComponent && onAddFolder ? createMenuTitle({ sheetName, parentPath }) : undefined,
        items,
        width: MenuDialogWidth.Default
      });
    },
    [
      folder,
      onRename,
      onDelete,
      onAddComponent,
      onAddFolder,
      onGoToCloudSheet,
      sheets,
      onMoveToSheet,
      onOpen,
      onMakeHome,
      onDuplicate,
      runtimeType,
      sheetName
    ]
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

  /* A component-folder is a component that happens to have children, so it wears
     its own kind's glyph, coloured by its own canvas category — the same as it
     would if it had no children. A plain folder is structure, not a component,
     so it keeps the neutral folder glyph and follows its open/closed state. */
  const kind = folder.isComponentFolder ? folder.kind ?? 'component' : undefined;
  const icon = kind ? iconForKind(kind) : isExpanded ? IconName.FolderOpen : IconName.FolderClosed;

  return (
    <>
      <div
        ref={itemRef}
        className={classNames(css['TreeItem'], css['IsFolder'], {
          [css['Selected']]: isSelected,
          [css['DropTarget']]: isDropTarget,
          [css['IsHome']]: kind === 'home',
          [css['Dimmed']]: isDimmed
        })}
        // See ComponentItem: depth in, padding and indent guides out, in CSS.
        style={{ '--level': String(level) } as React.CSSProperties}
        data-test="component-tree-item"
        data-kind={kind ?? 'folder'}
        data-level={level}
        title={kind ? `${labelForKind(kind)} · ${folder.name}` : folder.name}
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
          data-test="component-tree-caret"
          onClick={(e) => {
            e.stopPropagation();
            onCaretClick();
          }}
        >
          <Icon icon={IconName.CaretRight} size={IconSize.Tiny} />
        </div>
        <div className={css['ItemContent']} onClick={onClick}>
          <div
            className={classNames(
              css['Icon'],
              css[`Cat-${(folder.isComponentFolder && folder.category) || 'default'}`],
              kind === 'home' && css['Kind-home']
            )}
          >
            <Icon icon={icon} size={IconSize.Small} />
          </div>
          <div className={css['Label']}>{folder.name}</div>
          <WarningDot count={folder.warningCount} />
        </div>
      </div>
      {children}
    </>
  );
}
