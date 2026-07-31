/**
 * BYOB Filter Operators
 *
 * Defines available operators for each field type with human-readable labels.
 */

import { FieldType, OperatorCapabilities, OperatorDefinition } from './types';

/**
 * All available operators with their definitions
 */
/** The comparison set every numeric column gets. */
function NUMERIC_OPERATORS(): string[] {
  return [
    'equalTo',
    'notEqualTo',
    'greaterThan',
    'greaterThanOrEqualTo',
    'lessThan',
    'lessThanOrEqualTo',
    'containedIn',
    'notContainedIn',
    'between',
    'notBetween',
    'notExists',
    'exists'
  ];
}

/** The same, minus set membership, for date and time columns. */
function TEMPORAL_OPERATORS(): string[] {
  return [
    'equalTo',
    'notEqualTo',
    'greaterThan',
    'greaterThanOrEqualTo',
    'lessThan',
    'lessThanOrEqualTo',
    'between',
    'notBetween',
    'notExists',
    'exists'
  ];
}

export const ALL_OPERATORS: Record<string, OperatorDefinition> = {
  // Equality
  equalTo: { key: 'equalTo', value: 'equalTo', label: 'equals', description: 'Exact match', valueCount: 1 },
  notEqualTo: { key: 'notEqualTo', value: 'notEqualTo', label: 'does not equal', description: 'Not equal', valueCount: 1 },

  // Comparison
  greaterThan: { key: 'greaterThan', value: 'greaterThan', label: 'greater than', description: 'Greater than', valueCount: 1 },
  greaterThanOrEqualTo: {
    key: 'greaterThanOrEqualTo',
    value: 'greaterThanOrEqualTo',
    label: 'greater than or equal',
    description: 'Greater than or equal',
    valueCount: 1
  },
  lessThan: { key: 'lessThan', value: 'lessThan', label: 'less than', description: 'Less than', valueCount: 1 },
  lessThanOrEqualTo: {
    key: 'lessThanOrEqualTo',
    value: 'lessThanOrEqualTo',
    label: 'less than or equal',
    description: 'Less than or equal',
    valueCount: 1
  },

  // String
  contains: { key: 'contains', value: 'contains', label: 'contains', description: 'Contains substring', valueCount: 1 },
  notContains: {
    key: 'notContains',
    value: 'notContains',
    label: 'does not contain',
    description: 'Does not contain',
    valueCount: 1
  },
  containsIgnoreCase: {
    key: 'containsIgnoreCase',
    value: 'containsIgnoreCase',
    label: 'contains (case-insensitive)',
    description: 'Contains (case-insensitive)',
    valueCount: 1
  },
  startsWith: { key: 'startsWith', value: 'startsWith', label: 'starts with', description: 'Starts with', valueCount: 1 },
  notStartsWith: {
    key: 'notStartsWith',
    value: 'notStartsWith',
    label: 'does not start with',
    description: 'Does not start with',
    valueCount: 1
  },
  startsWithIgnoreCase: {
    key: 'startsWithIgnoreCase',
    value: 'startsWithIgnoreCase',
    label: 'starts with (case-insensitive)',
    description: 'Starts with (case-insensitive)',
    valueCount: 1
  },
  endsWith: { key: 'endsWith', value: 'endsWith', label: 'ends with', description: 'Ends with', valueCount: 1 },
  notEndsWith: {
    key: 'notEndsWith',
    value: 'notEndsWith',
    label: 'does not end with',
    description: 'Does not end with',
    valueCount: 1
  },
  endsWithIgnoreCase: {
    key: 'endsWithIgnoreCase',
    value: 'endsWithIgnoreCase',
    label: 'ends with (case-insensitive)',
    description: 'Ends with (case-insensitive)',
    valueCount: 1
  },

  // Array/In
  containedIn: { key: 'containedIn', value: 'containedIn', label: 'is one of', description: 'Value is in list', valueCount: 1 },
  notContainedIn: {
    key: 'notContainedIn',
    value: 'notContainedIn',
    label: 'is not one of',
    description: 'Value is not in list',
    valueCount: 1
  },

  // Presence. One operator, two rows — see `OperatorDefinition`.
  notExists: {
    key: 'notExists',
    value: 'exists',
    presetValue: false,
    label: 'is not set',
    description: 'The field has no value',
    valueCount: 0
  },
  exists: {
    key: 'exists',
    value: 'exists',
    presetValue: true,
    label: 'is set',
    description: 'The field has a value',
    valueCount: 0
  },

  // Between
  between: { key: 'between', value: 'between', label: 'is between', description: 'Between two values', valueCount: 2 },
  notBetween: {
    key: 'notBetween',
    value: 'notBetween',
    label: 'is not between',
    description: 'Not between two values',
    valueCount: 2
  },

  // Empty — a different question from "is not set". An empty string is a value.
  isEmpty: { key: 'isEmpty', value: 'isEmpty', label: 'is empty', description: 'Is empty string or array', valueCount: 0 },
  isNotEmpty: { key: 'isNotEmpty', value: 'isNotEmpty', label: 'is not empty', description: 'Is not empty', valueCount: 0 },

  // Regex
  matchesRegex: {
    key: 'matchesRegex',
    value: 'matchesRegex',
    label: 'matches regex',
    description: 'Matches regular expression',
    valueCount: 1
  },

  // Pointer. BCN-003b folded this in from `QueryEditor`, which offered it
  // automatically the moment a Pointer column was chosen.
  pointsTo: {
    key: 'pointsTo',
    value: 'pointsTo',
    label: 'points to record',
    description: 'The record this points at, by id',
    valueCount: 1
  }
};

