/**
 * BYOB Filter Builder Module
 *
 * Visual filter builder for Directus-compatible queries
 */

export { ByobFilterBuilder } from './ByobFilterBuilder';
export { DragProvider, useDragContext } from './DragContext';
export { FilterBuilderButton } from './FilterBuilderButton';
export { FilterBuilderModal } from './FilterBuilderModal';
export { FilterGroup } from './FilterGroup';
export { FilterCondition } from './FilterCondition';

// Types
export type {
  ByobFilterBuilderProps,
  FilterCombinator,
  FilterCondition as FilterConditionType,
  FilterGroup as FilterGroupType,
  FilterItem,
  FilterOperator,
  FilterValue,
  FilterValueSource,
  FieldType,
  OperatorDefinition,
  SchemaCollection,
  SchemaField
} from './types';

// Utilities
export {
  countFilterItems,
  createEmptyCondition,
  createEmptyFilterGroup,
  generateId,
  getFilterSummary,
  isFilterGroup
} from './types';

// Converter
export { filterToJsonString, fromDirectusFilter, jsonStringToFilter, toDirectusFilter } from './converter';

// Operators
export {
  ALL_OPERATORS,
  getOperatorDefinition,
  getOperatorLabel,
  getOperatorsForType,
  operatorNeedsValue,
  operatorNeedsTwoValues
} from './operators';
