/**
 * useRenameMode
 *
 * Manages inline rename state and validation for components and folders.
 */

import { useCallback, useState } from 'react';

import { ProjectModel } from '@noodl-models/projectmodel';

import { TreeNode } from '../types';

interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function useRenameMode() {
  const [renamingItem, setRenamingItem] = useState<TreeNode | null>(null);
  const [renameValue, setRenameValue] = useState('');

  /**
   * Start rename mode for an item
   */
  const startRename = useCallback((item: TreeNode) => {
    setRenamingItem(item);

    // Set initial value based on item type
    if (item.type === 'component') {
      setRenameValue(item.data.localName);
    } else {
      setRenameValue(item.data.name);
    }
  }, []);

  /**
   * Cancel rename mode
   */
  const cancelRename = useCallback(() => {
    setRenamingItem(null);
    setRenameValue('');
  }, []);

  /**
   * Validate the new name
   */
  const validateName = useCallback(
    (newName: string): ValidationResult => {
      if (!renamingItem) {
        return { valid: false, error: 'No item selected for rename' };
      }

      // Check for empty name
      if (!newName || newName.trim() === '') {
        return { valid: false, error: 'Name cannot be empty' };
      }

      // Check for invalid characters
      const invalidChars = /[<>:"|?*\\/]/;
      if (invalidChars.test(newName)) {
        return { valid: false, error: 'Name contains invalid characters (< > : " | ? * \\ /)' };
      }

      // If name hasn't changed, it's valid (no-op)
      if (renamingItem.type === 'component' && newName === renamingItem.data.localName) {
        return { valid: true };
      }
      if (renamingItem.type === 'folder' && newName === renamingItem.data.name) {
        return { valid: true };
      }

      // Check for duplicate names
      if (renamingItem.type === 'component') {
        // Build the full component name with folder path
        const currentPath = renamingItem.data.path;
        const pathParts = currentPath.split('/');
        pathParts.pop(); // Remove current component name
        const folderPath = pathParts.join('/');

        const newFullName = folderPath ? `${folderPath}/${newName}` : newName;

        // Check if component with this name already exists
        const existingComponent = ProjectModel.instance?.getComponentWithName(newFullName);
        if (existingComponent && existingComponent !== renamingItem.data.component) {
          return { valid: false, error: 'A component with this name already exists' };
        }
      } else if (renamingItem.type === 'folder') {
        // For folders, check if any component exists with this folder path
        const currentPath = renamingItem.data.path;
        const pathParts = currentPath.split('/');
        pathParts.pop(); // Remove current folder name
        const parentPath = pathParts.join('/');

        const newFolderPath = parentPath ? `${parentPath}/${newName}` : newName;

        // Check if any component starts with this folder path
        const components = ProjectModel.instance?.getComponents() || [];
        const hasConflict = components.some((comp) => {
          // Check if component is in a folder with the new name
          return comp.name.startsWith(newFolderPath + '/') && !comp.name.startsWith(currentPath + '/');
        });

        if (hasConflict) {
          return { valid: false, error: 'A folder with this name already exists' };
        }
      }

      return { valid: true };
    },
    [renamingItem]
  );

  return {
    renamingItem,
    renameValue,
    setRenameValue,
    startRename,
    cancelRename,
    validateName
  };
}
