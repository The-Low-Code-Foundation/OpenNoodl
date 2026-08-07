/**
 * Drag Context for Filter Builder
 *
 * Provides drag & drop state management for moving groups between parents.
 */

import React, { createContext, useCallback, useContext, useState } from 'react';

import { FilterGroup as FilterGroupType, FilterItem, isFilterGroup } from './types';

export interface DragState {
  /** The item currently being dragged */
  draggedItem: FilterItem | null;
  /** The ID of the group that contains the dragged item */
  sourceGroupId: string | null;
}

export interface DragContextValue {
  dragState: DragState;
  setDraggedItem: (item: FilterItem | null, sourceGroupId: string | null) => void;
  moveItem: (targetGroupId: string) => void;
  /** Root filter for finding items */
  rootFilter: FilterGroupType | null;
  setRootFilter: (filter: FilterGroupType | null) => void;
  onFilterChange: ((filter: FilterGroupType) => void) | null;
}

const DragContext = createContext<DragContextValue>({
  dragState: { draggedItem: null, sourceGroupId: null },
  setDraggedItem: () => {},
  moveItem: () => {},
  rootFilter: null,
  setRootFilter: () => {},
  onFilterChange: null
});

export function useDragContext() {
  return useContext(DragContext);
}

interface DragProviderProps {
  children: React.ReactNode;
  rootFilter: FilterGroupType | null;
  onFilterChange: (filter: FilterGroupType) => void;
}

export function DragProvider({ children, rootFilter, onFilterChange }: DragProviderProps) {
  const [dragState, setDragState] = useState<DragState>({
    draggedItem: null,
    sourceGroupId: null
  });

  const setDraggedItem = useCallback((item: FilterItem | null, sourceGroupId: string | null) => {
    setDragState({ draggedItem: item, sourceGroupId });
  }, []);

  /**
   * Find a group by ID in the filter tree
   */
  const findGroupById = useCallback((id: string, group: FilterGroupType | null): FilterGroupType | null => {
    if (!group) return null;
    if (group.id === id) return group;

    for (const item of group.conditions) {
      if (isFilterGroup(item)) {
        const found = findGroupById(id, item);
        if (found) return found;
      }
    }
    return null;
  }, []);

  /**
   * Remove an item from a group by ID (returns new filter)
   */
  const removeItemFromTree = useCallback((filter: FilterGroupType, itemId: string): FilterGroupType => {
    return {
      ...filter,
      conditions: filter.conditions
        .filter((item) => item.id !== itemId)
        .map((item) => {
          if (isFilterGroup(item)) {
            return removeItemFromTree(item, itemId);
          }
          return item;
        })
    };
  }, []);

  /**
   * Add an item to a group by ID (returns new filter)
   */
  const addItemToGroup = useCallback(
    (filter: FilterGroupType, targetGroupId: string, item: FilterItem): FilterGroupType => {
      if (filter.id === targetGroupId) {
        return {
          ...filter,
          conditions: [...filter.conditions, item]
        };
      }

      return {
        ...filter,
        conditions: filter.conditions.map((cond) => {
          if (isFilterGroup(cond)) {
            return addItemToGroup(cond, targetGroupId, item);
          }
          return cond;
        })
      };
    },
    []
  );

  /**
   * Check if targetId is a descendant of sourceId (prevent circular nesting)
   */
  const isDescendant = useCallback((sourceGroup: FilterGroupType, targetId: string): boolean => {
    for (const item of sourceGroup.conditions) {
      if (item.id === targetId) return true;
      if (isFilterGroup(item) && isDescendant(item, targetId)) return true;
    }
    return false;
  }, []);

  /**
   * Move the dragged item to a target group
   */
  const moveItem = useCallback(
    (targetGroupId: string) => {
      if (!dragState.draggedItem || !rootFilter || !onFilterChange) return;

      // Can't drop on itself
      if (dragState.draggedItem.id === targetGroupId) return;

      // Can't drop on the same parent
      if (dragState.sourceGroupId === targetGroupId) return;

      // If dragging a group, can't drop into a descendant (circular nesting)
      if (isFilterGroup(dragState.draggedItem)) {
        if (isDescendant(dragState.draggedItem, targetGroupId)) {
          console.warn('[DragContext] Cannot drop a group into its own descendant');
          return;
        }
      }

      // Perform the move
      let newFilter = removeItemFromTree(rootFilter, dragState.draggedItem.id);
      newFilter = addItemToGroup(newFilter, targetGroupId, dragState.draggedItem);

      onFilterChange(newFilter);
      setDragState({ draggedItem: null, sourceGroupId: null });
    },
    [dragState, rootFilter, onFilterChange, removeItemFromTree, addItemToGroup, isDescendant]
  );

  const contextValue: DragContextValue = {
    dragState,
    setDraggedItem,
    moveItem,
    rootFilter,
    setRootFilter: () => {}, // Not used directly
    onFilterChange
  };

  return <DragContext.Provider value={contextValue}>{children}</DragContext.Provider>;
}
