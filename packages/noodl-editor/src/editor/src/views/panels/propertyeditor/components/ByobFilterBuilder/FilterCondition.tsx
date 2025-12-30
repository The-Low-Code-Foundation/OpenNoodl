/**
 * FilterCondition Component
 *
 * A single filter condition row: Field | Operator | Value
 * Supports drag & drop to move conditions between groups.
 */

import React, { useCallback, useMemo, useState } from 'react';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { IconButton, IconButtonVariant } from '@noodl-core-ui/components/inputs/IconButton';
import { Select, SelectColorTheme } from '@noodl-core-ui/components/inputs/Select';
import { TextInput } from '@noodl-core-ui/components/inputs/TextInput';
import { Box } from '@noodl-core-ui/components/layout/Box';

import css from './ByobFilterBuilder.module.scss';
import { useDragContext } from './DragContext';
import { getOperatorsForType, operatorNeedsValue, operatorNeedsTwoValues } from './operators';
import { FieldType, FilterCondition as FilterConditionType, FilterOperator, SchemaField } from './types';

export interface FilterConditionProps {
  condition: FilterConditionType;
  fields: SchemaField[];
  onChange: (condition: FilterConditionType) => void;
  onDelete: () => void;
  /** The ID of the parent group containing this condition */
  parentGroupId?: string;
}

export function FilterCondition({ condition, fields, onChange, onDelete, parentGroupId }: FilterConditionProps) {
  const { dragState, setDraggedItem } = useDragContext();
  const [isDragging, setIsDragging] = useState(false);

  // Is this condition being dragged?
  const isBeingDragged = dragState.draggedItem?.id === condition.id;

  // Drag handlers
  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.stopPropagation();
      setDraggedItem(condition, parentGroupId || null);
      setIsDragging(true);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', condition.id);
    },
    [condition, parentGroupId, setDraggedItem]
  );

  const handleDragEnd = useCallback(
    (e: React.DragEvent) => {
      e.stopPropagation();
      setDraggedItem(null, null);
      setIsDragging(false);
    },
    [setDraggedItem]
  );

  // Get the selected field's type
  const selectedField = useMemo(() => {
    return fields.find((f) => f.name === condition.field);
  }, [fields, condition.field]);

  const fieldType: FieldType = selectedField?.type || 'string';

  // Get available operators for this field type
  const availableOperators = useMemo(() => {
    return getOperatorsForType(fieldType);
  }, [fieldType]);

  // Handle field change
  const handleFieldChange = useCallback(
    (value: string) => {
      const newField = fields.find((f) => f.name === value);
      const newType = newField?.type || 'string';

      // Reset operator if not valid for new type
      const newOperators = getOperatorsForType(newType);
      const isOperatorValid = newOperators.some((op) => op.value === condition.operator);

      onChange({
        ...condition,
        field: value,
        operator: isOperatorValid ? condition.operator : '_eq',
        value: '' // Reset value when field changes
      });
    },
    [condition, fields, onChange]
  );

  // Handle operator change
  const handleOperatorChange = useCallback(
    (value: string) => {
      const newOperator = value as FilterOperator;
      const needsValue = operatorNeedsValue(newOperator);
      const needsTwoValues = operatorNeedsTwoValues(newOperator);

      let newValue = condition.value;

      // Reset value based on operator requirements
      if (!needsValue) {
        newValue = null;
      } else if (needsTwoValues && !Array.isArray(condition.value)) {
        newValue = ['', ''];
      } else if (!needsTwoValues && Array.isArray(condition.value)) {
        newValue = '';
      }

      onChange({
        ...condition,
        operator: newOperator,
        value: newValue
      });
    },
    [condition, onChange]
  );

  // Handle value change
  const handleValueChange = useCallback(
    (value: string) => {
      onChange({
        ...condition,
        value: value
      });
    },
    [condition, onChange]
  );

  // Handle between value changes
  const handleBetweenValueChange = useCallback(
    (index: number, value: string) => {
      const currentValue = Array.isArray(condition.value) ? condition.value : ['', ''];
      const newValue = [...currentValue];
      newValue[index] = value;
      onChange({
        ...condition,
        value: newValue as [string, string]
      });
    },
    [condition, onChange]
  );

  const needsValue = operatorNeedsValue(condition.operator);
  const needsTwoValues = operatorNeedsTwoValues(condition.operator);

  // Field options for dropdown
  const fieldOptions = useMemo(() => {
    return [
      { label: '(Select field)', value: '' },
      ...fields.map((f) => ({
        label: f.displayName || f.name,
        value: f.name
      }))
    ];
  }, [fields]);

  // Operator options for dropdown
  const operatorOptions = useMemo(() => {
    return availableOperators.map((op) => ({
      label: op.label,
      value: op.value
    }));
  }, [availableOperators]);

  // Build class names
  const conditionClassName = [css.FilterCondition, isBeingDragged || isDragging ? css.FilterConditionDragging : '']
    .filter(Boolean)
    .join(' ');

  return (
    <Box hasXSpacing={1} hasYSpacing={1} UNSAFE_className={conditionClassName}>
      <div className={css.FilterConditionFields}>
        {/* Drag Handle */}
        <div
          className={css.FilterConditionDragHandle}
          draggable
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          title="Drag to move into another group"
        >
          <Icon icon={IconName.Grip} size={IconSize.Small} />
        </div>

        {/* Field Selector */}
        <Select
          value={condition.field}
          options={fieldOptions}
          onChange={handleFieldChange}
          colorTheme={SelectColorTheme.Dark}
          UNSAFE_className={css.FilterConditionField}
        />

        {/* Operator Selector */}
        <Select
          value={condition.operator}
          options={operatorOptions}
          onChange={handleOperatorChange}
          colorTheme={SelectColorTheme.Dark}
          UNSAFE_className={css.FilterConditionOperator}
        />

        {/* Value Input - Single value */}
        {needsValue && !needsTwoValues && (
          <TextInput
            value={String(condition.value ?? '')}
            onChange={(e) => handleValueChange(e.target.value)}
            placeholder="Value"
            UNSAFE_className={css.FilterConditionValue}
          />
        )}

        {/* Between: Two value inputs */}
        {needsTwoValues && (
          <>
            <TextInput
              value={String(Array.isArray(condition.value) ? condition.value[0] : '')}
              onChange={(e) => handleBetweenValueChange(0, e.target.value)}
              placeholder="From"
              UNSAFE_className={css.FilterConditionValueSmall}
            />
            <span className={css.FilterConditionBetweenLabel}>and</span>
            <TextInput
              value={String(Array.isArray(condition.value) ? condition.value[1] : '')}
              onChange={(e) => handleBetweenValueChange(1, e.target.value)}
              placeholder="To"
              UNSAFE_className={css.FilterConditionValueSmall}
            />
          </>
        )}

        {/* Delete Button */}
        <IconButton
          icon={IconName.Trash}
          size={IconSize.Small}
          variant={IconButtonVariant.Transparent}
          onClick={onDelete}
          UNSAFE_className={css.FilterConditionDelete}
        />
      </div>
    </Box>
  );
}