/**
 * Operators available for each field type, by dropdown key.
 */
const OPERATORS_BY_TYPE: Record<FieldType, string[]> = {
  // String types - full text operators
  string: [
    'equalTo',
    'notEqualTo',
    'contains',
    'notContains',
    'containsIgnoreCase',
    'startsWith',
    'notStartsWith',
    'startsWithIgnoreCase',
    'endsWith',
    'notEndsWith',
    'endsWithIgnoreCase',
    'containedIn',
    'notContainedIn',
    'notExists',
    'exists',
    'isEmpty',
    'isNotEmpty',
    'matchesRegex'
  ],
  text: [
    'equalTo',
    'notEqualTo',
    'contains',
    'notContains',
    'containsIgnoreCase',
    'startsWith',
    'notStartsWith',
    'endsWith',
    'notEndsWith',
    'notExists',
    'exists',
    'isEmpty',
    'isNotEmpty',
    'matchesRegex'
  ],

  // Numeric types - comparison operators
  integer: NUMERIC_OPERATORS(),
  float: NUMERIC_OPERATORS(),
  decimal: NUMERIC_OPERATORS(),

  // Boolean - simple equality
  boolean: ['equalTo', 'notEqualTo', 'notExists', 'exists'],

  // Date/Time types - comparison and between
  date: TEMPORAL_OPERATORS(),
  datetime: TEMPORAL_OPERATORS(),
  time: TEMPORAL_OPERATORS(),
  timestamp: TEMPORAL_OPERATORS(),

  // UUID - equality and presence
  uuid: ['equalTo', 'notEqualTo', 'containedIn', 'notContainedIn', 'notExists', 'exists'],

  // JSON - limited operators
  json: ['notExists', 'exists', 'isEmpty', 'isNotEmpty'],

  // CSV - limited operators
  csv: ['contains', 'notContains', 'notExists', 'exists', 'isEmpty', 'isNotEmpty'],

  // Hash - equality only
  hash: ['equalTo', 'notEqualTo', 'notExists', 'exists'],

  // Alias - depends on target, default to string-like
  alias: ['equalTo', 'notEqualTo', 'notExists', 'exists'],

  // Pointer - which record it points at, and whether it is set at all
  pointer: ['pointsTo', 'notExists', 'exists'],

  // Unknown - basic operators
  unknown: ['equalTo', 'notEqualTo', 'notExists', 'exists']
};

/**
 * Get available operators for a field type, filtered by what the backend can do.
 *
 * ⚠️ **The gate reads the descriptor, it does not have an opinion of its own.**
 * BCN-003 put the operator declaration in the capability descriptor rather than
 * in each translator so that the sentence thrown at runtime and the sentence
 * shown in the editor are the same string. This is the editor end of that: a
 * `degraded` cell's `reason` becomes the row's `caveat` verbatim, and an
 * `unsupported` or unproven `conditional` one is simply not offered.
 *
 * With no capability table every operator is offered, which is what the builder
 * did before BCN-003b and is the right floor: it cannot hide an operator the
 * backend can actually answer.
 */
export function getOperatorsForType(type: FieldType, capabilities?: OperatorCapabilities): OperatorDefinition[] {
  const keys = OPERATORS_BY_TYPE[type] || OPERATORS_BY_TYPE.unknown;
  const definitions = keys.map((key) => ALL_OPERATORS[key]);
  if (!capabilities) return definitions;

  return definitions
    .map((definition) => {
      const cell = capabilities[definition.value];
      // An operator the table says nothing about is offered. The table is a
      // declaration of what a backend *can* do, and silence is not a refusal.
      if (!cell) return definition;
      if (cell.state === 'unsupported' || cell.state === 'conditional') return null;
      if (cell.state === 'degraded' && cell.reason) return { ...definition, caveat: cell.reason };
      return definition;
    })
    .filter((definition): definition is OperatorDefinition => definition !== null);
}

/** Get a dropdown row by its key. */
export function getOperatorDefinition(key: string): OperatorDefinition {
  return ALL_OPERATORS[key] || ALL_OPERATORS.equalTo;
}

/** Get a friendly display label for a dropdown row. */
export function getOperatorLabel(key: string): string {
  return ALL_OPERATORS[key]?.label || key;
}

/** Does this row need a value typed in? */
export function operatorNeedsValue(key: string): boolean {
  const def = ALL_OPERATORS[key];
  return def ? def.valueCount > 0 : true;
}

/** Does this row need two values (between)? */
export function operatorNeedsTwoValues(key: string): boolean {
  const def = ALL_OPERATORS[key];
  return def ? def.valueCount === 2 : false;
}
