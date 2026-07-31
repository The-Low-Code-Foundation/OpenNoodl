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
import {
  getOperatorDefinition,
  getOperatorLabel,
  getOperatorsForType,
  operatorNeedsValue,
  operatorNeedsTwoValues
} from './operators';
import {
  DEFAULT_VALUE_PORT_PREFIX,
  FieldType,
  FilterCondition as FilterConditionType,
  FilterOperator,
  OperatorCapabilities,
  SchemaField,
  SchemaRelation,
  generateFilterPortName,
  operatorKeyOf
} from './types';

export interface FilterConditionProps {
  condition: FilterConditionType;
  fields: SchemaField[];
  onChange: (condition: FilterConditionType) => void;
  onDelete: () => void;
  /** The ID of the parent group containing this condition */
  parentGroupId?: string;
  /** What the chosen backend can express. Omitted offers everything. */
  capabilities?: OperatorCapabilities;
  /** Prefix for a connected value's input port. */
  valuePortPrefix?: string;
  /** Relations that can be filtered on, when the backend has any. */
  relations?: SchemaRelation[];
}

export function FilterCondition({
  condition,
  fields,
  onChange,
  onDelete,
  parentGroupId,
  capabilities,
  valuePortPrefix = DEFAULT_VALUE_PORT_PREFIX,
  relations
}: FilterConditionProps) {
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
    return getOperatorsForType(fieldType, capabilities);
  }, [fieldType, capabilities]);

  // Handle field change
  const handleFieldChange = useCallback(
    (value: string) => {
      const newField = fields.find((f) => f.name === value);
      const newType = newField?.type || 'string';

      // Reset operator if not valid for new type
      const newOperators = getOperatorsForType(newType, capabilities);
      const isOperatorValid = newOperators.some((op) => op.key === operatorKeyOf(condition));
      // A Pointer column's only real question is which record it points at, so
      // choosing one selects `pointsTo` the way `QueryEditor` did rather than
      // leaving `equalTo` selected on a value nobody can type.
      const fallback: FilterOperator = newType === 'pointer' ? 'pointsTo' : 'equalTo';

      const next = {
        ...condition,
        field: value,
        operator: isOperatorValid ? condition.operator : fallback,
        value: '' // Reset value when field changes
      };

      // Connected port names embed the field name — regenerate on field change.
      // ⚠️ This renames the port, which drops any wire attached to it. That is
      // the pre-existing behaviour and it is defensible on a field change (the
      // rule now asks a different question), but it is why a *migration* must
      // never take this path — see `visualQueryToSaved`.
      if (next.valueSource === 'connected') {
        next.valuePortName = generateFilterPortName(next, valuePortPrefix);
      }

      onChange(next);
    },
    [capabilities, condition, fields, onChange, valuePortPrefix]
  );

  // Toggle between typing a value and exposing it as a node input port
  const handleToggleValueSource = useCallback(() => {
    if (condition.valueSource === 'connected') {
      onChange({ ...condition, valueSource: 'static', valuePortName: undefined });
    } else {
      onChange({
        ...condition,
        valueSource: 'connected',
        valuePortName: generateFilterPortName(condition, valuePortPrefix)
      });
    }
  }, [condition, onChange, valuePortPrefix]);

  // Rename the input port a connected value arrives on.
  //
  // `QueryEditor` let the user type this name, and two rules naming the same
  // one shared a single port — a real affordance that auto-generated names do
  // not have. Kept for everybody rather than only for the filters that used to
  // have it.
  const handlePortNameChange = useCallback(
    (value: string) => {
      const slug = value.replace(/[^a-zA-Z0-9_-]/g, '_');
      onChange({ ...condition, valuePortName: slug ? valuePortPrefix + slug : undefined });
    },
    [condition, onChange, valuePortPrefix]
  );

  // Relation rule: which collection's relation is being asked about
  const handleRelationClassChange = useCallback(
    (value: string) => {
      const properties = relations?.find((r) => r.className === value)?.properties ?? [];
      onChange({
        ...condition,
        relationClass: value,
        // One relation property is the common case, so choosing the collection
        // finishes the rule rather than leaving a second empty dropdown.
        relationProperty: properties.length === 1 ? properties[0] : undefined
      });
    },
    [condition, onChange, relations]
  );

  const handleRelationPropertyChange = useCallback(
    (value: string) => onChange({ ...condition, relationProperty: value }),
    [condition, onChange]
  );

  // Handle operator change
  const handleOperatorChange = useCallback(
    (key: string) => {
      const definition = getOperatorDefinition(key);
      const needsValue = operatorNeedsValue(key);
      const needsTwoValues = operatorNeedsTwoValues(key);

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
        operator: definition.value,
        // The two presence rows are one operator carrying a boolean, so the
        // row's own value wins over whatever was typed for the previous one.
        value: definition.presetValue !== undefined ? definition.presetValue : newValue
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

  const isRelation = condition.kind === 'relation';
  const operatorKey = operatorKeyOf(condition);
  // A relation rule always needs a value — the id of the record whose relation
  // is being asked about — and `relatedTo` has no dropdown row to say so.
  const needsValue = isRelation || operatorNeedsValue(operatorKey);
  const needsTwoValues = !isRelation && operatorNeedsTwoValues(operatorKey);
  const isConnected = condition.valueSource === 'connected';

  // Enum fields get a value dropdown for single-value operators; booleans too
  const valueOptions = useMemo(() => {
    if (needsTwoValues) return null;
    if (fieldType === 'boolean') {
      return [
        { label: '(Select value)', value: '' },
        { label: 'true', value: 'true' },
        { label: 'false', value: 'false' }
      ];
    }
    if (selectedField?.enumValues?.length) {
      const opts = [
        { label: '(Select value)', value: '' },
        ...selectedField.enumValues.map((v) => ({ label: v, value: v }))
      ];
      // Keep a stale value visible instead of silently blanking the Select
      const current = String(condition.value ?? '');
      if (current && !selectedField.enumValues.includes(current)) {
        opts.push({ label: current, value: current });
      }
      return opts;
    }
    return null;
  }, [needsTwoValues, fieldType, selectedField, condition.value]);

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
    // Keyed by the dropdown row rather than by the operator, because the two
    // presence rows share one operator and differ only in the boolean they set.
    const options = availableOperators.map((op) => ({
      // A `degraded` operator is marked in the list too, not only once chosen,
      // so the caveat is readable *before* the choice rather than after it.
      label: op.caveat ? `${op.label} *` : op.label,
      value: op.key
    }));
    // An operator the chosen backend cannot express is not offered — but a
    // filter saved when it could be must not silently become something else.
    // The saved row stays visible and stays selected; the caveat below says why.
    if (operatorKey && !options.some((o) => o.value === operatorKey)) {
      options.unshift({ label: getOperatorLabel(operatorKey), value: operatorKey });
    }
    return options;
  }, [availableOperators, operatorKey]);

  /** The `degraded` sentence for the chosen operator, straight from the descriptor. */
  const caveat = useMemo(() => {
    const chosen = availableOperators.find((op) => op.key === operatorKey);
    if (chosen) return chosen.caveat;
    const cell = capabilities?.[condition.operator];
    // Not offered any more: say what the backend will do with it rather than
    // leaving a rule that looks fine and is not.
    return cell?.reason ?? undefined;
  }, [availableOperators, capabilities, condition.operator, operatorKey]);

  const relationOptions = useMemo(
    () => [
      { label: '(Select collection)', value: '' },
      ...(relations ?? []).map((r) => ({ label: r.className, value: r.className }))
    ],
    [relations]
  );

  const relationPropertyOptions = useMemo(() => {
    const properties = relations?.find((r) => r.className === condition.relationClass)?.properties ?? [];
    return [{ label: '(Select relation)', value: '' }, ...properties.map((p) => ({ label: p, value: p }))];
  }, [relations, condition.relationClass]);

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

        {isRelation ? (
          <>
            {/* Which collection's relation is being asked about, and which of
                its relation properties. Reads "related to <Team>.<members>". */}
            <Select
              value={condition.relationClass ?? ''}
              options={relationOptions}
              onChange={handleRelationClassChange}
              colorTheme={SelectColorTheme.Dark}
              UNSAFE_className={css.FilterConditionField}
            />
            <Select
              value={condition.relationProperty ?? ''}
              options={relationPropertyOptions}
              onChange={handleRelationPropertyChange}
              colorTheme={SelectColorTheme.Dark}
              UNSAFE_className={css.FilterConditionOperator}
            />
          </>
        ) : (
          <>
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
              value={operatorKey}
              options={operatorOptions}
              onChange={handleOperatorChange}
              colorTheme={SelectColorTheme.Dark}
              UNSAFE_className={css.FilterConditionOperator}
            />
          </>
        )}

        {/* Connected mode: the value arrives on a node input port, and the
            name is editable so two rules can share one port. */}
        {needsValue && isConnected && (
          <div className={css.FilterConditionPortIndicator} title="Value comes from this input port on the node">
            <span className={css.FilterConditionPortDot}>
              <Icon icon={IconName.CircleDot} size={IconSize.Small} />
            </span>
            <TextInput
              value={(condition.valuePortName ?? '').startsWith(valuePortPrefix)
                ? (condition.valuePortName as string).slice(valuePortPrefix.length)
                : condition.valuePortName ?? ''}
              onChange={(e) => handlePortNameChange(e.target.value)}
              placeholder="Input name"
              UNSAFE_className={css.FilterConditionPortName}
            />
          </div>
        )}

        {/* Value Input - Single value */}
        {needsValue && !needsTwoValues && !isConnected && (
          valueOptions ? (
            <Select
              value={String(condition.value ?? '')}
              options={valueOptions}
              onChange={handleValueChange}
              colorTheme={SelectColorTheme.Dark}
              UNSAFE_className={css.FilterConditionValue}
            />
          ) : (
            <TextInput
              value={String(condition.value ?? '')}
              onChange={(e) => handleValueChange(e.target.value)}
              placeholder="Value"
              UNSAFE_className={css.FilterConditionValue}
            />
          )
        )}

        {/* Between: Two value inputs */}
        {needsTwoValues && !isConnected && (
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

        {/* Static/connected toggle */}
        {needsValue && (
          <span title={isConnected ? 'Use a typed value instead' : 'Connect the value to a node input port'}>
            <IconButton
              icon={IconName.Link}
              size={IconSize.Small}
              variant={isConnected ? IconButtonVariant.Default : IconButtonVariant.Transparent}
              onClick={handleToggleValueSource}
              UNSAFE_className={css.FilterConditionConnectToggle}
            />
          </span>
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

      {/* The chosen backend's own sentence about this operator. Character for
          character the one the translator throws at runtime — BCN-003 put the
          declaration in the descriptor so there could only ever be one. */}
      {caveat && <div className={css.FilterConditionCaveat}>{caveat}</div>}
    </Box>
  );
}
