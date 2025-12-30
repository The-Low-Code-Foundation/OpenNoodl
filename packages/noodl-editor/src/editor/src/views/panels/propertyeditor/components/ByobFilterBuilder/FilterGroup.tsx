/**
 * FilterGroup Component
 *
 * A recursive AND/OR group container for filter conditions.
 * Supports unlimited nesting of groups via drag & drop.
 */

import React, { useCallback, useState } from 'react';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { IconButton, IconButtonVariant } from '@noodl-core-ui/components/inputs/IconButton';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { ConfirmationDialog } from '@noodl-core-ui/components/popups/ConfirmationDialog';

import css from './ByobFilterBuilder.module.scss';
import { useDragContext } from './DragContext';
import { FilterCondition } from './FilterCondition';
import {
  createEmptyCondition,
  FilterCombinator,
  FilterCondition as FilterConditionType,
  FilterGroup as FilterGroupType,
  FilterItem,
  generateId,
  isFilterGroup,
  SchemaField
} from './types';

export interface FilterGroupProps {
  group: FilterGroupType;
  fields: SchemaField[];
  onChange: (group: FilterGroupType) => void;
  onDelete?: () => void;
  isRoot?: boolean;
  depth?: number;
  parentGroupId?: string;
}

export function FilterGroup({
  group,
  fields,
  onChange,
  onDelete,
  isRoot = false,
  depth = 0,
  parentGroupId
}: FilterGroupProps) {
  const { dragState, setDraggedItem, moveItem } = useDragContext();
  const [isDragOver, setIsDragOver] = useState(false);

  // Delete confirmation state
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Is this group being dragged?
  const isDragging = dragState.draggedItem?.id === group.id;

  // Can this group accept a drop?
  const canAcceptDrop =
    dragState.draggedItem !== null && dragState.draggedItem.id !== group.id && dragState.sourceGroupId !== group.id;

  // Toggle between AND/OR
  const handleToggleCombinator = useCallback(() => {
    const newType: FilterCombinator = group.type === 'and' ? 'or' : 'and';
    onChange({
      ...group,
      type: newType
    });
  }, [group, onChange]);

  // Add a new condition
  const handleAddCondition = useCallback(() => {
    const newCondition = createEmptyCondition();
    onChange({
      ...group,
      conditions: [...group.conditions, newCondition]
    });
  }, [group, onChange]);

  // Add a nested group
  const handleAddGroup = useCallback(() => {
    const newGroup: FilterGroupType = {
      id: generateId(),
      type: group.type === 'and' ? 'or' : 'and', // Opposite type for variety
      conditions: []
    };
    onChange({
      ...group,
      conditions: [...group.conditions, newGroup]
    });
  }, [group, onChange]);

  // Update a condition
  const handleConditionChange = useCallback(
    (index: number, updatedItem: FilterItem) => {
      const newConditions = [...group.conditions];
      newConditions[index] = updatedItem;
      onChange({
        ...group,
        conditions: newConditions
      });
    },
    [group, onChange]
  );

  // Helper to count total items in a group (recursively)
  const countGroupItems = useCallback((g: FilterGroupType): number => {
    let count = g.conditions.length;
    for (const item of g.conditions) {
      if (isFilterGroup(item)) {
        count += countGroupItems(item);
      }
    }
    return count;
  }, []);

  // Delete a condition - checks if it's a group with children and shows confirmation
  const handleRequestDelete = useCallback(
    (index: number) => {
      const item = group.conditions[index];
      // If it's a group with children, show confirmation
      if (isFilterGroup(item) && item.conditions.length > 0) {
        setPendingDeleteIndex(index);
        setShowDeleteConfirm(true);
      } else {
        // Delete directly (single condition or empty group)
        const newConditions = group.conditions.filter((_, i) => i !== index);
        onChange({
          ...group,
          conditions: newConditions
        });
      }
    },
    [group, onChange]
  );

  // Confirm deletion of a group with children
  const handleConfirmDelete = useCallback(() => {
    if (pendingDeleteIndex !== null) {
      const newConditions = group.conditions.filter((_, i) => i !== pendingDeleteIndex);
      onChange({
        ...group,
        conditions: newConditions
      });
    }
    setPendingDeleteIndex(null);
    setShowDeleteConfirm(false);
  }, [group, onChange, pendingDeleteIndex]);

  // Cancel deletion
  const handleCancelDelete = useCallback(() => {
    setPendingDeleteIndex(null);
    setShowDeleteConfirm(false);
  }, []);

  // Get info about pending delete item for the confirmation message
  const getPendingDeleteInfo = useCallback(() => {
    if (pendingDeleteIndex === null) return { count: 0 };
    const item = group.conditions[pendingDeleteIndex];
    if (isFilterGroup(item)) {
      return { count: countGroupItems(item) };
    }
    return { count: 0 };
  }, [pendingDeleteIndex, group.conditions, countGroupItems]);

  // Drag handlers
  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.stopPropagation();
      setDraggedItem(group, parentGroupId || null);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', group.id);
    },
    [group, parentGroupId, setDraggedItem]
  );

  const handleDragEnd = useCallback(
    (e: React.DragEvent) => {
      e.stopPropagation();
      setDraggedItem(null, null);
      setIsDragOver(false);
    },
    [setDraggedItem]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (canAcceptDrop) {
        e.dataTransfer.dropEffect = 'move';
        setIsDragOver(true);
      }
    },
    [canAcceptDrop]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (canAcceptDrop) {
        moveItem(group.id);
      }
    },
    [canAcceptDrop, group.id, moveItem]
  );

  const hasConditions = group.conditions.length > 0;

  // Build class names
  const groupClassName = [
    css.FilterGroup,
    isRoot ? css.FilterGroupRoot : '',
    isDragging ? css.FilterGroupDragging : '',
    isDragOver && canAcceptDrop ? css.FilterGroupDragOver : ''
  ]
    .filter(Boolean)
    .join(' ');

  const deleteInfo = getPendingDeleteInfo();

  return (
    <>
      <div
        className={groupClassName}
        data-depth={depth}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Group Header */}
        <div className={css.FilterGroupHeader}>
          <div className={css.FilterGroupHeaderLeft}>
            {/* Drag Handle (only for non-root groups) */}
            {!isRoot && (
              <div
                className={css.FilterGroupDragHandle}
                draggable
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                title="Drag to move into another group"
              >
                <Icon icon={IconName.Grip} size={IconSize.Small} />
              </div>
            )}

            <button className={css.FilterGroupCombinator} onClick={handleToggleCombinator} type="button">
              {group.type.toUpperCase()}
            </button>
          </div>

          {!isRoot && onDelete && (
            <IconButton
              icon={IconName.Close}
              size={IconSize.Small}
              variant={IconButtonVariant.Transparent}
              onClick={onDelete}
              UNSAFE_className={css.FilterGroupDelete}
            />
          )}
        </div>

        {/* Drop Zone Indicator */}
        {isDragOver && canAcceptDrop && (
          <div className={css.FilterGroupDropIndicator}>Drop here to nest inside this group</div>
        )}

        {/* Conditions */}
        <div className={css.FilterGroupConditions}>
          {group.conditions.map((item, index) => (
            <React.Fragment key={item.id}>
              {/* Combinator label between conditions */}
              {index > 0 && <div className={css.FilterGroupCombinatorLabel}>{group.type.toUpperCase()}</div>}

              {isFilterGroup(item) ? (
                // Nested group
                <FilterGroup
                  group={item}
                  fields={fields}
                  onChange={(updated) => handleConditionChange(index, updated)}
                  onDelete={() => handleRequestDelete(index)}
                  depth={depth + 1}
                  parentGroupId={group.id}
                />
              ) : (
                // Single condition
                <FilterCondition
                  condition={item as FilterConditionType}
                  fields={fields}
                  onChange={(updated) => handleConditionChange(index, updated)}
                  onDelete={() => handleRequestDelete(index)}
                  parentGroupId={group.id}
                />
              )}
            </React.Fragment>
          ))}

          {/* Empty state */}
          {!hasConditions && (
            <div className={css.FilterGroupEmpty}>No conditions. Add a filter rule to get started.</div>
          )}
        </div>

        {/* Action Buttons */}
        <Box hasXSpacing={1} hasYSpacing={1}>
          <div className={css.FilterGroupActions}>
            <PrimaryButton
              label="Add Condition"
              size={PrimaryButtonSize.Small}
              variant={PrimaryButtonVariant.MutedOnLowBg}
              onClick={handleAddCondition}
            />
            <PrimaryButton
              label="Add Group"
              size={PrimaryButtonSize.Small}
              variant={PrimaryButtonVariant.MutedOnLowBg}
              onClick={handleAddGroup}
            />
          </div>
        </Box>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isVisible={showDeleteConfirm}
        title="Delete Group?"
        message={`This group contains ${deleteInfo.count} item${
          deleteInfo.count !== 1 ? 's' : ''
        } (conditions and/or nested groups). Deleting this group will also delete all items inside it. This action cannot be undone.`}
        confirmButtonLabel="Delete Group"
        cancelButtonLabel="Cancel"
        isDangerousAction
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </>
  );
}
