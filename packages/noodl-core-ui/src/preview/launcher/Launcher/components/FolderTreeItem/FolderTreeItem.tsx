/**
 * FolderTreeItem - Individual folder row in the folder tree
 *
 * Mock side-item anatomy (PAR-001): 13px/500 fg-2 row, padding 7px 10px,
 * radius 7, 15px stroke-1.5 folder glyph, right-aligned 11.5px count;
 * hover bg-3/fg-1; current = accent-soft bg + accent text. Keeps the
 * expand/collapse chevron and the hover rename/delete menu (features the
 * mock does not show but the launcher must not lose).
 *
 * @module noodl-core-ui/preview/launcher
 */

import classNames from 'classnames';
import React, { useState } from 'react';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { ContextMenu, ContextMenuProps } from '@noodl-core-ui/components/popups/ContextMenu';
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

/** The mock's 15px stroke-1.5 folder glyph. */
const FolderGlyph = (
  <svg
    width="15"
    height="15"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M1.8 4.2c0-.8.6-1.4 1.4-1.4h2.6l1.5 1.7h5.5c.8 0 1.4.6 1.4 1.4v6c0 .8-.6 1.4-1.4 1.4H3.2c-.8 0-1.4-.6-1.4-1.4v-7.7Z" />
  </svg>
);

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

  // Rename/delete only exist for real (user-created) folders.
  const hasActions = Boolean(onRename || onDelete);

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

  const paddingLeft = 10 + level * 16; // Mock base padding + indent per level

  return (
    <div
      className={classNames(css['Root'], {
        [css['Root--selected']]: isSelected
      })}
      style={{ paddingLeft: `${paddingLeft}px` }}
      role="button"
      tabIndex={0}
      aria-current={isSelected || undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
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

      {/* Folder glyph */}
      <span className={css['FolderIcon']}>{FolderGlyph}</span>

      {/* Folder name */}
      <span className={css['FolderName']}>{folder.name}</span>

      {/* Right-aligned project count (mock: 11.5px/400) */}
      <span className={classNames(css['Count'], isHovered && hasActions && css['is-hidden'])}>
        {String(projectCount)}
      </span>

      {/* Rename/delete menu, shown on hover in place of the count */}
      {isHovered && hasActions && (
        <div className={css['ContextMenuTrigger']} onClick={(e) => e.stopPropagation()}>
          <ContextMenu menuItems={contextMenuItems} />
        </div>
      )}
    </div>
  );
}
