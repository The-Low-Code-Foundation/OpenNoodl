/**
 * ComponentsPanel
 *
 * Modern React component for displaying and managing project components.
 * Migrated from legacy jQuery/underscore.js View implementation.
 *
 * @module noodl-editor
 */

import React, { useCallback } from 'react';

import { DialogLayerModel } from '@noodl-models/DialogLayerModel';

import { IconName } from '@noodl-core-ui/components/common/Icon';
import { MenuDialogWidth } from '@noodl-core-ui/components/popups/MenuDialog';

import { showContextMenuInPopup } from '../../ShowContextMenuInPopup';
import { ComponentTree } from './components/ComponentTree';
import { SheetSelector } from './components/SheetSelector';
import css from './ComponentsPanel.module.scss';
import { ComponentTemplates } from './ComponentTemplates';
import { useComponentActions } from './hooks/useComponentActions';
import { useComponentsPanel } from './hooks/useComponentsPanel';
import { useDragDrop } from './hooks/useDragDrop';
import { useRenameMode } from './hooks/useRenameMode';
import { useSheetManagement } from './hooks/useSheetManagement';
import { ComponentsPanelProps } from './types';

/**
 * ComponentsPanel displays the project's component tree with folders,
 * allowing users to navigate, create, rename, and organize components.
 */
