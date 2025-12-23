/**
 * ComponentsPanel
 *
 * Modern React component for displaying and managing project components.
 * Migrated from legacy jQuery/underscore.js View implementation.
 *
 * @module noodl-editor
 */

import React, { useCallback, useEffect, useRef } from 'react';

import { IconName } from '@noodl-core-ui/components/common/Icon';

import { PopupMenu } from '../../PopupLayer/PopupMenu';
import { ComponentTree } from './components/ComponentTree';
import css from './ComponentsPanel.module.scss';
import { ComponentTemplates } from './ComponentTemplates';
import { useComponentActions } from './hooks/useComponentActions';
import { useComponentsPanel } from './hooks/useComponentsPanel';
import { useDragDrop } from './hooks/useDragDrop';
import { useRenameMode } from './hooks/useRenameMode';
import { ComponentsPanelProps } from './types';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PopupLayer = require('@noodl-views/popuplayer');

/**
 * ComponentsPanel displays the project's component tree with folders,
 * allowing users to navigate, create, rename, and organize components.
 */
export function ComponentsPanel({ options }: ComponentsPanelProps) {
  console.log('🚀 React ComponentsPanel RENDERED');

  const { treeData, expandedFolders, selectedId, toggleFolder, handleItemClick } = useComponentsPanel({
    hideSheets: options?.hideSheets
  });

  const {
    handleMakeHome,
    handleDelete,
    handleDuplicate,
    performRename,
    handleOpen,
    handleDropOn,
    handleAddComponent,
    handleAddFolder
  } = useComponentActions();

  const { draggedItem, dropTarget, startDrag, canDrop, handleDrop, clearDrop } = useDragDrop();

  const { renamingItem, renameValue, startRename, setRenameValue, cancelRename, validateName } = useRenameMode();

  const addButtonRef = useRef<HTMLButtonElement>(null);

  // Handle rename action from context menu
  const handleRename = useCallback(
    (node: TSFixme) => {
      startRename(node);
    },
    [startRename]
  );

  // Handle rename confirmation
  const handleRenameConfirm = useCallback(() => {
    console.log('🔍 handleRenameConfirm CALLED', { renamingItem, renameValue });

    if (!renamingItem || !renameValue) {
      console.log('❌ Early return - missing item or value', { renamingItem, renameValue });
      return;
    }

    // Check if name actually changed
    const currentName = renamingItem.type === 'component' ? renamingItem.data.localName : renamingItem.data.name;
    console.log('🔍 Current name vs new name:', { currentName, renameValue });

    if (renameValue === currentName) {
      // Name unchanged, just exit rename mode
      console.log('⚠️ Name unchanged - canceling rename');
      cancelRename();
      return;
    }

    // Validate the NEW name
    const validation = validateName(renameValue);
    console.log('🔍 Name validation:', validation);
    if (!validation.valid) {
      console.warn('❌ Invalid name:', validation.error);
      return; // Stay in rename mode so user can fix
    }

    // Perform the actual rename
    console.log('✅ Calling performRename...');
    const success = performRename(renamingItem, renameValue);
    console.log('🔍 performRename result:', success);
    if (success) {
      console.log('✅ Rename successful - canceling rename mode');
      cancelRename();
    } else {
      console.error('❌ Rename failed - check console for details');
      // Stay in rename mode on failure
    }
  }, [renamingItem, renameValue, validateName, performRename, cancelRename]);

  // Execute drop when both draggedItem and dropTarget are set
  useEffect(() => {
    if (draggedItem && dropTarget) {
      handleDropOn(draggedItem, dropTarget);
      clearDrop();
    }
  }, [draggedItem, dropTarget, handleDropOn, clearDrop]);

  // Handle add button click
  const handleAddClick = useCallback(() => {
    console.log('🔵 ADD BUTTON CLICKED!');

    try {
      const templates = ComponentTemplates.instance.getTemplates({
        forRuntimeType: 'browser' // Default to browser runtime for now
      });
      console.log('✅ Templates:', templates);

      const items = templates.map((template) => ({
        icon: template.icon,
        label: template.label,
        onClick: () => {
          handleAddComponent(template);
        }
      }));

      // Add folder option
      items.push({
        icon: IconName.FolderClosed,
        label: 'Folder',
        onClick: () => {
          handleAddFolder();
        }
      });
      console.log('✅ Menu items:', items);

      // Create menu using the imported PopupMenu from TypeScript module
      const menu = new PopupMenu({ items, owner: PopupLayer.instance });

      // Render the menu to generate its DOM element
      menu.render();

      // Show popup attached to the button (wrapped in jQuery for PopupLayer compatibility)
      PopupLayer.instance.showPopup({
        content: menu,
        attachTo: $(addButtonRef.current),
        position: 'bottom'
      });

      console.log('✅ Popup shown successfully');
    } catch (error) {
      console.error('❌ Error in handleAddClick:', error);
    }
  }, [handleAddComponent, handleAddFolder]);

  return (
    <div className={css['ComponentsPanel']}>
      {/* Header with title and add button */}
      <div className={css['Header']}>
        <span className={css['Title']}>Components</span>
        <button
          ref={addButtonRef}
          className={css['AddButton']}
          title="Add Component or Folder"
          onClick={handleAddClick}
        >
          +
        </button>
      </div>

      {/* Component tree */}
      <div className={css['Tree']}>
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
            onDrop={handleDrop}
            canAcceptDrop={canDrop}
            renamingItem={renamingItem}
            renameValue={renameValue}
            onRenameChange={setRenameValue}
            onRenameConfirm={handleRenameConfirm}
            onRenameCancel={cancelRename}
            onDoubleClick={handleRename}
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
