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
  OperatorCapabilities,
  OperatorCapability,
  OperatorDefinition,
  SchemaCollection,
  SchemaField,
  SchemaRelation
} from './types';

// Utilities
export {
  countFilterItems,
  createEmptyCondition,
  createEmptyFilterGroup,
  createEmptyRelationCondition,
  DEFAULT_VALUE_PORT_PREFIX,
  generateFilterPortName,
  generateId,
  getFilterSummary,
  isFilterGroup
} from './types';

// The Parse-family schema, adapted to the one shape the builder reads
export { isParseSchema, parseSchemaToCollection, type ParseCollectionSchema } from './parseSchema';

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
