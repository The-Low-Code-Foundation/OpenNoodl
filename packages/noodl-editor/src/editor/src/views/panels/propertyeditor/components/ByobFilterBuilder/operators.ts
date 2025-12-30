/**
 * BYOB Filter Operators
 *
 * Defines available operators for each field type with human-readable labels.
 */

import { FieldType, FilterOperator, OperatorDefinition } from './types';

/**
 * All available operators with their definitions
 */
export const ALL_OPERATORS: Record<FilterOperator, OperatorDefinition> = {
  // Equality
  _eq: { value: '_eq', label: 'equals', description: 'Exact match', valueCount: 1 },
  _neq: { value: '_neq', label: 'does not equal', description: 'Not equal', valueCount: 1 },

  // Comparison
  _gt: { value: '_gt', label: 'greater than', description: 'Greater than', valueCount: 1 },
  _gte: { value: '_gte', label: 'greater than or equal', description: 'Greater than or equal', valueCount: 1 },
  _lt: { value: '_lt', label: 'less than', description: 'Less than', valueCount: 1 },
  _lte: { value: '_lte', label: 'less than or equal', description: 'Less than or equal', valueCount: 1 },

  // String
  _contains: { value: '_contains', label: 'contains', description: 'Contains substring', valueCount: 1 },
  _ncontains: { value: '_ncontains', label: 'does not contain', description: 'Does not contain', valueCount: 1 },
  _icontains: {
    value: '_icontains',
    label: 'contains (case-insensitive)',
    description: 'Contains (case-insensitive)',
    valueCount: 1
  },
  _starts_with: { value: '_starts_with', label: 'starts with', description: 'Starts with', valueCount: 1 },
  _nstarts_with: {
    value: '_nstarts_with',
    label: 'does not start with',
    description: 'Does not start with',
    valueCount: 1
  },
  _istarts_with: {
    value: '_istarts_with',
    label: 'starts with (case-insensitive)',
    description: 'Starts with (case-insensitive)',
    valueCount: 1
  },
  _ends_with: { value: '_ends_with', label: 'ends with', description: 'Ends with', valueCount: 1 },
  _nends_with: { value: '_nends_with', label: 'does not end with', description: 'Does not end with', valueCount: 1 },
  _iends_with: {
    value: '_iends_with',
    label: 'ends with (case-insensitive)',
    description: 'Ends with (case-insensitive)',
    valueCount: 1
  },

  // Array/In
  _in: { value: '_in', label: 'is one of', description: 'Value is in list', valueCount: 1 },
  _nin: { value: '_nin', label: 'is not one of', description: 'Value is not in list', valueCount: 1 },

  // Null
  _null: { value: '_null', label: 'is null', description: 'Is null', valueCount: 0 },
  _nnull: { value: '_nnull', label: 'is not null', description: 'Is not null', valueCount: 0 },

  // Between
  _between: { value: '_between', label: 'is between', description: 'Between two values', valueCount: 2 },
  _nbetween: { value: '_nbetween', label: 'is not between', description: 'Not between two values', valueCount: 2 },

  // Empty
  _empty: { value: '_empty', label: 'is empty', description: 'Is empty string or array', valueCount: 0 },
  _nempty: { value: '_nempty', label: 'is not empty', description: 'Is not empty', valueCount: 0 },

  // Regex
  _regex: { value: '_regex', label: 'matches regex', description: 'Matches regular expression', valueCount: 1 }
};

/**
 * Operators available for each field type
 */
const OPERATORS_BY_TYPE: Record<FieldType, FilterOperator[]> = {
  // String types - full text operators
  string: [
    '_eq',
    '_neq',
    '_contains',
    '_ncontains',
    '_icontains',
    '_starts_with',
    '_nstarts_with',
    '_istarts_with',
    '_ends_with',
    '_nends_with',
    '_iends_with',
    '_in',
    '_nin',
    '_null',
    '_nnull',
    '_empty',
    '_nempty',
    '_regex'
  ],
  text: [
    '_eq',
    '_neq',
    '_contains',
    '_ncontains',
    '_icontains',
    '_starts_with',
    '_nstarts_with',
    '_ends_with',
    '_nends_with',
    '_null',
    '_nnull',
    '_empty',
    '_nempty',
    '_regex'
  ],

  // Numeric types - comparison operators
  integer: ['_eq', '_neq', '_gt', '_gte', '_lt', '_lte', '_in', '_nin', '_between', '_nbetween', '_null', '_nnull'],
  float: ['_eq', '_neq', '_gt', '_gte', '_lt', '_lte', '_in', '_nin', '_between', '_nbetween', '_null', '_nnull'],
  decimal: ['_eq', '_neq', '_gt', '_gte', '_lt', '_lte', '_in', '_nin', '_between', '_nbetween', '_null', '_nnull'],

  // Boolean - simple equality
  boolean: ['_eq', '_neq', '_null', '_nnull'],

  // Date/Time types - comparison and between
  date: ['_eq', '_neq', '_gt', '_gte', '_lt', '_lte', '_between', '_nbetween', '_null', '_nnull'],
  datetime: ['_eq', '_neq', '_gt', '_gte', '_lt', '_lte', '_between', '_nbetween', '_null', '_nnull'],
  time: ['_eq', '_neq', '_gt', '_gte', '_lt', '_lte', '_between', '_nbetween', '_null', '_nnull'],
  timestamp: ['_eq', '_neq', '_gt', '_gte', '_lt', '_lte', '_between', '_nbetween', '_null', '_nnull'],

  // UUID - equality and null
  uuid: ['_eq', '_neq', '_in', '_nin', '_null', '_nnull'],

  // JSON - limited operators
  json: ['_null', '_nnull', '_empty', '_nempty'],

  // CSV - limited operators
  csv: ['_contains', '_ncontains', '_null', '_nnull', '_empty', '_nempty'],

  // Hash - equality only
  hash: ['_eq', '_neq', '_null', '_nnull'],

  // Alias - depends on target, default to string-like
  alias: ['_eq', '_neq', '_null', '_nnull'],

  // Unknown - basic operators
  unknown: ['_eq', '_neq', '_null', '_nnull']
};

/**
 * Get available operators for a field type
 */
export function getOperatorsForType(type: FieldType): OperatorDefinition[] {
  const operatorKeys = OPERATORS_BY_TYPE[type] || OPERATORS_BY_TYPE.unknown;
  return operatorKeys.map((key) => ALL_OPERATORS[key]);
}

/**
 * Get operator definition by value
 */
export function getOperatorDefinition(operator: FilterOperator): OperatorDefinition {
  return ALL_OPERATORS[operator] || ALL_OPERATORS._eq;
}

/**
 * Get a friendly display label for an operator
 */
export function getOperatorLabel(operator: FilterOperator): string {
  return ALL_OPERATORS[operator]?.label || operator;
}

/**
 * Check if operator requires a value input
 */
export function operatorNeedsValue(operator: FilterOperator): boolean {
  const def = ALL_OPERATORS[operator];
  return def ? def.valueCount > 0 : true;
}

/**
 * Check if operator requires two values (between)
 */
export function operatorNeedsTwoValues(operator: FilterOperator): boolean {
  const def = ALL_OPERATORS[operator];
  return def ? def.valueCount === 2 : false;
}
