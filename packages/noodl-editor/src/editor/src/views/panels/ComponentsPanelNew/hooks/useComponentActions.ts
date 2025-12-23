/**
 * useComponentActions
 *
 * Provides handlers for component/folder actions.
 * Integrates with UndoQueue for all operations.
 */

import { useCallback } from 'react';

import { NodeGraphModel } from '@noodl-models/nodegraphmodel';
import { ProjectModel } from '@noodl-models/projectmodel';
import { UndoQueue, UndoActionGroup } from '@noodl-models/undo-queue-model';
import { tracker } from '@noodl-utils/tracker';
import { guid } from '@noodl-utils/utils';

import { EventDispatcher } from '../../../../../../shared/utils/EventDispatcher';
import { ComponentModel } from '../../../../models/componentmodel';
import { TreeNode } from '../types';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PopupLayer = require('@noodl-views/popuplayer');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ToastLayer = require('@noodl-views/toastlayer/toastlayer');

export function useComponentActions() {
  const handleMakeHome = useCallback((node: TreeNode) => {
    if (node.type !== 'component') return;

    const component = node.data.component;
    if (!component) return;

    const canDelete = ProjectModel.instance?.deleteComponentAllowed(component);
    if (!canDelete?.canBeDelete) {
      console.warn('Cannot set component as home:', canDelete?.reason);
      return;
    }

    const previousRoot = ProjectModel.instance?.getRootComponent();
    const undoGroup = new UndoActionGroup({
      label: `Make ${component.name} home`
    });

    UndoQueue.instance.push(undoGroup);

    undoGroup.push({
      do: () => {
        ProjectModel.instance?.setRootComponent(component);
      },
      undo: () => {
        if (previousRoot) {
          ProjectModel.instance?.setRootComponent(previousRoot);
        } else {
          ProjectModel.instance?.setRootNode(undefined);
        }
      }
    });

    undoGroup.do();
  }, []);

  const handleDelete = useCallback((node: TreeNode) => {
    if (node.type !== 'component') {
      // TODO: Implement folder deletion
      console.log('Folder deletion not yet implemented');
      return;
    }

    const component = node.data.component;
    const canDelete = ProjectModel.instance?.deleteComponentAllowed(component);

    if (!canDelete?.canBeDelete) {
      alert(canDelete?.reason || "This component can't be deleted");
      return;
    }

    // Confirm deletion
    const confirmed = confirm(`Are you sure you want to delete "${component.localName}"?`);
    if (!confirmed) return;

    const undoGroup = new UndoActionGroup({
      label: `Delete ${component.name}`
    });

    UndoQueue.instance.push(undoGroup);

    undoGroup.push({
      do: () => {
        ProjectModel.instance?.removeComponent(component, { undo: undoGroup });
      },
      undo: () => {
        const restored = ProjectModel.instance?.getComponentWithName(component.name);
        if (!restored) {
          // Component was deleted, need to recreate it
          // This is handled by the removeComponent undo
        }
      }
    });

    undoGroup.do();
  }, []);

  const handleDuplicate = useCallback((node: TreeNode) => {
    if (node.type !== 'component') {
      // TODO: Implement folder duplication
      console.log('Folder duplication not yet implemented');
      return;
    }

    const component = node.data.component;
    let newName = component.name + ' Copy';

    // Find unique name
    let counter = 1;
    while (ProjectModel.instance?.getComponentWithName(newName)) {
      newName = `${component.name} Copy ${counter}`;
      counter++;
    }

    const undoGroup = new UndoActionGroup({
      label: `Duplicate ${component.name}`
    });

    UndoQueue.instance.push(undoGroup);

    let duplicatedComponent = null;

    undoGroup.push({
      do: () => {
        ProjectModel.instance?.duplicateComponent(component, newName, {
          undo: undoGroup,
          rerouteComponentRefs: null
        });

        duplicatedComponent = ProjectModel.instance?.getComponentWithName(newName);
      },
      undo: () => {
        if (duplicatedComponent) {
          ProjectModel.instance?.removeComponent(duplicatedComponent, { undo: undoGroup });
        }
      }
    });

    undoGroup.do();
  }, []);

  const handleRename = useCallback((node: TreeNode) => {
    // This triggers the rename UI - the actual implementation
    // will be wired up in ComponentsPanelReact
    console.log('Rename initiated for:', node);
  }, []);

  /**
   * Perform the actual rename operation with undo support
   */
  const performRename = useCallback((node: TreeNode, newName: string) => {
    if (node.type === 'component') {
      const component = node.data.component;
      const oldName = component.name;
      const parentPath = oldName.includes('/') ? oldName.substring(0, oldName.lastIndexOf('/')) : '';
      const fullNewName = parentPath ? `${parentPath}/${newName}` : newName;

      // Check for naming conflicts
      if (ProjectModel.instance?.getComponentWithName(fullNewName)) {
        ToastLayer.showError('Component name already exists. Name must be unique.');
        return false;
      }

      const undoGroup = new UndoActionGroup({
        label: `Rename ${component.localName} to ${newName}`
      });

      UndoQueue.instance.push(undoGroup);

      undoGroup.push({
        do: () => {
          ProjectModel.instance?.renameComponent(component, fullNewName);
        },
        undo: () => {
          ProjectModel.instance?.renameComponent(component, oldName);
        }
      });

      undoGroup.do();

      return true;
    } else if (node.type === 'folder') {
      const oldPath = node.data.path;
      const parentPath = oldPath.includes('/') ? oldPath.substring(0, oldPath.lastIndexOf('/')) : '';
      const newPath = parentPath ? `${parentPath}/${newName}` : newName;

      // Get all components in this folder
      const componentsToRename = ProjectModel.instance
        ?.getComponents()
        .filter((comp) => comp.name.startsWith(oldPath + '/'));

      if (!componentsToRename || componentsToRename.length === 0) {
        // Empty folder - just update the path (no actual operation needed)
        // Folders are virtual, so we don't need to do anything
        return true;
      }

      // Check for naming conflicts
      const wouldConflict = componentsToRename.some((comp) => {
        const relativePath = comp.name.substring(oldPath.length);
        const newFullName = newPath + relativePath;
        return (
          ProjectModel.instance?.getComponentWithName(newFullName) &&
          ProjectModel.instance?.getComponentWithName(newFullName) !== comp
        );
      });

      if (wouldConflict) {
        ToastLayer.showError('Folder rename would create naming conflicts');
        return false;
      }

      const renames: Array<{ component: TSFixme; oldName: string; newName: string }> = [];

      componentsToRename.forEach((comp) => {
        const relativePath = comp.name.substring(oldPath.length);
        const newFullName = newPath + relativePath;
        renames.push({ component: comp, oldName: comp.name, newName: newFullName });
      });

      const undoGroup = new UndoActionGroup({
        label: `Rename folder ${node.data.name} to ${newName}`
      });

      UndoQueue.instance.push(undoGroup);

      undoGroup.push({
        do: () => {
          renames.forEach(({ component, newName }) => {
            ProjectModel.instance?.renameComponent(component, newName);
          });
        },
        undo: () => {
          renames.forEach(({ component, oldName }) => {
            ProjectModel.instance?.renameComponent(component, oldName);
          });
        }
      });

      undoGroup.do();

      return true;
    }

    return false;
  }, []);

  const handleOpen = useCallback((node: TreeNode) => {
    if (node.type !== 'component') return;

    // TODO: Open component in NodeGraphEditor
    // This requires integration with the editor's tab system
    console.log('Open component:', node.data.component.name);
  }, []);

  /**
   * Handle dropping an item onto a target
   */
  /**
   * Handle adding a new component using a template
   */
  const handleAddComponent = useCallback((template: TSFixme, parentPath?: string) => {
    const finalParentPath = parentPath || '';

    const popup = template.createPopup({
      onCreate: (localName: string, options?: TSFixme) => {
        const componentName = finalParentPath + localName;

        // Validate name
        if (!localName || localName.trim() === '') {
          ToastLayer.showError('Component name cannot be empty');
          return;
        }

        if (ProjectModel.instance?.getComponentWithName(componentName)) {
          ToastLayer.showError('Component name already exists. Name must be unique.');
          return;
        }

        // Create component with undo support
        const undoGroup = new UndoActionGroup({ label: 'add component' });

        let component: ComponentModel;
        if (template) {
          component = template.createComponent(componentName, options, undoGroup);
        } else {
          component = new ComponentModel({
            name: componentName,
            graph: new NodeGraphModel(),
            id: guid()
          });
        }

        tracker.track('Component Created', {
          template: template ? template.label : undefined
        });

        ProjectModel.instance?.addComponent(component, { undo: undoGroup });
        UndoQueue.instance.push(undoGroup);

        // Switch to the new component
        EventDispatcher.instance.notifyListeners('ComponentPanel.SwitchToComponent', {
          component,
          pushHistory: true
        });

        PopupLayer.instance.hidePopup();
      },
      onCancel: () => {
        PopupLayer.instance.hidePopup();
      }
    });

    PopupLayer.instance.showPopup({
      content: popup,
      position: 'bottom'
    });
  }, []);

  /**
   * Handle adding a new folder
   */
  const handleAddFolder = useCallback((parentPath?: string) => {
    const popup = new PopupLayer.StringInputPopup({
      label: 'New folder name',
      okLabel: 'Add',
      cancelLabel: 'Cancel',
      onOk: (folderName: string) => {
        // Validate name
        if (!folderName || folderName.trim() === '') {
          ToastLayer.showError('Folder name cannot be empty');
          return;
        }

        // For now, just show a message that this will be implemented
        // The actual folder creation requires the ComponentsPanelFolder class
        // which is part of the legacy system. We'll implement this when we
        // migrate the folder structure to React state.
        console.log('Creating folder:', folderName, 'at path:', parentPath);
        ToastLayer.showInteraction('Folder creation will be available in the next phase');

        PopupLayer.instance.hidePopup();
      }
    });
    popup.render();

    PopupLayer.instance.showPopup({
      content: popup,
      position: 'bottom'
    });
  }, []);

  /**
   * Handle dropping an item onto a target
   */
  const handleDropOn = useCallback((draggedItem: TreeNode, targetItem: TreeNode) => {
    // Component → Folder
    if (draggedItem.type === 'component' && targetItem.type === 'folder') {
      const component = draggedItem.data.component;
      const targetPath = targetItem.data.path === '/' ? '' : targetItem.data.path;
      const newName = targetPath ? `${targetPath}/${component.localName}` : component.localName;

      // Check for naming conflicts
      if (ProjectModel.instance?.getComponentWithName(newName)) {
        alert(`Component "${newName}" already exists in that folder`);
        return;
      }

      const oldName = component.name;

      UndoQueue.instance.pushAndDo(
        new UndoActionGroup({
          label: `Move ${component.localName} to folder`,
          do: () => {
            ProjectModel.instance?.renameComponent(component, newName);
          },
          undo: () => {
            ProjectModel.instance?.renameComponent(component, oldName);
          }
        })
      );
    }
    // Folder → Folder
    else if (draggedItem.type === 'folder' && targetItem.type === 'folder') {
      const sourcePath = draggedItem.data.path;
      const targetPath = targetItem.data.path === '/' ? '' : targetItem.data.path;
      const newPath = targetPath ? `${targetPath}/${draggedItem.data.name}` : draggedItem.data.name;

      // Get all components in source folder
      const componentsToMove = ProjectModel.instance
        ?.getComponents()
        .filter((comp) => comp.name.startsWith(sourcePath + '/'));

      if (!componentsToMove || componentsToMove.length === 0) {
        console.log('Folder is empty, nothing to move');
        return;
      }

      const renames: Array<{ component: TSFixme; oldName: string; newName: string }> = [];

      componentsToMove.forEach((comp) => {
        const relativePath = comp.name.substring(sourcePath.length + 1);
        const newName = `${newPath}/${relativePath}`;
        renames.push({ component: comp, oldName: comp.name, newName });
      });

      UndoQueue.instance.pushAndDo(
        new UndoActionGroup({
          label: `Move ${draggedItem.data.name} folder`,
          do: () => {
            renames.forEach(({ component, newName }) => {
              ProjectModel.instance?.renameComponent(component, newName);
            });
          },
          undo: () => {
            renames.forEach(({ component, oldName }) => {
              ProjectModel.instance?.renameComponent(component, oldName);
            });
          }
        })
      );
    }
    // Component → Component (make subcomponent)
    else if (draggedItem.type === 'component' && targetItem.type === 'component') {
      const component = draggedItem.data.component;
      const targetComponent = targetItem.data.component;
      const newName = `${targetComponent.name}/${component.localName}`;

      // Check for naming conflicts
      if (ProjectModel.instance?.getComponentWithName(newName)) {
        alert(`Component "${newName}" already exists`);
        return;
      }

      const oldName = component.name;

      UndoQueue.instance.pushAndDo(
        new UndoActionGroup({
          label: `Move ${component.localName} into ${targetComponent.localName}`,
          do: () => {
            ProjectModel.instance?.renameComponent(component, newName);
          },
          undo: () => {
            ProjectModel.instance?.renameComponent(component, oldName);
          }
        })
      );
    }
  }, []);

  return {
    handleMakeHome,
    handleDelete,
    handleDuplicate,
    handleRename,
    performRename,
    handleOpen,
    handleDropOn,
    handleAddComponent,
    handleAddFolder
  };
}
