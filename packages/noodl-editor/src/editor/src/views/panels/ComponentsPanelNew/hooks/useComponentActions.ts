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
import { ToastLayer } from '../../../ToastLayer/ToastLayer';
import { TreeNode } from '../types';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PopupLayer = require('@noodl-views/popuplayer').default;

export interface UseComponentActionsOptions {
  /**
   * WFA-001 — the selected sheet's folder name (`#__cloud__`, `#Pages`, …), or
   * `''` for the default sheet / the "All" view.
   *
   * The tree hands these handlers **display** paths, which have had the sheet
   * prefix stripped (`useComponentsPanel.buildTreeFromProject`). Without this,
   * creating a component while a sheet is selected names it `/Home` instead of
   * `/#Pages/Home` — it lands in the default sheet and disappears from the view
   * it was created in — and dragging one into a folder yanks it out of its
   * sheet. Harmless-looking for `#Pages`; for `#__cloud__` it silently turns a
   * cloud function into a browser component that no backend will ever serve.
   */
  sheetPrefix?: string;
}

/**
 * WFA-001 — turn a tree display path into an absolute folder path.
 *
 * Always absolute and always trailing-slashed, so `path + localName` is a
 * component name in the same shape as every other producer of one
 * (`moveToSheet`, `handleAddFolder`). The old normalisation mapped root to `''`,
 * which produced components named `Home` with no leading slash.
 */
function toFolderPath(sheetPrefix: string, parentPath?: string): string {
  const relative = !parentPath || parentPath === '/' ? '/' : parentPath.startsWith('/') ? parentPath : '/' + parentPath;
  const joined = sheetPrefix + relative;
  return joined.endsWith('/') ? joined : joined + '/';
}

