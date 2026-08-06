/**
 * ComponentsPanel
 *
 * Modern React component for displaying and managing project components.
 * Migrated from legacy jQuery/underscore.js View implementation.
 *
 * @module noodl-editor
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';

import { DialogLayerModel } from '@noodl-models/DialogLayerModel';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { SearchInput } from '@noodl-core-ui/components/inputs/SearchInput';
import { MenuDialogWidth } from '@noodl-core-ui/components/popups/MenuDialog';
import { BasePanel } from '@noodl-core-ui/components/sidebar/BasePanel';

import { showContextMenuInPopup } from '../../ShowContextMenuInPopup';
import { ComponentTree } from './components/ComponentTree';
import { SheetSelector } from './components/SheetSelector';
import { StringInputDialog } from './components/StringInputDialog';
import css from './ComponentsPanel.module.scss';
import { buildCreateMenuItems, createMenuTitle, DEFAULT_SHEET_NAME } from './createMenu';
import { useComponentActions } from './hooks/useComponentActions';
import { useComponentFilter } from './hooks/useComponentFilter';
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

  /**
   * WFA-001 — the selected sheet, as the two things the actions below need.
   *
   * `sheetPrefix` puts back what the tree strips from its display paths, so a
   * component created or dragged while a sheet is selected stays in that sheet.
   * `runtimeType` is what decides which templates the create menus offer: on the
   * Cloud Functions sheet you get the cloud ones, everywhere else the browser
   * ones — offering "Cloud Function Component" inside a browser folder would
   * produce a component in the wrong sheet.
   */
  const sheetPrefix = currentSheet && !currentSheet.isDefault ? `/${currentSheet.folderName}` : '';
  const runtimeType = currentSheet?.isCloud ? 'cloud' : 'browser';

  /**
   * SPR-005 — the sheet a new component lands in, by the name a user sees.
   *
   * With no sheet selected the tree shows several sheets at once but `sheetPrefix`
   * is `''`, so a new component lands in **Default**. That is precisely the fact
   * "All" hid, and every create menu below now states it before the click.
   */
  const sheetName = currentSheet ? currentSheet.name : DEFAULT_SHEET_NAME;

  /**
   * The disabled "Create Cloud Function Component" row names the fix
   * ("choose Cloud Functions in the sheet selector") but could not do it —
   * clicking it did nothing. This is the sheet-switch half of that fix.
   */
  const handleGoToCloudSheet = useCallback(() => {
    const cloudSheet = sheets.find((s) => s.isCloud);
    if (cloudSheet) selectSheet(cloudSheet);
  }, [sheets, selectSheet]);

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
  } = useComponentActions({ sheetPrefix });

  const { createSheet, renameSheet, deleteSheet, moveToSheet } = useSheetManagement();

  const { draggedItem, startDrag, canDrop } = useDragDrop();

  const { renamingItem, renameValue, startRename, setRenameValue, cancelRename, validateName } = useRenameMode();

  /**
   * PNL-006 — the in-place name filter.
   *
   * The query is the only new state. The filter derives an *effective* expansion
   * set from it rather than writing to `expandedFolders`, so clearing the field
   * restores the previous expansion exactly — there is nothing to restore,
   * because nothing was overwritten.
   */
  const [filterQuery, setFilterQuery] = useState('');
  const filtered = useComponentFilter(treeData, filterQuery, expandedFolders);

  // Handle creating a new sheet
  const handleCreateSheet = useCallback(() => {
    DialogLayerModel.instance.showDialog((close) =>
      React.createElement(StringInputDialog, {
        title: 'New sheet name',
        placeholder: 'Enter sheet name',
        confirmLabel: 'Create',
        onConfirm: (value) => {
          createSheet(value);
          close();
        },
        onCancel: close
      })
    );
  }, [createSheet]);

  // Handle renaming a sheet
  const handleRenameSheet = useCallback(
    (sheet: TSFixme) => {
      DialogLayerModel.instance.showDialog((close) =>
        React.createElement(StringInputDialog, {
          title: 'Rename sheet',
          defaultValue: sheet.name,
          confirmLabel: 'Rename',
          onConfirm: (value) => {
            renameSheet(sheet, value);
            close();
          },
          onCancel: close
        })
      );
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
    const PopupLayer = require('@noodl-views/popuplayer').default;

    // If we're dragging and no specific item claimed the drop, it's a root drop
    if (draggedItem && PopupLayer.instance.isDragging()) {
      handleDropOnRoot(draggedItem);
    }
  }, [draggedItem, handleDropOnRoot]);

  /**
   * SPR-005 — the sheet root's create menu, built once for both doors onto it.
   *
   * Empty space is the sheet's root — a folder context, not a component one.
   * Passing `forParentType` makes the templates' own `parentTypes` declarations
   * load-bearing instead of inert.
   */
  const rootCreateContext = useMemo(
    () => ({ forParentType: 'folder' as const, runtimeType: runtimeType as 'browser' | 'cloud', sheetName }),
    [runtimeType, sheetName]
  );

  /**
   * SPR-005 — the one create menu, opened from the header "+" or from a
   * right-click on empty space.
   *
   * `attachTo` is what separates the two: a menu opened from a button anchors to
   * the button (and can therefore be driven by a script), a right-click menu
   * anchors to the cursor. Both render the same items, so the visible door and
   * the hidden one cannot drift apart.
   */
  const openRootCreateMenu = useCallback(
    (attachTo?: HTMLElement) => {
      showContextMenuInPopup({
        title: createMenuTitle(rootCreateContext),
        items: buildCreateMenuItems(rootCreateContext, {
          onAddComponent: handleAddComponent,
          onAddFolder: handleAddFolder,
          onGoToCloudSheet: handleGoToCloudSheet
        }),
        width: MenuDialogWidth.Default,
        attachTo
      });
    },
    [rootCreateContext, handleAddComponent, handleAddFolder, handleGoToCloudSheet]
  );

  // Handle right-click on empty space - Show create menu
  const handleTreeContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      openRootCreateMenu();
    },
    [openRootCreateMenu]
  );

  /**
   * SPR-005 — the visible half of the same gesture.
   *
   * F83's finding was not that creating a cloud function was impossible, it was
   * that nothing on screen said it could be done. A "+" in the panel header is
   * the affordance every other tree in this editor has; it opens the menu that
   * already existed rather than adding a second way to create anything.
   */
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const handleHeaderCreateClick = useCallback(() => {
    openRootCreateMenu(createButtonRef.current ?? undefined);
  }, [openRootCreateMenu]);

  return (
    /* PNL-005: the panel's own 36px `bg-3` bar is gone — this is the shared
       `PanelHeader`, and the sheet selector is an action-slot control.
       `UNSAFE_content_style` drops `BasePanel`'s horizontal inset so the tree
       rows stay full-bleed (their hover and selection fills run to the panel
       edge); PNL-006 owns the tree itself and can take the inset back if it
       wants one. */
    <BasePanel
      title="Components"
      isFill
      UNSAFE_content_style={{ paddingInline: 0, paddingTop: 0 }}
      headerSlot={
        <>
          <SheetSelector
            sheets={sheets}
            currentSheet={currentSheet}
            onSelectSheet={selectSheet}
            onCreateSheet={handleCreateSheet}
            onRenameSheet={handleRenameSheet}
            onDeleteSheet={handleDeleteSheet}
            disabled={!!options?.lockToSheet}
          />
          {/* SPR-005: the create affordance, visible without a right-click. Its
              tooltip names the destination, so where a new component lands is
              legible before the menu is even open. */}
          <button
            ref={createButtonRef}
            type="button"
            className={css['HeaderAction']}
            onClick={handleHeaderCreateClick}
            aria-label={createMenuTitle(rootCreateContext)}
            title={createMenuTitle(rootCreateContext)}
            data-test="components-panel-create"
          >
            <Icon icon={IconName.Plus} size={IconSize.Tiny} />
          </button>
        </>
      }
    >
      {/* PNL-006: the filter is pinned under the shared header — it does not
          scroll with the tree, and it is name-only. The Search panel searches
          parameter values and CSS; this does not duplicate it. */}
      <div className={css['FilterBar']}>
        <SearchInput
          placeholder="Filter components"
          value={filterQuery}
          onChange={setFilterQuery}
          UNSAFE_style={{ width: '100%' }}
        />
      </div>

      {/* Component tree - right-click for create menu, mouseUp on background triggers root drop */}
      <div
        className={css['Tree']}
        data-test="component-tree"
        onContextMenu={handleTreeContextMenu}
        onMouseUp={handleTreeMouseUp}
      >
        {filtered.nodes.length > 0 ? (
          <ComponentTree
            nodes={filtered.nodes}
            expandedFolders={filtered.expandedFolders}
            matched={filtered.isFiltering ? filtered.matched : null}
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
            onGoToCloudSheet={handleGoToCloudSheet}
            renamingItem={renamingItem}
            renameValue={renameValue}
            onRenameChange={setRenameValue}
            onRenameConfirm={handleRenameConfirm}
            onRenameCancel={cancelRename}
            onDoubleClick={handleRename}
            sheets={sheets}
            onMoveToSheet={handleMoveToSheet}
            runtimeType={runtimeType}
            sheetName={sheetName}
          />
        ) : filtered.isFiltering ? (
          /* An empty *result* is a different fact from an empty project, and
             saying the wrong one is how a filter convinces someone their work
             has vanished. */
          <div className={css['PlaceholderMessage']} data-test="component-tree-no-matches">
            <span>
              No components match <span className={css['PlaceholderQuery']}>“{filterQuery.trim()}”</span>
            </span>
            <span>Clear the filter to see the whole tree.</span>
          </div>
        ) : currentSheet?.isCloud ? (
          /* WFA-001: the Cloud Functions sheet is listed even when the project
             has none, so this is the state a user meets first. It has to say
             what a cloud function is and how to make one — an unexplained empty
             tree is how the door stays shut. */
          <div className={css['PlaceholderMessage']} data-test="cloud-functions-empty">
            <span>No cloud functions yet</span>
            <span>These components run on your backend, not in the browser.</span>
            {/* SPR-005: names the visible control rather than the hidden gesture.
                "Right-click here" was the only instruction, and it was the whole
                reason F83 concluded the feature did not exist. */}
            <span>Use + in the panel header to create one, or right-click here.</span>
          </div>
        ) : (
          <div className={css['PlaceholderMessage']}>
            <span>No components in {sheetName}</span>
            <span>Use + in the panel header to create one.</span>
          </div>
        )}
      </div>
    </BasePanel>
  );
}
