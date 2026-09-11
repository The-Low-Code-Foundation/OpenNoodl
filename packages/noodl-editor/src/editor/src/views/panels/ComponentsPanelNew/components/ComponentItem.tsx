/**
 * ComponentItem
 *
 * Renders a single component row with appropriate icon.
 */

import classNames from 'classnames';
import React, { useCallback, useRef, useState } from 'react';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { MenuDialogWidth } from '@noodl-core-ui/components/popups/MenuDialog';

import { showContextMenuInPopup } from '../../../ShowContextMenuInPopup';
import { requestBenchMount } from '../../../VisualCanvas/benchRequest';
import { iconForKind, labelForKind } from '../componentKind';
import css from '../ComponentsPanel.module.scss';
import { buildCreateMenuItems, createMenuTitle } from '../createMenu';
import { CLOUD_SHEET, ComponentItemData, Sheet, TreeNode } from '../types';
import { RenameInput } from './RenameInput';
import { WarningDot } from './WarningDot';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PopupLayer = require('@noodl-views/popuplayer').default;

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
  /** PNL-006: kept only as ancestry for a filter match — rendered dimmed. */
  isDimmed?: boolean;
  /** WFA-001: which runtime the create menu authors for — see `ComponentTree`. */
  runtimeType?: 'browser' | 'cloud';
  /** SPR-005: the sheet in force, by display name — the create menu says where a new thing lands. */
  sheetName?: string;
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
  onMoveToSheet,
  isDimmed,
  runtimeType = 'browser',
  sheetName
}: ComponentItemProps) {
  const itemRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const [isDropTarget, setIsDropTarget] = useState(false);

  /* PNL-006: the glyph's *shape* is the derived kind, its *colour* is the
     component's canvas category — see `componentKind.ts` and the stylesheet
     header. The old if/else chain over four booleans is gone: two of those
     booleans could never be true, so every non-page, non-home component fell
     through to the same `UI` glyph. */
  const kind = component.kind ?? 'component';
  const icon = iconForKind(kind);

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
        // WFA-001: nesting *inside a component*, so `forParentType` is
        // 'component'. This is what keeps "Cloud Function Component" out of
        // this menu even on the cloud sheet: the template declares
        // `parentTypes: ['folder']`, and a function nested inside another
        // function would export as `/#__cloud__/outer/inner` — a name the
        // backend's `/functions/:name` route cannot address.
        //
        // SPR-005: that reasoning is now *said*, as a disabled row, instead of
        // being enforced silently — a user who never sees the option cannot
        // learn why it is not there.
        items.push(
          ...buildCreateMenuItems(
            { forParentType: 'component', runtimeType, sheetName, parentPath },
            { onAddComponent, onAddFolder }
          )
        );

        items.push('divider');
      }

      // Add existing menu items
      items.push({
        label: 'Open',
        onClick: () => onOpen?.(node)
      });

      /**
       * BEN-004 §6 — the entry the component bench will actually be used
       * through. It switches the *existing* preview surface to bench mode on
       * this component; it does not open a panel, because R1 is that there is
       * one preview surface with a mode and never two of them.
       *
       * Not offered for a cloud function: `/#__cloud__/…` executes in the cloud
       * runtime (WFA-001), and the bench is a browser viewer — mounting one
       * would fail and read as the component's fault.
       */
      if (!component.isCloudFunction) {
        items.push({
          /**
           * FIX-019 14(a) — "in isolation" described the *mechanism*; a user
           * looking for the surface is looking for the place they work on one
           * component, and the report's own word for that is the workbench.
           *
           * ⚠️ Scoped to this menu item on purpose. Whether "the workbench"
           * becomes the product word *everywhere* — the surface's own caption,
           * the docstrings — is a ruling still owed, and sweeping it here would
           * pre-empt it. The `data-test` ids are untouched either way: live
           * drive scripts reference them.
           */
          label: 'Show in workbench',
          icon: IconName.PlayCircle,
          onClick: () => requestBenchMount(component.name)
        });
      }

      items.push('divider');

      // Only show "Make Home" for pages or visual components (not logic/cloud functions)
      if (component.isPage || component.isVisual) {
        items.push({
          // SPR-005: `isDisabled` is the key `MenuDialog` reads; `disabled`
          // was inert, so "Make Home" has been offered on the home component.
          label: 'Make Home',
          isDisabled: component.isRoot,
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

      /**
       * "Move to…". WFA-001: the cloud sheet is not an organisational folder
       * but a runtime boundary, so it is neither a source nor a destination
       * here — moving a component across it would change what executes it, and
       * a menu that reads like tidying should not do that. Use it from the
       * cloud sheet's own create menu instead.
       */
      const movableSheets = (sheets || []).filter((s) => !s.isCloud);
      const isCloudComponent = component.path.startsWith(CLOUD_SHEET.pathPrefix);
      if (!isCloudComponent && movableSheets.length > 0 && onMoveToSheet) {
        items.push('divider');

        // "Move to" opens a separate popup with sheet options
        items.push({
          label: 'Move to...',
          icon: IconName.FolderClosed,
          onClick: () => {
            // Determine which sheet this component is currently in
            const currentSheetFolder = movableSheets.find(
              (s) => !s.isDefault && component.path.startsWith('/' + s.folderName + '/')
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
        // SPR-005: the destination, said before the click rather than after it.
        title: onAddComponent && onAddFolder ? createMenuTitle({ sheetName, parentPath }) : undefined,
        items,
        width: MenuDialogWidth.Default
      });
    },
    [
      component,
      onOpen,
      onMakeHome,
      onRename,
      onDuplicate,
      onDelete,
      onAddComponent,
      onAddFolder,
      sheets,
      onMoveToSheet,
      runtimeType,
      sheetName
    ]
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
        [css['DropTarget']]: isDropTarget,
        [css['IsHome']]: kind === 'home',
        [css['Dimmed']]: isDimmed
      })}
      /* The row's depth is the only per-row value the JS supplies. The padding
         and every indent guide are derived from it in CSS — see the stylesheet.
         `as React.CSSProperties` because a custom property is not in the type. */
      style={{ '--level': String(level) } as React.CSSProperties}
      data-test="component-tree-item"
      data-kind={kind}
      data-level={level}
      title={`${labelForKind(kind)} · ${component.localName}`}
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
      {/* Where a folder's caret would be, so glyphs at one depth share one x. */}
      <div className={css['CaretSlot']} />
      <div className={css['ItemContent']}>
        <div
          className={classNames(
            css['Icon'],
            css[`Cat-${component.category ?? 'default'}`],
            kind === 'home' && css['Kind-home']
          )}
        >
          <Icon icon={icon} size={IconSize.Small} />
        </div>
        <div className={css['Label']}>{component.localName}</div>
        <WarningDot count={component.warningCount} />
      </div>
    </div>
  );
}