export function useComponentActions(options: UseComponentActionsOptions = {}) {
  const { sheetPrefix = '' } = options;
  const handleMakeHome = useCallback((node: TreeNode) => {
    // Support both component nodes and folder nodes (for component-folders)
    let component;
    if (node.type === 'component') {
      component = node.data.component;
    } else if (node.type === 'folder' && node.data.isComponentFolder && node.data.component) {
      component = node.data.component;
    } else {
      return;
    }

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

    // Use pushAndDo pattern - removeComponent handles its own undo internally
    UndoQueue.instance.pushAndDo(
      new UndoActionGroup({
        label: `Delete ${component.name}`,
        do: () => {
          const undoGroup = new UndoActionGroup({ label: `Delete ${component.name}` });
          UndoQueue.instance.push(undoGroup);
          ProjectModel.instance?.removeComponent(component, { undo: undoGroup });
        },
        undo: () => {
          // Undo is handled internally by removeComponent
        }
      })
    );
  }, []);

  const handleDuplicate = useCallback((node: TreeNode) => {
    // Support both component nodes and folder nodes (for component-folders)
    let component;
    if (node.type === 'component') {
      component = node.data.component;
    } else if (node.type === 'folder' && node.data.isComponentFolder && node.data.component) {
      component = node.data.component;
    } else {
      // TODO: Implement pure folder duplication
      console.log('Folder duplication not yet implemented');
      return;
    }
    let newName = component.name + ' Copy';

    // Find unique name
    let counter = 1;
    while (ProjectModel.instance?.getComponentWithName(newName)) {
      newName = `${component.name} Copy ${counter}`;
      counter++;
    }

    // Create undo group - duplicateComponent handles its own undo registration
    const undoGroup = new UndoActionGroup({
      label: `Duplicate ${component.localName}`
    });

    // Call duplicateComponent which internally registers undo actions
    ProjectModel.instance?.duplicateComponent(component, newName, {
      undo: undoGroup,
      rerouteComponentRefs: null
    });

    // Push the undo group after duplicate is done
    UndoQueue.instance.push(undoGroup);

    // Switch to the new component
    const duplicatedComponent = ProjectModel.instance?.getComponentWithName(newName);
    if (duplicatedComponent) {
      EventDispatcher.instance.notifyListeners('ComponentPanel.SwitchToComponent', {
        component: duplicatedComponent,
        pushHistory: true
      });
    }

    tracker.track('Component Duplicated');
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

      UndoQueue.instance.pushAndDo(
        new UndoActionGroup({
          label: `Rename ${component.localName} to ${newName}`,
          do: () => {
            ProjectModel.instance?.renameComponent(component, fullNewName);
          },
          undo: () => {
            ProjectModel.instance?.renameComponent(component, oldName);
          }
        })
      );

      return true;
    } else if (node.type === 'folder') {
      // WFA-001: display path → real component path (see `handleDropOn`).
      const oldPath = sheetPrefix + node.data.path;
      const parentPath = oldPath.substring(0, oldPath.lastIndexOf('/'));
      const newPath = `${parentPath}/${newName}`;

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
  }, [sheetPrefix]);

  const handleOpen = useCallback((node: TreeNode) => {
    // Support both component nodes and folder nodes (for component-folders)
    let component;
    if (node.type === 'component') {
      component = node.data.component;
    } else if (node.type === 'folder' && node.data.isComponentFolder && node.data.component) {
      component = node.data.component;
    } else {
      return;
    }

    // Open component in NodeGraphEditor by dispatching event
    if (component) {
      EventDispatcher.instance.notifyListeners('ComponentPanel.SwitchToComponent', {
        component,
        pushHistory: true
      });
    }
  }, []);

  /**
   * Handle dropping an item onto a target
   */
  /**
   * Handle adding a new component using a template
   */
  const handleAddComponent = useCallback(
    (template: TSFixme, parentPath?: string) => {
      const finalParentPath = toFolderPath(sheetPrefix, parentPath);

      const popup = template.createPopup({
        onCreate: (localName: string, options?: TSFixme) => {
          const componentName = finalParentPath + localName;

          // Validate name
          if (!localName || localName.trim() === '') {
            ToastLayer.showError('Component name cannot be empty');
            return;
          }

          /**
           * SPR-005 — the template's own rule about what it may be called.
           *
           * Only the cloud function template declares one, and it has to: its
           * name is the URL path segment its backend serves it on. CWF-004 S6's
           * gesture has always held itself to that regex; this door did not, so
           * the two could produce functions of which only one was addressable.
           */
          const nameError = template?.validateLocalName?.(localName);
          if (nameError) {
            ToastLayer.showError(nameError);
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
        position: 'screen-center',
        isBackgroundDimmed: true
      });
    },
    [sheetPrefix]
  );

  /**
   * Handle adding a new folder
   */
  const handleAddFolder = useCallback((parentPath?: string) => {
    // WFA-001: resolved before the popup so the sheet in force when the menu was
    // opened is the one the folder lands in.
    const normalizedPath = toFolderPath(sheetPrefix, parentPath);

    const popup = new PopupLayer.StringInputPopup({
      label: 'New folder name',
      okLabel: 'Add',
      cancelLabel: 'Cancel',
      placeholder: 'e.g. Screens',
      onOk: (folderName: string) => {
        // Validate name
        if (!folderName || folderName.trim() === '') {
          ToastLayer.showError('Folder name cannot be empty');
          return;
        }

        // Create folder path - component names MUST start with /
        const folderPath = `${normalizedPath}${folderName}`;

        // Check if folder already exists (any component starts with this path)
        const folderExists = ProjectModel.instance
          ?.getComponents()
          .some((comp) => comp.name.startsWith(folderPath + '/'));

        if (folderExists) {
          ToastLayer.showError('A folder with this name already exists');
          return;
        }

        // Create a placeholder component to make the folder visible
        // The placeholder will be at {folderPath}/.placeholder
        const placeholderName = `${folderPath}/.placeholder`;

        UndoQueue.instance.pushAndDo(
          new UndoActionGroup({
            label: `Create folder ${folderName}`,
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

        PopupLayer.instance.hidePopup();
      }
    });
    popup.render();

    PopupLayer.instance.showPopup({
      content: popup,
      position: 'screen-center',
      isBackgroundDimmed: true
    });
  }, [sheetPrefix]);

  /**
   * Handle dropping an item onto the root level (empty space)
   */
  const handleDropOnRoot = useCallback((draggedItem: TreeNode) => {
    // Component → Root
    if (draggedItem.type === 'component') {
      const component = draggedItem.data.component;
      // WFA-001: "root" means the root *of the current sheet*. Without the
      // prefix, dropping a cloud function on empty space moves it out of
      // `#__cloud__` and it silently stops being a function.
      const newName = sheetPrefix + '/' + component.localName;

      // Check if already at root
      if (component.name === newName) {
        console.log('Component already at root level');
        PopupLayer.instance.dragCompleted();
        return;
      }

      // Check for naming conflicts
      if (ProjectModel.instance?.getComponentWithName(newName)) {
        alert(`Component "${newName}" already exists at root level`);
        PopupLayer.instance.dragCompleted();
        return;
      }

      const oldName = component.name;

      // End drag operation FIRST - before the rename triggers a re-render
      PopupLayer.instance.dragCompleted();

      UndoQueue.instance.pushAndDo(
        new UndoActionGroup({
          label: `Move ${component.localName} to root`,
          do: () => {
            ProjectModel.instance?.renameComponent(component, newName);
          },
          undo: () => {
            ProjectModel.instance?.renameComponent(component, oldName);
          }
        })
      );
    }
    // Folder → Root (including component-folders)
    else if (draggedItem.type === 'folder') {
      // WFA-001: the tree's folder paths are display paths — on a sheet they
      // have had the sheet prefix stripped, so matching real component names
      // against them found nothing and the drag was a silent no-op.
      const sourcePath = sheetPrefix + draggedItem.data.path;
      const newPath = sheetPrefix + '/' + draggedItem.data.name;

      // Check if already at root
      if (sourcePath === newPath) {
        console.log('Folder already at root level');
        PopupLayer.instance.dragCompleted();
        return;
      }

      // Get all components in source folder (including the folder's component if it exists)
      const componentsToMove = ProjectModel.instance
        ?.getComponents()
        .filter((comp) => comp.name === sourcePath || comp.name.startsWith(sourcePath + '/'));

      if (!componentsToMove || componentsToMove.length === 0) {
        console.log('Folder is empty, nothing to move');
        PopupLayer.instance.dragCompleted();
        return;
      }

      const renames: Array<{ component: TSFixme; oldName: string; newName: string }> = [];

      componentsToMove.forEach((comp) => {
        let newName: string;
        if (comp.name === sourcePath) {
          // This is the component-folder itself
          newName = newPath;
        } else {
          // This is a nested component
          const relativePath = comp.name.substring(sourcePath.length);
          newName = newPath + relativePath;
        }
        renames.push({ component: comp, oldName: comp.name, newName });
      });

      // End drag operation FIRST - before the rename triggers a re-render
      PopupLayer.instance.dragCompleted();

      UndoQueue.instance.pushAndDo(
        new UndoActionGroup({
          label: `Move ${draggedItem.data.name} to root`,
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
  }, [sheetPrefix]);

  /**
   * Handle dropping an item onto a target
   *
   * WFA-001: every path taken from a `TreeNode` here is a **display** path, so
   * each is resolved back to a real component name with the sheet prefix.
   */
  const handleDropOn = useCallback((draggedItem: TreeNode, targetItem: TreeNode) => {
    // Component → Folder
    if (draggedItem.type === 'component' && targetItem.type === 'folder') {
      const component = draggedItem.data.component;
      const targetPath = sheetPrefix + (targetItem.data.path === '/' ? '' : targetItem.data.path);
      const newName = targetPath ? `${targetPath}/${component.localName}` : `/${component.localName}`;

      // Check for naming conflicts
      if (ProjectModel.instance?.getComponentWithName(newName)) {
        alert(`Component "${newName}" already exists in that folder`);
        return;
      }

      const oldName = component.name;

      // Note: dragCompleted() now called by ComponentItem.handleMouseUp before this action

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
      const sourcePath = sheetPrefix + draggedItem.data.path;
      const targetPath = sheetPrefix + (targetItem.data.path === '/' ? '' : targetItem.data.path);
      const newPath = `${targetPath}/${draggedItem.data.name}`;

      // Prevent moving folder into itself
      if (targetPath.startsWith(sourcePath + '/') || targetPath === sourcePath) {
        alert('Cannot move folder into itself');
        return;
      }

      // Get all components in source folder (including the folder's component if it exists)
      const componentsToMove = ProjectModel.instance
        ?.getComponents()
        .filter((comp) => comp.name === sourcePath || comp.name.startsWith(sourcePath + '/'));

      if (!componentsToMove || componentsToMove.length === 0) {
        console.log('Folder is empty, nothing to move');
        return;
      }

      const renames: Array<{ component: TSFixme; oldName: string; newName: string }> = [];

      componentsToMove.forEach((comp) => {
        let newName: string;
        if (comp.name === sourcePath) {
          // This is the component-folder itself
          newName = newPath;
        } else {
          // This is a nested component
          const relativePath = comp.name.substring(sourcePath.length);
          newName = newPath + relativePath;
        }
        renames.push({ component: comp, oldName: comp.name, newName });
      });

      // Note: dragCompleted() now called by FolderItem.handleMouseUp before this action

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

      // Note: dragCompleted() now called by ComponentItem.handleMouseUp before this action

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
    // Folder → Component (treat component-folder AS a component, nest inside target)
    else if (draggedItem.type === 'folder' && targetItem.type === 'component') {
      const sourcePath = sheetPrefix + draggedItem.data.path;
      const targetComponent = targetItem.data.component;
      const newPath = `${targetComponent.name}/${draggedItem.data.name}`;

      // Get all components in source folder (including the folder's component if it exists)
      const componentsToMove = ProjectModel.instance
        ?.getComponents()
        .filter((comp) => comp.name === sourcePath || comp.name.startsWith(sourcePath + '/'));

      if (!componentsToMove || componentsToMove.length === 0) {
        console.log('Folder is empty, nothing to move');
        return;
      }

      const renames: Array<{ component: TSFixme; oldName: string; newName: string }> = [];

      componentsToMove.forEach((comp) => {
        let newName: string;
        if (comp.name === sourcePath) {
          // This is the component-folder itself
          newName = newPath;
        } else {
          // This is a nested component
          const relativePath = comp.name.substring(sourcePath.length);
          newName = newPath + relativePath;
        }
        renames.push({ component: comp, oldName: comp.name, newName });
      });

      // Check for conflicts
      const hasConflict = renames.some(({ newName }) => ProjectModel.instance?.getComponentWithName(newName));

      if (hasConflict) {
        alert(`Some components would conflict with existing names`);
        return;
      }

      // Note: dragCompleted() now called by ComponentItem.handleMouseUp before this action

      UndoQueue.instance.pushAndDo(
        new UndoActionGroup({
          label: `Move ${draggedItem.data.name} into ${targetComponent.localName}`,
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
  }, [sheetPrefix]);

  return {
    handleMakeHome,
    handleDelete,
    handleDuplicate,
    handleRename,
    performRename,
    handleOpen,
    handleDropOn,
    handleDropOnRoot,
    handleAddComponent,
    handleAddFolder
  };
}
