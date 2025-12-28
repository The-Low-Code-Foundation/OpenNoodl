/**
 * useDragDrop
 *
 * Manages drag-drop state and operations for components/folders.
 * Integrates with PopupLayer.startDragging system.
 */

import { useCallback, useState } from 'react';

import { TreeNode } from '../types';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PopupLayer = require('@noodl-views/popuplayer');

export function useDragDrop() {
  const [draggedItem, setDraggedItem] = useState<TreeNode | null>(null);
  const [dropTarget, setDropTarget] = useState<TreeNode | null>(null);

  /**
   * Start dragging an item
   */
  const startDrag = useCallback((item: TreeNode, sourceElement: HTMLElement) => {
    setDraggedItem(item);

    const label = item.type === 'component' ? item.data.localName : `📁 ${item.data.name}`;

    PopupLayer.instance.startDragging({
      label,
      type: item.type,
      dragTarget: sourceElement,
      component: item.type === 'component' ? item.data.component : undefined,
      folder: item.type === 'folder' ? item.data : undefined,
      onDragEnd: () => {
        setDraggedItem(null);
        setDropTarget(null);
      }
    });
  }, []);

  /**
   * Check if an item can be dropped on a target
   */
  const canDrop = useCallback(
    (target: TreeNode): boolean => {
      if (!draggedItem) return false;

      // Can't drop on self
      if (draggedItem.type === 'component' && target.type === 'component') {
        if (draggedItem.data.id === target.data.id) return false;
      }
      if (draggedItem.type === 'folder' && target.type === 'folder') {
        if (draggedItem.data.path === target.data.path) return false;
      }

      // Folder-specific rules
      if (draggedItem.type === 'folder' && target.type === 'folder') {
        // Can't drop folder into its own children (descendant check)
        const draggedPath = draggedItem.data.path;
        const targetPath = target.data.path;

        if (targetPath.startsWith(draggedPath + '/')) {
          return false; // Target is a descendant of dragged folder
        }
      }

      return true;
    },
    [draggedItem]
  );

  /**
   * Handle drop on a target
   */
  const handleDrop = useCallback(
    (target: TreeNode) => {
      if (!draggedItem || !canDrop(target)) return;

      setDropTarget(target);

      // Drop will be executed by parent component
      // which has access to ProjectModel and UndoQueue
    },
    [draggedItem, canDrop]
  );

  /**
   * Clear drop state
   */
  const clearDrop = useCallback(() => {
    setDropTarget(null);
  }, []);

  return {
    draggedItem,
    dropTarget,
    startDrag,
    canDrop,
    handleDrop,
    clearDrop
  };
}
