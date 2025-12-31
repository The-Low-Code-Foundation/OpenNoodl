/**
 * FolderTreeItem - Individual folder row in the folder tree
 *
 * Displays a folder with icon, name, project count badge, and context menu.
 * Supports nested folders with expand/collapse chevron.
 *
 * @module noodl-core-ui/preview/launcher
 */

import classNames from 'classnames';
import React, { useState } from 'react';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { ContextMenu, ContextMenuProps } from '@noodl-core-ui/components/popups/ContextMenu';
import { Label, LabelSize } from '@noodl-core-ui/components/typography/Label';
import { TextType } from '@noodl-core-ui/components/typography/Text';
import { Folder } from '@noodl-core-ui/preview/launcher/Launcher/hooks/useProjectOrganization';

import css from './FolderTreeItem.module.scss';

export interface FolderTreeItemProps {
  folder: Folder;
  /** Project count in this folder */
  projectCount: number;
  /** Whether this folder is currently selected for filtering */
  isSelected?: boolean;
  /** Whether this folder has nested children */
  hasChildren?: boolean;
  /** Whether children are expanded (only relevant if hasChildren is true) */
  isExpanded?: boolean;
  /** Indentation level for nested folders (0 = root) */
  level?: number;
  /** Called when folder is clicked for filtering */
  onClick?: () => void;
  /** Called when expand/collapse chevron is clicked */
  onToggleExpand?: () => void;
  /** Called when rename is requested */
  onRename?: () => void;
  /** Called when delete is requested */
  onDelete?: () => void;
}

/**
 * FolderTreeItem displays a single folder in the tree with:
 * - Folder icon (open/closed based on expansion)
 * - Folder name
 * - Project count badge
 * - Context menu for rename/delete
 * - Expand/collapse chevron for nested folders
 */
export function FolderTreeItem({
  folder,
  projectCount,
  isSelected = false,
  hasChildren = false,
  isExpanded = false,
  level = 0,
  onClick,
  onToggleExpand,
  onRename,
  onDelete
}: FolderTreeItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleExpand?.();
  };

  const contextMenuItems: ContextMenuProps['menuItems'] = [
    {
      label: 'Rename folder',
      icon: IconName.PencilLine,
      onClick: () => onRename?.()
    },
    'divider',
    {
      label: 'Delete folder',
      icon: IconName.Trash,
      onClick: () => onDelete?.(),
      isDangerous: true
    }
  ];

  const paddingLeft = 8 + level * 16; // Base padding + indent per level

  return (
    <div
      className={classNames(css['Root'], {
        [css['Root--selected']]: isSelected,
        [css['Root--hasChildren']]: hasChildren
      })}
      style={{ paddingLeft: `${paddingLeft}px` }}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Expand/Collapse Chevron */}
      {hasChildren && (
        <button
          className={css['Chevron']}
          onClick={handleChevronClick}
          aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
        >
          <Icon
            icon={isExpanded ? IconName.CaretDown : IconName.CaretRight}
            size={IconSize.Small}
            UNSAFE_className={css['ChevronIcon']}
          />
        </button>
      )}

      {/* Folder Icon */}
      <div className={css['FolderIcon']}>
        <Icon
          icon={isExpanded ? IconName.FolderOpen : IconName.FolderClosed}
          size={IconSize.Default}
          UNSAFE_className={css['Icon']}
        />
      </div>

      {/* Folder Name */}
      <Label
        size={LabelSize.Default}
        variant={isSelected ? TextType.Default : TextType.Shy}
        UNSAFE_className={css['FolderName']}
      >
        {folder.name}
      </Label>

      {/* Project Count Badge */}
      {projectCount > 0 && (
        <span className={css['Badge']}>
          <Label size={LabelSize.Small} variant={TextType.Shy}>
            {String(projectCount)}
          </Label>
        </span>
      )}

      {/* Context Menu */}
      {isHovered && (
        <div className={css['ContextMenuTrigger']} onClick={(e) => e.stopPropagation()}>
          <ContextMenu menuItems={contextMenuItems} />
        </div>
      )}
    </div>
  );
}