export function ComponentsPanel({ options }: ComponentsPanelProps) {
  const { treeData, expandedFolders, selectedId, toggleFolder, handleItemClick, sheets, currentSheet, selectSheet } =
    useComponentsPanel({
      hideSheets: options?.hideSheets,
      lockToSheet: options?.lockToSheet
    });

  const {
    handleMakeHome,
    handleDelete,
    handleDuplicate,
    performRename,
    handleOpen,
    handleDropOn,
    handleDropOnRoot,
    handleAddComponent,
    handleAddFolder
  } = useComponentActions();

  const { createSheet, renameSheet, deleteSheet, moveToSheet } = useSheetManagement();

  const { draggedItem, startDrag, canDrop } = useDragDrop();

  const { renamingItem, renameValue, startRename, setRenameValue, cancelRename, validateName } = useRenameMode();

  // Handle creating a new sheet
  const handleCreateSheet = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const PopupLayer = require('@noodl-views/popuplayer');

    const popup = new PopupLayer.StringInputPopup({
      label: 'New sheet name',
      okLabel: 'Create',
      cancelLabel: 'Cancel',
      onOk: (name: string) => {
        if (createSheet(name)) {
          PopupLayer.instance.hidePopup();
        }
      }
    });

    popup.render();

    PopupLayer.instance.showPopup({
      content: popup,
      position: 'screen-center',
      isBackgroundDimmed: true
    });
  }, [createSheet]);

  // Handle renaming a sheet
  const handleRenameSheet = useCallback(
    (sheet: TSFixme) => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const PopupLayer = require('@noodl-views/popuplayer');

      const popup = new PopupLayer.StringInputPopup({
        label: 'New sheet name',
        value: sheet.name,
        okLabel: 'Rename',
        cancelLabel: 'Cancel',
        onOk: (newName: string) => {
          if (renameSheet(sheet, newName)) {
            PopupLayer.instance.hidePopup();
          }
        }
      });

      popup.render();

      PopupLayer.instance.showPopup({
        content: popup,
        position: 'screen-center',
        isBackgroundDimmed: true
      });
    },
    [renameSheet]
  );

  // Handle deleting a sheet
  const handleDeleteSheet = useCallback(
    (sheet: TSFixme) => {
      DialogLayerModel.instance.showConfirm({
        title: `Delete sheet "${sheet.name}"?`,
        text: `The ${sheet.componentCount} component(s) in this sheet will be moved to the root level.`,
        onConfirm: () => {
          const wasCurrentSheet = currentSheet && currentSheet.folderName === sheet.folderName;
          const success = deleteSheet(sheet);
          // Navigate to "All" view if we deleted the currently selected sheet
          if (success && wasCurrentSheet) {
            selectSheet(null);
          }
        }
      });
    },
    [deleteSheet, currentSheet, selectSheet]
  );

  // Handle moving a component to a sheet
  const handleMoveToSheet = useCallback(
    (componentPath: string, sheet: TSFixme) => {
      moveToSheet(componentPath, sheet);
    },
    [moveToSheet]
  );

  // Handle rename action from context menu
  const handleRename = useCallback(
    (node: TSFixme) => {
      startRename(node);
    },
    [startRename]
  );

  // Handle rename confirmation
  const handleRenameConfirm = useCallback(() => {
    if (!renamingItem || !renameValue) {
      return;
    }

    // Check if name actually changed
    const currentName = renamingItem.type === 'component' ? renamingItem.data.localName : renamingItem.data.name;

    if (renameValue === currentName) {
      // Name unchanged, just exit rename mode
      cancelRename();
      return;
    }

    // Validate the NEW name
    const validation = validateName(renameValue);
    if (!validation.valid) {
      console.warn('Invalid component name:', validation.error);
      return; // Stay in rename mode so user can fix
    }

    // Perform the actual rename
    const success = performRename(renamingItem, renameValue);
    if (success) {
      cancelRename();
    }
  }, [renamingItem, renameValue, validateName, performRename, cancelRename]);

  // Direct drop handler - bypasses useDragDrop state system for immediate execution
  // This matches how handleDropOnRoot works (which is reliable)
  const handleDirectDrop = useCallback(
    (targetNode: TSFixme) => {
      if (draggedItem) {
        handleDropOn(draggedItem, targetNode);
      }
    },
    [draggedItem, handleDropOn]
  );

  // Handle mouse up on Tree background - this is the root drop fallback
  // If an item is a valid drop target, its handleMouseUp calls stopPropagation
  // So if we receive mouseUp here, it means no item claimed the drop
  const handleTreeMouseUp = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const PopupLayer = require('@noodl-views/popuplayer');

    // If we're dragging and no specific item claimed the drop, it's a root drop
    if (draggedItem && PopupLayer.instance.isDragging()) {
      handleDropOnRoot(draggedItem);
    }
  }, [draggedItem, handleDropOnRoot]);

  // Handle right-click on empty space - Show create menu
  const handleTreeContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const templates = ComponentTemplates.instance.getTemplates({
        forRuntimeType: 'browser'
      });

      const items: TSFixme[] = templates.map((template) => ({
        icon: template.icon,
        label: `Create ${template.label}`,
        onClick: () => handleAddComponent(template)
      }));

      items.push({
        icon: IconName.FolderClosed,
        label: 'Create Folder',
        onClick: () => handleAddFolder()
      });

      showContextMenuInPopup({
        items,
        width: MenuDialogWidth.Default
      });
    },
    [handleAddComponent, handleAddFolder]
  );

  return (
    <div className={css['ComponentsPanel']}>
      {/* Header with title and sheet selector */}
      <div className={css['Header']}>
        <span className={css['Title']}>Components</span>
        <SheetSelector
          sheets={sheets}
          currentSheet={currentSheet}
          onSelectSheet={selectSheet}
          onCreateSheet={handleCreateSheet}
          onRenameSheet={handleRenameSheet}
          onDeleteSheet={handleDeleteSheet}
          disabled={!!options?.lockToSheet}
        />
      </div>

      {/* Component tree - right-click for create menu, mouseUp on background triggers root drop */}
      <div className={css['Tree']} onContextMenu={handleTreeContextMenu} onMouseUp={handleTreeMouseUp}>
        {treeData.length > 0 ? (
          <ComponentTree
            nodes={treeData}
            expandedFolders={expandedFolders}
            selectedId={selectedId}
            onItemClick={handleItemClick}
            onCaretClick={toggleFolder}
            onMakeHome={handleMakeHome}
            onDelete={handleDelete}
            onDuplicate={handleDuplicate}
            onRename={handleRename}
            onOpen={handleOpen}
            onDragStart={startDrag}
            onDrop={handleDirectDrop}
            canAcceptDrop={canDrop}
            onAddComponent={handleAddComponent}
            onAddFolder={handleAddFolder}
            renamingItem={renamingItem}
            renameValue={renameValue}
            onRenameChange={setRenameValue}
            onRenameConfirm={handleRenameConfirm}
            onRenameCancel={cancelRename}
            onDoubleClick={handleRename}
            sheets={sheets}
            onMoveToSheet={handleMoveToSheet}
          />
        ) : (
          <div className={css['PlaceholderMessage']}>
            <span>No components in project</span>
          </div>
        )}
      </div>
    </div>
  );
}
