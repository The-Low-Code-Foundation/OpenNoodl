import { useCallback } from 'react';

import { ComponentModel } from '@noodl-models/componentmodel';
import { NodeGraphModel } from '@noodl-models/nodegraphmodel';
import { ProjectModel } from '@noodl-models/projectmodel';
import { UndoActionGroup, UndoQueue } from '@noodl-models/undo-queue-model';
import { guid } from '@noodl-utils/utils';

import { ToastLayer } from '../../../ToastLayer/ToastLayer';
import { Sheet } from '../types';

/**
 * useSheetManagement
 *
 * Hook for managing sheets (top-level organizational folders starting with #).
 * Provides CRUD operations with full undo/redo support.
 */
export function useSheetManagement() {
  /**
   * Create a new sheet with the given name.
   * Creates a placeholder component at #SheetName/.placeholder to establish the folder.
   */
  const createSheet = useCallback((name: string): boolean => {
    if (!ProjectModel.instance) {
      ToastLayer.showError('No project open');
      return false;
    }

    // Validate name
    const trimmedName = name.trim();
    if (!trimmedName) {
      ToastLayer.showError('Sheet name cannot be empty');
      return false;
    }

    // Check for invalid characters
    if (trimmedName.includes('/') || trimmedName.includes('#')) {
      ToastLayer.showError('Sheet name cannot contain / or #');
      return false;
    }

    // Build the folder name (with # prefix)
    const folderName = `#${trimmedName}`;

    // Check if sheet already exists
    const existingComponents = ProjectModel.instance.getComponents();
    const sheetExists = existingComponents.some((comp) => comp.name.startsWith(folderName + '/'));

    if (sheetExists) {
      ToastLayer.showError(`Sheet "${trimmedName}" already exists`);
      return false;
    }

    // Create placeholder to establish the folder
    // Component names start with "/" to match project naming convention
    const placeholderName = `/${folderName}/.placeholder`;

    UndoQueue.instance.pushAndDo(
      new UndoActionGroup({
        label: `Create sheet "${trimmedName}"`,
        do: () => {
          const placeholder = new ComponentModel({
            name: placeholderName,
            graph: new NodeGraphModel(),
            id: guid()
          });
          ProjectModel.instance?.addComponent(placeholder);
        },
        undo: () => {
          const placeholder = ProjectModel.instance?.getComponentWithName(placeholderName);
          if (placeholder) {
            ProjectModel.instance?.removeComponent(placeholder);
          }
        }
      })
    );

    ToastLayer.showSuccess(`Created sheet "${trimmedName}"`);
    return true;
  }, []);

  /**
   * Rename a sheet and update all component paths within it.
   */
  const renameSheet = useCallback((sheet: Sheet, newName: string): boolean => {
    if (!ProjectModel.instance) {
      ToastLayer.showError('No project open');
      return false;
    }

    if (sheet.isDefault) {
      ToastLayer.showError('Cannot rename the default sheet');
      return false;
    }

    // Validate new name
    const trimmedNewName = newName.trim();
    if (!trimmedNewName) {
      ToastLayer.showError('Sheet name cannot be empty');
      return false;
    }

    if (trimmedNewName.includes('/') || trimmedNewName.includes('#')) {
      ToastLayer.showError('Sheet name cannot contain / or #');
      return false;
    }

    const oldFolderName = sheet.folderName;
    const newFolderName = `#${trimmedNewName}`;

    // If the name hasn't changed, nothing to do
    if (oldFolderName === newFolderName) {
      return true;
    }

    // Check if target name already exists
    // Components start with "/" so we need to check for "/#{NewName}/"
    const oldPrefix = '/' + oldFolderName + '/';
    const newPrefix = '/' + newFolderName + '/';

    const existingComponents = ProjectModel.instance.getComponents();
    const targetExists = existingComponents.some((comp) => comp.name.startsWith(newPrefix));

    if (targetExists) {
      ToastLayer.showError(`Sheet "${trimmedNewName}" already exists`);
      return false;
    }

    // Find all components in this sheet (components start with "/")
    const componentsInSheet = existingComponents.filter((comp) => comp.name.startsWith(oldPrefix));

    if (componentsInSheet.length === 0) {
      ToastLayer.showError('Sheet has no components to rename');
      return false;
    }

    // Build the rename map with old/new name STRINGS (not component references for undo)
    const renameMap: Array<{ oldName: string; newName: string }> = [];

    componentsInSheet.forEach((comp) => {
      // Replace the old prefix with new prefix
      const newComponentName = comp.name.replace(oldPrefix, newPrefix);
      renameMap.push({
        oldName: comp.name,
        newName: newComponentName
      });
    });

    UndoQueue.instance.pushAndDo(
      new UndoActionGroup({
        label: `Rename sheet "${sheet.name}" to "${trimmedNewName}"`,
        do: () => {
          // Find and rename each component by its current name
          renameMap.forEach(({ oldName, newName }) => {
            const comp = ProjectModel.instance?.getComponentWithName(oldName);
            if (comp) {
              ProjectModel.instance?.renameComponent(comp, newName);
            }
          });
        },
        undo: () => {
          // Rename in reverse order - find by NEW name and rename back to OLD name
          [...renameMap].reverse().forEach(({ oldName, newName }) => {
            const comp = ProjectModel.instance?.getComponentWithName(newName);
            if (comp) {
              ProjectModel.instance?.renameComponent(comp, oldName);
            }
          });
        }
      })
    );

    ToastLayer.showSuccess(`Renamed sheet to "${trimmedNewName}"`);
    return true;
  }, []);

  /**
   * Delete a sheet by moving all its components to the default sheet (root level).
   * Components are preserved - only the sheet organization is removed.
   */
  const deleteSheet = useCallback((sheet: Sheet): boolean => {
    if (!ProjectModel.instance) {
      ToastLayer.showError('No project open');
      return false;
    }

    if (sheet.isDefault) {
      ToastLayer.showError('Cannot delete the default sheet');
      return false;
    }

    // Find all components in this sheet (including placeholders)
    const componentsInSheet = ProjectModel.instance
      .getComponents()
      .filter((comp) => comp.name.startsWith('/' + sheet.folderName + '/'));

    if (componentsInSheet.length === 0) {
      ToastLayer.showError('Sheet is already empty');
      return false;
    }

    // Build rename map using STRINGS only (not component references for undo)
    // e.g., "/#Pages/MyPage" becomes "/MyPage"
    const renameMap: Array<{ oldName: string; newName: string }> = [];
    const placeholderNames: string[] = [];

    componentsInSheet.forEach((comp) => {
      if (comp.name.endsWith('/.placeholder')) {
        // Mark placeholders for deletion (they're only needed for empty folders)
        placeholderNames.push(comp.name);
      } else {
        // Calculate new name by removing sheet prefix
        const sheetPrefix = '/' + sheet.folderName;
        const newName = comp.name.replace(sheetPrefix, '');
        renameMap.push({
          oldName: comp.name,
          newName
        });
      }
    });

    // Check for naming conflicts
    for (const { newName } of renameMap) {
      const existing = ProjectModel.instance.getComponentWithName(newName);
      if (existing) {
        ToastLayer.showError(`Cannot delete sheet: "${newName.split('/').pop()}" already exists at root level`);
        return false;
      }
    }

    UndoQueue.instance.pushAndDo(
      new UndoActionGroup({
        label: `Delete sheet "${sheet.name}"`,
        do: () => {
          // Remove placeholders first (find by name)
          placeholderNames.forEach((placeholderName) => {
            const placeholder = ProjectModel.instance?.getComponentWithName(placeholderName);
            if (placeholder) {
              ProjectModel.instance?.removeComponent(placeholder);
            }
          });
          // Rename components to remove sheet prefix (find by OLD name)
          renameMap.forEach(({ oldName, newName }) => {
            const comp = ProjectModel.instance?.getComponentWithName(oldName);
            if (comp) {
              ProjectModel.instance?.renameComponent(comp, newName);
            }
          });
        },
        undo: () => {
          // Rename components back to include sheet prefix (find by NEW name)
          [...renameMap].reverse().forEach(({ oldName, newName }) => {
            const comp = ProjectModel.instance?.getComponentWithName(newName);
            if (comp) {
              ProjectModel.instance?.renameComponent(comp, oldName);
            }
          });
          // Restore placeholders
          placeholderNames.forEach((placeholderName) => {
            const restoredPlaceholder = new ComponentModel({
              name: placeholderName,
              graph: new NodeGraphModel(),
              id: guid()
            });
            ProjectModel.instance?.addComponent(restoredPlaceholder);
          });
        }
      })
    );

    const componentCount = renameMap.length;
    ToastLayer.showSuccess(
      `Deleted sheet "${sheet.name}" - ${componentCount} component${componentCount !== 1 ? 's' : ''} moved to root`
    );
    return true;
  }, []);

  /**
   * Move a component to a different sheet.
   */
  const moveToSheet = useCallback((componentName: string, targetSheet: Sheet): boolean => {
    if (!ProjectModel.instance) {
      ToastLayer.showError('No project open');
      return false;
    }

    const component = ProjectModel.instance.getComponentWithName(componentName);
    if (!component) {
      ToastLayer.showError('Component not found');
      return false;
    }

    // Determine the component's local name (without any folder prefix)
    const parts = componentName.split('/');
    const localName = parts[parts.length - 1];

    // Build the new name - component names must start with "/"
    let newName: string;
    if (targetSheet.isDefault) {
      // Moving to default sheet - use "/" + local name
      newName = `/${localName}`;
    } else {
      // Moving to named sheet - "/#SheetName/localName"
      newName = `/${targetSheet.folderName}/${localName}`;
    }

    // Check if name already exists in target
    if (ProjectModel.instance.getComponentWithName(newName)) {
      ToastLayer.showError(`A component named "${localName}" already exists in ${targetSheet.name}`);
      return false;
    }

    const oldName = componentName;

    UndoQueue.instance.pushAndDo(
      new UndoActionGroup({
        label: `Move "${localName}" to sheet "${targetSheet.name}"`,
        do: () => {
          // Find component by current name, not stale reference
          const comp = ProjectModel.instance?.getComponentWithName(oldName);
          if (comp) {
            ProjectModel.instance?.renameComponent(comp, newName);
          }
        },
        undo: () => {
          // Find component by NEW name to rename back
          const comp = ProjectModel.instance?.getComponentWithName(newName);
          if (comp) {
            ProjectModel.instance?.renameComponent(comp, oldName);
          }
        }
      })
    );

    ToastLayer.showSuccess(`Moved "${localName}" to ${targetSheet.name}`);
    return true;
  }, []);

  return {
    createSheet,
    renameSheet,
    deleteSheet,
    moveToSheet
  };
}
